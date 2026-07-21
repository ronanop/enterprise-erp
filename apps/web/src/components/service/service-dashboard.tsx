"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  ClipboardList,
  RefreshCw,
  Ticket,
  Wrench,
} from "lucide-react";

import { FinanceKpiCard } from "@/components/finance/finance-kpi-card";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { ServicePipelineFunnel } from "@/components/service/service-pipeline-funnel";
import { Badge } from "@/components/ui/badge";
import {
  resolveServiceGroupResources,
  serviceQuickLinks,
  serviceWorkspaceGroups,
} from "@/config/service";
import { isAuthenticated } from "@/lib/auth";
import {
  asNumber,
  asStatus,
  countByStatus,
  countOpenDocs,
  loadServiceOverview,
  type ServiceOverview,
  type ServiceRow,
} from "@/services/service-mgmt-service";

function recentRequests(rows: ServiceRow[], limit = 6): ServiceRow[] {
  return [...rows]
    .sort((a, b) =>
      String(b.requested_at ?? b.document_number ?? "").localeCompare(
        String(a.requested_at ?? a.document_number ?? ""),
      ),
    )
    .slice(0, limit);
}

export function ServiceDashboard() {
  const [data, setData] = useState<ServiceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const authenticated = typeof window !== "undefined" ? isAuthenticated() : false;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loadServiceOverview());
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
        openRequests: 0,
        openTickets: 0,
        openWorkOrders: 0,
        openEscalations: 0,
      };
    }
    return {
      openRequests: countOpenDocs(data.requests, ["resolved", "closed", "cancelled"]),
      openTickets: countOpenDocs(data.tickets, ["resolved", "closed", "cancelled"]),
      openWorkOrders: countOpenDocs(data.workOrders, ["completed", "closed", "cancelled"]),
      openEscalations: countOpenDocs(data.escalations, ["resolved", "cancelled"]),
    };
  }, [data]);

  const pipelineCounts = useMemo(
    () => ({
      "service-requests": data?.requests.length ?? 0,
      "service-tickets": data?.tickets.length ?? 0,
      "service-assignments": data?.assignments.length ?? 0,
      "work-orders": data?.workOrders.length ?? 0,
      "service-visits": data?.visits.length ?? 0,
      "service-contracts": data?.contracts.length ?? 0,
    }),
    [data],
  );

  const recent = useMemo(() => recentRequests(data?.requests ?? []), [data]);

  const workOrderWatch = useMemo(() => {
    const rows = data?.workOrders ?? [];
    return [...rows]
      .sort((a, b) => asNumber(b.estimated_hours) - asNumber(a.estimated_hours))
      .slice(0, 5);
  }, [data]);

  const ticketStatusMix = useMemo(() => {
    const rows = data?.tickets ?? [];
    const stages = [
      { key: "open", label: "Open", barClass: "bg-slate-400" },
      { key: "pending", label: "Pending", barClass: "bg-sky-600" },
      { key: "in_progress", label: "In progress", barClass: "bg-teal-600" },
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
        title="Service"
        description="Field service — requests, tickets, dispatch, work orders, visits, SLA, escalations, and contracts."
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
              href="/service/service-tickets"
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-opacity duration-200 hover:opacity-90"
            >
              <Ticket className="size-3.5" />
              Tickets
            </Link>
            <Link
              href="/service/work-orders"
              className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border/80 bg-card px-3 text-sm font-medium shadow-sm transition-colors duration-200 hover:bg-muted"
            >
              Work Orders
            </Link>
          </div>
        }
      />

      {authBlocked ? (
        <div className="rounded-xl border border-dashed border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Sign in to load live service data.{" "}
          <Link href="/login" className="cursor-pointer font-medium underline underline-offset-2">
            Go to login
          </Link>
        </div>
      ) : null}

      {data?.partial && !authBlocked ? (
        <div className="rounded-xl border border-border/80 bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
          Some service endpoints returned errors. Showing available records.
        </div>
      ) : null}

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <FinanceKpiCard
          label="Open requests"
          value={loading ? "—" : String(kpis.openRequests)}
          hint={`${data?.requests.length ?? 0} requests · ${countByStatus(data?.requests ?? [], ["in_progress", "assigned"])} active`}
          icon={ClipboardList}
          tone={kpis.openRequests > 0 ? "warning" : "success"}
        />
        <FinanceKpiCard
          label="Open tickets"
          value={loading ? "—" : String(kpis.openTickets)}
          hint={`${data?.tickets.length ?? 0} tickets · ${countByStatus(data?.tickets ?? [], ["in_progress"])} in progress`}
          icon={Ticket}
          tone={kpis.openTickets > 0 ? "default" : "success"}
        />
        <FinanceKpiCard
          label="Open work orders"
          value={loading ? "—" : String(kpis.openWorkOrders)}
          hint={`${data?.workOrders.length ?? 0} WOs · ${countByStatus(data?.visits ?? [], ["planned", "checked_in"])} visits open`}
          icon={Wrench}
          tone={kpis.openWorkOrders > 0 ? "warning" : "success"}
        />
        <FinanceKpiCard
          label="Open escalations"
          value={loading ? "—" : String(kpis.openEscalations)}
          hint={`${countByStatus(data?.slas ?? [], ["active"])} active SLAs · ${countByStatus(data?.contracts ?? [], ["active"])} contracts`}
          icon={AlertTriangle}
          tone={kpis.openEscalations > 0 ? "danger" : "success"}
        />
      </div>

      <ServicePipelineFunnel counts={pipelineCounts} loading={loading} />

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {serviceQuickLinks.map((link) => {
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
          <Badge variant="secondary">{serviceWorkspaceGroups.length} areas</Badge>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {serviceWorkspaceGroups.map((group) => {
            const Icon = group.icon;
            const resources = resolveServiceGroupResources(group);
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
                        href={`/service/${resource.key}`}
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
              <h2 className="text-sm font-medium tracking-tight">Recent requests</h2>
              <p className="text-[11px] text-muted-foreground">Service intake</p>
            </div>
            <Link
              href="/service/service-requests"
              className="cursor-pointer text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
            >
              View all
            </Link>
          </div>
          <div className="erp-scroll overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                  <th className="px-4 py-2.5 font-medium">Request</th>
                  <th className="px-4 py-2.5 font-medium">Priority</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
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
                      No service requests yet.
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
                        {String(row.priority ?? "—").replaceAll("_", " ")}
                      </td>
                      <td className="px-4 py-2.5 text-xs capitalize text-muted-foreground">
                        {String(row.service_type ?? "—").replaceAll("_", " ")}
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
              <h2 className="text-sm font-medium tracking-tight">Work order watch</h2>
              <p className="text-[11px] text-muted-foreground">Highest estimated hours</p>
            </div>
            <Link
              href="/service/work-orders"
              className="cursor-pointer text-xs font-medium text-primary transition-opacity duration-200 hover:opacity-80"
            >
              View all
            </Link>
          </div>
          <ul className="divide-y divide-border/60">
            {loading ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</li>
            ) : workOrderWatch.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                No work orders yet.
              </li>
            ) : (
              workOrderWatch.map((row, idx) => (
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
                    {String(row.work_order_type ?? "WO").replaceAll("_", " ")} · Est{" "}
                    {asNumber(row.estimated_hours)}h · Actual {asNumber(row.actual_hours)}h
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
                Active assignments {countByStatus(data?.assignments ?? [], ["active"])} ·
                Feedback {data?.feedback.length ?? 0} · Materials issued{" "}
                {countByStatus(data?.materials ?? [], ["issued"])}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
