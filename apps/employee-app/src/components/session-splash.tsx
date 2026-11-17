"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

const MIN_VISIBLE_MS = 500;
const FINISH_HOLD_MS = 120;
/** Never block forever if session verification hangs (API down / LAN proxy). */
const MAX_WAIT_MS = 5_000;

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

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setPct(100);
    window.setTimeout(onFinished, FINISH_HOLD_MS);
  }, [onFinished]);

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
          return Math.min(100, current + 8);
        }
        const cap = 92;
        if (current >= cap) return current;
        const step = current < 40 ? 2.2 : current < 70 ? 1.4 : 0.7;
        return Math.min(cap, Math.round((current + step) * 10) / 10);
      });
    }, 40);

    return () => window.clearInterval(id);
  }, [complete, reducedMotion]);

  useEffect(() => {
    if (finishedRef.current) return;
    const elapsed = Date.now() - mountedAt.current;
    if (!complete || pct < 100 || elapsed < MIN_VISIBLE_MS) return;
    finish();
  }, [complete, pct, finish]);

  // Hard fail-open — do not depend on me() or progress animation.
  useEffect(() => {
    const id = window.setTimeout(finish, MAX_WAIT_MS);
    return () => window.clearTimeout(id);
  }, [finish]);

  // When session is verified, snap progress and leave quickly.
  useEffect(() => {
    if (!complete) return;
    setPct(100);
    const elapsed = Date.now() - mountedAt.current;
    const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);
    const id = window.setTimeout(finish, wait + FINISH_HOLD_MS);
    return () => window.clearTimeout(id);
  }, [complete, finish]);

  const displayPct = Math.min(100, Math.max(1, Math.round(pct)));
  const status = statusForProgress(displayPct, complete);

  return (
    <main
      className="relative flex h-dvh max-h-dvh w-full flex-col items-center justify-center overflow-hidden bg-[#F7F9FF] text-[#0b1c30]"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={100}
      aria-valuenow={displayPct}
      aria-label={`Cache HRMS — ${status}, ${displayPct} percent`}
      onClick={finish}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") finish();
      }}
      tabIndex={0}
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(255,255,255,0.95)_0%,rgba(237,242,255,0.55)_48%,rgba(226,232,255,0.9)_100%)]" />
        <div className="splash-blob absolute -left-20 top-8 h-80 w-80 rounded-full bg-[#60A5FA]/25 blur-[100px]" />
        <div className="splash-blob-slow absolute -right-16 top-28 h-96 w-96 rounded-full bg-[#818CF8]/22 blur-[110px]" />
        <div className="splash-blob absolute bottom-16 left-[28%] h-72 w-72 rounded-full bg-[#A78BFA]/18 blur-[90px]" />
        <div className="absolute inset-x-0 bottom-0 h-[38%] bg-gradient-to-t from-[#E8F1FF]/90 via-[#F3F6FF]/40 to-transparent" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-[18rem] flex-col items-center px-6 animate-[fade-up_0.5s_ease_both]">
        <div className="relative mb-8 flex h-[13.5rem] w-[13.5rem] shrink-0 items-center justify-center">
          <div
            className="absolute inset-0 rounded-full border border-[#C7D2FE]/55"
            style={{
              boxShadow:
                "0 0 0 1px rgba(165,180,252,0.2), 0 0 36px rgba(99,102,241,0.1)",
            }}
            aria-hidden
          />
          {!reducedMotion ? (
            <div className="splash-orbit absolute inset-0" aria-hidden>
              <span className="absolute left-1/2 top-0 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-gradient-to-br from-[#818CF8] to-[#6366F1] shadow-[0_0_10px_rgba(99,102,241,0.75)]" />
            </div>
          ) : null}

          <div className="relative z-[1] w-[12.5rem]">
            <Image
              src="/brand/cache-logo-splash.png"
              alt="CACHE"
              width={1969}
              height={793}
              priority
              unoptimized
              className="h-auto w-full object-contain"
            />
          </div>
        </div>

        <p className="w-full text-center text-[17px] font-semibold tracking-tight text-[#0B1C30]">
          Securing your session…
        </p>
        <p className="mt-1.5 w-full text-center text-[13px] text-[#64748B]">
          {status}
        </p>

        <div className="mt-10 w-full">
          <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-[#E2E8F5]/95 shadow-inner ring-1 ring-[#C7D2FE]/40">
            <div
              className="relative h-full rounded-full bg-gradient-to-r from-[#2563EB] via-[#4F46E5] to-[#7C3AED] shadow-[0_0_14px_rgba(79,70,229,0.4)] transition-[width] duration-150 ease-out"
              style={{ width: `${displayPct}%` }}
            >
              <div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-80"
                aria-hidden
              />
            </div>
          </div>
          <p className="mt-2.5 w-full text-center text-[13px] font-semibold tabular-nums text-[#4F46E5]">
            {displayPct}%
          </p>
          <p className="mt-1 w-full text-center text-[11px] text-[#94A3B8]">
            Tap to continue
          </p>
        </div>
      </div>
    </main>
  );
}
