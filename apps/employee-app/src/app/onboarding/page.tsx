"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  IconCalendar,
  IconChevronRight,
  IconSparkle,
  IconUser,
  IconWallet,
} from "@/components/icons";
import { isAuthenticated } from "@/lib/auth";
import {
  isOnboardingComplete,
  markOnboardingComplete,
} from "@/lib/onboarding";
import * as ui from "@/theme/classes";

type Step = {
  id: string;
  title: ReactNode;
  body: string;
  image: string;
  imageAlt: string;
  cta: string;
};

const STEPS: Step[] = [
  {
    id: "welcome",
    title: (
      <>
        Welcome to <span className="text-[#004ac6]">Employee Portal AI</span>
      </>
    ),
    body: "Manage your work life effortlessly with intelligent automation and refined insights.",
    image: "/onboarding/welcome.png",
    imageAlt: "Modern AI workplace illustration",
    cta: "Next",
  },
  {
    id: "features",
    title: "Everything in One Place",
    body: "Leaves, salary, documents, meetings, and tasks—all together.",
    image: "/onboarding/features.png",
    imageAlt: "Floating premium feature cards",
    cta: "Next",
  },
  {
    id: "attendance",
    title: "Attendance Made Easy",
    body: "Check in, check out, and track work hours with one tap.",
    image: "/onboarding/attendance.png",
    imageAlt: "Smartphone attendance check-in",
    cta: "Next",
  },
  {
    id: "ai",
    title: "Your AI Workplace Assistant",
    body: "Ask for leave, download payslips, check attendance, or find documents using natural language.",
    image: "/onboarding/ai-assistant.png",
    imageAlt: "AI workplace assistant",
    cta: "Get Started",
  },
];

function ProgressDots({ index, total }: { index: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2" aria-hidden>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i === index
              ? "w-8 bg-[#004ac6]"
              : "w-1.5 bg-[#c3c6d7]"
          }`}
        />
      ))}
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  useEffect(() => {
    if (isOnboardingComplete()) {
      router.replace(isAuthenticated() ? "/home" : "/login");
      return;
    }
    setReady(true);
  }, [router]);

  const finish = useCallback(() => {
    markOnboardingComplete();
    router.replace("/login");
  }, [router]);

  const next = useCallback(() => {
    if (isLast) {
      finish();
      return;
    }
    setIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }, [finish, isLast]);

  if (!ready) {
    return (
      <main className={`${ui.shell} flex min-h-dvh items-center justify-center`}>
        <p className={`text-sm ${ui.muted}`}>Loading…</p>
      </main>
    );
  }

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col overflow-hidden bg-white text-[#0b1c30]">
      <div
        className="pointer-events-none absolute -right-[20%] -top-[10%] h-[300px] w-[300px] rounded-full bg-[#2563eb]/10 blur-[100px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-[5%] -left-[10%] h-[250px] w-[250px] rounded-full bg-[#712ae2]/10 blur-[80px]"
        aria-hidden
      />

      {/* Skip */}
      <div className="relative z-10 flex w-full justify-end px-5 pt-12">
        <button
          type="button"
          onClick={finish}
          className="rounded-full px-4 py-2 text-sm font-medium text-[#434655] transition hover:text-[#004ac6] active:scale-95"
        >
          Skip
        </button>
      </div>

      {/* Visual */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-5">
        <div className="relative mb-8 w-full max-w-sm">
          <div className="splash-float relative aspect-[4/5] overflow-hidden rounded-[32px] shadow-[0_24px_48px_rgba(37,99,235,0.12)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={step.image}
              src={step.image}
              alt={step.imageAlt}
              className="h-full w-full object-cover animate-[fade-up_0.45s_ease_both]"
            />
          </div>

          {step.id === "features" && (
            <>
              <div className="absolute -right-1 -top-3 rounded-xl border border-white/40 bg-white/80 p-3 shadow-lg backdrop-blur-md">
                <IconWallet size={22} className="text-[#004ac6]" />
              </div>
              <div className="absolute left-0 top-1/2 -translate-x-2 rounded-xl border border-white/40 bg-white/80 p-3 shadow-lg backdrop-blur-md">
                <IconCalendar size={22} className="text-[#712ae2]" />
              </div>
              <div className="absolute -right-2 bottom-10 rounded-xl border border-white/40 bg-white/80 p-3 shadow-lg backdrop-blur-md">
                <IconSparkle size={22} className="text-[#006242]" />
              </div>
            </>
          )}

          {step.id === "ai" && (
            <>
              <div className="absolute left-0 top-[8%] -rotate-6 rounded-full border border-white/40 bg-white/85 px-3 py-2 shadow-lg backdrop-blur-md">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-[#0b1c30]">
                  <IconCalendar size={16} className="text-[#004ac6]" />
                  Apply for leave
                </span>
              </div>
              <div className="absolute right-0 top-[22%] rotate-3 rounded-full border border-white/40 bg-white/85 px-3 py-2 shadow-lg backdrop-blur-md">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-[#0b1c30]">
                  <IconWallet size={16} className="text-[#712ae2]" />
                  Download payslip
                </span>
              </div>
              <div className="absolute bottom-[18%] left-4 -rotate-2 rounded-full border border-white/40 bg-white/85 px-3 py-2 shadow-lg backdrop-blur-md">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-[#0b1c30]">
                  <IconUser size={16} className="text-[#006242]" />
                  Update profile
                </span>
              </div>
            </>
          )}
        </div>

        <div className="space-y-3 text-center animate-[fade-up_0.4s_ease_both]" key={step.id}>
          <h1 className="text-[1.75rem] font-bold leading-[1.2] tracking-tight">
            {step.title}
          </h1>
          <p className="mx-auto max-w-[280px] text-base leading-relaxed text-[#434655]">
            {step.body}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 w-full px-5 pb-12">
        <div className="flex flex-col items-center gap-6">
          <ProgressDots index={index} total={STEPS.length} />

          {isLast ? (
            <button type="button" onClick={next} className={`${ui.btn} w-full py-4`}>
              {step.cta}
              <IconChevronRight size={18} />
            </button>
          ) : step.id === "welcome" ? (
            <button type="button" onClick={next} className={`${ui.btn} w-full py-4`}>
              {step.cta}
              <IconChevronRight size={18} />
            </button>
          ) : (
            <div className="flex w-full items-center justify-between gap-4">
              <button
                type="button"
                onClick={finish}
                className="px-4 py-2 text-sm font-medium text-[#737686] transition hover:text-[#0b1c30] active:scale-95"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={next}
                className={`${ui.btn} px-8 py-4`}
              >
                {step.cta}
                <IconChevronRight size={18} />
              </button>
            </div>
          )}

          {!isLast && step.id === "welcome" && (
            <p className="text-xs font-semibold text-[#737686]">
              {index + 1} of {STEPS.length}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
