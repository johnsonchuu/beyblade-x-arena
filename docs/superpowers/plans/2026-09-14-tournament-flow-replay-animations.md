# Beyblade X Tournament Flow, Replay, Animations & E2E Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a sequential 1-by-1 match queue (Bug 1), match replay & in-arena editing (Bug 2), high-impact arcade finish animations with sound (Enhancement 1), and complete E2E organizer polish (Arena Undo, Proceed to Next Match, On-Deck banner, Champions Podium, and Sample Roster presets).

**Architecture:** 
- Extend `engine.ts` with bracket downstream reset logic, ready match querying, and competitive blader preset templates.
- Enhance `App.tsx` reducer with `UNDO_ROUND`, `REPLAY_MATCH`, `EDIT_MATCH_IN_ARENA`, and `LOAD_SAMPLE_ROSTER` actions.
- Update `Dashboard.tsx` to display a single-column linear queue numbered `Match 1` to `Match N`, an On-Deck banner, a match summary & replay modal, and a finale celebration podium.
- Upgrade `MatchArena.tsx` with full-screen dynamic overlay finish animations (Xtreme, Burst, Over, Spin, Draw), in-arena "Undo Last Round", and direct "Proceed to Next Match" flow.
- Add complete bilingual i18n support in `src/lib/i18n.tsx`.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Lucide icons, Web Audio API, Vitest/tsx test runner, Vite.

## Global Constraints

- Never break existing tournament formats: Round Robin, Single Elimination, and Swiss must all generate valid 1-by-1 match sequences.
- Keep rest-balanced scheduling principles intact: bladers should not play back-to-back when other matches are ready.
- Standings must automatically recalculate correctly whenever a match is replayed or edited.
- Single elimination bracket resets must recursively clear downstream matches when an earlier match winner changes.
- In-arena animations must auto-dismiss within ~1.2 seconds or dismiss instantly on tap so the referee is never blocked.
- 100% type-safe with zero TypeScript errors on `npm run build`.

---

