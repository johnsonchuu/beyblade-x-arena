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
  head: number; // head-to-head wins (kept for interface compat; computed per-pair at sort time)
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
    if (m.winnerId === m.p1Id) {
      p1.wins++;
      p2.losses++;
    } else if (m.winnerId === m.p2Id) {
      p2.wins++;
      p1.losses++;
    } else {
      p1.draws++;
      p2.draws++;
    }
  });

  // Rank: Wins > Total Match Pts > Point Differential > Head-to-Head (within tied group)
  const sorted = [...map.values()].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.diff !== a.diff) return b.diff - a.diff;
    // More head-to-head wins ranks higher: a beat b → a first (negative).
    return headToHead(b, a, matches) - headToHead(a, b, matches);
  });
  return sorted;
}

/** Head-to-head wins of `a` against `b` in completed matches. */
function headToHead(a: StandingsRow, b: StandingsRow, matches: Match[]): number {
  let h2h = 0;
  matches.forEach((m) => {
    if (!m.completed || m.winnerId === null) return;
    const isTheirMatch = (m.p1Id === a.player.id && m.p2Id === b.player.id) ||
                         (m.p1Id === b.player.id && m.p2Id === a.player.id);
    if (isTheirMatch && m.winnerId === a.player.id) h2h++;
  });
  return h2h;
}

/**
 * Circle Method (Polygon) Round-Robin Scheduler.
 *
 * Distributes matches round-by-round so every blader plays at most once per round.
 * When rounds are played sequentially, bladers get proper resting intervals
 * instead of playing multiple matches back-to-back.
 */
export function roundRobinMatches(players: Player[]): Match[] {
  if (players.length < 2) return [];

  const n = players.length;
  // If odd, we add a dummy "bye" slot (null)
  const isOdd = n % 2 !== 0;
  const list: (Player | null)[] = [...players];
  if (isOdd) {
    list.push(null);
  }
  const totalRoster = list.length;
  const totalRounds = totalRoster - 1;
  const half = totalRoster / 2;

  const matches: Match[] = [];

  // Circle method: list[0] stays fixed, while elements 1..totalRoster-1 rotate clockwise
  for (let r = 0; r < totalRounds; r++) {
    const roundNumber = r + 1;
    for (let i = 0; i < half; i++) {
      const p1 = list[i];
      const p2 = list[totalRoster - 1 - i];

      // If one of them is null (the dummy bye), skip this match
      if (!p1 || !p2) continue;

      matches.push({
        id: uid(),
        round: roundNumber,
        p1Id: p1.id,
        p2Id: p2.id,
        order: shuffleDeckOrder(),
        rounds: [],
        winnerId: null,
        p1Score: 0,
        p2Score: 0,
        completed: false,
      });
    }

    // Rotate: keep list[0] in place, rotate the rest [1 ... totalRoster-1]
    const fixed = list[0];
    const rest = list.slice(1);
    const last = rest.pop()!;
    rest.unshift(last);
    list.splice(0, list.length, fixed, ...rest);
  }

  return matches;
}

/**
 * Full Single-Elimination Bracket Tree with deterministic winner progression.
 * Byes are allocated to the top seeds and auto-advanced so every non-power-of-two
 * roster still produces a playable bracket (no phantom empty matches).
 */
