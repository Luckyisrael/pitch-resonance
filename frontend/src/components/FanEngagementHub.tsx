import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Send, Volume2, Sparkles, Star, Users, MessageSquare, Flame } from 'lucide-react';
import { useApp } from '../store/AppContext';

interface CheerMessage {
  id: string;
  sender: string;
  alliance: 'home' | 'away' | 'NEUTRAL';
  text: string;
  timestamp: string;
}

interface FloatingEmoji {
  id: string;
  emoji: string;
  x: number;
  y: number;
  scale: number;
  rotate: number;
}

export default function FanEngagementHub() {
  const { state } = useApp();
  const home = state.homeTeam || 'Home';
  const away = state.awayTeam || 'Away';

  const [alliance, setAlliance] = useState<'home' | 'away'>('home');
  const [chatMessage, setChatMessage] = useState<string>('');
  const [volume, setVolume] = useState<number>(0.5);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);
  const [cheerMessages, setCheerMessages] = useState<CheerMessage[]>([
    { id: '1', sender: 'Fanatico_Cap', alliance: 'home', text: `Vamos ${home}! Dynamic parimutuel weights favor early backers 🔥`, timestamp: '18:25:05' },
    { id: '2', sender: 'AwayKing99', alliance: 'away', text: `${away} momentum is peaking! Look at that territory curve rise 💪`, timestamp: '18:26:12' },
    { id: '3', sender: 'SolanaLover', alliance: 'NEUTRAL', text: 'The 3D pitch deforms live when on-chain tips are placed! This is crazy!', timestamp: '18:28:44' },
    { id: '4', sender: 'Anchor_Architect', alliance: 'home', text: 'Just secured my stake in the home vault. Time-decay protection is key! 🔑⚡', timestamp: '18:31:01' }
  ]);

  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [cheerMessages]);

  useEffect(() => {
    const randomSenders = [
      'PibeDeOro', 'Sol_Validator', 'Pythian_Oracle', 'Mido_Pharaoh',
      'Messi_Magic', 'DeFi_Dribbler', 'Rust_Maximalist', 'Desert_Fox'
    ];

    const randomCheers = [
      'GOL GOL GOL! What a finish! ⚽🔥',
      'Secured my early bird boost. 1.5x stake weight locked! 💎',
      'The time-decay factor is ticking down. Fast, place your stakes!',
      'Defense is solid! Counter attack incoming. 🛡️⚡',
      'Who is deploying the GoalSnatcher AI bot? Let\u2019s see some action!',
      'Unbelievable visual fidelity on this WebGL canvas. 🎨',
      `Vamos ${home}! Support the crown! 👑`,
      `${away} are taking over the territory! Push the pool! 🦁`
    ];

    const interval = setInterval(() => {
      if (Math.random() < 0.4) {
        const sender = randomSenders[Math.floor(Math.random() * randomSenders.length)];
        const text = randomCheers[Math.floor(Math.random() * randomCheers.length)];
        const allianceType: CheerMessage['alliance'] = Math.random() > 0.5 ? 'home' : 'away';
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        setCheerMessages(prev => [
          ...prev,
          { id: Math.random().toString(), sender, alliance: allianceType, text, timestamp }
        ]);
      }
    }, 7000);

    return () => clearInterval(interval);
  }, [home, away]);

  const playSynthesizedSound = (type: 'horn' | 'drum' | 'whistle' | 'bolt') => {
    if (isMuted) return;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      const ctx = new AudioContextClass();

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(volume * 0.35, ctx.currentTime);
      masterGain.connect(ctx.destination);

      if (type === 'horn') {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc1.type = 'sawtooth';
        osc2.type = 'triangle';

        osc1.frequency.setValueAtTime(320, ctx.currentTime);
        osc1.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
        osc1.frequency.linearRampToValueAtTime(440, ctx.currentTime + 0.6);

        osc2.frequency.setValueAtTime(323, ctx.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(443, ctx.currentTime + 0.15);
        osc2.frequency.linearRampToValueAtTime(443, ctx.currentTime + 0.6);

        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.7);

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(masterGain);

        osc1.start();
        osc2.start();
        osc1.stop(ctx.currentTime + 0.7);
        osc2.stop(ctx.currentTime + 0.7);

      } else if (type === 'drum') {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + 0.3);

        gainNode.gain.setValueAtTime(1.5, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

        osc.connect(gainNode);
        gainNode.connect(masterGain);

        osc.start();
        osc.stop(ctx.currentTime + 0.4);

      } else if (type === 'whistle') {
        const osc = ctx.createOscillator();
        const mod = ctx.createOscillator();
        const modGain = ctx.createGain();
        const gainNode = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(1800, ctx.currentTime);

        mod.type = 'sine';
        mod.frequency.setValueAtTime(35, ctx.currentTime);
        modGain.gain.setValueAtTime(180, ctx.currentTime);

        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.05);
        gainNode.gain.linearRampToValueAtTime(0.8, ctx.currentTime + 0.2);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

        mod.connect(modGain);
        modGain.connect(osc.frequency);
        osc.connect(gainNode);
        gainNode.connect(masterGain);

        osc.start();
        mod.start();
        osc.stop(ctx.currentTime + 0.5);
        mod.stop(ctx.currentTime + 0.5);

      } else if (type === 'bolt') {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(900, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.25);

        gainNode.gain.setValueAtTime(0.8, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);

        osc.connect(gainNode);
        gainNode.connect(masterGain);

        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }

    } catch (err) {
      console.warn("Audio Context init blocked or not supported:", err);
    }
  };

  const triggerReaction = (emoji: string, type: 'horn' | 'drum' | 'whistle' | 'bolt') => {
    playSynthesizedSound(type);

    const targetX = alliance === 'home' ? -5.5 + Math.random() * 3 : 5.5 - Math.random() * 3;
    const targetZ = -4.5 + Math.random() * 9;
    const intensity = type === 'bolt' ? 1.6 : type === 'horn' ? 1.3 : 0.8;

    window.dispatchEvent(new CustomEvent('shockwave-trigger', {
      detail: {
        x: targetX,
        z: targetZ,
        intensity: intensity
      }
    }));

    const id = Math.random().toString();
    const newEmoji: FloatingEmoji = {
      id,
      emoji,
      x: 10 + Math.random() * 80,
      y: 90,
      scale: 0.8 + Math.random() * 0.7,
      rotate: -35 + Math.random() * 70
    };

    setFloatingEmojis(prev => [...prev, newEmoji]);

    setTimeout(() => {
      setFloatingEmojis(prev => prev.filter(e => e.id !== id));
    }, 2200);
  };

  const handlePostCheer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const text = chatMessage;

    setCheerMessages(prev => [
      ...prev,
      {
        id: Math.random().toString(),
        sender: 'You_The_Fan 👤',
        alliance,
        text,
        timestamp
      }
    ]);

    setChatMessage('');

    playSynthesizedSound('whistle');
    window.dispatchEvent(new CustomEvent('shockwave-trigger', {
      detail: {
        x: 0,
        z: 0,
        intensity: 2.2
      }
    }));
  };

  return (
    <div className={`border p-5 rounded-2xl shadow-xl transition-all duration-500 relative overflow-hidden ${
      alliance === 'home'
        ? 'bg-gradient-to-b from-[#141824] to-[#121213] border-[#38bdf8]/20 shadow-[#0ea5e9]/5'
        : 'bg-gradient-to-b from-[#241416] to-[#121213] border-[#f43f5e]/20 shadow-[#e11d48]/5'
    }`}>

      <div className={`absolute top-0 right-0 w-36 h-36 rounded-full blur-3xl pointer-events-none transition-all duration-500 ${
        alliance === 'home' ? 'bg-sky-500/5' : 'bg-rose-500/5'
      }`} />

      <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
        <AnimatePresence>
          {floatingEmojis.map(item => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0, y: '90%', x: `${item.x}%`, rotate: 0 }}
              animate={{
                opacity: [0, 1, 1, 0],
                scale: item.scale,
                y: '-20%',
                rotate: item.rotate,
                x: `${item.x + (Math.sin(item.scale * 10) * 12)}%`
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2.0, ease: 'easeOut' }}
              className="absolute text-2xl filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] select-none"
            >
              {item.emoji}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between z-20">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-mono font-black tracking-widest text-[#F5F5F5] uppercase flex items-center gap-2">
              <Sparkles className={`w-4 h-4 ${alliance === 'home' ? 'text-sky-400' : 'text-rose-400'}`} />
              LIVE HYPE & FAN ZONE
            </h3>
            <span className="bg-amber-400 text-black font-mono text-[8px] px-1.5 py-0.5 rounded uppercase font-black tracking-wider shadow">
              FAN ZONE
            </span>
          </div>

          <div className="flex items-center gap-2 bg-zinc-950/80 border border-zinc-850 px-2.5 py-1 rounded-xl">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title={isMuted ? "Unmute Synths" : "Mute Synths"}
            >
              <Volume2 className={`w-3.5 h-3.5 ${isMuted ? 'text-rose-500 line-through' : 'text-zinc-400'}`} />
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-12 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
            />
          </div>
        </div>

        <p className="text-[11px] text-zinc-400 leading-normal z-20">
          Hype your squad up in real-time. Choose your stadium seating alliance, fire simulated synthetic fan instruments, and shout cheer messages to trigger visual waves on the 3D pitch!
        </p>

        <div className="grid grid-cols-2 gap-3 z-20">
          <button
            onClick={() => {
              setAlliance('home');
              playSynthesizedSound('whistle');
            }}
            className={`p-3.5 rounded-xl border font-mono flex flex-col items-center justify-center gap-1.5 transition-all relative overflow-hidden cursor-pointer ${
              alliance === 'home'
                ? 'border-sky-400 bg-sky-950/20 text-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.15)] font-black'
                : 'border-zinc-850 bg-zinc-950/50 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {alliance === 'home' && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-sky-400 rounded-full animate-ping" />
            )}
            <span className="text-[10px] uppercase font-bold tracking-wider">{home} Zone</span>
          </button>

          <button
            onClick={() => {
              setAlliance('away');
              playSynthesizedSound('whistle');
            }}
            className={`p-3.5 rounded-xl border font-mono flex flex-col items-center justify-center gap-1.5 transition-all relative overflow-hidden cursor-pointer ${
              alliance === 'away'
                ? 'border-rose-500 bg-rose-950/20 text-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.15)] font-black'
                : 'border-zinc-850 bg-zinc-950/50 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {alliance === 'away' && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping" />
            )}
            <span className="text-[10px] uppercase font-bold tracking-wider">{away} Zone</span>
          </button>
        </div>

        <div className="space-y-1.5 z-20">
          <span className="text-[9px] font-mono font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5" /> STADIUM AUDIO & VISUAL REACTION BOARD
          </span>
          <div className="grid grid-cols-4 gap-2">
            {[
              { emoji: '🔥', label: 'Volley', sound: 'whistle' as const, color: 'hover:border-amber-400 hover:bg-amber-950/10' },
              { emoji: '🎺', label: 'Horn', sound: 'horn' as const, color: 'hover:border-sky-400 hover:bg-sky-950/10' },
              { emoji: '🥁', label: 'Bass', sound: 'drum' as const, color: 'hover:border-emerald-400 hover:bg-emerald-950/10' },
              { emoji: '⚡', label: 'Storm', sound: 'bolt' as const, color: 'hover:border-rose-400 hover:bg-rose-950/10' }
            ].map((btn) => (
              <button
                key={btn.label}
                onClick={() => triggerReaction(btn.emoji, btn.sound)}
                className={`p-2 rounded-xl bg-zinc-950 border border-zinc-850/80 transition-all flex flex-col items-center justify-center cursor-pointer active:scale-95 ${btn.color}`}
              >
                <span className="text-xl filter drop-shadow-[0_1px_3px_rgba(0,0,0,0.3)]">{btn.emoji}</span>
                <span className="text-[9px] font-mono text-zinc-400 mt-1 uppercase font-bold">{btn.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5 z-20">
          <span className="text-[9px] font-mono font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" /> STADIUM CHEER STREAM & WALL
          </span>

          <div ref={chatContainerRef} className="bg-black/95 p-3 rounded-xl border border-zinc-850/80 h-[110px] overflow-y-auto font-mono text-[9px] space-y-1.5 custom-scrollbar">
            {cheerMessages.map((msg) => (
              <div key={msg.id} className="flex items-start gap-1.5 leading-relaxed">
                <span className="text-zinc-600 shrink-0">[{msg.timestamp}]</span>
                <span className={`font-black shrink-0 ${
                  msg.alliance === 'home'
                    ? 'text-sky-400'
                    : msg.alliance === 'away'
                      ? 'text-rose-400'
                      : 'text-zinc-400'
                }`}>
                  {msg.sender === 'You_The_Fan 👤' ? 'You' : msg.sender}:
                </span>
                <span className="text-zinc-300 break-words flex-1">
                  {msg.text}
                </span>
              </div>
            ))}
          </div>

          <form onSubmit={handlePostCheer} className="flex gap-1.5 mt-1">
            <input
              type="text"
              placeholder={`Shout a cheer for ${alliance === 'home' ? home : away}...`}
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              className="flex-1 bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-[10px] font-mono text-zinc-300 placeholder-zinc-600 outline-none focus:border-zinc-700 focus:bg-black/95"
              maxLength={100}
            />
            <button
              type="submit"
              disabled={!chatMessage.trim()}
              className={`p-2 rounded-xl border flex items-center justify-center cursor-pointer transition-all ${
                chatMessage.trim()
                  ? alliance === 'home'
                    ? 'bg-sky-400 border-sky-400 text-black hover:bg-sky-300'
                    : 'bg-rose-500 border-rose-500 text-white hover:bg-rose-600'
                  : 'bg-zinc-900 border-zinc-850 text-zinc-600 cursor-not-allowed'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
