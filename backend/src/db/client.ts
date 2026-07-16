import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/pitch.db')

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    const dir = path.dirname(DB_PATH)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('synchronous = NORMAL')
    initializeSchema()
  }
  return db
}

function initializeSchema() {
  const d = db!

  const migrations = [
    `ALTER TABLE matches ADD COLUMN home_score INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE matches ADD COLUMN away_score INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE matches ADD COLUMN winner INTEGER`,
    `ALTER TABLE matches ADD COLUMN settled INTEGER NOT NULL DEFAULT 0`,
  ]
  for (const m of migrations) {
    try { d.exec(m) } catch { /* column already exists */ }
  }

  d.exec(`
    CREATE TABLE IF NOT EXISTS matches (
      match_id TEXT PRIMARY KEY,
      home_team TEXT NOT NULL DEFAULT '',
      away_team TEXT NOT NULL DEFAULT '',
      start_time TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'upcoming',
      home_score INTEGER NOT NULL DEFAULT 0,
      away_score INTEGER NOT NULL DEFAULT 0,
      winner INTEGER,
      settled INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      seq INTEGER,
      FOREIGN KEY (match_id) REFERENCES matches(match_id)
    );
    CREATE INDEX IF NOT EXISTS idx_events_match ON events(match_id, timestamp);
    CREATE TABLE IF NOT EXISTS fixture_raw (
      fixture_id TEXT PRIMARY KEY,
      raw_data TEXT NOT NULL,
      home_team TEXT NOT NULL DEFAULT '',
      away_team TEXT NOT NULL DEFAULT '',
      home_score INTEGER NOT NULL DEFAULT 0,
      away_score INTEGER NOT NULL DEFAULT 0,
      total_events INTEGER NOT NULL DEFAULT 0,
      match_date TEXT,
      loaded_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS fixture_frames (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fixture_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      clock_sec INTEGER NOT NULL,
      pixel_data BLOB,
      possession INTEGER NOT NULL DEFAULT 50,
      ball_x INTEGER NOT NULL DEFAULT 128,
      ball_y INTEGER NOT NULL DEFAULT 128,
      home_score INTEGER NOT NULL DEFAULT 0,
      away_score INTEGER NOT NULL DEFAULT 0,
      phase INTEGER NOT NULL DEFAULT 1,
      action TEXT,
      team INTEGER,
      FOREIGN KEY (fixture_id) REFERENCES fixture_raw(fixture_id)
    );
    CREATE INDEX IF NOT EXISTS idx_frames_fixture ON fixture_frames(fixture_id, seq);
    CREATE INDEX IF NOT EXISTS idx_frames_clock ON fixture_frames(fixture_id, clock_sec);
    CREATE TABLE IF NOT EXISTS telemetry_frames (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      clock_sec INTEGER NOT NULL,
      phase INTEGER NOT NULL DEFAULT 1,
      home_score INTEGER NOT NULL DEFAULT 0,
      away_score INTEGER NOT NULL DEFAULT 0,
      ball_x INTEGER NOT NULL DEFAULT 128,
      ball_y INTEGER NOT NULL DEFAULT 128,
      territory_factor REAL NOT NULL DEFAULT 0,
      quadrants TEXT NOT NULL DEFAULT '[0.25,0.25,0.25,0.25]',
      turf_amplitude REAL NOT NULL DEFAULT 0,
      wave_angle REAL NOT NULL DEFAULT 0,
      wave_frequency REAL NOT NULL DEFAULT 0,
      ripple_age REAL NOT NULL DEFAULT 1,
      possession INTEGER NOT NULL DEFAULT 50,
      action TEXT,
      team INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_telemetry_match_seq ON telemetry_frames(match_id, seq);
    CREATE TABLE IF NOT EXISTS tips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      signature TEXT NOT NULL UNIQUE,
      match_id TEXT NOT NULL,
      user_wallet TEXT NOT NULL,
      team INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      claimed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_tips_match ON tips(match_id);
    CREATE INDEX IF NOT EXISTS idx_tips_user ON tips(user_wallet);
    CREATE INDEX IF NOT EXISTS idx_tips_user_match ON tips(user_wallet, match_id);
  `)
}

