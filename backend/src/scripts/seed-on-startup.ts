import dotenv from 'dotenv'
dotenv.config()

import { convertHistoricalData } from '../historical/converter'
import { computeFrameFromPixelBlob } from '../physics/engine'
import {
  upsertFixtureRaw,
  getFixtureRaw,
  insertFrames,
  getFrameCount,
  getFrames,
  upsertMatch,
  upsertTelemetryFrames,
  getTelemetryFrameCount,
  getAllFixtureIds,
} from '../db/client'

const API_BASE = process.env.TXODDS_API_BASE || 'https://txline-dev.txodds.com/api'
const JWT = process.env.TXODDS_JWT || ''
const API_TOKEN = process.env.TXODDS_API_TOKEN || ''

const FIXTURES: { fid: string; home: string; away: string }[] = [
  { fid: '18175983', home: 'Germany', away: 'Paraguay' },
  { fid: '18179759', home: 'Mexico', away: 'Ecuador' },
  { fid: '18209181', home: 'France', away: 'Morocco' },
  { fid: '18175981', home: 'France', away: 'Sweden' },
  { fid: '18179764', home: 'England', away: 'Congo DR' },
  { fid: '18179550', home: 'Belgium', away: 'Senegal' },
  { fid: '18179551', home: 'Spain', away: 'Austria' },
  { fid: '18179763', home: 'Portugal', away: 'Croatia' },
  { fid: '18179552', home: 'Switzerland', away: 'Algeria' },
  { fid: '18176123', home: 'Australia', away: 'Egypt' },
  { fid: '18175918', home: 'Argentina', away: 'Cape Verde' },
  { fid: '18179549', home: 'Colombia', away: 'Ghana' },
  { fid: '18172260', home: 'Netherlands', away: 'Morocco' },
  { fid: '18175397', home: 'Ivory Coast', away: 'Norway' },
  { fid: '18172379', home: 'USA', away: 'Bosnia & Herzegovina' },
  { fid: '18172489', home: 'Brazil', away: 'Japan' },
  { fid: '18185036', home: 'Canada', away: 'Morocco' },
  { fid: '18188721', home: 'Paraguay', away: 'France' },
  { fid: '18187298', home: 'Brazil', away: 'Norway' },
  { fid: '18192996', home: 'Mexico', away: 'England' },
  { fid: '18198205', home: 'Portugal', away: 'Spain' },
  { fid: '18193785', home: 'USA', away: 'Belgium' },
]

async function fetchFixture(fixture: { fid: string; home: string; away: string }): Promise<boolean> {
  const existing = getFixtureRaw(fixture.fid)
  if (existing) {
    return true
  }

  const url = `${API_BASE}/scores/historical/${fixture.fid}`
  console.log(`  Loading ${fixture.home} vs ${fixture.away}...`)

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${JWT}`,
      'X-Api-Token': API_TOKEN,
    },
  })

  if (!response.ok) {
    console.log(`  [${response.status}] ${fixture.fid}`)
    return false
  }

  const rawText = await response.text()
  if (!rawText.trim() || rawText.trim() === '[]') {
    console.log(`  [EMPTY] ${fixture.fid}`)
    return false
  }

  const fid = parseInt(fixture.fid)
  if (isNaN(fid)) return false

  const result = convertHistoricalData(rawText, fid, { home: fixture.home, away: fixture.away })

  upsertFixtureRaw(fixture.fid, {
    rawData: rawText,
    homeTeam: result.homeTeamName,
    awayTeam: result.awayTeamName,
    homeScore: result.homeScore,
    awayScore: result.awayScore,
    totalEvents: result.totalFrames,
  })
  upsertMatch(fixture.fid, {
    homeTeam: result.homeTeamName,
    awayTeam: result.awayTeamName,
    status: 'finished',
    startTime: new Date().toISOString(),
  })
  insertFrames(fixture.fid, result.frames)

  // Pre-compute physics frames from pixelData
  try {
    const stride = 10
    const rows = getFrames(fixture.fid, { stride })
    if (rows.length > 0) {
      const telemetry = rows.map(r => {
        const p = computeFrameFromPixelBlob(Buffer.from(new Float32Array(r.pixelData).buffer), {
          possession: r.possession, ballX: r.ballX, ballY: r.ballY,
          homeScore: r.homeScore, awayScore: r.awayScore, phase: r.phase,
          seq: r.seq, clockSec: r.clockSec, action: r.action, team: r.team,
        })
        return {
          seq: p.seq, clockSec: p.clockSec, phase: p.phase,
          homeScore: p.homeScore, awayScore: p.awayScore,
          ballX: p.ballX, ballY: p.ballY,
          territoryFactor: p.territoryFactor, quadrants: p.quadrants,
          turfAmplitude: p.turfAmplitude, waveAngle: p.waveAngle,
          waveFrequency: p.waveFrequency, rippleAge: p.rippleAge,
          possession: p.possession, action: p.action, team: p.team,
        }
      })
      upsertTelemetryFrames(fixture.fid, telemetry)
      console.log(`  [PHYSICS] ${telemetry.length} frames pre-computed`)
    }
  } catch (err) {
    console.log(`  [PHYSICS SKIP] ${err}`)
  }

  console.log(`  [OK] ${result.homeTeamName} ${result.homeScore}-${result.awayScore} ${result.awayTeamName} (${result.totalFrames} frames)`)
  return true
}

async function main() {
  const existing = getAllFixtureIds()
  if (existing.length > 0) {
    console.log(`DB already has ${existing.length} fixtures — skipping seed.`)
    process.exit(0)
  }

  if (!JWT || !API_TOKEN) {
    console.log('No TxODDS credentials — skipping seed. Simulation mode only.')
    process.exit(0)
  }

  console.log(`Seeding ${FIXTURES.length} fixtures from TxODDS historical API...`)
  let ok = 0
  let fail = 0

  for (const fixture of FIXTURES) {
    const success = await fetchFixture(fixture)
    if (success) ok++
    else fail++
    await new Promise(r => setTimeout(r, 600))
  }

  console.log(`Seed complete. ${ok} loaded, ${fail} failed.`)
}

main().catch(err => {
  console.error('Seed error:', err)
  process.exit(1)
})
