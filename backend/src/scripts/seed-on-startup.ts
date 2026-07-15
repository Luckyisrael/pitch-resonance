import dotenv from 'dotenv'
dotenv.config()

import * as fs from 'fs'
import * as path from 'path'
import {
  upsertMatch,
  upsertTelemetryFrames,
  getTelemetryFrameCount,
  getAllFixtureIds,
} from '../db/client'

const SEED_PATH = path.resolve(__dirname, '../../data/seed.json')

function main() {
  const existing = getAllFixtureIds()
  if (existing.length > 0) {
    console.log(`DB already has ${existing.length} fixtures — skipping seed.`)
    return
  }

  if (!fs.existsSync(SEED_PATH)) {
    console.log(`No seed file at ${SEED_PATH} — skipping. Simulation mode only.`)
    return
  }

  const seed: Array<{
    fixtureId: string
    homeTeam: string
    awayTeam: string
    homeScore: number
    awayScore: number
    frames: Array<{
      seq: number
      clockSec: number
      phase: number
      homeScore: number
      awayScore: number
      ballX: number
      ballY: number
      territoryFactor: number
      quadrants: [number, number, number, number]
      turfAmplitude: number
      waveAngle: number
      waveFrequency: number
      rippleAge: number
      possession: number
      action: string | null
      team: number | null
    }>
  }> = JSON.parse(fs.readFileSync(SEED_PATH, 'utf-8'))

  console.log(`Seeding ${seed.length} fixtures from seed.json...`)

  for (const fixture of seed) {
    const existingCount = getTelemetryFrameCount(fixture.fixtureId)
    if (existingCount > 0) {
      console.log(`  [SKIP] ${fixture.fixtureId} — already has ${existingCount} frames`)
      continue
    }

    upsertMatch(fixture.fixtureId, {
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      status: 'finished',
      startTime: new Date().toISOString(),
    })

    upsertTelemetryFrames(fixture.fixtureId, fixture.frames)

    console.log(`  [OK] ${fixture.fixtureId} — ${fixture.homeTeam} ${fixture.homeScore}-${fixture.awayScore} ${fixture.awayTeam} (${fixture.frames.length} frames)`)
  }

  console.log('Seed complete.')
}

main()
