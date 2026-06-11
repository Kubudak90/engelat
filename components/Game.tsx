"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface GameProps {
  onGameOver?: (score: number) => void;
}

const GRAVITY = 0.4;
const FLAP_STRENGTH = -7;
const OBSTACLE_SPEED = 3;
const OBSTACLE_GAP = 160;
const OBSTACLE_WIDTH = 60;
const SPAWN_INTERVAL = 1800; // ms
const BIRD_SIZE = 28;
const GROUND_HEIGHT = 40;

interface Bird {
  x: number;
  y: number;
  vy: number;
}

interface Obstacle {
  x: number;
  topHeight: number;
  passed: boolean;
}

function getBestScore(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem("engelat_best_score");
  return raw ? parseInt(raw, 10) || 0 : 0;
}

function setBestScore(score: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("engelat_best_score", String(score));
}

export function Game({ onGameOver }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);

  const stateRef = useRef({
    bird: { x: 80, y: 200, vy: 0 } as Bird,
    obstacles: [] as Obstacle[],
    score: 0,
    gameOver: false,
    started: false,
    lastSpawn: 0,
    width: 0,
    height: 0,
    rafId: 0,
  });

  // Initialize best score on mount
  useEffect(() => {
    setBest(getBestScore());
  }, []);

  const resetGame = useCallback(() => {
    const st = stateRef.current;
    st.bird = { x: 80, y: st.height / 2, vy: 0 };
    st.obstacles = [];
    st.score = 0;
    st.gameOver = false;
    st.started = false;
    st.lastSpawn = 0;
    setScore(0);
    setGameOver(false);
    setStarted(false);
  }, []);

  const startGame = useCallback(() => {
    const st = stateRef.current;
    if (st.started || st.gameOver) return;
    st.started = true;
    st.lastSpawn = performance.now();
    setStarted(true);
  }, []);

  const flap = useCallback(() => {
    const st = stateRef.current;
    if (st.gameOver) return;
    if (!st.started) {
      startGame();
    }
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

    const spawnObstacle = (now: number) => {
      const h = st.height;
      const minTop = 60;
      const maxTop = h - OBSTACLE_GAP - GROUND_HEIGHT - 60;
      const topHeight = minTop + Math.random() * (maxTop - minTop);
      st.obstacles.push({
        x: st.width,
        topHeight,
        passed: false,
      });
      st.lastSpawn = now;
    };

    const checkCollision = (): boolean => {
      const bird = st.bird;
      const h = st.height;

      // Ceiling
      if (bird.y < 0) return true;
      // Ground
      if (bird.y + BIRD_SIZE > h - GROUND_HEIGHT) return true;

      // Obstacles
      for (const obs of st.obstacles) {
        if (
          bird.x + BIRD_SIZE > obs.x &&
          bird.x < obs.x + OBSTACLE_WIDTH &&
          (bird.y < obs.topHeight || bird.y + BIRD_SIZE > obs.topHeight + OBSTACLE_GAP)
        ) {
          return true;
        }
      }
      return false;
    };

    const update = (now: number) => {
      if (st.gameOver) return;

      const bird = st.bird;

      if (st.started) {
        bird.vy += GRAVITY;
        bird.y += bird.vy;

        // Spawn obstacles
        if (now - st.lastSpawn > SPAWN_INTERVAL) {
          spawnObstacle(now);
        }

        // Move obstacles
        for (const obs of st.obstacles) {
          obs.x -= OBSTACLE_SPEED;

          // Score when bird passes obstacle
          if (!obs.passed && obs.x + OBSTACLE_WIDTH < bird.x) {
            obs.passed = true;
            st.score += 1;
            setScore(st.score);
          }
        }

        // Remove off-screen obstacles
        st.obstacles = st.obstacles.filter((obs) => obs.x + OBSTACLE_WIDTH > -10);

        // Collision
        if (checkCollision()) {
          st.gameOver = true;
          setGameOver(true);
          const currentBest = getBestScore();
          if (st.score > currentBest) {
            setBestScore(st.score);
            setBest(st.score);
          }
          onGameOver?.(st.score);
          return;
        }
      } else {
        // Idle float
        bird.y = st.height / 2 + Math.sin(now / 400) * 10;
      }
    };

    const draw = () => {
      const w = st.width;
      const h = st.height;

      // Background
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(0, 0, w, h);

      // Stars / particles
      ctx.fillStyle = "#ffffff20";
      for (let i = 0; i < 20; i++) {
        const sx = ((i * 137) % w);
        const sy = ((i * 53) % (h - GROUND_HEIGHT));
        ctx.fillRect(sx, sy, 2, 2);
      }

      // Obstacles
      for (const obs of st.obstacles) {
        // Top pipe
        ctx.fillStyle = "#e94560";
        ctx.fillRect(obs.x, 0, OBSTACLE_WIDTH, obs.topHeight);
        ctx.fillStyle = "#c13651";
        ctx.fillRect(obs.x - 2, obs.topHeight - 20, OBSTACLE_WIDTH + 4, 20);

        // Bottom pipe
        const bottomY = obs.topHeight + OBSTACLE_GAP;
        const bottomH = h - GROUND_HEIGHT - bottomY;
        ctx.fillStyle = "#e94560";
        ctx.fillRect(obs.x, bottomY, OBSTACLE_WIDTH, bottomH);
        ctx.fillStyle = "#c13651";
        ctx.fillRect(obs.x - 2, bottomY, OBSTACLE_WIDTH + 4, 20);
      }

      // Ground
      ctx.fillStyle = "#0f3460";
      ctx.fillRect(0, h - GROUND_HEIGHT, w, GROUND_HEIGHT);
      ctx.fillStyle = "#16213e";
      ctx.fillRect(0, h - GROUND_HEIGHT, w, 4);

      // Bird
      const bird = st.bird;
      ctx.fillStyle = "#f7d794";
      ctx.beginPath();
      ctx.arc(bird.x + BIRD_SIZE / 2, bird.y + BIRD_SIZE / 2, BIRD_SIZE / 2, 0, Math.PI * 2);
      ctx.fill();
      // Eye
      ctx.fillStyle = "#1a1a2e";
      ctx.beginPath();
      ctx.arc(bird.x + BIRD_SIZE * 0.7, bird.y + BIRD_SIZE * 0.35, 3, 0, Math.PI * 2);
      ctx.fill();
      // Beak
      ctx.fillStyle = "#e58e26";
      ctx.beginPath();
      ctx.moveTo(bird.x + BIRD_SIZE, bird.y + BIRD_SIZE * 0.45);
      ctx.lineTo(bird.x + BIRD_SIZE + 8, bird.y + BIRD_SIZE * 0.6);
      ctx.lineTo(bird.x + BIRD_SIZE, bird.y + BIRD_SIZE * 0.75);
      ctx.fill();

      // Score
      ctx.fillStyle = "#fff";
      ctx.font = "bold 32px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(st.score), w / 2, 60);

      // Best
      ctx.fillStyle = "#ffffff80";
      ctx.font = "14px sans-serif";
      ctx.fillText(`Best: ${best}`, w / 2, 85);

      // Start hint
      if (!st.started && !st.gameOver) {
        ctx.fillStyle = "#ffffffcc";
        ctx.font = "bold 18px sans-serif";
        ctx.fillText("Tap, Click, or Space to start", w / 2, h / 2 + 60);
      }
    };

    let lastTime = performance.now();
    const loop = (now: number) => {
      const dt = now - lastTime;
      lastTime = now;

      update(now);
      draw();

      st.rafId = requestAnimationFrame(loop);
    };

    st.rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(st.rafId);
  }, [best, onGameOver]);

  // Input handlers
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (stateRef.current.gameOver) {
          resetGame();
        } else {
          flap();
        }
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [flap, resetGame]);

  const handlePointerDown = useCallback(() => {
    if (stateRef.current.gameOver) {
      resetGame();
    } else {
      flap();
    }
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
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
        }}
      />

      {gameOver && (
        <div
          style={{
            position: "absolute",
            top: "50%",
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
            <p style={{ fontSize: 18, marginBottom: 16 }}>Score: {score}</p>
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
