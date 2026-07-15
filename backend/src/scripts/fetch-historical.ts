import dotenv from 'dotenv'
dotenv.config()

import { convertHistoricalData } from '../historical/converter'
import {
  upsertFixtureRaw,
  getFixtureRaw,
  insertFrames,
  getFrameCount,
  upsertMatch,
} from '../db/client'

const API_BASE = process.env.TXODDS_API_BASE || 'https://txline-dev.txodds.com/api'
const JWT = process.env.TXODDS_JWT || ''
const API_TOKEN = process.env.TXODDS_API_TOKEN || ''

const FIXTURES: { fid: string; home: string; away: string }[] = [
  { fid: '17588310', home: 'Tunisia', away: 'Japan' },
  { fid: '17588232', home: 'Spain', away: 'Saudi Arabia' },
  { fid: '17588390', home: 'Belgium', away: 'Iran' },
  { fid: '17588235', home: 'Uruguay', away: 'Cape Verde' },
  { fid: '17588242', home: 'New Zealand', away: 'Egypt' },
  { fid: '17588389', home: 'Argentina', away: 'Austria' },
  { fid: '17926647', home: 'France', away: 'Iraq' },
  { fid: '17588313', home: 'Norway', away: 'Senegal' },
  { fid: '17588244', home: 'Jordan', away: 'Algeria' },
  { fid: '17588231', home: 'Portugal', away: 'Uzbekistan' },
  { fid: '17588324', home: 'England', away: 'Ghana' },
  { fid: '17588401', home: 'Panama', away: 'Croatia' },
  { fid: '17926615', home: 'Colombia', away: 'Congo DR' },
  { fid: '17588303', home: 'Switzerland', away: 'Canada' },
  { fid: '17926766', home: 'Bosnia & Herzegovina', away: 'Qatar' },
  { fid: '17588319', home: 'Morocco', away: 'Haiti' },
  { fid: '17588398', home: 'Scotland', away: 'Brazil' },
  { fid: '17588395', home: 'South Africa', away: 'South Korea' },
  { fid: '17926764', home: 'Czech Republic', away: 'Mexico' },
  { fid: '17588302', home: 'Ecuador', away: 'Germany' },
  { fid: '17588321', home: 'Curacao', away: 'Ivory Coast' },
  { fid: '17588236', home: 'Tunisia', away: 'Netherlands' },
  { fid: '17926686', home: 'Japan', away: 'Sweden' },
  { fid: '17588229', home: 'Paraguay', away: 'Australia' },
  { fid: '17926593', home: 'Turkey', away: 'USA' },
  { fid: '17588234', home: 'Norway', away: 'France' },
  { fid: '17926740', home: 'Senegal', away: 'Iraq' },
  { fid: '17588314', home: 'Cape Verde', away: 'Saudi Arabia' },
  { fid: '17588404', home: 'Uruguay', away: 'Spain' },
  { fid: '17588309', home: 'Egypt', away: 'Iran' },
  { fid: '17588323', home: 'New Zealand', away: 'Belgium' },
  { fid: '17588245', home: 'Croatia', away: 'Ghana' },
  { fid: '17588402', home: 'Panama', away: 'England' },
  { fid: '17588391', home: 'Colombia', away: 'Portugal' },
  { fid: '17926704', home: 'Congo DR', away: 'Uzbekistan' },
  { fid: '17588325', home: 'Jordan', away: 'Argentina' },
  { fid: '17588326', home: 'Algeria', away: 'Austria' },
  { fid: '18167317', home: 'South Africa', away: 'Canada' },
  { fid: '18172489', home: 'Brazil', away: 'Japan' },
  { fid: '18175983', home: 'Germany', away: 'Paraguay' },
  { fid: '18172260', home: 'Netherlands', away: 'Morocco' },
  { fid: '18175397', home: 'Ivory Coast', away: 'Norway' },
  { fid: '18175981', home: 'France', away: 'Sweden' },
  { fid: '18179759', home: 'Mexico', away: 'Ecuador' },
  { fid: '18179764', home: 'England', away: 'Congo DR' },
  { fid: '18179550', home: 'Belgium', away: 'Senegal' },
  { fid: '18172379', home: 'USA', away: 'Bosnia & Herzegovina' },
  { fid: '18179551', home: 'Spain', away: 'Austria' },
  { fid: '18179763', home: 'Portugal', away: 'Croatia' },
  { fid: '18179552', home: 'Switzerland', away: 'Algeria' },
  { fid: '18176123', home: 'Australia', away: 'Egypt' },
  { fid: '18175918', home: 'Argentina', away: 'Cape Verde' },
  { fid: '18179549', home: 'Colombia', away: 'Ghana' },
  { fid: '18185036', home: 'Canada', away: 'Morocco' },
  { fid: '18188721', home: 'Paraguay', away: 'France' },
  { fid: '18187298', home: 'Brazil', away: 'Norway' },
  { fid: '18192996', home: 'Mexico', away: 'England' },
  { fid: '18198205', home: 'Portugal', away: 'Spain' },
  { fid: '18193785', home: 'USA', away: 'Belgium' },
  { fid: '18202701', home: 'Argentina', away: 'Egypt' },
  { fid: '18202783', home: 'Switzerland', away: 'Colombia' },
  { fid: '18209181', home: 'France', away: 'Morocco' },
]

async function fetchFixture(fixture: { fid: string; home: string; away: string }): Promise<boolean> {
  const existing = getFixtureRaw(fixture.fid)
  if (existing) {
    const cnt = getFrameCount(fixture.fid)
    console.log(`  [SKIP] ${fixture.fid} — already loaded (${cnt} frames)`)
    return true
  }

  const url = `${API_BASE}/scores/historical/${fixture.fid}`
  console.log(`  Fetching ${fixture.home} vs ${fixture.away} (${url}) ...`)

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${JWT}`,
      'X-Api-Token': API_TOKEN,
    },
  })

  if (!response.ok) {
    console.log(`  [${response.status}] ${fixture.fid} — ${response.statusText}`)
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

  console.log(`  [OK] ${fixture.fid} → ${result.homeTeamName} ${result.homeScore}-${result.awayScore} ${result.awayTeamName} (${result.totalFrames} frames)`)
  return true
}

async function main() {
  if (!JWT || !API_TOKEN) {
    console.error('ERROR: TXODDS_JWT and TXODDS_API_TOKEN must be set in .env')
    process.exit(1)
  }

  console.log(`Fetching ${FIXTURES.length} historical fixtures...\n`)

  let ok = 0
  let fail = 0

  for (const fixture of FIXTURES) {
    const success = await fetchFixture(fixture)
    if (success) ok++
    else fail++
    await new Promise(r => setTimeout(r, 600))
  }

  console.log(`\nDone. ${ok} loaded, ${fail} failed/skipped.`)
  process.exit(0)
}

main()
