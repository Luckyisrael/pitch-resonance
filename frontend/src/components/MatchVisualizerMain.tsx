import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play, Pause, FastForward, SkipBack, Sparkles,
  Volume2, VolumeX, RefreshCw, BarChart2, Award,
  AlertCircle, Database, Server, Tv
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { useApp } from '../store/AppContext';
import Match3DCanvas from './Match3DCanvas';
import type { PhysicsFrame, TimelineFrame } from '../store/types';

function physicsToTimeline(p: PhysicsFrame, homeTeam: string, awayTeam: string, index: number): TimelineFrame {
  const ballX3d = p.ballX !== undefined ? (p.ballX / 255.0 - 0.5) * 18.0 : undefined;
  const ballZ3d = p.ballY !== undefined ? (p.ballY / 255.0 - 0.5) * 12.0 : undefined;
  const q = p.quadrants || [0.25, 0.25, 0.25, 0.25];
  const turfAmp = p.turfAmplitude ?? 0.4;
  const clockSec = p.clockSec ?? index * 10;
  const minute = Math.floor(clockSec / 60);
  const timeString = `${Math.floor(clockSec / 60)}:${Math.floor(clockSec % 60).toString().padStart(2, '0')}`;
  const isGoal = p.action === 'goal';
  const action = p.action ?? null;

  const possessionAdvantage = ((p.possession ?? 50) - 50) / 50;
  const combined = (p.territoryFactor ?? 0) * 0.6 + possessionAdvantage * 0.4;
  let attackDirection: TimelineFrame['attackDirection'] = 'neutral';
  if (combined > 0.1 || (p.ballX > 170 && (p.territoryFactor ?? 0) > 0)) attackDirection = 'home';
  else if (combined < -0.1 || (p.ballX < 85 && (p.territoryFactor ?? 0) < 0)) attackDirection = 'away';

  const period = p.phase === 1 ? '1st Half' : p.phase === 5 ? 'Half Time' : p.phase === 9 ? '2nd Half' : p.phase === 13 ? 'Full Time' : 'Live Play';

  const isCorner = action === 'corner';
  const isFoul = action === 'foul';
  const isCard = action === 'yellow_card' || action === 'red_card';
  const cardType: TimelineFrame['cardType'] = action === 'red_card' ? 'red' : action === 'yellow_card' ? 'yellow' : null;
  const cardTeam: TimelineFrame['cardTeam'] = isCard ? (p.team === 0 ? 'home' : 'away') : null;

  const buildupIntensity = Math.min(1, (p.attackIntensity ?? 0) + (isGoal ? 0.5 : isCorner ? 0.3 : 0));
  const momentumDirection = Math.atan2(p.momentumVector?.y ?? 0, p.momentumVector?.x ?? 0);

  return {
    minute,
    timeString,
    period,
    scoreHome: p.homeScore ?? 0,
    scoreAway: p.awayScore ?? 0,
    isGoal,
    goalEvent: isGoal ? {
      minute,
      scorer: p.team === 0 ? `${homeTeam} Goal` : `${awayTeam} Goal`,
      team: p.team === 0 ? 'home' as const : 'away' as const,
      teamName: p.team === 0 ? homeTeam : awayTeam,
    } : undefined,
    territoryCenter: (p.territoryFactor ?? 0) * 0.5,
    leftHeight: Math.min(1.0, turfAmp * (q[0] + q[2]) * 2.0),
    rightHeight: Math.min(1.0, turfAmp * (q[1] + q[3]) * 2.0),
    attackDirection,
    ballX3d,
    ballZ3d,
    lastAction: action,
    lastActionTeam: p.team === 0 ? 'home' : p.team === 1 ? 'away' : null,
    shotPower: p.shotPower ?? 0,
    isCorner,
    isFoul,
    isCard,
    cardType,
    cardTeam,
    buildupIntensity,
    momentumDirection,
    waveFrequency: p.waveFrequency ?? 0,
    waveAngle: p.waveAngle ?? 0,
    rippleAge: p.rippleAge ?? 1,
    turfAmplitude: turfAmp,
    ballVelX: p.smoothBallVelX ?? p.ballVelX ?? 0,
    ballVelY: p.smoothBallVelY ?? p.ballVelY ?? 0,
    ballSpeed: p.smoothBallSpeed ?? p.ballSpeed ?? 0,
    homeMomentum: p.homeMomentum ?? 0,
    awayMomentum: p.awayMomentum ?? 0,
    momentumShift: p.momentumShift ?? 0,
    homePressure: p.homePressure ?? 0,
    awayPressure: p.awayPressure ?? 0,
    smoothBallVelX: p.smoothBallVelX ?? 0,
    smoothBallVelY: p.smoothBallVelY ?? 0,
    smoothBallSpeed: p.smoothBallSpeed ?? 0,
    matchIntensity: p.matchIntensity ?? 0,
    matchFlowMultiplier: p.matchFlowMultiplier ?? 1.0,
    stats: {
      xgHome: parseFloat(((p.homeScore ?? 0) * 1.1 + (p.territoryFactor > 0 ? p.territoryFactor * 0.4 : 0)).toFixed(2)),
      xgAway: parseFloat(((p.awayScore ?? 0) * 1.1 + (p.territoryFactor < 0 ? -p.territoryFactor * 0.4 : 0)).toFixed(2)),
      shotsHome: p.shotsHome ?? Math.max(p.homeScore ?? 0, Math.floor(minute / 8) + ((p.territoryFactor ?? 0) > 0 ? 3 : 1)),
      shotsAway: p.shotsAway ?? Math.max(p.awayScore ?? 0, Math.floor(minute / 9) + ((p.territoryFactor ?? 0) < 0 ? 3 : 1)),
      cornersHome: p.cornersHome ?? Math.floor(minute / 18) + ((p.territoryFactor ?? 0) > 0 ? 2 : 0),
      cornersAway: p.cornersAway ?? Math.floor(minute / 20) + ((p.territoryFactor ?? 0) < 0 ? 2 : 0),
      cardsHome: (p.homeYellowCards ?? 0) + (p.homeRedCards ?? 0),
      cardsAway: (p.awayYellowCards ?? 0) + (p.awayRedCards ?? 0),
      foulsHome: p.foulsHome ?? 0,
      foulsAway: p.foulsAway ?? 0,
      homeYellowCards: p.homeYellowCards ?? 0,
      homeRedCards: p.homeRedCards ?? 0,
      awayYellowCards: p.awayYellowCards ?? 0,
      awayRedCards: p.awayRedCards ?? 0,
    },
  };
}

