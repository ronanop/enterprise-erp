"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Bell,
  Bot,
  ChevronDown,
  LayoutDashboard,
  Menu,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";

import { AccessCodeDialog } from "@/components/landing/access-code-dialog";

const NAV = [
  { label: "About", href: "#about" },
  { label: "Features", href: "#features" },
  { label: "FAQ", href: "#faq" },
] as const;

const AI_REPORT = [
  {
    title: "AI System Report",
    body: "Surface stalled approvals, repeat handoffs, and ops lag across modules — before they become backlog.",
  },
  {
    title: "Efficiency Analytics",
    body: "See where cycle time and resource use break down across finance, CRM, HR, and GRC.",
  },
  {
    title: "AI Insight Cards",
    body: "Pattern checks suggest blueprint and policy tweaks that raise throughput without losing control.",
  },
] as const;

const TRACK = [
  {
    n: "01",
    title: "Tracking",
    body: "Live operational status across deals, journals, tickets, and assets — one identity graph.",
    icon: TrendingUp,
  },
  {
    n: "02",
    title: "Dashboard",
    body: "Dense, Swiss-minimal workspaces built for operators — not vanity marketing charts.",
    icon: LayoutDashboard,
  },
  {
    n: "03",
    title: "Alerts",
    body: "Workflow and notification engines push the next allowed action to the right person.",
    icon: Bell,
  },
] as const;

const PERFORMANCE = [
  {
    title: "Smarter decisions",
    body: "AI copilots sit inside live transactions — suggest next steps with a full audit trail.",
    icon: Sparkles,
  },
  {
    title: "Faster operations",
    body: "Blueprint-gated sales and shared approvals cut rework across departments.",
    icon: Zap,
  },
  {
    title: "Fewer errors",
    body: "RBAC, soft-delete, version columns, and policy checks before money or risk moves.",
    icon: ShieldCheck,
  },
] as const;

const STATS = [
  {
    value: "12+",
    label: "Modules, one stack",
    detail: "Finance, CRM, GRC, HR, assets, and more share identity, workflow, and audit.",
  },
  {
    value: "−42%",
    label: "Quote-to-close cycle",
    detail: "Gated sales blueprints remove stalled approvals and spreadsheet shadow work.",
  },
  {
    value: "100%",
    label: "Tenant isolation",
    detail: "UUID keys, company scope, and audit columns on every business table.",
  },
] as const;

const FAQ = [
  {
    q: "How does Connect Plus automate workflows?",
    a: "State machines and gates encode your operating system. Approvals, notifications, and AI suggestions run on the same blueprint — not a bolted-on chatbot.",
  },
  {
    q: "Can it connect with tools we already use?",
    a: "Yes. Modules share one tenant graph and integrate with identity (Microsoft Entra), email, and your existing finance / CRM / HR processes without forcing a rip-and-replace.",
  },
  {
    q: "Is our data secure?",
    a: "Tenant and company isolation, RBAC, soft-delete, and versioned records are defaults. Only authorized roles see what they are scoped to.",
  },
  {
    q: "How fast can we go live?",
    a: "Discovery workshops map your real process, then we configure blueprints and roll out module by module — starting with the path that unlocks the most value.",
  },
  {
    q: "Do teams need deep tech skills?",
    a: "Operators work in purpose-built screens. Admins configure roles and modules. Custom modules are engineered with you — not left as a vendor backlog.",
  },
] as const;

const MARQUEE = [
  "Finance",
  "CRM",
  "GRC",
  "HR",
  "Assets",
  "Procurement",
  "Projects",
  "Documents",
  "AI Assistant",
  "Workflow",
] as const;

function BrandMark({ light = false }: { light?: boolean }) {
  return (
    <Link
      href="/"
      className="group flex cursor-pointer items-center gap-2.5 transition-opacity duration-200 hover:opacity-90"
    >
      <span className="relative flex size-8 items-center justify-center overflow-hidden rounded-xl bg-white shadow-[0_6px_16px_-6px_rgba(0,0,0,0.18)] ring-1 ring-black/5 transition-transform duration-200 group-hover:scale-[1.03]">
        <Image
          src="/brand/iconnect-plus-logo.png"
          alt=""
          width={32}
          height={32}
          className="size-full object-contain p-[12%]"
          aria-hidden
          priority
        />
      </span>
      <span
        className={`font-[family-name:var(--font-icp-display),sans-serif] text-[1.05rem] font-bold tracking-[-0.03em] ${
          light ? "text-white" : "text-white"
        }`}
      >
        iConnect Plus
      </span>
    </Link>
  );
}

