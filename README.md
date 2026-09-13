# 🏆 Beyblade X Arena — Tournament Manager & Scoring Engine

A professional, esports-grade **Beyblade X** tournament manager and scoring engine. Built as a responsive, mobile-first Single Page Application with offline-first persistence.

**🔴 Live:** https://beyblade-x-arena.pages.dev/

## CI/CD

Pushes to `main` typecheck, build, and deploy to Cloudflare Pages via
`.github/workflows/deploy.yml`. The account ID is resolved from the API token
at deploy time (`.github/scripts/resolve_account.py`) rather than being kept
as a second hand-maintained secret — a wrong account ID makes every Pages call
fail with an opaque `404 / code 7003` even when the token is valid.

Only these two repository secrets are required:

| Secret | Where to get it |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Dashboard → My Profile → API Tokens → Create Token → "Edit Cloudflare Workers" template |
| `CLOUDFLARE_ACCOUNT_ID` | Dashboard → Workers & Pages → Overview → right sidebar "Account ID" |

To check a pasted value before setting it, run `scripts/check-cf-credentials.sh`.

## Tests

```bash
python3 tests/persistence.test.py       # local: state survives a reload
python3 tests/deployed-smoke.test.py    # production: the deploy actually works
```

Both need a running target: `npm run dev` on :5173 for the former, and the
live URL (overridable via `BASE_URL`) for the latter.


## ✨ Features

### 1. Blader Registration & 3-on-3 Deck Builder
- Register unlimited bladers with a **3-bey deck** (`Blade - Ratchet - Bit`, e.g. `Dran Buster 1-60A Low Flat`)
- **Official No-Part-Duplication rule enforcement** — prevents duplicate Blades / Ratchets / Bits within a single deck (WBO / Takara Tomy rules)
- **Auto-complete** quick-select lists for common BX / UX / CX series parts

### 2. Matchmaking & Tournament Engines
- **Round Robin (單循環)** — full schedule auto-generator
- **Single Elimination Bracket (單淘汰賽)** — seeded tree with 3rd-place decider
- **Swiss System (瑞士制)** — pairings based on win-loss records
- **Standings & Tie-breakers**: `Wins` → `Total Match Points` → `Point Differential` → `Head-to-Head`

### 3. Live Match Arena & Round-by-Round Scoring
- **Target score configurable** (first to 4–7)
- **Official point actions**: `+1 Spin` · `+1 Over` · `+2 Burst` · `+3 Xtreme` · `Draw` · `-1 Undo`
- **"3, 2, 1, Go Shoot!"** countdown with sound effects (mutable)
- Winner declaration banner with point breakdown
- Detailed **round-by-round log** (which Bey won, by which finish)

### 4. Battle Log & Meta Analytics
- Complete **match & round history**
- **Meta dashboard**: finish-type distribution (% Xtreme vs Spin vs Burst…), top winning blades

### 5. Data Management & Social Sharing
- **Auto-save** to `localStorage` (survives refresh)
- **JSON export / import** backup
- **Summary card export (PNG)** — esports-styled standings + champion for WhatsApp / Telegram / Discord sharing

## 🛠 Tech Stack
- **React 18 + Vite + TypeScript**
- **Tailwind CSS** (Dark Cyberpunk / Neon Esports theme: `#00ffcc` cyan, `#ff0055` magenta, `#ffe600` gold, `#0d0e15` bg)
- **Lucide React** icons
- **html-to-image** for PNG export
- **LocalStorage** persistence

## 🚀 Getting Started

```bash
npm install
npm run dev        # start dev server
npm run build      # production build (outputs to dist/)
npm run preview    # preview the production build
```

## 📁 Project Structure

```
src/
├── main.tsx                 # React entry
├── App.tsx                  # Root reducer + navigation + persistence
├── index.css                # Tailwind + theme
├── lib/
│   ├── types.ts             # Core domain types
│   ├── engine.ts            # Standings, matchmaking, scheduling
│   ├── parts.ts             # Beyblade X parts catalogue (BX/UX/CX)
│   └── storage.ts           # LocalStorage + JSON export/import
└── components/
    ├── Registration.tsx     # Blader + deck registration, tournament setup
    ├── BeyPicker.tsx        # Part auto-complete fields
    ├── Dashboard.tsx        # Leaderboard + match schedule
    ├── MatchArena.tsx       # Live scoring arena with countdown + FX
    └── Analytics.tsx        # Meta stats + summary-card PNG export
```

## 🎮 Usage Flow

1. **Register** — add bladers with their 3-bey decks (auto-complete helps; part duplication is blocked)
2. **Launch** — pick a tournament name, format (Round Robin / Single Elim / Swiss) and target score
3. **Generate schedule** → open any match card
4. **Score** — hit "GO SHOOT!", tap the finish type on the scoring player's side; wins lock at the target
5. **Record result** → leaderboard + analytics update automatically
6. **Export** — save JSON backup, or render a shareable summary-card PNG from the Stats tab

## Notes
- All data lives in the browser (`localStorage`), so state persists across refreshes — open the same browser on a tablet to score at the table.
- Data is per-browser; use **Export JSON** to transfer a tournament to another device.
