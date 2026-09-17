"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Boxes,
  Building2,
  CheckCircle2,
  Handshake,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Package,
  Shield,
  ShoppingCart,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  clearAccessGateToken,
  fetchAccessGateSession,
  getAccessGateToken,
} from "@/services/access-gate-service";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  icon: LucideIcon;
  hint: string;
};

const NAV: NavItem[] = [
  { label: "Overview", icon: LayoutDashboard, hint: "Executive snapshot" },
  { label: "CRM", icon: Handshake, hint: "Pipeline & quotes" },
  { label: "Finance", icon: Wallet, hint: "GL & journals" },
  { label: "Procurement", icon: ShoppingCart, hint: "PO & vendors" },
  { label: "Inventory", icon: Package, hint: "Stock health" },
  { label: "HR", icon: Users, hint: "People & attendance" },
  { label: "Assets", icon: Boxes, hint: "Lifecycle & DC" },
  { label: "Marketing", icon: Megaphone, hint: "Campaigns" },
  { label: "GRC", icon: Shield, hint: "Risk & controls" },
  { label: "Analytics", icon: BarChart3, hint: "Live KPIs" },
];

const KPIS = [
  { label: "Open pipeline", value: "₹4.8 Cr", delta: "+12%", tone: "up" as const },
  { label: "Collections due", value: "₹62 L", delta: "8 invoices", tone: "neutral" as const },
  { label: "Active POs", value: "47", delta: "3 delayed", tone: "warn" as const },
  { label: "Attendance today", value: "96%", delta: "412 / 429", tone: "up" as const },
];

const MODULE_CARDS = [
  {
    title: "Sales blueprint",
    body: "Lead → Opportunity → Quote → OVF with gated approvals.",
    meta: "12 deals in approval",
    icon: Handshake,
  },
  {
    title: "Finance controls",
    body: "Tenant-isolated journals with soft-delete and audit columns.",
    meta: "Last close: T-2",
    icon: IndianRupee,
  },
  {
    title: "Ops pulse",
    body: "Inventory, assets, and service tickets share one identity graph.",
    meta: "4 SLA breaches",
    icon: Activity,
  },
  {
    title: "Org readiness",
    body: "RBAC + SSO ready for your ConnectPlus production cutover.",
    meta: "Demo mode",
    icon: Building2,
  },
];

const ACTIVITY = [
  { when: "2m ago", text: "Quote QT-1042 submitted for margin review" },
  { when: "18m ago", text: "Journal JV-889 posted to company Cache Digitech" },
  { when: "1h ago", text: "PO-331 received against warehouse WH-BLR-01" },
  { when: "3h ago", text: "Risk RSK-17 residual score updated to Medium" },
];

export function DemoErpShell() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [denied, setDenied] = useState(false);
  const [active, setActive] = useState("Overview");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = getAccessGateToken();
      if (!token) {
        if (!cancelled) {
          setDenied(true);
          setReady(true);
        }
        return;
      }
      try {
        const session = await fetchAccessGateSession(token);
        if (cancelled) return;
        if (session.target !== "demo") {
          clearAccessGateToken();
          setDenied(true);
        }
      } catch {
        if (!cancelled) {
          clearAccessGateToken();
          setDenied(true);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (ready && denied) {
      router.replace("/");
    }
  }, [ready, denied, router]);

  const activeNav = useMemo(
    () => NAV.find((n) => n.label === active) ?? NAV[0],
    [active],
  );

  if (!ready || denied) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#F8FAFC] text-sm text-[#5A6070]">
        {denied ? "Redirecting to sign in…" : "Opening demo workspace…"}
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#F8FAFC] text-[#0F172A]">
      <div className="border-b border-[#E4ECFC] bg-[#0F172A] text-white">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <p className="text-xs font-medium tracking-wide sm:text-sm">
            <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-emerald-300">
              Demo ERP
            </span>
            <span className="ml-2 text-slate-300">
              Sample data for sales walkthroughs — not connected to production.
            </span>
          </p>
          <Link
            href="/"
            onClick={() => clearAccessGateToken()}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-slate-200 transition-colors duration-200 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <LogOut className="size-3.5" aria-hidden />
            Exit
          </Link>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1440px]">
        <aside className="sticky top-0 hidden h-[calc(100dvh-2.75rem)] w-56 shrink-0 flex-col border-r border-[#E4ECFC] bg-white py-4 lg:flex">
          <div className="px-4 pb-4">
            <p className="text-sm font-semibold tracking-tight">iConnect Plus</p>
            <p className="text-xs text-[#64748B]">Enterprise demo</p>
          </div>
          <nav aria-label="Demo modules" className="flex flex-1 flex-col gap-0.5 px-2">
            {NAV.map((item) => {
              const Icon = item.icon;
              const isActive = item.label === active;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setActive(item.label)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-[background-color,color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]",
                    isActive
                      ? "bg-[#EFF6FF] font-semibold text-[#1D4ED8]"
                      : "text-[#334155] hover:bg-[#F8FAFC]",
                  )}
                >
                  <Icon className="size-4 shrink-0 opacity-80" aria-hidden />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">
          <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748B]">
                {activeNav.hint}
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
                {activeNav.label}
              </h1>
            </div>
            <div className="flex flex-wrap gap-2 lg:hidden">
              {NAV.slice(0, 5).map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setActive(item.label)}
                  className={cn(
                    "cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-200",
                    item.label === active
                      ? "border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]"
                      : "border-[#E4ECFC] bg-white text-[#475569] hover:bg-[#F8FAFC]",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </header>

          <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {KPIS.map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-xl border border-[#E4ECFC] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              >
                <p className="text-xs font-medium text-[#64748B]">{kpi.label}</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight">{kpi.value}</p>
                <p
                  className={cn(
                    "mt-1 text-xs font-medium",
                    kpi.tone === "up" && "text-emerald-600",
                    kpi.tone === "warn" && "text-amber-600",
                    kpi.tone === "neutral" && "text-[#64748B]",
                  )}
                >
                  {kpi.delta}
                </p>
              </div>
            ))}
          </section>

          <section className="mb-6 grid gap-4 lg:grid-cols-2">
            {MODULE_CARDS.map((card) => {
              const Icon = card.icon;
              return (
                <article
                  key={card.title}
                  className="rounded-xl border border-[#E4ECFC] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow] duration-200 hover:border-[#BFDBFE] hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#2563EB]">
                      <Icon className="size-5" aria-hidden />
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-[#2563EB]">
                      Explore
                      <ArrowUpRight className="size-3.5" aria-hidden />
                    </span>
                  </div>
                  <h2 className="mt-4 text-base font-semibold">{card.title}</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#64748B]">
                    {card.body}
                  </p>
                  <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[#0F172A]">
                    <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden />
                    {card.meta}
                  </p>
                </article>
              );
            })}
          </section>

          <section className="rounded-xl border border-[#E4ECFC] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <h2 className="text-sm font-semibold">Recent activity</h2>
            <ul className="mt-3 divide-y divide-[#E4ECFC]">
              {ACTIVITY.map((row) => (
                <li
                  key={row.text}
                  className="flex flex-col gap-0.5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <p className="text-sm text-[#334155]">{row.text}</p>
                  <p className="shrink-0 text-xs text-[#94A3B8]">{row.when}</p>
                </li>
              ))}
            </ul>
          </section>

          <p className="mt-8 text-center text-xs text-[#94A3B8]">
            Want the live ConnectPlus ERP? Use your ConnectPlus access code from the
            landing Sign in dialog.
          </p>
        </main>
      </div>
    </div>
  );
}
