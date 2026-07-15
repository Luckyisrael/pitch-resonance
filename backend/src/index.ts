import dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import cors from 'cors'
import http from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { TxoddsClient } from './txodds/client'
import type { PitchGridData } from './txodds/types'
import { getAllMatches, getMatchScores, insertTip, getMatchTotalTips, getUserMatchTips, markTipsClaimed, setMatchSettled, getMatchSettled, getBoardStats } from './db/client'
import authRouter, { authenticateToken } from './auth/index'
import { EVENTS } from './socket/events'
import { PitchGrid } from './txodds/parser'
import { simulateMatch } from './txodds/simulator'
import historicalRouter from './historical/index'
import physicsRouter from './physics/index'
import { computePhysicsFrame } from './physics/engine'
import { ReplayEngine } from './replay/engine'
import { getPoolKeypair, getPoolAddress, getConnection, ensurePoolBalance, lamportsToSol } from './solana/pool'
import { Connection, SystemProgram, Transaction, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'

const PORT = parseInt(process.env.PORT || '4000')
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'
const TXODDS_API_BASE = process.env.TXODDS_API_BASE || 'https://txline-dev.txodds.com/api'
const TXODDS_JWT = process.env.TXODDS_JWT || ''
const TXODDS_API_TOKEN = process.env.TXODDS_API_TOKEN || ''
const SOLANA_RPC = process.env.SOLANA_RPC || 'https://api.devnet.solana.com'

type MatchPool = { homePool: number; awayPool: number }
type ShockwaveQueue = Array<{ originX: number; originY: number; intensity: number; tipId: string; team: 1 | 2 }>

const app = express()
const corsOrigins = FRONTEND_URL === '*' ? '*' : FRONTEND_URL.split(',').map(s => s.trim())
app.use(cors({ origin: corsOrigins, credentials: true }))
app.use(express.json())

const server = http.createServer(app)
const io = new SocketIOServer(server, {
  cors: { origin: corsOrigins, methods: ['GET', 'POST'], credentials: true },
})

// In-memory pool cache (fast reads). DB is source of truth for tips.
const matchPools = new Map<string, MatchPool>()
const activeClients = new Map<string, Set<string>>()
const txoddsClients = new Map<string, TxoddsClient>()
const replayEngines = new Map<string, ReplayEngine>()

let serverStart = Date.now()
let liveMatchId: string | null = null
let liveGridData: PitchGridData | null = null
let liveMatchState = { homeTeam: 'Home Team', awayTeam: 'Away Team', homeScore: 0, awayScore: 0, possessionHome: 50, phase: 1, status: 'live' as 'live' | 'finished' | 'upcoming' }

async function updatePoolsFromDb(matchId: string) {
  const db = getMatchTotalTips(matchId)
  matchPools.set(matchId, { homePool: db.homePool, awayPool: db.awayPool })
  io.to(`match:${matchId}`).emit(EVENTS.HYPE_UPDATE, { homePool: db.homePool, awayPool: db.awayPool })
  return db
}

async function updatePoolsWithTip(matchId: string, team: 1 | 2, amountLamports: number) {
  const pool = matchPools.get(matchId) || { homePool: 0, awayPool: 0 }
  if (team === 1) pool.homePool += amountLamports
  else pool.awayPool += amountLamports
  matchPools.set(matchId, pool)
  io.to(`match:${matchId}`).emit(EVENTS.HYPE_UPDATE, { homePool: pool.homePool, awayPool: pool.awayPool })
}

function triggerShockwave(matchId: string, data: ShockwaveQueue[0]) {
  io.to(`match:${matchId}`).emit(EVENTS.SHOCKWAVE, data)
}

// POST /api/hype/tip — receive a real Solana tx signature, verify on-chain, update pools
app.post('/api/hype/tip', async (req, res) => {
  try {
    const { matchId, team, signature } = req.body as { matchId?: string; team?: string; signature?: string }
    if (!matchId || !team || (team !== 'home' && team !== 'away')) {
      res.status(400).json({ error: 'matchId and team (home|away) required' })
      return
    }
    const teamNum = team === 'home' ? 1 : 2

    let finalAmountLamports: number
    let userWallet: string

    if (!signature) {
      res.status(400).json({ error: 'Transaction signature required' })
      return
    }

    // --- On-chain verification ---
    const conn = getConnection()
    const parsed = await conn.getParsedTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    })
    if (!parsed || !parsed.meta || parsed.meta.err) {
      res.status(400).json({ error: 'Transaction not found or failed' })
      return
    }

    // Verify the pool wallet received SOL
    const poolStr = getPoolAddress().toBase58()
    const accountKeys = parsed.transaction.message.accountKeys
    let amountReceived = 0
    let senderStr = ''
    for (let i = 0; i < accountKeys.length; i++) {
      const pkStr = accountKeys[i].pubkey.toBase58()
      if (pkStr === poolStr) {
        const pre = parsed.meta.preBalances[i] ?? 0
        const post = parsed.meta.postBalances[i] ?? 0
        amountReceived = post - pre
      } else if (i === 0) {
        senderStr = pkStr
      }
    }

    if (amountReceived <= 0) {
      res.status(400).json({ error: 'Pool wallet did not receive SOL in this transaction' })
      return
    }

    const hasMemo = parsed.meta.logMessages?.some(log => log.includes(`"tip:${matchId}:${team}"`)) ?? false
    if (!hasMemo) {
      res.status(400).json({ error: 'Transaction missing required memo (tip:matchId:team)' })
      return
    }

    if (!senderStr) {
      res.status(400).json({ error: 'Could not determine sender' })
      return
    }

    finalAmountLamports = amountReceived
    userWallet = senderStr

    const inserted = insertTip(signature, matchId, userWallet, teamNum, finalAmountLamports)
    if (!inserted) {
      res.status(409).json({ error: 'Tip signature already recorded', signature })
      return
    }

    await updatePoolsWithTip(matchId, teamNum, finalAmountLamports)

    // Trigger shockwave
    triggerShockwave(matchId, {
      originX: liveGridData?.ballX ?? 128,
      originY: liveGridData?.ballY ?? 128,
      intensity: Math.min(1, finalAmountLamports / 1e8),
      tipId: signature || `sim_${Date.now()}`,
      team: teamNum,
    })

    res.json({
      success: true,
      matchId,
      team,
      amount: lamportsToSol(finalAmountLamports),
      lamports: finalAmountLamports,
      explorerUrl: signature ? `https://solscan.io/tx/${signature}?cluster=devnet` : null,
    })
  } catch (err: any) {
    console.error('Tip error:', err)
    res.status(500).json({ error: err.message || 'Tip processing failed' })
  }
})

