import dotenv from 'dotenv'
dotenv.config({ path: '../backend/.env' })

// World Cup fixture IDs from the schedule (June 21 – July 9, 2026)
// Format: [fixtureId, homeTeam, awayTeam, dateStr]
const FIXTURES: [number, string, string, string][] = [
  // Group Stage — June 21
  [17588310, 'Tunisia', 'Japan', '2026-06-21'],
  [17588232, 'Spain', 'Saudi Arabia', '2026-06-21'],
  [17588390, 'Belgium', 'Iran', '2026-06-21'],
  [17588235, 'Uruguay', 'Cape Verde', '2026-06-21'],
  // June 22
  [17588242, 'New Zealand', 'Egypt', '2026-06-22'],
  [17588389, 'Argentina', 'Austria', '2026-06-22'],
  [17926647, 'France', 'Iraq', '2026-06-22'],
  // June 23
  [17588313, 'Norway', 'Senegal', '2026-06-23'],
  [17588244, 'Jordan', 'Algeria', '2026-06-23'],
  [17588231, 'Portugal', 'Uzbekistan', '2026-06-23'],
  [17588324, 'England', 'Ghana', '2026-06-23'],
  [17588401, 'Panama', 'Croatia', '2026-06-23'],
  // June 24
  [17926615, 'Colombia', 'Congo DR', '2026-06-24'],
  [17588303, 'Switzerland', 'Canada', '2026-06-24'],
  [17926766, 'Bosnia & Herzegovina', 'Qatar', '2026-06-24'],
  [17588319, 'Morocco', 'Haiti', '2026-06-24'],
  [17588398, 'Scotland', 'Brazil', '2026-06-24'],
  // June 25
  [17588395, 'South Africa', 'South Korea', '2026-06-25'],
  [17926764, 'Czech Republic', 'Mexico', '2026-06-25'],
  [17588302, 'Ecuador', 'Germany', '2026-06-25'],
  [17588321, 'Curacao', 'Ivory Coast', '2026-06-25'],
  [17588236, 'Tunisia', 'Netherlands', '2026-06-25'],
  [17926686, 'Japan', 'Sweden', '2026-06-25'],
  // June 26
  [17588229, 'Paraguay', 'Australia', '2026-06-26'],
  [17926593, 'Turkey', 'USA', '2026-06-26'],
  [17588234, 'Norway', 'France', '2026-06-26'],
  [17926740, 'Senegal', 'Iraq', '2026-06-26'],
  // June 27
  [17588314, 'Cape Verde', 'Saudi Arabia', '2026-06-27'],
  [17588404, 'Uruguay', 'Spain', '2026-06-27'],
  [17588309, 'Egypt', 'Iran', '2026-06-27'],
  [17588323, 'New Zealand', 'Belgium', '2026-06-27'],
  [17588245, 'Croatia', 'Ghana', '2026-06-27'],
  [17588402, 'Panama', 'England', '2026-06-27'],
  [17588391, 'Colombia', 'Portugal', '2026-06-27'],
  [17926704, 'Congo DR', 'Uzbekistan', '2026-06-27'],
  // June 28
  [17588325, 'Jordan', 'Argentina', '2026-06-28'],
  [17588326, 'Algeria', 'Austria', '2026-06-28'],
  // Round of 32 — June 28
  [18167317, 'South Africa', 'Canada', '2026-06-28'],
  // June 29
  [18172489, 'Brazil', 'Japan', '2026-06-29'],
  [18175983, 'Germany', 'Paraguay', '2026-06-29'],
  // June 30
  [18172260, 'Netherlands', 'Morocco', '2026-06-30'],
  [18175397, 'Ivory Coast', 'Norway', '2026-06-30'],
  [18175981, 'France', 'Sweden', '2026-06-30'],
  // July 1
  [18179759, 'Mexico', 'Ecuador', '2026-07-01'],
  [18179764, 'England', 'Congo DR', '2026-07-01'],
  [18179550, 'Belgium', 'Senegal', '2026-07-01'],
  // July 2
  [18172379, 'USA', 'Bosnia & Herzegovina', '2026-07-02'],
  [18179551, 'Spain', 'Austria', '2026-07-02'],
  [18179763, 'Portugal', 'Croatia', '2026-07-02'],
  // July 3
  [18179552, 'Switzerland', 'Algeria', '2026-07-03'],
  [18176123, 'Australia', 'Egypt', '2026-07-03'],
  [18175918, 'Argentina', 'Cape Verde', '2026-07-03'],
  // July 4
  [18179549, 'Colombia', 'Ghana', '2026-07-04'],
  // 8th Finals — July 4
  [18185036, 'Canada', 'Morocco', '2026-07-04'],
  [18188721, 'Paraguay', 'France', '2026-07-04'],
  // July 5
  [18187298, 'Brazil', 'Norway', '2026-07-05'],
  // July 6
  [18192996, 'Mexico', 'England', '2026-07-06'],
  [18198205, 'Portugal', 'Spain', '2026-07-06'],
  // July 7
  [18193785, 'USA', 'Belgium', '2026-07-07'],
  [18202701, 'Argentina', 'Egypt', '2026-07-07'],
  [18202783, 'Switzerland', 'Colombia', '2026-07-07'],
  // Quarter-finals — July 9
  [18209181, 'France', 'Morocco', '2026-07-09'],
]

