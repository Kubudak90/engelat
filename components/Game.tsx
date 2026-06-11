"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  normalizeSeries,
  difficultyForLoop,
  centerlineAt,
  loopCountAt,
} from "@/lib/course";

interface GameProps {
  coin: string;
  closes: number[];
  last?: number;
  onGameOver?: (coin: string, score: number) => void;
}

const GRAVITY = 0.4;
const FLAP_STRENGTH = -7;
const BIRD_SIZE = 28;
const BIRD_X = 80;
const GROUND_HEIGHT = 40;
const SEGMENT_WIDTH = 60; // px per candle segment
const BAND_TOP_FRAC = 0.15; // highest price maps here
const BAND_BOTTOM_FRAC = 0.85; // lowest price maps here
const COLUMN_STEP = 6; // px between wall sample columns

function bestKey(coin: string): string {
  return `engelat_best_score_${coin}`;
}
function getBestScore(coin: string): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(bestKey(coin));
  return raw ? parseInt(raw, 10) || 0 : 0;
}
function setBestScore(coin: string, score: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(bestKey(coin), String(score));
}

export function Game({ coin, closes, last, onGameOver }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);

  const normalizedRef = useRef<number[]>(normalizeSeries(closes));

  const stateRef = useRef({
    bird: { y: 200, vy: 0 },
    worldX: 0,
    score: 0,
    gameOver: false,
    started: false,
    width: 0,
    height: 0,
    rafId: 0,
  });

  useEffect(() => {
    normalizedRef.current = normalizeSeries(closes);
  }, [closes]);

  useEffect(() => {
    setBest(getBestScore(coin));
  }, [coin]);

  const resetGame = useCallback(() => {
    const st = stateRef.current;
    st.bird = { y: st.height / 2, vy: 0 };
    st.worldX = 0;
    st.score = 0;
    st.gameOver = false;
    st.started = false;
    setScore(0);
    setGameOver(false);
    setStarted(false);
  }, []);

  const startGame = useCallback(() => {
    const st = stateRef.current;
    if (st.started || st.gameOver) return;
    st.started = true;
    setStarted(true);
  }, []);

  const flap = useCallback(() => {
    const st = stateRef.current;
    if (st.gameOver) return;
    if (!st.started) startGame();
    st.bird.vy = FLAP_STRENGTH;
  }, [startGame]);

  // Resize canvas to container
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stateRef.current.width = rect.width;
      stateRef.current.height = rect.height;
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const st = stateRef.current;

    const playBottom = () => st.height - GROUND_HEIGHT;
    const bandTop = () => playBottom() * BAND_TOP_FRAC;
    const bandBottom = () => playBottom() * BAND_BOTTOM_FRAC;
    // high price (t=1) → bandTop; low price (t=0) → bandBottom
    const centerYForT = (t: number) =>
      bandBottom() - t * (bandBottom() - bandTop());
    const posForScreenX = (sx: number) =>
      (st.worldX + (sx - BIRD_X)) / SEGMENT_WIDTH;

    const currentDifficulty = () => {
      const n = normalizedRef.current.length;
      const pos = st.worldX / SEGMENT_WIDTH;
      return difficultyForLoop(loopCountAt(pos, n));
    };

    const checkCollision = (): boolean => {
      const t = centerlineAt(normalizedRef.current, st.worldX / SEGMENT_WIDTH);
      const cy = centerYForT(t);
      const gap = currentDifficulty().gap;
      const birdTop = st.bird.y;
      const birdBottom = st.bird.y + BIRD_SIZE;
      if (birdTop < cy - gap / 2) return true;
      if (birdBottom > cy + gap / 2) return true;
      if (birdTop < 0) return true;
      if (birdBottom > playBottom()) return true;
      return false;
    };

    const update = (now: number) => {
      if (st.gameOver) return;
      const bird = st.bird;

      if (st.started) {
        bird.vy += GRAVITY;
        bird.y += bird.vy;
        st.worldX += currentDifficulty().speed;

        const seg = Math.floor(st.worldX / SEGMENT_WIDTH);
        if (seg > st.score) {
          st.score = seg;
          setScore(seg);
        }

        if (checkCollision()) {
          st.gameOver = true;
          setGameOver(true);
          if (st.score > getBestScore(coin)) {
            setBestScore(coin, st.score);
            setBest(st.score);
          }
          onGameOver?.(coin, st.score);
        }
      } else {
        // Rest at the corridor center so the start is fair
        const t = centerlineAt(normalizedRef.current, st.worldX / SEGMENT_WIDTH);
        bird.y = centerYForT(t) - BIRD_SIZE / 2 + Math.sin(now / 400) * 6;
        bird.vy = 0;
      }
    };

    const draw = () => {
      const w = st.width;
      const h = st.height;
      const norm = normalizedRef.current;
      const gap = currentDifficulty().gap;

      // Background
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(0, 0, w, h);

      // Stars
      ctx.fillStyle = "#ffffff20";
      for (let i = 0; i < 20; i++) {
        ctx.fillRect((i * 137) % w, (i * 53) % (h - GROUND_HEIGHT), 2, 2);
      }

      // Top canyon wall
      ctx.fillStyle = "#e94560";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (let sx = 0; sx <= w; sx += COLUMN_STEP) {
        const cy = centerYForT(centerlineAt(norm, posForScreenX(sx)));
        ctx.lineTo(sx, cy - gap / 2);
      }
      ctx.lineTo(w, 0);
      ctx.closePath();
      ctx.fill();

      // Bottom canyon wall
      ctx.beginPath();
      ctx.moveTo(0, playBottom());
      for (let sx = 0; sx <= w; sx += COLUMN_STEP) {
        const cy = centerYForT(centerlineAt(norm, posForScreenX(sx)));
        ctx.lineTo(sx, cy + gap / 2);
      }
      ctx.lineTo(w, playBottom());
      ctx.closePath();
      ctx.fill();

      // Ground
      ctx.fillStyle = "#0f3460";
      ctx.fillRect(0, playBottom(), w, GROUND_HEIGHT);
      ctx.fillStyle = "#16213e";
      ctx.fillRect(0, playBottom(), w, 4);

      // Bird
      const bird = st.bird;
      ctx.fillStyle = "#f7d794";
      ctx.beginPath();
      ctx.arc(BIRD_X + BIRD_SIZE / 2, bird.y + BIRD_SIZE / 2, BIRD_SIZE / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1a1a2e";
      ctx.beginPath();
      ctx.arc(BIRD_X + BIRD_SIZE * 0.7, bird.y + BIRD_SIZE * 0.35, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e58e26";
      ctx.beginPath();
      ctx.moveTo(BIRD_X + BIRD_SIZE, bird.y + BIRD_SIZE * 0.45);
      ctx.lineTo(BIRD_X + BIRD_SIZE + 8, bird.y + BIRD_SIZE * 0.6);
      ctx.lineTo(BIRD_X + BIRD_SIZE, bird.y + BIRD_SIZE * 0.75);
      ctx.fill();

      // HUD: score + best
      ctx.fillStyle = "#fff";
      ctx.font = "bold 32px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(st.score), w / 2, 60);
      ctx.fillStyle = "#ffffff80";
      ctx.font = "14px sans-serif";
      ctx.fillText(`Best: ${best}`, w / 2, 85);

      // HUD: coin label
      ctx.textAlign = "left";
      ctx.fillStyle = "#f7d794";
      ctx.font = "bold 16px sans-serif";
      ctx.fillText(`${coin}${last ? `  $${last.toLocaleString()}` : ""}`, 16, 28);
      ctx.fillStyle = "#ffffff60";
      ctx.font = "11px sans-serif";
      ctx.fillText("son 150 mum · grafikten parkur", 16, 44);

      // Start hint
      if (!st.started && !st.gameOver) {
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffffffcc";
        ctx.font = "bold 18px sans-serif";
        ctx.fillText("Tap, Click veya Space ile başla", w / 2, h / 2 + 80);
      }
    };

    const loop = (now: number) => {
      update(now);
      draw();
      st.rafId = requestAnimationFrame(loop);
    };

    st.rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(st.rafId);
  }, [best, onGameOver, coin, last]);

  // Keyboard
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (stateRef.current.gameOver) resetGame();
        else flap();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [flap, resetGame]);

  const handlePointerDown = useCallback(() => {
    if (stateRef.current.gameOver) resetGame();
    else flap();
  }, [flap, resetGame]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        cursor: "pointer",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
      onPointerDown={handlePointerDown}
    >
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
      />

      {gameOver && (
        <div
          style={{
            position: "absolute",
            top: "40%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            textAlign: "center",
            zIndex: 10,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              background: "rgba(0,0,0,0.7)",
              borderRadius: 16,
              padding: "24px 32px",
              backdropFilter: "blur(4px)",
            }}
          >
            <p style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Game Over</p>
            <p style={{ fontSize: 18, marginBottom: 16 }}>
              {coin} · Score: {score}
            </p>
            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                resetGame();
              }}
              style={{
                pointerEvents: "auto",
                padding: "10px 24px",
                fontSize: 16,
                fontWeight: 600,
                borderRadius: 8,
                border: "none",
                background: "#e94560",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Restart
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
