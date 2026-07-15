import { PitchGrid } from '../txodds/parser'

const GRID_SIZE = 256
const HALF = GRID_SIZE / 2
const GOAL_Y_MIN = 95
const GOAL_Y_MAX = 160

interface ParsedEvent {
  action: string
  seq: number
  team: 1 | 2 | 0
  clockSec: number
  data: Record<string, unknown>
  score: Record<string, unknown> | null
  confirmed: boolean
}

export interface HistoricalFrame {
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
}

export interface HistoricalMatchResult {
  fixtureId: number
  totalFrames: number
  homeScore: number
  awayScore: number
  homeTeamName: string
  awayTeamName: string
  frames: HistoricalFrame[]
}

type ZoneType = 'own' | 'midfield' | 'final_third' | 'box' | 'goal_area' | 'goal' | 'sideline' | 'corner'

function zoneForEvent(action: string, team: number, confirmed: boolean, data: Record<string, unknown>): { zone: ZoneType; nearTeam: 1 | 2 } {
  if (team === 0) return { zone: 'midfield', nearTeam: 1 }
  if (action === 'goal' && confirmed) return { zone: 'goal', nearTeam: team === 1 ? 2 : 1 }
  if (action === 'shot') return { zone: 'goal_area', nearTeam: team === 1 ? 2 : 1 }
  if (action === 'high_danger_possession') return { zone: 'box', nearTeam: team === 1 ? 2 : 1 }
  if (action === 'danger_possession') return { zone: 'final_third', nearTeam: team === 1 ? 2 : 1 }
  if (action === 'attack_possession') return { zone: 'final_third', nearTeam: team === 1 ? 2 : 1 }
  if (action === 'corner') return { zone: 'corner', nearTeam: team === 1 ? 2 : 1 }
  if (action === 'free_kick') {
    const fkType = String(data?.FreeKickType || '')
    if (fkType === 'HighDanger') return { zone: 'box', nearTeam: team === 1 ? 2 : 1 }
    if (fkType === 'Danger') return { zone: 'final_third', nearTeam: team === 1 ? 2 : 1 }
    if (fkType === 'Attack') return { zone: 'midfield', nearTeam: team === 1 ? 2 : 1 }
    if (fkType === 'Offside') return { zone: 'midfield', nearTeam: team === 1 ? 2 : 1 }
    return { zone: 'own', nearTeam: team as 1 | 2 }
  }
  if (action === 'throw_in') return { zone: 'sideline', nearTeam: team as 1 | 2 }
  if (action === 'goal_kick') return { zone: 'own', nearTeam: team as 1 | 2 }
  if (action === 'yellow_card' || action === 'red_card') return { zone: 'own', nearTeam: team as 1 | 2 }
  if (action === 'substitution') return { zone: 'sideline', nearTeam: team as 1 | 2 }
  if (action === 'safe_possession') return { zone: 'own', nearTeam: team as 1 | 2 }
  return { zone: 'midfield', nearTeam: team as 1 | 2 }
}

function randomInZone(zone: ZoneType, nearTeam: 1 | 2): [number, number] {
  const r = () => Math.random()
  const ri = (min: number, max: number) => Math.floor(min + r() * (max - min))
  if (nearTeam === 1) {
    switch (zone) {
      case 'own': return [ri(0, 80), ri(30, 225)]
      case 'midfield': return [ri(70, 170), ri(20, 235)]
      case 'final_third': return [ri(150, 220), ri(40, 215)]
      case 'box': return [ri(190, 240), ri(70, 185)]
      case 'goal_area': return [ri(220, 250), ri(GOAL_Y_MIN, GOAL_Y_MAX)]
      case 'goal': return [ri(250, 255), ri(GOAL_Y_MIN + 10, GOAL_Y_MAX - 10)]
      case 'sideline': return [ri(0, 255), r() > 0.5 ? ri(0, 15) : ri(240, 255)]
      case 'corner': return [ri(200, 255), r() > 0.5 ? ri(0, 20) : ri(235, 255)]
    }
  } else {
    switch (zone) {
      case 'own': return [ri(176, 255), ri(30, 225)]
      case 'midfield': return [ri(86, 186), ri(20, 235)]
      case 'final_third': return [ri(36, 106), ri(40, 215)]
      case 'box': return [ri(16, 66), ri(70, 185)]
      case 'goal_area': return [ri(6, 36), ri(GOAL_Y_MIN, GOAL_Y_MAX)]
      case 'goal': return [ri(0, 5), ri(GOAL_Y_MIN + 10, GOAL_Y_MAX - 10)]
      case 'sideline': return [ri(0, 255), r() > 0.5 ? ri(0, 15) : ri(240, 255)]
      case 'corner': return [ri(0, 55), r() > 0.5 ? ri(0, 20) : ri(235, 255)]
    }
  }
}

