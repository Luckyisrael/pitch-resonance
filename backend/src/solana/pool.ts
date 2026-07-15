import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import fs from 'fs'
import path from 'path'

const POOL_FILE = path.join(__dirname, '../../data/pool-wallet.json')

let _keypair: Keypair | null = null
let _connection: Connection | null = null

export function getConnection(): Connection {
  if (!_connection) {
    _connection = new Connection(
      process.env.SOLANA_RPC || 'https://api.devnet.solana.com',
      'confirmed'
    )
  }
  return _connection
}

export function getPoolKeypair(): Keypair {
  if (_keypair) return _keypair

  if (fs.existsSync(POOL_FILE)) {
    const data = JSON.parse(fs.readFileSync(POOL_FILE, 'utf-8'))
    _keypair = Keypair.fromSecretKey(new Uint8Array(data.secretKey))
  } else {
    _keypair = Keypair.generate()
    const dir = path.dirname(POOL_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(POOL_FILE, JSON.stringify({ secretKey: Array.from(_keypair.secretKey) }))
    console.log(`Generated new pool wallet: ${_keypair.publicKey.toBase58()}`)
  }

  return _keypair
}

export function getPoolAddress(): PublicKey {
  return getPoolKeypair().publicKey
}

export async function ensurePoolBalance(minLamports: number = 2 * LAMPORTS_PER_SOL) {
  const conn = getConnection()
  const pk = getPoolAddress()
  try {
    const bal = await conn.getBalance(pk)
    if (bal >= minLamports) return
    console.log(`Pool wallet balance: ${bal / LAMPORTS_PER_SOL} SOL — requesting airdrop (background)...`)
    conn.requestAirdrop(pk, LAMPORTS_PER_SOL * 5).then(sig => {
      conn.confirmTransaction(sig, 'confirmed').then(() => console.log('Airdropped 5 SOL to pool wallet')).catch(() => {})
    }).catch(() => {})
  } catch {
    console.log('Pool wallet balance check failed')
  }
}

export function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL
}
