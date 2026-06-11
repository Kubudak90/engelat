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
