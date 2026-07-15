import React, { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Database, ArrowLeft, Trophy, CheckCircle, Coins, Search } from 'lucide-react'
import { useApp } from '../store/AppContext'
import MatchVisualizerMain from './MatchVisualizerMain'
import * as api from '../store/api'

const COUNTRY_FLAGS: Record<string, string> = {
  "Argentina": "🇦🇷", "Egypt": "🇪🇬", "Brazil": "🇧🇷", "France": "🇫🇷",
  "England": "🇬🇧", "Portugal": "🇵🇹", "Germany": "🇩🇪", "Spain": "🇪🇸",
  "Italy": "🇮🇹", "Croatia": "🇭🇷", "Morocco": "🇲🇦", "Japan": "🇯🇵",
  "Uruguay": "🇺🇾", "Netherlands": "🇳🇱", "USA": "🇺🇸", "Mexico": "🇲🇽",
  "Canada": "🇨🇦", "Belgium": "🇧🇪", "Switzerland": "🇨🇭", "Denmark": "🇩🇰",
  "Tunisia": "🇹🇳", "Saudi Arabia": "🇸🇦", "Senegal": "🇸🇳", "Poland": "🇵🇱",
  "Australia": "🇦🇺", "South Korea": "🇰🇷", "Cameroon": "🇨🇲", "Ghana": "🇬🇭",
  "Ecuador": "🇪🇨", "Qatar": "🇶🇦", "Sweden": "🇸🇪", "Norway": "🇳🇴",
  "Paraguay": "🇵🇾", "Ivory Coast": "🇨🇮", "Cape Verde": "🇨🇻", "Algeria": "🇩🇿",
  "Austria": "🇦🇹", "Bosnia & Herzegovina": "🇧🇦", "Congo DR": "🇨🇩", "Colombia": "🇨🇴",
}

function getFlag(name: string) {
  const k = Object.keys(COUNTRY_FLAGS).find(key => key.toLowerCase() === name.toLowerCase() || name.toLowerCase().includes(key.toLowerCase()))
  return k ? COUNTRY_FLAGS[k] : '🏳️'
}

export default function MatchesTab() {
  const { state, dispatch, showToast } = useApp()
  const [replayMatchId, setReplayMatchId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [pools, setPools] = useState<Record<string, { homePool: number; awayPool: number }>>({})

  // Load pools for each match
  useEffect(() => {
    const loadPools = async () => {
      const poolMap: Record<string, { homePool: number; awayPool: number }> = {}
      for (const f of state.fixtures) {
        try {
          const p = await api.getPoolStats(state.backendUrl, f.matchId, state.authToken)
          poolMap[f.matchId] = { homePool: p.homePool, awayPool: p.awayPool }
        } catch {}
      }
      setPools(poolMap)
    }
    if (state.fixtures.length > 0) {
      loadPools()
    }
  }, [state.fixtures.length])

  const handleSelectReplay = (matchId: string) => {
    setReplayMatchId(matchId)
    dispatch({ type: 'SET_SELECTED_MATCH', id: matchId })
  }

  const handleBack = () => {
    setReplayMatchId(null)
    dispatch({ type: 'CLEAR_PHYSICS_FRAMES' })
  }

  const filteredFixtures = state.fixtures.filter(f => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return f.homeTeam.toLowerCase().includes(q) || f.awayTeam.toLowerCase().includes(q)
  })

  // Replay view
  if (replayMatchId) {
    const match = state.fixtures.find(f => f.matchId === replayMatchId)
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        <button onClick={handleBack}
          className="flex items-center gap-2 text-zinc-400 hover:text-white text-xs font-mono font-bold uppercase tracking-wider cursor-pointer transition-all">
          <ArrowLeft className="w-4 h-4" />
          Back to Fixtures
        </button>
        {match && (
          <div className="bg-[#141415] border border-zinc-800 p-4 rounded-2xl flex items-center gap-4">
            <span className="text-2xl">{getFlag(match.homeTeam)}</span>
            <div className="flex-1">
              <span className="text-sm font-black text-white uppercase">{match.homeTeam}</span>
              <span className="text-xs font-mono text-zinc-500 mx-2">vs</span>
              <span className="text-sm font-black text-white uppercase">{match.awayTeam}</span>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs font-mono text-zinc-500">{match.matchDate || 'Unknown date'}</span>
                {match.homeScore !== undefined && (
                  <span className="text-xs font-mono font-black text-zinc-300">{match.homeScore} - {match.awayScore}</span>
                )}
              </div>
            </div>
            {match.winner !== null && match.winner > 0 && (
              <Trophy className="w-5 h-5 text-amber-400 shrink-0" />
            )}
          </div>
        )}
        <MatchVisualizerMain compact />
      </div>
    )
  }

  // Grid view
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-white uppercase tracking-tight">World Cup Fixtures</h2>
          <p className="text-xs font-mono text-zinc-500 mt-1">{state.fixtures.length} matches loaded</p>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search teams..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-[#1e1e20] border border-zinc-800 text-white rounded-xl text-xs p-2.5 pl-9 font-sans focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-zinc-600"
          />
        </div>
      </div>

      {filteredFixtures.length === 0 ? (
        <div className="text-center py-12">
          <Database className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm font-black text-zinc-400 uppercase tracking-wider">No matches found</p>
          <p className="text-[10px] font-mono text-zinc-600 mt-1">Try a different search term.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFixtures.map(f => {
            const pool = pools[f.matchId] || { homePool: 0, awayPool: 0 }
            const totalPool = pool.homePool + pool.awayPool
            return (
              <motion.button
                key={f.matchId}
                onClick={() => handleSelectReplay(f.matchId)}
                className="bg-[#141415] border border-zinc-800 hover:border-zinc-700 rounded-2xl p-5 text-left cursor-pointer transition-all active:scale-[0.98]"
                whileHover={{ y: -2 }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{getFlag(f.homeTeam)}</span>
                    <span className="text-sm font-black text-white uppercase">{f.homeTeam}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-white uppercase">{f.awayTeam}</span>
                    <span className="text-xl">{getFlag(f.awayTeam)}</span>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-3 mb-3">
                  <span className="text-2xl font-mono font-black text-white">{f.homeScore}</span>
                  <span className="text-zinc-600 text-sm">-</span>
                  <span className="text-2xl font-mono font-black text-white">{f.awayScore}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                  <span>{f.matchDate || ''}</span>
                  <div className="flex items-center gap-1.5">
                    {f.winner !== null && f.winner > 0 && (
                      <span className="flex items-center gap-1 text-emerald-400">
                        <CheckCircle className="w-3 h-3" />
                        Settled
                      </span>
                    )}
                    {totalPool > 0 && (
                      <span className="flex items-center gap-1 text-amber-400">
                        <Coins className="w-3 h-3" />
                        {(totalPool / 1e9).toFixed(2)} SOL
                      </span>
                    )}
                  </div>
                </div>
              </motion.button>
            )
          })}
        </div>
      )}
    </div>
  )
}
