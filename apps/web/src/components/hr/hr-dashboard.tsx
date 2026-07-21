"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  RefreshCw,
  UserRound,
  UserX,
} from "lucide-react";

import { FinanceKpiCard } from "@/components/finance/finance-kpi-card";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { HrPipelineFunnel } from "@/components/hr/hr-pipeline-funnel";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { hrQuickLinks, hrWorkspaceGroups, resolveHrGroupResources } from "@/config/hr";
import { isAuthenticated } from "@/lib/auth";
import {
  asNumber,
  asStatus,
  countByAttendanceStatus,
  countByStatus,
  countOpenDocs,
  formatQty,
  loadHrOverview,
  type HrOverview,
  type HrRow,
} from "@/services/hr-service";

function recentLeave(rows: HrRow[], limit = 6): HrRow[] {
  return [...rows]
    .sort((a, b) =>
      String(b.document_number ?? "").localeCompare(String(a.document_number ?? "")),
    )
    .slice(0, limit);
}

function sumDays(rows: HrRow[]): number {
  return rows.reduce((sum, row) => sum + asNumber(row.days_count), 0);
}

export function HrDashboard() {
  const [data, setData] = useState<HrOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const authenticated = typeof window !== "undefined" ? isAuthenticated() : false;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loadHrOverview());
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
        activeEmployees: 0,
        pendingLeave: 0,
        absentDays: 0,
        openReviews: 0,
        presentDays: 0,
      };
    }
    return {
      activeEmployees: countByStatus(data.profiles, ["active"]),
      pendingLeave: countByStatus(data.leaveRequests, ["draft", "submitted"]),
      absentDays: countByAttendanceStatus(data.attendance, ["absent"]),
      presentDays: countByAttendanceStatus(data.attendance, ["present", "work_from_home"]),
      openReviews: countOpenDocs(data.reviews, ["closed", "cancelled", "approved"]),
    };
  }, [data]);

  const pipelineCounts = useMemo(
    () => ({
      "employee-profiles": data?.profiles.length ?? 0,
      employment: data?.employment.length ?? 0,
      attendance: data?.attendance.length ?? 0,
      "leave-requests": data?.leaveRequests.length ?? 0,
      training: data?.training.length ?? 0,
    }),
    [data],
  );

  const leaveWatch = useMemo(() => recentLeave(data?.leaveRequests ?? []), [data]);

  const reviewWatch = useMemo(() => {
    const rows = data?.reviews ?? [];
    return [...rows]
      .filter((r) => !["closed", "cancelled"].includes(asStatus(r.status)))
      .slice(0, 5);
  }, [data]);

  const attendanceMix = useMemo(() => {
    const rows = data?.attendance ?? [];
    const present = countByAttendanceStatus(rows, ["present"]);
    const wfh = countByAttendanceStatus(rows, ["work_from_home"]);
    const half = countByAttendanceStatus(rows, ["half_day"]);
    const absent = countByAttendanceStatus(rows, ["absent"]);
    const holiday = countByAttendanceStatus(rows, ["holiday"]);
    const total = present + wfh + half + absent + holiday || 1;
    return [
      {
        label: "Present",
        count: present,
        pct: Math.round((present / total) * 100),
        barClass: "bg-emerald-600",
      },
      {
        label: "WFH",
        count: wfh,
        pct: Math.round((wfh / total) * 100),
        barClass: "bg-sky-600",
      },
      {
        label: "Half day",
        count: half,
        pct: Math.round((half / total) * 100),
        barClass: "bg-amber-500",
      },
      {
        label: "Absent",
        count: absent,
        pct: Math.round((absent / total) * 100),
        barClass: "bg-red-600",
      },
    ];
  }, [data]);

  const authBlocked =
    Boolean(data?.statusCodes.includes(401)) ||
    (!authenticated && Boolean(data?.errors.length));

  return (
    <div className="space-y-5">
      <PageHeader
        title="HRMS"
        description="Human resources workspace — profiles, employment, attendance, leave, performance, training, and separation."
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
              href="/hr/leave-requests"
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-opacity duration-200 hover:opacity-90"
            >
              <CalendarDays className="size-3.5" />
              Leave
            </Link>
            <Link
              href="/hr/attendance"
              className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border/80 bg-card px-3 text-sm font-medium shadow-sm transition-colors duration-200 hover:bg-muted"
            >
              Attendance
            </Link>
          </div>
        }
      />

      {authBlocked ? (
        <div className="rounded-xl border border-dashed border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Sign in to load live HRMS data.{" "}
          <Link href="/login" className="cursor-pointer font-medium underline underline-offset-2">
            Go to login
          </Link>
        </div>
      ) : null}

      {data?.partial && !authBlocked ? (
        <div className="rounded-xl border border-border/80 bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
          Some HR endpoints returned errors. Showing available records.
        </div>
      ) : null}

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <FinanceKpiCard
          label="Active employees"
          value={loading ? "—" : String(kpis.activeEmployees)}
          hint={`${data?.profiles.length ?? 0} profiles · ${countByStatus(data?.employment ?? [], ["active", "confirmed", "probation"])} employment`}
          icon={UserRound}
          tone="default"
        />
        <FinanceKpiCard
          label="Pending leave"
          value={loading ? "—" : String(kpis.pendingLeave)}
          hint={`${data?.leaveRequests.length ?? 0} requests · ${formatQty(sumDays(data?.leaveRequests ?? []))} days`}
          icon={CalendarDays}
          tone={kpis.pendingLeave > 0 ? "warning" : "success"}
        />
        <FinanceKpiCard
          label="Absent records"
          value={loading ? "—" : String(kpis.absentDays)}
          hint={`${kpis.presentDays} present/WFH · ${data?.attendance.length ?? 0} attendance rows`}
          icon={UserX}
          tone={kpis.absentDays > 0 ? "danger" : "success"}
        />
        <FinanceKpiCard
          label="Open reviews"
          value={loading ? "—" : String(kpis.openReviews)}
          hint={`${data?.reviews.length ?? 0} reviews · ${countByStatus(data?.goals ?? [], ["open"])} open goals`}
          icon={BadgeCheck}
          tone={kpis.openReviews > 0 ? "warning" : "success"}
        />
      </div>

      <HrPipelineFunnel counts={pipelineCounts} loading={loading} />

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {hrQuickLinks.map((link) => {
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
                <span className="block text-[11px] text-muted-foreground">{link.description}</span>
              </span>
            </Link>
          );
        })}
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium tracking-tight">Workspace</h2>
          <Badge variant="secondary">{hrWorkspaceGroups.length} areas</Badge>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {hrWorkspaceGroups.map((group) => {
            const Icon = group.icon;
            const resources = resolveHrGroupResources(group);
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
                        href={`/hr/${resource.key}`}
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
              <h2 className="text-sm font-medium tracking-tight">Leave requests</h2>
              <p className="text-[11px] text-muted-foreground">Latest leave applications</p>
            </div>
            <Link
              href="/hr/leave-requests"
              className="cursor-pointer text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
            >
              View all
            </Link>
          </div>
          <div className="erp-scroll overflow-x-auto">
            <table className="w-full min-w-[440px] text-left text-sm">
              <thead>
                <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                  <th className="px-4 py-2.5 font-medium">Request</th>
                  <th className="px-4 py-2.5 font-medium">Days</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-muted-foreground">
                      Loading…
                    </td>
                  </tr>
                ) : leaveWatch.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-muted-foreground">
                      No leave requests yet.
                    </td>
                  </tr>
                ) : (
                  leaveWatch.map((row, idx) => (
                    <tr
                      key={String(row.id ?? idx)}
                      className="border-b border-border/50 transition-colors duration-150 last:border-0 hover:bg-accent/30"
                    >
                      <td className="max-w-[200px] truncate px-4 py-2.5">
                        <p className="font-medium text-foreground">
                          {String(row.document_number ?? "—")}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-foreground">
                        {formatQty(asNumber(row.days_count))}
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

        <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="mb-3">
            <h2 className="text-sm font-medium tracking-tight">Attendance mix</h2>
            <p className="text-[11px] text-muted-foreground">Day status distribution</p>
          </div>
          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="space-y-3">
              {attendanceMix.map((s) => (
                <div key={s.label}>
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
                Open separations{" "}
                {countOpenDocs(data?.separation ?? [], ["completed", "cancelled"])} · Training{" "}
                {data?.training.length ?? 0} · Designations {data?.designations.length ?? 0}
              </p>
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
            <div>
              <h2 className="text-sm font-medium tracking-tight">Review watch</h2>
              <p className="text-[11px] text-muted-foreground">Open performance reviews</p>
            </div>
            <Link
              href="/hr/performance-reviews"
              className="cursor-pointer text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
            >
              View all
            </Link>
          </div>
          <ul className="divide-y divide-border/60">
            {loading ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</li>
            ) : reviewWatch.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                No open reviews.
              </li>
            ) : (
              reviewWatch.map((row, idx) => (
                <li
                  key={String(row.id ?? idx)}
                  className="px-4 py-2.5 transition-colors duration-150 hover:bg-accent/30"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">
                      {String(row.document_number ?? "—")}
                    </p>
                    <FinanceStatusBadge status={String(row.status ?? "draft")} />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {String(row.review_cycle ?? "cycle").replaceAll("_", " ")}
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