// POST /api/hype/claim — claim winnings for a settled match
app.post('/api/hype/claim', authenticateToken, async (req, res) => {
  try {
    const { matchId } = req.body as { matchId?: string }
    if (!matchId) {
      res.status(400).json({ error: 'matchId required' })
      return
    }

    const userWallet = (req as any).user?.wallet
    if (!userWallet) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }

    // Check match is settled
    const settled = getMatchSettled(matchId)
    if (!settled || !settled.settled) {
      res.status(400).json({ error: 'Match not yet settled' })
      return
    }

    const winner = settled.winner
    if (!winner || winner === 0) {
      res.status(400).json({ error: 'Match was a draw — no winnings to claim' })
      return
    }

    // Get user's unclaimed tips on the winning team
    const userTips = getUserMatchTips(matchId, userWallet)
    const winningTeam = winner === 1 ? 'home' : 'away'
    const userWinningUnclaimed = winner === 1 ? userTips.totalUnclaimedHome : userTips.totalUnclaimedAway
    const userWinningTotal = winner === 1 ? userTips.totalHome : userTips.totalAway

    if (userWinningUnclaimed <= 0) {
      res.status(400).json({ error: 'No unclaimed winning tips for this match' })
      return
    }

    // Compute parimutuel share
    const totalPool = getMatchTotalTips(matchId)
    const totalWinningPool = winner === 1 ? totalPool.homePool : totalPool.awayPool
    const totalBothPools = totalPool.homePool + totalPool.awayPool
    const distributionPercent = 96.5 // 3.5% platform fee
    const payoutPool = totalBothPools * (distributionPercent / 100)
    const userShareLamports = totalWinningPool > 0
      ? Math.floor((userWinningUnclaimed / totalWinningPool) * payoutPool)
      : 0

    if (userShareLamports <= 0) {
      res.status(400).json({ error: 'Payout too small' })
      return
    }

    // Send SOL from pool wallet to user
    const conn = getConnection()
    const poolKp = getPoolKeypair()
    const userPubkey = new PublicKey(userWallet)
    const poolBalance = await conn.getBalance(poolKp.publicKey)

    if (poolBalance < userShareLamports + 5000) {
      res.status(400).json({ error: 'Pool wallet has insufficient balance for payout' })
      return
    }

    const { blockhash } = await conn.getLatestBlockhash()
    const tx = new Transaction({
      recentBlockhash: blockhash,
      feePayer: poolKp.publicKey,
    }).add(
      SystemProgram.transfer({
        fromPubkey: poolKp.publicKey,
        toPubkey: userPubkey,
        lamports: userShareLamports,
      })
    )
    tx.sign(poolKp)
    const payoutSig = await conn.sendRawTransaction(tx.serialize())
    await conn.confirmTransaction(payoutSig, 'confirmed')

    // Mark tips as claimed in DB
    const claimed = markTipsClaimed(matchId, userWallet)

    // Recompute pool cache
    await updatePoolsFromDb(matchId)

    res.json({
      success: true,
      amount: lamportsToSol(userShareLamports),
      lamports: userShareLamports,
      signature: payoutSig,
      explorerUrl: `https://solscan.io/tx/${payoutSig}?cluster=devnet`,
      claimedTips: claimed,
    })
  } catch (err: any) {
    console.error('Claim error:', err)
    res.status(500).json({ error: err.message || 'Claim processing failed' })
  }
})

