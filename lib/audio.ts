"use client";

// Tiny synthesized sound engine — zero audio assets, all Web Audio. The context
// is created lazily on the first user gesture (browser autoplay policy), and a
// mute preference is persisted to localStorage.

type SoundName = "flap" | "coin" | "score" | "die" | "start";

const MUTE_KEY = "engelat_muted";

let ctx: AudioContext | null = null;
let muted = false;

export function isMuted(): boolean {
  return muted;
}

export function loadMutePreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    muted = window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    muted = false; // storage blocked (sandboxed iframe / private mode)
  }
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(MUTE_KEY, value ? "1" : "0");
    } catch {
      /* storage may be unavailable (private mode / sandbox) */
    }
  }
}

// Lazily create / resume the AudioContext. Must be called from a user gesture.
export function ensureAudio(): void {
  if (typeof window === "undefined") return;
  try {
    if (!ctx) {
      const AC: typeof AudioContext | undefined =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    ctx = null;
  }
}

interface Blip {
  freq: number;
  type: OscillatorType;
  dur: number;
  gain?: number;
  slideTo?: number;
  delay?: number;
}

function blip(b: Blip): void {
  if (!ctx) return;
  const t0 = ctx.currentTime + (b.delay ?? 0);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = b.type;
  osc.frequency.setValueAtTime(b.freq, t0);
  if (b.slideTo) osc.frequency.exponentialRampToValueAtTime(b.slideTo, t0 + b.dur);
  const peak = b.gain ?? 0.14;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + b.dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + b.dur + 0.03);
}

export function playSound(name: SoundName): void {
  if (muted || !ctx) return;
  try {
    switch (name) {
      case "flap":
        blip({ freq: 380, type: "triangle", dur: 0.12, slideTo: 620, gain: 0.1 });
        break;
      case "coin":
        blip({ freq: 880, type: "square", dur: 0.07, slideTo: 1200, gain: 0.08 });
        blip({ freq: 1320, type: "square", dur: 0.1, gain: 0.06, delay: 0.06 });
        break;
      case "score":
        blip({ freq: 620, type: "sine", dur: 0.06, gain: 0.05 });
        break;
      case "die":
        blip({ freq: 320, type: "sawtooth", dur: 0.5, slideTo: 55, gain: 0.18 });
        break;
      case "start":
        blip({ freq: 500, type: "triangle", dur: 0.1, slideTo: 760, gain: 0.09 });
        break;
    }
  } catch {
    /* ignore audio glitches */
  }
}