function getTeamName(raw: string): { home: string; away: string } {
  const patterns = [/"(?:HomeTeam|homeTeam|TeamName1|home_team)"\s*:\s*"([^"]+)"/, /"(?:AwayTeam|awayTeam|TeamName2|away_team)"\s*:\s*"([^"]+)"/]
  const homeM = raw.match(patterns[0])
  const awayM = raw.match(patterns[1])
  return { home: homeM ? homeM[1] : 'Home', away: awayM ? awayM[1] : 'Away' }
}

function parseRawEvents(raw: string): ParsedEvent[] {
  const lines = raw.split('\n')
  const result: ParsedEvent[] = []
  let currentData = ''
  const skipActions = new Set(['coverage_update', 'comment', 'connected', 'disconnected',
    'venue', 'pitch', 'weather', 'jersey', 'lineups', 'players_warming_up',
    'players_on_the_pitch', 'standby', 'score_adjustment', 'action_discarded',
    'action_amend', 'unreliable_corners', 'clock_adjustment', 'kickoff_team'])
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      currentData = line.slice(6)
    } else if (line.startsWith('id: ') && currentData) {
      const seq = parseInt(line.slice(4))
      try {
        const obj = JSON.parse(currentData) as Record<string, any>
        const action = (obj.Action || '').toLowerCase()
        if (!action || skipActions.has(action)) { currentData = ''; continue }
        result.push({
          action,
          seq,
          team: (obj.Participant as 1 | 2 | undefined) || 0,
          clockSec: obj.Clock?.Seconds || 0,
          data: (obj.Data || {}) as Record<string, unknown>,
          score: (obj.Score as Record<string, unknown>) || null,
          confirmed: !!obj.Confirmed,
        })
      } catch { /* skip */ }
      currentData = ''
    }
  }
  return result
}

// Pre-scan raw SSE to find the final score from game_finalised event
function extractFinalScore(raw: string): { home: number; away: number } {
  const lines = raw.split('\n')
  let currentData = ''
  for (const line of lines) {
    if (line.startsWith('data: ')) currentData = line.slice(6)
    else if (line.startsWith('id: ') && currentData) {
      try {
        const obj = JSON.parse(currentData) as Record<string, any>
        if ((obj.Action || '').toLowerCase() === 'game_finalised' && obj.Score) {
          const s = obj.Score
          return {
            home: s.Participant1?.Total?.Goals ?? s.homeScore ?? 0,
            away: s.Participant2?.Total?.Goals ?? s.awayScore ?? 0,
          }
        }
      } catch { /* skip */ }
      currentData = ''
    }
  }
  return { home: 0, away: 0 }
}

// Build an ordered list of VALID goals (not VAR-overturned)
// Each TxODDS goal fires a triple: (unconfirmed, confirmed+GoalType, confirmed+GoalType+PlayerId)
// Valid goals are those NOT followed by VAR(Goal) → var_end(Overturned)
function buildGoalTimeline(events: ParsedEvent[]): { clockSec: number; team: 1 | 2 }[] {
  // First pass: find which goal seqs get overturned by VAR
  const overturnedSeqs = new Set<number>()
  for (let i = 0; i < events.length; i++) {
    const e = events[i]
    if (e.action === 'var' && e.confirmed && e.data?.Type === 'Goal') {
      for (let j = i + 1; j < Math.min(i + 10, events.length); j++) {
        if (events[j].action === 'var_end' && events[j].data?.Outcome === 'Overturned') {
          for (let k = i - 1; k >= Math.max(0, i - 10); k--) {
            if (events[k].action === 'goal' && events[k].confirmed && events[k].data?.GoalType) {
              overturnedSeqs.add(events[k].seq)
              break
            }
          }
          break
        }
        if (events[j].action !== 'var' && events[j].action !== 'var_end' && j - i > 3) break
      }
    }
  }
  // Second pass: collect goals that aren't overturned
  const goals: { clockSec: number; team: 1 | 2 }[] = []
  for (const e of events) {
    if (e.action === 'goal' && e.confirmed && e.data?.GoalType && !e.data?.PlayerId && !overturnedSeqs.has(e.seq)) {
      goals.push({ clockSec: e.clockSec, team: e.team || 1 })
    }
  }
  return goals
}

