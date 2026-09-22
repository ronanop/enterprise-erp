"use client";

/**
 * Canvas particle text — port of Framer ParticleText
 * (https://framer.com/m/ParticleText-2NZQ.js@otOSwmqP2acS2BjTve4l)
 *
 * Samples glyph pixels into dots; mouse pushes them away and they spring back.
 */

import { useEffect, useRef, type CSSProperties } from "react";

type Particle = {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  vx: number;
  vy: number;
};

export type ParticleTextProps = {
  text: string;
  className?: string;
  style?: CSSProperties;
  /** Static label when reduced motion / no canvas. */
  staticFallback?: boolean;
  particleColor?: string;
  particleSize?: number;
  /** Lower = denser. */
  particleDensity?: number;
  mouseRadius?: number;
  returnSpeed?: number;
  align?: "left" | "center" | "right";
  fontSizePx?: number;
  fontWeight?: string | number;
  fontFamily?: string;
  letterSpacing?: string;
};

export function ParticleText({
  text,
  className,
  style,
  staticFallback = false,
  particleColor = "#ffffff",
  particleSize = 1.6,
  particleDensity = 3,
  mouseRadius = 90,
  returnSpeed = 0.06,
  align = "center",
  fontSizePx,
  fontWeight = 500,
  fontFamily = "var(--font-jakarta-sans), system-ui, sans-serif",
  letterSpacing = "-0.03em",
}: ParticleTextProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const rafRef = useRef<number>(0);
  const readyRef = useRef(false);

  useEffect(() => {
    if (staticFallback) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    let cancelled = false;

    const build = () => {
      if (cancelled) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const cssW = Math.max(1, rect.width);
      const cssH = Math.max(1, rect.height);

      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);

      const size =
        fontSizePx ??
        Math.max(18, Math.min(cssH * 0.72, cssW / Math.max(text.length * 0.62, 1)));

      ctx.fillStyle = particleColor;
      ctx.textAlign = align;
      ctx.textBaseline = "middle";
      ctx.font = `${fontWeight} ${size}px ${fontFamily}`;
      try {
        (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing =
          letterSpacing;
      } catch {
        /* letterSpacing unsupported */
      }

      const textX =
        align === "left" ? size * 0.12 : align === "right" ? cssW - size * 0.12 : cssW / 2;
      const textY = cssH / 2;
      ctx.fillText(text, textX, textY);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;
      const gap = Math.max(2, particleDensity) * dpr;
      const next: Particle[] = [];

      for (let y = 0; y < canvas.height; y += gap) {
        for (let x = 0; x < canvas.width; x += gap) {
          const i = (y * canvas.width + x) * 4;
          if ((pixels[i + 3] ?? 0) > 128) {
            const px = x / dpr;
            const py = y / dpr;
            next.push({ x: px, y: py, baseX: px, baseY: py, vx: 0, vy: 0 });
          }
        }
      }

      particlesRef.current = next;
      readyRef.current = true;
      ctx.clearRect(0, 0, cssW, cssH);
    };

    build();

    const ro = new ResizeObserver(() => {
      readyRef.current = false;
      build();
    });
    ro.observe(canvas);

    const animate = () => {
      if (cancelled) return;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      ctx.clearRect(0, 0, w, h);

      if (readyRef.current) {
        const mouse = mouseRef.current;
        const particles = particlesRef.current;
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i]!;
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const distance = Math.hypot(dx, dy);

          if (distance < mouseRadius && distance > 0.001) {
            const force = (mouseRadius - distance) / mouseRadius;
            const angle = Math.atan2(dy, dx);
            p.vx -= Math.cos(angle) * force * 2;
            p.vy -= Math.sin(angle) * force * 2;
          }

          p.vx += (p.baseX - p.x) * returnSpeed;
          p.vy += (p.baseY - p.y) * returnSpeed;
          p.vx *= 0.95;
          p.vy *= 0.95;
          p.x += p.vx;
          p.y += p.vy;

          ctx.fillStyle = particleColor;
          ctx.beginPath();
          ctx.arc(p.x, p.y, particleSize, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelled = true;
      ro.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, [
    staticFallback,
    text,
    particleColor,
    particleSize,
    particleDensity,
    mouseRadius,
    returnSpeed,
    align,
    fontSizePx,
    fontWeight,
    fontFamily,
    letterSpacing,
  ]);

  if (staticFallback) {
    return (
      <span className={className} style={style} aria-hidden>
        {text}
      </span>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={style}
      aria-hidden
      onPointerMove={(e) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        mouseRef.current = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        };
      }}
      onPointerLeave={() => {
        mouseRef.current = { x: -1000, y: -1000 };
      }}
    />
  );
}
