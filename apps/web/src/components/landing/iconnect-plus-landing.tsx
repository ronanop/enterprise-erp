"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Bot,
  Check,
  FileStack,
  Landmark,
  Menu,
  ShieldCheck,
  Users,
  Workflow,
  X,
  Zap,
} from "lucide-react";

import { AccessCodeDialog } from "@/components/landing/access-code-dialog";

const PROOF = [
  { value: "98%", label: "Process fit score" },
  { value: "3.2×", label: "Faster approvals" },
  { value: "0", label: "Shadow spreadsheets" },
  { value: "24/7", label: "AI copilots online" },
] as const;

const HERO_POINTERS = [
  "Blueprint-gated sales & approvals",
  "Shared identity, audit & RBAC",
  "AI inside every workflow",
] as const;

const HERO_SLIDES = [
  {
    src: "/landing/hero-workspace.png",
    alt: "Modern enterprise workspace with analytics dashboards",
    eyebrow: "Live workspace preview",
    title: "One stack. Every decision in context.",
  },
  {
    src: "/landing/team-collab.png",
    alt: "Teams collaborating on enterprise workflows",
    eyebrow: "Built for operators",
    title: "Sales, finance, and ops in the same room.",
  },
  {
    src: "/landing/finance-ops.png",
    alt: "Finance operations dashboards on a laptop",
    eyebrow: "Audit-ready by design",
    title: "Controls that travel with every transaction.",
  },
] as const;

const CAPABILITIES = [
  {
    title: "AI Assistant",
    body: "Ask, act, and automate inside live transactions — not a detached chatbot.",
    points: [
      "Context from the record you are on",
      "Suggested next actions with audit trail",
      "Works across finance, CRM, HR, GRC",
    ],
    icon: Bot,
  },
  {
    title: "Finance & GRC",
    body: "GL, journals, compliance, and risk controls built for audit-ready enterprises.",
    points: [
      "Tenant + company isolation by default",
      "Versioned journals and soft-delete",
      "Policy checks before money moves",
    ],
    icon: Landmark,
  },
  {
    title: "Sales CRM",
    body: "Company → Lead → Opportunity → Quote → OVF with gated blueprint states.",
    points: [
      "Margin engines before you quote",
      "Approval locking on critical docs",
      "Deal timeline from allowed actions",
    ],
    icon: Zap,
  },
  {
    title: "HR & People",
    body: "Attendance, ESS, recruitment, and payroll on one identity graph.",
    points: [
      "Same SSO as the rest of the stack",
      "ESS inbox connected to workflows",
      "Org hierarchy drives access scope",
    ],
    icon: Users,
  },
  {
    title: "Documents & Workflow",
    body: "Versioned docs and approvals that travel with every transaction.",
    points: [
      "Notification engine built in",
      "No orphan email threads",
      "Full actor + timestamp history",
    ],
    icon: FileStack,
  },
  {
    title: "Custom Modules",
    body: "Extend the platform to your process — we bend the software, not your team.",
    points: [
      "Clean architecture per module",
      "Shared foundation services",
      "Roadmap owned with you",
    ],
    icon: Workflow,
  },
] as const;

const STEPS = [
  {
    step: "01",
    title: "Map how you actually work",
    body: "Workshops capture approvals, handoffs, and edge cases that generic SaaS ignores.",
  },
  {
    step: "02",
    title: "Configure the blueprint",
    body: "State machines, gates, and roles encode your operating system into the product.",
  },
  {
    step: "03",
    title: "Go live with AI copilots",
    body: "Teams adopt one workspace — finance, sales, GRC, and HR share the same truth.",
  },
  {
    step: "04",
    title: "Iterate on your roadmap",
    body: "New modules and automations ship against your growth goals, not a vendor queue.",
  },
] as const;

