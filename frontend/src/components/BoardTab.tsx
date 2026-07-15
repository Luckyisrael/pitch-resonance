import React, { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Trophy, Users, Coins, Goal, Activity, Award, Sparkles, DollarSign, CheckCircle, XCircle } from 'lucide-react'
import { useApp } from '../store/AppContext'
import * as api from '../store/api'

interface BoardStats {
  totalMatches: number
  settledMatches: number
  totalGoals: number
  totalTips: number
  totalTipCount: number
  uniqueTippers: number
  topTippers: Array<{ wallet: string; totalTips: number; tipCount: number; wins: number }>
  matchResults: Array<{
    matchId: string; homeTeam: string; awayTeam: string;
    homeScore: number; awayScore: number; matchDate: string | null;
    winner: number | null; settled: boolean;
  }>
}

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

export default function BoardTab() {
  const { state, showToast } = useApp()
  const [stats, setStats] = useState<BoardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.fetchBoardStats(state.backendUrl)
      .then(setStats)
      .catch(() => showToast('Failed to load board stats', 'error'))
      .finally(() => setLoading(false))
  }, [state.backendUrl])

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
          <Activity className="w-5 h-5 text-amber-400 animate-spin" />
        </div>
        <p className="text-sm font-black text-zinc-400 uppercase tracking-wider">Loading Board</p>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 text-center">
        <p className="text-zinc-500 text-sm">Could not load board data.</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Matches', value: stats.totalMatches, icon: <Trophy className="w-5 h-5" />, color: 'text-amber-400' },
          { label: 'Total Goals', value: stats.totalGoals, icon: <Goal className="w-5 h-5" />, color: 'text-emerald-400' },
          { label: 'Total Tipped', value: `${(stats.totalTips / 1e9).toFixed(1)} SOL`, icon: <Coins className="w-5 h-5" />, color: 'text-sky-400' },
          { label: 'Tippers', value: stats.uniqueTippers, icon: <Users className="w-5 h-5" />, color: 'text-rose-400' },
        ].map(s => (
          <div key={s.label} className="bg-[#141415] border border-zinc-800 p-4 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-zinc-500">
              <span className={s.color}>{s.icon}</span>
              <span className="text-[9px] font-mono font-black uppercase tracking-wider">{s.label}</span>
            </div>
            <span className="text-2xl font-mono font-black text-white block">{s.value}</span>
          </div>
        ))}
      </div>

      {/* Leaderboard */}
      <div className="bg-[#141415] border border-zinc-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-400" />
          <h2 className="text-sm font-black text-white uppercase tracking-tight">Top Tippers Leaderboard</h2>
        </div>
        {stats.topTippers.length === 0 ? (
          <p className="text-xs font-mono text-zinc-600">No tips have been placed yet.</p>
        ) : (
          <div className="space-y-2">
            {stats.topTippers.map((t, i) => (
              <div key={t.wallet} className="flex items-center justify-between py-2 px-3 bg-[#0C0C0D] rounded-xl border border-zinc-900">
                <div className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black font-mono ${
                    i === 0 ? 'bg-amber-400 text-black' : i === 1 ? 'bg-zinc-300 text-zinc-800' : i === 2 ? 'bg-amber-800 text-amber-200' : 'bg-zinc-800 text-zinc-400'
                  }`}>
                    {i + 1}
                  </span>
                  <div>
                    <span className="text-xs font-mono font-bold text-zinc-300">{t.wallet.slice(0, 8)}...{t.wallet.slice(-4)}</span>
                    <span className="text-[9px] font-mono text-zinc-500 ml-2">{t.tipCount} tips</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-black text-amber-400">{(t.totalTips / 1e9).toFixed(2)} SOL</span>
                  {t.wins > 0 && <span className="text-[9px] font-mono text-emerald-400 block">{t.wins} wins</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Match Results */}
      <div className="bg-[#141415] border border-zinc-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-sky-400" />
          <h2 className="text-sm font-black text-white uppercase tracking-tight">Match Results</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {stats.matchResults.map(m => (
            <div key={m.matchId} className="flex items-center justify-between p-3 bg-[#0C0C0D] rounded-xl border border-zinc-900">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-sm">{getFlag(m.homeTeam)}</span>
                <span className="text-xs font-mono font-bold text-zinc-300 truncate">{m.homeTeam}</span>
              </div>
              <div className="flex items-center gap-2 px-3">
                <span className={`text-sm font-mono font-black ${m.winner === 1 ? 'text-emerald-400' : 'text-zinc-400'}`}>{m.homeScore}</span>
                <span className="text-zinc-600 text-[10px]">-</span>
                <span className={`text-sm font-mono font-black ${m.winner === 2 ? 'text-emerald-400' : 'text-zinc-400'}`}>{m.awayScore}</span>
              </div>
              <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                <span className="text-xs font-mono font-bold text-zinc-300 truncate">{m.awayTeam}</span>
                <span className="text-sm">{getFlag(m.awayTeam)}</span>
              </div>
              {m.settled && (
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-2" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
