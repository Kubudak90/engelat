"use client";

import { useEffect, useState } from "react";
import { SUPPORTED_COINS } from "@/lib/coins";

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
        gap: 16,
        padding: 24,
        width: "100%",
        maxWidth: 360,
      }}
    >
      <h2 style={{ fontSize: 22, fontWeight: 800, textAlign: "center" }}>
        Coin seç — grafiği parkurun olsun
      </h2>
      <p style={{ fontSize: 13, color: "#ffffff99", textAlign: "center" }}>
        Seçtiğin coin&apos;in son 150 mumu bir tünele dönüşür.
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
          return (
            <button
              key={c.symbol}
              disabled={loadingCoin !== null}
              onClick={() => pick(c.symbol)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 4,
                padding: "14px 16px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.12)",
                background: loading ? "#0f3460" : "rgba(255,255,255,0.06)",
                color: "#fff",
                cursor: loadingCoin !== null ? "default" : "pointer",
                opacity: loadingCoin !== null && !loading ? 0.5 : 1,
                textAlign: "left",
              }}
            >
              <span style={{ fontSize: 18, fontWeight: 700 }}>{c.symbol}</span>
              <span style={{ fontSize: 12, color: "#ffffff99" }}>{c.name}</span>
              <span style={{ fontSize: 13, color: "#f7d794" }}>
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
        <p style={{ fontSize: 13, color: "#e94560", textAlign: "center" }}>
          {error}
        </p>
      )}
    </div>
  );
}
