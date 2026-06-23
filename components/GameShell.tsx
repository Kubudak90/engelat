"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownDisconnect,
} from "@coinbase/onchainkit/wallet";
import {
  useComposeCast,
  useOpenUrl,
  useIsInMiniApp,
  useAddFrame,
} from "@coinbase/onchainkit/minikit";
import { ScoreSubmit } from "@/components/ScoreSubmit";
import { Leaderboard } from "@/components/Leaderboard";
import { CoinPicker, type CoinSelection } from "@/components/CoinPicker";
import { baseUrl } from "@/lib/miniapp";
import {
  buildShareText,
  buildPlayUrl,
  buildWarpcastIntentUrl,
} from "@/lib/share";
import {
  loadMutePreference,
  setMuted as setAudioMuted,
} from "@/lib/audio";
import { setHapticsEnabled } from "@/lib/haptics";

const Game = dynamic(() => import("@/components/Game").then((m) => m.Game), {
  ssr: false,
});

interface GameShellProps {
  initialCoin: string | null;
}

const PANEL_BG = "rgba(12,12,24,0.82)";

export function GameShell({ initialCoin }: GameShellProps) {
  const [selected, setSelected] = useState<CoinSelection | null>(null);
  const [gameOver, setGameOver] = useState<{ coin: string; score: number } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [restartKey, setRestartKey] = useState(0);
  const [muted, setMutedState] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState<boolean>(!!initialCoin);
  const [added, setAdded] = useState(false);

  const { composeCastAsync } = useComposeCast();
  const { isInMiniApp } = useIsInMiniApp();
  const openUrl = useOpenUrl();
  const addFrame = useAddFrame();

  // Restore mute preference once.
  useEffect(() => {
    const m = loadMutePreference();
    setMutedState(m);
    setHapticsEnabled(!m);
  }, []);

  // Deep-link: auto-load the shared coin straight into a run.
  useEffect(() => {
    if (!initialCoin) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/chart?coin=${initialCoin}`);
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && Array.isArray(data.closes) && data.closes.length > 0) {
          setSelected({ coin: initialCoin, closes: data.closes, last: data.last });
        }
      } catch {
        /* fall through to picker */
      } finally {
        if (!cancelled) setLoadingInitial(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialCoin]);

  const toggleMute = useCallback(() => {
    setMutedState((m) => {
      const next = !m;
      setAudioMuted(next);
      setHapticsEnabled(!next);
      return next;
    });
  }, []);

  const handleSubmitted = () => setRefreshKey((k) => k + 1);

  const changeCoin = () => {
    setSelected(null);
    setGameOver(null);
  };

  const playAgain = () => {
    setGameOver(null);
    setRestartKey((k) => k + 1);
  };

  const share = useCallback(
    (coin: string, score: number) => {
      const base = baseUrl();
      const text = buildShareText(coin, score);
      const playUrl = buildPlayUrl(base, coin, score);
      const fallback = () => openUrl(buildWarpcastIntentUrl(text, playUrl));
      if (isInMiniApp) {
        // composeCastAsync rejects (not throws) on host/SDK failure; a user
        // cancel resolves with { cast: null } and must NOT trigger the fallback.
        composeCastAsync({ text, embeds: [playUrl] }).catch(fallback);
        return;
      }
      fallback();
    },
    [isInMiniApp, composeCastAsync, openUrl]
  );

  const promptAdd = useCallback(() => {
    addFrame()
      .then((res) => {
        if (res) setAdded(true);
      })
      .catch(() => {});
  }, [addFrame]);

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
      <div style={{ position: "absolute", top: 16, right: 16, zIndex: 30 }}>
        <Wallet>
          <ConnectWallet />
          <WalletDropdown>
            <WalletDropdownDisconnect />
          </WalletDropdown>
        </Wallet>
      </div>

      {!selected ? (
        loadingInitial ? (
          <div style={{ fontSize: 15, color: "#ffffffaa" }}>Yükleniyor…</div>
        ) : (
          <CoinPicker onSelect={setSelected} />
        )
      ) : (
        <>
          <button
            onClick={changeCoin}
            style={topButtonStyle("left")}
            aria-label="Coin değiştir"
          >
            ← Coin
          </button>

          <button
            onClick={toggleMute}
            style={{ ...topButtonStyle("center"), fontSize: 16, padding: "6px 10px" }}
            aria-label={muted ? "Sesi aç" : "Sesi kapat"}
          >
            {muted ? "🔇" : "🔊"}
          </button>

          <Game
            key={`${selected.coin}:${restartKey}`}
            coin={selected.coin}
            closes={selected.closes}
            last={selected.last}
            onGameOver={(coin, score) => setGameOver({ coin, score })}
          />

          {gameOver && (
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 20,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 14,
                padding: "18px 16px 22px",
                maxHeight: "72vh",
                overflowY: "auto",
                background: `linear-gradient(to top, ${PANEL_BG}, rgba(12,12,24,0))`,
              }}
            >
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={playAgain} style={primaryButton}>
                  🔁 Tekrar oyna
                </button>
                <button onClick={() => share(gameOver.coin, gameOver.score)} style={shareButton}>
                  ☄️ Skoru paylaş
                </button>
              </div>

              {isInMiniApp && !added && (
                <button onClick={promptAdd} style={ghostButton}>
                  ＋ Engelat&apos;ı ekle
                </button>
              )}

              <ScoreSubmit
                coin={gameOver.coin}
                score={gameOver.score}
                onSubmitted={handleSubmitted}
              />
              <Leaderboard coin={gameOver.coin} refreshKey={refreshKey} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function topButtonStyle(pos: "left" | "center"): React.CSSProperties {
  const base: React.CSSProperties = {
    position: "absolute",
    top: 16,
    zIndex: 30,
    padding: "6px 12px",
    fontSize: 13,
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(0,0,0,0.4)",
    color: "#fff",
    cursor: "pointer",
    backdropFilter: "blur(4px)",
  };
  if (pos === "left") return { ...base, left: 16 };
  return { ...base, left: "50%", transform: "translateX(-50%)" };
}

const primaryButton: React.CSSProperties = {
  padding: "12px 20px",
  fontSize: 15,
  fontWeight: 700,
  borderRadius: 10,
  border: "none",
  background: "#e94560",
  color: "#fff",
  cursor: "pointer",
};

const shareButton: React.CSSProperties = {
  padding: "12px 20px",
  fontSize: 15,
  fontWeight: 700,
  borderRadius: 10,
  border: "none",
  background: "#7c5cff",
  color: "#fff",
  cursor: "pointer",
};

const ghostButton: React.CSSProperties = {
  padding: "8px 16px",
  fontSize: 13,
  fontWeight: 600,
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "transparent",
  color: "#fff",
  cursor: "pointer",
};
