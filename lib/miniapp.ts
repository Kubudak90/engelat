import type { MiniAppManifest } from "@coinbase/onchainkit/minikit";

export const MINIAPP = {
  name: "Engelat",
  subtitle: "Fly through the chart",
  description:
    "A Flappy-style game where a coin's live price chart becomes the obstacle course. Compete on an onchain per-coin leaderboard on Base.",
  tagline: "Dodge live markets",
  ogTitle: "Engelat — Live Chart Arcade",
  ogDescription:
    "Fly through live BTC, ETH, SOL, XRP & DOGE charts. Beat the canyon, cast your score.",
  buttonTitle: "Play Engelat",
  primaryCategory: "games",
  tags: ["game", "arcade", "crypto", "chart", "base"],
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
    screenshot: `${b}/screenshot.png`,
    home: b,
  };
}

export function buildEmbed(base: string) {
  const a = assetUrls(base);
  return {
    version: "1",
    imageUrl: a.hero,
    button: {
      title: MINIAPP.buttonTitle,
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

export function buildManifest(
  base: string,
  assoc?: AccountAssociation
): MiniAppManifest {
  const a = assetUrls(base);
  const manifest: MiniAppManifest = {
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
      screenshotUrls: [a.screenshot],
      primaryCategory: MINIAPP.primaryCategory,
      tags: [...MINIAPP.tags],
      tagline: MINIAPP.tagline,
      ogTitle: MINIAPP.ogTitle,
      ogDescription: MINIAPP.ogDescription,
      ogImageUrl: a.hero,
    },
  };
  if (assoc) manifest.accountAssociation = assoc;
  return manifest;
}
