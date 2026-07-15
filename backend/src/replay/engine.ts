import { getMatchEvents } from '../db/client'
import { PitchGrid } from '../txodds/parser'
import type { TxoddsEvent } from '../txodds/types'
import type { PitchGridData } from '../txodds/types'

interface ReplayEvent {
  timestamp: number
  eventType: string
  payload: string
}

interface ReplayState {
  currentTime: number
  duration: number
  speed: number
  playing: boolean
}

export class ReplayEngine {
  private matchId: string
  private events: ReplayEvent[] = []
  private grid: PitchGrid
  private state: ReplayState
  private lastTick: number = 0
  private onData: ((data: PitchGridData) => void) | null = null
  private onStateChange: ((state: ReplayState) => void) | null = null
  private onFinished: (() => void) | null = null
  private eventIndex: number = 0
  private rafTimer: ReturnType<typeof setInterval> | null = null

  constructor(matchId: string) {
    this.matchId = matchId
    this.grid = new PitchGrid()
    this.state = { currentTime: 0, duration: 0, speed: 1, playing: false }
  }

  onDataCallback(cb: typeof this.onData) { this.onData = cb; return this }
  onStateChangeCallback(cb: typeof this.onStateChange) { this.onStateChange = cb; return this }
  onFinishedCallback(cb: typeof this.onFinished) { this.onFinished = cb; return this }

  load() {
    this.events = getMatchEvents(this.matchId)
    this.grid.reset()
    this.eventIndex = 0

    if (this.events.length > 0) {
      const firstTs = this.events[0].timestamp
      const lastTs = this.events[this.events.length - 1].timestamp
      this.state.duration = lastTs - firstTs
    }

    this.state.currentTime = 0
    this.state.speed = 1
    this.state.playing = false
    this.onStateChange?.({ ...this.state })
    return this
  }

  play() {
    if (this.events.length === 0) return
    this.state.playing = true
    this.lastTick = Date.now()
    this.onStateChange?.({ ...this.state })

    this.rafTimer = setInterval(() => {
      if (!this.state.playing) return

      const now = Date.now()
      const delta = (now - this.lastTick) * this.state.speed
      this.lastTick = now
      this.state.currentTime += delta

      this.processEventsUpTo(this.state.currentTime)
      this.grid.decay(now)
      this.onData?.(this.grid.getData())
      this.onStateChange?.({ ...this.state })

      if (this.eventIndex >= this.events.length) {
        this.pause()
        this.onFinished?.()
      }
    }, 50)

    return this
  }

  pause() {
    this.state.playing = false
    this.onStateChange?.({ ...this.state })
    if (this.rafTimer) {
      clearInterval(this.rafTimer)
      this.rafTimer = null
    }
    return this
  }

  seek(to: number) {
    this.state.currentTime = Math.max(0, Math.min(to, this.state.duration))
    this.eventIndex = 0
    this.grid.reset()

    if (this.events.length > 0) {
      const firstTs = this.events[0].timestamp
      while (this.eventIndex < this.events.length) {
        const ev = this.events[this.eventIndex]
        const elapsed = ev.timestamp - firstTs
        if (elapsed > this.state.currentTime) break
        this.applyEvent(ev)
        this.eventIndex++
      }
    }

    this.onData?.(this.grid.getData())
    this.onStateChange?.({ ...this.state })
    return this
  }

  setSpeed(speed: number) {
    this.state.speed = speed
    this.onStateChange?.({ ...this.state })
    return this
  }

  private processEventsUpTo(currentTime: number) {
    if (this.events.length === 0) return
    const firstTs = this.events[0].timestamp

    while (this.eventIndex < this.events.length) {
      const ev = this.events[this.eventIndex]
      const elapsed = ev.timestamp - firstTs
      if (elapsed > currentTime) break
      this.applyEvent(ev)
      this.eventIndex++
    }
  }

  private applyEvent(ev: ReplayEvent) {
    try {
      const parsed = JSON.parse(ev.payload) as TxoddsEvent
      this.grid.applyEvent(parsed)
    } catch {
      // skip bad payload
    }
  }

  stop() {
    this.pause()
    this.events = []
    this.eventIndex = 0
    this.grid.reset()
  }

  isFinished(): boolean {
    return this.eventIndex >= this.events.length
  }
}
