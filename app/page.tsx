import type { Metadata } from "next";
import { GameShell } from "@/components/GameShell";
import { isSupportedSymbol } from "@/lib/coins";
import { baseUrl, assetUrls, MINIAPP } from "@/lib/miniapp";
import { buildOgUrl, buildPlayUrl } from "@/lib/share";

interface SearchParams {
  coin?: string;
  score?: string;
}

// A shared run lands here as `?coin=BTC&score=42`. We validate it and, when
// present, build a score-specific Mini App embed (dynamic image + "beat it"
// button) so the cast unfurls into a branded, playable frame.
function parseShare(sp: SearchParams) {
  const coin = typeof sp.coin === "string" ? sp.coin.toUpperCase() : undefined;
  const score = typeof sp.score === "string" ? parseInt(sp.score, 10) : NaN;
  if (coin && isSupportedSymbol(coin) && Number.isFinite(score) && score >= 0) {
    return { coin, score };
  }
  return null;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const base = baseUrl();
  const a = assetUrls(base);
  const share = parseShare(sp);

  const imageUrl = share ? buildOgUrl(base, share.coin, share.score) : a.hero;
  const homeUrl = share ? buildPlayUrl(base, share.coin, share.score) : a.home;
  const buttonTitle = share ? `Beat ${share.score} on ${share.coin}` : MINIAPP.buttonTitle;

  const embed = {
    version: "1",
    imageUrl,
    button: {
      title: buttonTitle,
      action: {
        type: "launch_miniapp",
        name: MINIAPP.name,
        url: homeUrl,
        splashImageUrl: a.splash,
        splashBackgroundColor: MINIAPP.splashBackgroundColor,
      },
    },
  };

  return {
    title: share ? `${MINIAPP.name} — ${share.coin} · ${share.score}` : MINIAPP.name,
    description: MINIAPP.description,
    openGraph: {
      title: MINIAPP.name,
      description: MINIAPP.description,
      images: [imageUrl],
    },
    other: {
      "fc:miniapp": JSON.stringify(embed),
    },
  };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const coin = typeof sp.coin === "string" ? sp.coin.toUpperCase() : undefined;
  const initialCoin = coin && isSupportedSymbol(coin) ? coin : null;
  return <GameShell initialCoin={initialCoin} />;
}
