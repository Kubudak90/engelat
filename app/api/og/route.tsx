import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { getCoin, isSupportedSymbol } from "@/lib/coins";
import { candlestickUrl, parseCandlestickCloses } from "@/lib/cryptocom";
import { normalizeSeries } from "@/lib/course";
import { themeFor } from "@/lib/theme";
import { MINIAPP } from "@/lib/miniapp";

// Dynamic share image: a branded score card with a live sparkline of the coin's
// chart. Linked from every cast a player shares, so a score spreads with a
// recognizable, on-brand preview. 1200x800 → Farcaster's 3:2 embed ratio.
export const dynamic = "force-dynamic";

const W = 1200;
const H = 800;

function sparklineSvg(closes: number[], accent: string): string | null {
  const n = normalizeSeries(closes);
  if (n.length < 2) return null;
  const w = 1072;
  const h = 300;
  const pad = 12;
  const pts = n
    .map((v, i) => {
      const x = pad + (i / (n.length - 1)) * (w - pad * 2);
      const y = pad + (1 - v) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const area = `${pad},${h - pad} ${pts} ${w - pad},${h - pad}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><polygon points="${area}" fill="${accent}" opacity="0.16"/><polyline points="${pts}" fill="none" stroke="${accent}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const coin = (sp.get("coin") ?? "").toUpperCase();
  const scoreNum = parseInt(sp.get("score") ?? "", 10);
  const valid = isSupportedSymbol(coin) && Number.isFinite(scoreNum);
  const theme = themeFor(valid ? coin : "");
  const score = valid ? scoreNum : 0;
  const name = valid ? getCoin(coin)!.name : "";

  let closes: number[] = [];
  if (valid) {
    try {
      const r = await fetch(candlestickUrl(getCoin(coin)!.instrument, "15m", 150), {
        cache: "no-store",
        signal: AbortSignal.timeout(2500), // sparkline is optional — never stall the card
      });
      if (r.ok) closes = parseCandlestickCloses(await r.json());
    } catch {
      /* sparkline is optional */
    }
  }
  const spark = sparklineSvg(closes, theme.accent);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          backgroundImage: `linear-gradient(135deg, ${theme.bgTop}, ${theme.bgBottom})`,
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 800, letterSpacing: 2, color: theme.accent }}>
            {MINIAPP.name.toUpperCase()}
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "#ffffff99" }}>
            fly through the live chart
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: theme.accent }}>
            {coin || "—"} {name ? `· ${name}` : ""}
          </div>
          <div style={{ display: "flex", fontSize: 230, fontWeight: 800, lineHeight: 1 }}>
            {score}
          </div>
          <div style={{ display: "flex", fontSize: 30, color: "#ffffffcc" }}>SCORE</div>
        </div>

        {spark ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={spark} width={1072} height={220} alt="" style={{ objectFit: "fill" }} />
        ) : (
          <div style={{ display: "flex", height: 220 }} />
        )}

        <div style={{ display: "flex", justifyContent: "center", fontSize: 34, fontWeight: 600, color: "#fff" }}>
          Can you beat it?
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      // Live sparkline only moves on the ~15m candle cadence; a short CDN cache
      // absorbs crawler storms without staling the card noticeably.
      headers: { "Cache-Control": "public, max-age=60, s-maxage=300" },
    }
  );
}
