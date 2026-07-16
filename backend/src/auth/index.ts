import { Router, Request, Response, NextFunction } from 'express'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const BASE = BigInt(ALPHABET.length)

function decodeBase58(input: string): Uint8Array {
  let num = BigInt(0)
  for (const ch of input) {
    const idx = ALPHABET.indexOf(ch)
    if (idx < 0) return new Uint8Array(0)
    num = num * BASE + BigInt(idx)
  }
  const bytes: number[] = []
  while (num > 0) {
    bytes.unshift(Number(num & BigInt(255)))
    num >>= BigInt(8)
  }
  // Preserve leading 1s as zero bytes
  for (const ch of input) {
    if (ch === '1') bytes.unshift(0)
    else break
  }
  return new Uint8Array(bytes.slice(0, 32))
}

const router = Router()

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required')
  process.exit(1)
}
const NONCE_EXPIRY = 5 * 60 * 1000

const nonces = new Map<string, { nonce: string; wallet: string; expiresAt: number }>()

// Optional auth — silently passes through if no token, attaches user if valid
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET!) as unknown as { wallet: string }
      ;(req as any).user = decoded
    } catch { /* ignore invalid token */ }
  }
  next()
}

// Strict auth — blocks unauthenticated requests
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!(req as any).user) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }
  next()
}

// Re-export for backwards compat
export const authenticateToken = requireAuth

// POST /api/auth/nonce
router.post('/nonce', (req, res) => {
  const { wallet } = req.body as { wallet?: string }
  if (!wallet || typeof wallet !== 'string') {
    res.status(400).json({ error: 'Wallet address required' })
    return
  }

  // Basic validation: must be a base58 string at least 32 chars
  if (wallet.length < 32 || !/^[1-9A-HJ-NP-Za-km-z]+$/.test(wallet)) {
    res.status(400).json({ error: 'Invalid Solana wallet address' })
    return
  }

  // Clean expired nonces
  const now = Date.now()
  for (const [key, val] of nonces) {
    if (val.expiresAt < now) nonces.delete(key)
  }

  const nonce = crypto.randomBytes(16).toString('hex')
  const message = `Sign in to Pitch Resonance\nNonce: ${nonce}`
  const id = crypto.randomUUID()
  nonces.set(id, { nonce, wallet, expiresAt: now + NONCE_EXPIRY })

  res.json({ nonce, id, message })
})

// POST /api/auth/verify
router.post('/verify', async (req, res) => {
  const { wallet, signature, nonce } = req.body as { wallet?: string; signature?: string; nonce?: string }
  if (!wallet || !signature || !nonce) {
    res.status(400).json({ error: 'wallet, signature, and nonce required' })
    return
  }

  // Find and consume the nonce
  let found = false
  for (const [key, val] of nonces) {
    if (val.nonce === nonce && val.wallet === wallet && val.expiresAt > Date.now()) {
      nonces.delete(key)
      found = true
      break
    }
  }

  if (!found) {
    res.status(401).json({ error: 'Invalid or expired nonce' })
    return
  }

  // Verify Ed25519 signature
  const message = `Sign in to Pitch Resonance\nNonce: ${nonce}`
  const messageBytes = new TextEncoder().encode(message)

  try {
    const pubkeyBytes = decodeBase58(wallet)
    if (pubkeyBytes.length !== 32) {
      res.status(401).json({ error: 'Signature verification failed' })
      return
    }
    const signatureBytes = Buffer.from(signature, 'hex')

    const key = await crypto.subtle.importKey(
      'raw',
      pubkeyBytes,
      { name: 'Ed25519' },
      false,
      ['verify']
    )
    const verified = await crypto.subtle.verify(
      { name: 'Ed25519' },
      key,
      signatureBytes,
      messageBytes
    )

    if (!verified) {
      res.status(401).json({ error: 'Signature verification failed' })
      return
    }
  } catch {
    res.status(401).json({ error: 'Signature verification failed' })
    return
  }

  const token = jwt.sign({ wallet }, JWT_SECRET, { expiresIn: '24h' })
  res.json({ token, wallet })
})

// GET /api/auth/me
router.get('/me', (req, res) => {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' })
    return
  }

  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET!) as unknown as { wallet: string }
    res.json({ wallet: decoded.wallet })
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
})

export default router
