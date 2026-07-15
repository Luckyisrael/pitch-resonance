import { PitchGridData, TxoddsEvent } from './types'

const GRID_SIZE = 256
const DECAY_RATE = 0.97
const MAX_INTENSITY = 1.0
const BALL_DECAY = 0.9
const ATTACK_THIRD = Math.round(GRID_SIZE * 0.66)

const GRID_CENTER = GRID_SIZE / 2
const INTEREST_ZONE_RADIUS = GRID_SIZE * 0.4

interface EventActivity {
  x: number
  y: number
  intensity: number
  type: string
}

interface RollingEvent {
  x: number
  y: number
  team: number
  type: string
  intensity: number
}

const MOMENTUM_WINDOW = 20
const PRESSURE_ATTACK_MULT = 0.12
const PRESSURE_DEFENSE_DECAY = 0.04
const PRESSURE_SHOT_BONUS = 0.25
const PRESSURE_CORNER_BONUS = 0.15
const PRESSURE_GOAL_RELEASE = 0.6
const INTENSITY_WINDOW = 30
const BALL_SMOOTHING = 0.6
const TERRITORY_SMOOTHING = 0.15

export class PitchGrid {
  private grid: Float32Array
  private ballX: number
  private ballY: number
  private prevBallX: number
  private prevBallY: number
  private homeScore: number
  private awayScore: number
  private possessionHome: number
  private phase: number
  private homeEvents: number
  private awayEvents: number
  private lastDecayTime: number
  private matchClock: number
  private lastAction: string | null
  private lastTeam: number | null

  private _shotsHome: number
  private _shotsAway: number
  private _cornersHome: number
  private _cornersAway: number
  private _foulsHome: number
  private _foulsAway: number
  private _homeYellowCards: number
  private _homeRedCards: number
  private _awayYellowCards: number
  private _awayRedCards: number
  private _shotPower: number
  private _cornerIndicator: number
  private _foulPulse: number
  private _cardFlash: number
  private _attackIntensity: number
  private _momentumVector: { x: number; y: number }
  private _consecutiveHome: number
  private _consecutiveAway: number
  private _goalCooldown: number

  private _eventWindow: RollingEvent[]
  private _homeMomentum: number
  private _awayMomentum: number
  private _prevHomeMomentum: number
  private _prevAwayMomentum: number
  private _momentumShift: number
  private _homePressure: number
  private _awayPressure: number
  private _smoothBallVelX: number
  private _smoothBallVelY: number
  private _smoothBallSpeed: number
  private _smoothTerritory: number
  private _prevSmoothTerritory: number
  private _territoryMomentum: number
  private _eventTimestamps: number[]
  private _matchIntensity: number

  constructor() {
    this.grid = new Float32Array(GRID_SIZE * GRID_SIZE)
    this.ballX = GRID_SIZE / 2
    this.ballY = GRID_SIZE / 2
    this.prevBallX = GRID_SIZE / 2
    this.prevBallY = GRID_SIZE / 2
    this.homeScore = 0
    this.awayScore = 0
    this.possessionHome = 50
    this.phase = 1
    this.homeEvents = 0
    this.awayEvents = 0
    this.lastDecayTime = Date.now()
    this.matchClock = 0
    this.lastAction = null
    this.lastTeam = null

    this._shotsHome = 0
    this._shotsAway = 0
    this._cornersHome = 0
    this._cornersAway = 0
    this._foulsHome = 0
    this._foulsAway = 0
    this._homeYellowCards = 0
    this._homeRedCards = 0
    this._awayYellowCards = 0
    this._awayRedCards = 0
    this._shotPower = 0
    this._cornerIndicator = 0
    this._foulPulse = 0
    this._cardFlash = 0
    this._attackIntensity = 0
    this._momentumVector = { x: 0, y: 0 }
    this._consecutiveHome = 0
    this._consecutiveAway = 0
    this._goalCooldown = 0

    this._eventWindow = []
    this._homeMomentum = 0
    this._awayMomentum = 0
    this._prevHomeMomentum = 0
    this._prevAwayMomentum = 0
    this._momentumShift = 0
    this._homePressure = 0
    this._awayPressure = 0
    this._smoothBallVelX = 0
    this._smoothBallVelY = 0
    this._smoothBallSpeed = 0
    this._smoothTerritory = 0
    this._prevSmoothTerritory = 0
    this._territoryMomentum = 0
    this._eventTimestamps = []
    this._matchIntensity = 0
  }

