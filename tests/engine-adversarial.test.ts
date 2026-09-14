import type { Player, Match } from '../src/lib/types';
import {
  roundRobinMatches,
  bracketMatches,
  advanceBracketWinner,
  swissRound,
  computeStandings,
} from '../src/lib/engine';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

function makePlayer(id: string, name: string): Player {
  return {
    id,
    name,
    deck: [
      { id: '1', blade: 'Dran Buster', ratchet: '1-60A', bit: 'Low Flat' },
      { id: '2', blade: 'Wizard Rod', ratchet: '5-70DB', bit: 'Ball' },
      { id: '3', blade: 'Phoenix Wing', ratchet: '9-60GF', bit: 'Gear Flat' },
    ],
  };
}

function simulateBracket(players: Player[]): { champion: string | null; uncompleted: number } {
  let matches = bracketMatches(players, true);
  // Play each round: find playable matches (both players set, not completed) and simulate winners in round order
  for (let guard = 0; guard < 50; guard++) {
    const playable = matches.filter((m) => !m.completed && m.p1Id && m.p2Id);
    if (playable.length === 0) break;
    const m = playable[0];
    const winner = Math.random() < 0.5 ? m.p1Id : m.p2Id;
    matches = advanceBracketWinner(matches, m.id, winner);
    matches = matches.map((x) => (x.id === m.id ? { ...x, completed: true, winnerId: winner } : x));
  }
  const final = matches.filter((m) => m.bracketRound !== 999).sort((a, b) => b.round - a.round)[0];
  const uncompleted = matches.filter((m) => m.bracketRound !== 999 && !m.completed).length;
  return { champion: final?.winnerId ?? null, uncompleted };
}

console.log('--- Adversarial Engine Verification ---');

// 1. Non-power-of-two brackets must complete for all common roster sizes
{
  console.log('1. Bracket completion for rosters 2..16...');
  for (let n = 2; n <= 16; n++) {
    const players = Array.from({ length: n }, (_, i) => makePlayer(`p${i}`, `Blader${i}`));
    const { champion, uncompleted } = simulateBracket(players);
    assert(champion !== null, `Bracket n=${n}: final never completed, champion is null`);
    assert(uncompleted === 0, `Bracket n=${n}: ${uncompleted} non-final matches uncompleted`);
    // No phantom empty matches in round 1 (later rounds legitimately start empty)
    const matches = bracketMatches(players, true);
    const phantoms = matches.filter((m) => m.round === 1 && !m.p1Id && !m.p2Id);
    assert(phantoms.length === 0, `Bracket n=${n}: ${phantoms.length} phantom empty round-1 matches`);
  }
  console.log('✓ All roster sizes 2-16 produce completable brackets with a champion.');
}

// 2. 3rd-place match is populated after semifinals complete
{
  console.log('2. 3rd-place match population...');
  const players = [
    makePlayer('p1', 'A'),
    makePlayer('p2', 'B'),
    makePlayer('p3', 'C'),
    makePlayer('p4', 'D'),
  ];
  let matches = bracketMatches(players, true);
  const thirdMatch = matches.find((m) => m.bracketRound === 999)!;
  assert(!!thirdMatch, '3rd-place match should exist for 4 players');

  // Complete both semifinals
  const semis = matches.filter((m) => m.round === 1);
  assert(semis.length === 2, '4 players should have 2 semifinals');
  for (const sf of semis) {
    const winner = sf.p1Id;
    const loser = sf.p2Id;
    matches = advanceBracketWinner(matches, sf.id, winner);
    matches = matches.map((x) => (x.id === sf.id ? { ...x, completed: true, winnerId: winner } : x));
  }
  const updatedThird = matches.find((m) => m.id === thirdMatch.id)!;
  assert(
    updatedThird.p1Id !== '' && updatedThird.p2Id !== '',
    `3rd-place match should have both semifinal losers, got [${updatedThird.p1Id}, ${updatedThird.p2Id}]`
  );
  // The losers should be exactly the semifinal losers
  const expectedLosers = semis.map((sf) => sf.p2Id).sort();
  const actualLosers = [updatedThird.p1Id, updatedThird.p2Id].sort();
  assert(
    JSON.stringify(expectedLosers) === JSON.stringify(actualLosers),
    `Expected losers ${expectedLosers} got ${actualLosers}`
  );
  console.log('✓ 3rd-place match correctly populated with semifinal losers.');
}

