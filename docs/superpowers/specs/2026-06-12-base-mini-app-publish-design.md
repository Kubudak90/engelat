# Engelat — Publish as a Base Mini App (launchable in Base App)

- Date: 2026-06-12
- Status: Approved design (brainstorming complete)
- Builds on: the existing MiniKit app (OnchainKit `miniKit` already enabled) + chart-to-course feature

## Goal
Turn the already-working app into a **publishable, launchable Base Mini App**: a signed Farcaster
manifest, a shareable embed, a dismissing splash, themed assets, and a public Vercel deployment —
so it can be added/launched in **Base App / Warpcast**.

## Key decisions (from brainstorming)
1. **Scope:** full publish — launchable in Base App.
2. **Network:** **Base Sepolia** (testnet) — reuse the deployed Leaderboard
   `0xa781A9aE75F67Ad7Fd00121345B7082C1AB9c9a1`. No contract redeploy.
3. **Account association:** the user has a Farcaster account and signs the domain association
   after the first deploy (publish-time step, their action).
4. **Assets:** generated here, themed to the game (bird + chart, dark `#1a1a2e`).
5. **Hosting:** Vercel.

## What's missing today (gaps this closes)
- No `setFrameReady()` call → the Mini App launch splash never dismisses.
- No embed metadata (`fc:miniapp`) → not launchable when shared.
- No `/.well-known/farcaster.json` manifest (+ no `accountAssociation`).
- No icon / splash / hero images.
- No public hosting.

## Components
| File | Status | Responsibility |
|---|---|---|
| `lib/miniapp.ts` | **new** | Single source of Mini App constants (name, description, category, tags, colors) + URL helpers reading `NEXT_PUBLIC_URL`; builds the embed object and the manifest `miniapp` object |
| `components/FrameReady.tsx` | **new** | Client component: calls `useMiniKit().setFrameReady()` once on mount (dismisses splash); renders nothing |
| `app/layout.tsx` | modify | Add `metadata.other["fc:miniapp"]` embed JSON, OG/twitter image, icons, real title/description; mount `<FrameReady/>` |
| `app/.well-known/farcaster.json/route.ts` | **new** | GET → serve `{ accountAssociation, miniapp }`; association from env, miniapp object from `lib/miniapp.ts` |
| `public/icon.png` | **new** | 1024×1024 opaque app icon |
| `public/splash.png` | **new** | 200×200 launch splash logo |
| `public/hero.png` | **new** | 1200×630 (3:2) embed + OG image |
| `.env.example` | modify | document `NEXT_PUBLIC_URL` + `FARCASTER_HEADER` / `FARCASTER_PAYLOAD` / `FARCASTER_SIGNATURE` |
| `scripts/gen-assets.*` | **new (build-time only)** | Renders the three PNGs from an SVG/canvas template (headless), committed outputs in `public/` |

## Manifest & embed shapes
The `fc:miniapp` embed and `farcaster.json` field names evolved (`fc:frame`→`fc:miniapp`,
`launch_frame`→`launch_miniapp`). **Verify exact current schema against Base docs (via Context7 /
docs.base.org Mini Apps) at implementation time**; the structures below are the intended content.

- **Embed** (`app/layout.tsx` `metadata.other["fc:miniapp"]`, JSON string):
  `{ version, imageUrl: <hero>, button: { title: "Play Engelat", action: { type: "launch_miniapp", name: "Engelat", url: <home>, splashImageUrl: <splash>, splashBackgroundColor: "#1a1a2e" } } }`
- **Manifest** (`/.well-known/farcaster.json`):
  `{ accountAssociation: { header, payload, signature }, miniapp: { version, name: "Engelat", iconUrl, homeUrl, splashImageUrl, splashBackgroundColor: "#1a1a2e", subtitle, description, primaryCategory: "games", tags: ["game","flappy","crypto","chart"], heroImageUrl } }`

All URLs derive from `NEXT_PUBLIC_URL` so the manifest/embed bind to the deployed domain via one env var.

## Data / config flow
Deploy → obtain production URL → set `NEXT_PUBLIC_URL` (+ existing `NEXT_PUBLIC_LEADERBOARD_ADDRESS`)
→ redeploy → user signs domain association → set `FARCASTER_HEADER/PAYLOAD/SIGNATURE` → redeploy →
`/.well-known/farcaster.json` now returns a valid, signed manifest.

## Publish sequence (⚑ = user action)
1. Generate assets (`public/icon.png`, `splash.png`, `hero.png`).
2. Mini App code: `lib/miniapp.ts`, `FrameReady`, layout embed/metadata, manifest route, env docs.
3. ⚑ Authenticate Vercel; deploy. (agent can drive the deploy once authed.)
4. Set `NEXT_PUBLIC_URL` + env on Vercel; redeploy.
5. ⚑ Sign `accountAssociation` for the domain (Base manifest tool, build.base.org) → paste
   header/payload/signature → set as Vercel env → redeploy.
6. Validate manifest + embed; ⚑ launch-test in Base App.

## Error handling / edge cases
- `/.well-known/farcaster.json`: if association env vars are unset, still serve the `miniapp`
  object with `accountAssociation` omitted (valid pre-signing state) so the route never 500s.
- `NEXT_PUBLIC_URL` unset (local dev): fall back to `http://localhost:3000` so the route/embed
  still render for inspection.
- `setFrameReady()` is safe to call outside a Mini App host (no-op), so local web still works.

## Testing / verification
- Unit (vitest): `lib/miniapp.ts` builds embed + manifest objects with the right shape and URLs
  derived from a given base URL; manifest omits `accountAssociation` when env is unset.
- Local: `/.well-known/farcaster.json` returns valid JSON; layout `<head>` contains the
  `fc:miniapp` tag; `<FrameReady/>` mounts without error.
- Post-deploy: Base/Farcaster **manifest validator** passes; embed preview shows a launchable card;
  Base App launch dismisses splash and loads the game; wallet + submit still work (Base Sepolia).

## Known limitations (accepted)
- Testnet leaderboard: random users need Base Sepolia ETH to submit scores. (Mainnet / gasless
  Paymaster is a later enhancement.)
- `accountAssociation` is domain-bound: if the production domain changes, it must be re-signed.

## Out of scope (YAGNI for now)
- Webhooks / notifications (`webhookUrl`), mainnet deploy, Paymaster sponsorship, custom domain.
