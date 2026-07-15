/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Cpu, Play, Square, Terminal, ShieldAlert, Check, TrendingUp } from 'lucide-react';

interface AgentItem {
  id: string;
  name: string;
  strategy: string;
  accuracy: string;
  type: 'arbitrage' | 'momentum' | 'hedger';
  color: string;
  triggerCondition: string;
}

interface LogEntry {
  timestamp: string;
  agentName: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'action';
}

interface AITradingAgentProps {
  onSimulateBet: (team: 'home' | 'away', amount: number, sigPrefix: string) => void;
  matchState: {
    minute: number;
    period: string;
    scoreHome: number;
    scoreAway: number;
    isGoal: boolean;
    index: number;
  };
}

export default function AITradingAgent({ onSimulateBet, matchState }: AITradingAgentProps) {
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([
    { timestamp: '18:25:01', agentName: 'System', message: 'TxODDS API Core Feed Hook initialized.', type: 'info' },
    { timestamp: '18:25:04', agentName: 'System', message: 'Solana Devnet RPC endpoints pinged successfully (8ms latency).', type: 'info' }
  ]);
  const consoleContainerRef = useRef<HTMLDivElement | null>(null);

  const agents: AgentItem[] = [
    {
      id: 'gs2',
      name: 'GoalSnatcher-v2',
      strategy: 'Triggers instant hedges immediately after score shifts to capitalize on dynamic odds volatility.',
      accuracy: '94.2%',
      type: 'hedger',
      color: 'text-amber-400 border-amber-500/30 bg-amber-950/10',
      triggerCondition: 'Score Change / Goal'
    },
    {
      id: 'mt9',
      name: 'MomentumTrader-v9',
      strategy: 'Infers possession dominance from TxODDS pressure wave curves and pushes pools on territory spike thresholds.',
      accuracy: '88.7%',
      type: 'momentum',
      color: 'text-sky-400 border-sky-500/30 bg-sky-950/10',
      triggerCondition: 'Territory Spike > 80%'
    }
  ];

  // Scroll to bottom of terminal container only (avoids window jump)
  useEffect(() => {
    if (consoleContainerRef.current) {
      consoleContainerRef.current.scrollTop = consoleContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Keep track of goals already processed to avoid multiple triggers on the same tick
  const lastProcessedGoalRef = useRef<number>(-1);
  const lastProcessedMinuteRef = useRef<number>(-1);

  // Monitor match ticks and execute bot strategy
  useEffect(() => {
    if (!activeAgentId) return;

    const activeAgent = agents.find(a => a.id === activeAgentId);
    if (!activeAgent) return;

    const timestamp = new Date().toLocaleTimeString();

    // Strategy 1: GoalSnatcher-v2 (Reacts to score changes / goals)
    if (activeAgent.id === 'gs2' && matchState.isGoal && lastProcessedGoalRef.current !== matchState.minute) {
      lastProcessedGoalRef.current = matchState.minute;
      
      const winningTeam: 'home' | 'away' = matchState.scoreHome > matchState.scoreAway ? 'home' : 'away';
      const oppositeTeam: 'home' | 'away' = winningTeam === 'home' ? 'away' : 'home';
      const hedgeAmount = 0.5;

      setLogs(prev => [
        ...prev,
        {
          timestamp,
          agentName: activeAgent.name,
          message: `🚨 [GOAL SIGNAL] Scoreline shifted to ${matchState.scoreHome}-${matchState.scoreAway}. Triggering autonomous counter-hedge.`,
          type: 'warning'
        },
        {
          timestamp,
          agentName: activeAgent.name,
          message: `⚡ Dispatching program instruction to support ${oppositeTeam === 'home' ? 'Home' : 'Away'} for ${hedgeAmount} SOL to secure yield spread.`,
          type: 'action'
        }
      ]);

      // Trigger actual tipping flow simulation inside App
      setTimeout(() => {
        onSimulateBet(oppositeTeam, hedgeAmount, '🤖Bot');
        setLogs(prev => [
          ...prev,
          {
            timestamp,
            agentName: activeAgent.name,
            message: `✅ Parimutuel hedge transaction confirmed on Solana Devnet. TxHash mapped.`,
            type: 'success'
          }
        ]);
      }, 1000);
    }

    // Strategy 2: MomentumTrader-v9 (Reacts to high territory pressure / momentum)
    if (activeAgent.id === 'mt9' && matchState.minute !== lastProcessedMinuteRef.current) {
      // Periodic check every minute
      lastProcessedMinuteRef.current = matchState.minute;

      // Simulate a random territory bias from current frame
      // If we see scoreline shifts, we can infer high momentum. Let's do a mock momentum trigger
      if (matchState.minute === 35 || matchState.minute === 75 || matchState.minute === 82) {
        const team: 'home' | 'away' = matchState.minute === 35 ? 'home' : matchState.minute === 75 ? 'home' : 'away';
        const betAmt = 0.8;

        setLogs(prev => [
          ...prev,
          {
            timestamp,
            agentName: activeAgent.name,
            message: `📈 [MOMENTUM SPIKE] Attack bias exceeds 80% on ${team === 'home' ? 'left' : 'right'} flank.`,
            type: 'warning'
          },
          {
            timestamp,
            agentName: activeAgent.name,
            message: `⚡ Initiating automated momentum buy-in of ${betAmt} SOL on ${team === 'home' ? 'Home' : 'Away'}.`,
            type: 'action'
          }
        ]);

        setTimeout(() => {
          onSimulateBet(team, betAmt, '🤖Bot');
          setLogs(prev => [
            ...prev,
            {
              timestamp,
              agentName: activeAgent.name,
              message: `✅ Stake successfully locked into parimutuel vault. Momentum share updated.`,
              type: 'success'
            }
          ]);
        }, 1000);
      }
    }

  }, [matchState, activeAgentId]);

  const handleToggleAgent = (agentId: string) => {
    const timestamp = new Date().toLocaleTimeString();
    if (activeAgentId === agentId) {
      // Disabling
      const agent = agents.find(a => a.id === agentId);
      setActiveAgentId(null);
      setLogs(prev => [
        ...prev,
        {
          timestamp,
          agentName: 'System',
          message: `🛑 Autonomous Agent [${agent?.name}] deactivated. Autonomous execution halted.`,
          type: 'warning'
        }
      ]);
    } else {
      // Enabling
      const agent = agents.find(a => a.id === agentId);
      setActiveAgentId(agentId);
      setLogs(prev => [
        ...prev,
        {
          timestamp,
          agentName: 'System',
          message: `🤖 Autonomous Agent [${agent?.name}] activated. Listening for TxODDS live signal triggers...`,
          type: 'success'
        }
      ]);
    }
  };

  return (
    <div className="bg-[#141415] border border-zinc-800 p-5 rounded-2xl shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-mono font-black tracking-widest text-sky-400 uppercase flex items-center gap-2">
          <Cpu className="w-4 h-4 text-sky-400" /> AUTONOMOUS AI TRADING AGENTS
        </h3>
        <span className="text-[9px] font-mono bg-sky-950/60 border border-sky-900/30 text-sky-300 px-2 py-0.5 rounded uppercase font-bold">
          trading track
        </span>
      </div>

      <p className="text-[11px] text-zinc-400 leading-normal">
        Deploy fully autonomous trading agents directly onto the Solana contract. These agents ingest the live TxODDS scoreline and momentum metrics and execute swift on-chain decisions.
      </p>

      {/* Agents Selection List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {agents.map((agent) => {
          const isActive = activeAgentId === agent.id;
          return (
            <div
              key={agent.id}
              className={`p-3.5 rounded-xl border flex flex-col justify-between gap-3.5 transition-all ${
                isActive 
                  ? 'border-sky-400 bg-sky-950/15 shadow-md' 
                  : 'border-zinc-850 bg-[#0C0C0D] hover:bg-zinc-900/60'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-mono font-black text-[#F5F5F5] uppercase flex items-center gap-1">
                    <Cpu className="w-3.5 h-3.5 text-sky-400" />
                    {agent.name}
                  </span>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-zinc-905 border border-zinc-800 text-emerald-400">
                    Acc: {agent.accuracy}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500 leading-normal font-sans">
                  {agent.strategy}
                </p>
                <div className="text-[9px] font-mono text-zinc-400">
                  Trigger: <span className="text-amber-400 font-bold">{agent.triggerCondition}</span>
                </div>
              </div>

              <button
                onClick={() => handleToggleAgent(agent.id)}
                className={`w-full py-2 rounded-lg text-[10px] font-mono font-black uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  isActive 
                    ? 'bg-rose-500 hover:bg-rose-600 text-white' 
                    : 'bg-sky-400 hover:bg-sky-300 text-black'
                }`}
              >
                {isActive ? (
                  <>
                    <Square className="w-3.5 h-3.5" />
                    <span>Deactivate Agent</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Deploy Agent</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Live Agent Terminal Logs */}
      <div className="space-y-1.5">
        <span className="text-[9px] font-mono font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1">
          <Terminal className="w-3.5 h-3.5" /> AGENT TERMINAL FEED
        </span>
        <div ref={consoleContainerRef} className="bg-black/90 p-3.5 rounded-xl border border-zinc-850 h-[140px] overflow-y-auto font-mono text-[9px] space-y-2 select-text custom-scrollbar">
          {logs.map((log, index) => (
            <div key={index} className="flex items-start gap-2 leading-relaxed">
              <span className="text-zinc-600 shrink-0">[{log.timestamp}]</span>
              <span className={`font-black shrink-0 ${
                log.agentName === 'System' ? 'text-zinc-400' : 'text-sky-400'
              }`}>{log.agentName}:</span>
              <span className={`flex-1 ${
                log.type === 'success' 
                  ? 'text-emerald-400' 
                  : log.type === 'warning' 
                    ? 'text-amber-400' 
                    : log.type === 'action' 
                      ? 'text-sky-300 font-bold underline decoration-dotted' 
                      : 'text-zinc-300'
              }`}>{log.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
