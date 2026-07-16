import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Connection, Transaction, SystemProgram, TransactionInstruction, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Fixture, PhysicsFrame, TimelineFrame, TxItem, ToastState, TeamSide, WalletProvider } from './types';
import * as api from './api';

const STORAGE_BACKEND_URL = 'pitch_resonance_backend_url';
const STORAGE_AUTH_TOKEN = 'pitch_resonance_auth_token';
const STORAGE_WALLET = 'pitch_resonance_wallet';
const STORAGE_WALLET_PROVIDER = 'pitch_wallet_provider';
const DEFAULT_BACKEND_URL = 'https://pitch-resonance.onrender.com';
const DEVNET_RPC = 'https://api.devnet.solana.com';
const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

function getConnection(): Connection {
  return new Connection(DEVNET_RPC, 'confirmed');
}

export type ActiveTab = 'live' | 'matches' | 'board' | 'sandbox'

export interface AppState {
  onboardingStep: number;
  activeTab: ActiveTab;
  backendUrl: string;
  fixtures: Fixture[];
  selectedMatchId: string | null;
  physicsFrames: PhysicsFrame[];
  homeScore: number;
  awayScore: number;
  homeTeam: string;
  awayTeam: string;
  homePool: number;
  awayPool: number;
  userStakeHome: number;
  userStakeAway: number;
  solBalance: number;
  txHistory: TxItem[];
  walletAddress: string;
  authToken: string;
  walletConnected: boolean;
  walletProvider: WalletProvider;
  isConnecting: boolean;
  isConfirmingTx: boolean;
  isSettled: boolean;
  isClaimed: boolean;
  claimedAmount: number;
  isClaiming: boolean;
  isSoundOn: boolean;
  toast: ToastState;
  errorMsg: string;
  loadingFixtures: boolean;
  loadingFrames: boolean;
  noFramesFallback: boolean;
  hackathonPortalOpen: boolean;
}

