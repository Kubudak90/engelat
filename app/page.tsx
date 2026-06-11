"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownDisconnect,
} from "@coinbase/onchainkit/wallet";
import { ScoreSubmit } from "@/components/ScoreSubmit";
import { Leaderboard } from "@/components/Leaderboard";

const Game = dynamic(() => import("@/components/Game").then((m) => m.Game), {
  ssr: false,
});

export default function HomePage() {
  const [gameOverData, setGameOverData] = useState<{
    score: number;
  } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSubmitted = () => {
    setRefreshKey((k) => k + 1);
  };

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
      <div
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          zIndex: 20,
        }}
      >
        <Wallet>
          <ConnectWallet />
          <WalletDropdown>
            <WalletDropdownDisconnect />
          </WalletDropdown>
        </Wallet>
      </div>

      <Game onGameOver={(score) => setGameOverData({ score })} />

      {gameOverData && (
        <div
          style={{
            position: "absolute",
            bottom: 24,
            textAlign: "center",
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
            maxHeight: "60vh",
            overflowY: "auto",
          }}
        >
          <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
            Final Score: {gameOverData.score}
          </p>
          <ScoreSubmit
            score={gameOverData.score}
            onSubmitted={handleSubmitted}
          />
          <Leaderboard refreshKey={refreshKey} />
        </div>
      )}
    </div>
  );
}
