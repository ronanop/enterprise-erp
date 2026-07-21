"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  RefreshCw,
  Ticket,
  UserCircle,
  Users,
  Wrench,
} from "lucide-react";

import { PortalPipelineFunnel } from "@/components/portal/portal-pipeline-funnel";
import { FinanceKpiCard } from "@/components/finance/finance-kpi-card";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import {
  portalQuickLinks,
  portalWorkspaceGroups,
  resolvePortalGroupResources,
} from "@/config/portal";
import { isAuthenticated } from "@/lib/auth";
import {
  asStatus,
  countByStatus,
  countOpenDocs,
  loadPortalOverview,
  type PortalOverview,
  type PortalRow,
} from "@/services/portal-service";

function recentAccounts(rows: PortalRow[], limit = 6): PortalRow[] {
  return [...rows]
    .sort((a, b) =>
      String(b.account_number ?? b.login_email ?? "").localeCompare(
        String(a.account_number ?? a.login_email ?? ""),
      ),
    )
    .slice(0, limit);
}

function priorityOf(row: PortalRow): string {
  const raw = row.priority ?? "";
  return typeof raw === "string" ? raw.toLowerCase() : "";
}

export function PortalDashboard() {
  const [data, setData] = useState<PortalOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const authenticated =
    typeof window !== "undefined" ? isAuthenticated() : false;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loadPortalOverview());
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
        activeAccounts: 0,
        activeSessions: 0,
        openTickets: 0,
        openRequests: 0,
      };
    }
    return {
      activeAccounts: countByStatus(data.accounts, ["active"]),
      activeSessions: countByStatus(data.sessions, ["active"]),
      openTickets: countOpenDocs(data.tickets, [
        "closed",
        "resolved",
        "cancelled",
        "canceled",
      ]),
      openRequests: countOpenDocs(data.serviceRequests, [
        "closed",
        "completed",
        "cancelled",
        "canceled",
      ]),
    };
  }, [data]);

  const pipelineCounts = useMemo(
    () => ({
      "portal-accounts": data?.accounts.length ?? 0,
      "portal-sessions": data?.sessions.length ?? 0,
      "order-views": data?.orderViews.length ?? 0,
      "invoice-views": data?.invoiceViews.length ?? 0,
      "support-tickets": data?.tickets.length ?? 0,
      "service-requests": data?.serviceRequests.length ?? 0,
    }),
    [data],
  );

  const recent = useMemo(
    () => recentAccounts(data?.accounts ?? []),
    [data],
  );

  const ticketWatch = useMemo(() => {
    const rows = data?.tickets ?? [];
    return [...rows]
      .sort((a, b) =>
        String(b.ticket_number ?? b.subject ?? "").localeCompare(
          String(a.ticket_number ?? a.subject ?? ""),
        ),
      )
      .slice(0, 5);
  }, [data]);

  const ticketPriorityMix = useMemo(() => {
    const rows = data?.tickets ?? [];
    const stages = [
      { key: "low", label: "Low", barClass: "bg-sky-600" },
      { key: "medium", label: "Medium", barClass: "bg-teal-600" },
      { key: "high", label: "High", barClass: "bg-amber-500" },
      { key: "critical", label: "Critical", barClass: "bg-slate-500" },
      { key: "other", label: "Other", barClass: "bg-slate-400" },
    ] as const;
    const total = rows.length || 1;
    const known = new Set(["low", "medium", "high", "critical"]);
    return stages.map((s) => {
      const count =
        s.key === "other"
          ? rows.filter((row) => !known.has(priorityOf(row))).length
          : rows.filter((row) => priorityOf(row) === s.key).length;
      return { ...s, count, pct: Math.round((count / total) * 100) };
    });
  }, [data]);

  const authBlocked =
    Boolean(data?.statusCodes.includes(401)) ||
    (!authenticated && Boolean(data?.errors.length));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Portal"
        description="Customer self-service — accounts, sessions, projected order/invoice views, tickets, and service requests."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3 text-sm font-medium shadow-sm transition-colors duration-200 hover:bg-muted disabled:opacity-60"
            >
              <RefreshCw
                className={`size-3.5 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
            <Link
              href="/portal/portal-accounts"
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-opacity duration-200 hover:opacity-90"
            >
              <UserCircle className="size-3.5" />
              Accounts
            </Link>
            <Link
              href="/portal/support-tickets"
              className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border/80 bg-card px-3 text-sm font-medium shadow-sm transition-colors duration-200 hover:bg-muted"
            >
              Tickets
            </Link>
          </div>
        }
      />

      {authBlocked ? (
        <div className="rounded-xl border border-dashed border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Sign in to load live portal data.{" "}
          <Link
            href="/login"
            className="cursor-pointer font-medium underline underline-offset-2"
          >
            Go to login
          </Link>
        </div>
      ) : null}

      {data?.partial && !authBlocked ? (
        <div className="rounded-xl border border-border/80 bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
          Some portal endpoints returned errors. Showing available records.
        </div>
      ) : null}

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <FinanceKpiCard
          label="Active accounts"
          value={loading ? "—" : String(kpis.activeAccounts)}
          hint={`${data?.accounts.length ?? 0} accounts · ${data?.profiles.length ?? 0} profiles`}
          icon={Users}
          tone={kpis.activeAccounts > 0 ? "success" : "default"}
        />
        <FinanceKpiCard
          label="Active sessions"
          value={loading ? "—" : String(kpis.activeSessions)}
          hint={`${data?.sessions.length ?? 0} sessions · ${data?.loginAudits.length ?? 0} audits`}
          icon={UserCircle}
          tone={kpis.activeSessions > 0 ? "default" : "success"}
        />
        <FinanceKpiCard
          label="Open tickets"
          value={loading ? "—" : String(kpis.openTickets)}
          hint={`${data?.tickets.length ?? 0} tickets · ${data?.threads.length ?? 0} threads`}
          icon={Ticket}
          tone={kpis.openTickets > 0 ? "warning" : "success"}
        />
        <FinanceKpiCard
          label="Service requests"
          value={loading ? "—" : String(kpis.openRequests)}
          hint={`${data?.serviceRequests.length ?? 0} requests · ${data?.orderViews.length ?? 0} order views`}
          icon={Wrench}
          tone={kpis.openRequests > 0 ? "default" : "success"}
        />
      </div>

      <PortalPipelineFunnel counts={pipelineCounts} loading={loading} />

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {portalQuickLinks.map((link) => {
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
          <Badge variant="secondary">{portalWorkspaceGroups.length} areas</Badge>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {portalWorkspaceGroups.map((group) => {
            const Icon = group.icon;
            const resources = resolvePortalGroupResources(group);
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
                    <h3 className="text-sm font-medium tracking-tight">
                      {group.title}
                    </h3>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      {group.description}
                    </p>
                  </div>
                </div>
                <ul className="space-y-1">
                  {resources.map((resource) => (
                    <li key={resource.key}>
                      <Link
                        href={`/portal/${resource.key}`}
                        className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors duration-200 hover:bg-accent/50"
                      >
                        <span className="font-medium text-foreground">
                          {resource.title}
                        </span>
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
              <h2 className="text-sm font-medium tracking-tight">
                Recent accounts
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Portal identity
              </p>
            </div>
            <Link
              href="/portal/portal-accounts"
              className="cursor-pointer text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
            >
              View all
            </Link>
          </div>
          <div className="erp-scroll overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                  <th className="px-4 py-2.5 font-medium">Account</th>
                  <th className="px-4 py-2.5 font-medium">Email</th>
                  <th className="px-4 py-2.5 font-medium">Display</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-10 text-center text-muted-foreground"
                    >
                      Loading…
                    </td>
                  </tr>
                ) : recent.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-10 text-center text-muted-foreground"
                    >
                      No accounts yet.
                    </td>
                  </tr>
                ) : (
                  recent.map((row, idx) => (
                    <tr
                      key={String(row.id ?? idx)}
                      className="border-b border-border/50 transition-colors duration-150 last:border-0 hover:bg-accent/30"
                    >
                      <td className="max-w-[180px] truncate px-4 py-2.5">
                        <p className="font-medium text-foreground">
                          {String(row.account_number ?? "—")}
                        </p>
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-2.5 text-xs text-muted-foreground">
                        {String(row.login_email ?? "—")}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {String(row.display_name ?? "—")}
                      </td>
                      <td className="px-4 py-2.5">
                        <FinanceStatusBadge
                          status={
                            asStatus(row.status) || String(row.status ?? "")
                          }
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
              <h2 className="text-sm font-medium tracking-tight">
                Ticket watch
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Support envelopes
              </p>
            </div>
            <Link
              href="/portal/support-tickets"
              className="cursor-pointer text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
            >
              View all
            </Link>
          </div>
          <ul className="divide-y divide-border/60">
            {loading ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                Loading…
              </li>
            ) : ticketWatch.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                No tickets yet.
              </li>
            ) : (
              ticketWatch.map((row, idx) => (
                <li
                  key={String(row.id ?? idx)}
                  className="px-4 py-2.5 transition-colors duration-150 hover:bg-accent/30"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">
                      {String(row.ticket_number ?? "—")}
                    </p>
                    <FinanceStatusBadge
                      status={asStatus(row.status) || String(row.status ?? "")}
                    />
                  </div>
                  <p className="mt-1 truncate text-[11px] text-muted-foreground">
                    {String(row.subject ?? "—")} ·{" "}
                    {String(row.priority ?? "—")}
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="mb-3">
            <h2 className="text-sm font-medium tracking-tight">
              Ticket priority mix
            </h2>
            <p className="text-[11px] text-muted-foreground">ERD_23 §Requests</p>
          </div>
          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          ) : (
            <div className="space-y-3">
              {ticketPriorityMix.map((s) => (
                <div key={s.key}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-foreground">
                      {s.label}
                    </span>
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
                Notifications {data?.notifications.length ?? 0} · Dashboards{" "}
                {data?.dashboards.length ?? 0} · Docs{" "}
                {data?.documentAccess.length ?? 0}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
