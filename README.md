# Engelat 🕊️📈

A Flappy-style arcade game where a coin's **live price chart becomes the obstacle
course**. Pick BTC, ETH, SOL, XRP or DOGE — its last 150 candles fold into a
glowing canyon you fly through. Collect coins for combo multipliers, then cast
your score on Farcaster and climb a per-coin onchain leaderboard on Base.

Built as a [Farcaster Mini App](https://miniapps.farcaster.xyz/) with Next.js 15,
React 19, OnchainKit / MiniKit, wagmi + viem, and a from-scratch canvas engine.

Live: https://engelat.vercel.app

## Gameplay

- **Tap / Click / Space** to flap. The corridor follows the coin's normalized
  price line; gaps tighten and speed rises each time you loop the chart.
- **Collectible coins** sit off the safe centerline (risk/reward). Each pickup
  grows a **combo multiplier** (up to ×6); miss one or crash and the combo resets.
- Score = distance segments + coin bonus. Your best per coin is cached locally
  and can be submitted onchain.
- **Cast your score** → the cast unfurls into a branded image (live sparkline)
  plus a "beat it" button that drops the reader straight into the same coin's run.

## Architecture

```
app/
  layout.tsx              Root metadata (title, OG, icons, metadataBase)
  page.tsx                Server component. generateMetadata() reads ?coin&score
                          and emits a per-score fc:miniapp embed; renders GameShell.
  api/chart/route.ts      Live candle closes for a coin (Crypto.com)
  api/prices/route.ts     Live tickers for the coin picker
  api/og/route.tsx        Dynamic share image (next/og) — score card + sparkline
  .well-known/farcaster.json  Mini App manifest (signed account association via env)
components/
  GameShell.tsx           Client orchestrator: picker → game → game-over panel,
                          viral share (composeCast / Warpcast intent), mute, restart
  Game.tsx                Canvas engine: fixed-timestep physics, collectibles,
                          particles, trail, screen shake, parallax, themed walls
  CoinPicker.tsx          Themed coin selection
  Leaderboard.tsx         Top-10 per coin, highlights the connected player
  ScoreSubmit.tsx         Onchain score submission (OnchainKit Transaction)
lib/
  course.ts               Chart → normalized corridor + difficulty curve (tested)
  collectibles.ts         Deterministic coin placement + combo math (tested)
  share.ts                Cast text + deep-link + OG-image URL builders (tested)
  theme.ts                Per-coin color identity (tested)
  audio.ts                Web Audio synth (zero assets) + mute persistence
  haptics.ts              Farcaster haptics SDK with navigator.vibrate fallback
  coins.ts / cryptocom.ts / leaderboard.ts / miniapp.ts
contracts/                Foundry project — per-coin Leaderboard (Base Sepolia)
```

The engine advances physics on a **fixed 60 fps timestep** (accumulator with a
spiral-of-death clamp), so it plays identically on 60 Hz and 120 Hz displays.
Coins live in segment space — fully determined by their integer index — which
keeps them fair, replayable, and unit-testable without any canvas math.

## Develop

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # vitest (pure logic: course, collectibles, share, theme)
npm run build      # production build
```

### Environment

Copy `.env.example` → `.env`. The viral share + dynamic OG image work with the
existing vars — no new configuration is required.

| var | purpose |
| --- | --- |
| `NEXT_PUBLIC_URL` | Public base URL (drives manifest, embed + share links). Baked in at build time. |
| `NEXT_PUBLIC_LEADERBOARD_ADDRESS` | Deployed per-coin `Leaderboard` (Base Sepolia). |
| `NEXT_PUBLIC_ONCHAINKIT_API_KEY` | Optional — enables full OnchainKit features. |
| `FARCASTER_HEADER` / `FARCASTER_PAYLOAD` / `FARCASTER_SIGNATURE` | Signed manifest account association. |
