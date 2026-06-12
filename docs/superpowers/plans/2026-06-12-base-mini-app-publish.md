# Base Mini App Publish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Engelat a launchable Base Mini App — signed Farcaster manifest, shareable `fc:miniapp` embed, dismissing splash (`setFrameReady`), themed assets, deployed on Vercel.

**Architecture:** One constants/builders module (`lib/miniapp.ts`) feeds both the `fc:miniapp` embed (in `generateMetadata`) and the `/.well-known/farcaster.json` route; a tiny `FrameReady` client component calls `useMiniKit().setFrameReady()`. All URLs derive from `NEXT_PUBLIC_URL`; the `accountAssociation` comes from `FARCASTER_*` env (signed post-deploy via `npx create-onchain --manifest`). Hosting is Vercel; network stays Base Sepolia (existing contract).

**Tech Stack:** Next.js 15 App Router, OnchainKit v1 (`@coinbase/onchainkit/minikit` `useMiniKit`), Vitest, Vercel, headless-canvas asset generation.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `lib/miniapp.ts` | create | constants (name/desc/category/tags/color), `baseUrl()`, `assetUrls()`, `buildEmbed()`, `buildManifest()`, `accountAssociationFromEnv()` |
| `lib/miniapp.test.ts` | create | unit tests for the builders |
| `components/FrameReady.tsx` | create | client: `useMiniKit().setFrameReady()` on mount; renders null |
| `app/.well-known/farcaster.json/route.ts` | create | GET → serve manifest JSON |
| `app/layout.tsx` | modify | `generateMetadata()` with `fc:miniapp` embed + OG + icons; mount `<FrameReady/>` |
| `.env.example` | modify | document `NEXT_PUBLIC_URL`, `FARCASTER_HEADER/PAYLOAD/SIGNATURE` |
| `.env` | modify | add local `NEXT_PUBLIC_URL=http://localhost:3000` |
| `scripts/assets/render.html` | create | canvas templates → `window.renderAsset(name)` returns a PNG dataURL |
| `public/icon.png` | create (generated) | 1024×1024 app icon |
| `public/splash.png` | create (generated) | 200×200 splash logo |
| `public/hero.png` | create (generated) | 1200×630 embed/OG image |

---

### Task 1: `lib/miniapp.ts` — constants + builders

**Files:**
- Create: `lib/miniapp.ts`
- Test: `lib/miniapp.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/miniapp.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  MINIAPP,
  normalizeBase,
  assetUrls,
  buildEmbed,
  buildManifest,
} from "./miniapp";

describe("miniapp", () => {
  it("normalizeBase strips a trailing slash", () => {
    expect(normalizeBase("https://x.com/")).toBe("https://x.com");
    expect(normalizeBase("https://x.com")).toBe("https://x.com");
  });

  it("assetUrls builds absolute asset URLs from a base", () => {
    expect(assetUrls("https://x.com")).toEqual({
      icon: "https://x.com/icon.png",
      splash: "https://x.com/splash.png",
      hero: "https://x.com/hero.png",
      home: "https://x.com",
    });
  });

  it("buildEmbed produces a launch_miniapp embed", () => {
    const e = buildEmbed("https://x.com");
    expect(e.version).toBe("1");
    expect(e.imageUrl).toBe("https://x.com/hero.png");
    expect(e.button.title).toBe("Play Engelat");
    expect(e.button.action.type).toBe("launch_miniapp");
    expect(e.button.action.url).toBe("https://x.com");
    expect(e.button.action.splashImageUrl).toBe("https://x.com/splash.png");
    expect(e.button.action.splashBackgroundColor).toBe(MINIAPP.splashBackgroundColor);
  });

  it("buildManifest includes the miniapp object and omits accountAssociation when no assoc", () => {
    const m = buildManifest("https://x.com");
    expect(m.accountAssociation).toBeUndefined();
    expect(m.miniapp.name).toBe("Engelat");
    expect(m.miniapp.iconUrl).toBe("https://x.com/icon.png");
    expect(m.miniapp.homeUrl).toBe("https://x.com");
    expect(m.miniapp.primaryCategory).toBe("games");
    expect(m.miniapp.splashBackgroundColor).toBe(MINIAPP.splashBackgroundColor);
  });

  it("buildManifest includes accountAssociation when provided", () => {
    const assoc = { header: "h", payload: "p", signature: "s" };
    const m = buildManifest("https://x.com", assoc);
    expect(m.accountAssociation).toEqual(assoc);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/miniapp.test.ts`
