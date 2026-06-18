"use client";

import { useEffect, useRef } from "react";

/** Self-contained canvas confetti burst (no deps). Fires once on mount when `fire` is true. */
export function Confetti({ fire }: { fire: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!fire) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
    };
    resize();

    const colors = ["#f5b301", "#ff5e5b", "#3ddc97", "#4d96ff", "#ff8fab", "#ffd166", "#c77dff"];
    const parts = Array.from({ length: 180 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * -canvas.height,
      r: (5 + Math.random() * 8) * dpr,
      c: colors[Math.floor(Math.random() * colors.length)]!,
      vx: (Math.random() - 0.5) * 3 * dpr,
      vy: (2.5 + Math.random() * 4) * dpr,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
    }));

    const start = performance.now();
    const DURATION = 3800;
    let raf = 0;
    const tick = (t: number) => {
      const elapsed = t - start;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = elapsed > DURATION - 900 ? Math.max(0, (DURATION - elapsed) / 900) : 1;
      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05 * dpr;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6);
        ctx.restore();
      }
      if (elapsed < DURATION) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    raf = requestAnimationFrame(tick);
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [fire]);

  if (!fire) return null;
  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-50 h-screen w-screen" />;
}