export function upsertMatch(matchId: string, data: Partial<{ homeTeam: string; awayTeam: string; startTime: string; status: string; homeScore?: number; awayScore?: number }>) {
  const d = getDb()
  d.prepare(`
    INSERT INTO matches (match_id, home_team, away_team, start_time, status, home_score, away_score)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(match_id) DO UPDATE SET
      home_team = COALESCE(NULLIF(?, ''), home_team),
      away_team = COALESCE(NULLIF(?, ''), away_team),
      start_time = COALESCE(NULLIF(?, ''), start_time),
      status = COALESCE(NULLIF(?, ''), status),
      home_score = COALESCE(?, home_score),
      away_score = COALESCE(?, away_score)
  `).run(matchId, data.homeTeam || '', data.awayTeam || '', data.startTime || '', data.status || 'upcoming', data.homeScore ?? 0, data.awayScore ?? 0,
         data.homeTeam || '', data.awayTeam || '', data.startTime || '', data.status || '', data.homeScore ?? null, data.awayScore ?? null)
}

export function getMatchScores(matchIds: string[]): Record<string, { homeScore: number; awayScore: number; totalEvents: number; matchDate: string | null }> {
  if (matchIds.length === 0) return {}
  const d = getDb()
  const placeholders = matchIds.map(() => '?').join(',')

  // Try fixture_raw first, fall back to telemetry_frames for seed data
  const raw = d.prepare(`SELECT fixture_id, home_score, away_score, total_events, match_date FROM fixture_raw WHERE fixture_id IN (${placeholders})`).all(...matchIds) as { fixture_id: string; home_score: number; away_score: number; total_events: number; match_date: string | null }[]
  const result: Record<string, { homeScore: number; awayScore: number; totalEvents: number; matchDate: string | null }> = {}
  const found = new Set<string>()
  for (const row of raw) {
    result[row.fixture_id] = { homeScore: row.home_score, awayScore: row.away_score, totalEvents: row.total_events, matchDate: row.match_date }
    found.add(row.fixture_id)
  }

  // Fill missing from telemetry_frames (seed data)
  const missing = matchIds.filter(id => !found.has(id))
  if (missing.length > 0) {
    const mPlaceholders = missing.map(() => '?').join(',')
    const tf = d.prepare(`
      SELECT match_id,
             MAX(home_score) as home_score,
             MAX(away_score) as away_score,
             COUNT(*) as total_events
      FROM telemetry_frames
      WHERE match_id IN (${mPlaceholders})
      GROUP BY match_id
    `).all(...missing) as { match_id: string; home_score: number; away_score: number; total_events: number }[]
    for (const row of tf) {
      result[row.match_id] = { homeScore: row.home_score, awayScore: row.away_score, totalEvents: row.total_events, matchDate: null }
    }
  }

  return result
}

export function insertEvent(matchId: string, timestamp: number, eventType: string, payload: string, seq?: number) {
  const d = getDb()
  d.prepare(`INSERT INTO events (match_id, timestamp, event_type, payload, seq) VALUES (?, ?, ?, ?, ?)`)
    .run(matchId, timestamp, eventType, payload, seq ?? null)
}

export function getMatchEvents(matchId: string): { timestamp: number; eventType: string; payload: string }[] {
  const d = getDb()
  return d.prepare(`SELECT timestamp, event_type as eventType, payload FROM events WHERE match_id = ? ORDER BY timestamp ASC`)
    .all(matchId) as { timestamp: number; eventType: string; payload: string }[]
}

export function getAllMatches(): { matchId: string; homeTeam: string; awayTeam: string; startTime: string; status: string }[] {
  const d = getDb()
  return d.prepare(`
    SELECT m.match_id as matchId,
           COALESCE(f.home_team, m.home_team) as homeTeam,
           COALESCE(f.away_team, m.away_team) as awayTeam,
           m.start_time as startTime,
           m.status
    FROM matches m
    LEFT JOIN fixture_raw f ON f.fixture_id = m.match_id
    ORDER BY m.start_time DESC
  `).all() as { matchId: string; homeTeam: string; awayTeam: string; startTime: string; status: string }[]
}

// --- Fixture raw data storage ---

export function upsertFixtureRaw(fixtureId: string, data: {
  rawData: string
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
  totalEvents: number
  matchDate?: string
}) {
  const d = getDb()
  d.prepare(`
    INSERT INTO fixture_raw (fixture_id, raw_data, home_team, away_team, home_score, away_score, total_events, match_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(fixture_id) DO UPDATE SET
      raw_data = EXCLUDED.raw_data,
      home_team = EXCLUDED.home_team,
      away_team = EXCLUDED.away_team,
      home_score = EXCLUDED.home_score,
      away_score = EXCLUDED.away_score,
      total_events = EXCLUDED.total_events,
      match_date = COALESCE(EXCLUDED.match_date, match_date),
      loaded_at = datetime('now')
  `).run(fixtureId, data.rawData, data.homeTeam, data.awayTeam, data.homeScore, data.awayScore, data.totalEvents, data.matchDate ?? null)
}

