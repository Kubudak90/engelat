"use client";

import { useEffect } from "react";
import { useReadContract } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { LEADERBOARD_ABI, LEADERBOARD_ADDRESS } from "@/lib/leaderboard";

function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

interface LeaderboardProps {
  refreshKey?: number;
}

export function Leaderboard({ refreshKey }: LeaderboardProps) {
  const { data, isLoading, error, refetch } = useReadContract({
    address: LEADERBOARD_ADDRESS,
    abi: LEADERBOARD_ABI,
    functionName: "getTop",
    chainId: baseSepolia.id,
    query: { enabled: !!LEADERBOARD_ADDRESS },
  });

  // Refetch when refreshKey changes
  useEffect(() => {
    if (refreshKey !== undefined) {
      refetch();
    }
  }, [refreshKey, refetch]);

  if (!LEADERBOARD_ADDRESS) {
    return (
      <div
        style={{
          padding: 12,
          fontSize: 13,
          color: "#ffffff80",
          textAlign: "center",
        }}
      >
        Leaderboard not deployed yet
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        style={{
          padding: 12,
          fontSize: 13,
          color: "#ffffff80",
          textAlign: "center",
        }}
      >
        Loading leaderboard…
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: 12,
          fontSize: 13,
          color: "#e94560",
          textAlign: "center",
        }}
      >
        Error loading leaderboard
      </div>
    );
  }

  const [players, scores] = data ?? [[], []];

  if (players.length === 0) {
    return (
      <div
        style={{
          padding: 12,
          fontSize: 13,
          color: "#ffffff80",
          textAlign: "center",
        }}
      >
        No scores yet. Be the first!
      </div>
    );
  }

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
      <h3
        style={{
          fontSize: 16,
          fontWeight: 700,
          marginBottom: 12,
          textAlign: "center",
        }}
      >
        🏆 Top 10
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {players.map((player, i) => (
          <div
            key={`${player}-${i}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 14,
              padding: "4px 0",
              borderBottom:
                i < players.length - 1 ? "1px solid rgba(255,255,255,0.1)" : undefined,
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
            </span>
            <span style={{ fontWeight: 600 }}>{String(scores[i])}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
