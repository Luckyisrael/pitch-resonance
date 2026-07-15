export interface TxoddsEvent {
  FixtureId?: number
  fixtureId?: number
  ActionId?: number
  Type?: string
  type?: string
  Participant?: number
  participant?: number
  X?: number
  x?: number
  Y?: number
  y?: number
  Timestamp?: string
  timestamp?: string
  Data?: Record<string, unknown>
  data?: Record<string, unknown>
  Seq?: number
  seq?: number
}

export interface ScoresSseMessage {
  event?: string
  data: string
}

export interface PitchGridData {
  pixelData: Float32Array
  possession: number
  homeScore: number
  awayScore: number
  phase: number
  ballX: number
  ballY: number
  matchClock: number
  lastAction: string | null
  lastTeam: number | null
  prevBallX: number
  prevBallY: number
  shotPower: number
  cornerIndicator: number
  foulPulse: number
  cardFlash: number
  attackIntensity: number
  momentumVector: { x: number; y: number }
  shotsHome: number
  shotsAway: number
  cornersHome: number
  cornersAway: number
  foulsHome: number
  foulsAway: number
  homeYellowCards: number
  homeRedCards: number
  awayYellowCards: number
  awayRedCards: number
  homeMomentum: number
  awayMomentum: number
  momentumShift: number
  homePressure: number
  awayPressure: number
  smoothBallVelX: number
  smoothBallVelY: number
  smoothBallSpeed: number
  smoothTerritory: number
  territoryMomentum: number
  matchIntensity: number
}

export interface MatchRecord {
  matchId: string
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
  possessionHome: number
  phase: number
  status: 'live' | 'finished' | 'upcoming'
  startTime: string
  homePool: number
  awayPool: number
  winner: 0 | 1 | 2 | null
  settled: boolean
}
