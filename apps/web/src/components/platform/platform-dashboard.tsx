"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  CrmHeadlineBand,
  CrmHeadlineStat,
  CrmSection,
} from "@/components/crm/crm-ui";
import {
  PlatformConnectedPipelineChart,
  PlatformModuleActivityChart,
  PlatformModuleHealthDonut,
  PlatformModuleShareDonut,
} from "@/components/platform/platform-dashboard-charts";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { erpModules } from "@/config/modules";
import { useAuthUser } from "@/hooks/use-auth-user";
import { isAuthenticated } from "@/lib/auth";
import { canAccessHref } from "@/lib/module-access";
import { cn } from "@/lib/utils";
import {
  loadPlatformDashboard,
  type ModuleAnalytics,
  type PlatformDashboardData,
} from "@/services/platform-dashboard-service";

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

function statusMeta(status: ModuleAnalytics["status"]) {
  if (status === "ok") {
    return {
      label: "Live",
      badge: "success" as const,
      icon: CheckCircle2,
      tone: "text-emerald-700 bg-emerald-50 border-emerald-200",
      bar: "bg-emerald-500",
      dot: "bg-emerald-500",
    };
  }
  if (status === "partial") {
    return {
      label: "Partial",
      badge: "secondary" as const,
      icon: AlertTriangle,
      tone: "text-amber-800 bg-amber-50 border-amber-200",
      bar: "bg-amber-500",
      dot: "bg-amber-500",
    };
  }
  return {
    label: "Offline",
    badge: "destructive" as const,
    icon: XCircle,
    tone: "text-slate-700 bg-slate-100 border-slate-200",
    bar: "bg-slate-400",
    dot: "bg-slate-400",
  };
}

