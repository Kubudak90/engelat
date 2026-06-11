# Engelat v2 — "Chart-to-Course" (price chart becomes the obstacle terrain)

- Date: 2026-06-11
- Status: Approved design (brainstorming complete)
- Builds on: `2026-06-11-engelat-minikit-design.md` (the base Flappy + onchain leaderboard app)

## Goal
Replace the randomly-generated Flappy obstacles with a **corridor/tunnel shaped by a real
coin's live price chart**. The player picks a coin, the game fetches its recent candles, and
the normalized price line becomes the centerline of a constant-width corridor the bird flies
through. Endless and accelerating. Leaderboard is **per-coin**.

## Key decisions (from brainstorming)
1. **Mechanic:** tunnel/corridor — the price line is the *centerline* of a constant-width gap;
   filled "canyon walls" above/below follow the chart shape. Touching a wall = game over.
2. **Data:** player picks a coin; **live chart** fetched at runtime from Crypto.com public REST.
3. **Leaderboard:** **per-coin** — contract keyed by coin (`bytes32`).
4. **Course:** **endless + accelerating** — the chart series tiles/loops forever; each full loop
   increases scroll speed and slightly narrows the gap.

## Gameplay detail
- Fetch ~150 recent candles (close prices) for the chosen coin.
- Normalize the close series to the play area's vertical band (≈15%–85% of height). This
  normalized polyline is the **corridor centerline**, sampled one point per candle "segment".
- Corridor = a constant-width vertical gap centered on the centerline. Render:
  - top wall: filled from `0` down to `centerY - gap/2`
  - bottom wall: filled from `centerY + gap/2` down to the ground line
  - walls follow the polyline (canyon look), not discrete pipes.
- **Collision:** at the bird's x, compute the interpolated top/bottom wall y; if the bird's
  circle crosses either, or hits ceiling/ground → game over.
- **Endless tiling:** when the scroll reaches the end of the series, wrap to the start (modulo
  over the segment array). To avoid a hard vertical jump at the seam, interpolate the centerline
  across the last/first few segments (short ramp).
- **Acceleration (per full loop):**
  - scroll speed: start `2.5` px/frame, `+0.4` per loop, cap `6.0`
  - corridor gap: start `170` px, `−6` per loop, floor `110` px
  - (loop counter increments each time the series index wraps)
- **Score:** `+1` per candle-segment the bird passes. Persisted to `localStorage`
  (`engelat_best_score_<COIN>`) and submittable onchain.
- HUD: coin symbol + a small label ("BTC · last 150 candles") + current score + best.

## Components
| File | Status | Responsibility |
|---|---|---|
| `components/CoinPicker.tsx` | **new** | Curated coin list with live price; selecting a coin starts the flow |
| `app/api/chart/route.ts` | **new** | Server route handler: fetch Crypto.com public candlestick, return normalized close-price series + meta |
| `components/Game.tsx` | modify | Replace random `spawnObstacle` with chart-driven corridor terrain; endless+accelerating; corridor collision; segment scoring; accept `coin` + `series` props; `onGameOver(coin, score)` |
| `contracts/src/Leaderboard.sol` | modify | Key everything by coin (`bytes32`): per-coin `bestScore`, per-coin top-10; `submitScore(bytes32 coin, uint256 score)`, `getTop(bytes32 coin)`; `ScoreSubmitted(bytes32 coin, address player, uint256 score)` |
| `contracts/test/Leaderboard.t.sol` | modify | Per-coin isolation (BTC vs ETH don't mix), best-only-increases per coin, top-10 ordering per coin, event |
| `components/ScoreSubmit.tsx` | modify | Call `submitScore(coinBytes32, score)`; pass selected coin |
| `components/Leaderboard.tsx` | modify | `getTop(coinBytes32)`; coin switcher to view other coins' tables; refetch after submit |
| `app/page.tsx` | modify | Flow: CoinPicker → Game(coin, series) → game over → ScoreSubmit + Leaderboard(coin) |
| `contracts/script/Deploy.s.sol` | (re-run) | Redeploy updated contract to Base Sepolia; update `NEXT_PUBLIC_LEADERBOARD_ADDRESS` |

## Data flow
`CoinPicker(coin)` → `GET /api/chart?coin=BTC` (normalized series + meta) → `Game(coin, series)`
→ `onGameOver(coin, score)` → `ScoreSubmit` (`<Transaction>` `submitScore(coinBytes32, score)`)
→ `Leaderboard.sol` (Base Sepolia) → `Leaderboard.tsx` (`useReadContract getTop(coinBytes32)`) → UI.

## Data source
- **Runtime:** Crypto.com **public** REST `GET /exchange/v1/public/get-candlestick`
  (`instrument_name=<COIN>_USDT`, a sensible timeframe + `count≈150`). No auth for public market
  data. Proxied through `app/api/chart/route.ts` to avoid CORS and keep the upstream URL
  server-side. Route returns `{ coin, instrument, closes: number[], last: number }` already
  trimmed to the needed count and ordered oldest→newest.
- The Crypto.com MCP is for design/prototyping only; the deployed app does its own fetch.
- **Curated coin list (initial):** BTC, ETH, SOL, XRP, DOGE (all `*_USDT`). Easy to edit in one
  place (a shared `SUPPORTED_COINS` constant used by both `CoinPicker` and the route validation).
- **Coin keying onchain:** `bytes32`. Frontend converts symbol → key via
  viem `stringToHex("BTC", { size: 32 })`. Whitelist keeps keys bounded.

## Error handling
- `/api/chart`: validate `coin` against `SUPPORTED_COINS`; on upstream failure return a clear
  error; client shows a retry on the picker (no silent fallback to fake data).
- Game requires a non-empty `series`; if fetch failed, the picker blocks start with an error.
- `ScoreSubmit`: existing `<Transaction>` status/error UI; only enabled once a coin+score exist.

## Testing
- Foundry: per-coin isolation, best-only-increases per coin, top-10 ordering per coin, event
  carries coin. (Adapt existing 9 tests to the keyed API.)
- Manual end-to-end on Base Sepolia after redeploy: pick coin → play → submit → see it in that
  coin's leaderboard; switch coin and confirm tables are independent.

## Known limitations (accepted)
- Live chart drifts minute-to-minute, so the same coin's course is not byte-identical across
  time → per-coin leaderboard is *approximately* fair. Score was already "cheatable" in the MVP
  (no server attestation), so this drift is an accepted trade-off.
- Testnet only (Base Sepolia).
- Contract redeploy changes the address; old global leaderboard data is not migrated (MVP).

## Build sequence
1. `app/api/chart/route.ts` + `SUPPORTED_COINS` constant + `CoinPicker.tsx` (data path first).
2. `Game.tsx`: chart-driven corridor terrain, endless+accelerating, corridor collision, scoring.
3. `Leaderboard.sol` + tests: per-coin keying; redeploy to Base Sepolia.
4. Wire `ScoreSubmit` / `Leaderboard.tsx` / `page.tsx` to coin; end-to-end test.

## Delegation / orchestration note
- Opus (main session) plans, reviews every diff, handles env/scaffold/deploy mechanics.
- Implementation code may be delegated to "Kimi For Coding" headless (`kimi-do <dir> "<task>"`).
- All work on the dedicated `feat/engelat-minikit` branch (reviewable / revertible).