Expected: FAIL — cannot resolve `./miniapp`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/miniapp.ts`:

```ts
export const MINIAPP = {
  name: "Engelat",
  subtitle: "Fly through the chart",
  description:
    "A Flappy-style game where a coin's live price chart becomes the obstacle course. Compete on an onchain per-coin leaderboard on Base.",
  primaryCategory: "games",
  tags: ["game", "flappy", "crypto", "chart"],
  splashBackgroundColor: "#1a1a2e",
} as const;

export interface AccountAssociation {
  header: string;
  payload: string;
  signature: string;
}

export function normalizeBase(raw: string): string {
  return raw.replace(/\/+$/, "");
}

export function baseUrl(): string {
  return normalizeBase(process.env.NEXT_PUBLIC_URL || "http://localhost:3000");
}

export function assetUrls(base: string) {
  const b = normalizeBase(base);
  return {
    icon: `${b}/icon.png`,
    splash: `${b}/splash.png`,
    hero: `${b}/hero.png`,
    home: b,
  };
}

export function buildEmbed(base: string) {
  const a = assetUrls(base);
  return {
    version: "1",
    imageUrl: a.hero,
    button: {
      title: "Play Engelat",
      action: {
        type: "launch_miniapp",
        name: MINIAPP.name,
        url: a.home,
        splashImageUrl: a.splash,
        splashBackgroundColor: MINIAPP.splashBackgroundColor,
      },
    },
  };
}

export function accountAssociationFromEnv(): AccountAssociation | undefined {
  const header = process.env.FARCASTER_HEADER;
  const payload = process.env.FARCASTER_PAYLOAD;
  const signature = process.env.FARCASTER_SIGNATURE;
  if (header && payload && signature) return { header, payload, signature };
  return undefined;
}

