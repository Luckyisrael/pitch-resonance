/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, FileText, Heart, Shield, MessageSquare, DollarSign, X, HelpCircle, Code, Star, ExternalLink, Zap } from 'lucide-react';

interface HackathonPortalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HackathonPortal({ isOpen, onClose }: HackathonPortalProps) {
  const [activeTab, setActiveTab] = useState<'pitch' | 'docs' | 'feedback' | 'monetization'>('pitch');

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.7 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#060608] z-50 backdrop-blur-sm"
          />

          {/* Slide-over Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 20, stiffness: 100 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-[#0C0C0E] border-l border-zinc-800 z-50 flex flex-col shadow-2xl overflow-hidden text-zinc-300"
          >
            {/* Header */}
            <div className="p-6 border-b border-zinc-800">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[9px] font-mono tracking-[0.2em] font-black text-amber-400 uppercase block">Hackathon Submission</span>
                  <h2 className="text-sm font-black text-[#F5F5F5] uppercase tracking-tight">Superteam Earn × TxODDS</h2>
                  <div className="w-8 h-[2px] bg-amber-400 mt-1" />
                </div>
                <button onClick={onClose} className="p-1.5 bg-zinc-900 border border-zinc-800 hover:text-white transition-all cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-zinc-800 bg-zinc-950 font-mono text-[10px] uppercase font-bold">
              {[
                { id: 'pitch', label: 'Pitch Deck', icon: Star },
                { id: 'docs', label: 'Tech Docs', icon: Code },
                { id: 'feedback', label: 'Feedback', icon: MessageSquare },
                { id: 'monetization', label: 'Business Model', icon: DollarSign }
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 py-3 px-2 flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                      isActive 
                        ? 'bg-[#141415] text-amber-400 font-black' 
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label.split(' ')[1] || tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar text-[11px] leading-relaxed select-text">
              
              {activeTab === 'pitch' && (
                <div className="space-y-5">
                  <div className="p-4 bg-zinc-900/30 border border-zinc-800 space-y-2">
                    <h3 className="font-mono font-bold text-amber-400 uppercase text-[12px] flex items-center gap-1.5">
                      <Star className="w-4 h-4 text-amber-400" /> THE GRAND PITCH: "3D STADIUM VOLUMETRICS"
                    </h3>
                    <p className="text-zinc-400">
                      Most sports wagering experiences are dry, tabular spreadsheet clones. We built <b>Live Football Match 3D Visualizer</b>—an immersive, high-frequency consumer-facing fan arena that bridges live stadium metadata with parimutuel game theory.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-zinc-800">
                    <div className="p-4 bg-[#0C0C0D] space-y-1.5">
                      <span className="font-mono text-zinc-500 font-bold block uppercase text-[9px]">The Mainstream Fan Gap</span>
                      <p className="text-zinc-400 font-sans leading-relaxed">
                        Mainstream fans hate reading dry statistics. They want to <i>feel</i> the game. Our WebGL canvas deforms physical spatial geometry dynamically in response to on-chain tipping waves, creating beautiful, interactive topographic "pressure waves" that visually mirror game momentum.
                      </p>
                    </div>

                    <div className="p-4 bg-[#0C0C0D] space-y-1.5">
                      <span className="font-mono text-zinc-500 font-bold block uppercase text-[9px]">Solana Seating Alliances</span>
                      <p className="text-zinc-400 font-sans leading-relaxed">
                        We group users into the **Albiceleste 🇦🇷** or **Pharaohs 🇪🇬** Zones. Fans trigger synthetic brass trumpets and drums to create physical ripple disturbances on the WebGL turf, making second-screen viewing a collaborative, multiplayer experience.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <h4 className="font-mono font-black text-[#F5F5F5] uppercase tracking-wider text-[10px]">
                      Judging Criteria Alignment
                    </h4>
                    <div className="space-y-px bg-zinc-800">
                      <div className="flex gap-2 items-start bg-[#0C0C0D] p-3">
                        <span className="text-emerald-400 font-black text-[10px]">✓</span>
                        <p className="text-zinc-400 text-[10px]">
                          <strong className="text-white">Fan Accessibility & UX:</strong> Designed from the ground up for a mobile-first generation. High-fidelity colors, low-latency audio synthesis, and interactive widgets keep engagement high.
                        </p>
                      </div>
                      <div className="flex gap-2 items-start bg-[#0C0C0D] p-3">
                        <span className="text-emerald-400 font-black text-[10px]">✓</span>
                        <p className="text-zinc-400 text-[10px]">
                          <strong className="text-white">Real-Time Responsiveness:</strong> Smooth, seamless 3D rendering updates dynamically with TxLINE events (minutes, goals, team momentum swaps) without lagging or manual refreshing.
                        </p>
                      </div>
                      <div className="flex gap-2 items-start bg-[#0C0C0D] p-3">
                        <span className="text-emerald-400 font-black text-[10px]">✓</span>
                        <p className="text-zinc-400 text-[10px]">
                          <strong className="text-white">Originality:</strong> Merges parimutuel hedging (rewarding early risks with a decay curve) with a gamified 3D tactical pitch deforming to create a new fan entertainment paradigm.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'docs' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <h3 className="font-mono font-bold text-[#F5F5F5] uppercase text-[11px] flex items-center gap-1.5">
                      <Code className="w-4 h-4 text-amber-400" /> SYSTEM ARCHITECTURE
                    </h3>
                    <p className="text-zinc-400 font-sans">
                      Our system couples client-side ThreeJS physics simulations with Solana Anchor contract logic, all driven by real-time feeds mapped to the standardized JSON schemas.
                    </p>
                  </div>

                  {/* Flow chart layout */}
                  <div className="bg-[#0C0C0D] p-4 border border-zinc-900 font-mono text-[9px] space-y-3">
                    <div className="flex justify-between items-center text-center">
                      <div className="p-2 border border-sky-500/20 bg-sky-950/10 text-sky-400 rounded w-1/4 font-bold">
                        TxLINE Oracle Feed
                      </div>
                      <div className="text-zinc-600">➔</div>
                      <div className="p-2 border border-amber-500/20 bg-amber-950/10 text-amber-400 rounded w-2/5 font-bold">
                        Parimutuel Decay Contract
                      </div>
                      <div className="text-zinc-600">➔</div>
                      <div className="p-2 border border-emerald-500/20 bg-emerald-950/10 text-emerald-400 rounded w-1/4 font-bold">
                        WebGL 3D Pitch
                      </div>
                    </div>
                    <p className="text-[9px] text-zinc-500 leading-normal font-sans text-center">
                      The live TxLINE events trigger Solana Program updates. These contract interactions deform the heightmap vertices on the live 3D field mesh, providing visible validation of pool weights.
                    </p>
                  </div>

                  <div className="space-y-3.5">
                    <h4 className="font-mono font-black text-[#F5F5F5] uppercase tracking-wider text-[10px]">
                      Specific TxLINE Endpoints Target Mappings
                    </h4>
                    
                    <div className="space-y-2 font-mono">
                      <div className="p-3 bg-zinc-900/60 rounded-xl border border-zinc-850 space-y-1">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-[#F5F5F5] font-black">GET /api/scores/stream (SSE)</span>
                          <span className="text-[8px] bg-sky-950/60 border border-sky-900/30 text-sky-300 px-1 rounded uppercase font-bold">Live</span>
                        </div>
                        <p className="text-zinc-500 text-[10px] font-sans">
                          Persistent SSE connection that streams real-time match actions (possession, territory, goals). Each event is fed into the PitchGrid parser which converts zone-based positions into a 256×256 pixel heatmap, then into compact physics params for the 3D canvas.
                        </p>
                      </div>

                      <div className="p-3 bg-zinc-900/60 rounded-xl border border-zinc-850 space-y-1">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-[#F5F5F5] font-black">GET /api/scores/historical/&#123;fixtureId&#125;</span>
                          <span className="text-[8px] bg-sky-950/60 border border-sky-900/30 text-sky-300 px-1 rounded uppercase font-bold">In Use</span>
                        </div>
                        <p className="text-zinc-500 text-[10px] font-sans">
                          Batch endpoint used during initial data load. Fetches all events for a completed fixture, replays them through the PitchGrid state machine, and stores the resulting 256×256 frames in SQLite for instant replay.
                        </p>
                      </div>

                      <div className="p-3 bg-zinc-900/60 rounded-xl border border-zinc-850 space-y-1">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-[#F5F5F5] font-black">TxODDS Event Schema → PitchGrid</span>
                          <span className="text-[8px] bg-amber-950/60 border border-amber-900/30 text-amber-300 px-1 rounded uppercase font-bold">Parser</span>
                        </div>
                        <p className="text-zinc-500 text-[10px] font-sans">
                          Raw TxODDS events (safe_possession, attack_possession, shot, goal, corner, etc.) are mapped to 16 pitch zones via the PitchGrid parser. The parser accumulates pixel intensity per zone, computes ball position, possession ratios, and generates a Float32Array pixelData representing the 256×256 heatmap.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'feedback' && (
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <h3 className="font-mono font-bold text-[#F5F5F5] uppercase text-[11px] flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4 text-amber-400" /> TxLINE API DEVELOPER EXPERIENCE REPORT
                    </h3>
                    <p className="text-zinc-400 font-sans">
                      Our engineering squad rigorously integrated the TxLINE API into this client sandbox. Below is our candid feedback regarding the developer experience:
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 bg-emerald-950/10 border border-emerald-900/20 space-y-1">
                      <h4 className="font-mono font-black text-emerald-400 text-[10px] uppercase flex items-center gap-1">
                        ➕ WHAT WE LOVED
                      </h4>
                      <p className="text-zinc-400 font-sans leading-relaxed">
                        **Unified JSON Schema Standardization:** Having a singular, normalized JSON layout across multiple leagues is a game-changer. Most sports feeds represent statistics differently per competition, which leads to bloated parser code. TxLINE allowed us to write a single robust handler for possession, territory grids, and event timelines, reducing our applet maintenance footprint.
                      </p>
                    </div>

                    <div className="p-4 bg-rose-950/10 border border-rose-900/20 space-y-1">
                      <h4 className="font-mono font-black text-rose-400 text-[10px] uppercase flex items-center gap-1">
                        ⚠️ INTEGRATION FRICTION / IMPROVEMENT AREAS
                      </h4>
                      <p className="text-zinc-400 font-sans leading-relaxed">
                        **Sub-second Websocket Latency Requirements:** While HTTP endpoints are highly stable, fast-acting autonomous trading bots (like our *GoalSnatcher-v2*) rely heavily on millisecond timing. If odds updates have even a 1-second lag, bots run the risk of front-running/sandwich exploits. We would love to see TxLINE launch native SSE (Server-Sent Events) or sub-100ms websocket subscription streams specifically for game goals.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'monetization' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <h3 className="font-mono font-bold text-[#F5F5F5] uppercase text-[11px] flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-amber-400" /> COMMERCIALIZATION & MONETIZATION
                    </h3>
                    <p className="text-zinc-400 font-sans">
                      Our parimutuel system has a highly viable, predictable revenue model that avoids the extreme overhead, liabilities, and liquidity risks associated with standard, static-odds betting operations.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-zinc-800 font-mono text-[10px]">
                    <div className="p-4 bg-[#0C0C0D] space-y-1">
                      <span className="text-amber-400 font-black">1. 3.5% Program Commission (Rake)</span>
                      <p className="text-zinc-500 font-sans leading-relaxed">
                        Each time a winning ticket claims their reward from the contract escrow, a locked 3.5% platform fee is programmatically redirected to the protocol Treasury vault.
                      </p>
                    </div>

                    <div className="p-4 bg-[#0C0C0D] space-y-1">
                      <span className="text-sky-400 font-black">2. Autonomous Agent licensing</span>
                      <p className="text-zinc-500 font-sans leading-relaxed">
                        Fans pay a small micro-subscription fee in SOL to deploy our autonomous bots (*GoalSnatcher-v2*), generating a passive SaaS stream for the protocol developers.
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-zinc-900/40 border border-zinc-850">
                    <h4 className="font-mono font-black text-white text-[10px] uppercase mb-1 flex items-center gap-1">
                      <Zap className="w-4 h-4 text-amber-400" /> THE GAME THEORY SUSTAINABILITY ADVANTAGE
                    </h4>
                    <p className="text-zinc-400 font-sans leading-relaxed">
                      Standard sportsbooks lose money when users win big. By implementing a **Time-Decayed Parimutuel Pool**, users back predictions against *each other* rather than the house. The platform carries **zero capital risk**, ensuring that profits scale linearly with overall fan engagement and transaction volumes.
                    </p>
                  </div>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="p-5 border-t border-zinc-850 bg-zinc-950 flex flex-col sm:flex-row gap-3.5 items-center justify-between font-mono text-[9px]">
              <span className="text-zinc-500">
                Created with ♥ for Superteam Earn & TxODDS
              </span>
              <div className="flex gap-4">
                <a 
                  href="https://github.com/txodds" 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-zinc-400 hover:text-[#F5F5F5] flex items-center gap-1 transition-all"
                >
                  TxLINE APIs <ExternalLink className="w-3 h-3" />
                </a>
                <span className="text-zinc-800">|</span>
                <span className="text-amber-400 font-black uppercase">
                  WORLD CUP 2026 SPECIAL
                </span>
              </div>
            </div>

          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
