import { useEffect, useRef } from 'react';

const COLORS = ['#D9A441', '#E8B45C', '#F7E6B8', '#FF7A18', '#D94A2B', '#8A2F14'];

interface Piece {
  x: number;
  y: number;
  w: number;
  h: number;
  vy: number;
  vx: number;
  rot: number;
  vr: number;
  color: string;
  opacity: number;
  targetOpacity: number;
  sway: number;
  swaySpeed: number;
  swayPhase: number;
  life: number;
  maxLife: number;
}

export function Confetti({ onDone }: { onDone?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = (canvas.width = window.innerWidth);
    const height = (canvas.height = window.innerHeight);

    const pieces: Piece[] = [];

    const spawn = (fromCenter: boolean): Piece => {
      const w = 7 + Math.random() * 9;
      const h = 4 + Math.random() * 7;
      return {
        x: fromCenter ? width / 2 + (Math.random() - 0.5) * 140 : Math.random() * width,
        y: fromCenter ? height * 0.38 + (Math.random() - 0.5) * 70 : -20 - Math.random() * height * 0.25,
        w,
        h,
        vy: fromCenter ? 2.2 + Math.random() * 2.2 : 1.5 + Math.random() * 3.2,
        vx: (Math.random() - 0.5) * (fromCenter ? 4 : 1.6),
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.22,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        opacity: 0,
        targetOpacity: 0.5 + Math.random() * 0.5,
        sway: Math.random() * 2 + 0.6,
        swaySpeed: 0.02 + Math.random() * 0.03,
        swayPhase: Math.random() * Math.PI * 2,
        life: 0,
        maxLife: 230 + Math.random() * 150,
      };
    };

    const centerCount = 90;
    for (let i = 0; i < centerCount; i++) pieces.push(spawn(true));
    for (let i = 0; i < 80; i++) pieces.push(spawn(false));
    for (let i = 0; i < 60; i++) pieces.push(spawn(false));

    let raf = 0;
    const start = performance.now();
    let last = start;
    let doneCalled = false;

    const finish = () => {
      if (doneCalled) return;
      doneCalled = true;
      onDoneRef.current?.();
    };

    const tick = (now: number) => {
      const dt = Math.min(32, now - last) / 16.7;
      last = now;
      const elapsed = now - start;

      ctx.clearRect(0, 0, width, height);

      let alive = 0;

      for (const p of pieces) {
        p.life += dt;
        const lifeFadeIn = Math.min(1, p.life / 12);
        const lifeFadeOut = p.life > p.maxLife - 50 ? Math.max(0, (p.maxLife - p.life) / 50) : 1;
        p.opacity = p.targetOpacity * lifeFadeIn * lifeFadeOut;

        if (p.opacity <= 0.01 || p.y > height + 40) {
          continue;
        }

        alive++;
        p.swayPhase += p.swaySpeed * dt;
        p.vy += 0.045 * dt;
        p.x += p.vx * dt + Math.sin(p.swayPhase) * p.sway * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;

        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      const stillSpawning = elapsed < 900 && pieces.some((p) => p.life < 1);
      if (alive > 0 || stillSpawning) {
        raf = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, width, height);
        finish();
      }
    };

    raf = requestAnimationFrame(tick);

    const onResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[99990]"
      style={{ width: '100%', height: '100%' }}
      aria-hidden
    />
  );
}