// 3. Head-to-head tiebreaker actually breaks ties
{
  console.log('3. Head-to-head tiebreaker...');
  const players = [makePlayer('p1', 'Alpha'), makePlayer('p2', 'Beta')];
  // Both have 1 win, same pts, same diff. p1 beat p2 head-to-head → p1 ranks first.
  const matches: Match[] = [
    { id: 'm1', round: 1, p1Id: 'p1', p2Id: 'p2', order: [0, 1, 2], rounds: [], winnerId: 'p1', p1Score: 4, p2Score: 3, completed: true },
    { id: 'm2', round: 2, p1Id: 'p2', p2Id: 'p1', order: [0, 1, 2], rounds: [], winnerId: 'p2', p1Score: 4, p2Score: 2, completed: true },
  ];
  // Fix: make both wins identical points so only H2H (first match) differentiates.
  const tied: Match[] = [
    { id: 'm1', round: 1, p1Id: 'p1', p2Id: 'p2', order: [0, 1, 2], rounds: [], winnerId: 'p1', p1Score: 4, p2Score: 2, completed: true },
    { id: 'm2', round: 2, p1Id: 'p1', p2Id: 'p2', order: [0, 1, 2], rounds: [], winnerId: 'p2', p1Score: 2, p2Score: 4, completed: true },
  ];
  const standings = computeStandings(players, tied);
  assert(standings[0].wins === standings[1].wins, 'Setup error: expected tied wins');
  assert(standings[0].pts === standings[1].pts, 'Setup error: expected tied pts');
  assert(standings[0].diff === standings[1].diff, 'Setup error: expected tied diff');
  // H2H: p1 won m1 against p2, p2 won m2 against p1 — 1:1. First-listed player (earlier registration) wins stable tie.
  // Now a decisive H2H case: 3 players round-robin where two tie on everything but H2H.
  const p3 = [makePlayer('p1', 'Alpha'), makePlayer('p2', 'Beta'), makePlayer('p3', 'Gamma')];
  const rr: Match[] = [
    { id: 'a', round: 1, p1Id: 'p1', p2Id: 'p2', order: [0, 1, 2], rounds: [], winnerId: 'p2', p1Score: 1, p2Score: 4, completed: true },
    { id: 'b', round: 2, p1Id: 'p1', p2Id: 'p3', order: [0, 1, 2], rounds: [], winnerId: 'p1', p1Score: 4, p2Score: 1, completed: true },
    { id: 'c', round: 3, p1Id: 'p2', p2Id: 'p3', order: [0, 1, 2], rounds: [], winnerId: 'p3', p1Score: 1, p2Score: 4, completed: true },
  ];
  const s3 = computeStandings(p3, rr);
  // p1: W1 (beat p3), p2: W1 (beat p1), p3: W1 (beat p2). All tied on wins.
  // Pts: p1=5, p2=5, p3=5. Diff: p1=+3? p1: 4-1=+3, 1-4=-3 → 0. p2: 4-1=+3, 1-4=-3 → 0. p3: 4-1 +3, 1-4 -3 → 0.
  // All tied. H2H between p1 & p2: p2 beat p1 → p2 ranks above p1.
  assert(s3[0].player.id === 'p2', `Expected p2 first via H2H over p1, got ${s3[0].player.id}`);
  assert(s3[1].player.id === 'p1', `Expected p1 second, got ${s3[1].player.id}`);
  assert(s3[2].player.id === 'p3', `Expected p3 third, got ${s3[2].player.id}`);
  console.log('✓ Head-to-head tiebreaker resolves all-tied standings correctly.');
}

