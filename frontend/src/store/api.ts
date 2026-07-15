import { Fixture, PhysicsFrame } from './types';

const SOLSCAN_TX = (sig: string) => `https://solscan.io/tx/${sig}?cluster=devnet`;

export async function fetchFixtures(baseUrl: string): Promise<Fixture[]> {
  const res = await fetch(`${baseUrl}/api/matches`);
  if (!res.ok) throw new Error(`Failed to fetch matches: ${res.statusText}`);
  const data = await res.json();
  return (data.matches || data) as Fixture[];
}

export async function fetchPhysicsFrames(
  baseUrl: string,
  matchId: string,
  stride = 1
): Promise<{ frames: PhysicsFrame[]; homeScore: number; awayScore: number }> {
  const res = await fetch(`${baseUrl}/api/physics/frames/${matchId}?stride=${stride}`);
  if (res.status === 404) return { frames: [], homeScore: 0, awayScore: 0 };
  if (!res.ok) throw new Error(`Failed to fetch frames: ${res.statusText}`);
  const data = await res.json();
  if (Array.isArray(data)) return { frames: data as PhysicsFrame[], homeScore: 0, awayScore: 0 };
  return { frames: (data.frames || []) as PhysicsFrame[], homeScore: data.homeScore ?? 0, awayScore: data.awayScore ?? 0 };
}

export async function fetchNonce(baseUrl: string, wallet: string): Promise<{ nonce: string; id: string; message: string }> {
  const res = await fetch(`${baseUrl}/api/auth/nonce`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet }),
  });
  if (!res.ok) throw new Error(`Nonce request failed: ${res.statusText}`);
  return res.json();
}

export async function verifySignature(
  baseUrl: string,
  wallet: string,
  signature: string,
  nonce: string
): Promise<{ token: string; wallet: string }> {
  const res = await fetch(`${baseUrl}/api/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet, signature, nonce }),
  });
  if (!res.ok) throw new Error(`Verification failed: ${res.statusText}`);
  return res.json();
}

export async function checkAuth(baseUrl: string, token: string): Promise<{ wallet: string } | null> {
  try {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/** Send a real tx signature to the backend for verification */
export async function sendTipSignature(
  baseUrl: string,
  matchId: string,
  team: 'home' | 'away',
  signature: string
): Promise<{ success: boolean; amount: number; lamports: number; explorerUrl: string | null }> {
  const res = await fetch(`${baseUrl}/api/hype/tip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ matchId, team, signature }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Tip verification failed');
  }
  return res.json();
}

/** Claim winnings for a settled match */
export async function claimWinnings(
  baseUrl: string,
  matchId: string,
  token: string
): Promise<{ success: boolean; amount: number; lamports: number; signature: string; explorerUrl: string; claimedTips: number }> {
  const res = await fetch(`${baseUrl}/api/hype/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ matchId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Claim failed');
  }
  return res.json();
}

/** Get pool stats + user tips for a match */
export async function getPoolStats(
  baseUrl: string,
  matchId: string,
  token: string
): Promise<{
  matchId: string;
  homePool: number;
  awayPool: number;
  userStakeHome: number;
  userStakeAway: number;
  userUnclaimedHome: number;
  userUnclaimedAway: number;
  winner: number | null;
  settled: boolean;
}> {
  const res = await fetch(`${baseUrl}/api/hype/pools/${matchId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch pool stats');
  return res.json();
}

/** Request devnet SOL airdrop for testing */
export async function requestFaucet(
  baseUrl: string,
  token: string
): Promise<{ success: boolean; signature: string; explorerUrl: string }> {
  const res = await fetch(`${baseUrl}/api/hype/faucet`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Faucet request failed');
  }
  return res.json();
}

/** Fetch board/leaderboard aggregate stats */
export async function fetchBoardStats(baseUrl: string): Promise<{
  totalMatches: number;
  settledMatches: number;
  totalGoals: number;
  totalTips: number;
  totalTipCount: number;
  uniqueTippers: number;
  topTippers: Array<{ wallet: string; totalTips: number; tipCount: number; wins: number }>;
  matchResults: Array<{
    matchId: string; homeTeam: string; awayTeam: string;
    homeScore: number; awayScore: number; matchDate: string | null;
    winner: number | null; settled: boolean;
  }>;
}> {
  const res = await fetch(`${baseUrl}/api/board/stats`);
  if (!res.ok) throw new Error('Failed to fetch board stats');
  return res.json();
}

export { SOLSCAN_TX };