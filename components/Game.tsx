"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  normalizeSeries,
  difficultyForLoop,
  centerlineAt,
  loopCountAt,
} from "@/lib/course";
import {
  isCoinSegment,
  coinOffset,
  coinValue,
  comboMultiplier,
} from "@/lib/collectibles";
import { themeFor } from "@/lib/theme";
import { ensureAudio, playSound } from "@/lib/audio";
import { impact, notify } from "@/lib/haptics";

interface GameProps {
  coin: string;
  closes: number[];
  last?: number;
  onGameOver?: (coin: string, score: number) => void;
}

// Physics is tuned in 60 fps units and advanced on a fixed timestep, so the game
// plays identically on 60 Hz and 120 Hz displays.
const STEP_MS = 1000 / 60;
const MAX_FRAME_MS = 100; // clamp huge gaps (tab refocus) to avoid spiral-of-death

const GRAVITY = 0.4;
const FLAP_STRENGTH = -7;
const BIRD_SIZE = 28;
const BIRD_X = 80;
const GROUND_HEIGHT = 40;
const SEGMENT_WIDTH = 60; // px per candle segment
const BAND_TOP_FRAC = 0.15; // highest price maps here
const BAND_BOTTOM_FRAC = 0.85; // lowest price maps here
const COLUMN_STEP = 6; // px between wall sample columns
const LEAD_IN_SEGMENTS = 4; // flat runway before the chart starts (fair start)
const COIN_RADIUS = 11;
const TRAIL_MAX = 16;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  size: number;
  color: string;
  gravity: number;
}
interface Floater {
  x: number;
  y: number;
  text: string;
  life: number;
  color: string;
}
interface Star {
  x: number;
  y: number;
  r: number;
  factor: number;
  alpha: number;
}

function bestKey(coin: string): string {
  return `engelat_best_score_${coin}`;
}
function getBestScore(coin: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(bestKey(coin));
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch {
    return 0; // storage blocked (sandboxed iframe / private mode)
  }
}
function setBestScore(coin: string, score: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(bestKey(coin), String(score));
  } catch {
    /* storage unavailable */
  }
}

