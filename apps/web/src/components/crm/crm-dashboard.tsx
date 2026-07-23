"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ClipboardList,
  Handshake,
  RefreshCw,
  Target,
  TrendingUp,
  UserPlus,
} from "lucide-react";

import {
  CrmPipelineBarChart,
  CrmRevenueBarChart,
  CrmStageDonutChart,
  CRM_CHART_COLORS,
} from "@/components/crm/crm-dashboard-charts";
import { FinanceKpiCard } from "@/components/finance/finance-kpi-card";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { crmPipelineStages } from "@/config/crm";
import { isAuthenticated } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  asNumber,
  asStatus,
  countByStage,
  countByStatus,
  countOpenDocs,
  formatInr,
  leadDisplayName,
  loadCrmOverview,
  sumField,
  type CrmOverview,
  type CrmRow,
} from "@/services/crm-service";

function recentLeads(rows: CrmRow[], limit = 6): CrmRow[] {
  return [...rows]
    .sort((a, b) => String(b.lead_code ?? "").localeCompare(String(a.lead_code ?? "")))
    .slice(0, limit);
}

const STAGE_DEFS = [
  { key: "qualification", label: "Qualification" },
  { key: "discovery", label: "Discovery" },
  { key: "proposal", label: "Proposal" },
  { key: "negotiation", label: "Negotiation" },
  { key: "won", label: "Won" },
] as const;