  applyEvent(event: TxoddsEvent): EventActivity | null {
    const x = event.X ?? event.x ?? -1
    const y = event.Y ?? event.y ?? -1

    if (x < 0 || y < 0) return null

    const gx = Math.round((x / 100) * GRID_SIZE)
    const gy = Math.round((y / 100) * GRID_SIZE)

    if (gx < 0 || gx >= GRID_SIZE || gy < 0 || gy >= GRID_SIZE) return null

    const type = event.Type?.toLowerCase() ?? event.type?.toLowerCase() ?? 'unknown'
    const participant = event.Participant ?? event.participant ?? 1

    const intensity = this.getEventIntensity(type)

    this.applyActivity(gx, gy, intensity)

    this.prevBallX = this.ballX
    this.prevBallY = this.ballY

    if (participant === 1) {
      this.homeEvents++
      this._consecutiveHome++
      this._consecutiveAway = 0
    } else {
      this.awayEvents++
      this._consecutiveAway++
      this._consecutiveHome = 0
    }

    const totalEvents = this.homeEvents + this.awayEvents
    this.possessionHome = totalEvents > 0 ? Math.round((this.homeEvents / totalEvents) * 100) : 50

    this.ballX = gx
    this.ballY = gy

    this.lastAction = type
    this.lastTeam = participant === 1 ? 0 : 1

    this._shotPower = 0
    this._cornerIndicator = 0
    this._foulPulse = 0
    this._cardFlash = 0

    const teamSide = participant === 1 ? 'home' : 'away'

    if (type === 'goal') {
      this.applyGoalEffect(gx, gy)
      if (participant === 1) this.homeScore++
      else this.awayScore++
      this._shotPower = 1.0
      this._goalCooldown = 5
      if (participant === 1) this._homePressure = Math.max(0, this._homePressure - PRESSURE_GOAL_RELEASE)
      else this._awayPressure = Math.max(0, this._awayPressure - PRESSURE_GOAL_RELEASE)
    }

    if (type === 'shot') {
      this._shotPower = intensity
      if (teamSide === 'home') { this._shotsHome++; this._homePressure = Math.min(1, this._homePressure + PRESSURE_SHOT_BONUS) }
      else { this._shotsAway++; this._awayPressure = Math.min(1, this._awayPressure + PRESSURE_SHOT_BONUS) }
    }

    if (type === 'corner') {
      this._cornerIndicator = 1.0
      if (teamSide === 'home') { this._cornersHome++; this._homePressure = Math.min(1, this._homePressure + PRESSURE_CORNER_BONUS) }
      else { this._cornersAway++; this._awayPressure = Math.min(1, this._awayPressure + PRESSURE_CORNER_BONUS) }
    }

    if (type === 'foul') {
      this._foulPulse = 0.8
      if (teamSide === 'home') this._foulsHome++
      else this._foulsAway++
    }

    if (type === 'yellow_card') {
      this._cardFlash = 0.5
      if (teamSide === 'home') this._homeYellowCards++
      else this._awayYellowCards++
    }

    if (type === 'red_card') {
      this._cardFlash = 1.0
      if (teamSide === 'home') this._homeRedCards++
      else this._awayRedCards++
    }

    this._attackIntensity = this.computeAttackIntensity(gx)
    this._momentumVector = this.computeMomentum()

    this._eventWindow.push({ x: gx, y: gy, team: participant, type, intensity })
    if (this._eventWindow.length > MOMENTUM_WINDOW) this._eventWindow.shift()

    this._prevHomeMomentum = this._homeMomentum
    this._prevAwayMomentum = this._awayMomentum
    this.computeRollingMomentum()

    this.computePressure(gx, participant, type)

    const rawVelX = gx - this.prevBallX
    const rawVelY = gy - this.prevBallY
    this._smoothBallVelX = this._smoothBallVelX * BALL_SMOOTHING + rawVelX * (1 - BALL_SMOOTHING)
    this._smoothBallVelY = this._smoothBallVelY * BALL_SMOOTHING + rawVelY * (1 - BALL_SMOOTHING)
    this._smoothBallSpeed = Math.min(1, Math.sqrt(this._smoothBallVelX ** 2 + this._smoothBallVelY ** 2) / 50)

    const now = Date.now()
    this._eventTimestamps.push(now)
    this._eventTimestamps = this._eventTimestamps.filter(t => now - t < INTENSITY_WINDOW * 1000)
    this._matchIntensity = Math.min(1, this._eventTimestamps.length / 15)

    return { x: gx, y: gy, intensity, type }
  }

  private computeRollingMomentum() {
    const window = this._eventWindow
    if (window.length === 0) {
      this._homeMomentum = 0
      this._awayMomentum = 0
      this._momentumShift = 0
      return
    }

    let homeWeighted = 0
    let awayWeighted = 0
    const len = window.length

    for (let i = 0; i < len; i++) {
      const recency = 1 - (i / len)
      const weight = recency * recency
      const e = window[i]
      if (e.team === 1) homeWeighted += e.intensity * weight
      else awayWeighted += e.intensity * weight
    }

    this._homeMomentum = Math.min(1, homeWeighted / 5)
    this._awayMomentum = Math.min(1, awayWeighted / 5)

    const homeDelta = this._homeMomentum - this._prevHomeMomentum
    const awayDelta = this._awayMomentum - this._prevAwayMomentum
    this._momentumShift = Math.min(1, Math.abs(homeDelta - awayDelta) * 3)
  }