function formatCount(n: number) {
  return n.toLocaleString("en-IN");
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
          <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/40" />
        ))}
      </div>
    );
  }

  if (!modules.length) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No module analytics available.</p>;
  }

  return (
    <div className="erp-scroll overflow-x-auto rounded-lg border border-border/70">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-border/70 bg-[#eef2f6] text-[11px] font-medium text-muted-foreground">
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
                className="border-b border-border/50 transition-colors duration-150 last:border-0 hover:bg-accent/30"
              >
                <td className="px-3 py-2.5 text-[11px] tabular-nums text-muted-foreground">{index + 1}</td>
                <td className="px-3 py-2.5">
                  <Link
                    href={mod.href}
                    className="group inline-flex max-w-[200px] cursor-pointer items-center gap-2"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-800">
                      <Icon className="size-3.5" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-foreground group-hover:underline">
                        {mod.title}
                      </span>
                      <span className="block truncate text-[10px] text-muted-foreground">{mod.key}</span>
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                      meta.tone,
                    )}
                  >
                    <StatusIcon className="size-3" aria-hidden />
                    {meta.label}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-foreground">
                  {formatCount(mod.recordCount)}
                </td>
                <td className="hidden px-3 py-2.5 md:table-cell">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full transition-all duration-300", meta.bar)}
                        style={{ width: `${Math.max(pct, mod.recordCount > 0 ? 6 : 0)}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-[10px] tabular-nums text-muted-foreground">{pct}%</span>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {kpis.length ? (
                      kpis.map((kpi) => (
                        <span
                          key={kpi.label}
                          className="inline-flex max-w-[160px] items-baseline gap-1 rounded-md bg-muted/50 px-1.5 py-0.5"
                          title={kpi.hint}
                        >
                          <span className="truncate text-[10px] text-muted-foreground">{kpi.label}</span>
                          <span className="shrink-0 text-[11px] font-semibold tabular-nums text-foreground">
                            {kpi.value}
                          </span>
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-muted-foreground">No KPIs</span>
                    )}
                  </div>
                  {mod.errors[0] ? (
                    <p className="mt-1 max-w-xs truncate text-[10px] text-amber-800" title={mod.errors[0]}>
                      {mod.errors[0]}
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <Link
                    href={mod.href}
                    className="inline-flex cursor-pointer items-center gap-0.5 text-[11px] font-medium text-sky-700 transition-colors duration-200 hover:text-sky-900"
                  >
                    Hub
                    <ArrowUpRight className="size-3" aria-hidden />
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
    <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/80 px-2.5 py-2">
          <p className="text-[10px] font-medium text-emerald-800/80 uppercase">Live</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-emerald-900">
            {loading ? "—" : live}
          </p>
        </div>
        <div className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-2.5 py-2">
          <p className="text-[10px] font-medium text-amber-900/80 uppercase">Partial</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-amber-950">
            {loading ? "—" : partial}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
          <p className="text-[10px] font-medium text-slate-600 uppercase">Offline</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-800">
            {loading ? "—" : offline}
          </p>
        </div>
      </div>
      <div className="flex min-w-[180px] items-center gap-3 rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="text-muted-foreground">API coverage</span>
            <span className="font-semibold tabular-nums text-foreground">
              {loading ? "—" : `${coverage}%`}
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-600 transition-all duration-300"
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
  const { user, moduleKeys, loading: authLoading } = useAuthUser();
  const [data, setData] = useState<PlatformDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const authenticated = typeof window !== "undefined" ? isAuthenticated() : false;

  const visibleModules = useMemo(
    () => erpModules.filter((mod) => canAccessHref(mod.href, moduleKeys, user?.userType)),
    [moduleKeys, user?.userType],
  );

  const load = useCallback(async () => {
    if (authLoading) return;
    setLoading(true);
    try {
      setData(await loadPlatformDashboard(moduleKeys, user?.userType));
    } finally {
      setLoading(false);
    }
  }, [authLoading, moduleKeys, user?.userType]);

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
  const authBlocked = Boolean(data?.authBlocked) || (!authenticated && Boolean(data?.partial));
  const tracked = data?.modules.length ?? 0;
  const showLoading = loading || authLoading;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Enterprise analytics"
        description="KPIs and activity for the modules assigned to your account."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{visibleModules.length} modules</Badge>
            {data?.loadedAt ? (
              <span className="hidden text-[11px] text-muted-foreground sm:inline">
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
              className="cursor-pointer"
              disabled={showLoading}
              onClick={() => void load()}
            >
              <RefreshCw className={cn("size-3.5", showLoading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        }
      />

      {authBlocked ? (
        <div className="rounded-xl border border-border/80 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Sign in to load live analytics across modules.{" "}
          <Link href="/login" className="cursor-pointer font-medium text-primary underline underline-offset-2">
            Go to login
          </Link>
        </div>
      ) : null}

      {data?.partial && !authBlocked ? (
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 px-4 py-2.5 text-xs text-amber-950">
          Some module endpoints returned errors. Showing available analytics only — check Module health for details.
        </div>
      ) : null}

      <CrmHeadlineBand>
        <div
          className={cn(
            "grid divide-y divide-white/10 sm:divide-x sm:divide-y-0",
            headline.length <= 1
              ? "sm:grid-cols-1"
              : headline.length === 2
                ? "sm:grid-cols-2"
                : headline.length === 3
                  ? "sm:grid-cols-3"
                  : "sm:grid-cols-2 lg:grid-cols-4",
          )}
        >
          {(headline.length ? headline.slice(0, 4) : [{ label: "Modules", value: "—", hint: "Assigned modules" }]).map(
            (stat) => (
              <CrmHeadlineStat
                key={stat.label}
                label={stat.label}
                value={stat.value}
                sub={stat.hint}
                loading={showLoading}
              />
            ),
          )}
        </div>
      </CrmHeadlineBand>

      <div className="grid gap-3 xl:grid-cols-3">
        <CrmSection
          title="Lead-to-delivery flow"
          subtitle="Stage counts for your assigned CRM, procurement, and projects modules"
          icon={GitBranch}
          badge={<Badge variant="secondary">Pipeline</Badge>}
        >
          <PlatformConnectedPipelineChart data={pipelineChart} loading={showLoading} />
        </CrmSection>

        <CrmSection
          title="Module activity"
          subtitle="Absolute record volume by assigned department"
          icon={BarChart3}
          badge={<Badge variant="secondary">Volume</Badge>}
        >
          <PlatformModuleActivityChart data={moduleActivityChart} loading={showLoading} />
        </CrmSection>

        <CrmSection
          title="Department share"
          subtitle="How total tracked records split across top modules"
          icon={PieChart}
          badge={<Badge variant="secondary">Mix</Badge>}
        >
          <PlatformModuleShareDonut
            data={(data?.moduleActivity ?? []).map((row) => ({
              name: row.name,
              value: row.count,
            }))}
            loading={showLoading}
          />
          <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-border/60 pt-2">
            {(data?.moduleActivity ?? []).slice(0, 6).map((row, index) => {
              const total = (data?.moduleActivity ?? []).reduce((sum, r) => sum + r.count, 0) || 1;
              const pct = Math.round((row.count / total) * 100);
              return (
                <li key={row.name} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="flex min-w-0 items-center gap-1.5 truncate text-muted-foreground">
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor: `hsl(${205 - index * 12}, 65%, ${38 + index * 3}%)`,
                      }}
                    />
                    {row.name}
                  </span>
                  <span className="font-medium tabular-nums text-foreground">{pct}%</span>
                </li>
              );
            })}
          </ul>
        </CrmSection>
      </div>

      <CrmSection
        title="Department analytics & health"
        subtitle="Status, record volume, and KPIs for modules you can access"
        icon={LayoutDashboard}
        badge={<Badge variant="outline">{tracked} modules</Badge>}
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
      </CrmSection>
    </div>
  );
}
