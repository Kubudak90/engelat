export interface Difficulty {
  speed: number; // px per frame
  gap: number; // corridor gap in px
}

const BASE_SPEED = 2.5;
const SPEED_STEP = 0.4;
const MAX_SPEED = 6.0;
const BASE_GAP = 195;
const GAP_STEP = 6;
const MIN_GAP = 135;

export function difficultyForLoop(loop: number): Difficulty {
  const speed = Math.min(MAX_SPEED, BASE_SPEED + SPEED_STEP * loop);
  const gap = Math.max(MIN_GAP, BASE_GAP - GAP_STEP * loop);
  return { speed, gap };
}

// Normalize closes → [0,1] where the lowest price → 0 and the highest → 1.
// Flat series → 0.5 everywhere (avoids divide-by-zero).
export function normalizeSeries(closes: number[]): number[] {
  if (closes.length === 0) return [];
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min;
  if (range === 0) return closes.map(() => 0.5);
  return closes.map((c) => (c - min) / range);
}

// Interpolated normalized value at a continuous segment position `pos`
// (0 = first point, 1 = second, ...), tiling (wrapping) over the array.
export function centerlineAt(normalized: number[], pos: number): number {
  const n = normalized.length;
  if (n === 0) return 0.5;
  if (n === 1) return normalized[0];
  const wrapped = ((pos % n) + n) % n;
  const i = Math.floor(wrapped);
  const frac = wrapped - i;
  const a = normalized[i];
  const b = normalized[(i + 1) % n];
  return a + (b - a) * frac;
}

// Number of full passes over the series completed at segment position `pos`.
export function loopCountAt(pos: number, n: number): number {
  if (n <= 0) return 0;
  return Math.floor(pos / n);
}
