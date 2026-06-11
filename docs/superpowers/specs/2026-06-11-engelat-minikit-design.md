# Engelat — Base Mini App (Flappy + onchain leaderboard)

- Date: 2026-06-11
- Status: Approved design (brainstorming complete)

## Goal
A 2D "obstacle-passing" (Flappy-style) game packaged as a **Base Mini App**, with an
**onchain high-score leaderboard on Base Sepolia**.

## Stack
- Next.js (App Router, TypeScript), scaffolded from the MiniKit template (`npx create-onchain --mini`)
- OnchainKit v1.0 (`@coinbase/onchainkit`): `OnchainKitProvider` with
  `miniKit={{ enabled: true, autoConnect: true }}`, `chain = baseSepolia`
- wagmi + viem + @tanstack/react-query (provided by the template)
- Game: **vanilla HTML5 Canvas** (no game engine)
- Contract: Solidity + **Foundry**, deployed to **Base Sepolia (84532)**

## Components
1. `components/Game.tsx` — canvas Flappy game
   - Bird with gravity; tap / click / Space → flap (upward impulse)
   - Scrolling obstacle pairs with a gap; spawn on interval, move left
   - Collision (obstacle, ground, ceiling) → game over
   - Score +1 per obstacle passed; show current + best (localStorage)
   - `onGameOver(score)` callback; restart support
   - Mobile-first (Mini App webview): touch + keyboard, responsive canvas
2. `components/ScoreSubmit.tsx` — shown after game over
   - Wallet connect (OnchainKit Wallet) if needed
   - "Submit score" → OnchainKit `<Transaction>` calling `submitScore(score)` on the
     Leaderboard contract, `chainId = baseSepolia`
   - Tx status feedback
3. `components/Leaderboard.tsx` — reads top scores
   - wagmi `useReadContract` → `getTop()` → render top 10 (address + score)
   - Refetch after a successful submit
4. `contracts/` (Foundry) — `Leaderboard.sol`
   - `mapping(address => uint256) public bestScore`
   - Top-10 array maintained on submit (insert if it qualifies)
   - `submitScore(uint256 score)`: if `score > bestScore[msg.sender]`, update best,
     update top-10, emit `ScoreSubmitted(player, score)`
   - `getTop()` returns `(address[10], uint256[10])`
   - Foundry tests: best-only-increases, top-10 ordering, event
5. `app/` — page wiring: Game → on game over show ScoreSubmit + Leaderboard

## Data flow
`Game(score)` → `ScoreSubmit` (`<Transaction>` submitScore) → `Leaderboard.sol` (Base Sepolia)
→ `Leaderboard.tsx` (`useReadContract` getTop) → UI.

## Config / env
- `NEXT_PUBLIC_ONCHAINKIT_API_KEY` — Coinbase Developer Platform key (user provides; placeholder for now)
- `NEXT_PUBLIC_LEADERBOARD_ADDRESS` — set after deploy
- Chain: Base Sepolia (84532)

## Known limitations (MVP, accepted)
- Score is cheatable — anyone can call `submitScore(huge)`. No server attestation in MVP.
- Farcaster manifest `accountAssociation` requires the user's Farcaster custody signing →
  done at publish time, not part of MVP.
- Testnet only (Base Sepolia). Mainnet later.

## Build sequence (implementation delegated to "Kimi For Coding" headless; reviewed by Opus)
1. Scaffold MiniKit app + Canvas Flappy game (`Game.tsx`, page wiring), baseSepolia config
2. `Leaderboard.sol` + Foundry tests
3. Onchain wiring: `ScoreSubmit` (`<Transaction>`) + `Leaderboard` read
4. Deploy to Base Sepolia + end-to-end test

## Delegation / orchestration note
- Opus (main session) plans, reviews every diff, and handles env/scaffold/deploy mechanics.
- Kimi For Coding writes the actual code, invoked headless via `kimi-do <dir> "<task>"`.
- All work on a dedicated git branch so every change is reviewable and revertible.