export function convertHistoricalData(raw: string, fixtureId: number, overrideNames?: { home: string; away: string }): HistoricalMatchResult {
  const finalScore = extractFinalScore(raw)
  const parsed = parseRawEvents(raw)
  if (parsed.length === 0) throw new Error(`No parseable events for fixture ${fixtureId}`)

  const names = overrideNames || getTeamName(raw)
  const grid = new PitchGrid()
  const frames: HistoricalFrame[] = []
  const validGoals = buildGoalTimeline(parsed)
  let halfTimeShown = false

  grid.setScore(0, 0)

  let homeScore = 0
  let awayScore = 0
  let nextGoalIdx = 0
  let frameCount = 0

  for (const event of parsed) {
    const { zone, nearTeam } = zoneForEvent(event.action, event.team, event.confirmed, event.data)
    const [x, y] = randomInZone(zone, nearTeam)

    let phase
    if (event.action === 'halftime_finalised') { phase = 5; halfTimeShown = true }
    else if (event.action === 'game_finalised') phase = 13
    else if (!halfTimeShown) phase = 1
    else phase = 9
    grid.setPhase(phase)

    // PitchGrid handles heat only — convert all goal events to shot to prevent double-counting
    let pitchType = event.action.charAt(0).toUpperCase() + event.action.slice(1)
    if (event.action === 'goal') pitchType = 'Shot'

    grid.applyEvent({
      Type: pitchType,
      X: Math.round((x / GRID_SIZE) * 100),
      Y: Math.round((y / GRID_SIZE) * 100),
      Participant: event.team || 1,
    })
    grid.decay(Date.now() + event.clockSec * 1000)

    // Check for valid goal at this event's clock
    if (nextGoalIdx < validGoals.length && event.action === 'goal' && event.confirmed && event.data?.GoalType && event.clockSec >= validGoals[nextGoalIdx].clockSec) {
      const g = validGoals[nextGoalIdx]
      if (g.team === 1) { homeScore++ } else { awayScore++ }
      nextGoalIdx++
      grid.setScore(homeScore, awayScore)
    }

    const data = grid.getData()
    const homePoss = Math.round((parsed.filter(e => e.team === 1 && ['safe_possession', 'attack_possession', 'danger_possession', 'high_danger_possession'].includes(e.action)).length /
      Math.max(1, parsed.filter(e => e.team !== 0 && ['safe_possession', 'attack_possession', 'danger_possession', 'high_danger_possession'].includes(e.action)).length)) * 100) || 50

    const frameAction = (event.action === 'goal' && event.confirmed && event.data?.GoalType) ? 'goal' :
      event.action === 'game_finalised' ? null : event.action

    frames.push({
      seq: event.seq,
      clockSec: event.clockSec,
      pixelData: Array.from(data.pixelData),
      possession: event.team === 1 || event.team === 0 ? Math.max(0, Math.min(100, homePoss)) : Math.max(0, Math.min(100, 100 - homePoss)),
      ballX: x,
      ballY: y,
      homeScore,
      awayScore,
      phase: data.phase,
      action: frameAction,
      team: event.team || null,
    })

    frameCount++
  }

  return {
    fixtureId,
    totalFrames: frameCount,
    homeScore: finalScore.home,
    awayScore: finalScore.away,
    homeTeamName: names.home,
    awayTeamName: names.away,
    frames,
  }
}