export function buildManifest(base: string, assoc?: AccountAssociation) {
  const a = assetUrls(base);
  const manifest: {
    accountAssociation?: AccountAssociation;
    miniapp: Record<string, unknown>;
  } = {
    miniapp: {
      version: "1",
      name: MINIAPP.name,
      subtitle: MINIAPP.subtitle,
      description: MINIAPP.description,
      iconUrl: a.icon,
      homeUrl: a.home,
      splashImageUrl: a.splash,
      splashBackgroundColor: MINIAPP.splashBackgroundColor,
      heroImageUrl: a.hero,
      primaryCategory: MINIAPP.primaryCategory,
      tags: [...MINIAPP.tags],
    },
  };
  if (assoc) manifest.accountAssociation = assoc;
  return manifest;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/miniapp.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/miniapp.ts lib/miniapp.test.ts
git commit -m "feat: lib/miniapp — Mini App constants + embed/manifest builders"
```

---

### Task 2: `components/FrameReady.tsx` — dismiss the splash

**Files:**
- Create: `components/FrameReady.tsx`

- [ ] **Step 1: Create the component**

Create `components/FrameReady.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { useMiniKit } from "@coinbase/onchainkit/minikit";

/**
 * Signals to the Mini App host that the app is ready, which dismisses the
 * launch splash. Safe no-op outside a Mini App host. Renders nothing.
 */
export function FrameReady() {
  const { setFrameReady, isFrameReady } = useMiniKit();

  useEffect(() => {
    if (!isFrameReady) {
      setFrameReady();
    }
  }, [isFrameReady, setFrameReady]);

  return null;
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors referencing `FrameReady` (layout wires it in Task 4).

- [ ] **Step 3: Commit**

```bash
git add components/FrameReady.tsx
git commit -m "feat: FrameReady — call setFrameReady() to dismiss the Mini App splash"
```

---

### Task 3: `app/.well-known/farcaster.json/route.ts` — manifest

**Files:**
- Create: `app/.well-known/farcaster.json/route.ts`

- [ ] **Step 1: Create the route**

Create `app/.well-known/farcaster.json/route.ts`:

```ts
import { NextResponse } from "next/server";
import { baseUrl, buildManifest, accountAssociationFromEnv } from "@/lib/miniapp";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(buildManifest(baseUrl(), accountAssociationFromEnv()));
}
```

- [ ] **Step 2: Manually verify against the dev server**

Run (dev server running): `curl -s http://localhost:3000/.well-known/farcaster.json`
Expected: JSON with a `miniapp` object (`"name":"Engelat"`, `iconUrl`/`homeUrl`/`splashImageUrl`
pointing at `http://localhost:3000/...`, `"primaryCategory":"games"`); no `accountAssociation`
key yet (env unset locally).

- [ ] **Step 3: Commit**

```bash
git add app/.well-known/farcaster.json/route.ts
git commit -m "feat: serve /.well-known/farcaster.json manifest"
```

---

### Task 4: `app/layout.tsx` — embed metadata + FrameReady

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Replace the file**

Replace the full contents of `app/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { FrameReady } from "@/components/FrameReady";
import { baseUrl, assetUrls, buildEmbed, MINIAPP } from "@/lib/miniapp";

export function generateMetadata(): Metadata {
  const base = baseUrl();
  const a = assetUrls(base);
  return {
    metadataBase: new URL(base),
    title: MINIAPP.name,
    description: MINIAPP.description,
    openGraph: {
      title: MINIAPP.name,
      description: MINIAPP.description,
      images: [a.hero],
    },
    icons: { icon: a.icon },
    other: {
      "fc:miniapp": JSON.stringify(buildEmbed(base)),
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <FrameReady />
          {children}
        </Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Verify the embed tag renders**

Run (dev server running): `curl -s http://localhost:3000/ | grep -o 'fc:miniapp'`
Expected: prints `fc:miniapp` (the meta tag is present in the served HTML).

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: layout — fc:miniapp embed, OG image, icons, mount FrameReady"
```

---

### Task 5: env documentation

**Files:**
- Modify: `.env.example`
- Modify: `.env`

- [ ] **Step 1: Update `.env.example`**

Replace the full contents of `.env.example` with:

```
# Coinbase Developer Platform key (optional locally)
NEXT_PUBLIC_ONCHAINKIT_API_KEY=

# Deployed per-coin Leaderboard (Base Sepolia)
NEXT_PUBLIC_LEADERBOARD_ADDRESS=

# Public base URL of the deployment (no trailing slash). Drives manifest + embed URLs.
NEXT_PUBLIC_URL=

# Farcaster manifest accountAssociation (generated by `npx create-onchain --manifest`)
FARCASTER_HEADER=
FARCASTER_PAYLOAD=
FARCASTER_SIGNATURE=
```

- [ ] **Step 2: Add local base URL to `.env`**

Append to the existing root `.env` (gitignored):

```
NEXT_PUBLIC_URL=http://localhost:3000
```

- [ ] **Step 3: Commit (`.env.example` only; `.env` is gitignored)**

```bash
git add .env.example
git commit -m "docs: env — NEXT_PUBLIC_URL + FARCASTER_* for the Mini App manifest"
```

---

### Task 6: Generate themed assets (icon / splash / hero)

**Files:**
- Create: `scripts/assets/render.html`
- Create (generated): `public/icon.png`, `public/splash.png`, `public/hero.png`

- [ ] **Step 1: Create the canvas template**

Create `scripts/assets/render.html` (a self-contained page exposing `window.renderAsset(name)`
that draws to an offscreen canvas at the right size and returns a PNG dataURL):

```html
<!doctype html>
<html>
<head><meta charset="utf-8"><title>Engelat asset render</title></head>
<body>
<script>
const BG = "#1a1a2e", WALL = "#e94560", UP = "#2ecc71", BIRD = "#f7d794",
      BEAK = "#e58e26", GROUND = "#0f3460", TEXT = "#ffffff";

function bird(ctx, cx, cy, r) {
  ctx.fillStyle = BIRD;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#1a1a2e";
  ctx.beginPath(); ctx.arc(cx + r * 0.4, cy - r * 0.3, r * 0.12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = BEAK;
  ctx.beginPath();
  ctx.moveTo(cx + r, cy - r * 0.1);
  ctx.lineTo(cx + r * 1.5, cy + r * 0.1);
  ctx.lineTo(cx + r, cy + r * 0.3);
  ctx.fill();
}

// A chart polyline + candles across width w at vertical center band
function chart(ctx, w, h, yBase, amp) {
  const pts = [0.15,0.55,0.30,0.70,0.45,0.25,0.62,0.80,0.50,0.90,0.40];
  ctx.lineWidth = Math.max(3, w * 0.006);
  ctx.strokeStyle = UP;
  ctx.beginPath();
  pts.forEach((p, i) => {
    const x = (i / (pts.length - 1)) * w;
    const y = yBase - (p - 0.5) * amp;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.stroke();
  // candles
  pts.forEach((p, i) => {
    const x = (i / (pts.length - 1)) * w;
    const y = yBase - (p - 0.5) * amp;
    const up = i % 2 === 0;
    ctx.fillStyle = up ? UP : WALL;
    const cw = Math.max(4, w * 0.012);
    ctx.fillRect(x - cw / 2, Math.min(y, yBase), cw, Math.abs(yBase - y) + cw);
  });
}

function drawIcon(ctx, s) {
  // rounded dark bg
  ctx.fillStyle = BG; ctx.fillRect(0, 0, s, s);
  chart(ctx, s, s, s * 0.62, s * 0.5);
  bird(ctx, s * 0.40, s * 0.42, s * 0.13);
}

function drawSplash(ctx, s) {
  ctx.fillStyle = BG; ctx.fillRect(0, 0, s, s);
  chart(ctx, s, s, s * 0.64, s * 0.45);
  bird(ctx, s * 0.42, s * 0.44, s * 0.16);
}

function drawHero(ctx, w, h) {
  ctx.fillStyle = BG; ctx.fillRect(0, 0, w, h);
  chart(ctx, w, h, h * 0.58, h * 0.6);
  ctx.fillStyle = GROUND; ctx.fillRect(0, h - h * 0.08, w, h * 0.08);
  bird(ctx, w * 0.30, h * 0.46, h * 0.09);
  ctx.fillStyle = TEXT;
  ctx.font = `bold ${Math.round(h * 0.15)}px sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillText("ENGELAT", w * 0.42, h * 0.40);
  ctx.fillStyle = "#ffffffcc";
  ctx.font = `${Math.round(h * 0.06)}px sans-serif`;
  ctx.fillText("Fly through the chart", w * 0.42, h * 0.58);
}

window.renderAsset = function (name) {
  const sizes = { icon: [1024, 1024], splash: [200, 200], hero: [1200, 630] };
  const [w, h] = sizes[name];
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  if (name === "icon") drawIcon(ctx, w);
  else if (name === "splash") drawSplash(ctx, w);
  else drawHero(ctx, w, h);
  return c.toDataURL("image/png");
};
</script>
</body>
</html>
```

- [ ] **Step 2: Render each asset to `public/` via headless canvas**

For each of `icon`, `splash`, `hero`: load `scripts/assets/render.html` in a headless browser,
call `window.renderAsset(name)`, and decode the returned `data:image/png;base64,...` to the file.

Procedure (using the Playwright MCP available in this session):
1. `browser_navigate` to `file:///Users/huseyinarslan/Desktop/2d-oyun-engellerden-gecis/scripts/assets/render.html`
2. `browser_evaluate` `() => window.renderAsset('icon')` → returns the dataURL
3. Strip the `data:image/png;base64,` prefix and write the bytes to `public/icon.png`:
   `printf %s "<base64>" | base64 -D > public/icon.png` (macOS `base64 -D`)
4. Repeat for `splash` (`public/splash.png`) and `hero` (`public/hero.png`).

- [ ] **Step 3: Verify dimensions**

Run: `for f in icon splash hero; do echo -n "$f: "; sips -g pixelWidth -g pixelHeight public/$f.png | awk '/pixel/{printf $2" "} END{print ""}'; done`
Expected: `icon: 1024 1024`, `splash: 200 200`, `hero: 1200 630`.

- [ ] **Step 4: Commit**

```bash
git add scripts/assets/render.html public/icon.png public/splash.png public/hero.png
git commit -m "feat: themed Mini App assets (icon, splash, hero) + render template"
```

---

### Task 7: Local verification

**Files:** none (verification)

- [ ] **Step 1: Full type-check, unit tests, build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm test`
Expected: all vitest suites pass (includes `lib/miniapp.test.ts`).

Run: `npm run build`
Expected: `✓ Compiled successfully`; the route list includes `/.well-known/farcaster.json`.

- [ ] **Step 2: Verify manifest + embed served**

Run (dev server running): `curl -s http://localhost:3000/.well-known/farcaster.json | python3 -m json.tool | head -20`
Expected: valid JSON, `miniapp.name == "Engelat"`, asset URLs absolute.

Run: `curl -s http://localhost:3000/ | grep -c 'fc:miniapp'`
Expected: `1` (embed meta present).

- [ ] **Step 3: Confirm assets load**

Run: `for f in icon splash hero; do curl -s -o /dev/null -w "$f %{http_code}\n" http://localhost:3000/$f.png; done`
Expected: each `200`.

---

### Task 8: Deploy to Vercel  ⚑ (needs Vercel auth)

**Files:** none (deploy)

> Vercel authentication is the user's action; the agent drives the deploy once authed.

- [ ] **Step 1: Link + first deploy**

Run: `vercel link` (follow prompts to create/link the project), then `vercel --yes`
Expected: a preview deployment URL is printed.

- [ ] **Step 2: Set environment variables (Production)**

```bash
vercel env add NEXT_PUBLIC_LEADERBOARD_ADDRESS production   # 0xa781A9aE75F67Ad7Fd00121345B7082C1AB9c9a1
# (optional) vercel env add NEXT_PUBLIC_ONCHAINKIT_API_KEY production
```

- [ ] **Step 3: Promote to production and capture the domain**

Run: `vercel --prod --yes`
Expected: a production URL like `https://engelat.vercel.app`. Record it as `<PROD_URL>`.

- [ ] **Step 4: Set `NEXT_PUBLIC_URL` to the production domain and redeploy**

```bash
vercel env add NEXT_PUBLIC_URL production   # <PROD_URL>  (no trailing slash)
vercel --prod --yes
```

- [ ] **Step 5: Verify the live manifest + embed**

Run: `curl -s <PROD_URL>/.well-known/farcaster.json | python3 -m json.tool | head -20`
Expected: asset URLs now point at `<PROD_URL>`; still no `accountAssociation` (signed next).

Run: `curl -s <PROD_URL>/ | grep -c 'fc:miniapp'`
Expected: `1`.

---

### Task 9: Sign the account association  ⚑ (user's Farcaster custody)

**Files:** none (uses Vercel env)

- [ ] **Step 1: Generate the signed association for the production domain**

Run (in the project root): `npx create-onchain --manifest`
Follow the prompts: connect the Farcaster custody wallet, enter the production domain
`<PROD_URL>`, sign. The tool writes `FARCASTER_HEADER`, `FARCASTER_PAYLOAD`, `FARCASTER_SIGNATURE`
into the local `.env`.

- [ ] **Step 2: Push those three values to Vercel (Production) and redeploy**

```bash
vercel env add FARCASTER_HEADER production      # value from .env
vercel env add FARCASTER_PAYLOAD production      # value from .env
vercel env add FARCASTER_SIGNATURE production    # value from .env
vercel --prod --yes
```

- [ ] **Step 3: Verify the signed manifest**

Run: `curl -s <PROD_URL>/.well-known/farcaster.json | python3 -c "import sys,json; d=json.load(sys.stdin); print('assoc keys:', list(d.get('accountAssociation',{}).keys())); print('name:', d['miniapp']['name'])"`
Expected: `assoc keys: ['header', 'payload', 'signature']` and `name: Engelat`.

---

### Task 10: Validate + launch test in Base App  ⚑

**Files:** none (manual)

- [ ] **Step 1: Manifest validator**

Open the Base/Farcaster Mini App manifest validator (Base Build → Mini Apps → Manifest tool, or
the Farcaster manifest checker) and enter `<PROD_URL>`.
Expected: manifest valid; account association resolves to the user's FID; embed preview renders a
launchable "Play Engelat" card.

- [ ] **Step 2: In-app launch test**

In Base App (or Warpcast): paste `<PROD_URL>` into a cast / use the developer "open Mini App"
flow.
Expected: the embed shows the hero image + "Play Engelat"; tapping launches; the splash (icon on
`#1a1a2e`) dismisses (proves `setFrameReady`); the coin picker → game loads.

- [ ] **Step 3: Onchain smoke (Base Sepolia)**

Inside the launched Mini App: pick a coin, play, connect wallet, Submit Score.
Expected: tx confirms on Base Sepolia; that coin's leaderboard shows the entry.

- [ ] **Step 4: Final commit (any notes)**

```bash
git add -A && git commit -m "docs: Base Mini App published + launch-tested" || true
```

---

## Self-Review

**Spec coverage:**
- `setFrameReady` → Task 2 + mounted in Task 4. ✓
- `fc:miniapp` embed → Task 1 (`buildEmbed`) + Task 4 (`generateMetadata`). ✓
- `/.well-known/farcaster.json` manifest (+ assoc from env, omit when unset) → Task 1 (`buildManifest`/`accountAssociationFromEnv`) + Task 3. ✓
- Assets (icon/splash/hero) → Task 6. ✓
- `.env.example` + `NEXT_PUBLIC_URL` + `FARCASTER_*` → Task 5. ✓
- URLs derive from `NEXT_PUBLIC_URL` → Task 1 (`baseUrl`/`assetUrls`), used everywhere. ✓
- Vercel deploy + env → Task 8. ✓
- accountAssociation signing (`create-onchain --manifest`) → Task 9. ✓
- Validate + Base App launch + onchain smoke → Task 10. ✓
- Manifest route never 500s without assoc (omit key) → Task 1 `buildManifest` + Task 3. ✓
- Local fallback `http://localhost:3000` → Task 1 `baseUrl`. ✓

**Placeholder scan:** No TBD/TODO; every code step is complete. `<PROD_URL>` in Tasks 8–10 is a
captured runtime value (the deploy output), not a placeholder for missing code. ✓

**Type consistency:** `normalizeBase`/`assetUrls`/`buildEmbed`/`buildManifest`/`accountAssociationFromEnv`
names match across Tasks 1, 3, 4; `buildManifest(base, assoc?)` signature consistent between the test
(Task 1), the route (Task 3); `buildEmbed(base)` used in layout (Task 4) matches Task 1. Env names
`NEXT_PUBLIC_URL` / `FARCASTER_HEADER|PAYLOAD|SIGNATURE` consistent across Tasks 1, 5, 8, 9. ✓

> Schema note: `fc:miniapp` / `launch_miniapp` / `farcaster.json miniapp` reflect the current Base
> Mini Apps spec (verified against OnchainKit v1 + `create-onchain --manifest`). If the validator in
> Task 10 flags a field, adjust `lib/miniapp.ts` (single source) and redeploy.