type Action =
  | { type: 'SET_ACTIVE_TAB'; tab: ActiveTab }
  | { type: 'SET_ONBOARDING'; step: number }
  | { type: 'SET_BACKEND_URL'; url: string }
  | { type: 'SET_FIXTURES'; fixtures: Fixture[] }
  | { type: 'SET_LOADING_FIXTURES'; v: boolean }
  | { type: 'SET_LOADING_FRAMES'; v: boolean }
  | { type: 'SET_NO_FRAMES_FALLBACK'; v: boolean }
  | { type: 'CLEAR_PHYSICS_FRAMES' }
  | { type: 'SET_SELECTED_MATCH'; id: string }
  | { type: 'SET_PHYSICS_FRAMES'; frames: PhysicsFrame[]; homeScore: number; awayScore: number; homeTeam: string; awayTeam: string }
  | { type: 'SET_POOLS'; home: number; away: number }
  | { type: 'ADD_TIP'; team: TeamSide; amount: number; sig: string }
  | { type: 'SET_USER_STAKE'; team: TeamSide; amount: number }
  | { type: 'SET_BALANCE'; balance: number }
  | { type: 'SET_CONNECTING'; v: boolean }
  | { type: 'SET_CONFIRMING_TX'; v: boolean }
  | { type: 'SET_WALLET'; address: string; token: string; provider: WalletProvider }
  | { type: 'CLEAR_WALLET' }
  | { type: 'ADD_TX'; tx: TxItem }
  | { type: 'SET_SETTLED'; v: boolean }
  | { type: 'SET_CLAIMED'; v: boolean; amount?: number }
  | { type: 'SET_CLAIMING'; v: boolean }
  | { type: 'SET_SOUND'; v: boolean }
  | { type: 'SET_TOAST'; toast: ToastState }
  | { type: 'SET_ERROR'; msg: string }
  | { type: 'SET_HACKATHON_PORTAL'; v: boolean };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_ACTIVE_TAB': return { ...state, activeTab: action.tab };
    case 'SET_ONBOARDING': return { ...state, onboardingStep: action.step };
    case 'SET_BACKEND_URL': return { ...state, backendUrl: action.url };
    case 'SET_FIXTURES': return { ...state, fixtures: action.fixtures };
    case 'SET_LOADING_FIXTURES': return { ...state, loadingFixtures: action.v };
    case 'SET_LOADING_FRAMES': return { ...state, loadingFrames: action.v };
    case 'SET_NO_FRAMES_FALLBACK': return { ...state, noFramesFallback: action.v };
    case 'CLEAR_PHYSICS_FRAMES': return { ...state, physicsFrames: [], noFramesFallback: false, errorMsg: '' };
    case 'SET_SELECTED_MATCH': return { ...state, selectedMatchId: action.id };
    case 'SET_PHYSICS_FRAMES': return {
      ...state, physicsFrames: action.frames,
      homeScore: action.homeScore, awayScore: action.awayScore,
      homeTeam: action.homeTeam, awayTeam: action.awayTeam,
      noFramesFallback: false,
    };
    case 'SET_POOLS': return { ...state, homePool: action.home, awayPool: action.away };
    case 'ADD_TIP': {
      const stakeKey = action.team === 'home' ? 'userStakeHome' : 'userStakeAway';
      return {
        ...state,
        [stakeKey]: state[stakeKey] + action.amount,
        solBalance: state.solBalance - action.amount,
      };
    }
    case 'SET_USER_STAKE': {
      if (action.team === 'home') return { ...state, userStakeHome: action.amount };
      return { ...state, userStakeAway: action.amount };
    }
    case 'SET_BALANCE': return { ...state, solBalance: action.balance };
    case 'SET_CONNECTING': return { ...state, isConnecting: action.v };
    case 'SET_CONFIRMING_TX': return { ...state, isConfirmingTx: action.v };
    case 'SET_WALLET': {
      localStorage.setItem(STORAGE_WALLET_PROVIDER, action.provider);
      return { ...state, walletAddress: action.address, authToken: action.token, walletConnected: true, walletProvider: action.provider };
    }
    case 'CLEAR_WALLET': {
      localStorage.removeItem(STORAGE_WALLET_PROVIDER);
      return { ...state, walletAddress: '', authToken: '', walletConnected: false, walletProvider: '', userStakeHome: 0, userStakeAway: 0 };
    }
    case 'ADD_TX': return { ...state, txHistory: [action.tx, ...state.txHistory] };
    case 'SET_SETTLED': return { ...state, isSettled: action.v };
    case 'SET_CLAIMED': return { ...state, isClaimed: action.v, claimedAmount: action.amount ?? state.claimedAmount };
    case 'SET_CLAIMING': return { ...state, isClaiming: action.v };
    case 'SET_SOUND': return { ...state, isSoundOn: action.v };
    case 'SET_TOAST': return { ...state, toast: action.toast };
    case 'SET_ERROR': return { ...state, errorMsg: action.msg };
    case 'SET_HACKATHON_PORTAL': return { ...state, hackathonPortalOpen: action.v };
    default: return state;
  }
}

function loadWalletProvider() {
  return (localStorage.getItem(STORAGE_WALLET_PROVIDER) as WalletProvider) || '';
}

