"use client";

import { useEffect, useRef, useState } from "react";
import { isAuthenticated } from "@/lib/auth";
import {
  hasSeenSplashThisSession,
  isOnboardingComplete,
  markSplashSeenThisSession,
} from "@/lib/onboarding";

const SPLASH_MS = 2200;

function nextRoute(): string {
  if (!isOnboardingComplete()) return "/onboarding";
  if (isAuthenticated()) return "/home";
  return "/login";
}

export default function CinematicSplashPage() {
  const [status, setStatus] = useState("Preparing your workspace...");
  const navigatedRef = useRef(false);

  function goNext() {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    markSplashSeenThisSession();
    // Hard navigation — App Router soft replace can hang when LAN HMR is blocked.
    window.location.replace(nextRoute());
  }

  useEffect(() => {
    if (hasSeenSplashThisSession()) {
      goNext();
      return;
    }

    const readyTimer = window.setTimeout(() => {
      setStatus("Almost ready...");
    }, 1200);

    const navTimer = window.setTimeout(goNext, SPLASH_MS);
    const hardTimer = window.setTimeout(goNext, SPLASH_MS + 2000);

    return () => {
      window.clearTimeout(readyTimer);
      window.clearTimeout(navTimer);
      window.clearTimeout(hardTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only splash
  }, []);

  return (
    <main
      className="relative flex h-dvh max-h-dvh w-full max-w-lg flex-col items-center overflow-hidden bg-[#f8f9ff] text-[#0b1c30]"
      onClick={goNext}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") goNext();
      }}
      role="button"
      tabIndex={0}
      aria-label="Continue"
    >
      <div className="pointer-events-none absolute inset-0 opacity-70" aria-hidden>
        <div className="splash-blob absolute -left-16 top-10 h-72 w-72 rounded-full bg-[#2563eb]/20 blur-[90px]" />
        <div className="splash-blob-slow absolute -right-10 top-40 h-80 w-80 rounded-full bg-[#6366f1]/18 blur-[100px]" />
        <div className="splash-blob absolute bottom-24 left-1/3 h-64 w-64 rounded-full bg-[#7c3aed]/12 blur-[80px]" />
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-1/3 bg-gradient-to-t from-[#f8f9ff] to-transparent"
        aria-hidden
      />

      <div className="h-6 shrink-0 sm:h-8" aria-hidden />

      <div className="relative z-10 flex min-h-0 w-full flex-1 flex-col items-center justify-center overflow-hidden px-2">
        <div className="splash-float relative flex h-full max-h-[min(64dvh,100%)] w-[112%] max-w-none items-center justify-center">
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 h-[70%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#2563eb]/12 blur-[90px]"
            aria-hidden
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/splash/cinematic-hero.png"
            alt="Employee Portal AI workspace"
            className="splash-hero-blend relative max-h-full max-w-full scale-[1.18] select-none object-contain object-center sm:scale-[1.22]"
            draggable={false}
          />
        </div>
      </div>

      <footer className="relative z-20 flex w-full shrink-0 flex-col items-center gap-3 px-5 pb-10 pt-1 sm:pb-12">
        <div className="animate-[fade-up_0.9s_ease_both] text-center [animation-delay:120ms]">
          <h1 className="text-[1.75rem] font-bold leading-[1.2] tracking-tight text-[#0b1c30] sm:text-[2rem]">
            Employee Portal AI
          </h1>
          <p className="mt-2 text-base text-[#434655]/80">Everything for Work</p>
        </div>

        <div className="mt-4 animate-[fade-up_1s_ease_both] [animation-delay:280ms]">
          <div className="flex items-center gap-3 rounded-full border border-white/50 bg-white/75 px-6 py-3 shadow-lg backdrop-blur-xl">
            <span className="splash-pulse h-3 w-3 rounded-full bg-[#2563eb]" />
            <span className="text-sm font-medium tracking-wide text-[#0b1c30]">
              {status}
            </span>
          </div>
          <p className="mt-3 text-center text-xs text-[#64748B]">Tap to continue</p>
        </div>
      </footer>
    </main>
  );
}
