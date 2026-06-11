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