  private computePressure(eventX: number, participant: number, type: string) {
    const isHome = participant === 1
    const ATTACK_THIRD = GRID_SIZE * 0.66
    const DEFENSE_THIRD = GRID_SIZE * 0.34

    if (isHome) {
      if (eventX > ATTACK_THIRD) this._homePressure = Math.min(1, this._homePressure + PRESSURE_ATTACK_MULT)
      else if (eventX < DEFENSE_THIRD) this._homePressure = Math.max(0, this._homePressure - PRESSURE_DEFENSE_DECAY)
      else this._homePressure = Math.max(0, this._homePressure - PRESSURE_DEFENSE_DECAY * 0.5)
    } else {
      if (eventX < DEFENSE_THIRD) this._awayPressure = Math.min(1, this._awayPressure + PRESSURE_ATTACK_MULT)
      else if (eventX > ATTACK_THIRD) this._awayPressure = Math.max(0, this._awayPressure - PRESSURE_DEFENSE_DECAY)
      else this._awayPressure = Math.max(0, this._awayPressure - PRESSURE_DEFENSE_DECAY * 0.5)
    }

    if (type === 'clearance') {
      if (isHome) this._awayPressure = Math.max(0, this._awayPressure - 0.15)
      else this._homePressure = Math.max(0, this._homePressure - 0.15)
    }
  }

  private computeAttackIntensity(eventX: number): number {
    const inAttackThird = eventX > ATTACK_THIRD
    if (inAttackThird) {
      return Math.min(1, this._attackIntensity + 0.15)
    }
    return Math.max(0, this._attackIntensity - 0.05)
  }

  private computeMomentum(): { x: number; y: number } {
    const recentHome = this._consecutiveHome
    const recentAway = this._consecutiveAway
    const total = recentHome + recentAway
    if (total === 0) return { x: 0, y: 0 }

    const bias = (recentHome - recentAway) / total
    const dirX = bias > 0 ? 1 : -1
    const strength = Math.min(1, total / 5)
    return { x: dirX * strength * Math.abs(bias), y: (this.ballY - GRID_CENTER) / GRID_CENTER * 0.3 }
  }

  private getEventIntensity(type: string): number {
    switch (type) {
      case 'goal': return 1.0
      case 'shot': return 0.8
      case 'yellow_card': return 0.7
      case 'red_card': return 0.9
      case 'card': return 0.6
      case 'foul': return 0.4
      case 'free_kick': return 0.5
      case 'corner': return 0.5
      case 'pass': return 0.15
      case 'touch': return 0.1
      case 'dribble': return 0.2
      case 'clearance': return 0.35
      case 'substitution': return 0.05
      default: return 0.2
    }
  }

  private applyActivity(cx: number, cy: number, intensity: number) {
    const radius = Math.max(1, Math.round(intensity * 8))
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > radius) continue

        const gx = cx + dx
        const gy = cy + dy
        if (gx < 0 || gx >= GRID_SIZE || gy < 0 || gy >= GRID_SIZE) continue

