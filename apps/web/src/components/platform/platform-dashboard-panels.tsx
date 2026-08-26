"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  LayoutDashboard,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  CrmIconBadge,
  CrmListPanel,
  CrmSection,
  CRM_TABLE_HEAD_ROW,
} from "@/components/crm/crm-ui";
import { PlatformModuleHealthDonut } from "@/components/platform/platform-dashboard-charts";
import { Badge } from "@/components/ui/badge";
import { erpModules } from "@/config/modules";
import { cn } from "@/lib/utils";
import type { ModuleAnalytics } from "@/services/platform-dashboard-service";

const GROUP_LABEL: Record<string, string> = {
  platform: "Platform",
  foundation: "Foundation",
  organization: "Organization",
  "master-data": "Master Data",
  operations: "Operations",
};

function moduleGroup(key: string): string {
  const mod = erpModules.find((row) => row.key === key);
  return GROUP_LABEL[mod?.group ?? ""] ?? "Module";
}

function statusBadgeVariant(status: ModuleAnalytics["status"]) {
  if (status === "ok") return "success" as const;
  if (status === "partial") return "secondary" as const;
  return "destructive" as const;
}

function statusLabel(status: ModuleAnalytics["status"]) {
  if (status === "ok") return "Live";
  if (status === "partial") return "Partial";
  return "Offline";
}

