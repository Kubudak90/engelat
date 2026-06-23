"use client";

import { useEffect, useState } from "react";
import { SUPPORTED_COINS } from "@/lib/coins";
import { themeFor } from "@/lib/theme";

export interface CoinSelection {
  coin: string;
  closes: number[];
  last: number;
}

interface CoinPickerProps {
  onSelect: (selection: CoinSelection) => void;
}

export function CoinPicker({ onSelect }: CoinPickerProps) {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [loadingCoin, setLoadingCoin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/prices")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d?.prices) setPrices(d.prices);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const pick = async (coin: string) => {
    setError(null);
    setLoadingCoin(coin);
    try {
      const res = await fetch(`/api/chart?coin=${coin}`);
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.closes) || data.closes.length === 0) {
        throw new Error(data?.error ?? "no data");
      }
      onSelect({ coin, closes: data.closes, last: data.last });
    } catch {
      setError(`${coin} grafiği alınamadı. Tekrar dene.`);
      setLoadingCoin(null);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        padding: 24,
        width: "100%",
        maxWidth: 380,
      }}
    >
      <h1 style={{ fontSize: 30, fontWeight: 900, letterSpacing: 1 }}>ENGELAT</h1>
      <h2 style={{ fontSize: 17, fontWeight: 700, textAlign: "center" }}>
        Bir coin seç — grafiği parkurun olsun
      </h2>
      <p style={{ fontSize: 13, color: "#ffffff99", textAlign: "center", marginTop: -4 }}>
        Seçtiğin coin&apos;in canlı 150 mumu bir tünele dönüşür. Coin&apos;leri topla,
        combo&apos;yu büyüt, skorunu paylaş.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          width: "100%",
        }}
      >
        {SUPPORTED_COINS.map((c) => {
          const loading = loadingCoin === c.symbol;
          const price = prices[c.symbol];
          const theme = themeFor(c.symbol);
          return (
            <button
              key={c.symbol}
              disabled={loadingCoin !== null}
              onClick={() => pick(c.symbol)}
              style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 4,
                padding: "14px 16px",
                paddingLeft: 18,
                borderRadius: 14,
                border: `1px solid ${loading ? theme.accent : "rgba(255,255,255,0.12)"}`,
                borderLeft: `4px solid ${theme.accent}`,
                background: loading
                  ? `linear-gradient(135deg, ${theme.bgTop}, ${theme.bgBottom})`
                  : "rgba(255,255,255,0.05)",
                color: "#fff",
                cursor: loadingCoin !== null ? "default" : "pointer",
                opacity: loadingCoin !== null && !loading ? 0.5 : 1,
                textAlign: "left",
                transition: "opacity 120ms",
              }}
            >
              <span style={{ fontSize: 18, fontWeight: 800, color: theme.accent }}>
                {c.symbol}
              </span>
              <span style={{ fontSize: 12, color: "#ffffff99" }}>{c.name}</span>
              <span style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>
                {loading
                  ? "yükleniyor…"
                  : price !== undefined
                    ? `$${price.toLocaleString()}`
                    : "—"}
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <p style={{ fontSize: 13, color: "#e94560", textAlign: "center" }}>{error}</p>
      )}
    </div>
  );
}
