import { PitchGrid } from './parser'
import type { TxoddsEvent } from './types'

interface BallState {
  x: number
  y: number
  vx: number
  vy: number
}

interface PossessionMomentum {
  homeConsecutive: number
  awayConsecutive: number
  pressure: number
  attackIntensity: number
  lastPossessionFlip: number
}

function clampGrid(v: number): number {
  return Math.max(2, Math.min(98, v))
}

function generateCornerPosition(attackDir: 1 | -1, side: 'top' | 'bottom'): { x: number; y: number } {
  const cornerY = side === 'top' ? 8 : 92
  const cornerX = attackDir === 1 ? 95 : 5
  return { x: cornerX, y: cornerY }
}

function generateShotPosition(attackDir: 1 | -1, shotType: 'on_target' | 'off_target' | 'saved'): { x: number; y: number } {
  const goalX = attackDir === 1 ? 95 : 5
  const centerY = 50
  switch (shotType) {
    case 'on_target':
      return { x: clampGrid(goalX + (Math.random() - 0.5) * 6), y: clampGrid(centerY + (Math.random() - 0.5) * 30) }
    case 'off_target':
      return { x: clampGrid(goalX + (Math.random() - 0.5) * 10), y: clampGrid(centerY + (Math.random() - 0.5) * 60) }
    case 'saved':
      return { x: clampGrid(goalX + (Math.random() - 0.5) * 4), y: clampGrid(centerY + (Math.random() - 0.5) * 20) }
  }
}

function generateFreeKickPosition(attackDir: 1 | -1): { x: number; y: number } {
  return {
    x: clampGrid(50 + attackDir * (15 + Math.random() * 25)),
    y: clampGrid(20 + Math.random() * 60),
  }
}