function PillButton({
  children,
  onClick,
  href,
  variant = "light",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: "light" | "ghost";
  className?: string;
}) {
  const base =
    variant === "light"
      ? "bg-white text-black hover:bg-white/90"
      : "border border-white/20 bg-transparent text-white hover:border-white/40 hover:bg-white/5";
  const cls = `inline-flex cursor-pointer items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-[transform,background-color,border-color,filter] duration-200 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black ${base} ${className}`;

  if (href) {
    return (
      <a href={href} className={cls}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/10">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center justify-between gap-4 py-5 text-left transition-colors duration-200 hover:text-white"
      >
        <span className="text-base font-semibold text-white sm:text-lg">{q}</span>
        <ChevronDown
          className={`size-5 shrink-0 text-white/50 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <p className="pb-5 text-sm leading-relaxed text-white/55 sm:text-[0.95rem]">{a}</p>
        </div>
      </div>
    </div>
  );
}

export function IConnectPlusLanding() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <div className="icp-landing min-h-dvh bg-black font-sans text-white antialiased [&_h1]:font-[family-name:var(--font-icp-display),sans-serif] [&_h2]:font-[family-name:var(--font-icp-display),sans-serif] [&_h3]:font-[family-name:var(--font-icp-display),sans-serif]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-black"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-white/5 bg-black/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:h-[4.25rem] sm:px-8 lg:px-10">
          <BrandMark light />

          <nav
            aria-label="Primary"
            className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 lg:flex"
          >
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="cursor-pointer text-sm font-medium text-white/55 transition-colors duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <PillButton
              onClick={() => setSignInOpen(true)}
              className="hidden !px-5 !py-2 sm:inline-flex"
            >
              Sign in
            </PillButton>
            <button
              type="button"
              aria-expanded={menuOpen}
              aria-controls="icp-mobile-nav"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full border border-white/15 text-white transition-colors duration-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white lg:hidden"
            >
              {menuOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
            </button>
          </div>
        </div>

        {menuOpen ? (
          <div id="icp-mobile-nav" className="border-t border-white/10 bg-black lg:hidden">
            <nav aria-label="Mobile" className="mx-auto flex max-w-6xl flex-col gap-1 px-5 py-4">
              {NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="cursor-pointer rounded-xl px-3 py-3 text-base font-medium text-white/80 transition-colors duration-200 hover:bg-white/5"
                >
                  {item.label}
                </a>
              ))}
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setSignInOpen(true);
                }}
                className="mt-2 inline-flex cursor-pointer items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-black"
              >
                Sign in
              </button>
            </nav>
          </div>
        ) : null}
      </header>

      <main id="main">
        {/* Hero — Avenna-style centered dark composition */}
        <section className="relative isolate overflow-hidden px-5 pb-24 pt-20 sm:px-8 sm:pb-32 sm:pt-28 lg:px-10 lg:pt-32">
          <div
            aria-hidden
            className="icp-hero-glow pointer-events-none absolute -left-24 top-1/3 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(37,99,255,0.35)_0%,transparent_68%)] blur-2xl"
          />
          <div
            aria-hidden
            className="icp-hero-glow pointer-events-none absolute -right-24 top-1/4 h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(circle,rgba(0,217,199,0.22)_0%,transparent_70%)] blur-2xl"
          />

          <div className="pointer-events-none absolute inset-y-10 left-0 hidden w-[28%] opacity-40 lg:block">
            <div className="relative h-full w-full overflow-hidden rounded-r-[2rem]">
              <Image
                src="/landing/hero-workspace.png"
                alt=""
                fill
                priority
                className="object-cover object-right"
                sizes="28vw"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-transparent" />
            </div>
          </div>
          <div className="pointer-events-none absolute inset-y-10 right-0 hidden w-[28%] opacity-40 lg:block">
            <div className="relative h-full w-full overflow-hidden rounded-l-[2rem]">
              <Image
                src="/landing/finance-ops.png"
                alt=""
                fill
                className="object-cover object-left"
                sizes="28vw"
              />
              <div className="absolute inset-0 bg-gradient-to-l from-black via-black/70 to-transparent" />
            </div>
          </div>

          <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center text-center">
            <p className="icp-anim-fade text-xs font-semibold uppercase tracking-[0.22em] text-white/45">
              Connect Plus
            </p>
            <h1 className="icp-anim-rise mt-5 text-balance text-[2.6rem] font-bold leading-[1.05] tracking-[-0.04em] sm:text-5xl sm:leading-[1.02] lg:text-[3.75rem]">
              All your enterprise ops,
              <br className="hidden sm:block" /> one smart platform
            </h1>
            <div className="icp-anim-rise-delay-1 mt-9 flex flex-wrap items-center justify-center gap-3">
              <PillButton href="#contact">
                Request a demo
                <ArrowRight className="size-4" aria-hidden />
              </PillButton>
              <PillButton variant="ghost" onClick={() => setSignInOpen(true)}>
                Sign in
              </PillButton>
            </div>
            <p className="icp-anim-rise-delay-2 mt-8 max-w-md text-pretty text-[0.95rem] leading-relaxed text-white/50 sm:text-base">
              Custom AI-powered enterprise apps for finance, CRM, GRC, HR, and
              operations — without trading accuracy for speed.
            </p>
          </div>
        </section>

        {/* AI Report */}
        <section id="about" className="scroll-mt-24 border-t border-white/10 px-5 py-20 sm:px-8 sm:py-28 lg:px-10">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                Intelligence
              </p>
              <h2 className="mt-3 text-balance text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
                AI report for smarter automation
              </h2>
              <p className="mt-4 text-base leading-relaxed text-white/50">
                Real-time analytics, automation, and intelligent optimization —
                inside the same stack your teams already run.
              </p>
            </div>
            <ul className="mt-12 grid gap-4 sm:grid-cols-3">
              {AI_REPORT.map((card) => (
                <li
                  key={card.title}
                  className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition-[border-color,background-color] duration-200 hover:border-white/20 hover:bg-white/[0.05]"
                >
                  <div className="mb-4 inline-flex size-10 items-center justify-center rounded-2xl bg-white/10 text-white">
                    <Bot className="size-5" aria-hidden />
                  </div>
                  <h3 className="text-lg font-bold tracking-tight">{card.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/50">{card.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Track what counts */}
        <section id="features" className="scroll-mt-24 bg-[#0A0A0F] px-5 py-20 sm:px-8 sm:py-28 lg:px-10">
          <div className="mx-auto max-w-6xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
              Features
            </p>
            <h2 className="mt-3 max-w-xl text-balance text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
              Track what counts
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/50">
              From monitoring performance to clear insights and automated
              reports — we handle the data work so you grow the business.
            </p>

            <div className="mt-14 grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <ul className="space-y-8">
                {TRACK.map((item) => (
                  <li key={item.n} className="flex gap-5">
                    <span className="font-[family-name:var(--font-icp-display),sans-serif] text-sm font-bold tracking-[0.16em] text-white/35">
                      ({item.n})
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <item.icon className="size-4 text-white/70" aria-hidden />
                        <h3 className="text-xl font-bold tracking-tight">{item.title}</h3>
                      </div>
                      <p className="mt-2 max-w-md text-sm leading-relaxed text-white/50">
                        {item.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-white/[0.08] to-transparent p-8 sm:p-10">
                <p className="text-2xl font-bold leading-snug tracking-tight sm:text-3xl">
                  We’re not here to replace employees — we’re here to empower
                  them.
                </p>
                <p className="mt-4 text-sm leading-relaxed text-white/50">
                  Track performance and make data-driven decisions that keep
                  operations accurate and fast.
                </p>
                <div className="mt-8">
                  <PillButton href="#contact">Request a demo</PillButton>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Solution marquee */}
        <section className="border-y border-white/10 bg-black py-10" aria-label="Modules">
          <p className="mb-6 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">
            Solution
          </p>
          <div className="overflow-hidden">
            <div className="icp-marquee-track flex gap-10 px-6 text-2xl font-bold tracking-tight text-white/80 sm:text-3xl">
              {[...MARQUEE, ...MARQUEE].map((label, i) => (
                <span key={`${label}-${i}`} className="flex shrink-0 items-center gap-10">
                  {label}
                  <span className="text-white/20" aria-hidden>
                    ·
                  </span>
                </span>
              ))}
            </div>
          </div>
          <p className="mx-auto mt-8 max-w-2xl px-5 text-center text-sm leading-relaxed text-white/45">
            Large enterprises need to streamline operations and raise
            efficiency. Connect Plus improves productivity, reduces errors, and
            delivers measurable impact — module by module.
          </p>
        </section>

        {/* Performance */}
        <section className="px-5 py-20 sm:px-8 sm:py-28 lg:px-10">
          <div className="mx-auto max-w-6xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
              Performance
            </p>
            <h2 className="mt-3 max-w-2xl text-balance text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
              Boost decisions, accuracy &amp; speed
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/50">
              AI insights, automated workflows, and shared governance —
              delivering faster, error-free results.
            </p>
            <ul className="mt-12 grid gap-4 sm:grid-cols-3">
              {PERFORMANCE.map((item) => (
                <li
                  key={item.title}
                  className="rounded-3xl border border-white/10 bg-white/[0.03] p-7 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-white/20"
                >
                  <item.icon className="size-6 text-white" aria-hidden />
                  <h3 className="mt-5 text-lg font-bold tracking-tight">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/50">{item.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Stats band */}
        <section className="border-y border-white/10 bg-[#0A0A0F] px-5 py-20 sm:px-8 sm:py-24 lg:px-10">
          <div className="mx-auto max-w-6xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
              Tomorrow&apos;s enterprise efficiency, today
            </p>
            <h2 className="mt-4 max-w-3xl text-balance text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
              AI-assisted, expert-verified teams delivering faster, smarter
              operations.
            </h2>
            <div className="mt-8">
              <PillButton href="#contact">Request a demo</PillButton>
            </div>
            <ul className="mt-14 grid gap-10 sm:grid-cols-3">
              {STATS.map((s) => (
                <li key={s.label}>
                  <p className="text-4xl font-bold tracking-tight sm:text-5xl">{s.value}</p>
                  <p className="mt-2 text-lg font-semibold">{s.label}</p>
                  <p className="mt-2 text-sm leading-relaxed text-white/45">{s.detail}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-24 px-5 py-20 sm:px-8 sm:py-28 lg:px-10">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                FAQ
              </p>
              <h2 className="mt-3 text-balance text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
                Frequently asked questions
              </h2>
              <p className="mt-4 text-sm text-white/45">Get answers to common questions here.</p>
            </div>
            <div>
              {FAQ.map((item) => (
                <FaqItem key={item.q} q={item.q} a={item.a} />
              ))}
            </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section
          id="contact"
          className="scroll-mt-24 border-t border-white/10 px-5 py-24 text-center sm:px-8 sm:py-32 lg:px-10"
        >
          <div className="mx-auto max-w-3xl">
            <h2 className="text-balance text-3xl font-bold tracking-[-0.03em] sm:text-4xl md:text-[2.75rem] md:leading-[1.12]">
              AI system report — smarter automation.
            </h2>
            <p className="mt-5 text-pretty text-base leading-relaxed text-white/50 sm:text-lg">
              Transform operations with real-time analytics, automation, and
              intelligent optimization — built around how you actually work.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <PillButton href="mailto:hello@iconnectplus.com?subject=Connect%20Plus%20demo">
                Book a conversation
                <ArrowRight className="size-4" aria-hidden />
              </PillButton>
              <PillButton variant="ghost" onClick={() => setSignInOpen(true)}>
                Sign in to platform
              </PillButton>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-black px-5 py-12 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <BrandMark light />
            <p className="mt-3 max-w-xs text-sm text-white/40">
              Custom AI-powered enterprise apps that drive growth.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-white/45">
            <a href="#about" className="cursor-pointer transition-colors hover:text-white">
              About
            </a>
            <a href="#features" className="cursor-pointer transition-colors hover:text-white">
              Features
            </a>
            <a href="#faq" className="cursor-pointer transition-colors hover:text-white">
              FAQ
            </a>
            <a href="#contact" className="cursor-pointer transition-colors hover:text-white">
              Contact
            </a>
          </div>
        </div>
        <p className="mx-auto mt-10 max-w-6xl text-xs text-white/30">© Connect Plus 2026</p>
      </footer>

      <AccessCodeDialog open={signInOpen} onClose={() => setSignInOpen(false)} />
    </div>
  );
}