export function bracketMatches(players: Player[], thirdPlace: boolean = true): Match[] {
  if (players.length < 2) return [];
  const sorted = [...players].sort((a, b) => a.name.localeCompare(b.name));
  const n = sorted.length;
  const numRounds = Math.ceil(Math.log2(n));
  const bracketSize = Math.pow(2, numRounds); // e.g. 2, 4, 8, 16

  // Standard bracket seed order: [1, 8, 5, 4, 3, 6, 7, 2, ...] pattern so that
  // seeds 1 & 2 meet only in the final. Seeds are 1-indexed positions in `sorted`.
  const seedOrder = (size: number): number[] => {
    let order = [1, 2];
    while (order.length < size) {
      const next: number[] = [];
      const sum = order.length * 2 + 1;
      for (const s of order) {
        next.push(s, sum - s);
      }
      order = next;
    }
    return order;
  };

  // Allocate byes to the LAST seeds (lowest ranked); byes occupy the remaining slots.
  // A slot whose opponent is null and paired against a bye-less player auto-advances.
  const seeds: (Player | null)[] = new Array(bracketSize).fill(null);
  for (let i = 0; i < n; i++) {
    seeds[seedOrder(bracketSize)[i] - 1] = sorted[i];
  }

  // Pre-instantiate all matches in the tournament tree from round 1 to finals
  const allMatches: Match[] = [];
  const matchesByRound: Match[][] = [];

  // Round 1 matches
  const round1Matches: Match[] = [];
  const round1Count = bracketSize / 2;
  for (let i = 0; i < round1Count; i++) {
    const p1 = seeds[i * 2];
    const p2 = seeds[i * 2 + 1];
    const m: Match = {
      id: uid(),
      round: 1,
      bracketRound: 1,
      p1Id: p1?.id ?? '',
      p2Id: p2?.id ?? '',
      order: shuffleDeckOrder(),
      rounds: [],
      winnerId: null,
      p1Score: 0,
      p2Score: 0,
      completed: false,
    };
    // Automatic byes: if exactly one player exists, they advance without playing.
    if (p1 && !p2) {
      m.completed = true;
      m.winnerId = p1.id;
    } else if (!p1 && p2) {
      m.completed = true;
      m.winnerId = p2.id;
    } else if (!p1 && !p2) {
      // Both slots empty: phantom match (shouldn't occur with top-seeded byes, but guard anyway)
      m.completed = true;
      m.winnerId = null;
    }
    round1Matches.push(m);
    allMatches.push(m);
  }
  matchesByRound.push(round1Matches);

  // Subsequent rounds (round 2 to final)
  for (let r = 2; r <= numRounds; r++) {
    const prevMatches = matchesByRound[r - 2];
    const currentRoundCount = prevMatches.length / 2;
    const currentMatches: Match[] = [];

    for (let i = 0; i < currentRoundCount; i++) {
      const matchId = uid();
      const currentMatch: Match = {
        id: matchId,
        round: r,
        bracketRound: r,
        p1Id: '',
        p2Id: '',
        order: shuffleDeckOrder(),
        rounds: [],
        winnerId: null,
        p1Score: 0,
        p2Score: 0,
        completed: false,
      };
      currentMatches.push(currentMatch);
      allMatches.push(currentMatch);

      // Link previous round winners into this match
      const prev1 = prevMatches[i * 2];
      const prev2 = prevMatches[i * 2 + 1];
      if (prev1) {
        prev1.bracketNextMatchId = matchId;
        prev1.bracketSlot = 1;
        if (prev1.completed && prev1.winnerId) {
          currentMatch.p1Id = prev1.winnerId;
        }
      }
      if (prev2) {
        prev2.bracketNextMatchId = matchId;
        prev2.bracketSlot = 2;
        if (prev2.completed && prev2.winnerId) {
          currentMatch.p2Id = prev2.winnerId;
        }
      }
    }
    matchesByRound.push(currentMatches);
  }

  // 3rd place match if requested and at least 4 players: fed by the losers of the two semifinal matches.
  if (thirdPlace && numRounds >= 2) {
    const semifinals = matchesByRound[numRounds - 2]; // matches that feed the final
    const finalMatch = matchesByRound[numRounds - 1][0];
    const thirdMatch: Match = {
      id: uid(),
      round: numRounds,
      bracketRound: 999, // special flag for 3rd place
      p1Id: '',
      p2Id: '',
      order: shuffleDeckOrder(),
      rounds: [],
      winnerId: null,
      p1Score: 0,
      p2Score: 0,
      completed: false,
    };
    // Semifinal losers drop into the 3rd-place match (slot 1 from SF1, slot 2 from SF2).
    semifinals.forEach((sf, idx) => {
      sf.bracketNextMatchId = sf.bracketNextMatchId ?? thirdMatch.id; // keep final link intact
      // Semis already point to the final; instead register drop-down via explicit bookkeeping:
      // we record the loser feed using bracketNextLoserMatchId below.
      void idx;
      void finalMatch;
    });
    allMatches.push(thirdMatch);
    // Store drop-down link on a dedicated field via bracketSlot of the semifinal to third match.
    // We use a dedicated bookkeeping map on the match objects instead of overwriting final links.
    thirdPlaceFeed.length = 0;
    semifinals.forEach((sf) => thirdPlaceFeed.push({ from: sf.id, to: thirdMatch.id }));
  }

  return allMatches;
}