export function CrmDashboard() {
  const [data, setData] = useState<CrmOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const authenticated = typeof window !== "undefined" ? isAuthenticated() : false;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loadCrmOverview());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openOpps = useMemo(
    () => (data?.opportunities ?? []).filter((r) => asStatus(r.status) === "open" || !r.status),
    [data],
  );

  const wonOpps = useMemo(
    () => (data?.opportunities ?? []).filter((r) => asStatus(r.status) === "won" || asStatus(r.current_stage) === "won"),
    [data],
  );

  const kpis = useMemo(() => {
    if (!data) {
      return {
        openLeads: 0,
        openOpps: 0,
        pipelineValue: 0,
        wonValue: 0,
        pendingTasks: 0,
        missedFollowups: 0,
        winRate: 0,
      };
    }
    const closed = data.opportunities.filter((r) =>
      ["won", "lost"].includes(asStatus(r.status) || asStatus(r.current_stage)),
    );
    const won = closed.filter((r) => (asStatus(r.status) || asStatus(r.current_stage)) === "won");
    return {
      openLeads: countOpenDocs(data.leads, ["converted", "lost", "unqualified"]),
      openOpps: openOpps.length,
      pipelineValue: sumField(openOpps, "expected_revenue"),
      wonValue: sumField(wonOpps, "expected_revenue"),
      pendingTasks: countOpenDocs(data.tasks, ["completed", "cancelled"]),
      missedFollowups: countByStatus(data.followups, ["missed"]),
      winRate: closed.length ? Math.round((won.length / closed.length) * 100) : 0,
    };
  }, [data, openOpps, wonOpps]);

  const pipelineChart = useMemo(() => {
    const counts: Record<string, number> = {
      leads: data?.leads.length ?? 0,
      opportunities: data?.opportunities.length ?? 0,
      tasks: data?.tasks.length ?? 0,
      followups: data?.followups.length ?? 0,
      meetings: data?.meetings.length ?? 0,
    };
    return crmPipelineStages.map((stage) => ({
      name: stage.title,
      count: counts[stage.resource] ?? 0,
    }));
  }, [data]);

  const stageDonut = useMemo(() => {
    const rows = data?.opportunities ?? [];
    return STAGE_DEFS.map((s) => ({
      name: s.label,
      value: countByStage(rows, [s.key]),
    })).filter((d) => d.value > 0);
  }, [data]);

  const revenueByStage = useMemo(() => {
    return STAGE_DEFS.filter((s) => s.key !== "won").map((s) => {
      const rows = openOpps.filter(
        (r) => String(r.current_stage ?? "qualification").toLowerCase() === s.key,
      );
      return {
        name: s.label,
        value: sumField(rows, "expected_revenue"),
      };
    });
  }, [openOpps]);

  const recent = useMemo(() => recentLeads(data?.leads ?? []), [data]);

  const oppWatch = useMemo(() => {
    return [...openOpps]
      .sort((a, b) => asNumber(b.expected_revenue) - asNumber(a.expected_revenue))
      .slice(0, 6);
  }, [openOpps]);

  const authBlocked =
    Boolean(data?.statusCodes.includes(401)) ||
    (!authenticated && Boolean(data?.errors.length));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sales CRM Dashboard"
        description="Pipeline health, deal mix, and revenue outlook across leads and opportunities."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Link
              href="/crm/leads"
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-opacity duration-200 hover:opacity-90"
            >
              <UserPlus className="size-3.5" />
              Leads
            </Link>
            <Link
              href="/crm/opportunities"
              className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border/80 bg-card px-3 text-sm font-medium shadow-sm transition-colors duration-200 hover:bg-muted"
            >
              Opportunities
            </Link>
          </div>
        }
      />

      {authBlocked ? (
        <div className="rounded-xl border border-dashed border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Sign in to load live CRM data.{" "}
          <Link href="/login" className="cursor-pointer font-medium underline underline-offset-2">
            Go to login
          </Link>
        </div>
      ) : null}

      {data?.partial && !authBlocked ? (
        <div className="rounded-xl border border-border/80 bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
          Some CRM endpoints returned errors. Showing available records.
        </div>
      ) : null}

      {/* KPI strip */}
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-5">
        <FinanceKpiCard
          label="Open leads"
          value={loading ? "—" : String(kpis.openLeads)}
          hint={`${data?.leads.length ?? 0} total`}
          icon={UserPlus}
          tone={kpis.openLeads > 0 ? "warning" : "success"}
        />
        <FinanceKpiCard
          label="Open opportunities"
          value={loading ? "—" : String(kpis.openOpps)}
          hint={`${countByStatus(data?.opportunities ?? [], ["won"])} won`}
          icon={Handshake}
          tone="default"
        />
        <FinanceKpiCard
          label="Pipeline value"
          value={loading ? "—" : formatInr(kpis.pipelineValue)}
          hint="Open deals · expected"
          icon={Target}
          tone={kpis.pipelineValue > 0 ? "default" : "success"}
        />
        <FinanceKpiCard
          label="Won value"
          value={loading ? "—" : formatInr(kpis.wonValue)}
          hint={`${kpis.winRate}% win rate`}
          icon={TrendingUp}
          tone="success"
        />
        <FinanceKpiCard
          label="Open tasks"
          value={loading ? "—" : String(kpis.pendingTasks)}
          hint={`${kpis.missedFollowups} missed follow-ups`}
          icon={ClipboardList}
          tone={kpis.pendingTasks > 0 || kpis.missedFollowups > 0 ? "warning" : "success"}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-3 xl:grid-cols-3">
        <section className="rounded-xl border border-border/80 bg-card p-4 shadow-sm xl:col-span-1">
          <div className="mb-1 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-medium tracking-tight">Pipeline funnel</h2>
              <p className="text-[11px] text-muted-foreground">Lead → Meeting volume</p>
            </div>
            <Badge variant="secondary">Counts</Badge>
          </div>
          <CrmPipelineBarChart data={pipelineChart} loading={loading} />
          <ol className="mt-1 flex flex-wrap gap-x-3 gap-y-1 border-t border-border/60 pt-2">
            {crmPipelineStages.map((stage, i) => (
              <li key={stage.key}>
                <Link
                  href={stage.href}
                  className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground transition-colors duration-200 hover:text-foreground"
                >
                  <span
                    className="size-1.5 rounded-full"
                    style={{
                      backgroundColor: [
                        CRM_CHART_COLORS.sky,
                        CRM_CHART_COLORS.skyDark,
                        CRM_CHART_COLORS.teal,
                        CRM_CHART_COLORS.emerald,
                        CRM_CHART_COLORS.slate,
                      ][i],
                    }}
                  />
                  {stage.title}
                </Link>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="mb-1 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-medium tracking-tight">Stage mix</h2>
              <p className="text-[11px] text-muted-foreground">All opportunities</p>
            </div>
            <Badge variant="secondary">Share</Badge>
          </div>
          <CrmStageDonutChart data={stageDonut} loading={loading} />
          <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-border/60 pt-2">
            {STAGE_DEFS.map((s, i) => {
              const count = countByStage(data?.opportunities ?? [], [s.key]);
              if (!count && !loading) return null;
              return (
                <li key={s.key} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="flex min-w-0 items-center gap-1.5 truncate text-muted-foreground">
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor: [
                          CRM_CHART_COLORS.sky,
                          CRM_CHART_COLORS.skyDark,
                          CRM_CHART_COLORS.teal,
                          CRM_CHART_COLORS.emerald,
                          CRM_CHART_COLORS.slate,
                        ][i],
                      }}
                    />
                    {s.label}
                  </span>
                  <span className="font-mono tabular-nums text-foreground">{loading ? "—" : count}</span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="mb-1 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-medium tracking-tight">Pipeline value</h2>
              <p className="text-[11px] text-muted-foreground">Expected revenue by stage</p>
            </div>
            <Badge variant="secondary">INR</Badge>
          </div>
          <CrmRevenueBarChart data={revenueByStage} loading={loading} formatValue={formatInr} />
        </section>
      </div>

      {/* Tables */}
      <div className="grid gap-3 xl:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
            <div>
              <h2 className="text-sm font-medium tracking-tight">Recent leads</h2>
              <p className="text-[11px] text-muted-foreground">Latest prospect activity</p>
            </div>
            <Link
              href="/crm/leads"
              className="cursor-pointer text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
            >
              View all
            </Link>
          </div>
          <div className="erp-scroll overflow-x-auto">
            <table className="w-full min-w-[440px] text-left text-sm">
              <thead>
                <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                  <th className="px-4 py-2.5 font-medium">Lead</th>
                  <th className="px-4 py-2.5 font-medium">Contact</th>
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
                ) : recent.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-muted-foreground">
                      No leads yet.
                    </td>
                  </tr>
                ) : (
                  recent.map((row, idx) => (
                    <tr
                      key={String(row.id ?? idx)}
                      className="border-b border-border/50 transition-colors duration-150 last:border-0 hover:bg-accent/30"
                    >
                      <td className="max-w-[200px] truncate px-4 py-2.5">
                        <Link
                          href={`/crm/leads/${String(row.id ?? "")}`}
                          className={cn(
                            "cursor-pointer font-medium text-foreground hover:underline",
                            !row.id && "pointer-events-none",
                          )}
                        >
                          {leadDisplayName(row)}
                        </Link>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {String(row.lead_code ?? "")}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {String(row.mobile ?? row.email ?? "—")}
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
              <h2 className="text-sm font-medium tracking-tight">Top opportunities</h2>
              <p className="text-[11px] text-muted-foreground">Highest expected revenue</p>
            </div>
            <Link
              href="/crm/opportunities"
              className="cursor-pointer text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
            >
              View all
            </Link>
          </div>
          <ul className="divide-y divide-border/60">
            {loading ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</li>
            ) : oppWatch.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                No open opportunities.
              </li>
            ) : (
              oppWatch.map((row, idx) => (
                <li
                  key={String(row.id ?? idx)}
                  className="px-4 py-2.5 transition-colors duration-150 hover:bg-accent/30"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/crm/opportunities/${String(row.id ?? "")}`}
                      className={cn(
                        "min-w-0 truncate text-sm font-medium text-foreground hover:underline",
                        !row.id && "pointer-events-none",
                      )}
                    >
                      {String(row.opportunity_name ?? row.opportunity_code ?? "—")}
                    </Link>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-foreground">
                      {formatInr(asNumber(row.expected_revenue))}
                    </span>
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="capitalize">
                      {String(row.current_stage ?? "qualification").replaceAll("_", " ")}
                    </span>
                    <span>·</span>
                    <span>{asNumber(row.probability_percent)}%</span>
                    <FinanceStatusBadge status={String(row.status ?? "open")} />
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      {/* Activity strip */}
      <div className="grid gap-2.5 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-card px-4 py-3 shadow-sm">
          <span className="flex size-9 items-center justify-center rounded-lg bg-sky-50 text-sky-800">
            <CalendarDays className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Meetings
            </p>
            <p className="font-mono text-lg font-medium tabular-nums">
              {loading ? "—" : data?.meetings.length ?? 0}
            </p>
          </div>
          <Link
            href="/crm/meetings"
            className="ml-auto cursor-pointer text-xs font-medium text-primary hover:opacity-80"
          >
            Open
          </Link>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-card px-4 py-3 shadow-sm">
          <span className="flex size-9 items-center justify-center rounded-lg bg-amber-50 text-amber-900">
            <ClipboardList className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Follow-ups
            </p>
            <p className="font-mono text-lg font-medium tabular-nums">
              {loading ? "—" : data?.followups.length ?? 0}
            </p>
          </div>
          <Link
            href="/crm/customer-followups"
            className="ml-auto cursor-pointer text-xs font-medium text-primary hover:opacity-80"
          >
            Open
          </Link>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-card px-4 py-3 shadow-sm">
          <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800">
            <Target className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Campaigns active
            </p>
            <p className="font-mono text-lg font-medium tabular-nums">
              {loading ? "—" : countByStatus(data?.campaigns ?? [], ["active"])}
            </p>
          </div>
          <Link
            href="/crm/campaigns"
            className="ml-auto cursor-pointer text-xs font-medium text-primary hover:opacity-80"
          >
            Open
          </Link>
        </div>
      </div>
    </div>
  );
}
