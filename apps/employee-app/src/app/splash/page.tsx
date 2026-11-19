"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import {
  hasSeenSplashThisSession,
  isOnboardingComplete,
  markSplashSeenThisSession,
} from "@/lib/onboarding";

const SPLASH_MS = 3200;

function nextRoute(): string {
  if (!isOnboardingComplete()) return "/onboarding";
  if (isAuthenticated()) return "/home";
  return "/login";
}

export default function CinematicSplashPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Preparing your workspace...");

  useEffect(() => {
    if (hasSeenSplashThisSession()) {
      router.replace(nextRoute());
      return;
    }

    const readyTimer = window.setTimeout(() => {
      setStatus("Almost ready...");
    }, 2200);

    const navTimer = window.setTimeout(() => {
      markSplashSeenThisSession();
      router.replace(nextRoute());
    }, SPLASH_MS);

    return () => {
      window.clearTimeout(readyTimer);
      window.clearTimeout(navTimer);
    };
  }, [router]);

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center overflow-hidden bg-[#f8f9ff] text-[#0b1c30]">
      {/* Soft mesh background (Stitch shader → CSS) */}
      <div className="pointer-events-none absolute inset-0 opacity-70" aria-hidden>
        <div className="splash-blob absolute -left-16 top-10 h-72 w-72 rounded-full bg-[#2563eb]/20 blur-[90px]" />
        <div className="splash-blob-slow absolute -right-10 top-40 h-80 w-80 rounded-full bg-[#6366f1]/18 blur-[100px]" />
        <div className="splash-blob absolute bottom-24 left-1/3 h-64 w-64 rounded-full bg-[#7c3aed]/12 blur-[80px]" />
      </div>

      {/* Spacer — matches top breathing room without logo card */}
      <div className="h-12 shrink-0" aria-hidden />

      {/* Hero: objects only — soft edges so no “second screen” card */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center">
        <div className="splash-float relative w-[118%] max-w-none -mx-[9%]">
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 h-[70%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#2563eb]/12 blur-[90px]"
            aria-hidden
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/splash/cinematic-hero.png"
            alt="Employee Portal AI workspace"
            className="splash-hero-blend relative w-full select-none"
            draggable={false}
          />
        </div>
      </div>

      {/* Title + loading (second photo) */}
      <footer className="relative z-20 flex w-full shrink-0 flex-col items-center gap-4 px-5 pb-16">
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
        </div>
      </footer>
    </main>
  );
}
