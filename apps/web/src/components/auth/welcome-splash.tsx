"use client";

import { useEffect, useRef, useState } from "react";
import { DotLottieReact, type DotLottie } from "@lottiefiles/dotlottie-react";

const APPLE_TYPE =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif';

const HOLD_MS = 3800;
const EXIT_MS = 480;

type WelcomeSplashProps = {
  userName: string;
  onComplete: () => void;
};

/**
 * Post–Microsoft-login welcome — “hi” Lottie + name + Connect Plus.
 * Apple.com-style type; Lottie already says hi, so no Hello! copy.
 */
export function WelcomeSplash({ userName, onComplete }: WelcomeSplashProps) {
  const [exiting, setExiting] = useState(false);
  const [lottieFailed, setLottieFailed] = useState(false);
  const onCompleteRef = useRef(onComplete);
  const lottieLoadedRef = useRef(false);
  onCompleteRef.current = onComplete;

  const displayName = userName.trim() || "there";

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hold = reduced ? 1400 : HOLD_MS;
    const exit = reduced ? 0 : EXIT_MS;

    const exitTimer = window.setTimeout(() => setExiting(true), hold);
    const doneTimer = window.setTimeout(() => onCompleteRef.current(), hold + exit);
    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(doneTimer);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!lottieLoadedRef.current) setLottieFailed(true);
    }, 2500);
    return () => window.clearTimeout(timer);
  }, []);

  const bindLottie = (instance: DotLottie | null) => {
    if (!instance) return;
    instance.addEventListener("load", () => {
      lottieLoadedRef.current = true;
      setLottieFailed(false);
    });
    instance.addEventListener("loadError", () => {
      setLottieFailed(true);
    });
  };

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={`${displayName}. Welcome to Connect Plus`}
      className="fixed inset-0 z-[9999] flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[#f5f5f7] px-6"
      style={{
        fontFamily: APPLE_TYPE,
        opacity: exiting ? 0 : 1,
        transition: "opacity 480ms ease",
      }}
      data-testid="welcome-splash"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, #ffffff 0%, #f5f5f7 58%, #ebebef 100%)",
        }}
      />

      <style>{`
        @keyframes cp-welcome-rise {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes cp-welcome-scale {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
        .cp-welcome-rise {
          animation: cp-welcome-rise 650ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .cp-welcome-scale {
          animation: cp-welcome-scale 650ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .cp-welcome-rise,
          .cp-welcome-scale {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>

      {/* Tight vertical stack: Lottie → name → welcome */}
      <div className="relative flex w-full max-w-lg flex-col items-center text-center">
        <div className="cp-welcome-scale flex size-[120px] items-center justify-center sm:size-[140px]">
          {lottieFailed ? (
            <div
              aria-hidden
              className="flex size-20 items-center justify-center rounded-full bg-[#1d1d1f] text-2xl font-semibold tracking-tight text-white"
            >
              hi
            </div>
          ) : (
            <DotLottieReact
              src="/animations/hello.lottie"
              autoplay
              loop
              style={{ width: "100%", height: "100%" }}
              dotLottieRefCallback={bindLottie}
            />
          )}
        </div>

        <h1
          className="cp-welcome-rise mt-2 text-[2rem] font-semibold leading-[1.1] tracking-[-0.04em] text-[#1d1d1f] sm:mt-2.5 sm:text-[2.75rem]"
          style={{ animationDelay: "140ms" }}
        >
          {displayName}
        </h1>

        <p
          className="cp-welcome-rise mt-2 text-[1.0625rem] font-normal leading-snug tracking-[-0.02em] text-[#6e6e73] sm:mt-2.5 sm:text-[1.25rem]"
          style={{ animationDelay: "260ms" }}
        >
          Welcome to Connect Plus
        </p>
      </div>
    </div>
  );
}
