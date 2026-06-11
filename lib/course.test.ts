import { describe, it, expect } from "vitest";
import {
  normalizeSeries,
  difficultyForLoop,
  centerlineAt,
  loopCountAt,
} from "./course";

describe("course", () => {
  it("normalizeSeries maps to [0,1] with min→0 and max→1", () => {
    expect(normalizeSeries([10, 20, 30])).toEqual([0, 0.5, 1]);
  });

  it("normalizeSeries returns 0.5 for a flat series (no divide-by-zero)", () => {
    expect(normalizeSeries([5, 5, 5])).toEqual([0.5, 0.5, 0.5]);
  });

  it("difficultyForLoop ramps speed up and gap down, with caps/floors", () => {
    expect(difficultyForLoop(0)).toEqual({ speed: 2.5, gap: 195 });
    expect(difficultyForLoop(5)).toEqual({ speed: 4.5, gap: 165 });
    expect(difficultyForLoop(100)).toEqual({ speed: 6, gap: 135 });
  });

  it("centerlineAt returns exact points and interpolates between them", () => {
    expect(centerlineAt([0, 1], 0)).toBe(0);
    expect(centerlineAt([0, 1], 0.5)).toBe(0.5);
  });

  it("centerlineAt wraps (tiles) past the end of the series", () => {
    // pos 1.5 on [0,1]: from index1 (value 1) toward index0 (value 0), halfway → 0.5
    expect(centerlineAt([0, 1], 1.5)).toBe(0.5);
    // pos 2 wraps fully back to index0
    expect(centerlineAt([0, 1], 2)).toBe(0);
  });

  it("loopCountAt counts completed series passes", () => {
    expect(loopCountAt(0, 3)).toBe(0);
    expect(loopCountAt(3, 3)).toBe(1);
    expect(loopCountAt(7, 3)).toBe(2);
  });
});
