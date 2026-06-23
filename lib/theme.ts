// Per-coin visual identity. Drives the corridor color, particle/glow tint, and
// the parallax background gradient so each coin's run feels distinct.

export interface CoinTheme {
  accent: string; // corridor walls + coin color
  glow: string; // particle / glow tint
  bgTop: string; // background gradient (top)
  bgBottom: string; // background gradient (bottom)
}

export const DEFAULT_THEME: CoinTheme = {
  accent: "#e94560",
  glow: "#ff7aa2",
  bgTop: "#1a1a2e",
  bgBottom: "#0b0b16",
};

export const COIN_THEMES: Record<string, CoinTheme> = {
  BTC: { accent: "#f7931a", glow: "#ffc46b", bgTop: "#241a0c", bgBottom: "#0d0a04" },
  ETH: { accent: "#8a92ff", glow: "#c2c7ff", bgTop: "#181b33", bgBottom: "#090b1a" },
  SOL: { accent: "#14f195", glow: "#9af9d4", bgTop: "#0c2820", bgBottom: "#03120c" },
  XRP: { accent: "#4ab3ff", glow: "#b3e1ff", bgTop: "#0f2030", bgBottom: "#050c14" },
  DOGE: { accent: "#c2a633", glow: "#ffe9a3", bgTop: "#221d0d", bgBottom: "#0e0b04" },
};

export function themeFor(coin: string): CoinTheme {
  return COIN_THEMES[coin] ?? DEFAULT_THEME;
}
