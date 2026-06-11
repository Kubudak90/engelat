# Chart-to-Course Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Engelat's random Flappy obstacles with a corridor whose centerline is a real coin's live price chart; make the onchain leaderboard per-coin.

**Architecture:** Pure, unit-tested helper libs (`lib/coins.ts`, `lib/cryptocom.ts`, `lib/course.ts`) feed two Next.js route handlers (`/api/chart`, `/api/prices`) that proxy Crypto.com public REST. `CoinPicker` → `Game` (canvas, chart-driven corridor, endless+accelerating) → `ScoreSubmit`/`Leaderboard`, all keyed by coin. The Solidity `Leaderboard` is re-keyed by `bytes32 coin` and redeployed to Base Sepolia.

**Tech Stack:** Next.js 15 (App Router) + TypeScript, React 19, viem/wagmi, OnchainKit `<Transaction>`, HTML5 Canvas, Foundry (Solidity ^0.8.24), Vitest for pure-logic unit tests.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `package.json` | modify | add `vitest` devDep + `test` script |
| `lib/coins.ts` | create | `SUPPORTED_COINS`, `getCoin`, `isSupportedSymbol`, `coinKey` (symbol→bytes32) |
| `lib/coins.test.ts` | create | unit tests for coins lib |
| `lib/cryptocom.ts` | create | Crypto.com URL builders + response parsers (closes, ticker prices) |
| `lib/cryptocom.test.ts` | create | unit tests for parsers |
| `lib/course.ts` | create | `normalizeSeries`, `difficultyForLoop`, `centerlineAt`, `loopCountAt` |
| `lib/course.test.ts` | create | unit tests for course math |
| `app/api/chart/route.ts` | create | GET ?coin → `{coin,instrument,closes,last}` |
| `app/api/prices/route.ts` | create | GET → `{prices:{SYMBOL:number}}` |
| `components/CoinPicker.tsx` | create | coin grid w/ live prices; on select fetch chart, hand up series |
| `components/Game.tsx` | rewrite | chart corridor, endless+accelerating, corridor collision, segment scoring |
| `contracts/src/Leaderboard.sol` | rewrite | per-coin (`bytes32`) best + top-10 |
| `contracts/test/Leaderboard.t.sol` | rewrite | per-coin tests incl. isolation |
| `lib/leaderboard.ts` | modify | ABI: `submitScore(bytes32,uint256)`, `getTop(bytes32)`, keyed event |
| `components/ScoreSubmit.tsx` | modify | accept `coin`, call `submitScore(coinKey,score)` |
| `components/Leaderboard.tsx` | modify | accept `coin`, `getTop(coinKey)`, coin switcher |
| `app/page.tsx` | rewrite | flow: pick → play → submit + per-coin board |
| `contracts/script/Deploy.s.sol` | (unchanged) | re-run to redeploy; update env address |

---

### Task 1: Vitest tooling

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add vitest devDependency and test script**

In `package.json`, add `"test": "vitest run"` to `scripts`, and `"vitest": "^2.0.0"` to `devDependencies`.

Resulting `scripts` block:

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run"
  },
```

Add to `devDependencies`:

```json
    "vitest": "^2.0.0"
```

- [ ] **Step 2: Install**

Run: `npm install`
Expected: installs vitest, no errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add vitest for pure-logic unit tests"
```

---

### Task 2: `lib/coins.ts` — supported coins + onchain key

**Files:**
- Create: `lib/coins.ts`
- Test: `lib/coins.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/coins.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { SUPPORTED_COINS, getCoin, isSupportedSymbol, coinKey } from "./coins";

describe("coins", () => {
  it("has a non-empty curated list with instrument names", () => {
    expect(SUPPORTED_COINS.length).toBeGreaterThan(0);
    for (const c of SUPPORTED_COINS) {
      expect(c.instrument).toBe(`${c.symbol}_USDT`);
    }
  });

  it("isSupportedSymbol recognizes members and rejects others", () => {
    expect(isSupportedSymbol("BTC")).toBe(true);
    expect(isSupportedSymbol("NOPE")).toBe(false);
  });

  it("getCoin returns the config or undefined", () => {
    expect(getCoin("BTC")?.instrument).toBe("BTC_USDT");
    expect(getCoin("NOPE")).toBeUndefined();
  });

  it("coinKey is the right-padded bytes32 of the symbol", () => {
    // 'BTC' = 0x425443, right-padded to 32 bytes
    expect(coinKey("BTC")).toBe(
      "0x4254430000000000000000000000000000000000000000000000000000000000"
    );
    expect(coinKey("BTC")).toHaveLength(66);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/coins.test.ts`
Expected: FAIL — cannot resolve `./coins`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/coins.ts`:

```ts
import { stringToHex } from "viem";

export interface CoinConfig {
  symbol: string; // "BTC"
  name: string; // "Bitcoin"
  instrument: string; // "BTC_USDT"
}

export const SUPPORTED_COINS: CoinConfig[] = [
  { symbol: "BTC", name: "Bitcoin", instrument: "BTC_USDT" },
  { symbol: "ETH", name: "Ethereum", instrument: "ETH_USDT" },
  { symbol: "SOL", name: "Solana", instrument: "SOL_USDT" },
  { symbol: "XRP", name: "XRP", instrument: "XRP_USDT" },
  { symbol: "DOGE", name: "Dogecoin", instrument: "DOGE_USDT" },
];

export function isSupportedSymbol(symbol: string): boolean {
  return SUPPORTED_COINS.some((c) => c.symbol === symbol);
}

export function getCoin(symbol: string): CoinConfig | undefined {
  return SUPPORTED_COINS.find((c) => c.symbol === symbol);
}

