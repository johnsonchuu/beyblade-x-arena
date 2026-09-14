# Design Spec: Beyblade X Tournament Flow, Replay, Finish Animations & E2E Polish

**Date:** 2026-09-14  
**Status:** Approved  
**Topic:** Sequential 1-by-1 Match Rundown, Match Replay & Editing, Arcade Finish Animations, and E2E Tournament Flow Polish

---

## 1. Overview & Objectives

This specification defines the architectural and UI upgrades to the Beyblade X Arena Tournament Manager:
1. **Sequential 1-by-1 Match Queue (Bug 1):** Replace 2-column round grid layouts with a single linear queue numbered `Match 1`, `Match 2`, `Match 3`... with clear active, on-deck, and upcoming indicators.
2. **Match Replay & In-Arena Editing (Bug 2):** Allow any completed match to be inspected, replayed from 0-0, or edited in the Arena to adjust rounds, with automatic recalculation of standings and single-elimination bracket feeds.
3. **High-Impact Arcade Finish Animations (Enhancement 1):** Full-screen anime/esports overlay animations and sound effects for XTREME (+3), BURST (+2), OVER (+2), SPIN (+1), and DRAW.
4. **E2E Player & Organizer Polish Pack (Enhancement 2):**
   - In-Arena **Undo Last Round** button to revert referee misclicks.
   - Seamless **"Proceed to Next Match"** transition in the Arena victory banner.
   - **"Up Next / On-Deck"** announcement banner on the Dashboard.
   - **Tournament Champions Podium** modal celebrating Top 3 finishers when the tournament completes.
   - **Quick Load Sample Roster (4 Players)** button on the Registration screen.

---

## 2. Architecture & Data Flow

### 2.1 State & Reducer Actions (`src/App.tsx`, `src/lib/types.ts`)

```typescript
type Action =
  // Existing actions...
  | { type: 'UNDO_ROUND'; matchId: string }
  | { type: 'REPLAY_MATCH'; matchId: string }
  | { type: 'EDIT_MATCH_IN_ARENA'; matchId: string }
  | { type: 'LOAD_SAMPLE_ROSTER' };
```

#### Action Semantics:
* **`UNDO_ROUND`**:
  - Targets `matchId`.
  - Removes the last entry in `match.rounds`.
  - Recalculates `p1Score` and `p2Score` by re-evaluating remaining rounds using `ptsForFinish()`.
  - Sets `completed = false` and `winnerId = null` (unlocking the arena if previously decided).
* **`REPLAY_MATCH`**:
  - Resets `match.rounds = []`, `match.p1Score = 0`, `match.p2Score = 0`, `match.winnerId = null`, `match.completed = false`.
  - Sets `activeTournament.activeMatchId = matchId`.
  - In single-elimination formats: clears any downstream matches that were fed by this match.
* **`EDIT_MATCH_IN_ARENA`**:
  - Leaves `rounds` and `scores` intact.
  - Sets `match.completed = false`, `match.winnerId = null`.
  - Sets `activeTournament.activeMatchId = matchId`.
* **`LOAD_SAMPLE_ROSTER`**:
  - Pre-populates 4 competitive players with 3-bey decks (Kamen X, Multi, Bird, Chrome).

### 2.2 Standings & Bracket Propagation (`src/lib/engine.ts`)
* `computeStandings` automatically filters for `m.completed`, so replaying or editing immediately updates standings without stale data.
* Helper `resetDownstreamBracketMatches(matches: Match[], matchId: string): Match[]`:
  - Recursively clears `p1Id` or `p2Id` from matches that received winners/losers from `matchId`.
* Helper `getNextReadyMatch(tournament: Tournament): Match | null`:
  - Returns the first uncompleted match where both `p1Id` and `p2Id` are assigned.

---

## 3. Component Details & UI Behavior