export function getFixtureRaw(fixtureId: string): {
  fixtureId: string
  rawData: string
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
  totalEvents: number
  matchDate: string | null
} | null {
  const d = getDb()
  const row = d.prepare(`SELECT fixture_id as fixtureId, raw_data as rawData, home_team as homeTeam, away_team as awayTeam, home_score as homeScore, away_score as awayScore, total_events as totalEvents, match_date as matchDate FROM fixture_raw WHERE fixture_id = ?`).get(fixtureId) as Record<string, unknown> | undefined
  if (!row) return null
  return {
    fixtureId: row.fixtureId as string,
    rawData: row.rawData as string,
    homeTeam: row.homeTeam as string,
    awayTeam: row.awayTeam as string,
    homeScore: row.homeScore as number,
    awayScore: row.awayScore as number,
    totalEvents: row.totalEvents as number,
    matchDate: row.matchDate as string | null,
  }
}

export function getAllFixtureIds(): { fixtureId: string; homeTeam: string; awayTeam: string; totalEvents: number; loadedAt: string }[] {
  const d = getDb()
  const raw = d.prepare(`SELECT fixture_id as fixtureId, home_team as homeTeam, away_team as awayTeam, total_events as totalEvents, loaded_at as loadedAt FROM fixture_raw ORDER BY loaded_at DESC`).all() as { fixtureId: string; homeTeam: string; awayTeam: string; totalEvents: number; loadedAt: string }[]
  if (raw.length > 0) return raw

  // Fall back to matches + telemetry_frames for seed data
  const seeded = d.prepare(`
    SELECT m.match_id as fixtureId,
           m.home_team as homeTeam,
           m.away_team as awayTeam,
           COUNT(t.id) as totalEvents,
           MAX(m.start_time) as loadedAt
    FROM matches m
    LEFT JOIN telemetry_frames t ON t.match_id = m.match_id
    WHERE t.id IS NOT NULL
    GROUP BY m.match_id
    ORDER BY MAX(m.start_time) DESC
  `).all() as { fixtureId: string; homeTeam: string; awayTeam: string; totalEvents: number; loadedAt: string }[]
  return seeded
}

// --- Fixture frames storage ---

