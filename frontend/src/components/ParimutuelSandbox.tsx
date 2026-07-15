/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { HelpCircle, Percent, Shield, Zap, TrendingUp, Info } from 'lucide-react';
import { useApp } from '../store/AppContext';

interface SandboxProps {
  homePool: number;
  awayPool: number;
}

export default function ParimutuelSandbox({ homePool, awayPool }: SandboxProps) {
  const { state } = useApp();
  const [testMinute, setTestMinute] = useState<number>(30);
  const [testAmount, setTestAmount] = useState<number>(1.0);
  const [selectedTeam, setSelectedTeam] = useState<'home' | 'away'>('home');

  // Math variables
  const platformFeePct = 3.5;
  const distributionPct = 96.5;

  // Formula: Decay Factor starts at 1.5 and decays down to 0.1 at 95'
  // DecayFactor = 1.5 - 1.4 * (minute / 95)
  const decayFactor = Number((1.5 - 1.4 * (testMinute / 95)).toFixed(2));
  const effectiveStake = Number((testAmount * decayFactor).toFixed(2));

  // Current pools
  const totalPool = homePool + awayPool;
  const simulatedTotalPool = totalPool + testAmount;
  
  // Simulated team pool with our test amount
  const isHome = selectedTeam === 'home';
  const simulatedWinnerPool = (isHome ? homePool : awayPool) + testAmount;
  
  // Parimutuel math with time-decay weighting applied:
  // Standard payout without decay: Payout = (Amount / Winning Pool) * (Total Pool * 96.5%)
  // Decayed payout with Early Bird Weighting:
  // Winner pool weight with decay factor applied to our new stake:
  const payoutPool = simulatedTotalPool * (distributionPct / 100);
  
  // To make it fully interactive and realistic:
  // Multiplier = Payout Pool / Simulated Winning Pool (standard parimutuel)
  // Decayed Multiplier = Multiplier * DecayFactor
  const standardMultiplier = simulatedWinnerPool > 0 ? (payoutPool / simulatedWinnerPool) : 1.0;
  const standardPayout = testAmount * standardMultiplier;

  // Decayed payout: reflects early-bird reward or late-entry penalty
  const weightedPayout = testAmount * (standardMultiplier * decayFactor);
  const weightedMultiplier = (standardMultiplier * decayFactor);

  return (
    <div className="bg-[#141415] border border-zinc-800 p-5 rounded-2xl shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-mono font-black tracking-widest text-amber-400 uppercase flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" /> MATH & ODDS DECAY SANDBOX
        </h3>
        <span className="text-[9px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-400 px-2 py-0.5 rounded uppercase font-bold">
          anti-exploit engine
        </span>
      </div>

      <p className="text-[11px] text-zinc-400 leading-normal">
        Test how the Solana smart contract implements a <b>Time-Decayed Weight</b> on late stakes to reward early risk-takers and prevent late-game hedging.
      </p>

      {/* Control sliders */}
      <div className="space-y-3.5 bg-[#0C0C0D] p-4 rounded-xl border border-zinc-900 font-mono text-xs">
        {/* Toggle Team */}
        <div className="flex justify-between items-center">
          <span className="text-zinc-500 font-bold uppercase">1. Test Support Team</span>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedTeam('home')}
              className={`px-3 py-1 rounded text-[10px] font-black uppercase transition-all ${
                selectedTeam === 'home'
                  ? 'bg-sky-500 text-black font-extrabold'
                  : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:text-zinc-300'
              }`}
            >
              {state.homeTeam || 'Home'}
            </button>
            <button
              onClick={() => setSelectedTeam('away')}
              className={`px-3 py-1 rounded text-[10px] font-black uppercase transition-all ${
                selectedTeam === 'away'
                  ? 'bg-rose-500 text-black font-extrabold'
                  : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:text-zinc-300'
              }`}
            >
              {state.awayTeam || 'Away'}
            </button>
          </div>
        </div>

        {/* Stake Slider */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px]">
            <span className="text-zinc-500 font-bold uppercase">2. Test Stake (SOL)</span>
            <span className="text-[#F5F5F5] font-black">{testAmount.toFixed(1)} SOL</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="10.0"
            step="0.1"
            value={testAmount}
            onChange={(e) => setTestAmount(parseFloat(e.target.value))}
            className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
          />
        </div>

        {/* Minute Slider */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px]">
            <span className="text-zinc-500 font-bold uppercase">3. Match Minute</span>
            <span className="text-amber-400 font-black">{testMinute}' Minute</span>
          </div>
          <input
            type="range"
            min="1"
            max="95"
            step="1"
            value={testMinute}
            onChange={(e) => setTestMinute(parseInt(e.target.value))}
            className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
          />
        </div>
      </div>

      {/* Output Metrics */}
      <div className="grid grid-cols-2 gap-3 font-mono">
        <div className="p-3 bg-zinc-900/60 border border-zinc-850 rounded-xl text-center">
          <span className="text-[8px] font-mono text-zinc-500 font-bold block uppercase leading-none">EARLY-BIRD WEIGHT</span>
          <span className={`text-sm font-black mt-1.5 block ${decayFactor > 1.0 ? 'text-emerald-400' : decayFactor < 0.6 ? 'text-rose-400' : 'text-amber-400'}`}>
            {decayFactor}x
          </span>
          <span className="text-[8px] text-zinc-500 block mt-0.5">
            {testMinute < 35 ? 'Early Boost' : testMinute > 75 ? 'Late Dilution' : 'Normal Weight'}
          </span>
        </div>

        <div className="p-3 bg-zinc-900/60 border border-zinc-850 rounded-xl text-center">
          <span className="text-[8px] font-mono text-zinc-500 font-bold block uppercase leading-none">EFFECTIVE STAKE WEIGHT</span>
          <span className="text-sm font-black text-white mt-1.5 block">
            {effectiveStake} SOL
          </span>
          <span className="text-[8px] text-zinc-500 block mt-0.5">
            Real Weight in Pool
          </span>
        </div>
      </div>

      {/* Comparison results */}
      <div className="p-3.5 bg-amber-450/5 border border-amber-500/10 rounded-xl font-mono text-[10px] space-y-2 text-zinc-400">
        <div className="flex justify-between items-center">
          <span className="font-bold flex items-center gap-1"><TrendingUp className="w-3 h-3 text-zinc-500" /> Standard Payout (No Decay):</span>
          <span className="text-zinc-300 font-black">{standardPayout.toFixed(2)} SOL ({standardMultiplier.toFixed(2)}x)</span>
        </div>
        <div className="flex justify-between items-center pt-1.5 border-t border-zinc-850">
          <span className="font-bold text-white flex items-center gap-1"><Zap className="w-3 h-3 text-amber-400" /> Decayed Contract Payout:</span>
          <span className="text-amber-400 font-black">{weightedPayout.toFixed(2)} SOL ({weightedMultiplier.toFixed(2)}x)</span>
        </div>
      </div>
    </div>
  );
}
