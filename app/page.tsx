"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const Game = dynamic(() => import("@/components/Game").then((m) => m.Game), {
  ssr: false,
});

export default function HomePage() {
  const [gameOverData, setGameOverData] = useState<{
    score: number;
  } | null>(null);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Game onGameOver={(score) => setGameOverData({ score })} />

      {gameOverData && (
        <div
          style={{
            position: "absolute",
            bottom: 24,
            textAlign: "center",
            zIndex: 10,
          }}
        >
          <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
            Final Score: {gameOverData.score}
          </p>
          <div
            style={{
              padding: 16,
              background: "rgba(255,255,255,0.08)",
              borderRadius: 12,
              border: "1px dashed rgba(255,255,255,0.2)",
              minWidth: 200,
            }}
          >
            leaderboard + submit (Phase 3)
          </div>
        </div>
      )}
    </div>
  );
}