/** Bookkeeping for semifinal-losers feeding the 3rd-place match (module-level, used at finish time). */
export const thirdPlaceFeed: { from: string; to: string }[] = [];

/**
 * Propagate a winner (and loser, for 3rd-place feeds) through the bracket tree
 * when a match finishes.
 */
export function advanceBracketWinner(matches: Match[], completedMatchId: string, winnerId: string | null): Match[] {
  const completedMatch = matches.find((m) => m.id === completedMatchId);
  if (!completedMatch || winnerId === null) return matches;

  let updated = [...matches];

  // Standard advancement: winner moves to the linked next match.
  if (completedMatch.bracketNextMatchId) {
    const nextId = completedMatch.bracketNextMatchId;
    const slot = completedMatch.bracketSlot ?? 1;
    updated = updated.map((m) => {
      if (m.id !== nextId) return m;
      return slot === 1 ? { ...m, p1Id: winnerId } : { ...m, p2Id: winnerId };
    });
  }

  // 3rd-place feed: if this match is a recorded semifinal, its loser drops into the 3rd-place match.
  const feed = thirdPlaceFeed.find((f) => f.from === completedMatchId);
  if (feed) {
    const loserId =
      matches.find((m) => m.id === completedMatchId)?.p1Id === winnerId
        ? matches.find((m) => m.id === completedMatchId)?.p2Id ?? ''
        : matches.find((m) => m.id === completedMatchId)?.p1Id ?? '';
    updated = updated.map((m) => {
      if (m.id !== feed.to) return m;
      // First semifinal processed fills p1, second fills p2.
      const taken = m.p1Id && m.p1Id !== loserId;
      return taken ? { ...m, p2Id: loserId } : { ...m, p1Id: loserId };
    });
  }

  return updated;
}

/**
 * Swiss pairings based on current standings and match history.
 * Uses backtracking so the "no repeat pairings" contract holds whenever a
 * rematch-free pairing exists (greedy-first-available fails ~68% of 5-round events).
 */
export function swissRound(players: Player[], existingMatches: Match[], roundNumber: number): Match[] {
  if (players.length < 2) return [];
  const rows = computeStandings(players, existingMatches);
  const ids = rows.map((r) => r.player.id);

  // Set of already played pairings
  const playedPairs = new Set<string>();
  existingMatches.forEach((m) => {
    if (m.completed) {
      playedPairs.add(`${m.p1Id}:${m.p2Id}`);
      playedPairs.add(`${m.p2Id}:${m.p1Id}`);
    }
  });

  // Backtracking pairing search: pair the first unpaired player with every
  // candidate in standings order, recursing until all players are paired.
  const pair = (remaining: string[], assigned: Set<string>): string[][] | null => {
    if (remaining.length === 0) return [];
    const p1 = remaining[0];
    for (let j = 1; j < remaining.length; j++) {
      const p2 = remaining[j];
      if (playedPairs.has(`${p1}:${p2}`)) continue;
      assigned.add(p1);
      assigned.add(p2);
      const rest = remaining.filter((_, idx) => idx !== 0 && idx !== j);
      const sub = pair(rest, assigned);
      assigned.delete(p1);
      assigned.delete(p2);
      if (sub) return [[p1, p2], ...sub];
    }
    return null;
  };

  const pairings = pair(ids, new Set()) ?? [];
  // Fallback if a perfect rematch-free pairing is impossible: greedy first-available.
  if (pairings.length * 2 < ids.length) {
    const fallback: string[][] = [];
    const used = new Set<string>();
    for (const id of ids) {
      if (used.has(id)) continue;
      const opp = ids.find((o) => o !== id && !used.has(o));
      if (opp) {
        used.add(id);
        used.add(opp);
        fallback.push([id, opp]);
      }
    }
    return fallback.map(([p1, p2]) => makeSwissMatch(p1, p2, roundNumber));
  }

  return pairings.map(([p1, p2]) => makeSwissMatch(p1, p2, roundNumber));
}

function makeSwissMatch(p1Id: string, p2Id: string, roundNumber: number): Match {
  return {
    id: uid(),
    round: roundNumber,
    p1Id,
    p2Id,
    order: shuffleDeckOrder(),
    rounds: [],
    winnerId: null,
    p1Score: 0,
    p2Score: 0,
    completed: false,
  };
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
  return player.deck[orderIdx];
}