// POST /api/hype/settle — manually settle a match (called when match ends)
app.post('/api/hype/settle', (req, res) => {
  const { matchId, winner } = req.body as { matchId?: string; winner?: number }
  if (!matchId || winner === undefined || winner === null || ![0, 1, 2].includes(winner)) {
    res.status(400).json({ error: 'matchId and winner (0|1|2) required' })
    return
  }
  setMatchSettled(matchId, winner as 1 | 2 | 0)
  const pool = matchPools.get(matchId) || { homePool: 0, awayPool: 0 }

  io.to(`match:${matchId}`).emit(EVENTS.GAME_FINALISED, {
    matchId,
    winner,
    homePool: pool.homePool,
    awayPool: pool.awayPool,
  })

  res.json({ success: true, matchId, winner })
})

// GET /api/hype/pools/:matchId — pool + user tip stats
app.get('/api/hype/pools/:matchId', authenticateToken, (req, res) => {
  const { matchId } = req.params
  const userWallet = (req as any).user?.wallet
  const totalPools = getMatchTotalTips(matchId)
  const userTips = userWallet ? getUserMatchTips(matchId, userWallet) : { totalHome: 0, totalAway: 0, totalUnclaimedHome: 0, totalUnclaimedAway: 0 }
  const settledInfo = getMatchSettled(matchId)

  res.json({
    matchId,
    homePool: totalPools.homePool,
    awayPool: totalPools.awayPool,
    userStakeHome: userTips.totalHome,
    userStakeAway: userTips.totalAway,
    userUnclaimedHome: userTips.totalUnclaimedHome,
    userUnclaimedAway: userTips.totalUnclaimedAway,
    winner: settledInfo?.winner ?? null,
    settled: settledInfo?.settled ?? false,
  })
})

