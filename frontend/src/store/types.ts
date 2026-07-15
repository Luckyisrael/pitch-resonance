export interface Fixture {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: string;
  matchDate: string | null;
  totalFrames: number | null;
  winner: number | null;
  homePool: number;
  awayPool: number;
  isLive?: boolean;
}

export interface PhysicsFrame {
  seq: number;
  clockSec: number;
  phase: number;
  homeScore: number;
  awayScore: number;
  ballX: number;
  ballY: number;
  territoryFactor: number;
  quadrants: [number, number, number, number];
  turfAmplitude: number;
  waveAngle: number;
  waveFrequency: number;
  rippleAge: number;
  possession: number;
  action: string | null;
  team: number | null;
  shotPower: number;
  cornerIndicator: number;
  foulPulse: number;
  cardFlash: number;
  attackIntensity: number;
  momentumVector: { x: number; y: number };
  ballVelX: number;
  ballVelY: number;
  ballSpeed: number;
  shotsHome: number;
  shotsAway: number;
  cornersHome: number;
  cornersAway: number;
  foulsHome: number;
  foulsAway: number;
  homeYellowCards: number;
  homeRedCards: number;
  awayYellowCards: number;
  awayRedCards: number;
  homeMomentum: number;
  awayMomentum: number;
  momentumShift: number;
  homePressure: number;
  awayPressure: number;
  smoothBallVelX: number;
  smoothBallVelY: number;
  smoothBallSpeed: number;
  smoothTerritory: number;
  territoryMomentum: number;
  matchIntensity: number;
  matchFlowMultiplier: number;
}

export interface TimelineFrame {
  minute: number;
  timeString: string;
  period: string;
  scoreHome: number;
  scoreAway: number;
  isGoal: boolean;
  goalEvent?: {
    minute: number;
    scorer: string;
    team: 'home' | 'away';
    teamName: string;
  };
  territoryCenter: number;
  leftHeight: number;
  rightHeight: number;
  attackDirection: 'home' | 'away' | 'neutral';
  ballX3d?: number;
  ballZ3d?: number;
  lastAction: string | null;
  lastActionTeam: 'home' | 'away' | null;
  shotPower: number;
  isCorner: boolean;
  isFoul: boolean;
  isCard: boolean;
  cardType: 'yellow' | 'red' | null;
  cardTeam: 'home' | 'away' | null;
  buildupIntensity: number;
  momentumDirection: number;
  waveFrequency: number;
  waveAngle: number;
  rippleAge: number;
  turfAmplitude: number;
  ballVelX: number;
  ballVelY: number;
  ballSpeed: number;
  homeMomentum: number;
  awayMomentum: number;
  momentumShift: number;
  homePressure: number;
  awayPressure: number;
  smoothBallVelX: number;
  smoothBallVelY: number;
  smoothBallSpeed: number;
  matchIntensity: number;
  matchFlowMultiplier: number;
  stats: {
    xgHome: number;
    xgAway: number;
    shotsHome: number;
    shotsAway: number;
    cornersHome: number;
    cornersAway: number;
    cardsHome: number;
    cardsAway: number;
    foulsHome: number;
    foulsAway: number;
    homeYellowCards: number;
    homeRedCards: number;
    awayYellowCards: number;
    awayRedCards: number;
  };
}

export interface TxItem {
  id: string;
  team: 'home' | 'away';
  teamName: string;
  amount: number;
  sig: string;
  timestamp: string;
}

export interface ToastState {
  show: boolean;
  message: string;
  type: 'success' | 'info' | 'error';
}

export interface BulkSeedProgress {
  current: number;
  total: number;
  currentMatch: string;
}

export type TeamSide = 'home' | 'away';

export type WalletProvider = 'phantom' | '';