        const falloff = 1 - (dist / radius)
        const idx = gy * GRID_SIZE + gx
        this.grid[idx] = Math.min(MAX_INTENSITY, this.grid[idx] + intensity * falloff)
      }
    }
  }

  private applyGoalEffect(cx: number, cy: number) {
    for (let dy = -40; dy <= 40; dy++) {
      for (let dx = -40; dx <= 40; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > 40) continue
        const gx = cx + dx
        const gy = cy + dy
        if (gx < 0 || gx >= GRID_SIZE || gy < 0 || gy >= GRID_SIZE) continue
        const falloff = 1 - (dist / 40)
        this.grid[gy * GRID_SIZE + gx] = Math.min(MAX_INTENSITY, this.grid[gy * GRID_SIZE + gx] + falloff * 0.5)
      }
    }
  }

  decay(now: number) {
    if (now - this.lastDecayTime < 100) return
    this.lastDecayTime = now

    let ballIdx = Math.round(this.ballY) * GRID_SIZE + Math.round(this.ballX)
    for (let i = 0; i < this.grid.length; i++) {
      this.grid[i] *= DECAY_RATE
      if (this.grid[i] < 0.01) this.grid[i] = 0
    }

    this.grid[ballIdx] = Math.max(BALL_DECAY, this.grid[ballIdx])

    this._shotPower *= 0.92
    this._cornerIndicator *= 0.9
    this._foulPulse *= 0.88
    this._cardFlash *= 0.85
    this._attackIntensity *= 0.97

    this._homePressure = Math.max(0, this._homePressure - 0.008)
    this._awayPressure = Math.max(0, this._awayPressure - 0.008)
    this._momentumShift *= 0.93
  }

  setPhase(phase: number) {
    if (phase !== this.phase) {
      if (phase === 3 || phase === 5 || phase === 9) {
        this.grid.fill(0)
      }
      this.phase = phase
    }
  }

  setScore(home: number, away: number) {
    this.homeScore = home
    this.awayScore = away
  }

  setMatchClock(clockSec: number) {
    this.matchClock = clockSec
  }

  getData(): PitchGridData {
    const goalActive = this._goalCooldown > 0
    if (goalActive) this._goalCooldown--

    const rawTerritory = (this.homeEvents + this.awayEvents) > 0
      ? ((this.homeEvents - this.awayEvents) / (this.homeEvents + this.awayEvents))
      : 0
    this._prevSmoothTerritory = this._smoothTerritory
    this._smoothTerritory = this._smoothTerritory * (1 - TERRITORY_SMOOTHING) + rawTerritory * TERRITORY_SMOOTHING
    this._territoryMomentum = this._smoothTerritory - this._prevSmoothTerritory

    return {
      pixelData: new Float32Array(this.grid),
      possession: this.possessionHome,
      homeScore: this.homeScore,
      awayScore: this.awayScore,
      phase: this.phase,
      ballX: this.ballX,
      ballY: this.ballY,
      matchClock: this.matchClock,
      lastAction: goalActive ? 'goal' : this.lastAction,
      lastTeam: this.lastTeam,
      prevBallX: this.prevBallX,
      prevBallY: this.prevBallY,
      shotPower: goalActive ? 1.0 : this._shotPower,
      cornerIndicator: this._cornerIndicator,
      foulPulse: this._foulPulse,
      cardFlash: this._cardFlash,
      attackIntensity: this._attackIntensity,
      momentumVector: this._momentumVector,
      shotsHome: this._shotsHome,
      shotsAway: this._shotsAway,
      cornersHome: this._cornersHome,
      cornersAway: this._cornersAway,
      foulsHome: this._foulsHome,
      foulsAway: this._foulsAway,
      homeYellowCards: this._homeYellowCards,
      homeRedCards: this._homeRedCards,
      awayYellowCards: this._awayYellowCards,
      awayRedCards: this._awayRedCards,
      homeMomentum: this._homeMomentum,
      awayMomentum: this._awayMomentum,
      momentumShift: this._momentumShift,
      homePressure: this._homePressure,
      awayPressure: this._awayPressure,
      smoothBallVelX: this._smoothBallVelX,
      smoothBallVelY: this._smoothBallVelY,
      smoothBallSpeed: this._smoothBallSpeed,
      smoothTerritory: this._smoothTerritory,
      territoryMomentum: this._territoryMomentum,
      matchIntensity: this._matchIntensity,
    }
  }

  getGridSize(): number {
    return GRID_SIZE
  }

  reset() {
    this.grid.fill(0)
    this.homeEvents = 0
    this.awayEvents = 0
    this.possessionHome = 50
    this.homeScore = 0
    this.awayScore = 0
    this.phase = 1
    this.ballX = GRID_SIZE / 2
    this.ballY = GRID_SIZE / 2
    this.prevBallX = GRID_SIZE / 2
    this.prevBallY = GRID_SIZE / 2
    this.matchClock = 0
    this.lastAction = null
    this.lastTeam = null
    this._shotsHome = 0
    this._shotsAway = 0
    this._cornersHome = 0
    this._cornersAway = 0
    this._foulsHome = 0
    this._foulsAway = 0
    this._homeYellowCards = 0
    this._homeRedCards = 0
    this._awayYellowCards = 0
    this._awayRedCards = 0
    this._shotPower = 0
    this._cornerIndicator = 0
    this._foulPulse = 0
    this._cardFlash = 0
    this._attackIntensity = 0
    this._momentumVector = { x: 0, y: 0 }
    this._consecutiveHome = 0
    this._consecutiveAway = 0
    this._goalCooldown = 0
    this._eventWindow = []
    this._homeMomentum = 0
    this._awayMomentum = 0
    this._prevHomeMomentum = 0
    this._prevAwayMomentum = 0
    this._momentumShift = 0
    this._homePressure = 0
    this._awayPressure = 0
    this._smoothBallVelX = 0
    this._smoothBallVelY = 0
    this._smoothBallSpeed = 0
    this._smoothTerritory = 0
    this._prevSmoothTerritory = 0
    this._territoryMomentum = 0
    this._eventTimestamps = []
    this._matchIntensity = 0
  }
}