// Onchain key: bytes32 of the symbol string, right-padded with zeros.
// Matches Solidity `bytes32("BTC")`.
export function coinKey(symbol: string): `0x${string}` {
  return stringToHex(symbol, { size: 32 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/coins.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/coins.ts lib/coins.test.ts
git commit -m "feat: lib/coins — supported coins + bytes32 coin key"
```

---

### Task 3: `lib/cryptocom.ts` — URL builders + response parsers

**Files:**
- Create: `lib/cryptocom.ts`
- Test: `lib/cryptocom.test.ts`

Confirmed live response shapes:
- candlestick → `{ result: { data: [ { c: "<close str>", o, h, l, v, t }, ... ] } }`, ascending by `t`.
- tickers → `{ result: { data: [ { i: "BTC_USDT", a: "<last price str>", ... }, ... ] } }`.

- [ ] **Step 1: Write the failing test**

Create `lib/cryptocom.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  candlestickUrl,
  tickersUrl,
  parseCandlestickCloses,
  parseTickerPrices,
} from "./cryptocom";

describe("cryptocom", () => {
  it("builds candlestick url with instrument, timeframe, count", () => {
    expect(candlestickUrl("BTC_USDT", "15m", 150)).toBe(
      "https://api.crypto.com/exchange/v1/public/get-candlestick?instrument_name=BTC_USDT&timeframe=15m&count=150"
    );
  });

  it("builds tickers url", () => {
    expect(tickersUrl()).toBe(
      "https://api.crypto.com/exchange/v1/public/get-tickers"
    );
  });

  it("parses candlestick closes as numbers in order", () => {
    const json = {
      result: { data: [{ c: "61289.76" }, { c: "62000.5" }, { c: "63561.91" }] },
    };
    expect(parseCandlestickCloses(json)).toEqual([61289.76, 62000.5, 63561.91]);
  });

  it("throws on malformed candlestick response", () => {
    expect(() => parseCandlestickCloses({})).toThrow();
  });

  it("parses ticker prices keyed by instrument using field 'a'", () => {
    const json = {
      result: {
        data: [
          { i: "BTC_USDT", a: "63559.01" },
          { i: "ETH_USDT", a: "2450.12" },
          { i: "JUNK_USDT", a: "not-a-number" },
        ],
      },
    };
    expect(parseTickerPrices(json)).toEqual({
      BTC_USDT: 63559.01,
      ETH_USDT: 2450.12,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/cryptocom.test.ts`
Expected: FAIL — cannot resolve `./cryptocom`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/cryptocom.ts`:

```ts
const BASE = "https://api.crypto.com/exchange/v1/public";

export function candlestickUrl(
  instrument: string,
  timeframe = "15m",
  count = 150
): string {
  return `${BASE}/get-candlestick?instrument_name=${instrument}&timeframe=${timeframe}&count=${count}`;
}

export function tickersUrl(): string {
  return `${BASE}/get-tickers`;
}

interface CandleRow {
  c: string;
}
interface TickerRow {
  i: string;
  a: string;
}

// Ascending close prices (oldest → newest), dropping any non-finite values.
export function parseCandlestickCloses(json: unknown): number[] {
  const data = (json as { result?: { data?: CandleRow[] } })?.result?.data;
  if (!Array.isArray(data)) throw new Error("Invalid candlestick response");
  return data.map((row) => Number(row.c)).filter((n) => Number.isFinite(n));
}

// { instrument_name: lastPrice }. Field `a` is the latest trade price.
export function parseTickerPrices(json: unknown): Record<string, number> {
  const data = (json as { result?: { data?: TickerRow[] } })?.result?.data;
  if (!Array.isArray(data)) throw new Error("Invalid tickers response");
  const out: Record<string, number> = {};
  for (const row of data) {
    const price = Number(row?.a);
    if (typeof row?.i === "string" && Number.isFinite(price)) {
      out[row.i] = price;
    }
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/cryptocom.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/cryptocom.ts lib/cryptocom.test.ts
git commit -m "feat: lib/cryptocom — Crypto.com public REST url builders + parsers"
```

---

### Task 4: `lib/course.ts` — chart→corridor math

**Files:**
- Create: `lib/course.ts`
- Test: `lib/course.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/course.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  normalizeSeries,
  difficultyForLoop,
  centerlineAt,
  loopCountAt,
} from "./course";

describe("course", () => {
  it("normalizeSeries maps to [0,1] with min→0 and max→1", () => {
    expect(normalizeSeries([10, 20, 30])).toEqual([0, 0.5, 1]);
  });

  it("normalizeSeries returns 0.5 for a flat series (no divide-by-zero)", () => {
    expect(normalizeSeries([5, 5, 5])).toEqual([0.5, 0.5, 0.5]);
  });

  it("difficultyForLoop ramps speed up and gap down, with caps/floors", () => {
    expect(difficultyForLoop(0)).toEqual({ speed: 2.5, gap: 170 });
    expect(difficultyForLoop(5)).toEqual({ speed: 4.5, gap: 140 });
    expect(difficultyForLoop(100)).toEqual({ speed: 6, gap: 110 });
  });

  it("centerlineAt returns exact points and interpolates between them", () => {
    expect(centerlineAt([0, 1], 0)).toBe(0);
    expect(centerlineAt([0, 1], 0.5)).toBe(0.5);
  });

  it("centerlineAt wraps (tiles) past the end of the series", () => {
    // pos 1.5 on [0,1]: from index1 (value 1) toward index0 (value 0), halfway → 0.5
    expect(centerlineAt([0, 1], 1.5)).toBe(0.5);
    // pos 2 wraps fully back to index0
    expect(centerlineAt([0, 1], 2)).toBe(0);
  });

  it("loopCountAt counts completed series passes", () => {
    expect(loopCountAt(0, 3)).toBe(0);
    expect(loopCountAt(3, 3)).toBe(1);
    expect(loopCountAt(7, 3)).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/course.test.ts`
Expected: FAIL — cannot resolve `./course`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/course.ts`:

```ts
export interface Difficulty {
  speed: number; // px per frame
  gap: number; // corridor gap in px
}

const BASE_SPEED = 2.5;
const SPEED_STEP = 0.4;
const MAX_SPEED = 6.0;
const BASE_GAP = 170;
const GAP_STEP = 6;
const MIN_GAP = 110;

export function difficultyForLoop(loop: number): Difficulty {
  const speed = Math.min(MAX_SPEED, BASE_SPEED + SPEED_STEP * loop);
  const gap = Math.max(MIN_GAP, BASE_GAP - GAP_STEP * loop);
  return { speed, gap };
}

// Normalize closes → [0,1] where the lowest price → 0 and the highest → 1.
// Flat series → 0.5 everywhere (avoids divide-by-zero).
export function normalizeSeries(closes: number[]): number[] {
  if (closes.length === 0) return [];
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min;
  if (range === 0) return closes.map(() => 0.5);
  return closes.map((c) => (c - min) / range);
}

// Interpolated normalized value at a continuous segment position `pos`
// (0 = first point, 1 = second, ...), tiling (wrapping) over the array.
export function centerlineAt(normalized: number[], pos: number): number {
  const n = normalized.length;
  if (n === 0) return 0.5;
  if (n === 1) return normalized[0];
  const wrapped = ((pos % n) + n) % n;
  const i = Math.floor(wrapped);
  const frac = wrapped - i;
  const a = normalized[i];
  const b = normalized[(i + 1) % n];
  return a + (b - a) * frac;
}

// Number of full passes over the series completed at segment position `pos`.
export function loopCountAt(pos: number, n: number): number {
  if (n <= 0) return 0;
  return Math.floor(pos / n);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/course.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/course.ts lib/course.test.ts
git commit -m "feat: lib/course — chart normalization, corridor centerline, difficulty ramp"
```

---

### Task 5: API route handlers (`/api/chart`, `/api/prices`)

**Files:**
- Create: `app/api/chart/route.ts`
- Create: `app/api/prices/route.ts`

- [ ] **Step 1: Create the chart route**

Create `app/api/chart/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getCoin, isSupportedSymbol } from "@/lib/coins";
import { candlestickUrl, parseCandlestickCloses } from "@/lib/cryptocom";

export const dynamic = "force-dynamic"; // live chart, never cache

export async function GET(req: NextRequest) {
  const symbol = (req.nextUrl.searchParams.get("coin") ?? "").toUpperCase();
  if (!isSupportedSymbol(symbol)) {
    return NextResponse.json(
      { error: `Unsupported coin: ${symbol}` },
      { status: 400 }
    );
  }
  const coin = getCoin(symbol)!;
  try {
    const res = await fetch(candlestickUrl(coin.instrument, "15m", 150), {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const closes = parseCandlestickCloses(await res.json());
    if (closes.length === 0) throw new Error("no candles");
    return NextResponse.json({
      coin: coin.symbol,
      instrument: coin.instrument,
      closes,
      last: closes[closes.length - 1],
    });
  } catch {
    return NextResponse.json(
      { error: `Failed to fetch chart for ${symbol}` },
      { status: 502 }
    );
  }
}
```

- [ ] **Step 2: Create the prices route**

Create `app/api/prices/route.ts`:

```ts
import { NextResponse } from "next/server";
import { SUPPORTED_COINS } from "@/lib/coins";
import { tickersUrl, parseTickerPrices } from "@/lib/cryptocom";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await fetch(tickersUrl(), { cache: "no-store" });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const all = parseTickerPrices(await res.json());
    const prices: Record<string, number> = {};
    for (const c of SUPPORTED_COINS) {
      if (all[c.instrument] !== undefined) prices[c.symbol] = all[c.instrument];
    }
    return NextResponse.json({ prices });
  } catch {
    return NextResponse.json({ error: "Failed to fetch prices" }, { status: 502 });
  }
}
```

- [ ] **Step 3: Manually verify both routes against the running dev server**

Run (in one shell): `npm run dev`
Run (in another): `curl -s "http://localhost:3000/api/chart?coin=BTC" | head -c 200`
Expected: JSON with `"coin":"BTC"`, `"instrument":"BTC_USDT"`, a `closes` array, and a numeric `last`.

Run: `curl -s "http://localhost:3000/api/chart?coin=NOPE"`
Expected: `{"error":"Unsupported coin: NOPE"}` with HTTP 400.

Run: `curl -s "http://localhost:3000/api/prices"`
Expected: `{"prices":{"BTC":<num>,"ETH":<num>,...}}`.

- [ ] **Step 4: Commit**

```bash
git add app/api/chart/route.ts app/api/prices/route.ts
git commit -m "feat: /api/chart + /api/prices — proxy Crypto.com public REST"
```

---

### Task 6: `components/CoinPicker.tsx`

**Files:**
- Create: `components/CoinPicker.tsx`

Behavior: render `SUPPORTED_COINS` as a grid; fetch `/api/prices` once for live prices (best-effort — missing prices just don't show). On tapping a coin, fetch `/api/chart?coin=SYMBOL`; while loading show a spinner state on that coin; on success call `onSelect({ coin, closes, last })`; on error show an inline retry message.

- [ ] **Step 1: Create the component**

Create `components/CoinPicker.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { SUPPORTED_COINS } from "@/lib/coins";

export interface CoinSelection {
  coin: string;
  closes: number[];
  last: number;
}

interface CoinPickerProps {
  onSelect: (selection: CoinSelection) => void;
}

export function CoinPicker({ onSelect }: CoinPickerProps) {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [loadingCoin, setLoadingCoin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/prices")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d?.prices) setPrices(d.prices);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const pick = async (coin: string) => {
    setError(null);
    setLoadingCoin(coin);
    try {
      const res = await fetch(`/api/chart?coin=${coin}`);
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.closes) || data.closes.length === 0) {
        throw new Error(data?.error ?? "no data");
      }
      onSelect({ coin, closes: data.closes, last: data.last });
    } catch {
      setError(`${coin} grafiği alınamadı. Tekrar dene.`);
      setLoadingCoin(null);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        padding: 24,
        width: "100%",
        maxWidth: 360,
      }}
    >
      <h2 style={{ fontSize: 22, fontWeight: 800, textAlign: "center" }}>
        Coin seç — grafiği parkurun olsun
      </h2>
      <p style={{ fontSize: 13, color: "#ffffff99", textAlign: "center" }}>
        Seçtiğin coin'in son 150 mumu bir tünele dönüşür.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          width: "100%",
        }}
      >
        {SUPPORTED_COINS.map((c) => {
          const loading = loadingCoin === c.symbol;
          const price = prices[c.symbol];
          return (
            <button
              key={c.symbol}
              disabled={loadingCoin !== null}
              onClick={() => pick(c.symbol)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 4,
                padding: "14px 16px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.12)",
                background: loading ? "#0f3460" : "rgba(255,255,255,0.06)",
                color: "#fff",
                cursor: loadingCoin !== null ? "default" : "pointer",
                opacity: loadingCoin !== null && !loading ? 0.5 : 1,
                textAlign: "left",
              }}
            >
              <span style={{ fontSize: 18, fontWeight: 700 }}>{c.symbol}</span>
              <span style={{ fontSize: 12, color: "#ffffff99" }}>{c.name}</span>
              <span style={{ fontSize: 13, color: "#f7d794" }}>
                {loading
                  ? "yükleniyor…"
                  : price !== undefined
                    ? `$${price.toLocaleString()}`
                    : "—"}
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <p style={{ fontSize: 13, color: "#e94560", textAlign: "center" }}>
          {error}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors related to `CoinPicker`.

- [ ] **Step 3: Commit**

```bash
git add components/CoinPicker.tsx
git commit -m "feat: CoinPicker — pick a coin, fetch its live chart"
```

---

### Task 7: `components/Game.tsx` — chart-driven corridor (rewrite)

**Files:**
- Rewrite: `components/Game.tsx`

Key mechanics:
- Bird sits at a fixed screen x (`BIRD_X`); the world scrolls left (`worldX` increases).
- The normalized close series is the corridor centerline (high price → top of band, low price → bottom). Band = `[0.15, 0.85] * (height - GROUND_HEIGHT)`.
- Per-frame difficulty is read from the loop count at the bird's position (`difficultyForLoop`); each full pass over the series increases `speed` and shrinks `gap`.
- Score = number of segments passed = `floor(worldX / SEGMENT_WIDTH)`.
- While idle (not started), the bird rests at the corridor center so the start is never an instant death.

- [ ] **Step 1: Replace the file entirely**

Replace the full contents of `components/Game.tsx` with:

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  normalizeSeries,
  difficultyForLoop,
  centerlineAt,
  loopCountAt,
} from "@/lib/course";

interface GameProps {
  coin: string;
  closes: number[];
  last?: number;
  onGameOver?: (coin: string, score: number) => void;
}

const GRAVITY = 0.4;
const FLAP_STRENGTH = -7;
const BIRD_SIZE = 28;
const BIRD_X = 80;
const GROUND_HEIGHT = 40;
const SEGMENT_WIDTH = 60; // px per candle segment
const BAND_TOP_FRAC = 0.15; // highest price maps here
const BAND_BOTTOM_FRAC = 0.85; // lowest price maps here
const COLUMN_STEP = 6; // px between wall sample columns

function bestKey(coin: string): string {
  return `engelat_best_score_${coin}`;
}
function getBestScore(coin: string): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(bestKey(coin));
  return raw ? parseInt(raw, 10) || 0 : 0;
}
function setBestScore(coin: string, score: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(bestKey(coin), String(score));
}

export function Game({ coin, closes, last, onGameOver }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);

  const normalizedRef = useRef<number[]>(normalizeSeries(closes));

  const stateRef = useRef({
    bird: { y: 200, vy: 0 },
    worldX: 0,
    score: 0,
    gameOver: false,
    started: false,
    width: 0,
    height: 0,
    rafId: 0,
  });

  useEffect(() => {
    normalizedRef.current = normalizeSeries(closes);
  }, [closes]);

  useEffect(() => {
    setBest(getBestScore(coin));
  }, [coin]);

  const resetGame = useCallback(() => {
    const st = stateRef.current;
    st.bird = { y: st.height / 2, vy: 0 };
    st.worldX = 0;
    st.score = 0;
    st.gameOver = false;
    st.started = false;
    setScore(0);
    setGameOver(false);
    setStarted(false);
  }, []);

  const startGame = useCallback(() => {
    const st = stateRef.current;
    if (st.started || st.gameOver) return;
    st.started = true;
    setStarted(true);
  }, []);

  const flap = useCallback(() => {
    const st = stateRef.current;
    if (st.gameOver) return;
    if (!st.started) startGame();
    st.bird.vy = FLAP_STRENGTH;
  }, [startGame]);

  // Resize canvas to container
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stateRef.current.width = rect.width;
      stateRef.current.height = rect.height;
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const st = stateRef.current;

    const playBottom = () => st.height - GROUND_HEIGHT;
    const bandTop = () => playBottom() * BAND_TOP_FRAC;
    const bandBottom = () => playBottom() * BAND_BOTTOM_FRAC;
    // high price (t=1) → bandTop; low price (t=0) → bandBottom
    const centerYForT = (t: number) =>
      bandBottom() - t * (bandBottom() - bandTop());
    const posForScreenX = (sx: number) =>
      (st.worldX + (sx - BIRD_X)) / SEGMENT_WIDTH;

    const currentDifficulty = () => {
      const n = normalizedRef.current.length;
      const pos = st.worldX / SEGMENT_WIDTH;
      return difficultyForLoop(loopCountAt(pos, n));
    };

    const checkCollision = (): boolean => {
      const t = centerlineAt(normalizedRef.current, st.worldX / SEGMENT_WIDTH);
      const cy = centerYForT(t);
      const gap = currentDifficulty().gap;
      const birdTop = st.bird.y;
      const birdBottom = st.bird.y + BIRD_SIZE;
      if (birdTop < cy - gap / 2) return true;
      if (birdBottom > cy + gap / 2) return true;
      if (birdTop < 0) return true;
      if (birdBottom > playBottom()) return true;
      return false;
    };

    const update = (now: number) => {
      if (st.gameOver) return;
      const bird = st.bird;

      if (st.started) {
        bird.vy += GRAVITY;
        bird.y += bird.vy;
        st.worldX += currentDifficulty().speed;

        const seg = Math.floor(st.worldX / SEGMENT_WIDTH);
        if (seg > st.score) {
          st.score = seg;
          setScore(seg);
        }

        if (checkCollision()) {
          st.gameOver = true;
          setGameOver(true);
          if (st.score > getBestScore(coin)) {
            setBestScore(coin, st.score);
            setBest(st.score);
          }
          onGameOver?.(coin, st.score);
        }
      } else {
        // Rest at the corridor center so the start is fair
        const t = centerlineAt(normalizedRef.current, st.worldX / SEGMENT_WIDTH);
        bird.y = centerYForT(t) - BIRD_SIZE / 2 + Math.sin(now / 400) * 6;
        bird.vy = 0;
      }
    };

    const draw = () => {
      const w = st.width;
      const h = st.height;
      const norm = normalizedRef.current;
      const gap = currentDifficulty().gap;

      // Background
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(0, 0, w, h);

      // Stars
      ctx.fillStyle = "#ffffff20";
      for (let i = 0; i < 20; i++) {
        ctx.fillRect((i * 137) % w, (i * 53) % (h - GROUND_HEIGHT), 2, 2);
      }

      // Top canyon wall
      ctx.fillStyle = "#e94560";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (let sx = 0; sx <= w; sx += COLUMN_STEP) {
        const cy = centerYForT(centerlineAt(norm, posForScreenX(sx)));
        ctx.lineTo(sx, cy - gap / 2);
      }
      ctx.lineTo(w, 0);
      ctx.closePath();
      ctx.fill();

      // Bottom canyon wall
      ctx.beginPath();
      ctx.moveTo(0, playBottom());
      for (let sx = 0; sx <= w; sx += COLUMN_STEP) {
        const cy = centerYForT(centerlineAt(norm, posForScreenX(sx)));
        ctx.lineTo(sx, cy + gap / 2);
      }
      ctx.lineTo(w, playBottom());
      ctx.closePath();
      ctx.fill();

      // Ground
      ctx.fillStyle = "#0f3460";
      ctx.fillRect(0, playBottom(), w, GROUND_HEIGHT);
      ctx.fillStyle = "#16213e";
      ctx.fillRect(0, playBottom(), w, 4);

      // Bird
      const bird = st.bird;
      ctx.fillStyle = "#f7d794";
      ctx.beginPath();
      ctx.arc(BIRD_X + BIRD_SIZE / 2, bird.y + BIRD_SIZE / 2, BIRD_SIZE / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1a1a2e";
      ctx.beginPath();
      ctx.arc(BIRD_X + BIRD_SIZE * 0.7, bird.y + BIRD_SIZE * 0.35, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e58e26";
      ctx.beginPath();
      ctx.moveTo(BIRD_X + BIRD_SIZE, bird.y + BIRD_SIZE * 0.45);
      ctx.lineTo(BIRD_X + BIRD_SIZE + 8, bird.y + BIRD_SIZE * 0.6);
      ctx.lineTo(BIRD_X + BIRD_SIZE, bird.y + BIRD_SIZE * 0.75);
      ctx.fill();

      // HUD: score + best
      ctx.fillStyle = "#fff";
      ctx.font = "bold 32px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(st.score), w / 2, 60);
      ctx.fillStyle = "#ffffff80";
      ctx.font = "14px sans-serif";
      ctx.fillText(`Best: ${best}`, w / 2, 85);

      // HUD: coin label
      ctx.textAlign = "left";
      ctx.fillStyle = "#f7d794";
      ctx.font = "bold 16px sans-serif";
      ctx.fillText(`${coin}${last ? `  $${last.toLocaleString()}` : ""}`, 16, 28);
      ctx.fillStyle = "#ffffff60";
      ctx.font = "11px sans-serif";
      ctx.fillText("son 150 mum · grafikten parkur", 16, 44);

      // Start hint
      if (!st.started && !st.gameOver) {
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffffffcc";
        ctx.font = "bold 18px sans-serif";
        ctx.fillText("Tap, Click veya Space ile başla", w / 2, h / 2 + 80);
      }
    };

    const loop = (now: number) => {
      update(now);
      draw();
      st.rafId = requestAnimationFrame(loop);
    };

    st.rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(st.rafId);
  }, [best, onGameOver, coin, last]);

  // Keyboard
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (stateRef.current.gameOver) resetGame();
        else flap();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [flap, resetGame]);

  const handlePointerDown = useCallback(() => {
    if (stateRef.current.gameOver) resetGame();
    else flap();
  }, [flap, resetGame]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        cursor: "pointer",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
      onPointerDown={handlePointerDown}
    >
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
      />

      {gameOver && (
        <div
          style={{
            position: "absolute",
            top: "40%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            textAlign: "center",
            zIndex: 10,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              background: "rgba(0,0,0,0.7)",
              borderRadius: 16,
              padding: "24px 32px",
              backdropFilter: "blur(4px)",
            }}
          >
            <p style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Game Over</p>
            <p style={{ fontSize: 18, marginBottom: 16 }}>
              {coin} · Score: {score}
            </p>
            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                resetGame();
              }}
              style={{
                pointerEvents: "auto",
                padding: "10px 24px",
                fontSize: 16,
                fontWeight: 600,
                borderRadius: 8,
                border: "none",
                background: "#e94560",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Restart
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: errors only in `app/page.tsx` (still using the old `Game`/`ScoreSubmit` props — fixed in Task 12). No errors inside `Game.tsx` itself.

- [ ] **Step 3: Commit**

```bash
git add components/Game.tsx
git commit -m "feat: Game — corridor terrain from coin chart, endless + accelerating"
```

---

### Task 8: `Leaderboard.sol` per-coin (Foundry TDD)

**Files:**
- Rewrite: `contracts/test/Leaderboard.t.sol`
- Rewrite: `contracts/src/Leaderboard.sol`

- [ ] **Step 1: Rewrite the tests (failing first)**

Replace the full contents of `contracts/test/Leaderboard.t.sol` with:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/Leaderboard.sol";

contract LeaderboardTest is Test {
    Leaderboard public lb;

    bytes32 constant BTC = bytes32("BTC");
    bytes32 constant ETH = bytes32("ETH");

    function setUp() public {
        lb = new Leaderboard();
    }

    function test_BestScoreOnlyIncreases() public {
        address alice = makeAddr("alice");

        vm.prank(alice);
        lb.submitScore(BTC, 100);
        assertEq(lb.bestScore(BTC, alice), 100);

        vm.prank(alice);
        lb.submitScore(BTC, 50);
        assertEq(lb.bestScore(BTC, alice), 100);
    }

    function test_LowerScoreDoesNotAffectBoard() public {
        address alice = makeAddr("alice");

        vm.prank(alice);
        lb.submitScore(BTC, 100);

        (address[] memory players1, uint256[] memory scores1) = lb.getTop(BTC);
        assertEq(players1.length, 1);
        assertEq(scores1[0], 100);

        vm.prank(alice);
        lb.submitScore(BTC, 50);

        (address[] memory players2, uint256[] memory scores2) = lb.getTop(BTC);
        assertEq(players2.length, 1);
        assertEq(scores2[0], 100);
    }

    function test_TopTenSortedDescending() public {
        address alice = makeAddr("alice");
        address bob = makeAddr("bob");
        address carol = makeAddr("carol");

        vm.prank(alice);
        lb.submitScore(BTC, 50);
        vm.prank(bob);
        lb.submitScore(BTC, 150);
        vm.prank(carol);
        lb.submitScore(BTC, 100);

        (, uint256[] memory scores) = lb.getTop(BTC);
        assertEq(scores.length, 3);
        assertEq(scores[0], 150);
        assertEq(scores[1], 100);
        assertEq(scores[2], 50);
    }

    function test_TopTenCappedAtTen() public {
        for (uint256 i = 0; i < 12; i++) {
            address p = makeAddr(string(abi.encodePacked("p", vm.toString(i))));
            vm.prank(p);
            lb.submitScore(BTC, (12 - i) * 10);
        }

        (address[] memory players, uint256[] memory scores) = lb.getTop(BTC);
        assertEq(players.length, 10);
        assertEq(scores.length, 10);
        assertEq(scores[0], 120);
        assertEq(scores[9], 30);
    }

    function test_ImproveInPlaceNoDuplicate() public {
        address alice = makeAddr("alice");
        address bob = makeAddr("bob");

        vm.prank(alice);
        lb.submitScore(BTC, 100);
        vm.prank(bob);
        lb.submitScore(BTC, 200);
        vm.prank(alice);
        lb.submitScore(BTC, 150);

        (address[] memory players, uint256[] memory scores) = lb.getTop(BTC);
        assertEq(players.length, 2);
        assertEq(scores[0], 200);
        assertEq(scores[1], 150);
    }

    function test_ImproveToFirstInPlace() public {
        address alice = makeAddr("alice");
        address bob = makeAddr("bob");

        vm.prank(alice);
        lb.submitScore(BTC, 100);
        vm.prank(bob);
        lb.submitScore(BTC, 200);
        vm.prank(alice);
        lb.submitScore(BTC, 300);

        (address[] memory players, uint256[] memory scores) = lb.getTop(BTC);
        assertEq(players.length, 2);
        assertEq(scores[0], 300);
        assertEq(scores[1], 200);
        assertEq(players[0], alice);
        assertEq(players[1], bob);
    }

    function test_CoinsAreIsolated() public {
        address alice = makeAddr("alice");

        vm.prank(alice);
        lb.submitScore(BTC, 100);
        vm.prank(alice);
        lb.submitScore(ETH, 50);

        assertEq(lb.bestScore(BTC, alice), 100);
        assertEq(lb.bestScore(ETH, alice), 50);

        (, uint256[] memory btcScores) = lb.getTop(BTC);
        (, uint256[] memory ethScores) = lb.getTop(ETH);
        assertEq(btcScores.length, 1);
        assertEq(btcScores[0], 100);
        assertEq(ethScores.length, 1);
        assertEq(ethScores[0], 50);
    }

    function test_EventEmittedWithCorrectArgs() public {
        address alice = makeAddr("alice");

        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit Leaderboard.ScoreSubmitted(BTC, alice, 123);
        lb.submitScore(BTC, 123);
    }

    function test_EventNotEmittedForLowerScore() public {
        address alice = makeAddr("alice");

        vm.prank(alice);
        lb.submitScore(BTC, 100);

        vm.recordLogs();
        vm.prank(alice);
        lb.submitScore(BTC, 50);
        Vm.Log[] memory entries = vm.getRecordedLogs();
        assertEq(entries.length, 0);
    }

    function test_GetTopEmpty() public view {
        (address[] memory players, uint256[] memory scores) = lb.getTop(BTC);
        assertEq(players.length, 0);
        assertEq(scores.length, 0);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd contracts && forge test`
Expected: compile error / failures — `submitScore`/`getTop`/`bestScore`/event signatures don't match yet.

- [ ] **Step 3: Rewrite the contract**

Replace the full contents of `contracts/src/Leaderboard.sol` with:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Leaderboard {
    // bestScore[coin][player]
    mapping(bytes32 => mapping(address => uint256)) public bestScore;

    mapping(bytes32 => address[]) private _topPlayers;
    mapping(bytes32 => uint256[]) private _topScores;

    event ScoreSubmitted(bytes32 indexed coin, address indexed player, uint256 score);

    function submitScore(bytes32 coin, uint256 score) external {
        if (score <= bestScore[coin][msg.sender]) {
            return;
        }

        bestScore[coin][msg.sender] = score;

        address[] storage players = _topPlayers[coin];
        uint256[] storage scores = _topScores[coin];

        // Find existing index (if any)
        uint256 existingIndex = type(uint256).max;
        for (uint256 i = 0; i < players.length; i++) {
            if (players[i] == msg.sender) {
                existingIndex = i;
                break;
            }
        }

        // Remove existing entry by shifting left
        if (existingIndex != type(uint256).max) {
            for (uint256 i = existingIndex; i < players.length - 1; i++) {
                players[i] = players[i + 1];
                scores[i] = scores[i + 1];
            }
            players.pop();
            scores.pop();
        }

        // Find insertion point (descending order)
        uint256 insertAt = scores.length;
        for (uint256 i = 0; i < scores.length; i++) {
            if (score > scores[i]) {
                insertAt = i;
                break;
            }
        }

        // Insert at insertAt by shifting right
        players.push();
        scores.push();
        for (uint256 i = players.length - 1; i > insertAt; i--) {
            players[i] = players[i - 1];
            scores[i] = scores[i - 1];
        }
        players[insertAt] = msg.sender;
        scores[insertAt] = score;

        // Cap at 10
        if (players.length > 10) {
            players.pop();
            scores.pop();
        }

        emit ScoreSubmitted(coin, msg.sender, score);
    }

    function getTop(bytes32 coin)
        external
        view
        returns (address[] memory players, uint256[] memory scores)
    {
        address[] storage tp = _topPlayers[coin];
        uint256[] storage ts = _topScores[coin];
        uint256 len = tp.length;
        players = new address[](len);
        scores = new uint256[](len);
        for (uint256 i = 0; i < len; i++) {
            players[i] = tp[i];
            scores[i] = ts[i];
        }
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd contracts && forge test`
Expected: PASS — all 10 tests green.

- [ ] **Step 5: Commit**

```bash
git add contracts/src/Leaderboard.sol contracts/test/Leaderboard.t.sol
git commit -m "feat: Leaderboard.sol — per-coin best + top-10 (bytes32 key)"
```

---

### Task 9: `lib/leaderboard.ts` — ABI update

**Files:**
- Modify: `lib/leaderboard.ts`

- [ ] **Step 1: Replace the ABI**

Replace the `LEADERBOARD_ABI` array in `lib/leaderboard.ts` (keep the `LEADERBOARD_ADDRESS` export as-is) with:

```ts
export const LEADERBOARD_ABI = [
  {
    type: "function",
    name: "submitScore",
    inputs: [
      { name: "coin", type: "bytes32" },
      { name: "score", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getTop",
    inputs: [{ name: "coin", type: "bytes32" }],
    outputs: [
      { name: "players", type: "address[]" },
      { name: "scores", type: "uint256[]" },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "ScoreSubmitted",
    inputs: [
      { name: "coin", type: "bytes32", indexed: true },
      { name: "player", type: "address", indexed: true },
      { name: "score", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
] as const;
```

- [ ] **Step 2: Commit**

```bash
git add lib/leaderboard.ts
git commit -m "feat: leaderboard ABI — keyed by coin (bytes32)"
```

---

### Task 10: `components/ScoreSubmit.tsx` — pass coin

**Files:**
- Modify: `components/ScoreSubmit.tsx`

- [ ] **Step 1: Add the `coin` prop and key the call**

In `components/ScoreSubmit.tsx`:

Add the import (after the `LEADERBOARD_*` import):

```tsx
import { coinKey } from "@/lib/coins";
```

Change the props interface:

```tsx
interface ScoreSubmitProps {
  coin: string;
  score: number;
  onSubmitted?: () => void;
}

export function ScoreSubmit({ coin, score, onSubmitted }: ScoreSubmitProps) {
```

Change the `args` line inside `contracts`:

```tsx
      args: [coinKey(coin), BigInt(score)],
```

- [ ] **Step 2: Commit**

```bash
git add components/ScoreSubmit.tsx
git commit -m "feat: ScoreSubmit — submit score under selected coin"
```

---

### Task 11: `components/Leaderboard.tsx` — per-coin + switcher

**Files:**
- Modify: `components/Leaderboard.tsx`

- [ ] **Step 1: Replace the component**

Replace the full contents of `components/Leaderboard.tsx` with:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useReadContract } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { LEADERBOARD_ABI, LEADERBOARD_ADDRESS } from "@/lib/leaderboard";
import { SUPPORTED_COINS, coinKey } from "@/lib/coins";

function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

interface LeaderboardProps {
  coin: string;
  refreshKey?: number;
}

export function Leaderboard({ coin, refreshKey }: LeaderboardProps) {
  const [viewCoin, setViewCoin] = useState(coin);

  useEffect(() => {
    setViewCoin(coin);
  }, [coin]);

  const { data, isLoading, error, refetch } = useReadContract({
    address: LEADERBOARD_ADDRESS,
    abi: LEADERBOARD_ABI,
    functionName: "getTop",
    args: [coinKey(viewCoin)],
    chainId: baseSepolia.id,
    query: { enabled: !!LEADERBOARD_ADDRESS },
  });

  useEffect(() => {
    if (refreshKey !== undefined) refetch();
  }, [refreshKey, refetch]);

  if (!LEADERBOARD_ADDRESS) {
    return (
      <div style={{ padding: 12, fontSize: 13, color: "#ffffff80", textAlign: "center" }}>
        Leaderboard not deployed yet
      </div>
    );
  }

  const [players, scores] = (data as readonly [readonly string[], readonly bigint[]]) ?? [
    [],
    [],
  ];

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 320,
        background: "rgba(0,0,0,0.5)",
        borderRadius: 12,
        padding: 16,
      }}
    >
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, textAlign: "center" }}>
        🏆 {viewCoin} Top 10
      </h3>

      <div
        style={{
          display: "flex",
          gap: 6,
          justifyContent: "center",
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        {SUPPORTED_COINS.map((c) => (
          <button
            key={c.symbol}
            onClick={() => setViewCoin(c.symbol)}
            style={{
              padding: "4px 10px",
              fontSize: 12,
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              background: c.symbol === viewCoin ? "#e94560" : "rgba(255,255,255,0.1)",
              color: "#fff",
              fontWeight: c.symbol === viewCoin ? 700 : 400,
            }}
          >
            {c.symbol}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div style={{ fontSize: 13, color: "#ffffff80", textAlign: "center" }}>
          Loading…
        </div>
      ) : error ? (
        <div style={{ fontSize: 13, color: "#e94560", textAlign: "center" }}>
          Error loading leaderboard
        </div>
      ) : players.length === 0 ? (
        <div style={{ fontSize: 13, color: "#ffffff80", textAlign: "center" }}>
          No scores yet. Be the first!
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {players.map((player, i) => (
            <div
              key={`${player}-${i}`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 14,
                padding: "4px 0",
                borderBottom:
                  i < players.length - 1 ? "1px solid rgba(255,255,255,0.1)" : undefined,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    fontWeight: 700,
                    width: 24,
                    textAlign: "center",
                    color:
                      i === 0
                        ? "#f7d794"
                        : i === 1
                          ? "#c0c0c0"
                          : i === 2
                            ? "#cd7f32"
                            : "#fff",
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ fontFamily: "monospace", fontSize: 13 }}>
                  {shortenAddress(player)}
                </span>
              </span>
              <span style={{ fontWeight: 600 }}>{String(scores[i])}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: errors only remain in `app/page.tsx` (fixed next).

- [ ] **Step 3: Commit**

```bash
git add components/Leaderboard.tsx
git commit -m "feat: Leaderboard — per-coin board with coin switcher"
```

---

### Task 12: `app/page.tsx` — pick → play → submit flow

**Files:**
- Rewrite: `app/page.tsx`

- [ ] **Step 1: Replace the page**

Replace the full contents of `app/page.tsx` with:

```tsx
"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownDisconnect,
} from "@coinbase/onchainkit/wallet";
import { ScoreSubmit } from "@/components/ScoreSubmit";
import { Leaderboard } from "@/components/Leaderboard";
import { CoinPicker, type CoinSelection } from "@/components/CoinPicker";

const Game = dynamic(() => import("@/components/Game").then((m) => m.Game), {
  ssr: false,
});

export default function HomePage() {
  const [selected, setSelected] = useState<CoinSelection | null>(null);
  const [gameOverData, setGameOverData] = useState<{ coin: string; score: number } | null>(
    null
  );
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSubmitted = () => setRefreshKey((k) => k + 1);

  const changeCoin = () => {
    setSelected(null);
    setGameOverData(null);
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ position: "absolute", top: 16, right: 16, zIndex: 20 }}>
        <Wallet>
          <ConnectWallet />
          <WalletDropdown>
            <WalletDropdownDisconnect />
          </WalletDropdown>
        </Wallet>
      </div>

      {!selected ? (
        <CoinPicker onSelect={setSelected} />
      ) : (
        <>
          <button
            onClick={changeCoin}
            style={{
              position: "absolute",
              top: 16,
              left: 16,
              zIndex: 20,
              padding: "6px 12px",
              fontSize: 13,
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(0,0,0,0.4)",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            ← Coin değiştir
          </button>

          <Game
            key={selected.coin}
            coin={selected.coin}
            closes={selected.closes}
            last={selected.last}
            onGameOver={(coin, score) => setGameOverData({ coin, score })}
          />

          {gameOverData && (
            <div
              style={{
                position: "absolute",
                bottom: 24,
                textAlign: "center",
                zIndex: 10,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 16,
                maxHeight: "60vh",
                overflowY: "auto",
              }}
            >
              <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
                {gameOverData.coin} · Final Score: {gameOverData.score}
              </p>
              <ScoreSubmit
                coin={gameOverData.coin}
                score={gameOverData.score}
                onSubmitted={handleSubmitted}
              />
              <Leaderboard coin={gameOverData.coin} refreshKey={refreshKey} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the whole project type-checks and builds**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: page flow — coin pick → chart course → per-coin submit + board"
```

---

### Task 13: Redeploy contract to Base Sepolia + update env

> The actual broadcast needs `PRIVATE_KEY` (funded Base Sepolia account) and an RPC URL. Per the project's orchestration note, Opus handles deploy mechanics; this task documents the exact commands.

**Files:**
- Uses: `contracts/script/Deploy.s.sol` (unchanged)
- Modify: `.env` (`NEXT_PUBLIC_LEADERBOARD_ADDRESS`)

- [ ] **Step 1: Build + test the contract**

Run: `cd contracts && forge build && forge test`
Expected: build OK, all tests pass.

- [ ] **Step 2: Deploy to Base Sepolia**

Run (from `contracts/`, with `PRIVATE_KEY` set in `contracts/.env`):

```bash
forge script script/Deploy.s.sol:DeployLeaderboard \
  --rpc-url https://sepolia.base.org \
  --broadcast
```

Expected: console prints `Leaderboard deployed at: 0x…`. Copy that address.

- [ ] **Step 3: Update the frontend env**

Set in the project root `.env` (create if missing; it is gitignored):

```
NEXT_PUBLIC_LEADERBOARD_ADDRESS=0x<deployed address>
```

- [ ] **Step 4: Commit (deploy artifacts only — never the .env)**

```bash
git add contracts/broadcast 2>/dev/null || true
git commit -m "chore: redeploy Leaderboard (per-coin) to Base Sepolia" || true
```

---

### Task 14: End-to-end verification

**Files:** none (manual)

- [ ] **Step 1: Run the app**

Run: `npm run dev`

- [ ] **Step 2: Verify the full flow**

In the browser at `http://localhost:3000`:
1. CoinPicker shows the curated coins with live `$` prices.
2. Pick BTC → game loads; the corridor visibly follows a price-chart shape; the bird rests centered in the tunnel before start.
3. Play: tapping flaps; passing segments increments the score; after ~one series the course speeds up and the gap narrows.
4. Crash → Game Over overlay shows `BTC · Score: N`; bottom panel shows ScoreSubmit + BTC leaderboard.
5. Connect wallet (Base Sepolia) → Submit Score → tx confirms → BTC leaderboard refetches and shows your entry.
6. Use the leaderboard coin switcher → ETH board is independent (empty or different entries).
7. `← Coin değiştir` returns to the picker; pick ETH and confirm its course differs from BTC.

- [ ] **Step 3: Run the full unit + contract test suites once more**

Run: `npm test`
Expected: all vitest suites pass.

Run: `cd contracts && forge test`
Expected: all 10 Foundry tests pass.

- [ ] **Step 4: Final commit (if any docs/notes changed)**

```bash
git add -A
git commit -m "test: end-to-end chart-to-course verified on Base Sepolia" || true
```

---

## Self-Review

**Spec coverage:**
- Tunnel/corridor mechanic → Task 4 (`centerlineAt`, `normalizeSeries`) + Task 7 (rendering/collision). ✓
- Player picks coin, live chart → Task 5 (`/api/chart`) + Task 6 (CoinPicker). ✓
- Per-coin leaderboard → Task 8 (contract) + Tasks 9–11 (ABI/ScoreSubmit/Leaderboard). ✓
- Endless + accelerating → Task 4 (`difficultyForLoop`, `loopCountAt`) + Task 7 (loop tiling). ✓
- Data source: Crypto.com public REST via route handler → Task 3 + Task 5. ✓
- Curated `SUPPORTED_COINS` shared by picker + route validation → Task 2. ✓
- `bytes32` coin key, viem `stringToHex` matching Solidity `bytes32("BTC")` → Task 2 + Task 8. ✓
- Error handling (route validates coin; picker blocks on fetch failure; tx UI) → Tasks 5/6/10. ✓
- Tests: per-coin isolation, ordering, best-only-increases, event → Task 8. ✓
- Redeploy + env address → Task 13. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete content. ✓

**Type consistency:** `coinKey(symbol)` (Task 2) used in ScoreSubmit (Task 10) and Leaderboard (Task 11); `CoinSelection {coin,closes,last}` (Task 6) consumed by page (Task 12) and Game props (Task 7); `onGameOver(coin, score)` signature consistent between Game (Task 7) and page (Task 12); ABI names (`submitScore`,`getTop`,`ScoreSubmitted`) consistent across Tasks 8–11. ✓
