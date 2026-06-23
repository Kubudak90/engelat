// Pure helpers for the Farcaster viral-share loop. A finished run can be cast
// with one tap: the cast carries a branded score image and a deep link that
// drops the reader straight into the same coin's run ("can you beat me?").

import { MINIAPP } from "./miniapp";

function trimBase(base: string): string {
  return base.replace(/\/+$/, "");
}

export function buildShareText(coin: string, score: number): string {
  return `I scored ${score} flying through the live ${coin} chart on ${MINIAPP.name} 📈🕊️ — can you beat me?`;
}

// Deep link that opens the app pre-targeted at this coin (and the score to beat).
export function buildPlayUrl(base: string, coin: string, score: number): string {
  const params = new URLSearchParams({ coin, score: String(score) });
  return `${trimBase(base)}/?${params.toString()}`;
}

// Dynamic Open Graph / frame image for the run.
export function buildOgUrl(base: string, coin: string, score: number): string {
  const params = new URLSearchParams({ coin, score: String(score) });
  return `${trimBase(base)}/api/og?${params.toString()}`;
}

// Farcaster compose intent — the fallback path when we're not inside a Mini App
// host (where the native composeCast action is unavailable). farcaster.xyz is the
// canonical host (warpcast.com now only 301-redirects here).
export function buildWarpcastIntentUrl(text: string, embedUrl: string): string {
  const params = new URLSearchParams({ text });
  return `https://farcaster.xyz/~/compose?${params.toString()}&embeds[]=${encodeURIComponent(
    embedUrl
  )}`;
}
