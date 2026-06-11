import { stringToHex } from "viem";

export interface CoinConfig {
  symbol: string; // "BTC"
  name: string; // "Bitcoin"
  instrument: string; // "BTC_USDT"
}

export const SUPPORTED_COINS: CoinConfig[] = [
  { symbol: "BTC", name: "Bitcoin", instrument: "BTC_USDT" },
  { symbol: "ETH", name: "Ethereum", instrument: "ETH_USDT" },
  { symbol: "SOL", name: "Solana", instrument: "SOL_USDT" },
  { symbol: "XRP", name: "XRP", instrument: "XRP_USDT" },
  { symbol: "DOGE", name: "Dogecoin", instrument: "DOGE_USDT" },
];

export function isSupportedSymbol(symbol: string): boolean {
  return SUPPORTED_COINS.some((c) => c.symbol === symbol);
}

export function getCoin(symbol: string): CoinConfig | undefined {
  return SUPPORTED_COINS.find((c) => c.symbol === symbol);
}

// Onchain key: bytes32 of the symbol string, right-padded with zeros.
// Matches Solidity `bytes32("BTC")`.
export function coinKey(symbol: string): `0x${string}` {
  return stringToHex(symbol, { size: 32 });
}
