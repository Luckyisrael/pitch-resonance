import React from 'react'
import { Calculator, Zap } from 'lucide-react'
import { useApp } from '../store/AppContext'
import ParimutuelSandbox from './ParimutuelSandbox'

export default function SandboxTab() {
  const { state } = useApp()

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="border border-zinc-800">
        <div className="bg-[#111112] p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-amber-400 shrink-0" />
            <span className="text-[9px] font-mono tracking-[0.2em] font-black text-amber-400 uppercase">Parimutuel Sandbox</span>
          </div>
          <h2 className="text-lg font-black text-white uppercase tracking-tight">MATH &amp; ODDS DECAY</h2>
          <p className="text-xs text-zinc-500 leading-relaxed max-w-lg">
            Simulate how the time-decay weight affects your payout. Early stakes receive a multiplier boost;
            late-entry stakes are diluted to reward early risk-takers and prevent end-of-match hedging.
          </p>
        </div>
      </div>

      <ParimutuelSandbox homePool={state.homePool} awayPool={state.awayPool} />
    </div>
  )
}
