import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Wallet, ArrowRight, Trophy, Sparkles,
  AlertTriangle, CheckCircle, Activity, Radio,
  Check, Lock, Percent
} from 'lucide-react';
import HackathonPortal from './components/HackathonPortal';
import ReownWalletModal from './components/ReownWalletModal';
import TabNavigation from './components/TabNavigation';
import LiveTab from './components/LiveTab';
import MatchesTab from './components/MatchesTab';
import BoardTab from './components/BoardTab';
import SandboxTab from './components/SandboxTab';
import { useApp } from './store/AppContext';
import * as api from './store/api';
import type { WalletProvider } from './store/types';

export default function App() {
  const { state, dispatch, showToast } = useApp();
  const [reownModalOpen, setReownModalOpen] = useState(false);

  const PLATFORM_FEE_PERCENT = 3.5;
  const DISTRIBUTION_PERCENT = 96.5;

  // Restore session
  useEffect(() => {
    if (state.authToken) {
      api.checkAuth(state.backendUrl, state.authToken).then(data => {
        if (data) {
          dispatch({ type: 'SET_WALLET', address: data.wallet, token: state.authToken });
          dispatch({ type: 'SET_ONBOARDING', step: 3 });
        } else {
          localStorage.removeItem('pitch_resonance_auth_token');
        }
      });
    }
  }, []);

  const handleAuthSuccess = (address: string, token: string, provider: WalletProvider, secretKey?: string) => {
    dispatch({ type: 'SET_WALLET', address, token, provider, secretKey });
    localStorage.setItem('pitch_resonance_auth_token', token);
    localStorage.setItem('pitch_resonance_wallet', address);
    showToast(provider === 'simulated' ? 'Simulated Wallet Authenticated!' : 'Phantom Wallet Connected!');
    dispatch({ type: 'SET_ONBOARDING', step: 3 });
  };

  return (
    <div className="min-h-screen bg-[#111112] text-[#F5F5F5] antialiased selection:bg-amber-300 selection:text-black font-sans flex flex-col justify-between">
      <AnimatePresence>
        {state.toast.show && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4"
          >
            <div className={`p-4 rounded-xl shadow-2xl border flex items-start gap-3 backdrop-blur-md ${
              state.toast.type === 'success'
                ? 'bg-emerald-950/95 text-emerald-300 border-emerald-500/30'
                : state.toast.type === 'error'
                  ? 'bg-rose-950/95 text-rose-300 border-rose-500/30'
                  : 'bg-zinc-900/95 text-zinc-300 border-zinc-700'
            }`}>
              {state.toast.type === 'success' && <CheckCircle className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />}
              {state.toast.type === 'error' && <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />}
              {state.toast.type === 'info' && <Radio className="w-5 h-5 shrink-0 mt-0.5 text-amber-400 animate-pulse" />}
              <div className="flex-1 text-xs font-mono font-bold leading-normal">{state.toast.message}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {state.onboardingStep === 0 && (
          <motion.div key="step0" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="flex-grow max-w-xl mx-auto flex flex-col justify-center px-6 py-16"
          >
            <div className="bg-[#141415] border border-zinc-800 p-8 sm:p-10 rounded-3xl shadow-2xl space-y-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/5 rounded-full blur-3xl pointer-events-none" />
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-450/10 border border-amber-400/20 rounded-full">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span className="text-[10px] font-mono tracking-widest font-black uppercase text-amber-300">Solana Hackathon Entry</span>
                </div>
                <h1 className="text-4xl font-black text-white tracking-tight leading-none uppercase">PITCH RESONANCE</h1>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Real-time football data from TxODDS rendered as a 3D undulating pitch. Tip SOL to deform the field and claim parimutuel rewards.
                </p>
              </div>
              <div className="pt-4">
                <button onClick={() => { dispatch({ type: 'SET_ONBOARDING', step: 1 }); }}
                  className="w-full py-4 bg-amber-400 hover:bg-amber-300 text-black font-black rounded-xl text-xs uppercase flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
                >
                  <span>Learn How Winnings Work</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {state.onboardingStep === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="flex-grow max-w-xl mx-auto flex flex-col justify-center px-6 py-16"
          >
            <div className="bg-[#141415] border border-zinc-800 p-8 sm:p-10 rounded-3xl shadow-2xl space-y-8 relative overflow-hidden">
              <div className="space-y-3">
                <span className="text-[10px] font-mono tracking-widest font-black text-amber-400 uppercase">AUTONOMOUS DISTRIBUTION</span>
                <h2 className="text-2xl font-black text-white tracking-tight leading-none uppercase">HOW THE VICTORY PURSE WORKS</h2>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Payouts are governed entirely by a decentralized Solana smart contract program.
                </p>
                <div className="p-4 bg-[#0C0C0D] border border-zinc-850 rounded-xl space-y-3">
                  <div className="flex justify-between items-center text-zinc-400">
                    <span className="font-bold flex items-center gap-1.5 uppercase"><Percent className="w-3.5 h-3.5 text-amber-400" /> Platform Fee</span>
                    <span className="text-white font-black">{PLATFORM_FEE_PERCENT}% Retained</span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-400">
                    <span className="font-bold flex items-center gap-1.5 uppercase"><Trophy className="w-3.5 h-3.5 text-sky-400" /> Winner Distribution</span>
                    <span className="text-white font-black">{DISTRIBUTION_PERCENT}% Shared</span>
                  </div>
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button onClick={() => dispatch({ type: 'SET_ONBOARDING', step: 0 })}
                  className="px-5 py-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 font-bold rounded-xl text-xs uppercase transition-all cursor-pointer">Back</button>
                <button onClick={() => dispatch({ type: 'SET_ONBOARDING', step: 2 })}
                  className="flex-1 py-4 bg-amber-400 hover:bg-amber-300 text-black font-black rounded-xl text-xs uppercase flex items-center justify-center gap-2 transition-all cursor-pointer">
                  <span>Go to Authentication</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {state.onboardingStep === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="flex-grow max-w-xl mx-auto flex flex-col justify-center px-6 py-16"
          >
            <div className="bg-[#141415] border border-zinc-800 p-8 sm:p-10 rounded-3xl shadow-2xl space-y-8 relative overflow-hidden">
              <div className="text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto">
                  <Lock className="w-6 h-6 text-amber-400" />
                </div>
                <span className="text-[10px] font-mono tracking-widest font-black text-amber-400 uppercase block">FAN VERIFICATION</span>
                <h2 className="text-2xl font-black text-white tracking-tight leading-none uppercase">CONNECT WALLET TO ENTER</h2>
                <p className="text-xs text-zinc-400 leading-relaxed max-w-sm mx-auto">
                  Authenticate with your Solana wallet to enable parimutuel stakes on Devnet.
                </p>
              </div>
              {state.walletConnected ? (
                <div className="p-4 bg-emerald-950/20 border border-emerald-500/20 rounded-xl text-center space-y-3">
                  <Check className="w-8 h-8 text-emerald-400 mx-auto" />
                  <p className="text-xs font-mono text-emerald-300">Wallet Connected</p>
                  <p className="text-[10px] font-mono text-zinc-400">{state.walletAddress.slice(0, 8)}...{state.walletAddress.slice(-4)}</p>
                  <button onClick={() => dispatch({ type: 'SET_ONBOARDING', step: 3 })}
                    className="w-full py-4 bg-amber-400 hover:bg-amber-300 text-black font-black rounded-xl text-xs uppercase flex items-center justify-center gap-2 cursor-pointer">
                    <span>Enter Arena</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button onClick={() => setReownModalOpen(true)}
                  className="w-full py-4 bg-amber-400 hover:bg-amber-300 text-black font-black rounded-xl text-xs uppercase flex items-center justify-center gap-2.5 cursor-pointer">
                  <Wallet className="w-4 h-4" />
                  <span>Authenticate with Solana</span>
                </button>
              )}
              <div className="text-center">
                <button onClick={() => { dispatch({ type: 'SET_ONBOARDING', step: 3 }); }}
                  className="text-[10px] font-mono text-zinc-500 hover:text-zinc-400 uppercase font-bold tracking-wider underline cursor-pointer">
                  Skip — Enter as Guest
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {state.onboardingStep === 3 && (
          <motion.div key="step3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex-grow flex flex-col"
          >
            <div className="bg-[#141415] border-b border-zinc-850 py-3.5 px-4 sm:px-6 lg:px-8 shadow-md">
              <div className="max-w-7xl mx-auto flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                    <Activity className="w-4.5 h-4.5 text-amber-400" />
                  </div>
                  <div>
                    <span className="text-xs font-black uppercase tracking-tight text-white block">PITCH RESONANCE</span>
                    <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest block">TXODDS VOLUMETRIC PORTRAIT</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <button onClick={() => dispatch({ type: 'SET_HACKATHON_PORTAL', v: true })}
                    className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-mono font-black text-[9px] uppercase rounded-lg flex items-center gap-1.5 cursor-pointer">
                    <Trophy className="w-3.5 h-3.5" />
                    <span>🏆 Hackathon Portal</span>
                  </button>
                  {state.walletConnected ? (
                    <div className="flex items-center gap-2 p-1 bg-[#1E1E20] border border-zinc-800 rounded-lg">
                      <div className="px-2.5 py-1 text-right hidden sm:block">
                        <span className="text-[8px] font-mono tracking-widest text-emerald-400 font-bold block">AUTHENTICATED</span>
                        <span className="text-[10px] font-mono font-bold text-zinc-300 mt-0.5 block">
                          {state.walletAddress.slice(0, 4)}...{state.walletAddress.slice(-4)}
                        </span>
                      </div>
                      <button onClick={() => { dispatch({ type: 'CLEAR_WALLET' }); showToast('Wallet Disconnected.', 'info'); }}
                        className="p-1.5 bg-zinc-900 hover:bg-rose-950/40 hover:text-rose-400 border border-zinc-800 rounded text-[10px] font-mono uppercase font-black cursor-pointer text-zinc-500">
                        Sign Out
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setReownModalOpen(true)}
                      className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-black font-mono font-black text-[9px] uppercase rounded-lg cursor-pointer">
                      Connect Wallet
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="px-4 sm:px-6 lg:px-8 py-4">
              <div className="max-w-7xl mx-auto flex items-center justify-between">
                <TabNavigation
                  activeTab={state.activeTab}
                  onTabChange={(tab) => dispatch({ type: 'SET_ACTIVE_TAB', tab })}
                />
              </div>
            </div>

            {state.activeTab === 'live' && <LiveTab />}
            {state.activeTab === 'matches' && <MatchesTab />}
            {state.activeTab === 'sandbox' && <SandboxTab />}
            {state.activeTab === 'board' && <BoardTab />}
          </motion.div>
        )}
      </AnimatePresence>

      <HackathonPortal isOpen={!!state.hackathonPortalOpen} onClose={() => dispatch({ type: 'SET_HACKATHON_PORTAL', v: false })} />
      <ReownWalletModal
        isOpen={reownModalOpen}
        onClose={() => setReownModalOpen(false)}
        backendUrl={state.backendUrl}
        setBackendUrl={(url) => dispatch({ type: 'SET_BACKEND_URL', url: url.replace(/\/+$/, '') })}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  );
}
