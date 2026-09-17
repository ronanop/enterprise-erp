"use client";

/**
 * Platform home — Apple monochrome chrome; color only on charts + alerts.
 * Spec: design-system/.../pages/home.md + Figma file Connect Plus — Home.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Boxes,
  Building2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Factory,
  FileText,
  GitBranch,
  Handshake,
  Headphones,
  IndianRupee,
  LayoutDashboard,
  Megaphone,
  Package,
  PieChart,
  RefreshCw,
  Shield,
  ShoppingCart,
  Target,
  Truck,
  Users,
  Wallet,
  Mail,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  PlatformConnectedPipelineChart,
  PlatformModuleActivityChart,
  PlatformModuleHealthDonut,
  PlatformModuleShareDonut,
} from "@/components/platform/platform-dashboard-charts";
import { Button } from "@/components/ui/button";
import { erpModules } from "@/config/modules";
import { useAuthUser } from "@/hooks/use-auth-user";
import { welcomeDisplayName } from "@/lib/welcome-display-name";
import { canAccessHref, hasModuleAssignments } from "@/lib/module-access";
import { cn } from "@/lib/utils";
import {
  loadPlatformDashboard,
  type ModuleAnalytics,
  type PlatformDashboardData,
} from "@/services/platform-dashboard-service";

const APPLE_TYPE =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif';

const MODULE_ICONS: Record<string, LucideIcon> = {
  crm: Handshake,
  finance: Wallet,
  procurement: Truck,
  hr: Users,
  payroll: IndianRupee,
  recruitment: Users,
  inventory: Package,
  manufacturing: Factory,
  projects: Target,
  assets: Boxes,
  quality: Shield,
  marketing: Megaphone,
  grc: Shield,
  documents: FileText,
  analytics: BarChart3,
  service: Activity,
  sales: ShoppingCart,
  ecommerce: ShoppingCart,
  portal: LayoutDashboard,
  integration: GitBranch,
  email: Megaphone,
  "voice-agent": Activity,
  helpdesk: Headphones,
  foundation: Shield,
  organization: Building2,
};

function moduleIcon(key: string): LucideIcon {
  return MODULE_ICONS[key] ?? LayoutDashboard;
}

function formatCount(n: number) {
  return n.toLocaleString("en-IN");
}

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function statusMeta(status: ModuleAnalytics["status"]) {
  if (status === "ok") {
    return {
      label: "Live",
      icon: CheckCircle2,
      // monochrome for live
      tone: "text-[#1d1d1f] bg-[#f5f5f7] border-[#e8e8ed]",
      bar: "bg-[#1d1d1f]",
    };
  }
  if (status === "partial") {
    return {
      label: "Partial",
      icon: AlertTriangle,
      // alert color allowed
      tone: "text-amber-900 bg-amber-50 border-amber-300",
      bar: "bg-amber-500",
    };
  }
  return {
    label: "Offline",
    icon: XCircle,
    tone: "text-[#6e6e73] bg-[#f5f5f7] border-[#e8e8ed]",
    bar: "bg-[#d2d2d7]",
  };
}

function HomeCard({
  title,
  subtitle,
  icon: Icon,
  children,
  delayMs = 0,
  className,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  children: ReactNode;
  delayMs?: number;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "home-rise rounded-2xl border border-[#e8e8ed] bg-white p-5 transition-[box-shadow,transform] duration-200 hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)]",
        className,
      )}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <div className="mb-4 flex items-start gap-3">
        {Icon ? (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#f5f5f7] text-[#1d1d1f]">
            <Icon className="size-4" strokeWidth={1.75} aria-hidden />
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-[#1d1d1f]">{title}</h2>
          {subtitle ? (
            <p className="mt-0.5 text-[12px] leading-snug text-[#6e6e73]">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function DepartmentAnalyticsTable({
  modules,
  maxRecords,
  loading,
}: {
  modules: ModuleAnalytics[];
  maxRecords: number;
  loading?: boolean;
}) {
  if (loading && !modules.length) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-[#f5f5f7]" />
        ))}
      </div>
    );
  }

  if (!modules.length) {
    return (
      <p className="py-10 text-center text-sm text-[#6e6e73]">No module analytics available.</p>
    );
  }

  return (
    <div className="erp-scroll overflow-x-auto rounded-xl border border-[#e8e8ed]">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-[#e8e8ed] bg-[#f5f5f7] text-[11px] font-medium tracking-wide text-[#86868b] uppercase">
            <th className="px-3 py-2.5">#</th>
            <th className="px-3 py-2.5">Department</th>
            <th className="px-3 py-2.5">Status</th>
            <th className="px-3 py-2.5 text-right">Records</th>
            <th className="hidden px-3 py-2.5 md:table-cell">Volume</th>
            <th className="px-3 py-2.5">Key metrics</th>
            <th className="px-3 py-2.5 text-right">Open</th>
          </tr>
        </thead>
        <tbody>
          {modules.map((mod, index) => {
            const Icon = moduleIcon(mod.key);
            const meta = statusMeta(mod.status);
            const StatusIcon = meta.icon;
            const pct = maxRecords > 0 ? Math.round((mod.recordCount / maxRecords) * 100) : 0;
            const kpis = mod.kpis.slice(0, 3);

            return (
              <tr
                key={mod.key}
                className="border-b border-[#e8e8ed]/80 transition-colors duration-200 last:border-0 hover:bg-[#f5f5f7]/70"
              >
                <td className="px-3 py-3 text-[11px] tabular-nums text-[#86868b]">{index + 1}</td>
                <td className="px-3 py-3">
                  <Link
                    href={mod.href}
                    className="group inline-flex max-w-[220px] cursor-pointer items-center gap-2.5"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#f5f5f7] text-[#1d1d1f] transition-colors duration-200 group-hover:bg-[#e8e8ed]">
                      <Icon className="size-3.5" strokeWidth={1.75} aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium tracking-[-0.01em] text-[#1d1d1f] group-hover:underline">
                        {mod.title}
                      </span>
                      <span className="block truncate text-[10px] text-[#86868b]">{mod.key}</span>
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-3">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                      meta.tone,
                    )}
                  >
                    <StatusIcon className="size-3" strokeWidth={1.75} aria-hidden />
                    {meta.label}
                  </span>
                </td>
                <td className="px-3 py-3 text-right font-semibold tabular-nums tracking-[-0.02em] text-[#1d1d1f]">
                  {formatCount(mod.recordCount)}
                </td>
                <td className="hidden px-3 py-3 md:table-cell">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[#e8e8ed]">
                      <div
                        className={cn("h-full rounded-full transition-all duration-300", meta.bar)}
                        style={{ width: `${Math.max(pct, mod.recordCount > 0 ? 6 : 0)}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-[10px] tabular-nums text-[#86868b]">{pct}%</span>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {kpis.length ? (
                      kpis.map((kpi) => (
                        <span
                          key={kpi.label}
                          className="inline-flex max-w-[160px] items-baseline gap-1 rounded-md bg-[#f5f5f7] px-1.5 py-0.5"
                          title={kpi.hint}
                        >
                          <span className="truncate text-[10px] text-[#86868b]">{kpi.label}</span>
                          <span className="shrink-0 text-[11px] font-semibold tabular-nums text-[#1d1d1f]">
                            {kpi.value}
                          </span>
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-[#86868b]">No KPIs</span>
                    )}
                  </div>
                  {mod.errors[0] ? (
                    <p className="mt-1 max-w-xs truncate text-[10px] text-amber-800" title={mod.errors[0]}>
                      {mod.errors[0]}
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-3 text-right">
                  <Link
                    href={mod.href}
                    className="inline-flex cursor-pointer items-center gap-0.5 text-[11px] font-medium text-[#1d1d1f] transition-opacity duration-200 hover:opacity-60"
                  >
                    Hub
                    <ArrowUpRight className="size-3" strokeWidth={1.75} aria-hidden />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function HealthSummaryStrip({
  health,
  tracked,
  loading,
}: {
  health: PlatformDashboardData["moduleHealth"];
  tracked: number;
  loading?: boolean;
}) {
  const live = health.find((h) => h.name === "Live")?.value ?? 0;
  const partial = health.find((h) => h.name === "Partial")?.value ?? 0;
  const offline = health.find((h) => h.name === "Offline")?.value ?? 0;
  const total = live + partial + offline || tracked;
  const coverage = total ? Math.round((live / total) * 100) : 0;

  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-[#f5f5f7] px-3 py-2.5">
          <p className="text-[10px] font-medium tracking-wide text-[#86868b] uppercase">Live</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums tracking-[-0.03em] text-[#1d1d1f]">
            {loading ? "—" : live}
          </p>
        </div>
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5">
          <p className="text-[10px] font-medium tracking-wide text-amber-900/80 uppercase">Partial</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums tracking-[-0.03em] text-amber-950">
            {loading ? "—" : partial}
          </p>
        </div>
        <div className="rounded-xl bg-[#f5f5f7] px-3 py-2.5">
          <p className="text-[10px] font-medium tracking-wide text-[#86868b] uppercase">Offline</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums tracking-[-0.03em] text-[#1d1d1f]">
            {loading ? "—" : offline}
          </p>
        </div>
      </div>
      <div className="flex min-w-[180px] items-center gap-3 rounded-xl border border-[#e8e8ed] bg-white px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="text-[#6e6e73]">API coverage</span>
            <span className="font-semibold tabular-nums text-[#1d1d1f]">
              {loading ? "—" : `${coverage}%`}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#e8e8ed]">
            <div
              className="h-full rounded-full bg-[#1d1d1f] transition-all duration-300"
              style={{ width: `${loading ? 0 : coverage}%` }}
            />
          </div>
        </div>
        <div className="h-14 w-14 shrink-0">
          <PlatformModuleHealthDonut data={health} loading={loading} compact />
        </div>
      </div>
    </div>
  );
}

export function PlatformDashboard() {
  const {
    user,
    moduleKeys,
    adminModuleKeys,
    loading: authLoading,
    status: authStatus,
    error: authError,
    refresh,
  } = useAuthUser();
  const [data, setData] = useState<PlatformDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const visibleModules = useMemo(
    () =>
      erpModules.filter((mod) =>
        canAccessHref(mod.href, moduleKeys, user?.userType, adminModuleKeys),
      ),
    [adminModuleKeys, moduleKeys, user?.userType],
  );

  const load = useCallback(async () => {
    if (authLoading || authStatus !== "authenticated") return;
    setLoading(true);
    try {
      setData(await loadPlatformDashboard(moduleKeys, user?.userType, adminModuleKeys));
    } finally {
      setLoading(false);
    }
  }, [adminModuleKeys, authLoading, authStatus, moduleKeys, user?.userType]);

  useEffect(() => {
    void load();
  }, [load]);

  const moduleActivityChart = useMemo(
    () => (data?.moduleActivity ?? []).map((row) => ({ name: row.name, count: row.count })),
    [data],
  );

  const pipelineChart = useMemo(
    () => (data?.connectedPipeline ?? []).map((row) => ({ stage: row.stage, count: row.count })),
    [data],
  );

  const maxModuleRecords = useMemo(
    () => Math.max(...(data?.modules ?? []).map((row) => row.recordCount), 1),
    [data],
  );

  const headline = data?.executive ?? [];
  const authBlocked = Boolean(data?.authBlocked) || Boolean(data?.partial && authStatus !== "authenticated");
  const tracked = data?.modules.length ?? 0;
  const showLoading = loading || authLoading || authStatus === "loading";
  const hasModules = hasModuleAssignments(moduleKeys, user?.userType, adminModuleKeys);
  const displayName = welcomeDisplayName(user?.displayName, user?.email);

  const shell = (children: ReactNode) => (
    <div className="home-shell -mx-1 space-y-7 px-1 pb-2" style={{ fontFamily: APPLE_TYPE }}>
      <style>{`
        .home-shell .home-rise {
          animation: home-rise 650ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @keyframes home-rise {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .home-shell .home-rise {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>
      {children}
    </div>
  );

  if (authStatus === "error") {
    return shell(
      <>
        <header className="home-rise">
          <p className="text-[13px] font-medium tracking-[0.04em] text-[#86868b]">{timeGreeting()}</p>
          <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.04em] text-[#1d1d1f] sm:text-[2.5rem]">
            Welcome home
          </h1>
        </header>
        <div className="home-rise rounded-2xl border border-[#e8e8ed] bg-white px-6 py-10 text-center" style={{ animationDelay: "80ms" }}>
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#f5f5f7]">
            <Shield className="size-5 text-[#6e6e73]" strokeWidth={1.75} aria-hidden />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-[#1d1d1f]">Session loading failed</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#6e6e73]">
            {authError || "Retry to restore your modules. Your account is still signed in."}
          </p>
          <Button
            type="button"
            className="mt-5 cursor-pointer rounded-full bg-[#1d1d1f] text-white hover:bg-black"
            onClick={() => void refresh()}
          >
            Retry
          </Button>
        </div>
      </>,
    );
  }

  if (!showLoading && authStatus === "authenticated" && user && !hasModules) {
    return shell(
      <>
        <header className="home-rise">
          <p className="text-[13px] font-medium tracking-[0.04em] text-[#86868b]">{timeGreeting()}</p>
          <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.04em] text-[#1d1d1f] sm:text-[2.5rem]">
            {displayName}
          </h1>
          <p className="mt-2 text-[15px] text-[#6e6e73]">
            Your account is active, but no modules have been assigned yet.
          </p>
        </header>
        <div className="home-rise rounded-2xl border border-[#e8e8ed] bg-white px-6 py-10 text-center" style={{ animationDelay: "80ms" }}>
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#f5f5f7]">
            <Shield className="size-5 text-[#6e6e73]" strokeWidth={1.75} aria-hidden />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-[#1d1d1f]">No modules assigned</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#6e6e73]">
            Contact your ERP administrator. Once assigned, modules appear in the sidebar and here.
          </p>
          <a
            href="mailto:techbank@cachedigitech.com"
            className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#e8e8ed] bg-white px-4 py-2 text-sm font-medium text-[#1d1d1f] transition-colors duration-200 hover:bg-[#f5f5f7]"
          >
            <Mail className="size-4" strokeWidth={1.75} aria-hidden />
            Contact admin
          </a>
        </div>
      </>,
    );
  }

  const kpis =
    headline.length > 0
      ? headline.slice(0, 4)
      : [
          { label: "Modules", value: String(visibleModules.length), hint: "Assigned" },
          { label: "Records", value: "—", hint: "Tracked" },
          { label: "Live feeds", value: "—", hint: "Healthy" },
          { label: "Coverage", value: "—", hint: "API" },
        ];

  return shell(
    <>
      <header className="home-rise flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[13px] font-medium tracking-[0.04em] text-[#86868b]">{timeGreeting()}</p>
          <h1 className="mt-2 text-[2rem] font-semibold leading-[1.05] tracking-[-0.045em] text-[#1d1d1f] sm:text-[2.5rem]">
            {displayName !== "there" ? displayName : "Welcome home"}
          </h1>
          <p className="mt-2 max-w-xl text-[15px] leading-snug text-[#6e6e73]">
            KPIs and activity for modules assigned to your account.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {data?.loadedAt ? (
            <span className="text-[11px] text-[#86868b]">
              Updated{" "}
              {new Date(data.loadedAt).toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 cursor-pointer rounded-full border-[#e8e8ed] bg-white px-4 text-[#1d1d1f] transition-colors duration-200 hover:bg-[#f5f5f7]"
            disabled={showLoading}
            onClick={() => void load()}
          >
            <RefreshCw className={cn("size-3.5", showLoading && "animate-spin")} strokeWidth={1.75} />
            Refresh
          </Button>
        </div>
      </header>

      {authBlocked ? (
        <div className="home-rise rounded-2xl border border-[#e8e8ed] bg-[#f5f5f7] px-4 py-3 text-sm text-[#6e6e73]" style={{ animationDelay: "40ms" }}>
          Sign in to load live analytics.{" "}
          <Link href="/login" className="cursor-pointer font-medium text-[#1d1d1f] underline underline-offset-2">
            Go to login
          </Link>
        </div>
      ) : null}

      {data?.partial && !authBlocked ? (
        <div
          className="home-rise rounded-2xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs text-amber-950"
          style={{ animationDelay: "60ms" }}
          role="status"
        >
          Some module endpoints were slow or unavailable. Showing available analytics — refresh or check module health.
        </div>
      ) : null}

      <div
        className="home-rise grid overflow-hidden rounded-2xl border border-[#e8e8ed] bg-white sm:grid-cols-2 lg:grid-cols-4"
        style={{ animationDelay: "100ms" }}
      >
        {kpis.map((stat, i) => (
          <div
            key={stat.label}
            className={cn(
              "min-w-0 px-5 py-5",
              i > 0 && "border-t border-[#e8e8ed] sm:border-t-0 sm:border-l",
              i === 2 && "lg:border-l",
            )}
          >
            <p className="text-[11px] font-medium tracking-[0.08em] text-[#86868b] uppercase">
              {stat.label}
            </p>
            {showLoading ? (
              <div className="mt-2 h-8 w-24 animate-pulse rounded bg-[#f5f5f7]" />
            ) : (
              <p className="mt-1.5 truncate text-[1.75rem] font-semibold tracking-[-0.04em] text-[#1d1d1f] tabular-nums">
                {stat.value}
              </p>
            )}
            {stat.hint ? <p className="mt-1 text-[11px] text-[#86868b]">{stat.hint}</p> : null}
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <HomeCard
          title="Lead-to-delivery"
          subtitle="Pipeline stage counts"
          icon={GitBranch}
          delayMs={160}
        >
          <PlatformConnectedPipelineChart data={pipelineChart} loading={showLoading} />
        </HomeCard>
        <HomeCard
          title="Module activity"
          subtitle="Record volume by department"
          icon={BarChart3}
          delayMs={200}
        >
          <PlatformModuleActivityChart data={moduleActivityChart} loading={showLoading} />
        </HomeCard>
        <HomeCard
          title="Department share"
          subtitle="Mix across top modules"
          icon={PieChart}
          delayMs={240}
        >
          <PlatformModuleShareDonut
            data={(data?.moduleActivity ?? []).map((row) => ({
              name: row.name,
              value: row.count,
            }))}
            loading={showLoading}
          />
          <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-[#e8e8ed] pt-3">
            {(data?.moduleActivity ?? []).slice(0, 6).map((row, index) => {
              const total = (data?.moduleActivity ?? []).reduce((sum, r) => sum + r.count, 0) || 1;
              const pct = Math.round((row.count / total) * 100);
              const hues = ["#1d1d1f", "#4b5563", "#6b7280", "#9ca3af", "#0071e3", "#34c759"];
              return (
                <li key={row.name} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="flex min-w-0 items-center gap-1.5 truncate text-[#6e6e73]">
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: hues[index % hues.length] }}
                    />
                    {row.name}
                  </span>
                  <span className="font-medium tabular-nums text-[#1d1d1f]">{pct}%</span>
                </li>
              );
            })}
          </ul>
        </HomeCard>
      </div>

      <HomeCard
        title="Departments"
        subtitle="Status, volume, and KPIs — alerts use color; chrome stays monochrome."
        icon={LayoutDashboard}
        delayMs={280}
      >
        <HealthSummaryStrip
          health={data?.moduleHealth ?? []}
          tracked={tracked}
          loading={showLoading}
        />
        <DepartmentAnalyticsTable
          modules={data?.modules ?? []}
          maxRecords={maxModuleRecords}
          loading={showLoading}
        />
      </HomeCard>
    </>,
  );
}
