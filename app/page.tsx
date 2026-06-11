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
import { CoinPicker, type CoinSelection } from "@/components/CoinPicker";

const Game = dynamic(() => import("@/components/Game").then((m) => m.Game), {
  ssr: false,
});

export default function HomePage() {
  const [selected, setSelected] = useState<CoinSelection | null>(null);
  const [gameOverData, setGameOverData] = useState<{ coin: string; score: number } | null>(
    null
  );
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSubmitted = () => setRefreshKey((k) => k + 1);

  const changeCoin = () => {
    setSelected(null);
    setGameOverData(null);
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
      <div style={{ position: "absolute", top: 16, right: 16, zIndex: 20 }}>
        <Wallet>
          <ConnectWallet />
          <WalletDropdown>
            <WalletDropdownDisconnect />
          </WalletDropdown>
        </Wallet>
      </div>

      {!selected ? (
        <CoinPicker onSelect={setSelected} />
      ) : (
        <>
          <button
            onClick={changeCoin}
            style={{
              position: "absolute",
              top: 16,
              left: 16,
              zIndex: 20,
              padding: "6px 12px",
              fontSize: 13,
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(0,0,0,0.4)",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            ← Coin değiştir
          </button>

          <Game
            key={selected.coin}
            coin={selected.coin}
            closes={selected.closes}
            last={selected.last}
            onGameOver={(coin, score) => setGameOverData({ coin, score })}
          />

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
                {gameOverData.coin} · Final Score: {gameOverData.score}
              </p>
              <ScoreSubmit
                coin={gameOverData.coin}
                score={gameOverData.score}
                onSubmitted={handleSubmitted}
              />
              <Leaderboard coin={gameOverData.coin} refreshKey={refreshKey} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
