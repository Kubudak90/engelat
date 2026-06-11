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
