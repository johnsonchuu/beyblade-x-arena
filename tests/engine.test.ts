import type { Player, Match } from '../src/lib/types';
import {
  roundRobinMatches,
  bracketMatches,
  advanceBracketWinner,
  resetDownstreamBracketMatches,
  getNextReadyMatch,
  SAMPLE_ROSTER,
  ptsForFinish,
  swissRound,
  computeStandings,
  shuffleDeckOrder,
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

console.log('--- Testing Beyblade Engine ---');

// 1. Test Circle Round-Robin (Rest Balancing & Schedule Validity)
{
  console.log('1. Testing Round-Robin Rest Balancing...');
  const players = [
    makePlayer('p1', 'Tyson'),
    makePlayer('p2', 'Kai'),
    makePlayer('p3', 'Ray'),
    makePlayer('p4', 'Max'),
  ];
  const matches = roundRobinMatches(players);

  // 4 players in single round-robin = 4 * 3 / 2 = 6 matches total
  assert(matches.length === 6, `Expected 6 matches for 4 players, got ${matches.length}`);

  // Exactly 3 rounds of 2 matches each
  const round1 = matches.filter((m) => m.round === 1);
  const round2 = matches.filter((m) => m.round === 2);
  const round3 = matches.filter((m) => m.round === 3);
  assert(round1.length === 2, `Round 1 should have 2 matches, got ${round1.length}`);
  assert(round2.length === 2, `Round 2 should have 2 matches, got ${round2.length}`);
  assert(round3.length === 2, `Round 3 should have 2 matches, got ${round3.length}`);

  // In each round, every player plays at most once (no player plays twice in round 1)
  [round1, round2, round3].forEach((roundMatches, idx) => {
    const playersInRound = roundMatches.flatMap((m) => [m.p1Id, m.p2Id]);
    const unique = new Set(playersInRound);
    assert(
      unique.size === playersInRound.length,
      `Round ${idx + 1} has duplicate players in same round (rest violation)`
    );
  });
  console.log('✓ Round-robin circle scheduling passes with balanced rest.');
}

// 2. Test Odd Players Round-Robin (Bye allocation & Rest)
{
  console.log('2. Testing Odd-number Players Round-Robin...');
  const players = [
    makePlayer('p1', 'Tyson'),
    makePlayer('p2', 'Kai'),
    makePlayer('p3', 'Ray'),
  ];
  const matches = roundRobinMatches(players);
  // 3 players = 3 matches total (3 rounds, each round 1 match, 1 player rests)
  assert(matches.length === 3, `Expected 3 matches for 3 players, got ${matches.length}`);
  const rounds = new Set(matches.map((m) => m.round));
  assert(rounds.size === 3, 'Expected 3 distinct rounds for 3 players');
  console.log('✓ Odd player round-robin correctly allocates resting blader per round.');
}

// 3. Test Single-Elimination Bracket Progression
{
  console.log('3. Testing Bracket Generation & Winner Progression...');
  const players = [
    makePlayer('p1', 'A'),
    makePlayer('p2', 'B'),
    makePlayer('p3', 'C'),
    makePlayer('p4', 'D'),
  ];
  let matches = bracketMatches(players, true);

  // 4 players -> 2 semifinals + 1 final + 1 3rd place = 4 matches
  assert(matches.length === 4, `Expected 4 bracket matches, got ${matches.length}`);

  const semi1 = matches.find((m) => m.round === 1 && m.bracketSlot === 1 || (m.round === 1 && m.bracketNextMatchId))!;
  const semi2 = matches.filter((m) => m.round === 1)[1]!;
  const finalMatch = matches.find((m) => m.round === 2 && m.bracketRound !== 999)!;

  assert(finalMatch.p1Id === '' && finalMatch.p2Id === '', 'Final match should initially have empty slots');

  // Semi 1 completes: Winner is P1
  matches = advanceBracketWinner(matches, semi1.id, semi1.p1Id);
  const updatedFinal = matches.find((m) => m.id === finalMatch.id)!;
  assert(
    updatedFinal.p1Id === semi1.p1Id || updatedFinal.p2Id === semi1.p1Id,
    'Winner of semi 1 should advance to final'
  );
  console.log('✓ Bracket winner advancement passes.');
}

// 4. Test Standings & Tie-breakers
{
  console.log('4. Testing Standings, Points & Tie-breakers...');
  const players = [
    makePlayer('p1', 'Alpha'),
    makePlayer('p2', 'Beta'),
  ];
  const matches: Match[] = [
    {
      id: 'm1',
      round: 1,
      p1Id: 'p1',
      p2Id: 'p2',
      order: [0, 1, 2],
      rounds: [],
      winnerId: 'p1',
      p1Score: 4,
      p2Score: 1,
      completed: true,
    },
  ];

  const standings = computeStandings(players, matches);
  assert(standings[0].player.id === 'p1', 'Alpha should be 1st place');
  assert(standings[0].wins === 1, 'Alpha should have 1 win');
  assert(standings[0].pts === 4, 'Alpha should have 4 points');
  assert(standings[0].diff === 3, 'Alpha diff should be +3');
  assert(standings[1].losses === 1, 'Beta should have 1 loss');
  assert(standings[1].diff === -3, 'Beta diff should be -3');
  console.log('✓ Standings and score differentials pass.');
}

// 5. Test Swiss Round Pairings
{
  console.log('5. Testing Swiss Round Generation...');
  const players = [
    makePlayer('p1', 'Alpha'),
    makePlayer('p2', 'Beta'),
    makePlayer('p3', 'Gamma'),
    makePlayer('p4', 'Delta'),
  ];
  const round1 = swissRound(players, [], 1);
  assert(round1.length === 2, `Swiss round 1 should have 2 pairings, got ${round1.length}`);

  // Simulate round 1 completions
  round1[0].completed = true;
  round1[0].winnerId = round1[0].p1Id;
  round1[0].p1Score = 4;
  round1[0].p2Score = 2;

  round1[1].completed = true;
  round1[1].winnerId = round1[1].p1Id;
  round1[1].p1Score = 4;
  round1[1].p2Score = 0;

  // Generate round 2
  const round2 = swissRound(players, round1, 2);
  assert(round2.length === 2, `Swiss round 2 should have 2 pairings, got ${round2.length}`);
  console.log('✓ Swiss pairings pass.');
}

// 6. Test Bracket Downstream Reset and Ready Match Query
{
  console.log('6. Testing resetDownstreamBracketMatches and getNextReadyMatch...');
  const players = [
    makePlayer('p1', 'A'),
    makePlayer('p2', 'B'),
    makePlayer('p3', 'C'),
    makePlayer('p4', 'D'),
  ];
  let matches = bracketMatches(players, true);
  const semi1 = matches[0];
  matches = advanceBracketWinner(matches, semi1.id, semi1.p1Id);
  const finalBefore = matches.find((m) => m.bracketRound === 2)!;
  assert(finalBefore.p1Id === semi1.p1Id, 'Final should have semi 1 winner');

  // Reset semi 1
  matches = resetDownstreamBracketMatches(matches, semi1.id);
  const finalAfter = matches.find((m) => m.bracketRound === 2)!;
  assert(finalAfter.p1Id === '', 'Final should have cleared p1Id after reset');

  // Test getNextReadyMatch
  const nextReady = getNextReadyMatch({
    id: 't1',
    name: 'Test',
    format: 'single-elimination',
    targetScore: 4,
    createdAt: Date.now(),
    players,
    matches,
    activeMatchId: null,
  });
  assert(nextReady !== null && nextReady.p1Id !== '' && nextReady.p2Id !== '', 'Should find a ready match');
  console.log('✓ Bracket reset and next ready match helpers pass.');
}

// 7. Test SAMPLE_ROSTER
{
  console.log('7. Testing SAMPLE_ROSTER...');
  assert(SAMPLE_ROSTER.length === 4, `Expected 4 sample players, got ${SAMPLE_ROSTER.length}`);
  SAMPLE_ROSTER.forEach((p) => {
    assert(p.deck.length === 3, `Player ${p.name} should have 3 beys in deck`);
    p.deck.forEach((b) => {
      assert(b.blade !== '' && b.ratchet !== '' && b.bit !== '', 'Bey parts should not be empty');
    });
  });
  console.log('✓ Sample roster passes.');
}

// 8. Testing Undo Round score recalculation & replay reset
{
  console.log('8. Testing Undo Round score recalculation...');
  const match: Match = {
    id: 'm1',
    round: 1,
    p1Id: 'p1',
    p2Id: 'p2',
    order: [0, 1, 2],
    rounds: [
      { slot: 0, p1Bey: makePlayer('p1', 'A').deck[0], p2Bey: makePlayer('p2', 'B').deck[0], finish: 'BURST', winnerId: 'p1' },
      { slot: 1, p1Bey: makePlayer('p1', 'A').deck[1], p2Bey: makePlayer('p2', 'B').deck[1], finish: 'XTREME', winnerId: 'p2' },
    ],
    winnerId: null,
    p1Score: 2,
    p2Score: 3,
    completed: false,
  };

  // Simulate undo
  const remainingRounds = match.rounds.slice(0, -1);
  let p1Score = 0;
  let p2Score = 0;
  remainingRounds.forEach((r) => {
    if (r.winnerId === match.p1Id) p1Score += ptsForFinish(r.finish);
    else if (r.winnerId === match.p2Id) p2Score += ptsForFinish(r.finish);
  });
  assert(p1Score === 2, 'p1 score after undoing xtreme should be 2');
  assert(p2Score === 0, 'p2 score after undoing xtreme should be 0');
  console.log('✓ Round undo score recalculation passes.');
}

console.log('ALL ENGINE TESTS PASSED SUCCESSFULLY! 🚀');
