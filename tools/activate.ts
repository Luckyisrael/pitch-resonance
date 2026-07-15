import * as fs from 'fs'
import * as path from 'path'
import * as anchor from '@coral-xyz/anchor'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token'
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js'
import axios from 'axios'
import nacl from 'tweetnacl'

const API_ORIGIN = 'https://txline-dev.txodds.com'
const API_BASE = `${API_ORIGIN}/api`
const JWT_URL = `${API_ORIGIN}/auth/guest/start`
const RPC_URL = 'https://api.devnet.solana.com'
const PROGRAM_ID = new PublicKey('6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J')
const TOKEN_MINT = new PublicKey('4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG')
const SERVICE_LEVEL_ID = 1
const DURATION_WEEKS = 4
const SELECTED_LEAGUES: number[] = []
const IDL_PATH = path.join(__dirname, 'txoracle.json')
const ENV_PATH = path.join(__dirname, '..', 'backend', '.env')
const KEY_PATH = path.join(__dirname, '_keys', 'pitch-resonance-wallet.json')

async function waitForFunds(connection: anchor.web3.Connection, pubkey: PublicKey): Promise<void> {
  for (let i = 0; i < 60; i++) {
    const bal = await connection.getBalance(pubkey)
    if (bal >= 0.01 * LAMPORTS_PER_SOL) return
    process.stdout.write('.')
    await new Promise(r => setTimeout(r, 3000))
  }
  console.log('\nStill no funds detected. Run "npm run activate" again when wallet is funded.')
  process.exit(1)
}

async function main() {
  console.log('\n  ╔══════════════════════════════════════════════╗')
  console.log('  ║   Pitch Resonance — TxODDS Free Tier Setup  ║')
  console.log('  ╚══════════════════════════════════════════════╝\n')

  const keypair = loadOrCreateKeypair()
  const pubkey = keypair.publicKey
  console.log(`  Wallet:  ${pubkey.toBase58()}`)

  const connection = new anchor.web3.Connection(RPC_URL, 'confirmed')
  let balance = await connection.getBalance(pubkey)
  console.log(`  Balance: ${balance / LAMPORTS_PER_SOL} SOL`)

  if (balance < 0.01 * LAMPORTS_PER_SOL) {
    console.log('')
    console.log('  ── Need devnet SOL ──')
    console.log('  Open this URL in your browser:')
    console.log(`  https://faucet.solana.com/?address=${pubkey.toBase58()}`)
    console.log('')
    console.log('  1. Paste or confirm the address above')
    console.log('  2. Click "Request 2 SOL" (devnet)')
    console.log('  3. Wait... I\'ll detect when funds arrive')
    console.log('')
    process.stdout.write('  Waiting for funds')
    await waitForFunds(connection, pubkey)
    balance = await connection.getBalance(pubkey)
    console.log(`\n  ✓ Balance: ${balance / LAMPORTS_PER_SOL} SOL`)
  }

  const provider = new anchor.AnchorProvider(
    connection, new anchor.Wallet(keypair), { commitment: 'confirmed' },
  )
  anchor.setProvider(provider)

  if (!fs.existsSync(IDL_PATH)) throw new Error(`Missing IDL at ${IDL_PATH}`)
  const idl = JSON.parse(fs.readFileSync(IDL_PATH, 'utf-8'))
  const program = new anchor.Program(idl, provider)

  const [pricingMatrixPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('pricing_matrix')], program.programId,
  )
  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('token_treasury_v2')], program.programId,
  )
  const tokenTreasuryVault = getAssociatedTokenAddressSync(
    TOKEN_MINT, tokenTreasuryPda, true,
    TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
  )
  const userTokenAccount = getAssociatedTokenAddressSync(
    TOKEN_MINT, keypair.publicKey, false,
    TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
  )

  const ataInfo = await connection.getAccountInfo(userTokenAccount)
  if (!ataInfo) {
    console.log('\n  Creating token account...')
    const tx = new anchor.web3.Transaction().add(
      createAssociatedTokenAccountInstruction(
        keypair.publicKey, userTokenAccount, keypair.publicKey,
        TOKEN_MINT, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
    )
    await anchor.web3.sendAndConfirmTransaction(connection, tx, [keypair])
  }

  console.log('\n  ── Getting guest JWT ──')
  const authRes = await axios.post(JWT_URL)
  const jwt: string = authRes.data.token
  console.log(`  JWT: ${jwt.slice(0, 32)}...`)

  console.log('\n  ── Subscribing on-chain (free tier) ──')
  console.log(`  Level ${SERVICE_LEVEL_ID}, ${DURATION_WEEKS} weeks`)
  const txSig = await program.methods
    .subscribe(SERVICE_LEVEL_ID, DURATION_WEEKS)
    .accounts({
      user: keypair.publicKey,
      pricingMatrix: pricingMatrixPda,
      tokenMint: TOKEN_MINT,
      userTokenAccount,
      tokenTreasuryVault,
      tokenTreasuryPda,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([keypair])
    .rpc()
  console.log(`  TX: ${txSig}`)

  console.log('\n  ── Activating API token ──')
  const msg = `${txSig}:${SELECTED_LEAGUES.join(',')}:${jwt}`
  const sigBytes = nacl.sign.detached(new TextEncoder().encode(msg), keypair.secretKey)
  const walletSig = Buffer.from(sigBytes).toString('base64')

  const actRes = await axios.post(
    `${API_BASE}/token/activate`,
    { txSig, walletSignature: walletSig, leagues: SELECTED_LEAGUES },
    { headers: { Authorization: `Bearer ${jwt}` } },
  )
  const apiToken: string = actRes.data.token || actRes.data

  fs.writeFileSync(ENV_PATH, `TXODDS_API_BASE=${API_BASE}
TXODDS_JWT=${jwt}
TXODDS_API_TOKEN=${apiToken}
SOLANA_RPC=${RPC_URL}
SOLANA_NETWORK=devnet
PROGRAM_ID=
ADMIN_SECRET_KEY=
PORT=4000
FRONTEND_URL=http://localhost:3000
`)

  console.log('')
  console.log('  ╔══════════════════════════════════════════════╗')
  console.log('  ║            ACTIVATION COMPLETE!             ║')
  console.log('  ╚══════════════════════════════════════════════╝')
  console.log('')
  console.log(`  ✓ Wrote backend/.env`)
  console.log(`  TXODDS_JWT=${jwt}`)
  console.log(`  TXODDS_API_TOKEN=${apiToken}`)
  console.log(`  Wallet: ${pubkey.toBase58()}`)
}

function loadOrCreateKeypair(): Keypair {
  const keyDir = path.join(__dirname, '_keys')
  if (!fs.existsSync(keyDir)) fs.mkdirSync(keyDir, { recursive: true })
  if (fs.existsSync(KEY_PATH)) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(KEY_PATH, 'utf-8'))))
  }
  const kp = Keypair.generate()
  fs.writeFileSync(KEY_PATH, JSON.stringify(Array.from(kp.secretKey)))
  return kp
}

main().catch(err => {
  console.error(`\n  ✗ ${err.message || err}`)
  process.exit(1)
})
