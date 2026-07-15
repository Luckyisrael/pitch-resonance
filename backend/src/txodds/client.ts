import axios from 'axios'
import { PitchGrid } from './parser'
import { upsertMatch, insertEvent } from '../db/client'
import type { TxoddsEvent } from './types'

interface TxoddsClientConfig {
  apiBase: string
  jwt: string
  apiToken: string
  fixtureId?: number
}

export class TxoddsClient {
  private config: TxoddsClientConfig
  private grid: PitchGrid
  private abortController: AbortController | null = null
  private matchId: string
  private onData: ((data: ReturnType<PitchGrid['getData']>) => void) | null
  private onPhaseChange: ((phase: number) => void) | null
  private onFinalised: ((homeScore: number, awayScore: number) => void) | null
  private onConnectionChange: ((status: 'connected' | 'reconnecting' | 'failed', attempt?: number) => void) | null
  private tickInterval: ReturnType<typeof setInterval> | null = null
  private reconnectCount = 0
  private maxReconnectDelay = 30000
  private stopped = false

  constructor(config: TxoddsClientConfig) {
    this.config = config
    this.grid = new PitchGrid()
    this.matchId = String(config.fixtureId || '0')
    this.onData = null
    this.onPhaseChange = null
    this.onFinalised = null
    this.onConnectionChange = null
  }

  onDataCallback(cb: typeof this.onData) { this.onData = cb; return this }
  onPhaseChangeCallback(cb: typeof this.onPhaseChange) { this.onPhaseChange = cb; return this }
  onFinalisedCallback(cb: typeof this.onFinalised) { this.onFinalised = cb; return this }
  onConnectionChangeCallback(cb: typeof this.onConnectionChange) { this.onConnectionChange = cb; return this }

  async start() {
    this.stopped = false
    this.abortController = new AbortController()

    this.tickInterval = setInterval(() => {
      this.grid.decay(Date.now())
      this.emitData()
    }, 100)

    try {
      const url = `${this.config.apiBase}/scores/stream`
      const response = await axios.get(url, {
        signal: this.abortController.signal,
        responseType: 'stream',
        headers: {
          Authorization: `Bearer ${this.config.jwt}`,
          'X-Api-Token': this.config.apiToken,
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
      })

      this.reconnectCount = 0
      this.onConnectionChange?.('connected')

      const stream = response.data as NodeJS.ReadableStream
      let buffer = ''

      stream.on('data', (chunk: Buffer) => {
        buffer += chunk.toString()
        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''

        for (const part of parts) {
          this.processSseBlock(part)
        }
      })

      stream.on('end', () => {
        if (buffer.trim()) this.processSseBlock(buffer)
        if (!this.stopped) this.scheduleReconnect()
      })

      stream.on('error', (err: Error) => {
        if (!this.abortController?.signal.aborted && !this.stopped) {
          console.error('SSE stream error:', err.message)
          this.scheduleReconnect()
        }
      })

    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'CanceledError') return
      console.error('SSE connection error:', err instanceof Error ? err.message : String(err))

      if (this.config.fixtureId && !this.stopped) {
        console.log(`No live stream for fixture ${this.config.fixtureId}, trying historical...`)
        await this.loadHistorical()
      }

      if (!this.stopped) this.scheduleReconnect()
    }
  }

  private scheduleReconnect() {
    if (this.stopped) return
    this.reconnectCount++
    const delay = Math.min(1000 * Math.pow(2, this.reconnectCount - 1), this.maxReconnectDelay)
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectCount})...`)
    this.onConnectionChange?.('reconnecting', this.reconnectCount)
    setTimeout(() => {
      if (!this.stopped) this.start()
    }, delay)
  }

  private processSseBlock(block: string) {
    let eventType = 'message'
    let dataStr = ''

    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) {
        eventType = line.slice(6).trim()
      } else if (line.startsWith('data:')) {
        dataStr += line.slice(5).trim()
      }
    }

    if (!dataStr) return

    try {
      const parsed = JSON.parse(dataStr)
      this.handleSseMessage(eventType, parsed)
    } catch {
      // skip unparseable
    }
  }

  private handleSseMessage(eventType: string, data: Record<string, unknown>) {
    const actions = data.actions as TxoddsEvent[] | undefined
    if (actions) {
      for (const action of actions) {
        this.processAction(action)
      }
    }

    const gameState = data.gameState ?? data.GameState
    if (gameState !== undefined) {
      let phase = typeof gameState === 'number' ? gameState : parseInt(String(gameState))
      if (!isNaN(phase)) {
        this.grid.setPhase(phase)
        this.onPhaseChange?.(phase)

        if (phase === 5 || phase === 10 || phase === 13) {
          const hs = data.homeScore ?? data.home_score ?? this.grid['homeScore']
          const as = data.awayScore ?? data.away_score ?? this.grid['awayScore']
          this.onFinalised?.(hs as number, as as number)
        }
      }
    }
  }

  private processAction(action: TxoddsEvent) {
    if (!action) return

    const fixtureId = action.FixtureId ?? action.fixtureId
    if (fixtureId) {
      this.matchId = String(fixtureId)
    }

    const result = this.grid.applyEvent(action)
    if (result) {
      insertEvent(
        this.matchId,
        Date.now(),
        result.type,
        JSON.stringify(action),
        action.Seq ?? action.seq
      )
    }
  }

  private emitData() {
    this.onData?.(this.grid.getData())
  }

  private async loadHistorical() {
    try {
      const url = `${this.config.apiBase}/scores/historical/${this.config.fixtureId}`
      const res = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${this.config.jwt}`,
          'X-Api-Token': this.config.apiToken,
        },
        timeout: 10000,
      })

      const updates = res.data
      if (Array.isArray(updates)) {
        for (const update of updates) {
          this.handleSseMessage('history', update)
        }
      }
    } catch (err) {
      console.error('Historical load failed:', err instanceof Error ? err.message : String(err))
    }
  }

  stop() {
    this.stopped = true
    this.abortController?.abort()
    if (this.tickInterval) {
      clearInterval(this.tickInterval)
      this.tickInterval = null
    }
  }
}
