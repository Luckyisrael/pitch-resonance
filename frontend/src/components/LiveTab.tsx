import React, { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Coins, Wallet, Trophy, Sparkles, RefreshCw,
  Activity, DollarSign, Play, Radio,
} from 'lucide-react'
import { useApp } from '../store/AppContext'
import MatchVisualizerMain from './MatchVisualizerMain'
import FanEngagementHub from './FanEngagementHub'
import type { TeamSide } from '../store/types'

const PLATFORM_FEE_PERCENT = 3.5
const DISTRIBUTION_PERCENT = 96.5

export default function LiveTab() {
  const { state, dispatch, sendTip, claimWinnings, showToast } = useApp()
  const [simulating, setSimulating] = useState(false)

  const startSimulation = () => {
    setSimulating(true)
    dispatch({ type: 'SET_SELECTED_MATCH', id: 'simulation' })
    dispatch({ type: 'CLEAR_PHYSICS_FRAMES' })
    showToast('Match simulation started — watch the 3D pitch!', 'success')
  }

  const handleSendTip = (team: TeamSide, amount: number) => {
    if (!state.walletConnected) {
      showToast('Connect wallet to tip!', 'error')
      return
    }
    if (state.solBalance < amount) {
      showToast('Insufficient SOL balance!', 'error')
      return
    }
    sendTip(team, amount)
  }

  const handleClaimPurse = () => {
    if (!state.walletConnected) {
      showToast('Connect wallet to claim!', 'error')
      return
    }
    if (state.userStakeHome <= 0 && state.userStakeAway <= 0) {
      showToast('No tips on winning team to claim!', 'error')
      return
    }
    claimWinnings()
  }

  const totalPool = state.homePool + state.awayPool
  const homePercent = totalPool > 0 ? Math.round((state.homePool / totalPool) * 100) : 50
  const awayPercent = 100 - homePercent
  const argMultiplier = state.homePool > 0 ? ((totalPool * (DISTRIBUTION_PERCENT / 100)) / state.homePool).toFixed(2) : '1.00'
  const egyMultiplier = state.awayPool > 0 ? ((totalPool * (DISTRIBUTION_PERCENT / 100)) / state.awayPool).toFixed(2) : '1.00'

  return (
    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-grow grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <div className="lg:col-span-8 space-y-6">
        {simulating ? (
          <>
            <MatchVisualizerMain />
            <FanEngagementHub />
          </>
        ) : (
          <div className="space-y-6">
            <div className="border border-zinc-800 relative overflow-hidden">
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-0 left-0 w-px h-full bg-zinc-800/40" />
                <div className="absolute top-0 right-0 w-px h-full bg-zinc-800/40" />
                <div className="absolute top-[55%] left-0 w-full h-px bg-zinc-800/20" />
              </div>

              <div className="relative z-10 grid md:grid-cols-12 gap-px bg-zinc-800">
                <div className="md:col-span-8 bg-[#111112] p-6 md:p-8 space-y-5">
                  <div className="flex items-center gap-4">
                    <span className="text-[9px] font-mono tracking-[0.2em] font-black text-amber-400 uppercase">Control Center</span>
                    <span className="text-[8px] font-mono text-zinc-600 tracking-widest uppercase">Tactical Companion</span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-black text-white leading-[1.1] uppercase tracking-tight">
                    MATCH<br />
                    <span className="text-zinc-500">SIMULATOR</span>
                  </h2>
                  <p className="text-xs text-zinc-500 max-w-md">
                    Start a simulated match to demo the full experience — 3D pitch deformation, physics frames, parimutuel tipping pool, and stadium fan engagement.
                  </p>
                  <motion.button onClick={startSimulation} whileTap={{ scale: 0.98 }}
                    className="inline-flex items-center gap-3 px-7 py-3.5 bg-amber-400 hover:bg-amber-300 text-black font-black text-xs uppercase cursor-pointer transition-all active:scale-[0.98]">
                    <Play className="w-4 h-4 fill-current" />
                    <span>Launch Simulation</span>
                  </motion.button>
                </div>
                <div className="md:col-span-4 bg-[#141415] p-6 md:p-8 flex flex-col justify-center space-y-4">
                  <div className="space-y-2.5">
                    {[
                      ['Status', 'Idle — Awaiting Start'],
                      ['Mode', 'Simulated Physics'],
                      ['Pitch Dim', '256 × 256'],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between items-center text-[10px] font-mono">
                        <span className="text-zinc-500 font-bold uppercase tracking-wider">{k}</span>
                        <span className="text-zinc-300 font-black">{v}</span>
                      </div>
                    ))}
                  </div>
                  <div className="w-full h-px bg-zinc-800" />
                  <div className="flex items-baseline justify-between">
                    <span className="text-[9px] font-mono tracking-widest font-bold text-zinc-500 uppercase">Pre-loaded Matches</span>
                    <span className="text-lg font-black text-amber-400">22</span>
                  </div>
                </div>
              </div>
            </div>
            <FanEngagementHub />
          </div>
        )}
      </div>

      <div className="lg:col-span-4 space-y-6">
        <div className="bg-[#141415] border border-zinc-800">
          <div className="p-5 space-y-1">
            <span className="text-[9px] font-mono tracking-[0.2em] font-black text-amber-400 uppercase block">Solana Parimutuel Purse</span>
            <div className="w-8 h-[2px] bg-amber-400 mt-2" />
            <h2 className="text-xl font-black text-white tracking-tight uppercase mt-3">HYPE ARENA</h2>
            <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider mt-1">
              Support Team <span className="text-amber-400 font-bold">•</span> Send Shockwaves <span className="text-amber-400 font-bold">•</span> Split Purse
            </p>
          </div>
        </div>

        <div className="bg-[#141415] border border-zinc-800">
          <div className="p-5 space-y-4">
            <div className="flex justify-between items-end">
              <div>
                <span className="text-[9px] font-mono text-zinc-500 font-black tracking-wider uppercase">TOTAL HYPE POOL</span>
                <span className="text-2xl font-mono font-black text-white tracking-tight mt-1 flex items-center gap-1.5">
                  <Coins className="w-5.5 h-5.5 text-amber-400 shrink-0" />
                  {totalPool.toFixed(2)} <span className="text-xs text-zinc-500 font-bold">SOL</span>
                </span>
              </div>
              <div className="text-right">
                <span className="text-[9px] font-mono text-emerald-400 font-black tracking-wider bg-emerald-950/80 border border-emerald-900/60 px-2 py-0.5 uppercase">
                  {state.backendUrl.includes('localhost') ? 'LOCAL DEV' : 'DEVNET'}
                </span>
                <span className="text-[9px] font-mono text-zinc-500 font-bold tracking-wider mt-1.5 block">
                  {state.txHistory.length} Live Cheers
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="h-6 bg-[#0B0B0C] border border-zinc-850 overflow-hidden flex relative">
                <motion.div
                  className="h-full bg-gradient-to-r from-sky-600 to-sky-400 flex items-center pl-3"
                  style={{ width: `${homePercent}%` }}
                  animate={{ width: `${homePercent}%` }}
                  transition={{ type: 'spring', stiffness: 85, damping: 15 }}
                >
                  <span className="text-[10px] font-mono font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                    {state.homeTeam.slice(0, 3)} {homePercent}%
                  </span>
                </motion.div>
                <motion.div
                  className="absolute top-0 bottom-0 w-[4px] bg-amber-400 shadow-[0_0_12px_#fbbf24] z-10"
                  style={{ left: `calc(${homePercent}% - 2px)` }}
                  animate={{ left: `calc(${homePercent}% - 2px)` }}
                  transition={{ type: 'spring', stiffness: 85, damping: 15 }}
                />
                <motion.div
                  className="h-full bg-gradient-to-l from-rose-600 to-rose-400 flex-grow flex items-center justify-end pr-3"
                  animate={{ width: `${awayPercent}%` }}
                  transition={{ type: 'spring', stiffness: 85, damping: 15 }}
                >
                  <span className="text-[10px] font-mono font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                    {state.awayTeam.slice(0, 3)} {awayPercent}%
                  </span>
                </motion.div>
              </div>

              <div className="flex justify-between text-[10px] font-mono font-bold text-zinc-400">
                <div>
                  <span>{state.homeTeam || 'Home'} Stake: <b className="text-sky-400 font-black">{state.homePool.toFixed(2)} SOL</b></span>
                  <span className="block text-[8px] text-zinc-500">Payout: {argMultiplier}x</span>
                </div>
                <div className="text-right">
                  <span>{state.awayTeam || 'Away'} Stake: <b className="text-rose-400 font-black">{state.awayPool.toFixed(2)} SOL</b></span>
                  <span className="block text-[8px] text-zinc-500">Payout: {egyMultiplier}x</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#141415] border border-zinc-800">
          <div className="p-5 space-y-3.5">
            <div className="flex justify-between items-center">
              <span className="text-[9px] font-mono tracking-[0.2em] font-black text-zinc-400 uppercase">Wallet Profile</span>
              <span className="text-[9px] font-mono text-zinc-500 font-bold">SOLANA DEVNET</span>
            </div>
            {state.walletConnected ? (
              <div className="grid grid-cols-2 gap-px bg-zinc-800">
                <div className="bg-[#0C0C0D] p-4 text-center">
                  <span className="text-[8px] font-mono text-zinc-500 font-bold block uppercase">Balance</span>
                  <span className="text-sm font-mono font-black text-white mt-1.5 block">{state.solBalance.toFixed(2)} SOL</span>
                </div>
                <div className="bg-[#0C0C0D] p-4 text-center">
                  <span className="text-[8px] font-mono text-zinc-500 font-bold block uppercase">Total Cheered</span>
                  <span className="text-sm font-mono font-black text-amber-400 mt-1.5 block">
                    {(state.userStakeHome + state.userStakeAway).toFixed(2)} SOL
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-[#0C0C0D] p-4 text-center space-y-2">
                <p className="text-[10px] font-mono text-zinc-500">Connect wallet to view balance and place stakes</p>
                <button onClick={() => window.dispatchEvent(new CustomEvent('open-wallet-modal'))}
                  className="px-4 py-2 border border-amber-400 text-amber-400 hover:bg-amber-400 hover:text-black font-black text-[9px] uppercase cursor-pointer transition-all">
                  Connect Wallet
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#141415] border border-zinc-800">
          <div className="p-5 space-y-4">
            <span className="text-[9px] font-mono tracking-[0.2em] font-black text-zinc-400 uppercase">Boost Hype Pool</span>
            {!state.walletConnected ? (
              <div className="bg-[#0C0C0D] p-4 text-center space-y-2 border border-zinc-800">
                <p className="text-[10px] font-mono text-zinc-500">Connect wallet to place stakes and earn rewards</p>
                <button onClick={() => window.dispatchEvent(new CustomEvent('open-wallet-modal'))}
                  className="px-4 py-2 border border-amber-400 text-amber-400 hover:bg-amber-400 hover:text-black font-black text-[9px] uppercase cursor-pointer transition-all">
                  Connect Wallet
                </button>
              </div>
            ) : (
              <>
                <AnimatePresence>
                  {state.isConfirmingTx && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="p-4 bg-zinc-950/70 border border-amber-500/30 flex flex-col items-center space-y-3">
                      <RefreshCw className="w-7 h-7 text-amber-400 animate-spin" />
                      <p className="text-xs font-mono font-black text-white uppercase">Confirming Transaction</p>
                    </motion.div>
                  )}
                </AnimatePresence>
                {!state.isConfirmingTx && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-px bg-zinc-800 text-center font-mono text-[10px] font-bold text-zinc-400">
                      <div className="bg-[#0C0C0D] p-3"><span>Your {state.homeTeam.slice(0, 3) || 'Home'} Stake</span>
                        <span className="block text-xs font-black text-sky-400 mt-0.5">{state.userStakeHome.toFixed(2)} SOL</span>
                      </div>
                      <div className="bg-[#0C0C0D] p-3"><span>Your {state.awayTeam.slice(0, 3) || 'Away'} Stake</span>
                        <span className="block text-xs font-black text-rose-400 mt-0.5">{state.userStakeAway.toFixed(2)} SOL</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-px bg-zinc-800">
                      <div className="space-y-2.5 text-center bg-[#141415] p-3">
                        <span className="text-[9px] font-mono font-black text-sky-400 uppercase tracking-widest">
                          {state.homeTeam.slice(0, 3) || 'HOME'}
                        </span>
                        {([0.1, 0.5, 1.0] as number[]).map(amt => (
                          <button key={amt} onClick={() => handleSendTip('home', amt)}
                            className="w-full py-2 bg-sky-950/40 hover:bg-sky-900/60 text-sky-400 border border-sky-900/50 text-xs font-mono font-black cursor-pointer active:scale-[0.96]">
                            +{amt} SOL
                          </button>
                        ))}
                      </div>
                      <div className="space-y-2.5 text-center bg-[#141415] p-3">
                        <span className="text-[9px] font-mono font-black text-rose-400 uppercase tracking-widest">
                          {state.awayTeam.slice(0, 3) || 'AWAY'}
                        </span>
                        {([0.1, 0.5, 1.0] as number[]).map(amt => (
                          <button key={amt} onClick={() => handleSendTip('away', amt)}
                            className="w-full py-2 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-900/50 text-xs font-mono font-black cursor-pointer active:scale-[0.96]">
                            +{amt} SOL
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="bg-[#141415] border border-zinc-800">
          <div className="p-5 space-y-3">
            <span className="text-[9px] font-mono tracking-[0.2em] font-black text-zinc-400 uppercase">Recent Transactions</span>
            <div className="space-y-px">
              {state.txHistory.length === 0 && (
                <p className="text-[10px] font-mono text-zinc-600 py-2">No transactions yet</p>
              )}
              {state.txHistory.slice(0, 8).map((tx) => (
                <div key={tx.id} className="flex justify-between items-center py-1.5 px-2 bg-[#0C0C0D]">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 ${tx.team === 'home' ? 'bg-sky-400' : tx.teamName === 'Claim' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                    <span className="text-[10px] font-mono text-zinc-300">{tx.teamName}</span>
                    <span className="text-[10px] font-mono text-zinc-500">+{tx.amount.toFixed(2)} SOL</span>
                  </div>
                  <a href={`https://solscan.io/tx/${tx.id}?cluster=devnet`} target="_blank" rel="noopener noreferrer"
                    className="text-[8px] font-mono text-amber-400 hover:text-amber-300 underline truncate max-w-[100px]">
                    {tx.sig}...
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>

        <AnimatePresence>
          {state.isSettled && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-gradient-to-b from-[#1E1C15] to-[#121213] border border-amber-400 relative overflow-hidden"
            >
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-amber-400 text-black flex items-center justify-center shrink-0">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[8px] font-mono tracking-widest text-amber-400 font-black uppercase flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> PURSE SETTLED
                    </span>
                    <h3 className="text-sm font-black text-white uppercase tracking-tight">Victory Settlement</h3>
                  </div>
                </div>
                <div className="p-3.5 bg-[#0F0E0D] border border-amber-500/20 font-mono text-[11px] space-y-2">
                  <div className="flex justify-between font-bold">
                    <span className="text-zinc-500">Winner:</span>
                    <span className="text-sky-400 font-black">{state.homeTeam} ({state.homeScore}-{state.awayScore})</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span className="text-zinc-500">Your Stake:</span>
                    <span className="text-sky-400 font-black">{state.userStakeHome.toFixed(2)} SOL</span>
                  </div>
                  <div className="flex justify-between font-bold pt-1.5 border-t border-zinc-900">
                    <span className="text-zinc-400">Total Pooled Purse:</span>
                    <span className="text-zinc-300 font-black">{totalPool.toFixed(2)} SOL</span>
                  </div>
                  <div className="flex justify-between font-bold text-zinc-500 text-[10px]">
                    <span>Platform Fee ({PLATFORM_FEE_PERCENT}%):</span>
                    <span>-{(totalPool * (PLATFORM_FEE_PERCENT / 100)).toFixed(2)} SOL</span>
                  </div>
                </div>
                {!state.isClaimed ? (
                  <button onClick={handleClaimPurse} disabled={state.isClaiming || state.userStakeHome <= 0}
                    className="w-full py-4 bg-amber-400 hover:bg-amber-300 disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-black text-xs uppercase flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]">
                    {state.isClaiming ? (
                      <><RefreshCw className="w-4 h-4 animate-spin" /> Claiming...</>
                    ) : (
                      <><DollarSign className="w-4 h-4" /> Claim Your Victory Share</>
                    )}
                  </button>
                ) : (
                  <div className="p-3 bg-[#0C0C0D] border border-emerald-500/20 text-center">
                    <p className="text-xs font-mono font-black text-emerald-400">CLAIMED!</p>
                    <p className="text-lg font-mono font-black text-white mt-1">+{state.claimedAmount.toFixed(3)} SOL</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