const API_BASE = process.env.TXODDS_API_BASE || 'https://txline-dev.txodds.com/api'
const JWT = process.env.TXODDS_JWT || ''
const TOKEN = process.env.TXODDS_API_TOKEN || ''

interface FixtureRaw {
  fixture_id: string
  raw_data: string
  home_team: string
  away_team: string
  home_score: number
  away_score: number
  total_events: number
  match_date: string
}

async function fetchFixture(fixtureId: number): Promise<{ success: boolean; data?: string; error?: string }> {
  const url = `${API_BASE}/scores/historical/${fixtureId}`
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${JWT}`,
        'X-Api-Token': TOKEN,
      },
    })
    if (!res.ok) return { success: false, error: `${res.status}` }
    const text = await res.text()
    if (!text.trim() || text.trim() === '[]') return { success: false, error: 'empty' }
    return { success: true, data: text }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

async function storeInDb(fixtureId: number, rawData: string, homeTeam: string, awayTeam: string, dateStr: string) {
  // Import here so we can run as a standalone script
  const { convertHistoricalData } = await import('../backend/src/historical/converter')
  const { upsertFixtureRaw, insertFrames, upsertMatch } = await import('../backend/src/db/client')

  try {
    const result = convertHistoricalData(rawData, fixtureId)
    upsertFixtureRaw(String(fixtureId), {
      rawData,
      homeTeam: result.homeTeamName,
      awayTeam: result.awayTeamName,
      homeScore: result.homeScore,
      awayScore: result.awayScore,
      totalEvents: result.totalFrames,
    })
    upsertMatch(String(fixtureId), {
      homeTeam: result.homeTeamName,
      awayTeam: result.awayTeamName,
      status: 'finished',
      startTime: new Date().toISOString(),
    })
    insertFrames(String(fixtureId), result.frames)
    return result.totalFrames
  } catch (err) {
    throw new Error(`convert/store failed: ${err instanceof Error ? err.message : String(err)}`)
  }
}

async function main() {
  if (!JWT || !TOKEN) {
    console.error('TXODDS_JWT and TXODDS_API_TOKEN must be set in ../backend/.env')
    process.exit(1)
  }

  console.log(`\nTxODDS Historical Fetcher`)
  console.log(`API: ${API_BASE}`)
  console.log(`Fixtures to try: ${FIXTURES.length}`)
  console.log(`Today: ${new Date().toISOString().slice(0, 10)}`)
  console.log(`Historical window: ${new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10)} to ${new Date(Date.now() - 6 * 3600000).toISOString().slice(0, 10)}`)
  console.log('')

  let loaded = 0
  let skipped = 0
  let errors = 0

  for (const [fid, home, away, date] of FIXTURES) {
    const dateMs = new Date(date).getTime()
    const twoWeeksAgo = Date.now() - 14 * 86400000
    const sixHoursAgo = Date.now() - 6 * 3600000

    if (dateMs < twoWeeksAgo || dateMs > sixHoursAgo) {
      console.log(`  SKIP ${fid} (${home} vs ${away}) — ${date} outside historical window`)
      skipped++
      continue
    }

    process.stdout.write(`  FETCH ${fid} (${home} vs ${away}) — ${date} ... `)
    const result = await fetchFixture(fid)
    if (!result.success || !result.data) {
      console.log(`→ ${result.error}`)
      errors++
      continue
    }

    try {
      const frames = await storeInDb(fid, result.data, home, away, date)
      console.log(`→ ${frames} frames ✓`)
      loaded++
    } catch (err) {
      console.log(`→ store error: ${err}`)
      errors++
    }

    // Rate limit: 1 request per second
    await new Promise(r => setTimeout(r, 1100))
  }

  console.log(`\nDone. Loaded: ${loaded}, Skipped: ${skipped}, Errors: ${errors}`)
}

main().catch(console.error)