const initialState: AppState = {
  onboardingStep: 0,
  activeTab: 'live',
  backendUrl: localStorage.getItem(STORAGE_BACKEND_URL) || DEFAULT_BACKEND_URL,
  fixtures: [],
  selectedMatchId: null,
  physicsFrames: [],
  homeScore: 0,
  awayScore: 0,
  homeTeam: '',
  awayTeam: '',
  homePool: 0,
  awayPool: 0,
  userStakeHome: 0,
  userStakeAway: 0,
  solBalance: 5.00,
  txHistory: [],
  walletAddress: localStorage.getItem(STORAGE_WALLET) || '',
  authToken: localStorage.getItem(STORAGE_AUTH_TOKEN) || '',
  walletConnected: false,
  walletProvider: loadWalletProvider() as WalletProvider,
  isConnecting: false,
  isConfirmingTx: false,
  isSettled: false,
  isClaimed: false,
  claimedAmount: 0,
  isClaiming: false,
  isSoundOn: true,
  toast: { show: false, message: '', type: 'success' },
  errorMsg: '',
  loadingFixtures: false,
  loadingFrames: false,
  noFramesFallback: false,
  hackathonPortalOpen: false,
};

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
  fetchAndSetFixtures: () => Promise<void>;
  fetchAndSetFrames: (matchId: string) => Promise<void>;
  sendTip: (team: TeamSide, amount: number) => Promise<void>;
  claimWinnings: () => Promise<void>;
  showToast: (message: string, type?: ToastState['type']) => void;
  connectSocket: () => Socket | null;
  setActiveTab: (tab: ActiveTab) => void;
} | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const socketRef = useRef<Socket | null>(null);
  const poolAddressRef = useRef<string | null>(null);

  const getPoolAddress = useCallback(async () => {
    if (poolAddressRef.current) return poolAddressRef.current;
    try {
      const res = await fetch(`${state.backendUrl}/api/hype/pool-address`);
      const data = await res.json();
      poolAddressRef.current = data.address;
      return data.address;
    } catch {
      throw new Error('Failed to fetch pool wallet address from backend');
    }
  }, [state.backendUrl]);

  const showToast = useCallback((message: string, type: ToastState['type'] = 'success') => {
    dispatch({ type: 'SET_TOAST', toast: { show: true, message, type } });
    setTimeout(() => dispatch({ type: 'SET_TOAST', toast: { show: false, message: '', type: 'success' } }), 4500);
  }, []);

  const fetchAndSetFixtures = useCallback(async () => {
    dispatch({ type: 'SET_LOADING_FIXTURES', v: true });
    dispatch({ type: 'SET_ERROR', msg: '' });
    try {
      const fixtures = await api.fetchFixtures(state.backendUrl);
      dispatch({ type: 'SET_FIXTURES', fixtures });
      if (fixtures.length > 0) {
        const liveMatch = fixtures.find(f => f.isLive);
        if (liveMatch) {
          dispatch({ type: 'SET_SELECTED_MATCH', id: liveMatch.matchId });
        } else {
          dispatch({ type: 'SET_SELECTED_MATCH', id: fixtures[0].matchId });
        }
      }
    } catch (err: any) {
      dispatch({ type: 'SET_ERROR', msg: `Cannot reach backend at ${state.backendUrl}` });
    } finally {
      dispatch({ type: 'SET_LOADING_FIXTURES', v: false });
    }
  }, [state.backendUrl]);

  const fetchAndSetFrames = useCallback(async (matchId: string) => {
    dispatch({ type: 'CLEAR_PHYSICS_FRAMES' });
    const matchInfo = state.fixtures.find(f => f.matchId === matchId);
    const isLive = matchInfo?.isLive ?? (matchId === 'simulation');
    dispatch({ type: 'SET_NO_FRAMES_FALLBACK', v: !isLive });

    if (isLive) return;

    dispatch({ type: 'SET_LOADING_FRAMES', v: true });
    try {
      const homeTeam = matchInfo?.homeTeam || 'Home';
      const awayTeam = matchInfo?.awayTeam || 'Away';
      const stride = 30;

      const { frames, homeScore, awayScore } = await api.fetchPhysicsFrames(state.backendUrl, matchId, stride);

      if (frames.length > 0) {
        dispatch({ type: 'SET_PHYSICS_FRAMES', frames, homeScore, awayScore, homeTeam, awayTeam });
        dispatch({ type: 'SET_NO_FRAMES_FALLBACK', v: false });
      } else {
        dispatch({ type: 'SET_NO_FRAMES_FALLBACK', v: true });
      }
    } catch (err: any) {
      dispatch({ type: 'SET_ERROR', msg: err.message });
    } finally {
      dispatch({ type: 'SET_LOADING_FRAMES', v: false });
    }
  }, [state.fixtures, state.backendUrl]);

  const handleTip = useCallback(async (team: TeamSide, amount: number) => {
    if (!state.walletProvider || !(window as any).solana?.isPhantom) {
      showToast('Connect a Phantom wallet to send tips on devnet.', 'error');
      return;
    }

    const matchId = state.selectedMatchId || 'simulation';
    dispatch({ type: 'SET_CONFIRMING_TX', v: true });

    try {
      const provider = (window as any).solana;
      const conn = getConnection();
      const fromPubkey = new PublicKey(state.walletAddress);
      const poolAddress = await getPoolAddress();
      const poolPubkey = new PublicKey(poolAddress);

      const { blockhash } = await conn.getLatestBlockhash();
      const lamports = Math.round(amount * LAMPORTS_PER_SOL);

      const tx = new Transaction({ recentBlockhash: blockhash, feePayer: fromPubkey });
      tx.add(
        SystemProgram.transfer({ fromPubkey, toPubkey: poolPubkey, lamports }),
        new TransactionInstruction({
          programId: new PublicKey(MEMO_PROGRAM_ID),
          keys: [],
          data: new TextEncoder().encode(`tip:${matchId}:${team}`) as unknown as Buffer,
        })
      );

      const { signature } = await provider.signAndSendTransaction(tx);

      await api.sendTipSignature(state.backendUrl, matchId, team, signature, state.authToken);

      const matchInfo = state.fixtures.find(f => f.matchId === matchId);
      dispatch({ type: 'ADD_TIP', team, amount: Math.round(amount * 1e9) / 1e9, sig: signature });
      dispatch({ type: 'ADD_TX', tx: {
        id: signature,
        team,
        teamName: team === 'home' ? (matchInfo?.homeTeam || 'Home') : (matchInfo?.awayTeam || 'Away'),
        amount,
        sig: signature.slice(0, 12),
        timestamp: 'Just now',
      }});

      const teamName = team === 'home' ? (matchInfo?.homeTeam || 'Home') : (matchInfo?.awayTeam || 'Away');
      showToast(`Tipped ${amount} SOL to ${teamName} — https://solscan.io/tx/${signature}?cluster=devnet`);
    } catch (err: any) {
      console.error('Tip error:', err);
      showToast(err.message || 'Transaction failed', 'error');
    } finally {
      dispatch({ type: 'SET_CONFIRMING_TX', v: false });
    }
  }, [state.backendUrl, state.selectedMatchId, state.fixtures, state.walletProvider, state.walletAddress, showToast, getPoolAddress]);

  const handleClaimWinnings = useCallback(async () => {
    const matchId = state.selectedMatchId || 'simulation';
    dispatch({ type: 'SET_CLAIMING', v: true });

    try {
      const result = await api.claimWinnings(state.backendUrl, matchId, state.authToken);
      dispatch({ type: 'SET_CLAIMED', v: true, amount: result.amount });
      dispatch({ type: 'SET_BALANCE', balance: state.solBalance + result.amount });
      dispatch({ type: 'ADD_TX', tx: {
        id: result.signature,
        team: 'home',
        teamName: 'Claim',
        amount: result.amount,
        sig: result.signature.slice(0, 12),
        timestamp: 'Just now',
      }});
      showToast(`Winnings Claimed! +${result.amount} SOL — ${result.explorerUrl}`);
    } catch (err: any) {
      console.error('Claim error:', err);
      showToast(err.message || 'Claim failed', 'error');
    } finally {
      dispatch({ type: 'SET_CLAIMING', v: false });
    }
  }, [state.backendUrl, state.selectedMatchId, state.authToken, state.solBalance, showToast]);

  const setActiveTab = useCallback((tab: ActiveTab) => {
    dispatch({ type: 'SET_ACTIVE_TAB', tab })
  }, [])

  const connectSocket = useCallback((): Socket | null => {
    const socket = io(state.backendUrl, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.on('connect', () => {
      if (state.selectedMatchId) socket.emit('join:match', { matchId: state.selectedMatchId });
    });
    socket.on('hype:update', (data: { homePool: number; awayPool: number }) => {
      dispatch({ type: 'SET_POOLS', home: data.homePool, away: data.awayPool });
    });
    return socket;
  }, [state.backendUrl, state.selectedMatchId, state.fixtures]);

  useEffect(() => {
    if (state.authToken && state.walletAddress) {
      api.checkAuth(state.backendUrl, state.authToken).then(data => {
        if (data) {
          dispatch({ type: 'SET_WALLET', address: data.wallet, token: state.authToken, provider: 'phantom' });
          dispatch({ type: 'SET_ONBOARDING', step: 3 });
        } else {
          localStorage.removeItem(STORAGE_AUTH_TOKEN);
          localStorage.removeItem(STORAGE_WALLET);
        }
      });
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_BACKEND_URL, state.backendUrl);
  }, [state.backendUrl]);

  return (
    <AppContext.Provider value={{
      state, dispatch,
      fetchAndSetFixtures, fetchAndSetFrames, sendTip: handleTip,
      claimWinnings: handleClaimWinnings,
      showToast, connectSocket,
      setActiveTab,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function getDevnetConnection() {
  return getConnection();
}