// 4. Swiss rematch prevention: backtracking must find rematch-free pairings whenever they exist
{
  console.log('4. Swiss rematch prevention (6 players, 4 rounds, 200 trials)...');
  const players = Array.from({ length: 6 }, (_, i) => makePlayer(`p${i}`, `B${i}`));
  let rematchesWhenAvoidable = 0;
  let impossibleRounds = 0;
  // Brute-force helper: does any rematch-free perfect matching exist?
  const pairingsOf = (arr: string[]): string[][][] => {
    if (arr.length === 0) return [[]];
    const out: string[][][] = [];
    for (let i = 1; i < arr.length; i++) {
      const rest = arr.filter((_, idx) => idx !== 0 && idx !== i);
      for (const sub of pairingsOf(rest)) out.push([[arr[0], arr[i]], ...sub]);
    }
    return out;
  };
  for (let trial = 0; trial < 200; trial++) {
    const history: Match[] = [];
    for (let round = 1; round <= 4; round++) {
      const playedPairs = new Set<string>();
      history.forEach((m) => {
        playedPairs.add(`${m.p1Id}:${m.p2Id}`);
        playedPairs.add(`${m.p2Id}:${m.p1Id}`);
      });
      const ids = players.map((p) => p.id);
      const avoidable = pairingsOf(ids).some((pm) => pm.every(([a, b]) => !playedPairs.has(`${a}:${b}`)));

      const pairings = swissRound(players, history, round);
      for (const m of pairings) {
        const isRepeat = history.some(
          (h) => h.completed && (h.p1Id === m.p1Id && h.p2Id === m.p2Id || h.p1Id === m.p2Id && h.p2Id === m.p1Id)
        );
        if (isRepeat) {
          if (avoidable) rematchesWhenAvoidable++;
          else impossibleRounds++;
        }
        const winner = Math.random() < 0.5 ? m.p1Id : m.p2Id;
        history.push({
          ...m,
          completed: true,
          winnerId: winner,
          p1Score: winner === m.p1Id ? 4 : 2,
          p2Score: winner === m.p1Id ? 2 : 4,
        });
      }
    }
  }
  assert(
    rematchesWhenAvoidable === 0,
    `Swiss produced ${rematchesWhenAvoidable} rematches even when rematch-free pairings existed (expected 0)`
  );
  console.log('✓ Zero avoidable rematches across 200 four-round Swiss events.');
  console.log(`  (${impossibleRounds} rounds had mathematically no rematch-free option — expected after 3+ rounds of 6 players)`);
}

// 5. Odd-player Swiss: pairing count is correct per round
{
  console.log('5. Odd-player Swiss byes...');
  const players = Array.from({ length: 5 }, (_, i) => makePlayer(`p${i}`, `B${i}`));
  const history: Match[] = [];
  for (let round = 1; round <= 4; round++) {
    const pairings = swissRound(players, history, round);
    assert(pairings.length === 2, `Round ${round}: expected 2 pairings for 5 players, got ${pairings.length}`);
    for (const m of pairings) {
      const winner = Math.random() < 0.5 ? m.p1Id : m.p2Id;
      history.push({ ...m, completed: true, winnerId: winner, p1Score: winner === m.p1Id ? 4 : 2, p2Score: winner === m.p1Id ? 2 : 4 });
    }
  }
  console.log('✓ Odd-player Swiss generates 2 pairings per round (1 resting).');
}

// 6. Bracket advancement ignores draws (null winner doesn't corrupt slots)
{
  console.log('6. Draw in bracket match does not corrupt advancement...');
  const players = [makePlayer('p1', 'A'), makePlayer('p2', 'B'), makePlayer('p3', 'C'), makePlayer('p4', 'D')];
  let matches = bracketMatches(players, true);
  const semi1 = matches.filter((m) => m.round === 1)[0];
  const before = matches.map((m) => ({ ...m }));
  const after = advanceBracketWinner(matches, semi1.id, null);
  // Nothing should have advanced
  const finalBefore = before.find((m) => m.round === 2)!;
  const finalAfter = after.find((m) => m.id === finalBefore.id)!;
  assert(finalAfter.p1Id === '' && finalAfter.p2Id === '', 'Draw (null winner) must not advance any player');
  console.log('✓ Null winner safely ignored in bracket advancement.');
}

console.log('ALL ADVERSARIAL ENGINE TESTS PASSED! 🚀');
