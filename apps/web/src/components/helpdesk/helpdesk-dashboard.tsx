"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  LifeBuoy,
  RefreshCw,
  Ticket,
  UserCheck,
} from "lucide-react";

import { FinanceKpiCard } from "@/components/finance/finance-kpi-card";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { HelpdeskPipelineFunnel } from "@/components/helpdesk/helpdesk-pipeline-funnel";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import {
  helpdeskQuickLinks,
  helpdeskWorkspaceGroups,
  resolveHelpdeskGroupResources,
} from "@/config/helpdesk";
import { isAuthenticated } from "@/lib/auth";
import {
  asStatus,
  countByStatus,
  countOpenDocs,
  loadHelpdeskOverview,
  type HelpdeskOverview,
  type HelpdeskRow,
} from "@/services/helpdesk-service";

function recentTickets(rows: HelpdeskRow[], limit = 6): HelpdeskRow[] {
  return [...rows]
    .sort((a, b) =>
      String(b.opened_at ?? b.document_number ?? "").localeCompare(
        String(a.opened_at ?? a.document_number ?? ""),
      ),
    )
    .slice(0, limit);
}

export function HelpdeskDashboard() {
  const [data, setData] = useState<HelpdeskOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const authenticated = typeof window !== "undefined" ? isAuthenticated() : false;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loadHelpdeskOverview());
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
        openTickets: 0,
        activeAssignments: 0,
        openEscalations: 0,
        publishedArticles: 0,
      };
    }
    return {
      openTickets: countOpenDocs(data.tickets, ["resolved", "closed", "cancelled"]),
      activeAssignments: countByStatus(data.assignments, ["active", "approved", "submitted"]),
      openEscalations: countOpenDocs(data.escalations, ["resolved", "cancelled"]),
      publishedArticles: countByStatus(data.articles, ["published", "approved"]),
    };
  }, [data]);

  const pipelineCounts = useMemo(
    () => ({
      tickets: data?.tickets.length ?? 0,
      "ticket-assignments": data?.assignments.length ?? 0,
      "ticket-escalations": data?.escalations.length ?? 0,
      resolutions: data?.resolutions.length ?? 0,
      "knowledge-articles": data?.articles.length ?? 0,
      "customer-feedback": data?.feedback.length ?? 0,
    }),
    [data],
  );

  const recent = useMemo(() => recentTickets(data?.tickets ?? []), [data]);

  const escalationWatch = useMemo(() => {
    const rows = data?.escalations ?? [];
    return [...rows]
      .sort((a, b) =>
        String(b.document_number ?? "").localeCompare(String(a.document_number ?? "")),
      )
      .slice(0, 5);
  }, [data]);

  const ticketStatusMix = useMemo(() => {
    const rows = data?.tickets ?? [];
    const stages = [
      { key: "new", label: "New", barClass: "bg-slate-400" },
      { key: "assigned", label: "Assigned", barClass: "bg-sky-600" },
      { key: "in_progress", label: "In progress", barClass: "bg-teal-600" },
      { key: "pending", label: "Pending", barClass: "bg-amber-500" },
      { key: "resolved", label: "Resolved", barClass: "bg-emerald-600" },
      { key: "closed", label: "Closed", barClass: "bg-slate-600" },
    ] as const;
    const total = rows.length || 1;
    return stages.map((s) => {
      const count = countByStatus(rows, [s.key]);
      return { ...s, count, pct: Math.round((count / total) * 100) };
    });
  }, [data]);

  const authBlocked =
    Boolean(data?.statusCodes.includes(401)) ||
    (!authenticated && Boolean(data?.errors.length));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Helpdesk"
        description="Customer support — tickets, assignments, SLA, escalations, knowledge base, resolutions, and feedback."
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
              href="/helpdesk/tickets"
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-opacity duration-200 hover:opacity-90"
            >
              <Ticket className="size-3.5" />
              Tickets
            </Link>
            <Link
              href="/helpdesk/ticket-escalations"
              className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border/80 bg-card px-3 text-sm font-medium shadow-sm transition-colors duration-200 hover:bg-muted"
            >
              Escalations
            </Link>
          </div>
        }
      />

      {authBlocked ? (
        <div className="rounded-xl border border-dashed border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Sign in to load live helpdesk data.{" "}
          <Link href="/login" className="cursor-pointer font-medium underline underline-offset-2">
            Go to login
          </Link>
        </div>
      ) : null}

      {data?.partial && !authBlocked ? (
        <div className="rounded-xl border border-border/80 bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
          Some helpdesk endpoints returned errors. Showing available records.
        </div>
      ) : null}

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <FinanceKpiCard
          label="Open tickets"
          value={loading ? "—" : String(kpis.openTickets)}
          hint={`${data?.tickets.length ?? 0} tickets · ${countByStatus(data?.tickets ?? [], ["in_progress", "assigned"])} active`}
          icon={Ticket}
          tone={kpis.openTickets > 0 ? "warning" : "success"}
        />
        <FinanceKpiCard
          label="Active assignments"
          value={loading ? "—" : String(kpis.activeAssignments)}
          hint={`${data?.assignments.length ?? 0} assignments · ${countByStatus(data?.teams ?? [], ["active"])} teams`}
          icon={UserCheck}
          tone={kpis.activeAssignments > 0 ? "default" : "success"}
        />
        <FinanceKpiCard
          label="Open escalations"
          value={loading ? "—" : String(kpis.openEscalations)}
          hint={`${countByStatus(data?.slas ?? [], ["active"])} active SLAs · ${data?.escalations.length ?? 0} total`}
          icon={LifeBuoy}
          tone={kpis.openEscalations > 0 ? "danger" : "success"}
        />
        <FinanceKpiCard
          label="Published articles"
          value={loading ? "—" : String(kpis.publishedArticles)}
          hint={`${data?.articles.length ?? 0} articles · ${data?.knowledgeBases.length ?? 0} KB spaces`}
          icon={BookOpen}
          tone={kpis.publishedArticles > 0 ? "success" : "default"}
        />
      </div>

      <HelpdeskPipelineFunnel counts={pipelineCounts} loading={loading} />

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {helpdeskQuickLinks.map((link) => {
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
          <Badge variant="secondary">{helpdeskWorkspaceGroups.length} areas</Badge>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {helpdeskWorkspaceGroups.map((group) => {
            const Icon = group.icon;
            const resources = resolveHelpdeskGroupResources(group);
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
                        href={`/helpdesk/${resource.key}`}
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
              <h2 className="text-sm font-medium tracking-tight">Recent tickets</h2>
              <p className="text-[11px] text-muted-foreground">Support intake</p>
            </div>
            <Link
              href="/helpdesk/tickets"
              className="cursor-pointer text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
            >
              View all
            </Link>
          </div>
          <div className="erp-scroll overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                  <th className="px-4 py-2.5 font-medium">Ticket</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium">Channel</th>
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
                      No tickets yet.
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
                          {String(row.subject ?? row.document_number ?? "—")}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {String(row.document_number ?? "")}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 text-xs capitalize text-muted-foreground">
                        {String(row.ticket_type ?? "—").replaceAll("_", " ")}
                      </td>
                      <td className="px-4 py-2.5 text-xs capitalize text-muted-foreground">
                        {String(row.channel ?? "—").replaceAll("_", " ")}
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
              <h2 className="text-sm font-medium tracking-tight">Escalation watch</h2>
              <p className="text-[11px] text-muted-foreground">Recent escalations</p>
            </div>
            <Link
              href="/helpdesk/ticket-escalations"
              className="cursor-pointer text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
            >
              View all
            </Link>
          </div>
          <ul className="divide-y divide-border/60">
            {loading ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</li>
            ) : escalationWatch.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                No escalations yet.
              </li>
            ) : (
              escalationWatch.map((row, idx) => (
                <li
                  key={String(row.id ?? idx)}
                  className="px-4 py-2.5 transition-colors duration-150 hover:bg-accent/30"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">
                      {String(row.document_number ?? "—")}
                    </p>
                    <FinanceStatusBadge
                      status={asStatus(row.status) || String(row.status ?? "")}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    L{String(row.escalation_level ?? "—")} ·{" "}
                    {String(row.reason_code ?? "escalation").replaceAll("_", " ")}
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="mb-3">
            <h2 className="text-sm font-medium tracking-tight">Ticket status mix</h2>
            <p className="text-[11px] text-muted-foreground">Queue lifecycle</p>
          </div>
          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="space-y-3">
              {ticketStatusMix.map((s) => (
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
                Resolutions {countByStatus(data?.resolutions ?? [], ["completed"])} · Feedback{" "}
                {data?.feedback.length ?? 0} · Comments {data?.comments.length ?? 0}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
