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
