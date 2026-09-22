"use client";

import Lenis from "lenis";
import { useEffect, useRef, useState, type RefObject } from "react";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Lenis smooth scroll for the landing page only.
 *
 * Lenis drives the real document scroll, so native `scroll` events still fire
 * and every `getBoundingClientRect()` driver below keeps working unchanged.
 */
export function useLenis(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      duration: 1.75,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.4,
      autoRaf: true,
    });

    return () => lenis.destroy();
  }, [enabled]);
}

/**
 * Scroll driver for the landing page.
 *
 * Framer's runtime is not used here — every scroll effect reads
 * `getBoundingClientRect()` on a rAF-throttled scroll listener so the motion
 * survives builds, deploys, and asset changes.
 */

/**
 * 0–1 progress across a tall pinned section: 0 when its top reaches the
 * viewport top, 1 when its bottom leaves. Every pinned section on the page
 * (hero, slider, solution, numbers) is driven by this.
 */
export function usePinProgress(ref: RefObject<HTMLElement | null>) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    const measure = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;

      // Short sections (mobile breakpoints unpin them) have no pin travel, so
      // track them entering the viewport instead of snapping 0 to 1.
      if (rect.height <= vh + 1) {
        const span = Math.max(rect.height * 0.6, 1);
        setProgress(clamp01((vh * 0.85 - rect.top) / span));
        return;
      }

      const travel = Math.max(rect.height - vh, 1);
      setProgress(Math.min(travel, Math.max(0, -rect.top)) / travel);
    };

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref]);

  return progress;
}

/** One-shot entrance flag for fade/rise reveals. */
export function useInView<T extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  return { ref, inView };
}

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduced;
}
