import type { Match, Player, Format } from './types';

export const TARGET_SCORE_OPTIONS = [4, 5, 6, 7];

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** Stadium-style standings row. */
export interface StandingsRow {
  player: Player;
  wins: number;
  losses: number;
  draws: number;
  pts: number; // total match points (sum of scores)
  diff: number; // point differential
  head: number; // head-to-head wins (computed later)
  matchesPlayed: number;
}

export function computeStandings(players: Player[], matches: Match[]): StandingsRow[] {
  const map = new Map<string, StandingsRow>();
  players.forEach((p) =>
    map.set(p.id, { player: p, wins: 0, losses: 0, draws: 0, pts: 0, diff: 0, head: 0, matchesPlayed: 0 })
  );

  matches.forEach((m) => {
    if (!m.completed) return;
    const p1 = map.get(m.p1Id);
    const p2 = map.get(m.p2Id);
    if (!p1 || !p2) return;
    p1.matchesPlayed++;
    p2.matchesPlayed++;
    p1.pts += m.p1Score;
    p2.pts += m.p2Score;
    p1.diff += m.p1Score - m.p2Score;
    p2.diff += m.p2Score - m.p1Score;
    if (m.winnerId === m.p1Id) p1.wins++;
    else if (m.winnerId === m.p2Id) p2.wins++;
    else {
      p1.draws++;
      p2.draws++;
    }
  });

  // Head-to-head: for each pair with a decisive result, credit the winner.
  matches.forEach((m) => {
    if (!m.completed || m.winnerId === null) return;
    const winner = map.get(m.winnerId);
    if (winner) winner.head++;
  });

  // Rank: Wins > Total Match Pts > Point Differential > Head-to-Head
  const sorted = [...map.values()].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.diff !== a.diff) return b.diff - a.diff;
    return b.head - a.head;
  });
  return sorted;
}

/** Full round-robin schedule (double=home/away not needed — single round). */
export function roundRobinMatches(players: Player[]): Match[] {
  const matches: Match[] = [];
  let round = 1;
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      matches.push({
        id: uid(),
        round,
        p1Id: players[i].id,
        p2Id: players[j].id,
        order: [0, 1, 2],
        rounds: [],
        winnerId: null,
        p1Score: 0,
        p2Score: 0,
        completed: false,
      });
      round++;
    }
  }
  return matches;
}

/** Single-elimination bracket scaffold. */
export function bracketMatches(players: Player[], thirdPlace: boolean): Match[] {
  const sorted = [...players].sort((a, b) => a.name.localeCompare(b.name));
  const n = sorted.length;
  const nextPow2 = Math.pow(2, Math.ceil(Math.log2(n)));
  const byes = nextPow2 - n;
  // seed: byes go to top seeds, everyone else fills bottom-up for stability
  const seeded: (Player | null)[] = new Array(nextPow2).fill(null);
  let idx = 0;
  for (let i = 0; i < byes; i++) seeded[idx++] = sorted[i];
  for (let i = nextPow2 - 1; i >= 0 && idx < nextPow2; i--) {
    if (!seeded[i]) seeded[i] = sorted[idx++];
  }
  const matches: Match[] = [];
  let round = 1;
  for (let i = 0; i < nextPow2; i += 2) {
    const p1 = seeded[i];
    const p2 = seeded[i + 1];
    if (!p1 && !p2) continue;
    matches.push({
      id: uid(),
      round,
      p1Id: p1?.id ?? '',
      p2Id: p2?.id ?? '',
      order: [0, 1, 2],
      rounds: [],
      winnerId: null,
      p1Score: 0,
      p2Score: 0,
      completed: false,
      bracketRound: 1,
    });
    round++;
  }
  if (thirdPlace) {
    matches.push({
      id: uid(),
      round: 999,
      p1Id: '',
      p2Id: '',
      order: [0, 1, 2],
      rounds: [],
      winnerId: null,
      p1Score: 0,
      p2Score: 0,
      completed: false,
      bracketRound: 3,
    });
  }
  return matches;
}

/** Swiss pairings based on current standings (simple: group by score then pair). */
export function swissRound(players: Player[], matches: Match[], round: number): Match[] {
  const rows = computeStandings(players, matches);
  const out: Match[] = [];
  const used = new Set<string>();
  rows.forEach((r) => {
    if (used.has(r.player.id)) return;
    // find best available opponent with a different id not yet assigned
    const first = rows.find((o) => o.player.id !== r.player.id && !used.has(o.player.id));
    if (!first) return;
    used.add(r.player.id);
    used.add(first.player.id);
    out.push({
      id: uid(),
      round,
      p1Id: r.player.id,
      p2Id: first.player.id,
      order: [0, 1, 2],
      rounds: [],
      winnerId: null,
      p1Score: 0,
      p2Score: 0,
      completed: false,
    });
  });
  return out;
}

/** Randomize the deck-slot order for blind selection each match. */
export function shuffleDeckOrder(): number[] {
  const arr = [0, 1, 2];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function formatLabel(f: Format): string {
  return { 'round-robin': 'Round Robin', 'single-elimination': 'Single Elimination', swiss: 'Swiss System' }[f];
}

export function playerName(players: Player[], id: string): string {
  return players.find((p) => p.id === id)?.name ?? '—';
}

export function findPlayerDeck(player: Player, orderIdx: number): Player['deck'][number] {
  // order is a permutation of [0,1,2]; return the bey for that slot
  return player.deck[orderIdx];
}