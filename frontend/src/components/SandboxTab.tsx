import React from 'react'
import { Calculator, Zap } from 'lucide-react'
import { useApp } from '../store/AppContext'
import ParimutuelSandbox from './ParimutuelSandbox'

export default function SandboxTab() {
  const { state } = useApp()

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="bg-[#141415] border border-zinc-800 p-6 rounded-2xl space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-amber-950/30 border border-amber-900/40 flex items-center justify-center">
            <Calculator className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white uppercase tracking-tight">Parimutuel Math Sandbox</h2>
            <p className="text-[10px] font-mono text-zinc-500">Test stake outcomes with time-decayed weighting</p>
          </div>
        </div>
        <p className="text-xs text-zinc-400 leading-relaxed">
          Simulate how the time-decay weight affects your payout. Early stakes receive a multiplier boost;
          late-entry stakes are diluted to reward early risk-takers and prevent end-of-match hedging.
          Adjust the team, stake amount, and match minute to see the math in action.
        </p>
      </div>

      <ParimutuelSandbox homePool={state.homePool} awayPool={state.awayPool} />
    </div>
  )
}