const COMPARE_ROWS = [
  {
    topic: "Workflow fit",
    generic: "Fixed templates you must adapt to",
    custom: "Blueprints mapped to your operations",
  },
  {
    topic: "AI depth",
    generic: "Chatbot bolted onto a form",
    custom: "Copilots inside decisions & approvals",
  },
  {
    topic: "Data model",
    generic: "Siloed apps + brittle connectors",
    custom: "One tenant graph across modules",
  },
  {
    topic: "Governance",
    generic: "Export-and-hope audit trails",
    custom: "RBAC, soft-delete, version columns",
  },
  {
    topic: "Ownership",
    generic: "Vendor roadmap decides priority",
    custom: "Your growth goals drive delivery",
  },
] as const;

const OUTCOMES = [
  {
    metric: "−42%",
    label: "Quote-to-close cycle",
    detail: "Gated sales blueprints remove rework and stalled approvals.",
  },
  {
    metric: "12+",
    label: "Modules, one stack",
    detail: "Finance, CRM, GRC, HR, docs — shared identity and audit.",
  },
  {
    metric: "100%",
    label: "Tenant isolation",
    detail: "UUID keys, soft delete, and audit columns on business tables.",
  },
] as const;

const MODULE_SPOTLIGHT = [
  {
    title: "Sales that protect margin",
    body: "From company account to OVF, every step is an allowed action — not a free-form pipeline.",
    points: [
      "BOQ / SOW and deal registration gates",
      "OEM quote + customer PO approvals",
      "Share to SCM when the deal is real",
    ],
    image: "/landing/team-collab.png",
    imageAlt: "Sales and operations teams collaborating on deals",
  },
  {
    title: "Finance that stays audit-ready",
    body: "Journals, AP, and controls live beside the commercial flow — not in a separate spreadsheet world.",
    points: [
      "GL and fiscal year discipline",
      "Cost formulas tied to order value",
      "Compliance evidence without hunting",
    ],
    image: "/landing/finance-ops.png",
    imageAlt: "Finance operations dashboards on a laptop",
  },
] as const;

const NAV = [
  { label: "Capabilities", href: "#capabilities" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Why custom", href: "#why-custom" },
  { label: "Outcomes", href: "#outcomes" },
  { label: "Contact", href: "#contact" },
] as const;

function BrandMark({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`group flex cursor-pointer items-center gap-2.5 transition-opacity duration-200 hover:opacity-90 ${className}`}
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
      <span className="font-[family-name:var(--font-icp-display),sans-serif] text-[1.05rem] font-bold tracking-[-0.03em] text-[#0A0A0F]">
        iConnect Plus
      </span>
    </Link>
  );
}