function physicsToTimelineFrames(frames: PhysicsFrame[], homeTeam: string, awayTeam: string): TimelineFrame[] {
  return frames.map((f, i) => physicsToTimeline(f, homeTeam, awayTeam, i));
}

export default function MatchVisualizerMain({ compact }: { compact?: boolean }) {
  const { state, dispatch, fetchAndSetFixtures, fetchAndSetFrames, connectSocket } = useApp();

  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isSoundOn, setIsSoundOn] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const [frameProgress, setFrameProgress] = useState(0);

  const timelineRef = useRef<TimelineFrame[]>([]);
  const [timeline, setTimeline] = useState<TimelineFrame[]>([]);
  const socketRef = useRef<Socket | null>(null);

  // Fetch fixtures on mount
  useEffect(() => {
    fetchAndSetFixtures();
  }, []);

  // Fetch frames when match selected
  useEffect(() => {
    if (state.selectedMatchId && state.fixtures.length > 0) {
      fetchAndSetFrames(state.selectedMatchId);
    }
  }, [state.selectedMatchId]);

  // Convert physics frames to timeline frames
  useEffect(() => {
    if (state.physicsFrames.length > 0) {
      const t = physicsToTimelineFrames(state.physicsFrames, state.homeTeam, state.awayTeam);
      timelineRef.current = t;
      setTimeline(t);
      setCurrentFrameIndex(0);
      setFrameProgress(0);
    }
  }, [state.physicsFrames, state.homeTeam, state.awayTeam]);

  // Connect socket for live frames
  useEffect(() => {
    if (!state.selectedMatchId) return;
    const socket = connectSocket();
    socketRef.current = socket;

    socket.on('pitch:physics_frame', (frame: PhysicsFrame) => {
      const newFrame = physicsToTimeline(frame, state.homeTeam, state.awayTeam, timelineRef.current.length);
      timelineRef.current = [...timelineRef.current, newFrame];
      setTimeline(prev => {
        if (prev.some(f => f.timeString === newFrame.timeString && f.scoreHome === newFrame.scoreHome && f.scoreAway === newFrame.scoreAway)) return prev;
        const updated = [...prev, newFrame];
        setCurrentFrameIndex(updated.length - 1);
        setFrameProgress(0);
        return updated;
      });
    });

    socket.on('shockwave:trigger', (data: any) => {
      const x = (data.originX / 255.0 - 0.5) * 18.0;
      const z = (data.originY / 255.0 - 0.5) * 12.0;
      window.dispatchEvent(new CustomEvent('shockwave-trigger', { detail: { x, z, intensity: data.intensity ?? 1.5 } }));
    });

    return () => { socket.disconnect(); };
  }, [state.selectedMatchId]);

  const currentFrame = timeline[currentFrameIndex] || timeline[0] || {
    minute: 0, timeString: "0'", period: '--', scoreHome: 0, scoreAway: 0, isGoal: false,
    territoryCenter: 0, leftHeight: 0.4, rightHeight: 0.4, attackDirection: 'neutral' as const,
    lastAction: null, lastActionTeam: null, shotPower: 0,
    isCorner: false, isFoul: false, isCard: false, cardType: null, cardTeam: null,
    buildupIntensity: 0, momentumDirection: 0,
    waveFrequency: 0, waveAngle: 0, rippleAge: 1, turfAmplitude: 0.4,
    ballVelX: 0, ballVelY: 0, ballSpeed: 0,
    homeMomentum: 0, awayMomentum: 0, momentumShift: 0,
    homePressure: 0, awayPressure: 0,
    smoothBallVelX: 0, smoothBallVelY: 0, smoothBallSpeed: 0,
    matchIntensity: 0, matchFlowMultiplier: 1.0,
    stats: { xgHome: 0, xgAway: 0, shotsHome: 0, shotsAway: 0, cornersHome: 0, cornersAway: 0, cardsHome: 0, cardsAway: 0, foulsHome: 0, foulsAway: 0, homeYellowCards: 0, homeRedCards: 0, awayYellowCards: 0, awayRedCards: 0 },
  };
  const nextFrame = timeline[currentFrameIndex + 1];
  const isMatchFinished = currentFrameIndex === timeline.length - 1 && !isPlaying;
  const interpCenter = currentFrameIndex < timeline.length - 1 && nextFrame
    ? (currentFrame.territoryCenter + (nextFrame.territoryCenter - currentFrame.territoryCenter) * frameProgress)
    : currentFrame.territoryCenter;

  // Sound effect
  const playSound = (type: 'goal' | 'tick') => {
    if (!isSoundOn) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (type === 'goal') {
        const osc = ctx.createOscillator(), osc2 = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = 'sawtooth'; osc2.type = 'triangle';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.15);
        osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 1.2);
        osc2.frequency.setValueAtTime(75, ctx.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.2);
        osc2.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 1.5);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.8);
        osc.connect(gain); osc2.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc2.start(); osc.stop(ctx.currentTime + 1.8); osc2.stop(ctx.currentTime + 1.8);
      } else {
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(620, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.08);
      }
    } catch {}
  };

  // Auto-show stats at end
  useEffect(() => {
    setShowStats(currentFrame.period === 'Full Time');
  }, [currentFrameIndex, currentFrame]);

  // Dispatch match-tick events
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('match-tick', {
      detail: {
        minute: currentFrame.minute, period: currentFrame.period,
        scoreHome: currentFrame.scoreHome, scoreAway: currentFrame.scoreAway,
        isGoal: currentFrame.isGoal, index: currentFrameIndex,
      },
    }));
  }, [currentFrameIndex, currentFrame]);

  // Playback loop
  useEffect(() => {
    if (!isPlaying || timeline.length === 0) return;
    const steps = 40;
    const intervalMs = (2800 / playbackSpeed) / steps;
    let currentStep = Math.floor(frameProgress * steps);

    const id = setInterval(() => {
      currentStep++;
      setFrameProgress(currentStep / steps);
      if (currentStep >= steps) {
        setCurrentFrameIndex(prev => {
          if (prev >= timeline.length - 1) { setIsPlaying(false); setFrameProgress(0); return prev; }
          const next = prev + 1;
          if (timeline[next]?.isGoal) playSound('goal'); else playSound('tick');
          return next;
        });
        currentStep = 0;
        setFrameProgress(0);
      }
    }, intervalMs);
    return () => clearInterval(id);
  }, [isPlaying, currentFrameIndex, playbackSpeed, isSoundOn, timeline]);

  const handleNext = () => {
    setIsPlaying(false); setFrameProgress(0);
    setCurrentFrameIndex(prev => {
      const next = prev >= timeline.length - 1 ? prev : prev + 1;
      if (timeline[next]?.isGoal) playSound('goal'); else playSound('tick');
      return next;
    });
  };

  const handlePrev = () => {
    setIsPlaying(false); setFrameProgress(0);
    setCurrentFrameIndex(prev => { playSound('tick'); return prev === 0 ? 0 : prev - 1; });
  };

  const togglePlay = () => {
    if (currentFrameIndex >= timeline.length - 1) {
      setCurrentFrameIndex(0); setFrameProgress(0); setIsPlaying(true);
    } else setIsPlaying(!isPlaying);
    playSound('tick');
  };

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
  };
  const getFlag = (name: string) => {
    const k = Object.keys(COUNTRY_FLAGS).find(key => key.toLowerCase() === name.toLowerCase() || name.toLowerCase().includes(key.toLowerCase()));
    return k ? COUNTRY_FLAGS[k] : '🏳️';
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 font-sans">
      {!compact && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-[#141414] border border-zinc-800 p-6 rounded-2xl relative overflow-hidden shadow-2xl">
          <div className="md:col-span-8 space-y-3 text-center md:text-left">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
              {(() => {
                const sel = state.fixtures.find(f => f.matchId === state.selectedMatchId);
                const isLiveFeed = sel?.isLive;
                if (isLiveFeed) {
                  return (
                    <span className="inline-flex items-center gap-1.5 bg-emerald-950/80 text-emerald-400 text-[10px] font-bold tracking-widest px-3 py-1 rounded border border-emerald-900/60 uppercase">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      TXLINE LIVE
                    </span>
                  );
                }
                return (
                  <span className="inline-flex items-center gap-1.5 bg-sky-950/80 text-sky-400 text-[10px] font-bold tracking-widest px-3 py-1 rounded border border-sky-900/60 uppercase">
                    <Database className="w-3 h-3" />
                    HISTORICAL REPLAY
                  </span>
                );
              })()}
              <span className="text-zinc-500 font-mono text-[9px] font-medium tracking-widest uppercase border-l border-zinc-800 pl-3">
                TACTICAL COMPANION • VOLUMETRIC MODEL
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight uppercase leading-none">PITCH RESONANCE</h1>
            <p className="text-xs font-mono text-zinc-500 tracking-wider uppercase">
              Tactical 3D Visualizer <span className="text-amber-400 font-bold">//</span> Real-Time Position Grid
            </p>
          </div>
          <div className="md:col-span-4 flex flex-col items-center md:items-end justify-center gap-3">
            <div className="flex gap-2">
              <button onClick={() => setIsSoundOn(!isSoundOn)}
                className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-2 font-mono text-[10px] tracking-wider uppercase ${
                  isSoundOn ? 'bg-amber-400 text-black border-amber-400 font-bold' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                }`}>
                {isSoundOn ? <Volume2 className="w-3.5 h-3.5 text-black" /> : <VolumeX className="w-3.5 h-3.5" />}
                <span>{isSoundOn ? 'Synth' : 'Muted'}</span>
              </button>
            </div>
            <button onClick={() => { setCurrentFrameIndex(0); setFrameProgress(0); setIsPlaying(true); playSound('tick'); }}
              className="px-4 py-2 bg-zinc-900 hover:bg-[#202020] text-white border border-zinc-800 rounded-lg text-[10px] font-mono tracking-wider uppercase flex items-center gap-2 cursor-pointer transition-all">
              <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
              <span>Reset Grid</span>
            </button>
          </div>
        </div>
      )}

      {!compact && (
        <div className="p-4 bg-[#141414] border border-zinc-800 rounded-2xl shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-950/50 border border-purple-900/40 text-purple-400 flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black text-white uppercase font-sans tracking-tight">World Cup 2026 Fixtures</h4>
              <p className="text-[10px] text-zinc-500 font-mono">{state.fixtures.length} matches loaded from database</p>
            </div>
          </div>
          <div className="flex-grow max-w-md flex items-center gap-2.5">
            {state.loadingFixtures ? (
              <div className="text-xs font-mono text-zinc-500 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Loading matches...</span>
              </div>
            ) : (
              <select
                value={state.selectedMatchId || ''}
                onChange={(e) => {
                  dispatch({ type: 'SET_SELECTED_MATCH', id: e.target.value });
                  playSound('tick');
                }}
                className="w-full bg-[#1e1e20] border border-zinc-800 text-white rounded-xl text-xs p-2.5 font-sans focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                {state.fixtures.map(f => (
                  <option key={f.matchId} value={f.matchId}>
                    {getFlag(f.homeTeam)} {f.homeTeam} vs {getFlag(f.awayTeam)} {f.awayTeam} ({f.homeScore}-{f.awayScore})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Network error (non-404) — backend unreachable */}
      {state.errorMsg && (
        <div className="p-4 bg-red-950/20 border border-red-900/30 text-red-400 text-xs rounded-xl flex items-start gap-2.5 font-mono">
          <AlertCircle className="w-4.5 h-4.5 shrink-0 text-red-500 mt-0.5" />
          <div><b>Backend Unreachable:</b> {state.errorMsg}</div>
        </div>
      )}

      {/* Loading states */}
      {state.loadingFixtures && (
        <div className="p-8 flex flex-col items-center justify-center gap-4 text-center">
          <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
            <RefreshCw className="w-5 h-5 text-amber-400 animate-spin" />
          </div>
          <div>
            <p className="text-sm font-black text-zinc-400 uppercase tracking-wider">Loading Matches</p>
            <p className="text-[10px] font-mono text-zinc-600 mt-1">Fetching available fixtures from the database...</p>
          </div>
        </div>
      )}

      {state.loadingFrames && (
        <div className="p-8 flex flex-col items-center justify-center gap-4 text-center">
          <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
            <RefreshCw className="w-5 h-5 text-amber-400 animate-spin" />
          </div>
          <div>
            <p className="text-sm font-black text-zinc-400 uppercase tracking-wider">Loading Frames</p>
            <p className="text-[10px] font-mono text-zinc-600 mt-1">Retrieving physics telemetry for this match...</p>
          </div>
        </div>
      )}

      {/* 3D Canvas + Controls */}
      {timeline.length > 0 && (
        <>
          <div className={`relative rounded-3xl overflow-hidden transition-all duration-75 ${
            currentFrame.isGoal ? (currentFrame.goalEvent?.team === 'home' ? 'ring-[6px] ring-sky-400' : 'ring-[6px] ring-rose-400') : ''
          }`}>
            {/* Scoreboard overlay */}
            <div className="absolute top-5 left-5 right-5 z-20 flex justify-between items-start pointer-events-none">
              <div className="flex flex-col gap-2 bg-[#1E1E1E]/90 backdrop-blur-md border border-zinc-800 p-3.5 px-4 rounded-xl pointer-events-auto shadow-xl min-w-[200px]">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{getFlag(state.homeTeam)}</span>
                    <span className="text-white font-mono text-xs font-black tracking-wider uppercase">{state.homeTeam.slice(0, 3)}</span>
                  </div>
                  <span className="text-zinc-500 font-black text-[10px] uppercase tracking-wider">VS</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-mono text-xs font-black tracking-wider uppercase">{state.awayTeam.slice(0, 3)}</span>
                    <span className="text-xl">{getFlag(state.awayTeam)}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center px-1 font-mono font-black text-3xl text-white tracking-widest leading-none">
                  <span className={currentFrame.scoreHome > 0 ? 'text-sky-400' : 'text-white'}>{currentFrame.scoreHome}</span>
                  <span className="text-zinc-500 text-lg mx-2">:</span>
                  <span className={currentFrame.scoreAway > 0 ? 'text-rose-400' : 'text-white'}>{currentFrame.scoreAway}</span>
                </div>
                <div className="flex justify-between text-[9px] font-mono text-zinc-500 uppercase font-bold">
                  <span>{currentFrame.period}</span>
                  <span>{currentFrame.timeString}</span>
                </div>
              </div>

              {/* Stats panel */}
              {showStats && (
                <div className="bg-[#1E1E1E]/90 backdrop-blur-md border border-zinc-800 p-3.5 rounded-xl pointer-events-auto shadow-xl min-w-[160px]">
                  <div className="text-[9px] font-mono text-amber-400 uppercase font-black mb-2 text-center">Match Stats</div>
                  <div className="space-y-1.5 font-mono text-[10px]">
                    {[{ label: 'xG', h: currentFrame.stats.xgHome.toFixed(2), a: currentFrame.stats.xgAway.toFixed(2) },
                      { label: 'Shots', h: currentFrame.stats.shotsHome.toString(), a: currentFrame.stats.shotsAway.toString() },
                      { label: 'Corners', h: currentFrame.stats.cornersHome.toString(), a: currentFrame.stats.cornersAway.toString() },
                      { label: 'Fouls', h: currentFrame.stats.foulsHome.toString(), a: currentFrame.stats.foulsAway.toString() },
                      { label: 'Cards', h: `${currentFrame.stats.homeYellowCards}🟨${currentFrame.stats.homeRedCards}🟥`, a: `${currentFrame.stats.awayYellowCards}🟨${currentFrame.stats.awayRedCards}🟥` },
                    ].map(s => (
                      <div key={s.label} className="flex justify-between items-center">
                        <span className="text-sky-400 w-8 text-right">{s.h}</span>
                        <span className="text-zinc-500 w-6 text-center text-[8px]">{s.label}</span>
                        <span className="text-rose-400 w-8">{s.a}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Match3DCanvas
              currentFrame={currentFrame as any}
              playbackProgress={frameProgress}
              nextFrame={nextFrame as any}
            />

            {/* Goal flash overlay — pulsing team color + GOOOOOAL! modal */}
            <AnimatePresence>
              {currentFrame.isGoal && (
                <>
                  <motion.div
                    initial={{ opacity: 0.7 }} animate={{ opacity: [0.7, 0.3, 0.5, 0.0] }}
                    transition={{ duration: 1.5, ease: 'easeOut' }}
                    className={`absolute inset-0 pointer-events-none z-10 ${
                      currentFrame.goalEvent?.team === 'home' ? 'bg-sky-500' : 'bg-rose-500'
                    }`}
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: [0, 1, 1, 0], scale: [0.6, 1.1, 1.0, 0.95] }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 1.5, ease: 'easeOut' }}
                    className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none"
                  >
                    <div className={`text-5xl font-black tracking-widest ${
                      currentFrame.goalEvent?.team === 'home' ? 'text-sky-300' : 'text-rose-300'
                    }`} style={{ textShadow: '0 0 40px rgba(0,0,0,0.8), 0 0 80px rgba(0,0,0,0.4)' }}>
                      GOOOOOAL!
                    </div>
                    {currentFrame.goalEvent?.scorer && (
                      <div className="mt-3 text-base font-bold text-white/80 uppercase tracking-wider"
                           style={{ textShadow: '0 2px 8px rgba(0,0,0,0.9)' }}>
                        {currentFrame.goalEvent.scorer}
                      </div>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Momentum/Pressure indicators */}
          <div className="flex items-center gap-3 px-1">
            <div className="flex-1 flex items-center gap-2">
              <span className="text-[10px] font-mono text-sky-400 w-8 text-right font-bold">{Math.round(currentFrame.homePressure * 100)}%</span>
              <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-sky-600 to-sky-400 rounded-full"
                  animate={{ width: `${currentFrame.homePressure * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
            <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Pressure</span>
            <div className="flex-1 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-rose-400 to-rose-600 rounded-full"
                  animate={{ width: `${currentFrame.awayPressure * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <span className="text-[10px] font-mono text-rose-400 w-8 font-bold">{Math.round(currentFrame.awayPressure * 100)}%</span>
            </div>
          </div>

          {/* TV-style live commentary bar with event descriptions */}
          <div className="bg-zinc-900/95 border border-zinc-800 rounded-xl px-4 py-2 flex items-center gap-3 overflow-hidden">
            <span className="flex-shrink-0 flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider whitespace-nowrap flex-shrink-0">
              {currentFrame.timeString}
            </span>
            <div className="w-px h-3 bg-zinc-700 flex-shrink-0" />
            <span className={`text-[11px] font-mono truncate ${
              currentFrame.isGoal ? 'text-amber-400 font-bold' :
              currentFrame.isCard ? 'text-red-400 font-bold' :
              currentFrame.isCorner ? 'text-orange-400' :
              currentFrame.shotPower > 0.5 ? 'text-amber-300' :
              'text-zinc-300'
            }`}>
              {(() => {
                const action = currentFrame.lastAction;
                const team = currentFrame.lastActionTeam === 'home'
                  ? (state.fixtures.find(f => f.matchId === state.selectedMatchId)?.homeTeam?.substring(0, 12) || 'Home')
                  : currentFrame.lastActionTeam === 'away'
                  ? (state.fixtures.find(f => f.matchId === state.selectedMatchId)?.awayTeam?.substring(0, 12) || 'Away')
                  : '';
                const teamColor = currentFrame.lastActionTeam === 'home' ? 'text-sky-400' : 'text-rose-400';
                if (currentFrame.isGoal) return <>{team} <span className="text-amber-400 font-black">GOAL!</span></>;
                if (action === 'shot') return <>{team} fires a shot!</>;
                if (action === 'corner') return <>Corner kick for {team}</>;
                if (action === 'foul') return <>Foul by {team}</>;
                if (action === 'yellow_card') return <><span className="text-yellow-400">Yellow card!</span> {team} booked</>;
                if (action === 'red_card') return <><span className="text-red-400 font-bold">RED CARD!</span> {team} reduced</>;
                if (action === 'danger_possession' || action === 'high_danger_possession') return <>{team} in a dangerous position!</>;
                if (action === 'attack_possession') return <>{team} pushing forward</>;
                if (action === 'safe_possession') return <>{team} maintaining possession</>;
                if (action === 'clearance') return <>{team} clears the danger</>;
                if (action === 'dribble') return <>{team} on the dribble</>;
                if (action === 'free_kick') return <>Free kick for {team}</>;
                return <span className="text-zinc-400">Buildup play continues</span>;
              })()}
            </span>
            {currentFrame.momentumShift > 0.3 && (
              <span className="text-[9px] font-mono text-amber-400 animate-pulse flex-shrink-0">MOMENTUM SHIFT</span>
            )}
          </div>

          {/* Stats overlay */}
          <AnimatePresence>
            {showStats && (
              <motion.div
                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="bg-zinc-900/95 border border-zinc-800 rounded-xl px-4 py-3 grid grid-cols-2 gap-x-8 gap-y-1 text-[10px] font-mono"
              >
                <div className="col-span-2 text-center text-zinc-500 uppercase tracking-widest mb-1">Match Stats</div>
                <div className="flex justify-between text-sky-400"><span>xG</span><span className="font-bold">{currentFrame.stats.xgHome.toFixed(2)}</span></div>
                <div className="flex justify-between text-rose-400"><span>xG</span><span className="font-bold">{currentFrame.stats.xgAway.toFixed(2)}</span></div>
                <div className="flex justify-between text-sky-400"><span>Shots</span><span>{currentFrame.stats.shotsHome}</span></div>
                <div className="flex justify-between text-rose-400"><span>Shots</span><span>{currentFrame.stats.shotsAway}</span></div>
                <div className="flex justify-between text-sky-400"><span>Corners</span><span>{currentFrame.stats.cornersHome}</span></div>
                <div className="flex justify-between text-rose-400"><span>Corners</span><span>{currentFrame.stats.cornersAway}</span></div>
                <div className="flex justify-between text-sky-400"><span>Fouls</span><span>{currentFrame.stats.foulsHome}</span></div>
                <div className="flex justify-between text-rose-400"><span>Fouls</span><span>{currentFrame.stats.foulsAway}</span></div>
                <div className="flex justify-between text-sky-400"><span>Cards</span><span>{currentFrame.stats.homeYellowCards}Y {currentFrame.stats.homeRedCards}R</span></div>
                <div className="flex justify-between text-rose-400"><span>Cards</span><span>{currentFrame.stats.awayYellowCards}Y {currentFrame.stats.awayRedCards}R</span></div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Playback controls */}
          <div className="bg-[#141415] border border-zinc-800 p-4 rounded-2xl flex flex-col gap-3 shadow-xl">
            {/* Timeline scrubber */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-zinc-500 w-10 text-right">{currentFrame.timeString}</span>
              <input
                type="range"
                min={0}
                max={Math.max(0, timeline.length - 1)}
                value={currentFrameIndex}
                onChange={(e) => {
                  const idx = parseInt(e.target.value);
                  setIsPlaying(false);
                  setFrameProgress(0);
                  setCurrentFrameIndex(idx);
                  playSound('tick');
                }}
                className="flex-1 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
              <span className="text-[10px] font-mono text-zinc-500 w-10">
                {timeline.length > 0 ? timeline[timeline.length - 1].timeString : '0:00'}
              </span>
            </div>

            <div className="flex items-center justify-center gap-3">
              <button onClick={handlePrev} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-white cursor-pointer transition-all">
                <SkipBack className="w-4 h-4" />
              </button>
              <button onClick={togglePlay}
                className="p-3 bg-amber-400 hover:bg-amber-300 text-black rounded-xl cursor-pointer transition-all active:scale-95">
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : currentFrameIndex >= timeline.length - 1
                  ? <RefreshCw className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
              </button>
              <button onClick={handleNext} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-white cursor-pointer transition-all">
                <FastForward className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1 ml-4 text-[10px] font-mono text-zinc-500">
                <FastForward className="w-3 h-3" />
                {[0.5, 1, 2, 4].map(s => (
                  <button key={s} onClick={() => setPlaybackSpeed(s)}
                    className={`px-2 py-1 rounded ${playbackSpeed === s ? 'bg-amber-400 text-black font-black' : 'text-zinc-400 hover:text-white'} cursor-pointer transition-all`}>
                    {s}x
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1 ml-2">
                <button onClick={() => setShowStats(!showStats)}
                  className={`p-2 rounded-xl cursor-pointer transition-all ${showStats ? 'bg-amber-400 text-black' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}>
                  <BarChart2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Empty / no-frames state */}
      {timeline.length === 0 && !state.loadingFrames && !state.loadingFixtures && (
        <div className="bg-[#141415] border border-zinc-800 p-10 rounded-2xl text-center">
          {(() => {
            const selectedFixture = state.fixtures.find(f => f.matchId === state.selectedMatchId);
            if (selectedFixture?.isLive) {
              return (
                <>
                  <div className="w-14 h-14 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-4">
                    <span className="flex h-3 w-3 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                    </span>
                  </div>
                  <h3 className="text-sm font-black text-zinc-400 uppercase tracking-wider">Waiting for Live Telemetry</h3>
                  <p className="text-[10px] font-mono text-zinc-600 mt-2 max-w-md mx-auto">
                    The live match is active. Physics frames will appear here once the simulation begins broadcasting.
                  </p>
                </>
              );
            }
            if (state.noFramesFallback) {
              return (
                <>
                  <Server className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
                  <h3 className="text-sm font-black text-zinc-400 uppercase tracking-wider">No Frames for This Match</h3>
                  <p className="text-[10px] font-mono text-zinc-600 mt-2 max-w-md mx-auto">
                    Physics telemetry hasn't been loaded for this fixture yet. Select a different match from the dropdown to explore its 3D pitch data.
                  </p>
                </>
              );
            }
            return (
              <>
                <Tv className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
                <h3 className="text-sm font-black text-zinc-400 uppercase tracking-wider">Select a Match</h3>
                <p className="text-[10px] font-mono text-zinc-600 mt-2 max-w-md mx-auto">
                  Choose a fixture from the dropdown above to view its 3D physics telemetry.
                </p>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
