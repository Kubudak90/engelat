import { describe, it, expect } from "vitest";
import {
  isCoinSegment,
  coinOffset,
  comboMultiplier,
  coinValue,
  COLLECTIBLE,
} from "./collectibles";

describe("collectibles", () => {
  it("places coins on a fixed cadence, never at/ before the start", () => {
    expect(isCoinSegment(0)).toBe(false);
    expect(isCoinSegment(COLLECTIBLE.COIN_CADENCE)).toBe(true);
    expect(isCoinSegment(COLLECTIBLE.COIN_CADENCE + 1)).toBe(false);
    expect(isCoinSegment(COLLECTIBLE.COIN_CADENCE * 3)).toBe(true);
    expect(isCoinSegment(-COLLECTIBLE.COIN_CADENCE)).toBe(false);
    expect(isCoinSegment(4.5)).toBe(false);
  });

  it("coinOffset is deterministic and stays within bounds", () => {
    for (let s = 1; s < 500; s++) {
      const o = coinOffset(s);
      expect(o).toBeGreaterThanOrEqual(-COLLECTIBLE.MAX_OFFSET);
      expect(o).toBeLessThanOrEqual(COLLECTIBLE.MAX_OFFSET);
      expect(coinOffset(s)).toBe(o); // stable
    }
  });

  it("coinOffset spreads coins to both sides of center", () => {
    let pos = 0;
    let neg = 0;
    for (let s = 4; s <= 400; s += 4) {
      if (coinOffset(s) > 0.05) pos++;
      else if (coinOffset(s) < -0.05) neg++;
    }
    expect(pos).toBeGreaterThan(0);
    expect(neg).toBeGreaterThan(0);
  });

  it("combo multiplier grows then caps", () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(2)).toBe(2);
    expect(comboMultiplier(1000)).toBe(COLLECTIBLE.MAX_COMBO_MULT);
    expect(comboMultiplier(-5)).toBe(1); // clamps negative combo
  });

  it("coinValue scales with combo and is capped", () => {
    expect(coinValue(0)).toBe(COLLECTIBLE.BASE_VALUE);
    expect(coinValue(2)).toBe(COLLECTIBLE.BASE_VALUE * 2);
    expect(coinValue(1000)).toBe(COLLECTIBLE.BASE_VALUE * COLLECTIBLE.MAX_COMBO_MULT);
  });
});