function generateBuildupEvent(
  ball: BallState,
  attackDir: 1 | -1,
  possessionSide: number,
  phase: number,
  momentum: PossessionMomentum
): { type: string; x: number; y: number; participant: number } {
  const isHomeAttacking = phase === 1
  const attackerGoalX = isHomeAttacking ? 95 : 5
  const defenderGoalX = isHomeAttacking ? 5 : 95

  const inDefensiveThird = (isHomeAttacking && ball.x < 33) || (!isHomeAttacking && ball.x > 67)
  const inAttackingThird = (isHomeAttacking && ball.x > 67) || (!isHomeAttacking && ball.x < 33)
  const inMidfield = !inDefensiveThird && !inAttackingThird

  const isDangerous = momentum.attackIntensity > 0.5

  const roll = Math.random()

  if (inDefensiveThird) {
    if (roll < 0.5) {
      return {
        type: 'pass',
        x: clampGrid(ball.x + attackDir * (8 + Math.random() * 15)),
        y: clampGrid(ball.y + (Math.random() - 0.5) * 20),
        participant: possessionSide,
      }
    } else if (roll < 0.7) {
      return {
        type: 'touch',
        x: clampGrid(ball.x + (Math.random() - 0.5) * 8),
        y: clampGrid(ball.y + (Math.random() - 0.5) * 10),
        participant: possessionSide,
      }
    } else if (roll < 0.85) {
      return {
        type: 'clearance',
        x: clampGrid(50 + (Math.random() - 0.5) * 30),
        y: clampGrid(20 + Math.random() * 60),
        participant: possessionSide,
      }
    } else {
      return {
        type: 'pass',
        x: clampGrid(ball.x + attackDir * (5 + Math.random() * 10)),
        y: clampGrid(ball.y + (Math.random() - 0.5) * 15),
        participant: possessionSide,
      }
    }
  }

  if (inMidfield) {
    if (roll < 0.35) {
      return {
        type: 'pass',
        x: clampGrid(ball.x + attackDir * (10 + Math.random() * 20)),
        y: clampGrid(ball.y + (Math.random() - 0.5) * 25),
        participant: possessionSide,
      }
    } else if (roll < 0.55) {
      return {
        type: 'dribble',
        x: clampGrid(ball.x + attackDir * (3 + Math.random() * 8)),
        y: clampGrid(ball.y + (Math.random() - 0.5) * 12),
        participant: possessionSide,
      }
    } else if (roll < 0.7) {
      return {
        type: 'touch',
        x: clampGrid(ball.x + (Math.random() - 0.5) * 10),
        y: clampGrid(ball.y + (Math.random() - 0.5) * 12),
        participant: possessionSide,
      }
    } else if (roll < 0.82) {
      return {
        type: 'foul',
        x: clampGrid(ball.x + (Math.random() - 0.5) * 8),
        y: clampGrid(ball.y + (Math.random() - 0.5) * 10),
        participant: possessionSide === 1 ? 2 : 1,
      }
    } else {
      return {
        type: 'pass',
        x: clampGrid(ball.x + attackDir * (5 + Math.random() * 12)),
        y: clampGrid(ball.y + (Math.random() - 0.5) * 18),
        participant: possessionSide,
      }
    }
  }

  if (inAttackingThird) {
    if (isDangerous && roll < 0.15) {
      return { type: 'shot', ...generateShotPosition(attackDir, 'on_target'), participant: possessionSide }
    }
    if (isDangerous && roll < 0.22) {
      return { type: 'shot', ...generateShotPosition(attackDir, 'off_target'), participant: possessionSide }
    }
    if (roll < 0.3) {
      return { type: 'pass', ...generateShotPosition(attackDir, 'saved'), participant: possessionSide }
    } else if (roll < 0.45) {
      return {
        type: 'dribble',
        x: clampGrid(ball.x + attackDir * (2 + Math.random() * 5)),
        y: clampGrid(ball.y + (Math.random() - 0.5) * 10),
        participant: possessionSide,
      }
    } else if (roll < 0.55) {
      return {
        type: 'corner',
        ...generateCornerPosition(attackDir, Math.random() < 0.5 ? 'top' : 'bottom'),
        participant: possessionSide,
      }
    } else if (roll < 0.65) {
      return {
        type: 'free_kick',
        ...generateFreeKickPosition(attackDir),
        participant: possessionSide,
      }
    } else if (roll < 0.72) {
      return {
        type: 'foul',
        x: clampGrid(ball.x + (Math.random() - 0.5) * 6),
        y: clampGrid(ball.y + (Math.random() - 0.5) * 8),
        participant: possessionSide === 1 ? 2 : 1,
      }
    } else {
      return {
        type: 'pass',
        x: clampGrid(ball.x + attackDir * (3 + Math.random() * 8)),
        y: clampGrid(ball.y + (Math.random() - 0.5) * 15),
        participant: possessionSide,
      }
    }
  }

  return {
    type: 'pass',
    x: clampGrid(ball.x + attackDir * (5 + Math.random() * 15)),
    y: clampGrid(ball.y + (Math.random() - 0.5) * 20),
    participant: possessionSide,
  }
}

