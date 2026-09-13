# ADR-001 — Beyblade X Arena: architecture, deploy pipeline, and current status

- **Status:** Accepted
- **Date:** 2026-09-14
- **Supersedes:** the single-file `prototype.html` (kept in-repo for reference)
- **Live:** https://beyblade-x-arena.pages.dev/
- **Repo:** https://github.com/johnsonchuu/beyblade-x-arena

This ADR is a checkpoint. Work is paused here and resumes from the
"Known gaps / next steps" section.

---

## 1. Context

The original artefact was one self-contained `prototype.html`: a round-robin
tournament scorer with localStorage persistence. It worked, but had no
matchmaking engines beyond round-robin, no analytics, no sharing, no
deployment story, and its UI was English-only despite the brief calling for
Chinese.

Constraints that shaped the decisions below:

- **Offline-first / local tournaments.** Referees run this on a tablet at the
  table, often with poor connectivity. State must survive a refresh.
- **Bilingual (zh-HK primary).** The users are Hong Kong blader communities.
- **Zero backend.** No accounts, no server, no DB. If a backend appears, that
  is a new ADR.
- **Official rules fidelity.** Scoring must match real Beyblade X rules; the
  earlier prototype had Over Finish valued at 1 point, which is wrong.

## 2. Decisions

### D1 — React + Vite + TypeScript SPA, no framework beyond React

**Decision.** Rebuild as a Vite + React 18 + TS SPA. Rejected: continuing to
grow a single HTML file (@deprecated, D6), and Next.js (adds SSR/routing we
have no use for in a stateless offline app).

**Why.** The app has meaningful domain logic (engines, standings,
tie-breakers) that benefits from types and unit-testable pure functions.
Vite gives a fast dev loop and a static `dist/` that any static host can
serve.

**Consequences.** Requires a build step; the app is no longer openable by
double-clicking a file. Mitigated by the deployed URL and `npm run dev`.

### D2 — Reducer-based state, single source of truth

**Decision.** All mutation flows through one `useReducer` in `src/App.tsx`
with a typed `Action` union.

**Why.** Tournament state has cross-cutting invariants (a match's scores,
its rounds, and its winner must agree). A reducer makes those transitions
explicit and auditable in one place.

**Consequences.** `App.tsx` is the largest file and owns navigation as well
as domain state. If it grows further, split navigation from domain state.

### D3 — Persist state as the reducer's *initial value*, not in an effect

**Decision.** `useReducer(reducer, EMPTY_STATE, (fallback) => loadState() ?? fallback)`

**Why — this was a real, shipped data-loss bug.** The first implementation
read localStorage in a mount effect declared *after* the persist effect.
React runs effects in declaration order, so on every load the persist effect
wrote empty state over the saved payload before the bootstrap effect could
read it. Every saved tournament, deck, and result was destroyed on reload.
The `saved.players.length > 0` guard never fired.

**Evidence.** `tests/persistence.test.py` — 7 checks fail against the
pre-fix code (`players=0, tournaments=0`), all 8 pass after. The test was
validated by temporarily reverting the fix, so it is known to catch the bug
rather than merely pass.

**Consequences.** Persistence must never be reintroduced as a mount effect.
The regression test is the guard.

### D4 — Lazy-load persisted state; tolerate partial documents

**Decision.** `loadState()` returns `AppState | null`; callers fall back to
an empty state. No migration layer yet.

**Why.** A malformed or older localStorage payload must not brick the app.

**Consequences.** Field-level schema drift is not handled; `loadState` is
cast, not validated. If the shape changes materially, add a versioned
migration. **Known risk** — see G5.

### D5 — i18n via a hand-rolled typed dictionary, defaulting to Chinese

**Decision.** `src/lib/i18n.tsx` holds a `Record<TKey, {zh, en}>`; a
`useI18n()` hook exposes `t(key, vars?)`. Default `zh`.

**Why.** Two locales, no plurals/formatting needs, no runtime locale
negotiation. i18next would be more machinery than the problem warrants.

**Consequences.** `TKey` is inferred from the dictionary, so a missing key is
a compile error — the main safety property we wanted. Adding a third locale
means widening every entry.

### D6 — Keep `prototype.html` in the repo

**Decision.** Retain the original single-file prototype.

**Why.** It is the behavioural reference for rule semantics (what the
scoring flow felt like) and costs nothing.

**Consequences.** Looked like dead code. Now explicitly marked deprecated in
this ADR.

### D7 — Deploy to Cloudflare Pages via GitHub Actions

**Decision.** Push to `main` → typecheck → build → `wrangler-action@v3`
deploys `dist/`. Config in `.github/workflows/deploy.yml` and `wrangler.toml`.

**Why.** Free, static, global CDN, and the project has no server component to
host.

**Consequences and the errors that shaped this:**
- `cloudflare/pages-action@v1` is deprecated and targets Node 20 (EOL on
  runners). Migrated to `wrangler-action@v3`.
- A commit carrying the workflow fix was made but **not pushed**, so CI kept
  running the old action for two runs. Always verify `git log origin/main`
  after a CI change.
- An inline Python heredoc indented to column 0 inside a `run: |` block
  scalar terminated the scalar and made the whole workflow invalid YAML
  ("This run likely failed because of a workflow file issue"). Embedded
  scripts now live in `.github/scripts/*.py` and are invoked as plain
  commands. Validate YAML before pushing.

