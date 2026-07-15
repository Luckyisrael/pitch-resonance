import { PhysicsFrame } from './types'

const HALF = 128
const GRID_SIZE = 256

function computeMatchFlowMultiplier(clockSec: number, action: string | null): number {
  const minute = clockSec / 60
  let base = 1.0
  if (minute < 10) base = 0.8 + (minute / 10) * 0.2
  else if (minute < 75) base = 1.0
  else if (minute < 90) base = 1.0 + ((minute - 75) / 15) * 0.3
  else base = 1.3

  if (action === 'goal') return base * 1.5
  if (action === 'shot') return base * 1.2
  if (action === 'corner') return base * 1.1
  return base
}

export function computePhysicsFrame(data: {
  pixelData: number[]
  possession: number
  ballX: number
  ballY: number
  homeScore: number
  awayScore: number
  phase: number
  seq?: number
  clockSec?: number
  action?: string | null
  team?: number | null
  prevBallX?: number
  prevBallY?: number
  shotPower?: number
  cornerIndicator?: number
  foulPulse?: number
  cardFlash?: number
  attackIntensity?: number
  momentumVector?: { x: number; y: number }
  shotsHome?: number
  shotsAway?: number
  cornersHome?: number
  cornersAway?: number
  foulsHome?: number
  foulsAway?: number
  homeYellowCards?: number
  homeRedCards?: number
  awayYellowCards?: number
  awayRedCards?: number
  homeMomentum?: number
  awayMomentum?: number
  momentumShift?: number
  homePressure?: number
  awayPressure?: number
  smoothBallVelX?: number
  smoothBallVelY?: number
  smoothBallSpeed?: number
  smoothTerritory?: number
  territoryMomentum?: number
  matchIntensity?: number
}): PhysicsFrame {
  const {
    pixelData, possession, ballX, ballY, homeScore, awayScore, phase,
    seq = 0, clockSec = 0, action = null, team = null,
    prevBallX = ballX, prevBallY = ballY,
    shotPower = 0, cornerIndicator = 0, foulPulse = 0, cardFlash = 0,
    attackIntensity = 0, momentumVector = { x: 0, y: 0 },
    shotsHome = 0, shotsAway = 0, cornersHome = 0, cornersAway = 0,
    foulsHome = 0, foulsAway = 0,
    homeYellowCards = 0, homeRedCards = 0, awayYellowCards = 0, awayRedCards = 0,
    homeMomentum = 0, awayMomentum = 0, momentumShift = 0,
    homePressure = 0, awayPressure = 0,
    smoothBallVelX = 0, smoothBallVelY = 0, smoothBallSpeed = 0,
    smoothTerritory = 0, territoryMomentum = 0, matchIntensity = 0,
  } = data
  const len = pixelData.length

  const matchFlowMultiplier = computeMatchFlowMultiplier(clockSec, action)

  if (len === 0 || len !== GRID_SIZE * GRID_SIZE) {
    return {
      turfAmplitude: 0,
      rippleCenter: { x: HALF, y: HALF },
      rippleAge: 1,
      territoryFactor: 0,
      possession,
      ballX,
      ballY,
      homeScore,
      awayScore,
      phase,
      quadrants: [0, 0, 0, 0],
      waveAngle: 0,
      waveFrequency: 0,
      seq,
      clockSec,
      action,
      team,
      shotPower,
      cornerIndicator,
      foulPulse,
      cardFlash,
      attackIntensity,
      momentumVector,
      ballVelX: 0,
      ballVelY: 0,
      ballSpeed: 0,
      shotsHome, shotsAway, cornersHome, cornersAway,
      foulsHome, foulsAway,
      homeYellowCards, homeRedCards, awayYellowCards, awayRedCards,
      homeMomentum, awayMomentum, momentumShift,
      homePressure, awayPressure,
      smoothBallVelX, smoothBallVelY, smoothBallSpeed,
      smoothTerritory, territoryMomentum, matchIntensity,
      matchFlowMultiplier,
    }
  }

  let totalHeat = 0
  let maxHeat = 0
  let weightedX = 0
  let weightedY = 0
  let hotPixels = 0
  const q = [0, 0, 0, 0]
  let homeHalfHeat = 0
  let awayHalfHeat = 0
  let attackThirdHeat = 0
  let defenseThirdHeat = 0

  const ATTACK_THIRD = Math.round(GRID_SIZE * 0.66)

  for (let i = 0; i < len; i++) {
    const v = pixelData[i]
    totalHeat += v
    if (v > maxHeat) maxHeat = v

    if (v > 0.01) {
      const x = i % GRID_SIZE
      const y = Math.floor(i / GRID_SIZE)
      weightedX += x * v
      weightedY += y * v
      hotPixels++

      const qx = x < HALF ? 0 : 1
      const qy = y < HALF ? 0 : 2
      q[qy + qx] += v

      if (x < HALF) homeHalfHeat += v
      else awayHalfHeat += v

      if (x > ATTACK_THIRD) attackThirdHeat += v
      if (x < GRID_SIZE - ATTACK_THIRD) defenseThirdHeat += v
    }
  }

  const avgHeat = hotPixels > 0 ? totalHeat / hotPixels : 0
  const turfAmplitude = Math.min(1, avgHeat * 4 * matchFlowMultiplier)

  const rippleCenter = hotPixels > 0
    ? { x: Math.round(weightedX / totalHeat), y: Math.round(weightedY / totalHeat) }
    : { x: ballX, y: ballY }

  const totalHalf = homeHalfHeat + awayHalfHeat
  const territoryFactor = totalHalf > 0
    ? ((homeHalfHeat - awayHalfHeat) / totalHalf)
    : 0

  const qTotal = q[0] + q[1] + q[2] + q[3]
  const quadrants: [number, number, number, number] = qTotal > 0
    ? [q[0] / qTotal, q[1] / qTotal, q[2] / qTotal, q[3] / qTotal]
    : [0.25, 0.25, 0.25, 0.25]

  const rippleAge = maxHeat > 0.5 ? 0 : maxHeat > 0.2 ? 0.3 : maxHeat > 0.05 ? 0.7 : 1

  const awayCx = awayHalfHeat > 0
    ? pixelData.reduce((acc, v, i) => {
        const x = i % GRID_SIZE
        return x >= HALF ? acc + x * v : acc
      }, 0) / awayHalfHeat
    : GRID_SIZE - 1
  const awayCy = awayHalfHeat > 0
    ? pixelData.reduce((acc, v, i) => {
        const y = Math.floor(i / GRID_SIZE)
        return (i % GRID_SIZE) >= HALF ? acc + y * v : acc
      }, 0) / awayHalfHeat
    : HALF

  const waveAngle = Math.atan2(awayCy - ballY, awayCx - ballX)

  const hotDensity = hotPixels / len
  const waveFrequency = Math.min(1, hotDensity * 5 * matchFlowMultiplier)

  const ballVelX = ballX - prevBallX
  const ballVelY = ballY - prevBallY
  const ballSpeed = Math.min(1, Math.sqrt(ballVelX * ballVelX + ballVelY * ballVelY) / 50)

  return {
    turfAmplitude,
    rippleCenter,
    rippleAge,
    territoryFactor,
    possession,
    ballX,
    ballY,
    homeScore,
    awayScore,
    phase,
    quadrants,
    waveAngle,
    waveFrequency,
    seq,
    clockSec,
    action,
    team,
    shotPower,
    cornerIndicator,
    foulPulse,
    cardFlash,
    attackIntensity,
    momentumVector,
    ballVelX,
    ballVelY,
    ballSpeed,
    shotsHome, shotsAway, cornersHome, cornersAway,
    foulsHome, foulsAway,
    homeYellowCards, homeRedCards, awayYellowCards, awayRedCards,
    homeMomentum, awayMomentum, momentumShift,
    homePressure, awayPressure,
    smoothBallVelX, smoothBallVelY, smoothBallSpeed,
    smoothTerritory, territoryMomentum, matchIntensity,
    matchFlowMultiplier,
  }
}

export function computeFrameFromPixelBlob(buffer: Buffer, metadata: {
  possession: number
  ballX: number
  ballY: number
  homeScore: number
  awayScore: number
  phase: number
  seq: number
  clockSec: number
  action: string | null
  team: number | null
  prevBallX?: number
  prevBallY?: number
  shotPower?: number
  cornerIndicator?: number
  foulPulse?: number
  cardFlash?: number
  attackIntensity?: number
  momentumVector?: { x: number; y: number }
  shotsHome?: number
  shotsAway?: number
  cornersHome?: number
  cornersAway?: number
  foulsHome?: number
  foulsAway?: number
  homeYellowCards?: number
  homeRedCards?: number
  awayYellowCards?: number
  awayRedCards?: number
  homeMomentum?: number
  awayMomentum?: number
  momentumShift?: number
  homePressure?: number
  awayPressure?: number
  smoothBallVelX?: number
  smoothBallVelY?: number
  smoothBallSpeed?: number
  smoothTerritory?: number
  territoryMomentum?: number
  matchIntensity?: number
}): PhysicsFrame {
  const pixelData = Array.from(new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4))
  return computePhysicsFrame({ ...metadata, pixelData })
}
