"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ClipboardList,
  Handshake,
  RefreshCw,
  Target,
  UserPlus,
} from "lucide-react";

import { CrmPipelineFunnel } from "@/components/crm/crm-pipeline-funnel";
import { FinanceKpiCard } from "@/components/finance/finance-kpi-card";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import {
  crmQuickLinks,
  crmWorkspaceGroups,
  resolveCrmGroupResources,
} from "@/config/crm";
import { isAuthenticated } from "@/lib/auth";
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
    .sort((a, b) =>
      String(b.lead_code ?? "").localeCompare(String(a.lead_code ?? "")),
    )
    .slice(0, limit);
}

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

  const kpis = useMemo(() => {
    if (!data) {
      return {
        openLeads: 0,
        openOpps: 0,
        pipelineValue: 0,
        pendingTasks: 0,
        missedFollowups: 0,
      };
    }
    return {
      openLeads: countOpenDocs(data.leads, [
        "converted",
        "lost",
        "unqualified",
      ]),
      openOpps: openOpps.length,
      pipelineValue: sumField(openOpps, "expected_revenue"),
      pendingTasks: countOpenDocs(data.tasks, ["completed", "cancelled"]),
      missedFollowups: countByStatus(data.followups, ["missed"]),
    };
  }, [data, openOpps]);

  const pipelineCounts = useMemo(
    () => ({
      leads: data?.leads.length ?? 0,
      opportunities: data?.opportunities.length ?? 0,
      tasks: data?.tasks.length ?? 0,
      followups: data?.followups.length ?? 0,
      meetings: data?.meetings.length ?? 0,
    }),
    [data],
  );

  const recent = useMemo(() => recentLeads(data?.leads ?? []), [data]);

  const oppWatch = useMemo(() => {
    return [...openOpps]
      .sort((a, b) => asNumber(b.expected_revenue) - asNumber(a.expected_revenue))
      .slice(0, 5);
  }, [openOpps]);

  const stageMix = useMemo(() => {
    const rows = data?.opportunities ?? [];
    const stages = [
      { key: "qualification", label: "Qualification", barClass: "bg-sky-600" },
      { key: "discovery", label: "Discovery", barClass: "bg-sky-700" },
      { key: "proposal", label: "Proposal", barClass: "bg-teal-600" },
      { key: "negotiation", label: "Negotiation", barClass: "bg-emerald-600" },
      { key: "won", label: "Won", barClass: "bg-slate-600" },
    ] as const;
    const total = rows.length || 1;
    return stages.map((s) => {
      const count = countByStage(rows, [s.key]);
      return { ...s, count, pct: Math.round((count / total) * 100) };
    });
  }, [data]);

  const authBlocked =
    Boolean(data?.statusCodes.includes(401)) ||
    (!authenticated && Boolean(data?.errors.length));

  return (
    <div className="space-y-5">
      <PageHeader
        title="CRM"
        description="Customer relationship workspace — leads, opportunities, campaigns, tasks, meetings, and feedback."
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

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <FinanceKpiCard
          label="Open leads"
          value={loading ? "—" : String(kpis.openLeads)}
          hint={`${data?.leads.length ?? 0} total · ${countByStatus(data?.leads ?? [], ["qualified", "converted"])} qualified/converted`}
          icon={UserPlus}
          tone={kpis.openLeads > 0 ? "warning" : "success"}
        />
        <FinanceKpiCard
          label="Open opportunities"
          value={loading ? "—" : String(kpis.openOpps)}
          hint={`${data?.opportunities.length ?? 0} deals · ${countByStatus(data?.opportunities ?? [], ["won"])} won`}
          icon={Handshake}
          tone="default"
        />
        <FinanceKpiCard
          label="Pipeline value"
          value={loading ? "—" : formatInr(kpis.pipelineValue)}
          hint={`${formatInr(sumField(openOpps, "forecast_amount"))} forecast · open deals`}
          icon={Target}
          tone={kpis.pipelineValue > 0 ? "default" : "success"}
        />
        <FinanceKpiCard
          label="Open tasks"
          value={loading ? "—" : String(kpis.pendingTasks)}
          hint={`${kpis.missedFollowups} missed follow-ups · ${data?.meetings.length ?? 0} meetings`}
          icon={ClipboardList}
          tone={kpis.pendingTasks > 0 || kpis.missedFollowups > 0 ? "warning" : "success"}
        />
      </div>

      <CrmPipelineFunnel counts={pipelineCounts} loading={loading} />

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {crmQuickLinks.map((link) => {
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
          <Badge variant="secondary">{crmWorkspaceGroups.length} areas</Badge>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {crmWorkspaceGroups.map((group) => {
            const Icon = group.icon;
            const resources = resolveCrmGroupResources(group);
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
                        href={`/crm/${resource.key}`}
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
              <h2 className="text-sm font-medium tracking-tight">Recent leads</h2>
              <p className="text-[11px] text-muted-foreground">Prospect book</p>
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
                        <p className="font-medium text-foreground">{leadDisplayName(row)}</p>
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
              <h2 className="text-sm font-medium tracking-tight">Opportunity watch</h2>
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
                    <p className="truncate text-sm font-medium">
                      {String(row.opportunity_name ?? row.opportunity_code ?? "—")}
                    </p>
                    <FinanceStatusBadge status={String(row.status ?? "open")} />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {String(row.current_stage ?? "qualification").replaceAll("_", " ")} ·{" "}
                    {formatInr(asNumber(row.expected_revenue))} ·{" "}
                    {asNumber(row.probability_percent)}%
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="mb-3">
            <h2 className="text-sm font-medium tracking-tight">Opportunity stages</h2>
            <p className="text-[11px] text-muted-foreground">Deal stage mix</p>
          </div>
          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="space-y-3">
              {stageMix.map((s) => (
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
                Active campaigns {countByStatus(data?.campaigns ?? [], ["active"])} · Feedback{" "}
                {countOpenDocs(data?.feedback ?? [], ["closed"])} open · Pipelines{" "}
                {data?.pipelines.length ?? 0}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
