// Deterministic collectible coins scattered along the (looping) course.
//
// Coins live in *segment space* — the same axis as the distance score — so a
// coin is fully determined by its integer segment index. That keeps them fair,
// replayable (same chart → same coins), and unit-testable without any
// pixel/canvas math. Collecting one off the safe centerline is the risk/reward:
// it grows a combo multiplier, and the multiplier resets if you miss one or die.

const COIN_CADENCE = 4; // a coin candidate every N score segments
const MAX_OFFSET = 0.62; // |offset| cap, as a fraction of the half-gap (1 = wall)
const BASE_VALUE = 5; // base points per coin
const MAX_COMBO_MULT = 6; // combo multiplier ceiling

// Deterministic hash of an integer → [0, 1). Stable across runs (no RNG state),
// so a given chart always produces the same coin layout.
function hash01(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// Is there a collectible centered on this integer score segment?
export function isCoinSegment(seg: number): boolean {
  return Number.isInteger(seg) && seg > 0 && seg % COIN_CADENCE === 0;
}

// Vertical placement of the coin within the corridor, in [-MAX_OFFSET, MAX_OFFSET].
// 0 = corridor center (safe); ±MAX_OFFSET = hugging a wall (risky).
export function coinOffset(seg: number): number {
  return (hash01(seg) * 2 - 1) * MAX_OFFSET;
}

// Combo multiplier grows with consecutive pickups, capped.
export function comboMultiplier(combo: number): number {
  return Math.min(MAX_COMBO_MULT, 1 + Math.max(0, combo) * 0.5);
}

// Points awarded for collecting a coin at the given (pre-increment) combo level.
export function coinValue(combo: number): number {
  return Math.round(BASE_VALUE * comboMultiplier(combo));
}

export const COLLECTIBLE = {
  COIN_CADENCE,
  MAX_OFFSET,
  BASE_VALUE,
  MAX_COMBO_MULT,
} as const;
