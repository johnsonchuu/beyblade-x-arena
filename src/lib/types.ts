// Core domain types for Beyblade X Tournament Manager

export type FinishType = 'SPIN' | 'OVER' | 'BURST' | 'XTREME' | 'DRAW';
export type Format = 'round-robin' | 'single-elimination' | 'swiss';

export interface BeyPart {
  name: string;
  series: 'BX' | 'UX' | 'CX';
  kind: 'blade' | 'ratchet' | 'bit';
}

export interface Bey {
  id: string;
  blade: string; // e.g. "Dran Buster"
  ratchet: string; // e.g. "1-60A"
  bit: string; // e.g. "Low Flat"
}

export interface Player {
  id: string;
  name: string;
  deck: [Bey, Bey, Bey];
}

export interface Match {
  id: string;
  round: number;
  p1Id: string;
  p2Id: string;
  /** deck slot order (0-based) for the blind selection sequence */
  order: number[];
  rounds: MatchRound[];
  winnerId: string | null;
  p1Score: number;
  p2Score: number;
  completed: boolean;
  /** for brackets: path/bracket bookkeeping */
  bracketRound?: number;
}

export interface MatchRound {
  slot: number; // which deck slot was used
  p1Bey: Bey;
  p2Bey: Bey;
  finish: FinishType;
  /** which player won this round; null for draw */
  winnerId: string | null;
}

export interface Tournament {
  id: string;
  name: string;
  format: Format;
  targetScore: number;
  createdAt: number;
  players: Player[];
  matches: Match[];
  activeMatchId: string | null;
}

export interface AppState {
  players: Player[];
  tournaments: Tournament[];
  activeTournamentId: string | null;
}
