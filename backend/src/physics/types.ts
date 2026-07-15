export interface PhysicsFrame {
  turfAmplitude: number
  rippleCenter: { x: number; y: number }
  rippleAge: number
  territoryFactor: number
  possession: number
  ballX: number
  ballY: number
  homeScore: number
  awayScore: number
  phase: number
  quadrants: [number, number, number, number]
  waveAngle: number
  waveFrequency: number
  seq: number
  clockSec: number
  action: string | null
  team: number | null
  shotPower: number
  cornerIndicator: number
  foulPulse: number
  cardFlash: number
  attackIntensity: number
  momentumVector: { x: number; y: number }
  ballVelX: number
  ballVelY: number
  ballSpeed: number
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
  matchFlowMultiplier: number
}

export interface PhysicsFrameStored {
  fixtureId: string
  seq: number
  clockSec: number
  physics: PhysicsFrame
}
