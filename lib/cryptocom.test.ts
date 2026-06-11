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