// GET /api/hype/pool-address — returns pool wallet address for building txs
app.get('/api/hype/pool-address', (_req, res) => {
  const poolKp = getPoolKeypair()
  res.json({ address: poolKp.publicKey.toBase58() })
})

// POST /api/hype/faucet — airdrop 2 devnet SOL to the caller's wallet
app.post('/api/hype/faucet', authenticateToken, async (req, res) => {
  try {
    const userWallet = (req as any).user?.wallet
    if (!userWallet) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }
    const conn = getConnection()
    const sig = await conn.requestAirdrop(new PublicKey(userWallet), 2 * LAMPORTS_PER_SOL)
    await conn.confirmTransaction(sig, 'confirmed')
    res.json({ success: true, signature: sig, explorerUrl: `https://solscan.io/tx/${sig}?cluster=devnet` })
  } catch (err: any) {
    console.error('Faucet error:', err)
    res.status(500).json({ error: err.message || 'Faucet failed' })
  }
})

async function startTxoddsStream(fixtureId?: number) {
  if (!TXODDS_JWT || !TXODDS_API_TOKEN) {
    console.log('TxODDS credentials not configured — running in demo/simulation mode')
    return
  }

  const matchId = String(fixtureId || 'live')
  if (txoddsClients.has(matchId)) return

  const client = new TxoddsClient({
    apiBase: TXODDS_API_BASE,
    jwt: TXODDS_JWT,
    apiToken: TXODDS_API_TOKEN,
    fixtureId,
  })

  let realDataReceived = false
  let simulating = false
  let stopSim: (() => void) | null = null

  client
    .onDataCallback((data) => {
      if (data.homeScore !== 0 || data.awayScore !== 0 || data.phase > 1) {
        realDataReceived = true
        if (stopSim) { stopSim(); stopSim = null; simulating = false }
      }
      if (simulating) return
      liveGridData = data
      liveMatchState.homeScore = data.homeScore
      liveMatchState.awayScore = data.awayScore
      liveMatchState.possessionHome = data.possession
      liveMatchState.phase = data.phase

      const pixelArr = Array.from(data.pixelData)
      io.to(`match:${matchId}`).emit(EVENTS.PITCH_UPDATE, {
        pixelData: pixelArr,
        possession: data.possession,
        ballX: data.ballX,
        ballY: data.ballY,
      })

      const physicsFrame = computePhysicsFrame({
        pixelData: pixelArr,
        possession: data.possession,
        ballX: data.ballX,
        ballY: data.ballY,
        homeScore: data.homeScore,
        awayScore: data.awayScore,
        phase: data.phase,
        seq: 0,
        clockSec: data.matchClock ?? Math.round((Date.now() - serverStart) / 1000),
        action: data.lastAction,
        team: data.lastTeam,
        prevBallX: data.prevBallX,
        prevBallY: data.prevBallY,
        shotPower: data.shotPower,
        cornerIndicator: data.cornerIndicator,
        foulPulse: data.foulPulse,
        cardFlash: data.cardFlash,
        attackIntensity: data.attackIntensity,
        momentumVector: data.momentumVector,
        shotsHome: data.shotsHome,
        shotsAway: data.shotsAway,
        cornersHome: data.cornersHome,
        cornersAway: data.cornersAway,
        foulsHome: data.foulsHome,
        foulsAway: data.foulsAway,
        homeYellowCards: data.homeYellowCards,
        homeRedCards: data.homeRedCards,
        awayYellowCards: data.awayYellowCards,
        awayRedCards: data.awayRedCards,
        homeMomentum: data.homeMomentum,
        awayMomentum: data.awayMomentum,
        momentumShift: data.momentumShift,
        homePressure: data.homePressure,
        awayPressure: data.awayPressure,
        smoothBallVelX: data.smoothBallVelX,
        smoothBallVelY: data.smoothBallVelY,
        smoothBallSpeed: data.smoothBallSpeed,
        smoothTerritory: data.smoothTerritory,
        territoryMomentum: data.territoryMomentum,
        matchIntensity: data.matchIntensity,
      })
      io.to(`match:${matchId}`).emit(EVENTS.PHYSICS_FRAME, physicsFrame)

      io.to(`match:${matchId}`).emit(EVENTS.MATCH_STATE, {
        matchId,
        homeTeam: liveMatchState.homeTeam,
        awayTeam: liveMatchState.awayTeam,
        homeScore: data.homeScore,
        awayScore: data.awayScore,
        possessionHome: data.possession,
        phase: data.phase,
        status: 'live',
        startTime: new Date().toISOString(),
        ...(matchPools.get(matchId) || { homePool: 0, awayPool: 0 }),
        winner: null,
        settled: false,
      })
    })
    .onPhaseChangeCallback((phase) => {
      realDataReceived = true
      if (stopSim) { stopSim(); stopSim = null }
      if (phase === 5 || phase === 10 || phase === 13) {
        const pool = matchPools.get(matchId) || { homePool: 0, awayPool: 0 }
        const winner = liveMatchState.homeScore > liveMatchState.awayScore ? 1
          : liveMatchState.awayScore > liveMatchState.homeScore ? 2
          : 0

        setMatchSettled(matchId, winner as 1 | 2 | 0)

        io.to(`match:${matchId}`).emit(EVENTS.GAME_FINALISED, {
          matchId,
          homeScore: liveMatchState.homeScore,
          awayScore: liveMatchState.awayScore,
          winner,
          homePool: pool.homePool,
          awayPool: pool.awayPool,
        })

        liveMatchState.status = 'finished'
      }
    })
    .start()
    .catch((err: unknown) => {
      console.log('TxODDS client start error:', err instanceof Error ? err.message : String(err))
    })

  txoddsClients.set(matchId, client)

  setTimeout(() => {
    if (!realDataReceived) {
      console.log('No real match data received — starting simulation')
      simulating = true
      const simGrid = new PitchGrid()
      stopSim = simulateMatch(simGrid, { speedMultiplier: 60 })
      const simInterval = setInterval(() => {
        const d = simGrid.getData()
        liveGridData = d
        liveMatchState.homeScore = d.homeScore
        liveMatchState.awayScore = d.awayScore
        liveMatchState.possessionHome = d.possession
        liveMatchState.phase = d.phase

        const pixelArr = Array.from(d.pixelData)
        io.to(`match:${matchId}`).emit(EVENTS.PITCH_UPDATE, {
          pixelData: pixelArr,
          possession: d.possession,
          ballX: d.ballX,
          ballY: d.ballY,
        })

        const physicsFrame = computePhysicsFrame({
          pixelData: pixelArr,
          possession: d.possession,
          ballX: d.ballX,
          ballY: d.ballY,
          homeScore: d.homeScore,
          awayScore: d.awayScore,
          phase: d.phase,
          seq: 0,
          clockSec: d.matchClock,
          action: d.lastAction,
          team: d.lastTeam,
          prevBallX: d.prevBallX,
          prevBallY: d.prevBallY,
          shotPower: d.shotPower,
          cornerIndicator: d.cornerIndicator,
          foulPulse: d.foulPulse,
          cardFlash: d.cardFlash,
          attackIntensity: d.attackIntensity,
          momentumVector: d.momentumVector,
          shotsHome: d.shotsHome,
          shotsAway: d.shotsAway,
          cornersHome: d.cornersHome,
          cornersAway: d.cornersAway,
          foulsHome: d.foulsHome,
          foulsAway: d.foulsAway,
          homeYellowCards: d.homeYellowCards,
          homeRedCards: d.homeRedCards,
          awayYellowCards: d.awayYellowCards,
          awayRedCards: d.awayRedCards,
          homeMomentum: d.homeMomentum,
          awayMomentum: d.awayMomentum,
          momentumShift: d.momentumShift,
          homePressure: d.homePressure,
          awayPressure: d.awayPressure,
          smoothBallVelX: d.smoothBallVelX,
          smoothBallVelY: d.smoothBallVelY,
          smoothBallSpeed: d.smoothBallSpeed,
          smoothTerritory: d.smoothTerritory,
          territoryMomentum: d.territoryMomentum,
          matchIntensity: d.matchIntensity,
        })
        io.to(`match:${matchId}`).emit(EVENTS.PHYSICS_FRAME, physicsFrame)

        io.to(`match:${matchId}`).emit(EVENTS.MATCH_STATE, {
          matchId,
          homeTeam: 'Home Team',
          awayTeam: 'Away Team',
          homeScore: d.homeScore,
          awayScore: d.awayScore,
          possessionHome: d.possession,
          phase: d.phase,
          status: d.phase === 13 ? 'finished' : 'live',
          startTime: new Date().toISOString(),
          homePool: 0,
          awayPool: 0,
          winner: null,
          settled: false,
        })

        // Check for match end in simulation (Phase 13 = Full Time)
        if (d.phase === 13) {
          const winner = d.homeScore > d.awayScore ? 1 : d.awayScore > d.homeScore ? 2 : 0
          setMatchSettled(matchId, winner as 1 | 2 | 0)
          io.to(`match:${matchId}`).emit(EVENTS.GAME_FINALISED, {
            matchId,
            homeScore: d.homeScore,
            awayScore: d.awayScore,
            winner,
            homePool: 0,
            awayPool: 0,
          })
          clearInterval(simInterval)
        }
      }, 100)
      stopSim = () => { clearInterval(simInterval) }
    }
  }, 15000)
}