export function insertFrames(fixtureId: string, frames: {
  seq: number
  clockSec: number
  pixelData: number[]
  possession: number
  ballX: number
  ballY: number
  homeScore: number
  awayScore: number
  phase: number
  action: string | null
  team: number | null
}[]) {
  const d = getDb()
  const insert = d.prepare(`
    INSERT OR IGNORE INTO fixture_frames (fixture_id, seq, clock_sec, pixel_data, possession, ball_x, ball_y, home_score, away_score, phase, action, team)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const tx = d.transaction(() => {
    for (const f of frames) {
      insert.run(fixtureId, f.seq, f.clockSec, Buffer.from(new Float32Array(f.pixelData).buffer), f.possession, f.ballX, f.ballY, f.homeScore, f.awayScore, f.phase, f.action, f.team)
    }
  })
  tx()
}

export function getFrames(fixtureId: string, opts?: { start?: number; end?: number; stride?: number }): {
  seq: number
  clockSec: number
  pixelData: number[]
  possession: number
  ballX: number
  ballY: number
  homeScore: number
  awayScore: number
  phase: number
  action: string | null
  team: number | null
}[] {
  const d = getDb()
  let sql = `SELECT seq, clock_sec as clockSec, pixel_data as pixelData, possession, ball_x as ballX, ball_y as ballY, home_score as homeScore, away_score as awayScore, phase, action, team FROM fixture_frames WHERE fixture_id = ?`
  const params: unknown[] = [fixtureId]

  if (opts?.start) { sql += ` AND clock_sec >= ?`; params.push(opts.start) }
  if (opts?.end) { sql += ` AND clock_sec <= ?`; params.push(opts.end) }
  sql += ` ORDER BY seq ASC`

  let rows = d.prepare(sql).all(...params) as {
    seq: number
    clockSec: number
    pixelData: Buffer
    possession: number
    ballX: number
    ballY: number
    homeScore: number
    awayScore: number
    phase: number
    action: string | null
    team: number | null
  }[]

  if (opts?.stride) {
    rows = rows.filter((_, i) => i % opts.stride! === 0)
  }

  return rows.map(r => ({
    ...r,
    pixelData: Array.from(new Float32Array(r.pixelData.buffer, r.pixelData.byteOffset, r.pixelData.byteLength / 4)),
  }))
}

export function getFrameCount(fixtureId: string): number {
  const d = getDb()
  let row = d.prepare(`SELECT COUNT(*) as cnt FROM fixture_frames WHERE fixture_id = ?`).get(fixtureId) as { cnt: number }
  if (row.cnt > 0) return row.cnt
  row = d.prepare(`SELECT COUNT(*) as cnt FROM telemetry_frames WHERE match_id = ?`).get(fixtureId) as { cnt: number }
  return row.cnt
}

// --- Telemetry frames (physics params) storage ---

export function upsertTelemetryFrames(matchId: string, frames: {
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
}[]) {
  const d = getDb()
  const insert = d.prepare(`
    INSERT OR REPLACE INTO telemetry_frames (match_id, seq, clock_sec, phase, home_score, away_score, ball_x, ball_y, territory_factor, quadrants, turf_amplitude, wave_angle, wave_frequency, ripple_age, possession, action, team)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const tx = d.transaction(() => {
    for (const f of frames) {
      insert.run(matchId, f.seq, f.clockSec, f.phase, f.homeScore, f.awayScore, f.ballX, f.ballY, f.territoryFactor, JSON.stringify(f.quadrants), f.turfAmplitude, f.waveAngle, f.waveFrequency, f.rippleAge, f.possession, f.action, f.team)
    }
  })
  tx()
}

export function getTelemetryFrames(matchId: string, opts?: { start?: number; end?: number; stride?: number }): {
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
}[] {
  const d = getDb()
  let sql = `SELECT seq, clock_sec as clockSec, phase, home_score as homeScore, away_score as awayScore, ball_x as ballX, ball_y as ballY, territory_factor as territoryFactor, quadrants, turf_amplitude as turfAmplitude, wave_angle as waveAngle, wave_frequency as waveFrequency, ripple_age as rippleAge, possession, action, team FROM telemetry_frames WHERE match_id = ?`
  const params: unknown[] = [matchId]

  if (opts?.start) { sql += ` AND clock_sec >= ?`; params.push(opts.start) }
  if (opts?.end) { sql += ` AND clock_sec <= ?`; params.push(opts.end) }
  sql += ` ORDER BY seq ASC`

  let rows = d.prepare(sql).all(...params) as {
    seq: number
    clockSec: number
    phase: number
    homeScore: number
    awayScore: number
    ballX: number
    ballY: number
    territoryFactor: number
    quadrants: string
    turfAmplitude: number
    waveAngle: number
    waveFrequency: number
    rippleAge: number
    possession: number
    action: string | null
    team: number | null
  }[]

  if (opts?.stride) {
    rows = rows.filter((_, i) => i % opts.stride! === 0)
  }

  return rows.map(r => ({
    ...r,
    quadrants: JSON.parse(r.quadrants) as [number, number, number, number],
  }))
}

export function getTelemetryFrameCount(matchId: string): number {
  const d = getDb()
  const row = d.prepare(`SELECT COUNT(*) as cnt FROM telemetry_frames WHERE match_id = ?`).get(matchId) as { cnt: number }
  return row.cnt
}

export function deleteTelemetryFrames(matchId: string) {
  const d = getDb()
  d.prepare(`DELETE FROM telemetry_frames WHERE match_id = ?`).run(matchId)
}

// --- Tips (on-chain parimutuel) ---

export function insertTip(signature: string, matchId: string, userWallet: string, team: 1 | 2, amount: number) {
  const d = getDb()
  try {
    d.prepare(`INSERT INTO tips (signature, match_id, user_wallet, team, amount) VALUES (?, ?, ?, ?, ?)`)
      .run(signature, matchId, userWallet, team, amount)
    return true
  } catch {
    return false // duplicate or error
  }
}

export function getMatchTotalTips(matchId: string): { homePool: number; awayPool: number } {
  const d = getDb()
  const rows = d.prepare(`SELECT team, SUM(amount) as total FROM tips WHERE match_id = ? GROUP BY team`).all(matchId) as { team: number; total: number }[]
  let homePool = 0, awayPool = 0
  for (const r of rows) {
    if (r.team === 1) homePool = r.total
    else if (r.team === 2) awayPool = r.total
  }
  return { homePool, awayPool }
}

export function getUserMatchTips(matchId: string, userWallet: string): { totalHome: number; totalAway: number; totalUnclaimedHome: number; totalUnclaimedAway: number } {
  const d = getDb()
  const rows = d.prepare(`SELECT team, amount, claimed FROM tips WHERE match_id = ? AND user_wallet = ?`).all(matchId, userWallet) as { team: number; amount: number; claimed: number }[]
  let totalHome = 0, totalAway = 0, totalUnclaimedHome = 0, totalUnclaimedAway = 0
  for (const r of rows) {
    if (r.team === 1) { totalHome += r.amount; if (!r.claimed) totalUnclaimedHome += r.amount }
    else if (r.team === 2) { totalAway += r.amount; if (!r.claimed) totalUnclaimedAway += r.amount }
  }
  return { totalHome, totalAway, totalUnclaimedHome, totalUnclaimedAway }
}

export function markTipsClaimed(matchId: string, userWallet: string): number {
  const d = getDb()
  const result = d.prepare(`UPDATE tips SET claimed = 1 WHERE match_id = ? AND user_wallet = ? AND claimed = 0`).run(matchId, userWallet)
  return result.changes
}

export function setMatchSettled(matchId: string, winner: 1 | 2 | 0) {
  const d = getDb()
  d.prepare(`UPDATE matches SET winner = ?, settled = 1, status = 'finished' WHERE match_id = ?`).run(winner, matchId)
}

export function getMatchSettled(matchId: string): { winner: number | null; settled: boolean } | null {
  const d = getDb()
  const row = d.prepare(`SELECT winner, settled FROM matches WHERE match_id = ?`).get(matchId) as { winner: number | null; settled: number } | undefined
  if (!row) return null
  return { winner: row.winner, settled: row.settled === 1 }
}

// --- Board stats ---

export function getBoardStats() {
  const d = getDb()
  const totals = d.prepare(`
    SELECT
      COUNT(DISTINCT fixture_id) as totalMatches,
      COALESCE(SUM(COALESCE(f.home_score, 0) + COALESCE(f.away_score, 0)), 0) as totalGoals
    FROM fixture_raw f
  `).get() as { totalMatches: number; totalGoals: number }

  const settled = d.prepare(`SELECT COUNT(*) as cnt FROM matches WHERE settled = 1`).get() as { cnt: number }

  const tipTotals = d.prepare(`
    SELECT
      COUNT(*) as totalTips,
      COALESCE(SUM(amount), 0) as totalAmount,
      COUNT(DISTINCT user_wallet) as uniqueTippers
    FROM tips
  `).get() as { totalTips: number; totalAmount: number; uniqueTippers: number }

  const topTippers = d.prepare(`
    SELECT
      user_wallet,
      SUM(amount) as totalTips,
      COUNT(*) as tipCount,
      SUM(CASE WHEN claimed = 1 THEN 1 ELSE 0 END) as wins
    FROM tips
    GROUP BY user_wallet
    ORDER BY totalTips DESC
    LIMIT 20
  `).all() as { user_wallet: string; totalTips: number; tipCount: number; wins: number }[]

  const matchResults = d.prepare(`
    SELECT
      f.fixture_id as matchId,
      f.home_team as homeTeam,
      f.away_team as awayTeam,
      f.home_score as homeScore,
      f.away_score as awayScore,
      f.match_date as matchDate,
      m.winner,
      m.settled
    FROM fixture_raw f
    LEFT JOIN matches m ON m.match_id = f.fixture_id
    ORDER BY f.match_date DESC, f.fixture_id DESC
  `).all() as { matchId: string; homeTeam: string; awayTeam: string; homeScore: number; awayScore: number; matchDate: string | null; winner: number | null; settled: number }[]

  return {
    totalMatches: totals.totalMatches,
    settledMatches: settled.cnt,
    totalGoals: totals.totalGoals,
    totalTips: tipTotals.totalAmount,
    totalTipCount: tipTotals.totalTips,
    uniqueTippers: tipTotals.uniqueTippers,
    topTippers: topTippers.map(t => ({
      wallet: t.user_wallet,
      totalTips: t.totalTips,
      tipCount: t.tipCount,
      wins: t.wins,
    })),
    matchResults: matchResults.map(m => ({
      matchId: m.matchId,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      matchDate: m.matchDate,
      winner: m.winner,
      settled: m.settled === 1,
    })),
  }
}