### Task 1: Engine Helpers — Bracket Downstream Reset, Ready Match Finder, and Sample Roster Presets

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/engine.ts`
- Test: `tests/engine.test.ts`

**Interfaces:**
- Consumes: `Match`, `Tournament`, `Player` from `src/lib/types.ts`
- Produces:
  - `resetDownstreamBracketMatches(matches: Match[], completedMatchId: string): Match[]`
  - `getNextReadyMatch(tournament: Tournament): Match | null`
  - `SAMPLE_ROSTER: Player[]`
  - `ptsForFinish(finish: FinishType): number` (exported from engine for shared reducer use)

- [ ] **Step 1: Write the failing tests for the new engine helpers in `tests/engine.test.ts`**

Add tests for:
1. `resetDownstreamBracketMatches`: verify that resetting a semifinal match clears the finalists that advanced from it.
2. `getNextReadyMatch`: verify that it returns the first uncompleted match with both players populated.
3. `SAMPLE_ROSTER`: verify 4 players with full 3-bey decks are provided.

```typescript
// Add to tests/engine.test.ts:
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:engine`  
Expected: FAIL with "resetDownstreamBracketMatches is not defined"

- [ ] **Step 3: Implement `resetDownstreamBracketMatches`, `getNextReadyMatch`, `ptsForFinish`, and `SAMPLE_ROSTER` in `src/lib/engine.ts`**

Export `ptsForFinish`:
```typescript
export function ptsForFinish(f: FinishType): number {
  switch (f) {
    case 'SPIN':
      return 1;
    case 'BURST':
    case 'OVER':
      return 2;
    case 'XTREME':
      return 3;
    case 'DRAW':
    default:
      return 0;
  }
}
```

Implement `resetDownstreamBracketMatches`:
```typescript
export function resetDownstreamBracketMatches(matches: Match[], sourceMatchId: string): Match[] {
  let updated = [...matches];
  const source = updated.find((m) => m.id === sourceMatchId);
  if (!source) return updated;

  // Clear winner and completion of source
  updated = updated.map((m) => (m.id === sourceMatchId ? { ...m, completed: false, winnerId: null } : m));

  const targetMatchIds: string[] = [];
  if (source.bracketNextMatchId) targetMatchIds.push(source.bracketNextMatchId);
  const thirdFeed = thirdPlaceFeed.find((f) => f.from === sourceMatchId);
  if (thirdFeed) targetMatchIds.push(thirdFeed.to);

  for (const targetId of targetMatchIds) {
    const target = updated.find((m) => m.id === targetId);
    if (!target) continue;
    // Clear slot in target
    const slot = source.bracketSlot ?? 1;
    updated = updated.map((m) => {
      if (m.id !== targetId) return m;
      return slot === 1 ? { ...m, p1Id: '', completed: false, winnerId: null, rounds: [], p1Score: 0, p2Score: 0 }
                        : { ...m, p2Id: '', completed: false, winnerId: null, rounds: [], p1Score: 0, p2Score: 0 };
    });
    // Recursively clear downstream of the target
    updated = resetDownstreamBracketMatches(updated, targetId);
  }
  return updated;
}
```

Implement `getNextReadyMatch`:
```typescript
export function getNextReadyMatch(tournament: Tournament): Match | null {
  return tournament.matches.find((m) => !m.completed && Boolean(m.p1Id) && Boolean(m.p2Id)) ?? null;
}
```

Implement `SAMPLE_ROSTER`:
```typescript
export const SAMPLE_ROSTER: Player[] = [
  {
    id: 'sample-1',
    name: 'Kamen X',
    deck: [
      { id: 'bx-1', blade: 'Dran Buster', ratchet: '1-60A', bit: 'Accel' },
      { id: 'bx-2', blade: 'Dran Dagger', ratchet: '4-60R', bit: 'Rush' },
      { id: 'bx-3', blade: 'Dran Sword', ratchet: '3-60F', bit: 'Flat' },
    ],
  },
  {
    id: 'sample-2',
    name: 'Multi Nanairo',
    deck: [
      { id: 'ux-1', blade: 'Wizard Rod', ratchet: '5-70DB', bit: 'Ball' },
      { id: 'ux-2', blade: 'Knight Mail', ratchet: '3-85BS', bit: 'Bound Spike' },
      { id: 'ux-3', blade: 'Viper Tail', ratchet: '5-80O', bit: 'Orb' },
    ],
  },
  {
    id: 'sample-3',
    name: 'Bird Kazami',
    deck: [
      { id: 'bx-4', blade: 'Hells Chain', ratchet: '5-60HT', bit: 'High Taper' },
      { id: 'bx-5', blade: 'Hells Scythe', ratchet: '4-60T', bit: 'Taper' },
      { id: 'bx-6', blade: 'Hells Hammer', ratchet: '3-70H', bit: 'Hexa' },
    ],
  },
  {
    id: 'sample-4',
    name: 'Chrome Ryugu',
    deck: [
      { id: 'cx-1', blade: 'Cobalt Dragoon', ratchet: '2-60C', bit: 'Cyclone' },
      { id: 'cx-2', blade: 'Phoenix Wing', ratchet: '9-60GF', bit: 'Gear Flat' },
      { id: 'cx-3', blade: 'Shark Edge', ratchet: '3-60LF', bit: 'Low Flat' },
    ],
  },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:engine`  
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/engine.ts src/lib/types.ts tests/engine.test.ts
git commit -m "feat: add bracket downstream reset, ready match query, and sample roster"
```

---

### Task 2: Reducer Actions — Undo Round, Replay Match, Edit Match in Arena, Load Sample Roster

**Files:**
- Modify: `src/App.tsx`
- Test: `tests/engine.test.ts`

**Interfaces:**
- Consumes: `ptsForFinish`, `resetDownstreamBracketMatches` from `src/lib/engine.ts`
- Produces: Reducer actions `UNDO_ROUND`, `REPLAY_MATCH`, `EDIT_MATCH_IN_ARENA`, `LOAD_SAMPLE_ROSTER`

- [ ] **Step 1: Write tests in `tests/engine.test.ts` for round undo calculation & replay logic**

```typescript
// In tests/engine.test.ts:
{
  console.log('7. Testing Undo Round score recalculation...');
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
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npm run test:engine`  
Expected: PASS.

- [ ] **Step 3: Update `App.tsx` reducer with the new actions**

In `src/App.tsx`:
Add to `Action` union:
```typescript
type Action =
  | { type: 'SET_PLAYERS'; players: Player[] }
  | { type: 'ADD_PLAYER'; player: Player }
  | { type: 'REMOVE_PLAYER'; id: string }
  | { type: 'LOAD_SAMPLE_ROSTER' }
  | { type: 'CREATE_TOURNAMENT'; name: string; format: Format; targetScore: number | null }
  | { type: 'SET_ACTIVE_TOURNAMENT'; id: string | null }
  | { type: 'START_MATCH'; matchId: string }
  | { type: 'RECORD_ROUND'; matchId: string; round: MatchRound }
  | { type: 'UNDO_ROUND'; matchId: string }
  | { type: 'REPLAY_MATCH'; matchId: string }
  | { type: 'EDIT_MATCH_IN_ARENA'; matchId: string }
  | { type: 'FINISH_MATCH'; matchId: string; p1Score: number; p2Score: number; winnerId: string | null }
  | { type: 'CANCEL_MATCH' }
  | { type: 'LOAD_STATE'; state: AppState }
  | { type: 'RESET_ALL' }
  | { type: 'DELETE_TOURNAMENT'; id: string };
```

Implement the cases in `reducer()`:
```typescript
case 'LOAD_SAMPLE_ROSTER':
  return { ...state, players: [...SAMPLE_ROSTER] };

case 'UNDO_ROUND': {
  const tournaments = state.tournaments.map((t) => {
    if (t.id !== state.activeTournamentId) return t;
    const matches = t.matches.map((m) => {
      if (m.id !== action.matchId || m.rounds.length === 0) return m;
      const rounds = m.rounds.slice(0, -1);
      let p1Score = 0;
      let p2Score = 0;
      rounds.forEach((r) => {
        if (r.winnerId === m.p1Id) p1Score += ptsForFinish(r.finish);
        else if (r.winnerId === m.p2Id) p2Score += ptsForFinish(r.finish);
      });
      return { ...m, rounds, p1Score, p2Score, completed: false, winnerId: null };
    });
    return { ...t, matches };
  });
  return { ...state, tournaments };
}

case 'REPLAY_MATCH': {
  const tournaments = state.tournaments.map((t) => {
    if (t.id !== state.activeTournamentId) return t;
    let matches = t.matches.map((m) =>
      m.id === action.matchId
        ? { ...m, rounds: [], p1Score: 0, p2Score: 0, winnerId: null, completed: false }
        : m
    );
    if (t.format === 'single-elimination') {
      matches = resetDownstreamBracketMatches(matches, action.matchId);
    }
    return { ...t, matches, activeMatchId: action.matchId };
  });
  return { ...state, tournaments };
}

case 'EDIT_MATCH_IN_ARENA': {
  const tournaments = state.tournaments.map((t) => {
    if (t.id !== state.activeTournamentId) return t;
    const matches = t.matches.map((m) =>
      m.id === action.matchId
        ? { ...m, completed: false, winnerId: null }
        : m
    );
    return { ...t, matches, activeMatchId: action.matchId };
  });
  return { ...state, tournaments };
}
```

- [ ] **Step 4: Verify project build succeeds**

Run: `npm run build`  
Expected: PASS with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx tests/engine.test.ts
git commit -m "feat: add undo, replay, edit, and sample roster reducer actions"
```

---

### Task 3: Internationalization (i18n) for New Features

**Files:**
- Modify: `src/lib/i18n.tsx`

**Interfaces:**
- Produces: New translation keys in `dict`: `matchNum`, `onDeck`, `onDeckSub`, `enterStadium`, `matchSummary`, `replayMatch`, `editInArena`, `replayConfirm`, `close`, `undoRound`, `undoToast`, `proceedNextMatch`, `podiumTitle`, `podiumSubtitle`, `champion1st`, `runnerUp2nd`, `third3rd`, `burstKing`, `loadSampleRoster`, `sampleLoaded`

- [ ] **Step 1: Add all new bilingual keys to `src/lib/i18n.tsx`**

```typescript
// Add into dict in src/lib/i18n.tsx:
matchNum: { zh: '第 {n} 場對戰', en: 'Match #{n}' },
matchNumShort: { zh: '第 {n} 場', en: 'Match #{n}' },
onDeck: { zh: '即將開戰', en: 'ON DECK' },
onDeckSub: { zh: '請選手準備好陀螺與發射器', en: 'Bladers, prepare your beys & launchers' },
enterStadium: { zh: '進入競技場 →', en: 'Enter Stadium →' },
matchSummary: { zh: '對戰詳情與操作', en: 'Match Summary & Actions' },
replayMatch: { zh: '重賽此場（從 0-0 開始）', en: 'Replay Match (Reset to 0-0)' },
editInArena: { zh: '在競技場修改（增刪回合）', en: 'Edit in Arena' },
replayConfirm: { zh: '確定要重賽此場比賽嗎？目前比分將被重設為 0-0。', en: 'Replay this match? Current scores will be reset to 0-0.' },
close: { zh: '關閉', en: 'Close' },
undoRound: { zh: '撤銷上一回合', en: 'Undo Last Round' },
undoToast: { zh: '已撤銷上一回合得分', en: 'Last round reverted' },
proceedNextMatch: { zh: '接續下一場比賽 →', en: 'Proceed to Next Match →' },
returnToTourney: { zh: '返回賽事主頁', en: 'Back to Tournament' },
podiumTitle: { zh: '🏆 冠軍頒獎台', en: '🏆 Tournament Champions' },
podiumSubtitle: { zh: '恭喜所有奮戰至終點的陀螺陀手！', en: 'Congratulations to all competing bladers!' },
champion1st: { zh: '冠軍 (1st)', en: 'Champion (1st)' },
runnerUp2nd: { zh: '亞軍 (2nd)', en: 'Runner-up (2nd)' },
third3rd: { zh: '季軍 (3rd)', en: '3rd Place' },
burstKing: { zh: '💥 爆裂破壞王', en: '💥 Burst King' },
loadSampleRoster: { zh: '⚡ 載入範例選手名單（4人卡組）', en: '⚡ Load Sample Roster (4 Players)' },
sampleLoaded: { zh: '已成功載入 4 名選手及預設卡組！', en: 'Loaded 4 sample bladers with full decks!' },
```

- [ ] **Step 2: Verify build**

Run: `npm run build`  
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/i18n.tsx
git commit -m "feat: add i18n translations for match queue, replay, arena, and podium"
```

---

### Task 4: Registration Screen — Quick Load Sample Roster

**Files:**
- Modify: `src/components/Registration.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `onLoadSampleRoster` prop passed from `App.tsx`
- Produces: 1-click roster button in `RegistrationScreen`

- [ ] **Step 1: Add `onLoadSampleRoster: () => void` to `RegistrationScreen` props**

In `src/components/Registration.tsx`:
Update interface:
```typescript
interface Props {
  players: Player[];
  onAddPlayer: (p: Player) => void;
  onRemovePlayer: (id: string) => void;
  onLoadSampleRoster: () => void;
  onStartTournament: (name: string, format: Format, targetScore: number | null) => void;
  hasTournament: boolean;
}
```

- [ ] **Step 2: Add the quick load sample roster button in `Registration.tsx`**

Place right above the player registration input or inside the header:
```tsx
<div className="flex justify-end mb-2">
  <button
    type="button"
    className="btn-ghost text-xs py-1.5 px-3 rounded-lg border-neon/40 text-neon hover:bg-neon/10 flex items-center gap-1.5 font-mono"
    onClick={() => {
      onLoadSampleRoster();
      setSuccess(t('sampleLoaded'));
    }}
  >
    <Sparkles size={14} className="text-neon" />
    <span>{t('loadSampleRoster')}</span>
  </button>
</div>
```

- [ ] **Step 3: Wire `onLoadSampleRoster` in `src/App.tsx`**

In `src/App.tsx`:
```tsx
<RegistrationScreen
  players={state.players}
  onAddPlayer={(p) => dispatch({ type: 'ADD_PLAYER', player: p })}
  onRemovePlayer={(id) => dispatch({ type: 'REMOVE_PLAYER', id })}
  onLoadSampleRoster={() => dispatch({ type: 'LOAD_SAMPLE_ROSTER' })}
  onStartTournament={handleStartTournament}
  hasTournament={!!activeTournament}
/>
```

- [ ] **Step 4: Verify build**

Run: `npm run build`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Registration.tsx src/App.tsx
git commit -m "feat: add quick load sample roster button in registration"
```

---

### Task 5: Sequential 1-by-1 Match Queue & On-Deck Hero Banner in Dashboard

**Files:**
- Modify: `src/components/Dashboard.tsx`

**Interfaces:**
- Consumes: `getNextReadyMatch` from `src/lib/engine.ts`
- Produces: 
  - Sequential numbered list (`Match #1`, `Match #2`, etc.) in single-column layout
  - "On Deck" hero card with instant "Start Match" action

- [ ] **Step 1: Refactor `Dashboard.tsx` match rendering into a flat sequential 1-by-1 list**

Replace the 2-column grid and round grouping boxes with:
1. `const nextReadyMatch = getNextReadyMatch(tournament);`
2. **On-Deck Hero Banner** above the match list when there is a ready match:
   - Visual styling: Neon border glow, radar ping icon, blader names: `[P1] VS [P2]`, and a prominent button to launch into Arena.
3. **Sequential Match List**:
   - Matches ordered chronologically: `tournament.matches.map((m, idx) => ...)`
   - Full-width card with sequential badge `MATCH #{idx + 1}` and subtle `Round {m.round}` tag.
   - Statuses: ACTIVE (`bg-neon/10 border-neon`), NEXT READY (`border-gold/60`), READY (`border-gray-700`), COMPLETED (`border-gray-800 bg-black/40`), WAITING (`opacity-40`).

- [ ] **Step 2: Verify responsive design and styling**

Run: `npm run build`  
Expected: PASS without compilation errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/Dashboard.tsx
git commit -m "feat: implement sequential 1-by-1 match queue and on-deck hero banner"
```

---

### Task 6: Completed Match Replay & In-Arena Edit Modal in Dashboard

**Files:**
- Modify: `src/components/Dashboard.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes:
  - `onReplayMatch: (matchId: string) => void`
  - `onEditMatchInArena: (matchId: string) => void`
- Produces: Modal when user clicks any completed match card

- [ ] **Step 1: Add modal state and props in `Dashboard.tsx`**

Add `selectedCompletedMatch: Match | null` state.
When clicking a completed match card, set `setSelectedCompletedMatch(m)`.

Render the **Match Summary & Actions Modal**:
- Header: `Match #{index}: Player 1 vs Player 2`
- Final Score: `p1Score - p2Score`, Victor highlighted in gold.
- Round-by-round breakdown chips (e.g. `R1: Burst (+2) - P1`, `R2: Spin (+1) - P2`).
- Actions:
  - **Replay Match Button**: calls `onReplayMatch(m.id)` with confirmation prompt, switches to Arena.
  - **Edit in Arena Button**: calls `onEditMatchInArena(m.id)`, switches to Arena.
  - **Close Button**: dismisses modal.

- [ ] **Step 2: Wire `onReplayMatch` and `onEditMatchInArena` in `src/App.tsx`**

In `App.tsx`:
```tsx
<DashboardScreen
  tournament={activeTournament}
  onGenerateMatches={handleGenerateMatches}
  onStartMatch={(matchId) => {
    dispatch({ type: 'START_MATCH', matchId });
    setScreen('arena');
  }}
  onReplayMatch={(matchId) => {
    dispatch({ type: 'REPLAY_MATCH', matchId });
    setScreen('arena');
  }}
  onEditMatchInArena={(matchId) => {
    dispatch({ type: 'EDIT_MATCH_IN_ARENA', matchId });
    setScreen('arena');
  }}
  onScreenChange={setScreen}
/>
```

- [ ] **Step 3: Verify build**

Run: `npm run build`  
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/Dashboard.tsx src/App.tsx
git commit -m "feat: add match replay and in-arena edit modal to dashboard"
```

---

### Task 7: Arcade Finish Animations Overlay & Synth Sound Effects in MatchArena

**Files:**
- Modify: `src/components/MatchArena.tsx`
- Modify: `src/index.css` (for keyframe screen-shake and particle animations if needed)

**Interfaces:**
- Consumes: `FinishType`
- Produces: Dynamic animated overlay on every scored round (Xtreme, Burst, Over, Spin, Draw) with distinct visual theme and synthesized audio

- [ ] **Step 1: Add CSS animation keyframes in `src/index.css`**

Add:
```css
@keyframes screen-rumble {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  20% { transform: translate(-4px, 3px) rotate(-1deg); }
  40% { transform: translate(4px, -3px) rotate(1deg); }
  60% { transform: translate(-3px, -2px) rotate(0deg); }
  80% { transform: translate(3px, 2px) rotate(1deg); }
}

@keyframes flash-burst {
  0% { opacity: 0; transform: scale(0.6); }
  30% { opacity: 1; transform: scale(1.08); }
  100% { opacity: 1; transform: scale(1); }
}

.animate-screen-rumble {
  animation: screen-rumble 0.4s ease-in-out;
}

.animate-flash-burst {
  animation: flash-burst 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
}
```

- [ ] **Step 2: Add Web Audio synthesizer sound presets for each finish in `MatchArena.tsx`**

```typescript
const playFinishSound = (finish: FinishType) => {
  if (muted) return;
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (finish === 'XTREME') {
      // Heavy pitch drop bass shockwave
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } else if (finish === 'BURST') {
      // Fast explosive burst
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.35);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } else if (finish === 'OVER') {
      // Ascending whoosh ejection
      osc.frequency.setValueAtTime(280, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(700, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } else if (finish === 'SPIN') {
      // High chime
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch {}
};
```

- [ ] **Step 3: Implement the dynamic `ArcadeFinishOverlay` component in `MatchArena.tsx`**

When `activeFinish` is set in `recordFinish()`:
- Display overlay for 1.2s (dismissible on click).
- Render themed colors:
  - `XTREME`: Red glow, danger speed lines, "⚡ XTREME FINISH! +3"
  - `BURST`: Orange flame explosion, "💥 BURST FINISH! +2"
  - `OVER`: Cyan velocity streaks, "🚀 OVER FINISH! +2"
  - `SPIN`: Emerald vortex ring, "🌀 SPIN FINISH! +1"
  - `DRAW`: Silver clash, "⚔️ DRAW / REPLAY"

- [ ] **Step 4: Verify build**

Run: `npm run build`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/MatchArena.tsx src/index.css
git commit -m "feat: add high-impact arcade finish animations and sound effects"
```

---

### Task 8: In-Arena "Undo Last Round" and Direct "Proceed to Next Match" Flow

**Files:**
- Modify: `src/components/MatchArena.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes:
  - `onUndoRound: (matchId: string) => void`
  - `onProceedToNextMatch: (currentMatchId: string, p1Score: number, p2Score: number, winnerId: string | null) => void`

- [ ] **Step 1: Add "Undo Last Round" button to `MatchArena.tsx`**

Above the Battle Log:
```tsx
{match.rounds.length > 0 && !winnerDeclared && (
  <button
    type="button"
    className="btn-ghost py-1.5 px-3 text-xs text-danger/90 hover:text-danger hover:bg-danger/10 border-danger/30 flex items-center gap-1.5 rounded-lg transition-colors font-mono"
    onClick={() => onUndoRound(match.id)}
  >
    <RotateCcw size={14} />
    <span>{t('undoRound')}</span>
  </button>
)}
```

- [ ] **Step 2: Add "Proceed to Next Match" in the Arena Victory Banner**

Inspect `getNextReadyMatch(tournament)`.
In the Victory Banner:
- Primary button: `"PROCEED TO NEXT MATCH (Match #{next.index}) →"`
  - Finishes current match, activates next ready match, stays in Arena with fresh match loaded!
- Secondary button: `"RETURN TO TOURNAMENT DASHBOARD"`
  - Finishes current match, navigates to Dashboard.

- [ ] **Step 3: Wire actions in `src/App.tsx`**

In `App.tsx`:
Add handler `handleProceedToNextMatch`:
1. Dispatches `FINISH_MATCH`.
2. Computes the next ready match.
3. If next match exists, dispatches `START_MATCH` with its ID and keeps `screen = 'arena'`.
4. If no more matches, sets `screen = 'dashboard'`.

- [ ] **Step 4: Verify build**

Run: `npm run build`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/MatchArena.tsx src/App.tsx
git commit -m "feat: add in-arena undo last round and proceed to next match flow"
```

---

### Task 9: Tournament Champions Finale Podium Modal

**Files:**
- Create: `src/components/ChampionsPodium.tsx`
- Modify: `src/components/Dashboard.tsx`

**Interfaces:**
- Consumes: `Tournament`, `StandingsRow[]` from `engine.ts`
- Produces: 
  - Top 3 Podium (1st Gold, 2nd Silver, 3rd Bronze) with confetti styling
  - Burst King/Queen highlight badge
  - Direct shortcut to "Generate Battle Card"

- [ ] **Step 1: Create `src/components/ChampionsPodium.tsx`**

Implement the podium component:
- Calculates Top 3 from `computeStandings(tournament.players, tournament.matches)`.
- Calculates "Burst King" (player with most Burst + Xtreme finishes).
- Renders:
  - 1st Place pedestal (tallest, glowing gold, crown).
  - 2nd Place pedestal (silver).
  - 3rd Place pedestal (bronze).
  - Actions: `"View Battle Card"` (opens analytics share card), `"Close"`.

- [ ] **Step 2: Mount `ChampionsPodium` in `Dashboard.tsx`**

When all matches are completed (`completed === tournament.matches.length && tournament.matches.length > 0`):
- Show a persistent celebration banner on Dashboard.
- Provide a button to trigger/re-open the Podium modal at any time.

- [ ] **Step 3: Verify build**

Run: `npm run build`  
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/ChampionsPodium.tsx src/components/Dashboard.tsx
git commit -m "feat: add tournament champions podium celebration modal"
```

---

### Task 10: Full Test Suite Execution, Build Check, and E2E Flow Verification

**Files:**
- Test: `tests/engine.test.ts`
- Verify: Full TypeScript compilation and production bundle (`npm run build`)

- [ ] **Step 1: Run engine test suite**

Run: `npm run test:engine`  
Expected: All tests pass.

- [ ] **Step 2: Run production build**

Run: `npm run build`  
Expected: `tsc -b && vite build` exits 0 with zero errors and clean output chunks.

- [ ] **Step 3: Commit any final refinements**

```bash
git add .
git commit -m "test: verify complete tournament flow, replay, animations, and e2e polish"
```