app.get('/', (_req, res) => {
  res.json({
    service: 'Pitch Resonance',
    docs: '/api/historical/fixtures',
    physics: '/api/physics/fixtures',
    auth: 'POST /api/auth/nonce',
    matches: '/api/matches',
    debug: '/api/debug',
    socketio: 'ws://localhost:4000',
  })
})

app.get('/api/matches', (_req, res) => {
  const dbMatches = getAllMatches()
  const matchIds = dbMatches.map(m => m.matchId)
  const extras = getMatchScores(matchIds)
  interface MatchRow {
    matchId: string; homeTeam: string; awayTeam: string; homeScore: number; awayScore: number;
    possessionHome: number; phase: number; status: string; startTime: string;
    matchDate: string | null; totalFrames: number | null; homePool: number; awayPool: number;
    winner: number | null; settled: boolean; isLive?: boolean;
  }
  const matches: MatchRow[] = dbMatches.map((m) => {
    const pool = matchPools.get(m.matchId) || { homePool: 0, awayPool: 0 }
    const ext = extras[m.matchId]
    const isLive = m.matchId === liveMatchId
    const homeScore = isLive ? liveMatchState.homeScore : (ext?.homeScore ?? 0)
    const awayScore = isLive ? liveMatchState.awayScore : (ext?.awayScore ?? 0)
    const settledInfo = getMatchSettled(m.matchId)
    const winner = settledInfo?.settled ? settledInfo.winner
      : (m.status === 'finished' ? (homeScore > awayScore ? 1 : awayScore > homeScore ? 2 : 0) : null)
    return {
      matchId: m.matchId,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      homeScore,
      awayScore,
      possessionHome: isLive ? liveMatchState.possessionHome : 50,
      phase: isLive ? liveMatchState.phase : 1,
      status: m.status,
      startTime: m.startTime,
      matchDate: ext?.matchDate ?? null,
      totalFrames: ext?.totalEvents ?? null,
      homePool: pool.homePool,
      awayPool: pool.awayPool,
      winner,
      settled: settledInfo?.settled ?? false,
    }
  })

  // Append simulation entry for demo
  if (!liveMatchId) {
    matches.unshift({
      matchId: 'simulation',
      homeTeam: 'Home Team',
      awayTeam: 'Away Team',
      homeScore: liveMatchState.homeScore,
      awayScore: liveMatchState.awayScore,
      possessionHome: liveMatchState.possessionHome,
      phase: liveMatchState.phase,
      status: 'live' as const,
      startTime: new Date(serverStart).toISOString(),
      matchDate: null,
      totalFrames: null,
      homePool: 0,
      awayPool: 0,
      winner: null,
      settled: false,
      isLive: true,
    })
  }

  res.json({ matches })
})

