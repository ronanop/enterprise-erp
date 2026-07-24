"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  Handshake,
  LayoutGrid,
  PieChart,
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
import {
  CrmActivityTile,
  CrmHeadlineBand,
  CrmHeadlineStat,
  CrmIconBadge,
  CrmKpiCard,
  CrmListPanel,
  CrmPage,
  CrmSection,
  CrmViewAllLink,
  CrmWarnBanner,
} from "@/components/crm/crm-ui";
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

const STAGE_COLORS = [
  CRM_CHART_COLORS.sky,
  CRM_CHART_COLORS.skyDark,
  CRM_CHART_COLORS.teal,
  CRM_CHART_COLORS.emerald,
  CRM_CHART_COLORS.slate,
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
    <CrmPage>
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
        <CrmWarnBanner>
          Sign in to load live CRM data.{" "}
          <Link href="/login" className="cursor-pointer font-medium underline underline-offset-2">
            Go to login
          </Link>
        </CrmWarnBanner>
      ) : null}

      {data?.partial && !authBlocked ? (
        <div className="rounded-xl border border-border/80 bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
          Some CRM endpoints returned errors. Showing available records.
        </div>
      ) : null}

      <CrmHeadlineBand>
        <div className="grid divide-y divide-white/10 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
          <CrmHeadlineStat
            label="Pipeline value"
            value={formatInr(kpis.pipelineValue)}
            sub={`${kpis.openOpps} open opportunities`}
            loading={loading}
          />
          <CrmHeadlineStat
            label="Won value"
            value={formatInr(kpis.wonValue)}
            sub={`${kpis.winRate}% win rate`}
            loading={loading}
          />
          <CrmHeadlineStat
            label="Open leads"
            value={String(kpis.openLeads)}
            sub={`${data?.leads.length ?? 0} total leads`}
            loading={loading}
          />
          <CrmHeadlineStat
            label="Active campaigns"
            value={String(countByStatus(data?.campaigns ?? [], ["active"]))}
            sub={`${data?.campaigns.length ?? 0} total campaigns`}
            loading={loading}
          />
        </div>
      </CrmHeadlineBand>

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <CrmKpiCard
          label="Open leads"
          value={String(kpis.openLeads)}
          hint={`${data?.leads.length ?? 0} total`}
          icon={UserPlus}
          tone={kpis.openLeads > 0 ? "warning" : "success"}
          href="/crm/leads"
          loading={loading}
        />
        <CrmKpiCard
          label="Open opportunities"
          value={String(kpis.openOpps)}
          hint={`${countByStatus(data?.opportunities ?? [], ["won"])} won`}
          icon={Handshake}
          tone="default"
          href="/crm/opportunities"
          loading={loading}
        />
        <CrmKpiCard
          label="Win rate"
          value={`${kpis.winRate}%`}
          hint={`${formatInr(kpis.wonValue)} won value`}
          icon={TrendingUp}
          tone="success"
          loading={loading}
        />
        <CrmKpiCard
          label="Open tasks"
          value={String(kpis.pendingTasks)}
          hint={`${kpis.missedFollowups} missed follow-ups`}
          icon={ClipboardList}
          tone={kpis.pendingTasks > 0 || kpis.missedFollowups > 0 ? "warning" : "success"}
          href="/crm/tasks"
          loading={loading}
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <CrmSection
          title="Pipeline funnel"
          subtitle="Lead → Meeting volume"
          icon={BarChart3}
          badge={<Badge variant="secondary">Counts</Badge>}
        >
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
                    style={{ backgroundColor: STAGE_COLORS[i % STAGE_COLORS.length] }}
                  />
                  {stage.title}
                </Link>
              </li>
            ))}
          </ol>
        </CrmSection>

        <CrmSection
          title="Stage mix"
          subtitle="All opportunities"
          icon={PieChart}
          badge={<Badge variant="secondary">Share</Badge>}
        >
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
                      style={{ backgroundColor: STAGE_COLORS[i % STAGE_COLORS.length] }}
                    />
                    {s.label}
                  </span>
                  <span className="font-medium tabular-nums text-foreground">
                    {loading ? "—" : count}
                  </span>
                </li>
              );
            })}
          </ul>
        </CrmSection>

        <CrmSection
          title="Pipeline value"
          subtitle="Expected revenue by stage"
          icon={Target}
          badge={<Badge variant="secondary">INR</Badge>}
        >
          <CrmRevenueBarChart data={revenueByStage} loading={loading} formatValue={formatInr} />
        </CrmSection>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <CrmListPanel>
          <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <CrmIconBadge icon={UserPlus} />
              <div>
                <h2 className="text-sm font-medium tracking-tight">Recent leads</h2>
                <p className="text-[11px] text-muted-foreground">Latest prospect activity</p>
              </div>
            </div>
            <CrmViewAllLink href="/crm/leads" />
          </div>
          <div className="erp-scroll overflow-x-auto">
            <table className="w-full min-w-110 text-left text-sm">
              <thead>
                <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                  <th className="px-4 py-2.5 font-medium">Lead</th>
                  <th className="px-4 py-2.5 font-medium">Contact</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-3">
                        <div className="h-3.5 w-32 animate-pulse rounded bg-muted" />
                        <div className="mt-1.5 h-2.5 w-16 animate-pulse rounded bg-muted/70" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-3.5 w-24 animate-pulse rounded bg-muted" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
                      </td>
                    </tr>
                  ))
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
                      <td className="max-w-50 truncate px-4 py-2.5">
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
        </CrmListPanel>

        <CrmListPanel>
          <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <CrmIconBadge icon={Handshake} />
              <div>
                <h2 className="text-sm font-medium tracking-tight">Top opportunities</h2>
                <p className="text-[11px] text-muted-foreground">Highest expected revenue</p>
              </div>
            </div>
            <CrmViewAllLink href="/crm/opportunities" />
          </div>
          <ul className="divide-y divide-border/60">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="h-3.5 w-40 animate-pulse rounded bg-muted" />
                    <div className="h-3.5 w-16 animate-pulse rounded bg-muted" />
                  </div>
                  <div className="mt-2 h-2.5 w-28 animate-pulse rounded bg-muted/70" />
                </li>
              ))
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
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground">
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
        </CrmListPanel>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-3">
        <CrmActivityTile
          label="Meetings"
          value={loading ? "—" : String(data?.meetings.length ?? 0)}
          icon={CalendarDays}
          tint="bg-sky-50 text-sky-800"
          href="/crm/meetings"
        />
        <CrmActivityTile
          label="Follow-ups"
          value={loading ? "—" : String(data?.followups.length ?? 0)}
          icon={ClipboardList}
          tint="bg-amber-50 text-amber-900"
          href="/crm/customer-followups"
        />
        <CrmActivityTile
          label="Campaigns active"
          value={loading ? "—" : String(countByStatus(data?.campaigns ?? [], ["active"]))}
          icon={LayoutGrid}
          tint="bg-emerald-50 text-emerald-800"
          href="/crm/campaigns"
        />
      </div>
    </CrmPage>
  );
}
