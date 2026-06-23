"use client";

import { useEffect, useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { LEADERBOARD_ABI, LEADERBOARD_ADDRESS } from "@/lib/leaderboard";
import { SUPPORTED_COINS, coinKey } from "@/lib/coins";

function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

interface LeaderboardProps {
  coin: string;
  refreshKey?: number;
}

export function Leaderboard({ coin, refreshKey }: LeaderboardProps) {
  const [viewCoin, setViewCoin] = useState(coin);
  const { address } = useAccount();

  useEffect(() => {
    setViewCoin(coin);
  }, [coin]);

  const { data, isLoading, error, refetch } = useReadContract({
    address: LEADERBOARD_ADDRESS,
    abi: LEADERBOARD_ABI,
    functionName: "getTop",
    args: [coinKey(viewCoin)],
    chainId: baseSepolia.id,
    query: { enabled: !!LEADERBOARD_ADDRESS },
  });

  useEffect(() => {
    if (refreshKey !== undefined) refetch();
  }, [refreshKey, refetch]);

  if (!LEADERBOARD_ADDRESS) {
    return (
      <div style={{ padding: 12, fontSize: 13, color: "#ffffff80", textAlign: "center" }}>
        Leaderboard not deployed yet
      </div>
    );
  }

  const [players, scores] = (data as readonly [readonly string[], readonly bigint[]]) ?? [
    [],
    [],
  ];

  const myIndex = address
    ? players.findIndex((p) => p.toLowerCase() === address.toLowerCase())
    : -1;

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 320,
        background: "rgba(0,0,0,0.5)",
        borderRadius: 12,
        padding: 16,
      }}
    >
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, textAlign: "center" }}>
        🏆 {viewCoin} Top 10
      </h3>

      <div
        style={{
          display: "flex",
          gap: 6,
          justifyContent: "center",
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        {SUPPORTED_COINS.map((c) => (
          <button
            key={c.symbol}
            onClick={() => setViewCoin(c.symbol)}
            style={{
              padding: "4px 10px",
              fontSize: 12,
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              background: c.symbol === viewCoin ? "#e94560" : "rgba(255,255,255,0.1)",
              color: "#fff",
              fontWeight: c.symbol === viewCoin ? 700 : 400,
            }}
          >
            {c.symbol}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div style={{ fontSize: 13, color: "#ffffff80", textAlign: "center" }}>
          Loading…
        </div>
      ) : error ? (
        <div style={{ fontSize: 13, color: "#e94560", textAlign: "center" }}>
          Error loading leaderboard
        </div>
      ) : players.length === 0 ? (
        <div style={{ fontSize: 13, color: "#ffffff80", textAlign: "center" }}>
          No scores yet. Be the first!
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {players.map((player, i) => {
            const isMe = i === myIndex;
            return (
              <div
                key={`${player}-${i}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: 14,
                  padding: "5px 8px",
                  borderRadius: 8,
                  background: isMe ? "rgba(233,69,96,0.18)" : undefined,
                  border: isMe ? "1px solid rgba(233,69,96,0.5)" : "1px solid transparent",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      fontWeight: 700,
                      width: 24,
                      textAlign: "center",
                      color:
                        i === 0
                          ? "#f7d794"
                          : i === 1
                            ? "#c0c0c0"
                            : i === 2
                              ? "#cd7f32"
                              : "#fff",
                    }}
                  >
                    {i + 1}
                  </span>
                  <span style={{ fontFamily: "monospace", fontSize: 13 }}>
                    {shortenAddress(player)}
                  </span>
                  {isMe && (
                    <span style={{ fontSize: 11, color: "#e94560", fontWeight: 700 }}>
                      siz
                    </span>
                  )}
                </span>
                <span style={{ fontWeight: 600 }}>{String(scores[i])}</span>
              </div>
            );
          })}
          {address && myIndex === -1 && (
            <div style={{ fontSize: 12, color: "#ffffff80", textAlign: "center", marginTop: 6 }}>
              Henüz listede değilsin — skorunu gönder ve yerini al.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
