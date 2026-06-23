"use client";

// Haptic feedback. Inside a Farcaster Mini App host we use the native haptics
// SDK; otherwise we fall back to navigator.vibrate where the browser allows it.
// Every path is guarded — haptics are a nice-to-have, never a hard dependency.

type Impact = "light" | "medium" | "heavy" | "soft" | "rigid";
type Notify = "success" | "warning" | "error";

interface HapticsApi {
  impactOccurred?: (type: Impact) => Promise<void>;
  notificationOccurred?: (type: Notify) => Promise<void>;
}

let enabled = true;
let triedLoad = false;
let api: HapticsApi | null = null;

export function setHapticsEnabled(value: boolean): void {
  enabled = value;
}

async function getHaptics(): Promise<HapticsApi | null> {
  if (triedLoad) return api;
  triedLoad = true;
  try {
    const mod = (await import("@farcaster/miniapp-sdk")) as {
      sdk?: { haptics?: HapticsApi };
    };
    api = mod?.sdk?.haptics ?? null;
  } catch {
    api = null;
  }
  return api;
}

function vibrate(pattern: number | number[]): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* not allowed in this context */
    }
  }
}

export function impact(kind: Impact = "light"): void {
  if (!enabled) return;
  void getHaptics().then((h) => {
    if (h?.impactOccurred) {
      h.impactOccurred(kind).catch(() => {});
    } else {
      vibrate(kind === "heavy" ? 35 : kind === "medium" ? 18 : 8);
    }
  });
}

export function notify(kind: Notify = "success"): void {
  if (!enabled) return;
  void getHaptics().then((h) => {
    if (h?.notificationOccurred) {
      h.notificationOccurred(kind).catch(() => {});
    } else {
      vibrate(kind === "error" ? [30, 40, 30] : 14);
    }
  });
}
