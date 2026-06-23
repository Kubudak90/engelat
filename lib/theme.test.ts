import { describe, it, expect } from "vitest";
import { themeFor, COIN_THEMES, DEFAULT_THEME } from "./theme";

describe("theme", () => {
  it("returns a coin-specific theme for supported coins", () => {
    expect(themeFor("BTC")).toBe(COIN_THEMES.BTC);
    expect(themeFor("BTC").accent).toBe("#f7931a");
  });

  it("falls back to the default theme for unknown coins", () => {
    expect(themeFor("WTF")).toBe(DEFAULT_THEME);
  });

  it("every theme defines all four colors", () => {
    for (const t of [DEFAULT_THEME, ...Object.values(COIN_THEMES)]) {
      for (const key of ["accent", "glow", "bgTop", "bgBottom"] as const) {
        expect(t[key]).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });
});
