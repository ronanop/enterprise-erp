"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Bell,
  FileBarChart,
  LayoutDashboard,
  RefreshCw,
  Target,
} from "lucide-react";

import { AnalyticsPipelineFunnel } from "@/components/analytics/analytics-pipeline-funnel";
import { FinanceKpiCard } from "@/components/finance/finance-kpi-card";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import {
  analyticsQuickLinks,
  analyticsWorkspaceGroups,
  resolveAnalyticsGroupResources,
} from "@/config/analytics";
import { isAuthenticated } from "@/lib/auth";
import {
  asStatus,
  countByStatus,
  loadAnalyticsOverview,
  type AnalyticsOverview,
  type AnalyticsRow,
} from "@/services/analytics-service";

function recentDashboards(rows: AnalyticsRow[], limit = 6): AnalyticsRow[] {
  return [...rows]
    .sort((a, b) =>
      String(b.dashboard_number ?? b.dashboard_name ?? "").localeCompare(
        String(a.dashboard_number ?? a.dashboard_name ?? ""),
      ),
    )
    .slice(0, limit);
}

function dashboardTypeOf(row: AnalyticsRow): string {
  const raw = row.dashboard_type ?? "";
  return typeof raw === "string" ? raw.toLowerCase() : "";
}

export function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const authenticated = typeof window !== "undefined" ? isAuthenticated() : false;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loadAnalyticsOverview());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const kpis = useMemo(() => {
    if (!data) {
      return {
        dashboards: 0,
        activeKpis: 0,
        activeAlerts: 0,
        reports: 0,
      };
    }
    return {
      dashboards: data.dashboards.length,
      activeKpis: countByStatus(data.kpis, ["active", "published", "approved"]),
      activeAlerts: countByStatus(data.alertRules, ["active", "enabled"]),
      reports: data.reports.length,
    };
  }, [data]);

  const pipelineCounts = useMemo(
    () => ({
      datasets: data?.datasets.length ?? 0,
      metrics: data?.metrics.length ?? 0,
      kpis: data?.kpis.length ?? 0,
      dashboards: data?.dashboards.length ?? 0,
      reports: data?.reports.length ?? 0,
      "alert-rules": data?.alertRules.length ?? 0,
    }),
    [data],
  );

  const recent = useMemo(() => recentDashboards(data?.dashboards ?? []), [data]);

  const alertWatch = useMemo(() => {
    const rows = data?.alertRules ?? [];
    return [...rows]
      .sort((a, b) =>
        String(b.alert_number ?? b.alert_code ?? "").localeCompare(
          String(a.alert_number ?? a.alert_code ?? ""),
        ),
      )
      .slice(0, 5);
  }, [data]);

  const dashboardTypeMix = useMemo(() => {
    const rows = data?.dashboards ?? [];
    const stages = [
      { key: "executive", label: "Executive", barClass: "bg-slate-500" },
      { key: "operational", label: "Operational", barClass: "bg-sky-600" },
      { key: "financial", label: "Financial", barClass: "bg-teal-600" },
      { key: "custom", label: "Custom", barClass: "bg-amber-500" },
    ] as const;
    const total = rows.length || 1;
    return stages.map((s) => {
      const count = rows.filter((row) => dashboardTypeOf(row) === s.key).length;
      return { ...s, count, pct: Math.round((count / total) * 100) };
    });
  }, [data]);

  const authBlocked =
    Boolean(data?.statusCodes.includes(401)) ||
    (!authenticated && Boolean(data?.errors.length));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Analytics"
        description="Business intelligence — dashboards, KPIs, metrics, datasets, reports, alerts, and data exports."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3 text-sm font-medium shadow-sm transition-colors duration-200 hover:bg-muted disabled:opacity-60"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <Link
              href="/analytics/dashboards"
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-opacity duration-200 hover:opacity-90"
            >
              <LayoutDashboard className="size-3.5" />
              Dashboards
            </Link>
            <Link
              href="/analytics/reports"
              className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border/80 bg-card px-3 text-sm font-medium shadow-sm transition-colors duration-200 hover:bg-muted"
            >
              Reports
            </Link>
          </div>
        }
      />

      {authBlocked ? (
        <div className="rounded-xl border border-dashed border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Sign in to load live analytics data.{" "}
          <Link href="/login" className="cursor-pointer font-medium underline underline-offset-2">
            Go to login
          </Link>
        </div>
      ) : null}

      {data?.partial && !authBlocked ? (
        <div className="rounded-xl border border-border/80 bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
          Some analytics endpoints returned errors. Showing available records.
        </div>
      ) : null}

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <FinanceKpiCard
          label="Dashboards"
          value={loading ? "—" : String(kpis.dashboards)}
          hint={`${data?.widgets.length ?? 0} widgets · ${countByStatus(data?.dashboards ?? [], ["published", "active"])} live`}
          icon={LayoutDashboard}
          tone={kpis.dashboards > 0 ? "default" : "success"}
        />
        <FinanceKpiCard
          label="Active KPIs"
          value={loading ? "—" : String(kpis.activeKpis)}
          hint={`${data?.kpis.length ?? 0} KPIs · ${data?.metrics.length ?? 0} metrics`}
          icon={Target}
          tone={kpis.activeKpis > 0 ? "success" : "default"}
        />
        <FinanceKpiCard
          label="Active alerts"
          value={loading ? "—" : String(kpis.activeAlerts)}
          hint={`${data?.alertRules.length ?? 0} rules · ${data?.subscriptions.length ?? 0} subscriptions`}
          icon={Bell}
          tone={kpis.activeAlerts > 0 ? "warning" : "success"}
        />
        <FinanceKpiCard
          label="Reports"
          value={loading ? "—" : String(kpis.reports)}
          hint={`${data?.schedules.length ?? 0} schedules · ${data?.datasets.length ?? 0} datasets`}
          icon={FileBarChart}
          tone={kpis.reports > 0 ? "default" : "success"}
        />
      </div>

      <AnalyticsPipelineFunnel counts={pipelineCounts} loading={loading} />

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {analyticsQuickLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="group flex cursor-pointer items-center gap-3 rounded-xl border border-border/80 bg-card px-3.5 py-3 shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-primary/25 hover:shadow-md"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 text-sm font-medium tracking-tight">
                  {link.title}
                  <ArrowUpRight className="size-3 text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  {link.description}
                </span>
              </span>
            </Link>
          );
        })}
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium tracking-tight">Workspace</h2>
          <Badge variant="secondary">{analyticsWorkspaceGroups.length} areas</Badge>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {analyticsWorkspaceGroups.map((group) => {
            const Icon = group.icon;
            const resources = resolveAnalyticsGroupResources(group);
            return (
              <div
                key={group.key}
                className="rounded-xl border border-border/80 bg-card p-4 shadow-sm"
              >
                <div className="mb-3 flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium tracking-tight">{group.title}</h3>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      {group.description}
                    </p>
                  </div>
                </div>
                <ul className="space-y-1">
                  {resources.map((resource) => (
                    <li key={resource.key}>
                      <Link
                        href={`/analytics/${resource.key}`}
                        className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors duration-200 hover:bg-accent/50"
                      >
                        <span className="font-medium text-foreground">{resource.title}</span>
                        <span className="truncate text-[10px] text-muted-foreground">
                          {resource.description}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-3 xl:grid-cols-[1.3fr_1fr_1fr]">
        <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
            <div>
              <h2 className="text-sm font-medium tracking-tight">Recent dashboards</h2>
              <p className="text-[11px] text-muted-foreground">Executive & operational views</p>
            </div>
            <Link
              href="/analytics/dashboards"
              className="cursor-pointer text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
            >
              View all
            </Link>
          </div>
          <div className="erp-scroll overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                  <th className="px-4 py-2.5 font-medium">Dashboard</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium">Code</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                      Loading…
                    </td>
                  </tr>
                ) : recent.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                      No dashboards yet.
                    </td>
                  </tr>
                ) : (
                  recent.map((row, idx) => (
                    <tr
                      key={String(row.id ?? idx)}
                      className="border-b border-border/50 transition-colors duration-150 last:border-0 hover:bg-accent/30"
                    >
                      <td className="max-w-[220px] truncate px-4 py-2.5">
                        <p className="font-medium text-foreground">
                          {String(row.dashboard_name ?? row.dashboard_number ?? "—")}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {String(row.dashboard_number ?? "")}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 text-xs capitalize text-muted-foreground">
                        {String(row.dashboard_type ?? "—").replaceAll("_", " ")}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {String(row.dashboard_code ?? "—")}
                      </td>
                      <td className="px-4 py-2.5">
                        <FinanceStatusBadge
                          status={asStatus(row.status) || String(row.status ?? "")}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
            <div>
              <h2 className="text-sm font-medium tracking-tight">Alert watch</h2>
              <p className="text-[11px] text-muted-foreground">Threshold rules</p>
            </div>
            <Link
              href="/analytics/alert-rules"
              className="cursor-pointer text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
            >
              View all
            </Link>
          </div>
          <ul className="divide-y divide-border/60">
            {loading ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</li>
            ) : alertWatch.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                No alert rules yet.
              </li>
            ) : (
              alertWatch.map((row, idx) => (
                <li
                  key={String(row.id ?? idx)}
                  className="px-4 py-2.5 transition-colors duration-150 hover:bg-accent/30"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">
                      {String(row.alert_number ?? row.alert_code ?? "—")}
                    </p>
                    <FinanceStatusBadge
                      status={asStatus(row.status) || String(row.status ?? "")}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {String(row.alert_name ?? "alert").replaceAll("_", " ")} ·{" "}
                    {String(row.severity ?? "info")}
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="mb-3">
            <h2 className="text-sm font-medium tracking-tight">Dashboard type mix</h2>
            <p className="text-[11px] text-muted-foreground">FRD-18 §4–§5</p>
          </div>
          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="space-y-3">
              {dashboardTypeMix.map((s) => (
                <div key={s.key}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-foreground">{s.label}</span>
                    <span className="font-mono tabular-nums text-muted-foreground">
                      {s.count} · {s.pct}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-[width] duration-300 ${s.barClass}`}
                      style={{ width: `${Math.max(4, s.pct)}%` }}
                      role="presentation"
                    />
                  </div>
                </div>
              ))}
              <p className="pt-1 text-[11px] text-muted-foreground">
                Exports {countByStatus(data?.exports ?? [], ["succeeded"])} · Imports{" "}
                {countByStatus(data?.imports ?? [], ["succeeded"])} · Dimensions{" "}
                {data?.dimensions.length ?? 0}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