### D8 — Derive the Cloudflare account ID from the token; do not store it

**Decision.** `.github/scripts/resolve_account.py` reads the accounts the
token can see, uses the configured `CLOUDFLARE_ACCOUNT_ID` only if it is
actually valid, falls back to the sole visible account, and fails loudly if
the choice would be ambiguous.

**Why.** A wrong account ID makes every Pages call fail with an opaque
`404 / code 7003` ("could not route to /accounts/***/pages/projects") *even
when the token is perfectly valid*, which sent debugging in the wrong
direction for several rounds. The token already enumerates its accounts, so
the value is derivable and should not be a second hand-maintained secret.

**Consequences.** `CLOUDFLARE_ACCOUNT_ID` remains supported but optional.
Multi-account tokens require it to be set correctly (the script refuses to
guess).

### D9 — Treat the API response as ground truth, not credential shape

**Decision.** The diagnostic reports shape (length, hex-ness, whitespace) as
**warnings only** and always proceeds to the live API call.

**Why.** We gated on "API tokens are 40 chars" and exited before the API
call — but the real token is 53 chars and authenticates fine
(`HTTP 200, success:true`). The false gate hid the actual error (wrong
account ID) for multiple runs.

**Consequences.** Heuristics may still mislead; they must never block the
ground-truth call.

### D10 — Official scoring values and terminology

**Decision.** Spin 1, **Over 2**, Burst 2, Xtreme 3. Chinese terminology:
刃擊環 (Blade), 棘輪 (Ratchet), 軸心 (Bit). Finish names mirror the official
terms: 旋轉勝利 / 爆裂勝利 / 擊出勝利 / 極限勝利.

**Why.** The prototype valued Over at 1 point — incorrect. Earlier Chinese
used 刀片 (knife blade) and 軸承 (bearing), which are wrong for Beyblade X
parts.

**Consequences.** The scoring legend in the arena documents each value
in-band so referees can self-check.

### D11 — Decks and target score are optional

**Decision.** A blader can be registered by name alone; unset parts render as
未設定. Target score defaults to 4 and is labelled `（可選）`.

**Why.** Registration speed matters at a live event. Forcing three part
triples before a player exists added friction with no benefit.

**Consequences.** Deck completeness is not enforced, so analytics over parts
only sees whichever parts were actually entered.

### D12 — Pure functions in `src/lib/engine.ts`

**Decision.** Standings, matchmaking, and tie-breakers are pure and
side-effect free.

**Why.** They are the rules of the game, so they need to be reasoned about
and tested without a DOM.

**Consequences.** Not yet covered by unit tests — see G4.

## 3. Current status (verified 2026-09-14)

| Area | State |
| --- | --- |
| Registration + optional decks | ✅ Working, deployed |
| Bilingual zh/en toggle | ✅ Working, deployed |
| Round Robin scheduling | ✅ Working, deployed |
| Live scoring arena (Spin/Over/Burst/Xtreme) | ✅ Working (verified locally) |
| Winner banner, leaderboard, match history | ✅ Working (verified locally) |
| Analytics + finish distribution | ✅ Working (verified locally) |
| JSON export / import | ✅ Implemented |
| PNG summary card | ✅ Implemented (html-to-image) |
| localStorage persistence | ✅ Fixed and regression-tested |
| CI/CD → Cloudflare Pages | ✅ Green, 13/13 steps |
| Production site | ✅ HTTP 200 |

Verification performed:
- `tests/persistence.test.py` — validated by reverting the fix (7 fail → 8 pass)
- `tests/deployed-smoke.test.py` — 13/13 pass against the live URL
- Deploy run `34769643504` — all steps green

## 4. Known gaps / next steps

- **G1 — Swiss scheduling is not wired.** `swissRound()` exists in
  `src/lib/engine.ts` but is never called; `handleGenerateMatches` returns an
  empty array for the Swiss format. **Selecting Swiss in the UI yields no
  matches.** Highest-priority gap, and user-visible.
- **G2 — Single-elimination brackets do not advance.** The first round is
  built (with a 3rd-place placeholder match), but winners are never
  propagated into subsequent rounds, so a bracket cannot be completed.
- **G3 — Draw is unreachable in the arena UI.** `DRAW` is handled in the
  reducer and translated, but no button emits it. The brief asked for
  "Draw / Simultaneous Over (0 points, replay round)".
- **G4 — No unit tests for `engine.ts`.** Tie-breaker ordering
  (Wins > Pts > Diff > Head-to-head) is untested.
- **G5 — No schema versioning for persisted state.** A shape change could
  break existing saved tournaments (see D4).
- **G6 — Full match flow is not verified against production.** The deployed
  smoke test covers registration, persistence, language, and terminology;
  arena scoring has only been verified locally.
- **G7 — Node 20 deprecation warning** on every CI run (actions are pinned to
  Node 20). Cosmetic; builds are green.
- **G8 — Blind deck-slot selection** (`shuffleDeckOrder()`) exists but is
  unused; slots auto-rotate in the arena instead. The brief called for a
  blind selection sequence.

## 5. Consequences

The app is in a deployable, honest state: what is described as working has
been observed working, and the gaps above are the real remaining scope
rather than unknowns. G1 and G3 are the gaps most likely to be noticed by a
user, because they are reachable from the UI and silently do the wrong
thing.

Resuming work should start with G1, then G2, then G3.