export function simulateMatch(
  grid: PitchGrid,
  options?: { speedMultiplier?: number; goals?: number[] }
) {
  const speed = options?.speedMultiplier ?? 60
  const HALF_LEN = 2700
  const HT_LEN = 300
  const STOPPAGE = 180
  const TOTAL_LEN = HALF_LEN * 2 + HT_LEN + STOPPAGE

  const numGoals = options?.goals?.length ?? (2 + Math.floor(Math.random() * 4))
  const goalTimes: number[] = options?.goals ?? []
  while (goalTimes.length < numGoals) {
    const minSec = 5 * 60
    const maxSec = 88 * 60
    const t = minSec + Math.random() * (maxSec - minSec)
    if (!goalTimes.some(g => Math.abs(g - t) < 300)) {
      goalTimes.push(t)
    }
  }
  goalTimes.sort((a, b) => a - b)

  let goalIdx = 0
  let phase = 1
  let possessionSide = 1
  const startTime = Date.now()

  const ball: BallState = { x: 50, y: 50, vx: 0, vy: 0 }
  const momentum: PossessionMomentum = {
    homeConsecutive: 0,
    awayConsecutive: 0,
    pressure: 0,
    attackIntensity: 0,
    lastPossessionFlip: 0,
  }

  let tickCount = 0

  grid.reset()
  grid.setPhase(1)

  const interval = setInterval(() => {
    const elapsedRealtime = (Date.now() - startTime) / 1000
    const matchClock = Math.round(elapsedRealtime * speed)
    tickCount++

    let newPhase: number
    if (matchClock < HALF_LEN) {
      newPhase = 1
    } else if (matchClock < HALF_LEN + HT_LEN) {
      newPhase = 5
    } else if (matchClock < HALF_LEN * 2 + HT_LEN) {
      newPhase = 9
    } else {
      newPhase = 13
    }

    if (newPhase !== phase) {
      phase = newPhase
      grid.setPhase(phase)
      if (phase === 5) {
        possessionSide = possessionSide === 1 ? 2 : 1
        momentum.homeConsecutive = 0
        momentum.awayConsecutive = 0
        momentum.pressure = 0
        momentum.attackIntensity = 0
      }
    }

    if (phase === 5 || phase === 13) {
      grid.setMatchClock(matchClock)
      if (phase === 13) clearInterval(interval)
      return
    }

    if (phase === 9 && matchClock >= HALF_LEN && matchClock < HALF_LEN + 5) {
      ball.x = 50
      ball.y = 50
      ball.vx = 0
      ball.vy = 0
    }

    const homeAttacking = phase === 1
    const attackDir: 1 | -1 = homeAttacking ? 1 : -1

    const eventsPerTick = 1 + Math.floor(Math.random() * 2)
    let goalForced = false

    for (let i = 0; i < eventsPerTick; i++) {
      let forceGoal = false
      if (!goalForced && goalIdx < goalTimes.length) {
        const diff = matchClock - goalTimes[goalIdx]
        if (diff >= 0 && diff < speed) {
          forceGoal = true
          goalForced = true
          goalIdx++
        }
      }

      if (forceGoal) {
        const goalX = homeAttacking ? 95 : 5
        const goalY = 50 + (Math.random() - 0.5) * 20
        grid.applyEvent({
          Type: 'Goal',
          X: Math.round(goalX),
          Y: Math.round(goalY),
          Participant: possessionSide,
        })
        ball.x = goalX
        ball.y = goalY
        ball.vx = 0
        ball.vy = 0
        break
      }

      const evt = generateBuildupEvent(ball, attackDir, possessionSide, phase, momentum)

      grid.applyEvent({
        Type: evt.type.charAt(0).toUpperCase() + evt.type.slice(1),
        X: Math.round(evt.x),
        Y: Math.round(evt.y),
        Participant: evt.participant,
      })

      const dx = evt.x - ball.x
      const dy = evt.y - ball.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > 0) {
        ball.vx = dx / dist * Math.min(1, dist / 20)
        ball.vy = dy / dist * Math.min(1, dist / 20)
      }
      ball.x = clampGrid(evt.x)
      ball.y = clampGrid(evt.y)

      if (evt.participant === 1) {
        momentum.homeConsecutive++
        momentum.awayConsecutive = 0
      } else {
        momentum.awayConsecutive++
        momentum.homeConsecutive = 0
      }

      if (evt.type === 'foul' || evt.type === 'clearance') {
        const newSide = evt.participant === 1 ? 2 : 1
        if (newSide !== possessionSide) {
          possessionSide = newSide
          momentum.homeConsecutive = evt.participant === 1 ? 1 : 0
          momentum.awayConsecutive = evt.participant === 2 ? 1 : 0
          momentum.lastPossessionFlip = tickCount
        }
      }

      if (evt.x > 67) {
        momentum.attackIntensity = Math.min(1, momentum.attackIntensity + 0.12)
      } else if (evt.x < 33) {
        momentum.attackIntensity = Math.max(0, momentum.attackIntensity - 0.08)
      }

      if (evt.type === 'yellow_card' || evt.type === 'red_card') {
        momentum.pressure = Math.min(1, momentum.pressure + 0.3)
      }
    }

    momentum.attackIntensity *= 0.95
    momentum.pressure *= 0.97

    const possessionJitter = Math.random()
    const momentumBias = (momentum.homeConsecutive - momentum.awayConsecutive) / 8
    const flipThreshold = 0.08 + momentumBias

    if (possessionJitter < flipThreshold && tickCount - momentum.lastPossessionFlip > 3) {
      const newSide = possessionSide === 1 ? 2 : 1
      if (Math.abs(momentum.homeConsecutive - momentum.awayConsecutive) < 3) {
        possessionSide = newSide
        momentum.lastPossessionFlip = tickCount
      }
    }

    grid.setMatchClock(matchClock)
  }, 100)

  return () => clearInterval(interval)
}