function HeroPlatformSlider() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || paused) return;

    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % HERO_SLIDES.length);
    }, 2000);
    return () => window.clearInterval(id);
  }, [paused]);

  const active = HERO_SLIDES[index];

  return (
    <div
      id="platform"
      className="icp-anim-rise-delay-2 relative mx-auto w-full max-w-xl lg:max-w-none"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setPaused(false);
        }
      }}
    >
      <div
        className="relative aspect-[4/5] overflow-hidden rounded-[1.75rem] shadow-[0_32px_80px_-28px_rgba(37,99,255,0.55)] sm:aspect-[5/6] lg:aspect-[4/5]"
        aria-roledescription="carousel"
        aria-label="Platform previews"
      >
        {HERO_SLIDES.map((slide, i) => (
          <div
            key={slide.src}
            className={`absolute inset-0 transition-opacity duration-700 ease-out motion-reduce:transition-none ${
              i === index ? "opacity-100" : "opacity-0"
            }`}
            aria-hidden={i !== index}
          >
            <Image
              src={slide.src}
              alt={slide.alt}
              fill
              priority={i === 0}
              sizes="(max-width: 1024px) 90vw, 520px"
              className="object-cover"
            />
          </div>
        ))}

        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-[#0A0F1E]/90 via-[#0A0F1E]/40 to-[#0A0F1E]/15"
        />

        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/75">
            {active.eyebrow}
          </p>
          <p className="mt-2 max-w-xs text-2xl font-bold leading-snug tracking-tight text-white">
            {active.title}
          </p>

          <div className="mt-5 flex items-center gap-2">
            {HERO_SLIDES.map((slide, i) => (
              <button
                key={slide.src}
                type="button"
                aria-label={`Show slide ${i + 1}: ${slide.eyebrow}`}
                aria-current={i === index}
                onClick={() => setIndex(i)}
                className={`h-1.5 cursor-pointer rounded-full transition-[width,background-color] duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0F1E] ${
                  i === index
                    ? "w-7 bg-white"
                    : "w-1.5 bg-white/45 hover:bg-white/70"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function IiConnectPlusLanding() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
    <div className="icp-landing min-h-dvh bg-white font-sans text-[#0A0A0F] antialiased [&_h1]:font-[family-name:var(--font-icp-display),sans-serif] [&_h2]:font-[family-name:var(--font-icp-display),sans-serif] [&_h3]:font-[family-name:var(--font-icp-display),sans-serif]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[#2563FF] focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      <header
        className={`sticky top-0 z-40 transition-[background-color,box-shadow,border-color] duration-200 ${
          scrolled
            ? "border-b border-[#0A0A0F]/[0.08] bg-white shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)]"
            : "border-b border-transparent bg-white"
        }`}
      >
        <div className="relative mx-auto flex h-[4.25rem] max-w-6xl items-center justify-between gap-4 px-5 sm:px-8 lg:h-[4.75rem] lg:px-10">
          <BrandMark />

          <nav
            aria-label="Primary"
            className="absolute left-1/2 hidden -translate-x-1/2 items-center rounded-full border border-[#0A0A0F]/[0.06] bg-[#F5F7FF] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] lg:flex"
          >
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="cursor-pointer rounded-full px-3.5 py-2 text-[13px] font-medium text-[#5A6070] transition-[color,background-color] duration-200 hover:bg-white hover:text-[#0A0A0F] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563FF] focus-visible:ring-offset-2"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href="#contact"
              className="hidden cursor-pointer rounded-full px-3.5 py-2 text-sm font-semibold text-[#0A0A0F] transition-colors duration-200 hover:text-[#2563FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563FF] focus-visible:ring-offset-2 md:inline-flex"
            >
              Request demo
            </a>
            <button
              type="button"
              onClick={() => setSignInOpen(true)}
              className="inline-flex cursor-pointer items-center justify-center rounded-full bg-[#2563FF] px-4 py-2 text-sm font-semibold !text-white shadow-[0_8px_20px_-10px_rgba(37,99,255,0.85)] transition-[transform,filter] duration-200 hover:-translate-y-px hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563FF] focus-visible:ring-offset-2 sm:px-5 sm:py-2.5"
            >
              Sign in
            </button>
            <button
              type="button"
              aria-expanded={menuOpen}
              aria-controls="icp-mobile-nav"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full border border-[#0A0A0F]/10 bg-white text-[#0A0A0F] transition-[background-color,border-color] duration-200 hover:border-[#0A0A0F]/20 hover:bg-[#F5F7FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563FF] focus-visible:ring-offset-2 lg:hidden"
            >
              {menuOpen ? (
                <X className="size-5" aria-hidden />
              ) : (
                <Menu className="size-5" aria-hidden />
              )}
            </button>
          </div>
        </div>

        {menuOpen ? (
          <div
            id="icp-mobile-nav"
            className="border-t border-[#0A0A0F]/[0.06] bg-white lg:hidden"
          >
            <nav
              aria-label="Mobile"
              className="mx-auto flex max-w-6xl flex-col gap-1 px-5 py-4 sm:px-8"
            >
              {NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="cursor-pointer rounded-xl px-3 py-3 text-base font-medium text-[#0A0A0F] transition-colors duration-200 hover:bg-[#F5F7FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563FF]"
                >
                  {item.label}
                </a>
              ))}
              <a
                href="#contact"
                onClick={() => setMenuOpen(false)}
                className="mt-2 inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-[#0A0A0F]/10 bg-white px-5 py-3 text-sm font-semibold text-[#0A0A0F] transition-colors duration-200 hover:bg-[#F5F7FF]"
              >
                Request a demo
              </a>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setSignInOpen(true);
                }}
                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-[#2563FF] px-5 py-3 text-sm font-semibold !text-white transition-[filter] duration-200 hover:brightness-110"
              >
                Sign in
                <ArrowRight className="size-4" aria-hidden />
              </button>
            </nav>
          </div>
        ) : null}
      </header>

      <main id="main">
        {/* Award hero — Figma Hero v2 */}
        <section className="relative overflow-hidden border-b border-[#0A0A0F]/[0.04] bg-white">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_80%_60%_at_85%_20%,rgba(37,99,255,0.07),transparent_55%)]"
          />
          <div className="relative z-10 mx-auto grid max-w-6xl gap-12 px-5 pb-10 pt-14 sm:px-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:items-center lg:gap-14 lg:px-10 lg:pb-0 lg:pt-24">
            <div className="icp-anim-rise flex flex-col">
              <h1 className="max-w-[22ch] text-balance text-[2.35rem] font-bold leading-[1.05] tracking-[-0.04em] text-[#0A0A0F] sm:text-5xl sm:leading-[1.04] lg:text-[3.35rem] lg:leading-[1.02]">
                We make custom AI-powered Enterprise Apps that drive growth.
              </h1>

              <p className="mt-6 max-w-[34rem] text-pretty text-[1.05rem] leading-[1.65] text-[#5A6070] sm:text-lg sm:leading-[1.7]">
                Modular systems for finance, CRM, GRC, HR, and operations —
                engineered around how your business actually works, not a vendor
                template.
              </p>

              <div className="mt-9 flex flex-col gap-3.5 sm:flex-row sm:flex-wrap sm:items-center">
                <a
                  href="#contact"
                  className="inline-flex cursor-pointer items-center justify-center gap-2.5 rounded-full bg-[#2563FF] px-9 py-4 text-base font-semibold !text-white shadow-[0_14px_36px_-14px_rgba(37,99,255,0.75)] transition-[transform,filter] duration-200 hover:-translate-y-px hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563FF] focus-visible:ring-offset-2"
                >
                  Request a demo
                  <ArrowRight className="size-5" aria-hidden />
                </a>
                <a
                  href="#platform"
                  className="group inline-flex cursor-pointer items-center justify-center gap-2.5 rounded-full px-3 py-4 text-base font-semibold text-[#0A0A0F] transition-colors duration-200 hover:text-[#2563FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563FF] focus-visible:ring-offset-2 sm:px-5"
                >
                  See the platform
                  <ArrowRight
                    className="size-5 transition-transform duration-200 group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </a>
              </div>
            </div>

            <HeroPlatformSlider />
          </div>

          <div className="relative mt-12 border-t border-[#0A0A0F]/[0.06] bg-white/60 backdrop-blur-sm">
            <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-5 py-8 sm:grid-cols-4 sm:px-8 lg:px-10">
              {PROOF.map((item) => (
                <div key={item.label}>
                  <dt className="sr-only">{item.label}</dt>
                  <dd className="text-2xl font-bold tracking-tight sm:text-[1.65rem]">
                    {item.value}
                  </dd>
                  <p className="mt-1 text-xs font-medium text-[#5A6070] sm:text-sm">
                    {item.label}
                  </p>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section
          id="why-switch"
          className="scroll-mt-20 border-b border-[#0A0A0F]/[0.06] bg-[#F5F7FF] px-5 py-14 sm:px-8 sm:py-16 lg:px-10"
        >
          <div className="mx-auto max-w-6xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2563FF]">
              Why teams switch
            </p>
            <ul className="mt-6 grid gap-4 sm:grid-cols-3 sm:gap-6">
              {HERO_POINTERS.map((line) => (
                <li
                  key={line}
                  className="flex items-start gap-3 rounded-2xl border border-[#0A0A0F]/[0.05] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                >
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#00D9C7]/15 text-[#059669] ring-1 ring-[#00D9C7]/35">
                    <Check className="size-3" strokeWidth={3} aria-hidden />
                  </span>
                  <span className="text-[0.9375rem] font-medium leading-snug tracking-[-0.01em] text-[#0A0A0F]">
                    {line}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Capabilities */}
        <section
          id="capabilities"
          className="scroll-mt-20 px-5 py-20 sm:px-8 sm:py-28 lg:px-10"
        >
          <div className="mx-auto max-w-6xl">
            <p className="text-sm font-semibold tracking-wide text-[#2563FF]">
              Capabilities
            </p>
            <h2 className="mt-3 max-w-2xl text-balance text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
              Everything your enterprise needs — built as one system.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#5A6070]">
              Each module shares identity, workflow, notifications, and audit —
              so growth does not mean another integration project.
            </p>

            <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {CAPABILITIES.map((item) => {
                const Icon = item.icon;
                return (
                  <li
                    key={item.title}
                    className="flex flex-col rounded-2xl bg-[#F5F7FF] p-7 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <span className="mb-4 inline-flex size-10 items-center justify-center rounded-xl bg-[#2563FF] text-white">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <h3 className="text-lg font-bold tracking-tight">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#5A6070]">
                      {item.body}
                    </p>
                    <ul className="mt-4 space-y-2 border-t border-[#0A0A0F]/[0.06] pt-4">
                      {item.points.map((point) => (
                        <li
                          key={point}
                          className="flex gap-2 text-sm text-[#0A0A0F]/80"
                        >
                          <Check
                            className="mt-0.5 size-3.5 shrink-0 text-[#2563FF]"
                            aria-hidden
                          />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* How it works */}
        <section
          id="how-it-works"
          className="scroll-mt-20 bg-[#F5F7FF] px-5 py-20 sm:px-8 sm:py-28 lg:px-10"
        >
          <div className="mx-auto max-w-6xl">
            <p className="text-sm font-semibold tracking-wide text-[#2563FF]">
              How it works
            </p>
            <h2 className="mt-3 max-w-2xl text-balance text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
              From discovery to production — without the SaaS compromise.
            </h2>
            <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((item) => (
                <li
                  key={item.step}
                  className="rounded-2xl border border-[#0A0A0F]/[0.06] bg-white p-6"
                >
                  <span className="text-xs font-bold tracking-[0.16em] text-[#2563FF]">
                    {item.step}
                  </span>
                  <h3 className="mt-3 text-lg font-bold tracking-tight">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#5A6070]">
                    {item.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Module spotlights with images */}
        <section className="px-5 py-20 sm:px-8 sm:py-28 lg:px-10">
          <div className="mx-auto max-w-6xl space-y-20">
            {MODULE_SPOTLIGHT.map((block, index) => (
              <div
                key={block.title}
                className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-14 ${
                  index % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""
                }`}
              >
                <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-lg">
                  <Image
                    src={block.image}
                    alt={block.imageAlt}
                    fill
                    sizes="(max-width: 1024px) 100vw, 560px"
                    className="object-cover"
                  />
                </div>
                <div>
                  <p className="inline-flex items-center gap-2 text-sm font-semibold text-[#2563FF]">
                    <ShieldCheck className="size-4" aria-hidden />
                    Deep capability
                  </p>
                  <h2 className="mt-3 text-balance text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
                    {block.title}
                  </h2>
                  <p className="mt-4 text-base leading-relaxed text-[#5A6070]">
                    {block.body}
                  </p>
                  <ul className="mt-6 space-y-3">
                    {block.points.map((point) => (
                      <li
                        key={point}
                        className="flex gap-3 text-sm font-medium text-[#0A0A0F]"
                      >
                        <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[#FF594D]" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Comparison */}
        <section
          id="why-custom"
          className="scroll-mt-20 bg-[#0A0F1E] px-5 py-20 text-white sm:px-8 sm:py-28 lg:px-10"
        >
          <div className="mx-auto max-w-6xl">
            <p className="text-sm font-semibold tracking-wide text-[#7EB6FF]">
              Why custom wins
            </p>
            <h2 className="mt-3 max-w-3xl text-balance text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
              Off-the-shelf tools force your business to bend. We bend the
              software.
            </h2>

            <div className="mt-12 overflow-hidden rounded-2xl border border-white/10">
              <div className="grid grid-cols-[1fr_1.2fr_1.2fr] gap-0 bg-white/5 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white/55 sm:px-6">
                <span>Dimension</span>
                <span className="text-[#FF8A80]">Generic SaaS</span>
                <span className="text-[#5EEAD4]">iConnect Plus</span>
              </div>
              {COMPARE_ROWS.map((row) => (
                <div
                  key={row.topic}
                  className="grid grid-cols-[1fr_1.2fr_1.2fr] gap-3 border-t border-white/10 px-4 py-4 text-sm sm:gap-4 sm:px-6"
                >
                  <p className="font-semibold text-white/90">{row.topic}</p>
                  <p className="flex gap-2 text-white/55">
                    <X
                      className="mt-0.5 size-3.5 shrink-0 text-[#FF594D]"
                      aria-hidden
                    />
                    <span>{row.generic}</span>
                  </p>
                  <p className="flex gap-2 text-white/85">
                    <Check
                      className="mt-0.5 size-3.5 shrink-0 text-[#00D9C7]"
                      aria-hidden
                    />
                    <span>{row.custom}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Outcomes */}
        <section
          id="outcomes"
          className="scroll-mt-20 border-y border-[#0A0A0F]/[0.06] px-5 py-20 sm:px-8 sm:py-24 lg:px-10"
        >
          <div className="mx-auto max-w-6xl">
            <p className="text-sm font-semibold tracking-wide text-[#2563FF]">
              Outcomes
            </p>
            <h2 className="mt-3 max-w-2xl text-balance text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
              Numbers that matter to operators — not vanity metrics.
            </h2>
            <div className="mt-12 grid gap-8 sm:grid-cols-3">
              {OUTCOMES.map((item) => (
                <div key={item.label} className="text-center sm:text-left">
                  <p className="text-4xl font-bold tracking-tight text-[#2563FF] sm:text-5xl">
                    {item.metric}
                  </p>
                  <p className="mt-2 text-lg font-bold">{item.label}</p>
                  <p className="mt-2 text-sm leading-relaxed text-[#5A6070]">
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section
          id="contact"
          className="scroll-mt-20 px-5 py-24 text-center sm:px-8 sm:py-32 lg:px-10"
        >
          <div className="mx-auto max-w-3xl">
            <h2 className="text-balance text-3xl font-bold tracking-[-0.02em] sm:text-4xl md:text-[2.75rem] md:leading-[1.15]">
              Ready to grow with software that fits?
            </h2>
            <p className="mt-5 text-pretty text-base leading-relaxed text-[#5A6070] sm:text-lg">
              Talk to us about a custom AI-powered enterprise platform built for
              how you win.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <a
                href="mailto:hello@iconnectplus.com?subject=iConnect%20Plus%20demo"
                className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#2563FF] px-8 py-4 text-sm font-semibold text-white transition-[transform,opacity] duration-200 hover:-translate-y-px hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563FF] focus-visible:ring-offset-2"
              >
                Book a conversation
                <ArrowRight className="size-4" aria-hidden />
              </a>
              <button
                type="button"
                onClick={() => setSignInOpen(true)}
                className="inline-flex cursor-pointer items-center rounded-full border-[1.5px] border-[#0A0A0F]/20 px-8 py-4 text-sm font-semibold transition-[transform,border-color] duration-200 hover:-translate-y-px hover:border-[#0A0A0F]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563FF] focus-visible:ring-offset-2"
              >
                Sign in to platform
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#0A0A0F]/[0.06] bg-[#F5F7FF] px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <p className="font-bold tracking-tight">iConnect Plus</p>
          <p className="text-sm text-[#5A6070]">
            Custom AI-powered Enterprise Apps
          </p>
        </div>
      </footer>

      <AccessCodeDialog open={signInOpen} onClose={() => setSignInOpen(false)} />
    </div>
  );
}
