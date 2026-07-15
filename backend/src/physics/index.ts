import { Router } from 'express'
import { getFrames, getFrameCount, getAllFixtureIds, upsertTelemetryFrames, getTelemetryFrames, getTelemetryFrameCount, deleteTelemetryFrames, upsertMatch } from '../db/client'
import { computeFrameFromPixelBlob, computePhysicsFrame } from './engine'
import type { PhysicsFrame } from './types'

const router = Router()

// If all clockSec values are 0 (historical data often lacks it), synthesize evenly
function fixZeroClock(frames: { clockSec: number }[], totalFrames: number, stride: number): void {
  if (frames.length === 0) return
  const allZero = frames.every(f => f.clockSec === 0)
  if (!allZero) return
  const matchDuration = 5400 // 90 min in seconds
  for (let i = 0; i < frames.length; i++) {
    const frameIndex = i * stride
    frames[i].clockSec = Math.round((frameIndex / totalFrames) * matchDuration)
  }
}

// GET /api/physics/frames/:matchId — lightweight physics frames from DB (or computed on-the-fly)
router.get('/frames/:matchId', (req, res) => {
  const { matchId } = req.params
  const { start, end, stride } = req.query as Record<string, string>
  const s = stride ? parseInt(stride) : 1

  // Try telemetry_frames first (fast path)
  const cached = getTelemetryFrames(matchId, {
    start: start ? parseInt(start) : undefined,
    end: end ? parseInt(end) : undefined,
    stride: s,
  })

  if (cached.length > 0) {
    const totalFrames = getFrameCount(matchId)
    const last = cached[cached.length - 1]
    fixZeroClock(cached, totalFrames, s)
    res.json({
      matchId,
      totalFrames,
      frameCount: cached.length,
      stride: s,
      homeScore: last.homeScore,
      awayScore: last.awayScore,
      frames: cached,
    })
    return
  }

  // Fallback: compute from fixture_frames (slow path)
  const dbRows = getFrames(matchId, {
    start: start ? parseInt(start) : undefined,
    end: end ? parseInt(end) : undefined,
    stride: s,
  })

  if (dbRows.length === 0) {
    res.status(404).json({ error: `No data for match ${matchId}. Use POST /api/physics/seed to upload frames.` })
    return
  }

  const frames: PhysicsFrame[] = dbRows.map(r => computeFrameFromPixelBlob(
    Buffer.from(new Float32Array(r.pixelData).buffer),
    {
      possession: r.possession,
      ballX: r.ballX,
      ballY: r.ballY,
      homeScore: r.homeScore,
      awayScore: r.awayScore,
      phase: r.phase,
      seq: r.seq,
      clockSec: r.clockSec,
      action: r.action,
      team: r.team,
    }
  ))

  const totalFrames = getFrameCount(matchId)
  const last = frames[frames.length - 1]
  fixZeroClock(frames, totalFrames, s)

  res.json({
    matchId,
    totalFrames,
    frameCount: frames.length,
    stride: s,
    homeScore: last.homeScore,
    awayScore: last.awayScore,
    frames,
  })
})

// POST /api/physics/frames/:matchId — seed telemetry frames for a match
router.post('/frames/:matchId', (req, res) => {
  const { matchId } = req.params
  const frames = req.body

  if (!Array.isArray(frames) || frames.length === 0) {
    res.status(400).json({ error: 'Body must be a non-empty array of telemetry frames' })
    return
  }

  // Validate first frame
  const f = frames[0]
  if (f.seq === undefined || f.ballX === undefined || f.territoryFactor === undefined) {
    res.status(400).json({ error: 'Each frame needs seq, ballX, ballY, territoryFactor, turfAmplitude, phase, clockSec, quadrants, homeScore, awayScore' })
    return
  }

  deleteTelemetryFrames(matchId)
  upsertTelemetryFrames(matchId, frames as any)

  // Also ensure match exists in matches table
  upsertMatch(matchId, {
    homeTeam: f.homeTeam || `Team ${matchId}`,
    awayTeam: f.awayTeam || `Opponent ${matchId}`,
    status: 'finished',
    startTime: new Date().toISOString(),
    homeScore: f.homeScore ?? 0,
    awayScore: f.awayScore ?? 0,
  })

  res.json({ success: true, matchId, count: frames.length })
})

// POST /api/physics/seed — bulk seed (matchId + frames in body)
router.post('/seed', (req, res) => {
  const { matchId, frames } = req.body as { matchId?: string; frames?: unknown[] }

  if (!matchId || !Array.isArray(frames)) {
    res.status(400).json({ error: 'Body needs { matchId: string, frames: array }' })
    return
  }

  deleteTelemetryFrames(matchId)
  upsertTelemetryFrames(matchId, frames as any)

  if (frames.length > 0) {
    const f = frames[0] as any
    upsertMatch(matchId, {
      homeTeam: f.homeTeam || `Team ${matchId}`,
      awayTeam: f.awayTeam || `Opponent ${matchId}`,
      status: 'finished',
      startTime: new Date().toISOString(),
      homeScore: f.homeScore ?? 0,
      awayScore: f.awayScore ?? 0,
    })
  }

  res.json({ success: true, matchId, count: frames.length })
})

// GET /api/physics/fixtures — list available fixtures
router.get('/fixtures', (_req, res) => {
  const list = getAllFixtureIds()
  res.json({
    fixtures: list.map(f => ({
      fixtureId: f.fixtureId,
      homeTeam: f.homeTeam,
      awayTeam: f.awayTeam,
      totalFrames: f.totalEvents,
      loadedAt: f.loadedAt,
    })),
    count: list.length,
  })
})

export default router
