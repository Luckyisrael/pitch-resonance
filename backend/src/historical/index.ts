import { Router } from 'express'
import { convertHistoricalData, type HistoricalFrame } from './converter'
import { upsertFixtureRaw, getFixtureRaw, getAllFixtureIds, insertFrames, getFrames, getFrameCount, upsertMatch } from '../db/client'

const router = Router()

interface FetchRequest {
  fixtureId: string
}

// Cache fixture metadata in memory (not the full frames)
const fixtureMeta = new Map<string, {
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
  totalFrames: number
}>()

router.post('/load', async (req, res) => {
  try {
    const { fixtureId } = req.body as FetchRequest
    if (!fixtureId) {
      res.status(400).json({ error: 'fixtureId required' })
      return
    }

    // Check DB first
    const existing = getFixtureRaw(fixtureId)
    if (existing) {
      const cnt = getFrameCount(fixtureId)
      fixtureMeta.set(fixtureId, {
        homeTeam: existing.homeTeam,
        awayTeam: existing.awayTeam,
        homeScore: existing.homeScore,
        awayScore: existing.awayScore,
        totalFrames: cnt,
      })
      res.json({
        fixtureId,
        totalFrames: cnt,
        homeScore: existing.homeScore,
        awayScore: existing.awayScore,
        homeTeamName: existing.homeTeam,
        awayTeamName: existing.awayTeam,
        message: `Already loaded (${cnt} frames in DB)`,
      })
      return
    }

    const apiBase = process.env.TXODDS_API_BASE || 'https://txline-dev.txodds.com/api'
    const jwt = process.env.TXODDS_JWT || ''
    const apiToken = process.env.TXODDS_API_TOKEN || ''

    if (!jwt || !apiToken) {
      res.status(401).json({ error: 'TxODDS credentials not configured' })
      return
    }

    const url = `${apiBase}/scores/historical/${fixtureId}`
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        'X-Api-Token': apiToken,
      },
    })

    if (!response.ok) {
      res.status(response.status).json({ error: `TxODDS API returned ${response.status}` })
      return
    }

    const rawText = await response.text()
    if (!rawText.trim() || rawText.trim() === '[]') {
      res.status(404).json({ error: `No historical data for fixture ${fixtureId}` })
      return
    }

    const fid = parseInt(fixtureId)
    if (isNaN(fid)) {
      res.status(400).json({ error: 'Invalid fixtureId' })
      return
    }

    const result = convertHistoricalData(rawText, fid)

    // Store raw data + frames in DB
    upsertFixtureRaw(fixtureId, {
      rawData: rawText,
      homeTeam: result.homeTeamName,
      awayTeam: result.awayTeamName,
      homeScore: result.homeScore,
      awayScore: result.awayScore,
      totalEvents: result.totalFrames,
    })
    upsertMatch(fixtureId, {
      homeTeam: result.homeTeamName,
      awayTeam: result.awayTeamName,
      status: 'finished',
      startTime: new Date().toISOString(),
    })
    insertFrames(fixtureId, result.frames)

    fixtureMeta.set(fixtureId, {
      homeTeam: result.homeTeamName,
      awayTeam: result.awayTeamName,
      homeScore: result.homeScore,
      awayScore: result.awayScore,
      totalFrames: result.totalFrames,
    })

    res.json({
      fixtureId: result.fixtureId,
      totalFrames: result.totalFrames,
      homeScore: result.homeScore,
      awayScore: result.awayScore,
      homeTeamName: result.homeTeamName,
      awayTeamName: result.awayTeamName,
      message: `Loaded and stored ${result.totalFrames} frames`,
    })
  } catch (err) {
    console.error('Historical load error:', err)
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

router.get('/frames/:fixtureId', (req, res) => {
  const { fixtureId } = req.params
  const meta = fixtureMeta.get(fixtureId)

  const { start, end, stride } = req.query as Record<string, string>
  const s = stride ? parseInt(stride) : 10

  const frames = getFrames(fixtureId, {
    start: start ? parseInt(start) : undefined,
    end: end ? parseInt(end) : undefined,
    stride: s,
  })

  if (frames.length === 0) {
    res.status(404).json({ error: `Fixture ${fixtureId} not found. POST /api/historical/load first.` })
    return
  }

  res.json({
    fixtureId,
    totalFrames: meta?.totalFrames ?? getFrameCount(fixtureId),
    frameCount: frames.length,
    skip: s,
    homeScore: frames[frames.length - 1].homeScore,
    awayScore: frames[frames.length - 1].awayScore,
    homeTeamName: meta?.homeTeam ?? '',
    awayTeamName: meta?.awayTeam ?? '',
    frames,
  })
})

router.get('/fixtures', (_req, res) => {
  const db = getAllFixtureIds()
  const loaded = db.map(f => ({
    fixtureId: f.fixtureId,
    homeTeam: f.homeTeam,
    awayTeam: f.awayTeam,
    totalEvents: f.totalEvents,
    loadedAt: f.loadedAt,
  }))
  res.json({ fixtures: loaded, count: loaded.length })
})

export default router