export function Game({ coin, closes, last, onGameOver }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const normalizedRef = useRef<number[]>(normalizeSeries(closes));
  const lastRef = useRef<number | undefined>(last);
  const onGameOverRef = useRef(onGameOver);

  const stateRef = useRef({
    bird: { y: 200, vy: 0, rot: 0, scale: 1 },
    worldX: 0,
    distance: 0,
    coinScore: 0,
    score: 0,
    combo: 0,
    bestCombo: 0,
    best: 0,
    gameOver: false,
    started: false,
    width: 0,
    height: 0,
    rafId: 0,
    lastT: 0,
    acc: 0,
    shake: 0,
    flashT: 0,
    deathT: 0,
    collected: new Set<number>(),
    particles: [] as Particle[],
    floaters: [] as Floater[],
    trail: [] as { x: number; y: number }[],
    stars: [] as Star[],
  });

  useEffect(() => {
    normalizedRef.current = normalizeSeries(closes);
  }, [closes]);
  useEffect(() => {
    lastRef.current = last;
  }, [last]);
  useEffect(() => {
    onGameOverRef.current = onGameOver;
  }, [onGameOver]);

  // Resize canvas to container + (re)seed the parallax starfield.
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const seedStars = (w: number, h: number) => {
      const stars: Star[] = [];
      const count = Math.round((w * h) / 9000);
      for (let i = 0; i < count; i++) {
        // deterministic-ish spread using index hashing (stable per resize)
        const x = (i * 137.5) % w;
        const y = (i * 53.3) % h;
        const layer = i % 3;
        stars.push({
          x,
          y,
          r: layer === 2 ? 1.6 : layer === 1 ? 1.1 : 0.7,
          factor: layer === 2 ? 0.5 : layer === 1 ? 0.28 : 0.14,
          alpha: layer === 2 ? 0.5 : layer === 1 ? 0.32 : 0.18,
        });
      }
      stateRef.current.stars = stars;
    };

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const st = stateRef.current;
      st.width = rect.width;
      st.height = rect.height;
      if (!st.started) st.bird.y = st.height / 2;
      seedStars(rect.width, rect.height);
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const flap = useCallback(() => {
    const st = stateRef.current;
    if (st.gameOver) return;
    ensureAudio();
    if (!st.started) {
      st.started = true;
      st.best = getBestScore(coin);
      playSound("start");
    }
    st.bird.vy = FLAP_STRENGTH;
    st.bird.scale = 0.78; // squash, eases back to 1 each step
    spawnFlapPuff();
    playSound("flap");
    impact("light");
  }, [coin]);

  const spawnFlapPuff = () => {
    const st = stateRef.current;
    const cx = BIRD_X;
    const cy = st.bird.y + BIRD_SIZE / 2;
    for (let i = 0; i < 5; i++) {
      st.particles.push({
        x: cx,
        y: cy + (Math.random() - 0.5) * BIRD_SIZE,
        vx: -1.5 - Math.random() * 1.5,
        vy: (Math.random() - 0.5) * 1.2,
        life: 1,
        decay: 0.05 + Math.random() * 0.03,
        size: 2 + Math.random() * 2,
        color: "rgba(255,255,255,0.55)",
        gravity: 0,
      });
    }
  };

  // Game loop — one rAF, stable for the life of the mount.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const st = stateRef.current;
    const theme = themeFor(coin);

    const playBottom = () => st.height - GROUND_HEIGHT;
    const bandTop = () => playBottom() * BAND_TOP_FRAC;
    const bandBottom = () => playBottom() * BAND_BOTTOM_FRAC;
    const centerYForT = (t: number) => bandBottom() - t * (bandBottom() - bandTop());
    const posForScreenX = (sx: number) => (st.worldX + (sx - BIRD_X)) / SEGMENT_WIDTH;
    // Flat lead-in: the corridor holds the chart's first value for LEAD_IN_SEGMENTS
    // so a chart that opens with a steep move can't kill on the first tap.
    const courseT = (pos: number) =>
      centerlineAt(normalizedRef.current, Math.max(0, pos - LEAD_IN_SEGMENTS));

    const gapAtWorldPos = (pos: number) => {
      const n = normalizedRef.current.length;
      return difficultyForLoop(loopCountAt(pos, n)).gap;
    };
    const difficultyNow = () =>
      difficultyForLoop(loopCountAt(st.worldX / SEGMENT_WIDTH, normalizedRef.current.length));

    const checkCollision = (gap: number): boolean => {
      const t = courseT(st.worldX / SEGMENT_WIDTH);
      const cy = centerYForT(t);
      const birdTop = st.bird.y;
      const birdBottom = st.bird.y + BIRD_SIZE;
      if (birdTop < cy - gap / 2) return true;
      if (birdBottom > cy + gap / 2) return true;
      if (birdTop < 0) return true;
      if (birdBottom > playBottom()) return true;
      return false;
    };

    const spawnCoinBurst = (x: number, y: number) => {
      for (let i = 0; i < 12; i++) {
        const a = (Math.PI * 2 * i) / 12 + Math.random() * 0.4;
        const sp = 1.5 + Math.random() * 2.5;
        st.particles.push({
          x,
          y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 1,
          decay: 0.04 + Math.random() * 0.02,
          size: 2 + Math.random() * 2.5,
          color: theme.glow,
          gravity: 0.05,
        });
      }
    };

    const spawnDeathBurst = (x: number, y: number) => {
      for (let i = 0; i < 28; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 2 + Math.random() * 5;
        st.particles.push({
          x,
          y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - 1,
          life: 1,
          decay: 0.015 + Math.random() * 0.02,
          size: 2 + Math.random() * 3.5,
          color: i % 2 ? theme.accent : "#f7d794",
          gravity: 0.18,
        });
      }
    };

    const totalScore = () => st.distance + st.coinScore;

    const stepPhysics = () => {
      const bird = st.bird;

      // Particles + floaters advance on every step (alive or not, for the death anim).
      for (const p of st.particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.life -= p.decay;
      }
      if (st.particles.length > 0)
        st.particles = st.particles.filter((p) => p.life > 0);
      for (const f of st.floaters) {
        f.y -= 0.8;
        f.life -= 0.02;
      }
      if (st.floaters.length > 0) st.floaters = st.floaters.filter((f) => f.life > 0);
      if (st.shake > 0.1) st.shake *= 0.86;
      else st.shake = 0;
      if (st.flashT > 0) st.flashT -= 0.06;

      bird.scale += (1 - bird.scale) * 0.2; // ease squash back to round

      if (st.gameOver) {
        st.deathT += 1;
        return;
      }

      if (!st.started) {
        const t = courseT(st.worldX / SEGMENT_WIDTH);
        bird.y = centerYForT(t) - BIRD_SIZE / 2 + Math.sin(st.deathT) * 0; // held; bob added in draw
        bird.vy = 0;
        return;
      }

      const prevPos = st.worldX / SEGMENT_WIDTH;
      bird.vy += GRAVITY;
      bird.y += bird.vy;
      bird.rot = Math.max(-0.5, Math.min(1.1, bird.vy / 12));
      st.worldX += difficultyNow().speed;
      const pos = st.worldX / SEGMENT_WIDTH;

      // Motion trail
      st.trail.push({ x: BIRD_X + BIRD_SIZE / 2, y: bird.y + BIRD_SIZE / 2 });
      if (st.trail.length > TRAIL_MAX) st.trail.shift();

      // Distance score
      const seg = Math.max(0, Math.floor(pos) - LEAD_IN_SEGMENTS);
      if (seg > st.distance) {
        st.distance = seg;
        st.flashT = 1;
        playSound("score");
        st.score = totalScore();
      }

      // Coin pickup (within a forgiving window around the bird)
      const birdCenterY = bird.y + BIRD_SIZE / 2;
      const sNear = Math.round(pos - LEAD_IN_SEGMENTS);
      for (let s = sNear - 1; s <= sNear + 1; s++) {
        if (!isCoinSegment(s) || st.collected.has(s)) continue;
        const worldCenter = s + LEAD_IN_SEGMENTS;
        if (Math.abs(pos - worldCenter) > 0.5) continue;
        const gap = gapAtWorldPos(worldCenter);
        const coinY = centerYForT(centerlineAt(normalizedRef.current, s)) + coinOffset(s) * (gap / 2);
        if (Math.abs(birdCenterY - coinY) <= BIRD_SIZE / 2 + COIN_RADIUS + 6) {
          st.collected.add(s);
          const gained = coinValue(st.combo);
          st.combo += 1;
          st.bestCombo = Math.max(st.bestCombo, st.combo);
          st.coinScore += gained;
          st.score = totalScore();
          const coinScreenX = BIRD_X + (worldCenter * SEGMENT_WIDTH - st.worldX);
          spawnCoinBurst(coinScreenX, coinY);
          st.floaters.push({
            x: coinScreenX,
            y: coinY - 6,
            text: `+${gained}`,
            life: 1,
            color: theme.glow,
          });
          playSound("coin");
          impact("light");
        }
      }
      // Combo resets if a coin's center is crossed uncollected
      for (let s = Math.floor(prevPos - LEAD_IN_SEGMENTS) + 1; s <= Math.floor(pos - LEAD_IN_SEGMENTS); s++) {
        if (isCoinSegment(s) && !st.collected.has(s)) st.combo = 0;
      }

      if (checkCollision(difficultyNow().gap)) {
        st.gameOver = true;
        st.shake = 20;
        st.deathT = 0;
        spawnDeathBurst(BIRD_X + BIRD_SIZE / 2, bird.y + BIRD_SIZE / 2);
        st.trail = [];
        playSound("die");
        notify("error");
        const total = totalScore();
        if (total > getBestScore(coin)) {
          setBestScore(coin, total);
          st.best = total;
        }
        onGameOverRef.current?.(coin, total);
      }
    };

    const drawBird = (now: number) => {
      const bird = st.bird;
      let cy = bird.y + BIRD_SIZE / 2;
      if (!st.started && !st.gameOver) cy += Math.sin(now / 380) * 6;
      const cx = BIRD_X + BIRD_SIZE / 2;

      // Trail
      for (let i = 0; i < st.trail.length; i++) {
        const tp = st.trail[i];
        const a = (i / st.trail.length) * 0.4;
        ctx.fillStyle = `rgba(247,215,148,${a})`;
        const r = (BIRD_SIZE / 2) * (i / st.trail.length) * 0.8;
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(bird.rot * 0.6);
      ctx.scale(1 / Math.max(0.6, bird.scale), bird.scale);

      // Glow
      ctx.shadowColor = "#f7d794";
      ctx.shadowBlur = 14;
      ctx.fillStyle = "#f7d794";
      ctx.beginPath();
      ctx.arc(0, 0, BIRD_SIZE / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Eye
      ctx.fillStyle = "#1a1a2e";
      ctx.beginPath();
      ctx.arc(BIRD_SIZE * 0.2, -BIRD_SIZE * 0.15, 3, 0, Math.PI * 2);
      ctx.fill();
      // Beak
      ctx.fillStyle = "#e58e26";
      ctx.beginPath();
      ctx.moveTo(BIRD_SIZE * 0.5, -BIRD_SIZE * 0.05);
      ctx.lineTo(BIRD_SIZE * 0.5 + 8, BIRD_SIZE * 0.1);
      ctx.lineTo(BIRD_SIZE * 0.5, BIRD_SIZE * 0.25);
      ctx.fill();
      ctx.restore();
    };

    const drawCoins = (now: number, gap: number) => {
      const w = st.width;
      const n = normalizedRef.current.length;
      const startS = Math.floor(posForScreenX(0)) - LEAD_IN_SEGMENTS - 1;
      const endS = Math.ceil(posForScreenX(w)) - LEAD_IN_SEGMENTS + 1;
      for (let s = Math.max(1, startS); s <= endS; s++) {
        if (!isCoinSegment(s) || st.collected.has(s)) continue;
        const worldCenter = s + LEAD_IN_SEGMENTS;
        const sx = BIRD_X + (worldCenter * SEGMENT_WIDTH - st.worldX);
        if (sx < -COIN_RADIUS || sx > w + COIN_RADIUS) continue;
        const localGap = n > 0 ? gapAtWorldPos(worldCenter) : gap;
        const cyc = centerYForT(centerlineAt(normalizedRef.current, s)) + coinOffset(s) * (localGap / 2);
        const spin = Math.abs(Math.cos(now / 220 + s));
        ctx.save();
        ctx.translate(sx, cyc);
        ctx.shadowColor = theme.glow;
        ctx.shadowBlur = 12;
        ctx.fillStyle = theme.accent;
        ctx.beginPath();
        ctx.ellipse(0, 0, COIN_RADIUS * (0.35 + 0.65 * spin), COIN_RADIUS, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.beginPath();
        ctx.ellipse(-COIN_RADIUS * 0.15 * spin, -COIN_RADIUS * 0.3, COIN_RADIUS * 0.18 * spin, COIN_RADIUS * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    };

    const drawWall = (top: boolean, gap: number) => {
      const w = st.width;
      const grad = ctx.createLinearGradient(0, top ? 0 : playBottom(), 0, top ? bandTop() : playBottom());
      grad.addColorStop(0, theme.accent);
      grad.addColorStop(1, theme.bgBottom);
      ctx.fillStyle = grad;
      ctx.beginPath();
      if (top) ctx.moveTo(0, 0);
      else ctx.moveTo(0, playBottom());
      for (let sx = 0; sx <= w; sx += COLUMN_STEP) {
        const cy = centerYForT(courseT(posForScreenX(sx)));
        ctx.lineTo(sx, top ? cy - gap / 2 : cy + gap / 2);
      }
      ctx.lineTo(w, top ? 0 : playBottom());
      ctx.closePath();
      ctx.fill();

      // Glowing inner edge
      ctx.strokeStyle = theme.glow;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = theme.glow;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      for (let sx = 0; sx <= w; sx += COLUMN_STEP) {
        const cy = centerYForT(courseT(posForScreenX(sx)));
        const y = top ? cy - gap / 2 : cy + gap / 2;
        if (sx === 0) ctx.moveTo(sx, y);
        else ctx.lineTo(sx, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    };

    const draw = (now: number) => {
      const w = st.width;
      const h = st.height;
      const gap = difficultyNow().gap;

      const sx = st.shake ? (Math.random() - 0.5) * st.shake : 0;
      const sy = st.shake ? (Math.random() - 0.5) * st.shake : 0;

      ctx.save();
      ctx.translate(sx, sy);

      // Background gradient (oversized so screen shake never reveals an edge)
      const bg = ctx.createLinearGradient(0, -20, 0, h + 20);
      bg.addColorStop(0, theme.bgTop);
      bg.addColorStop(1, theme.bgBottom);
      ctx.fillStyle = bg;
      ctx.fillRect(-30, -30, w + 60, h + 60);

      // Parallax stars
      for (const star of st.stars) {
        const x = ((star.x - st.worldX * star.factor) % w + w) % w;
        ctx.fillStyle = `rgba(255,255,255,${star.alpha})`;
        ctx.beginPath();
        ctx.arc(x, star.y, star.r, 0, Math.PI * 2);
        ctx.fill();
      }

      drawWall(true, gap);
      drawWall(false, gap);

      // Ground
      ctx.fillStyle = theme.bgBottom;
      ctx.fillRect(-30, playBottom(), w + 60, GROUND_HEIGHT + 30);
      ctx.fillStyle = theme.accent;
      ctx.fillRect(-30, playBottom(), w + 60, 3);

      drawCoins(now, gap);

      // Particles
      for (const p of st.particles) {
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Floaters
      for (const f of st.floaters) {
        ctx.globalAlpha = Math.max(0, f.life);
        ctx.fillStyle = f.color;
        ctx.font = "bold 16px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(f.text, f.x, f.y);
      }
      ctx.globalAlpha = 1;

      if (!st.gameOver) drawBird(now);

      ctx.restore();

      // ---- HUD (unaffected by screen shake) ----
      const flashScale = 1 + st.flashT * 0.25;
      ctx.textAlign = "center";
      ctx.fillStyle = `rgba(255,255,255,${0.85 + st.flashT * 0.15})`;
      ctx.font = `bold ${Math.round(30 * flashScale)}px sans-serif`;
      ctx.fillText(String(st.score), w / 2, 74);
      ctx.fillStyle = "#ffffff80";
      ctx.font = "13px sans-serif";
      ctx.fillText(`Best: ${st.best}`, w / 2, 96);

      // Combo pill
      if (st.combo >= 2 && !st.gameOver) {
        const mult = comboMultiplier(st.combo);
        ctx.fillStyle = theme.glow;
        ctx.font = "bold 15px sans-serif";
        ctx.fillText(`COMBO x${mult % 1 === 0 ? mult : mult.toFixed(1)}`, w / 2, 118);
      }

      // Coin label (left)
      ctx.textAlign = "left";
      ctx.fillStyle = theme.accent;
      ctx.font = "bold 13px sans-serif";
      const price = lastRef.current;
      ctx.fillText(`${coin}${price ? `  $${price.toLocaleString()}` : ""}`, 16, 74);

      // Start hint
      if (!st.started && !st.gameOver) {
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffffff";
        ctx.font = "800 30px sans-serif";
        ctx.fillText("ENGELAT", w / 2, h / 2 - 70);
        ctx.fillStyle = `rgba(255,255,255,${0.55 + Math.sin(now / 300) * 0.25})`;
        ctx.font = "bold 16px sans-serif";
        ctx.fillText("Tap · Click · Space", w / 2, h / 2 + 90);
        ctx.fillStyle = "#ffffff80";
        ctx.font = "12px sans-serif";
        ctx.fillText("Coin'leri topla, combo'yu büyüt", w / 2, h / 2 + 114);
      }

      // Death overlay
      if (st.gameOver) {
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(0, 0, w, h);
        ctx.textAlign = "center";
        ctx.fillStyle = "#fff";
        ctx.font = "800 36px sans-serif";
        ctx.fillText("GAME OVER", w / 2, h / 2 - 40);
        ctx.fillStyle = theme.glow;
        ctx.font = "bold 22px sans-serif";
        ctx.fillText(`${coin} · ${st.score}`, w / 2, h / 2 - 6);
        if (st.bestCombo >= 2) {
          ctx.fillStyle = "#ffffff99";
          ctx.font = "14px sans-serif";
          ctx.fillText(`Best combo x${comboMultiplier(st.bestCombo).toFixed(1)}`, w / 2, h / 2 + 18);
        }
      }
    };

    const loop = (now: number) => {
      if (st.lastT === 0) st.lastT = now;
      let frame = now - st.lastT;
      st.lastT = now;
      if (frame > MAX_FRAME_MS) frame = MAX_FRAME_MS;
      st.acc += frame;
      let guard = 0;
      while (st.acc >= STEP_MS && guard < 6) {
        stepPhysics();
        st.acc -= STEP_MS;
        guard++;
      }
      draw(now);
      st.rafId = requestAnimationFrame(loop);
    };

    st.best = getBestScore(coin);
    st.rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(st.rafId);
  }, [coin]);

  // Input
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        if (!stateRef.current.gameOver) flap();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [flap]);

  const handlePointerDown = useCallback(() => {
    if (!stateRef.current.gameOver) flap();
  }, [flap]);

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
        touchAction: "none",
      }}
      onPointerDown={handlePointerDown}
    >
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
      />
    </div>
  );
}
