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
      signal: AbortSignal.timeout(5000),
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