export function DepartmentAnalyticsPanel({
  modules,
  maxRecords,
  totalRecords,
  loading,
  loadedAt,
  moduleIcon,
}: {
  modules: ModuleAnalytics[];
  maxRecords: number;
  totalRecords: number;
  loading?: boolean;
  loadedAt?: string;
  moduleIcon: (key: string) => LucideIcon;
}) {
  const liveCount = modules.filter((row) => row.status === "ok").length;
  const topModule = modules[0];

  return (
    <CrmSection
      title="Department analytics"
      subtitle="Live KPIs and record volume across every department you can access"
      icon={LayoutDashboard}
      badge={
        loadedAt ? (
          <span className="text-[11px] text-muted-foreground">
            Updated{" "}
            {new Date(loadedAt).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        ) : undefined
      }
      bodyClassName="space-y-4"
    >
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Total records",
            value: loading ? "…" : totalRecords.toLocaleString("en-IN"),
            hint: "Across all modules",
          },
          {
            label: "Departments",
            value: loading ? "…" : String(modules.length),
            hint: `${liveCount} live data feeds`,
          },
          {
            label: "Highest volume",
            value: loading ? "…" : (topModule?.title ?? "—"),
            hint: topModule ? `${topModule.recordCount.toLocaleString("en-IN")} records` : undefined,
          },
          {
            label: "Coverage",
            value: loading ? "…" : `${modules.length ? Math.round((liveCount / modules.length) * 100) : 0}%`,
            hint: "Modules reporting live data",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-border/70 bg-gradient-to-br from-muted/30 to-background px-3.5 py-3"
          >
            <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              {stat.label}
            </p>
            <p className="mt-1 truncate text-lg font-semibold tabular-nums text-foreground">{stat.value}</p>
            {stat.hint ? <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{stat.hint}</p> : null}
          </div>
        ))}
      </div>

      <CrmListPanel>
        <div className="erp-scroll max-h-[min(520px,60vh)] overflow-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className={CRM_TABLE_HEAD_ROW}>
                <th className="px-4 py-2.5 font-medium">Department</th>
                <th className="px-4 py-2.5 font-medium">Group</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Records</th>
                <th className="min-w-[140px] px-4 py-2.5 font-medium">Volume</th>
                <th className="px-4 py-2.5 font-medium">Key metrics</th>
                <th className="w-10 px-2 py-2.5" aria-label="Open" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, index) => (
                  <tr key={index} className="border-b border-border/50">
                    <td colSpan={7} className="px-4 py-3">
                      <div className="h-4 w-full animate-pulse rounded bg-muted" />
                    </td>
                  </tr>
                ))
              ) : modules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    No department analytics available.
                  </td>
                </tr>
              ) : (
                modules.map((mod) => {
                  const Icon = moduleIcon(mod.key);
                  const pct = maxRecords > 0 ? Math.round((mod.recordCount / maxRecords) * 100) : 0;
                  return (
                    <tr
                      key={mod.key}
                      className="border-b border-border/50 transition-colors duration-150 last:border-0 hover:bg-accent/30"
                    >
                      <td className="px-4 py-2.5">
                        <Link href={mod.href} className="group flex cursor-pointer items-center gap-2.5">
                          <CrmIconBadge icon={Icon} className="size-8 shrink-0 [&_svg]:size-3.5" />
                          <span className="font-medium text-foreground group-hover:underline">{mod.title}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-[11px] text-muted-foreground">{moduleGroup(mod.key)}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant={statusBadgeVariant(mod.status)}>{statusLabel(mod.status)}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-foreground">
                        {mod.recordCount.toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 min-w-[72px] flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all duration-300",
                                mod.status === "ok"
                                  ? "bg-sky-600"
                                  : mod.status === "partial"
                                    ? "bg-amber-500"
                                    : "bg-slate-400",
                              )}
                              style={{ width: `${Math.max(pct, mod.recordCount > 0 ? 6 : 0)}%` }}
                            />
                          </div>
                          <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
                            {pct}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1.5">
                          {mod.kpis.slice(0, 3).map((kpi) => (
                            <span
                              key={kpi.label}
                              className="inline-flex max-w-[160px] items-center gap-1 rounded-md border border-border/60 bg-muted/30 px-2 py-0.5 text-[10px]"
                              title={`${kpi.label}: ${kpi.value}`}
                            >
                              <span className="truncate text-muted-foreground">{kpi.label}</span>
                              <span className="shrink-0 font-semibold tabular-nums text-foreground">
                                {kpi.value}
                              </span>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-2 py-2.5">
                        <Link
                          href={mod.href}
                          className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground"
                          aria-label={`Open ${mod.title}`}
                        >
                          <ArrowUpRight className="size-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </CrmListPanel>
    </CrmSection>
  );
}

export function ModuleHealthPanel({
  modules,
  moduleHealth,
  visibleModules,
  loading,
  moduleIcon,
}: {
  modules: ModuleAnalytics[];
  moduleHealth: { name: string; value: number }[];
  visibleModules: { key: string; title: string; href: string }[];
  loading?: boolean;
  moduleIcon: (key: string) => LucideIcon;
}) {
  const live = moduleHealth.find((row) => row.name === "Live")?.value ?? 0;
  const partial = moduleHealth.find((row) => row.name === "Partial")?.value ?? 0;
  const offline = moduleHealth.find((row) => row.name === "Offline")?.value ?? 0;
  const total = live + partial + offline;
  const statusByKey = new Map(modules.map((row) => [row.key, row.status]));

  return (
    <CrmSection
      title="Module health"
      subtitle="API connectivity and quick navigation"
      icon={CheckCircle2}
      badge={<Badge variant="secondary">{total} modules</Badge>}
      bodyClassName="space-y-4"
    >
      <div className="grid grid-cols-3 gap-2">
        {[
          {
            label: "Live",
            value: live,
            icon: CheckCircle2,
            tone: "text-emerald-700 bg-emerald-50 border-emerald-200",
          },
          {
            label: "Partial",
            value: partial,
            icon: AlertTriangle,
            tone: "text-amber-800 bg-amber-50 border-amber-200",
          },
          {
            label: "Offline",
            value: offline,
            icon: XCircle,
            tone: "text-slate-700 bg-slate-100 border-slate-200",
          },
        ].map((row) => {
          const Icon = row.icon;
          return (
            <div key={row.label} className={cn("rounded-lg border px-3 py-2.5 text-center", row.tone)}>
              <Icon className="mx-auto size-4" aria-hidden />
              <p className="mt-1 text-lg font-semibold tabular-nums">{loading ? "—" : row.value}</p>
              <p className="text-[10px] font-medium tracking-wide uppercase opacity-80">{row.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
        <PlatformModuleHealthDonut data={moduleHealth} loading={loading} compact />
        <ul className="flex flex-col justify-center gap-2">
          {(moduleHealth.length ? moduleHealth : [{ name: "Live", value: 0 }]).map((row, index) => (
            <li key={row.name} className="flex items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-2 text-muted-foreground">
                <span
                  className="size-2 rounded-full"
                  style={{
                    backgroundColor: index === 0 ? "#047857" : index === 1 ? "#B45309" : "#475569",
                  }}
                />
                {row.name}
              </span>
              <span className="font-semibold tabular-nums text-foreground">
                {loading ? "—" : `${total ? Math.round((row.value / total) * 100) : 0}%`}
              </span>
            </li>
          ))}
          {!loading && total ? (
            <li className="mt-1 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
              {Math.round((live / total) * 100)}% of modules fully synced
            </li>
          ) : null}
        </ul>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Quick access
        </p>
        <div className="erp-scroll grid max-h-[220px] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
          {visibleModules.map((mod) => {
            const Icon = moduleIcon(mod.key);
            const status = statusByKey.get(mod.key) ?? "ok";
            return (
              <Link
                key={mod.key}
                href={mod.href}
                className="group flex cursor-pointer items-center gap-2 rounded-lg border border-border/70 bg-background/80 px-2.5 py-2 transition-all duration-200 hover:border-primary/25 hover:bg-accent/40"
              >
                <span className="relative flex size-8 shrink-0 items-center justify-center rounded-md bg-sky-50 text-sky-700">
                  <Icon className="size-3.5" aria-hidden />
                  <span
                    className={cn(
                      "absolute -top-0.5 -right-0.5 size-2 rounded-full ring-2 ring-card",
                      status === "ok" ? "bg-emerald-500" : status === "partial" ? "bg-amber-500" : "bg-slate-400",
                    )}
                    aria-hidden
                  />
                </span>
                <span className="min-w-0 truncate text-[11px] font-medium leading-tight group-hover:text-foreground">
                  {mod.title}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </CrmSection>
  );
}
