"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MIN_VISIBLE_MS = 700;
const FINISH_HOLD_MS = 260;

function statusForProgress(pct: number, complete: boolean): string {
  if (pct >= 100) return "Welcome back";
  if (complete) return "Finishing up…";
  if (pct >= 75) return "Verifying security";
  if (pct >= 45) return "Loading your profile";
  if (pct >= 18) return "Checking session";
  return "Connecting securely";
}

export function SessionSplash({
  complete,
  onFinished,
}: {
  complete: boolean;
  onFinished: () => void;
}) {
  const [pct, setPct] = useState(1);
  const [reducedMotion, setReducedMotion] = useState(false);
  const mountedAt = useRef(Date.now());
  const finishedRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      if (complete) setPct(100);
      return;
    }

    const id = window.setInterval(() => {
      setPct((current) => {
        if (complete) {
          if (current >= 100) return 100;
          const bump = current < 95 ? 4 : 2;
          return Math.min(100, current + bump);
        }
        const cap = 92;
        if (current >= cap) return current;
        const step = current < 40 ? 1.8 : current < 70 ? 1.1 : 0.55;
        return Math.min(cap, Math.round((current + step) * 10) / 10);
      });
    }, 45);

    return () => window.clearInterval(id);
  }, [complete, reducedMotion]);

  const tryFinish = useCallback(() => {
    if (finishedRef.current) return;
    const elapsed = Date.now() - mountedAt.current;
    if (!complete || pct < 100 || elapsed < MIN_VISIBLE_MS) return;
    finishedRef.current = true;
    window.setTimeout(onFinished, FINISH_HOLD_MS);
  }, [complete, onFinished, pct]);

  useEffect(() => {
    tryFinish();
  }, [tryFinish]);

  const displayPct = Math.min(100, Math.max(1, Math.round(pct)));
  const status = statusForProgress(displayPct, complete);

  return (
    <main
      className="relative flex h-dvh max-h-dvh w-full flex-col items-center justify-center overflow-hidden bg-[#f8f9ff] text-[#0b1c30] touch-none"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={100}
      aria-valuenow={displayPct}
      aria-label={`${status}, ${displayPct} percent`}
    >
      <div className="pointer-events-none absolute inset-0 opacity-70" aria-hidden>
        <div className="splash-blob absolute -left-16 top-10 h-72 w-72 rounded-full bg-[#2563eb]/20 blur-[90px]" />
        <div className="splash-blob-slow absolute -right-10 top-40 h-80 w-80 rounded-full bg-[#6366f1]/18 blur-[100px]" />
        <div className="splash-blob absolute bottom-24 left-1/3 h-64 w-64 rounded-full bg-[#7c3aed]/12 blur-[80px]" />
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-2/5 bg-gradient-to-t from-[#f8f9ff] to-transparent"
        aria-hidden
      />

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center px-8 animate-[fade-up_0.5s_ease_both]">
        <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/60 bg-white/80 shadow-[0_8px_32px_rgba(37,99,235,0.12)] backdrop-blur-xl">
          <span className="text-2xl font-bold tracking-tight text-[#004ac6]">ESS</span>
        </div>

        <h1 className="text-center text-[1.35rem] font-bold tracking-tight text-[#0b1c30] sm:text-[1.5rem]">
          Securing your session
        </h1>
        <p className="mt-2 text-center text-sm text-[#434655]/85">{status}</p>

        <div className="mt-10 w-full">
          <div className="relative h-2.5 overflow-hidden rounded-full bg-[#dce9ff]/90 shadow-inner ring-1 ring-[#c3c6d7]/25">
            <div
              className="relative h-full rounded-full bg-gradient-to-r from-[#2563eb] via-[#4f46e5] to-[#712ae2] shadow-[0_0_12px_rgba(37,99,235,0.45)] transition-[width] duration-150 ease-out"
              style={{ width: `${displayPct}%` }}
            >
              <div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/35 to-transparent opacity-80"
                aria-hidden
              />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.12em] text-[#434655]/70">
            <span>Loading</span>
            <span className="tabular-nums text-[#004ac6]">{displayPct}%</span>
          </div>
        </div>
      </div>
    </main>
  );
}