### 3.1 Dashboard Sequential Match Queue (`src/components/Dashboard.tsx`)
* **Layout**: Single vertical column (`flex flex-col space-y-3`).
* **Match Numbering**: Every match is labeled with a clean sequential badge (`MATCH #1`, `MATCH #2`, etc.).
* **On-Deck Hero Banner**: Placed above the match queue showing the next ready match, blader names, and a prominent `"START MATCH"` CTA.
* **Completed Match Modal**:
  - Triggers upon clicking any completed match card.
  - Displays: Round breakdown, final scores, and three buttons: `"Replay Match (0-0)"`, `"Edit in Arena"`, and `"Close"`.
* **Tournament Champions Podium**:
  - When `completed === totalMatches && totalMatches > 0`, displays a celebration banner and modal with 1st, 2nd, and 3rd place podium graphics and victory badges.

### 3.2 Match Arena Battle Experience (`src/components/MatchArena.tsx`)
* **High-Impact Finish Overlays**:
  - State: `activeFinish: { finish: FinishType; scorerName: string; points: number } | null`.
  - Renders a vibrant, full-screen animated modal with themed effects for 1.2 seconds (or click-to-dismiss):
    - **XTREME**: Crimson neon lines, heavy shake keyframe, electric impact bass synth.
    - **BURST**: Fiery orange fragments/particles, shockwave explosion synth.
    - **OVER**: Cyan speed ejection trail, whoosh audio synth.
    - **SPIN**: Emerald vortex ring, spinning resonance synth.
    - **DRAW**: Silver sparks ripple, clash chime.
* **Undo Last Round Button**:
  - Visible whenever `match.rounds.length > 0`.
  - Reverts the most recent round with a clear confirmation toast.
* **Next Match Transition**:
  - Victory banner offers:
    - `"PROCEED TO NEXT MATCH (Match #X: [A] vs [B]) →"` (finishes current match and automatically launches the next match).
    - `"RETURN TO DASHBOARD"`.

### 3.3 Registration Quick Setup (`src/components/Registration.tsx`)
* Top action bar includes a `"⚡ Load Sample Roster (4 Players)"` button to enable instant testing or pick-up tournaments.

---

## 4. Internationalization (`src/lib/i18n.tsx`)
All new user-facing copy is localized in English and Chinese:
- Sequential match headers (`matchNum: 'Match #{n}'`)
- On deck banner (`onDeck: 'On Deck'`, `readyAtStadium: 'Be ready at the stadium'`)
- Replay modal (`replayMatch: 'Replay Match'`, `editInArena: 'Edit in Arena'`, `matchSummary: 'Match Summary'`)
- Arena buttons (`undoRound: 'Undo Last Round'`, `proceedNextMatch: 'Proceed to Next Match'`)
- Podium copy (`championsPodium: 'Tournament Champions'`, `winner1st: '1st Place'`, `runnerUp2nd: '2nd Place'`, `third3rd: '3rd Place'`)
- Sample roster (`loadSampleRoster: 'Load Sample Roster'`)

---

## 5. Verification Plan

1. **Unit / Engine Tests**:
   - Verify `computeStandings` accurately updates when a completed match is replayed or edited.
   - Verify single-elimination downstream resets when an earlier match is replayed.
   - Verify `roundRobinMatches`, `bracketMatches`, and `swissRound` properly provide 1-indexed sequential ordering.
2. **Interactive UI Verification**:
   - Test sample roster load (creates 4 players).
   - Generate schedule: verify matches display as a flat 1-by-1 sequential list (Match 1, Match 2, Match 3...).
   - Play Match 1: verify finish animations (Spin, Over, Burst, Xtreme, Draw) trigger with audio and visual flair.
   - Test "Undo Last Round" in Arena: verify round is popped and score reverts cleanly.
   - Complete Match 1: verify "Proceed to Next Match" button directly launches Match 2.
   - Complete Match 2: verify clicking completed Match 1 on dashboard opens modal, allows "Replay Match", resets scores, and opens Arena.
   - Complete all matches: verify Champions Podium triggers with Top 3 bladers.
   - Build verification: `npm run build` passes with zero TypeScript errors.
