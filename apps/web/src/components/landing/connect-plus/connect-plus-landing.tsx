"use client";

import Link from "next/link";
import { Gauge, ScanSearch, Sparkles, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import "lenis/dist/lenis.css";
import "./connect-plus-landing.css";
import {
  useLenis,
  usePinProgress,
  usePrefersReducedMotion,
} from "./use-scroll-progress";

const ASSETS = {
  mark: "/landing/mark.png",
  heroBg: "/landing/hero-bg.png",
  handLeft: "/landing/hand-left.png",
  handRight: "/landing/hand-right.png",
} as const;

const HERO = {
  headline: ["All your enterprise ops,", "one smart platform"],
  sub: "Custom AI-powered enterprise apps for finance, CRM, GRC, HR, and operations - without trading accuracy for speed.",
} as const;

const REPORT: {
  title: string;
  sub: string;
  plate: { label: string; lines: string[] }[];
  cards: { icon: LucideIcon; title: string; body: string }[];
} = {
  title: "Custom AI-powered enterprise apps that drive growth.",
  sub: "Real-time analytics, automation, and intelligent optimization - inside the same stack your teams already run.",
  plate: [
    { label: "Report", lines: ["FY26 - Period 09 - generated 14:02"] },
    { label: "Scope", lines: ["Finance - CRM - GRC - HR - Assets"] },
    {
      label: "Sources",
      lines: ["GL journals, CRM blueprints, workflow events"],
    },
    { label: "Mode", lines: ["Real-time stream - tenant scoped"] },
    {
      label: "Signals",
      lines: [
        "14 approvals stalled beyond SLA",
        "6 repeat handoffs across finance / CRM",
      ],
    },
    {
      label: "Findings",
      lines: [
        "Quote-to-close cycle up 18% this period",
        "3 policy gates bypassed - flagged for review",
      ],
    },
    { label: "Performance", lines: ["Throughput steady, queue depth rising"] },
  ],
  cards: [
    {
      icon: ScanSearch,
      title: "AI System Report",
      body: "Surface stalled approvals, repeat handoffs, and ops lag across modules - before they become backlog.",
    },
    {
      icon: Gauge,
      title: "Efficiency Analytics",
      body: "See where cycle time and resource use break down across finance, CRM, HR, and GRC.",
    },
    {
      icon: Sparkles,
      title: "AI Insight Cards",
      body: "Pattern checks suggest blueprint and policy tweaks that raise throughput without losing control.",
    },
  ],
};

const SLIDER = {
  intro:
    "Track what counts - monitoring, insights, and automated reports so you grow the business.",
  slides: [
    {
      image: "/landing/erp-01-finance.jpg",
      title: "Finance - GL, journals, and close in one controlled ledger.",
    },
    {
      image: "/landing/erp-02-dashboard.jpg",
      title: "Dashboards - live KPIs for ops, not vanity charts.",
    },
    {
      image: "/landing/erp-03-workflow.jpg",
      title: "Workflows - approvals and alerts land with the right owner.",
    },
    {
      image: "/landing/erp-04-ops.jpg",
      title: "CRM, GRC, and HR share one identity, workflow, and audit trail.",
    },
    {
      image: "/landing/erp-05-platform.jpg",
      title: "Connect Plus - AI-powered ERP apps, module by module.",
    },
  ],
} as const;

const SOLUTION = {
  label: "SOLUTION",
  paragraphs: [
    {
      text: "Large enterprises need to streamline operations and raise efficiency across every department.",
    },
    {
      text: "Connect Plus improves productivity, reduces errors, and delivers measurable impact - module by module across finance, CRM, GRC, and operations.",
      accent: "Connect Plus",
    },
  ],
} as const;

const NUMBERS = {
  eyebrow: "TOMORROW'S ENTERPRISE EFFICIENCY, TODAY",
  headline:
    "AI-assisted, expert-verified teams delivering faster, smarter operations.",
  stats: [
    {
      value: "12+",
      label: "Modules, one stack",
      detail:
        "Finance, CRM, GRC, HR, assets, and more share identity, workflow, and audit.",
    },
    {
      value: "−42%",
      label: "Quote-to-close cycle",
      detail:
        "Gated sales blueprints remove stalled approvals and spreadsheet shadow work.",
    },
    {
      value: "100%",
      label: "Tenant isolation",
      detail:
        "UUID keys, company scope, and audit columns on every business table.",
    },
  ],
} as const;

const CTA = {
  title: "Welcome to Connect Plus",
  body: "Custom AI-powered enterprise apps that drive growth.",
} as const;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Maps `p` from the [from, to] range onto 0–1. */
const phase = (p: number, from: number, to: number) =>
  clamp01((p - from) / Math.max(to - from, 0.0001));

function LogoMark({ large = false }: { large?: boolean }) {
  return (
    <span className={`cp-logo-mark${large ? " cp-logo-mark-lg" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={ASSETS.mark} alt="" width={96} height={96} decoding="async" />
    </span>
  );
}

function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 24);
      // Hide while scrolling down, reveal again when scrolling up.
      // Always show near the top of the page.
      if (y < 48) {
        setHidden(false);
      } else if (y > lastY.current + 4) {
        setHidden(true);
      } else if (y < lastY.current - 4) {
        setHidden(false);
      }
      lastY.current = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`cp-header${scrolled ? " is-scrolled" : ""}${
        hidden ? " is-hidden" : ""
      }`}
      aria-hidden={hidden}
    >
      <Link href="/" className="cp-logo" aria-label="Connect Plus home">
        <LogoMark />
        <span>Connect Plus</span>
      </Link>
      <Link href="/login" className="cp-signin">
        Sign in
      </Link>
    </header>
  );
}

/** The monospace report plate with its three floating insight cards. */
function ReportStage({ drift }: { drift: number }) {
  return (
    <div className="cp-report-stage">
      <div className="cp-report-plate">
        <div className="cp-plate-bar" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <dl>
          {REPORT.plate.map((row) => (
            <div key={row.label} className="cp-plate-row">
              <dt>{row.label}:</dt>
              <dd>
                {row.lines.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {REPORT.cards.map((card, i) => (
        <article
          key={card.title}
          className={`cp-report-card cp-report-card-${i + 1}`}
          style={{
            transform: `translate3d(0, ${drift * (i === 1 ? 44 : 28)}px, 0)`,
          }}
        >
          <span className="cp-report-icon" aria-hidden>
            <card.icon size={18} strokeWidth={1.75} />
          </span>
          <strong>{card.title}</strong>
          <span className="cp-report-body">{card.body}</span>
        </article>
      ))}
    </div>
  );
}

/**
 * Hero — one pinned viewport that plays the whole intro:
 *   1. the tablet graphic zooms while the headline fades out,
 *   2. the zoomed screen becomes the backdrop for the AI report,
 *   3. the report holds on screen before the pin releases.
 */
function HeroSection() {
  const ref = useRef<HTMLElement>(null);
  const progress = usePinProgress(ref);
  const reduced = usePrefersReducedMotion();
  const p = reduced ? 0 : progress;

  const zoom = phase(p, 0, 0.5);
  const scale = 1 + zoom * 1.8;
  const ty = zoom * 70;
  const copy = 1 - phase(p, 0.02, 0.2);
  const hands = 1 - phase(p, 0.06, 0.34);
  const report = phase(p, 0.4, 0.62);
  const handShift = zoom * 120;

  return (
    <section
      className={`cp-hero${reduced ? " is-static" : ""}`}
      id="hero"
      ref={ref}
      aria-label="Hero"
    >
      <div className="cp-hero-sticky">
        <div className="cp-rays" aria-hidden />
        <div className="cp-stars" aria-hidden />
        <div
          className="cp-graphic"
          style={{ transform: `translate3d(0, ${ty}px, 0) scale(${scale})` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="cp-hand cp-hand-left"
            src={ASSETS.handLeft}
            alt=""
            width={161}
            height={362}
            style={{
              opacity: hands,
              transform: `translate3d(${-handShift}px, 0, 0)`,
            }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="cp-hand cp-hand-right"
            src={ASSETS.handRight}
            alt=""
            width={176}
            height={371}
            style={{
              opacity: hands,
              transform: `translate3d(${handShift}px, 0, 0)`,
            }}
          />
          <div className="cp-graphic-frame">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="cp-graphic-bg"
              src={ASSETS.heroBg}
              alt=""
              width={1332}
              height={848}
              fetchPriority="high"
            />
            <div className="cp-graphic-glow" aria-hidden />
          </div>
        </div>

        <div
          className="cp-hero-copy"
          style={{ opacity: copy, transform: `scale(${1 - zoom * 0.1})` }}
          aria-hidden={copy < 0.05}
        >
          <h1>
            {HERO.headline[0]}
            <br />
            {HERO.headline[1]}
          </h1>
          <p>{HERO.sub}</p>
        </div>

        {/* Lives inside the hero: fades in once the headline is gone. */}
        <div className="cp-hero-tint" aria-hidden style={{ opacity: report }} />
        <div
          className="cp-hero-report"
          style={{
            opacity: report,
            transform: `translate3d(0, ${(1 - report) * 28}px, 0)`,
          }}
          aria-hidden={report < 0.05}
        >
          <h2 className="cp-report-title">{REPORT.title}</h2>
          <p className="cp-report-sub">{REPORT.sub}</p>
          <ReportStage drift={1 - report} />
        </div>
      </div>
    </section>
  );
}

/**
 * Letter-by-letter fill reveal.
 *
 * The dim copy stays in flow so it owns the layout, and a bright copy is
 * absolutely positioned on top with its letters fading in sequentially. Both
 * layers wrap words as atomic inline-blocks, otherwise the overlay's spans find
 * their own soft-wrap points and the two layers drift out of alignment.
 */
function FillParagraph({
  text,
  progress,
  accent,
}: {
  text: string;
  progress: number;
  accent?: string;
}) {
  const tokens = useMemo(() => {
    const accentStart = accent ? text.indexOf(accent) : -1;
    const accentEnd = accentStart >= 0 ? accentStart + accent!.length : -1;

    let cursor = 0;
    return text.split(/(\s+)/).map((chunk) => {
      const start = cursor;
      cursor += chunk.length;
      return {
        chunk,
        start,
        isSpace: !chunk.trim(),
        accent: accentStart >= 0 && start >= accentStart && start < accentEnd,
      };
    });
  }, [text, accent]);

  const total = Math.max(text.length, 1);
  const windowSize = Math.max(2.5 / total, 0.01);
  // Overshoot by one window so the final letters still reach full opacity.
  const scrub = progress * (1 + windowSize);

  const layer = (variant: "dim" | "top") =>
    tokens.map((token, i) => {
      if (token.isSpace) return <span key={`s${i}`}>{token.chunk}</span>;
      const className = token.accent ? "cp-word cp-accent" : "cp-word";
      if (variant === "dim") {
        return (
          <span key={`w${i}`} className={className}>
            {token.chunk}
          </span>
        );
      }
      return (
        <span key={`w${i}`} className={className}>
          {[...token.chunk].map((ch, j) => (
            <span
              key={j}
              style={{
                opacity: clamp01(
                  (scrub - (token.start + j) / total) / windowSize
                ),
              }}
            >
              {ch}
            </span>
          ))}
        </span>
      );
    });

  return (
    <div className="cp-fill-block">
      <p className="cp-fill-dim">{layer("dim")}</p>
      <p className="cp-fill-top" aria-hidden>
        {layer("top")}
      </p>
    </div>
  );
}

/** Solution — pinned mid screen until the letter reveal finishes. */
function SolutionSection() {
  const ref = useRef<HTMLElement>(null);
  const progress = usePinProgress(ref);
  const reduced = usePrefersReducedMotion();
  const p = reduced ? 1 : progress;

  // Sequential: first paragraph completes before the second starts filling.
  const p1 = phase(p, 0, 0.5);
  const p2 = phase(p, 0.45, 0.96);

  return (
    <section
      className={`cp-solution${reduced ? " is-static" : ""}`}
      id="solution"
      ref={ref}
    >
      <div className="cp-solution-pin">
        <div className="cp-solution-inner">
          <div className="cp-eyebrow">{SOLUTION.label}</div>
          <FillParagraph text={SOLUTION.paragraphs[0].text} progress={p1} />
          <FillParagraph
            text={SOLUTION.paragraphs[1].text}
            progress={p2}
            accent={SOLUTION.paragraphs[1].accent}
          />
        </div>
      </div>
    </section>
  );
}

/**
 * Fullscreen scroll slider — the section is tall, its inner frame is pinned,
 * and scroll progress selects the active slide (intro first, then five slides).
 */
function FeaturesSlider() {
  const ref = useRef<HTMLElement>(null);
  const progress = usePinProgress(ref);
  const reduced = usePrefersReducedMotion();

  const total = SLIDER.slides.length + 1;
  const raw = progress * total;
  const index = reduced ? 0 : Math.min(total - 1, Math.floor(raw));
  // 0–1 within the active slide, used for the slow image push-in.
  const local = clamp01(raw - index);

  return (
    <section
      className="cp-features"
      id="features"
      ref={ref}
      aria-label="Features"
      style={{ height: `${total * 100}vh` }}
    >
      <div className="cp-fs-pin">
        <div
          className={`cp-fs-slide cp-fs-intro-slide${
            index === 0 ? " is-active" : ""
          }`}
        >
          <div className="cp-fs-intro-copy">
            <p className="cp-fs-intro">{SLIDER.intro}</p>
          </div>
        </div>

        {SLIDER.slides.map((slide, i) => {
          const active = index === i + 1;
          return (
            <div
              key={slide.image}
              className={`cp-fs-slide${active ? " is-active" : ""}`}
              aria-hidden={!active}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={slide.image}
                alt=""
                style={{
                  transform: `scale(${active ? 1.04 + local * 0.08 : 1.04})`,
                }}
              />
              <div className="cp-fs-overlay" />
              <div className="cp-fs-copy">
                <h2 className="cp-fs-title">{slide.title}</h2>
              </div>
            </div>
          );
        })}

        <div className="cp-fs-progress" aria-hidden>
          <span style={{ transform: `scaleX(${progress})` }} />
        </div>
      </div>
    </section>
  );
}

/**
 * Numbers — pinned viewport with the headline on the left and the stats on the
 * right. Both columns are centred in the pin, so the word reveal and the stat
 * reveals stay aligned top-to-bottom for the whole scroll.
 */
function NumbersSection() {
  const ref = useRef<HTMLElement>(null);
  const progress = usePinProgress(ref);
  const reduced = usePrefersReducedMotion();
  const tokens = useMemo(() => NUMBERS.headline.split(/(\s+)/), []);
  const wordCount = tokens.filter((t) => t.trim()).length;
  const p = reduced ? 1 : progress;

  let wordIndex = 0;

  return (
    <section
      className={`cp-numbers${reduced ? " is-static" : ""}`}
      id="numbers"
      ref={ref}
    >
      <div className="cp-numbers-pin">
        <div className="cp-numbers-glow" aria-hidden />
        <div className="cp-numbers-inner">
          <div className="cp-numbers-left">
            <div className="cp-eyebrow">{NUMBERS.eyebrow}</div>
            <h2>
              {tokens.map((token, i) => {
                if (!token.trim()) return <span key={`gap-${i}`}>{token}</span>;
                const wi = wordIndex++;
                const local = phase(
                  p,
                  (wi / wordCount) * 0.7,
                  (wi / wordCount) * 0.7 + 0.12
                );
                const alpha = (0.22 + local * 0.78).toFixed(3);
                return (
                  <span
                    key={`word-${i}`}
                    className="cp-num-word"
                    style={{ color: `rgba(255, 255, 255, ${alpha})` }}
                  >
                    {token}
                  </span>
                );
              })}
            </h2>
          </div>
          <div className="cp-numbers-right">
            {NUMBERS.stats.map((stat, i) => {
              const local = phase(p, 0.1 + i * 0.17, 0.32 + i * 0.17);
              return (
                <div
                  key={stat.label}
                  className="cp-stat"
                  style={{
                    opacity: local,
                    transform: `translate3d(0, ${(1 - local) * 22}px, 0)`,
                  }}
                >
                  <div className="cp-stat-value">{stat.value}</div>
                  <div className="cp-stat-label">{stat.label}</div>
                  <div className="cp-stat-detail">{stat.detail}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Scroll-zoom capsule — "CUSTOM" and "ERP" sit outside; the capsule itself
 * only appears once you start scrolling, then expands to reveal the CTA.
 */
function CtaSection() {
  const ref = useRef<HTMLElement>(null);
  const progress = usePinProgress(ref);
  const reduced = usePrefersReducedMotion();
  const p = reduced ? 1 : progress;

  // Capsule starts invisible and zero-size so "CUSTOM ERP" read as one line,
  // then fades in and expands to the full viewport while scrolling.
  const width = `${p * 100}vw`;
  const height = `${p * 100}vh`;
  const radius = `${50 * (1 - p)}px`;
  const capsuleVisible = phase(p, 0.02, 0.14);
  // Content appears once the capsule is mostly open.
  const content = phase(p, 0.45, 0.62);
  const sideFade = 1 - phase(p, 0.55, 0.85);

  return (
    <section
      className={`cp-cta${reduced ? " is-static" : ""}`}
      id="cta"
      ref={ref}
    >
      <div className="cp-cta-pin">
        <div className="cp-cta-row">
          <span
            className="cp-cta-side cp-cta-side-left"
            style={{ opacity: sideFade }}
          >
            CUSTOM
          </span>

          <div
            className="cp-cta-capsule"
            style={{
              width,
              height,
              borderRadius: radius,
              opacity: capsuleVisible,
            }}
            aria-hidden={capsuleVisible < 0.05}
          >
            <div className="cp-cta-capsule-bg" aria-hidden />
            <div
              className="cp-cta-content"
              style={{
                opacity: content,
                transform: `translate3d(0, ${(1 - content) * 48}px, 0)`,
              }}
            >
              <div className="cp-cta-logo">
                <LogoMark large />
              </div>
              <h2>{CTA.title}</h2>
              <p>{CTA.body}</p>
              <Link href="/login" className="cp-signin">
                Sign in
              </Link>
            </div>
          </div>

          <span
            className="cp-cta-side cp-cta-side-right"
            style={{ opacity: sideFade }}
          >
            ERP
          </span>
        </div>
      </div>
    </section>
  );
}

export function ConnectPlusLanding() {
  const [ready, setReady] = useState(false);
  useLenis();

  useEffect(() => {
    setReady(true);
    // The app shell clips horizontal overflow, which disables position:sticky,
    // and its `scroll-behavior: smooth` fights Lenis on programmatic scrolls.
    const { documentElement: html, body } = document;
    const prev = {
      html: html.style.overflowX,
      body: body.style.overflowX,
      behavior: html.style.scrollBehavior,
      bg: body.style.background,
    };
    html.style.overflowX = "visible";
    body.style.overflowX = "visible";
    html.style.scrollBehavior = "auto";
    body.style.background = "#05070f";
    return () => {
      html.style.overflowX = prev.html;
      body.style.overflowX = prev.body;
      html.style.scrollBehavior = prev.behavior;
      body.style.background = prev.bg;
    };
  }, []);

  return (
    <div className="cp-landing" data-ready={ready ? "1" : "0"}>
      <Header />
      <main>
        <HeroSection />
        <FeaturesSlider />
        <SolutionSection />
        <NumbersSection />
        <CtaSection />
      </main>
    </div>
  );
}
