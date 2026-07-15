import { Connection, PublicKey, LAMPORTS_PER_SOL, clusterApiUrl } from '@solana/web3.js'

const WALLET = 'CXUmnHC9Rm73WubEnrWMMC9NR4YZ82Ba9cDiCyTkKSe6'
const RPC = 'https://api.devnet.solana.com'
const ALT_RPCS = [
  'https://api.devnet.solana.com',
  'https://devnet.genesysgo.net',
]

async function tryAirdrop(rpc: string, address: PublicKey, amount: number): Promise<boolean> {
  try {
    const conn = new Connection(rpc, 'confirmed')
    const sig = await conn.requestAirdrop(address, amount)
    await conn.confirmTransaction(sig, 'confirmed')
    return true
  } catch {
    return false
  }
}

async function main() {
  const address = new PublicKey(WALLET)
  const conn = new Connection(RPC, 'confirmed')

  let balance = await conn.getBalance(address)
  console.log(`Current balance: ${balance / LAMPORTS_PER_SOL} SOL`)

  if (balance >= 0.5 * LAMPORTS_PER_SOL) {
    console.log('Sufficient balance, no airdrop needed')
    return
  }

  console.log('Attempting airdrop across multiple RPCs and amounts...')
  const amounts = [LAMPORTS_PER_SOL, 0.5 * LAMPORTS_PER_SOL, 0.2 * LAMPORTS_PER_SOL]

  for (const rpc of ALT_RPCS) {
    for (const amount of amounts) {
      console.log(`  Trying ${rpc} with ${amount / LAMPORTS_PER_SOL} SOL...`)
      const ok = await tryAirdrop(rpc, address, amount)
      if (ok) {
        balance = await conn.getBalance(address)
        console.log(`  SUCCESS! New balance: ${balance / LAMPORTS_PER_SOL} SOL`)
        return
      }
      await new Promise(r => setTimeout(r, 2000))
    }
  }

  console.log('')
  console.log('All automated airdrops failed due to rate limits.')
  console.log('Please request devnet SOL manually:')
  console.log('')
  console.log('  1. Open https://faucet.solana.com')
  console.log(`  2. Enter: ${WALLET}`)
  console.log('  3. Request 2 SOL')
  console.log('  4. Run: npx tsx activate.ts')
}

main()