// GET /api/board/stats — leaderboard + aggregate stats
app.get('/api/board/stats', (_req, res) => {
  res.json(getBoardStats())
})

app.use('/api/historical', historicalRouter)
app.use('/api/physics', physicsRouter)
app.use('/api/auth', authRouter)

app.get('/api/debug', (_req, res) => {
  res.json({
    txoddsClients: Array.from(txoddsClients.keys()),
    liveMatchId,
    liveState: {
      homeScore: liveMatchState.homeScore,
      awayScore: liveMatchState.awayScore,
      possessionHome: liveMatchState.possessionHome,
      phase: liveMatchState.phase,
      status: liveMatchState.status,
    },
    hasLiveGrid: !!liveGridData,
    pixelSum: liveGridData ? Array.from(liveGridData.pixelData).reduce((a: number, b: number) => a + b, 0) : 0,
    hasCreds: !!(TXODDS_JWT && TXODDS_API_TOKEN),
  })
})

io.on('connection', (socket) => {
  socket.on(EVENTS.JOIN_MATCH, ({ matchId }: { matchId: string }) => {
    const room = `match:${matchId}`
    socket.join(room)

    if (!activeClients.has(room)) activeClients.set(room, new Set())
    activeClients.get(room)!.add(socket.id)

    if (matchId === 'live' || matchId === liveMatchId) {
      if (liveGridData) {
        const pixelArr = Array.from(liveGridData.pixelData)
        socket.emit(EVENTS.PITCH_UPDATE, {
          pixelData: pixelArr,
          possession: liveGridData.possession,
          ballX: liveGridData.ballX,
          ballY: liveGridData.ballY,
        })

        socket.emit(EVENTS.PHYSICS_FRAME, computePhysicsFrame({
          pixelData: pixelArr,
          possession: liveGridData.possession,
          ballX: liveGridData.ballX,
          ballY: liveGridData.ballY,
          homeScore: liveGridData.homeScore,
          awayScore: liveGridData.awayScore,
          phase: liveGridData.phase,
          seq: 0,
          clockSec: Math.round((Date.now() - serverStart) / 1000),
          action: liveGridData.lastAction,
          team: liveGridData.lastTeam,
          prevBallX: liveGridData.prevBallX,
          prevBallY: liveGridData.prevBallY,
          shotPower: liveGridData.shotPower,
          cornerIndicator: liveGridData.cornerIndicator,
          foulPulse: liveGridData.foulPulse,
          cardFlash: liveGridData.cardFlash,
          attackIntensity: liveGridData.attackIntensity,
          momentumVector: liveGridData.momentumVector,
          shotsHome: liveGridData.shotsHome,
          shotsAway: liveGridData.shotsAway,
          cornersHome: liveGridData.cornersHome,
          cornersAway: liveGridData.cornersAway,
          foulsHome: liveGridData.foulsHome,
          foulsAway: liveGridData.foulsAway,
          homeYellowCards: liveGridData.homeYellowCards,
          homeRedCards: liveGridData.homeRedCards,
          awayYellowCards: liveGridData.awayYellowCards,
          awayRedCards: liveGridData.awayRedCards,
          homeMomentum: liveGridData.homeMomentum,
          awayMomentum: liveGridData.awayMomentum,
          momentumShift: liveGridData.momentumShift,
          homePressure: liveGridData.homePressure,
          awayPressure: liveGridData.awayPressure,
          smoothBallVelX: liveGridData.smoothBallVelX,
          smoothBallVelY: liveGridData.smoothBallVelY,
          smoothBallSpeed: liveGridData.smoothBallSpeed,
          smoothTerritory: liveGridData.smoothTerritory,
          territoryMomentum: liveGridData.territoryMomentum,
          matchIntensity: liveGridData.matchIntensity,
        }))
      }
      const pool = matchPools.get(matchId) || { homePool: 0, awayPool: 0 }
      socket.emit(EVENTS.STATE_SYNC, {
        matchId,
        homeTeam: liveMatchState.homeTeam,
        awayTeam: liveMatchState.awayTeam,
        homeScore: liveMatchState.homeScore,
        awayScore: liveMatchState.awayScore,
        possessionHome: liveMatchState.possessionHome,
        phase: liveMatchState.phase,
        status: liveMatchState.status,
        startTime: new Date().toISOString(),
        homePool: pool.homePool,
        awayPool: pool.awayPool,
        winner: null,
        settled: false,
      })
    }

    if (replayEngines.has(matchId)) {
      const engine = replayEngines.get(matchId)!
      engine.onDataCallback((data) => {
        socket.emit(EVENTS.PITCH_UPDATE, {
          pixelData: Array.from(data.pixelData),
          possession: data.possession,
          ballX: data.ballX,
          ballY: data.ballY,
        })
      })
    }
  })

  socket.on(EVENTS.LEAVE_MATCH, ({ matchId }: { matchId: string }) => {
    socket.leave(`match:${matchId}`)
  })

  socket.on(EVENTS.REPLAY_PAUSE, ({ matchId: mid }: { matchId: string }) => {
    replayEngines.get(mid)?.pause()
  })

  socket.on(EVENTS.REPLAY_RESUME, ({ matchId: mid }: { matchId: string }) => {
    const engine = replayEngines.get(mid)
    if (engine) {
      engine.load().play()
    }
  })

  socket.on(EVENTS.REPLAY_SEEK, ({ matchId: mid, to }: { matchId: string; to: number }) => {
    replayEngines.get(mid)?.seek(to)
  })

  socket.on(EVENTS.REPLAY_SPEED, ({ matchId: mid, speed }: { matchId: string; speed: number }) => {
    replayEngines.get(mid)?.setSpeed(speed)
  })

  // Client-triggered shockwave: broadcast to all clients in that match room
  socket.on('trigger:shockwave', (data: { originX?: number; originY?: number; intensity?: number; matchId?: string }) => {
    const matchId = data.matchId || liveMatchId || 'simulation'
    io.to(`match:${matchId}`).emit(EVENTS.SHOCKWAVE, {
      originX: data.originX ?? 128,
      originY: data.originY ?? 128,
      intensity: data.intensity ?? 1.5,
      tipId: `client-${socket.id}`,
      team: 0,
    })
  })

  socket.on('disconnect', () => {
    for (const [room, clients] of activeClients) {
      clients.delete(socket.id)
      if (clients.size === 0) {
        activeClients.delete(room)
      }
    }
  })
})

process.on('uncaughtException', (err) => {
  console.error('Uncaught:', err.message)
})

async function start() {
  // Initialize pool wallet
  const poolKp = getPoolKeypair()
  console.log(`Pool wallet: ${poolKp.publicKey.toBase58()}`)
  await ensurePoolBalance()

  server.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`)
    console.log(`Frontend origin: ${FRONTEND_URL}`)
  })

  // Connect to TxODDS after server is up (non-blocking)
  setTimeout(() => { startTxoddsStream() }, 500)
}

start()