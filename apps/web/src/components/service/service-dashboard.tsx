"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Bell,
  CheckCircle2,
  Clock,
  RefreshCw,
  Ticket,
} from "lucide-react";

import { FinanceKpiCard } from "@/components/finance/finance-kpi-card";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { ServicePipelineFunnel } from "@/components/service/service-pipeline-funnel";
import { serviceQuickLinks } from "@/config/service";
import { isAuthenticated } from "@/lib/auth";
import {
  asStatus,
  countByStatus,
  countOpenDocs,
  loadServiceOverview,
  type ServiceOverview,
  type ServiceRow,
} from "@/services/service-mgmt-service";
import {
  listResolvedTickets,
  listServiceHeadNotifications,
  listServiceRequestTickets,
  listSlaTracker,
  type ServiceNotification,
  type ServiceRequestTicket,
} from "@/services/service-request-ticket-service";

function recentTickets(rows: ServiceRow[], limit = 6): ServiceRow[] {
  return [...rows]
    .sort((a, b) =>
      String(b.created_at ?? b.document_number ?? "").localeCompare(
        String(a.created_at ?? a.document_number ?? ""),
      ),
    )
    .slice(0, limit);
}

export function ServiceDashboard() {
  const [data, setData] = useState<ServiceOverview | null>(null);
  const [myTickets, setMyTickets] = useState<ServiceRequestTicket[]>([]);
  const [activeSlas, setActiveSlas] = useState(0);
  const [resolvedCount, setResolvedCount] = useState(0);
  const [slaBreached, setSlaBreached] = useState(0);
  const [headAlerts, setHeadAlerts] = useState<ServiceNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const authenticated = typeof window !== "undefined" ? isAuthenticated() : false;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const authed = typeof window !== "undefined" ? isAuthenticated() : false;
      const [overview, assigned, slaRows, resolvedRows, alerts] = await Promise.all([
        loadServiceOverview(),
        authed ? listServiceRequestTickets({ mine: true, page_size: 10 }) : Promise.resolve([]),
        authed ? listSlaTracker() : Promise.resolve([]),
        authed ? listResolvedTickets({ page_size: 200 }) : Promise.resolve([]),
        authed ? listServiceHeadNotifications(8).catch(() => []) : Promise.resolve([]),
      ]);
      setData(overview);
      setMyTickets(assigned);
      setActiveSlas(slaRows.length);
      setSlaBreached(slaRows.filter((r) => r.is_breached).length);
      setResolvedCount(resolvedRows.length);
      setHeadAlerts(alerts);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openRequestTickets = useMemo(() => {
    if (!data) return 0;
    return countOpenDocs(data.requestTickets, ["resolved", "closed", "cancelled"]);
  }, [data]);

  const pipelineCounts = useMemo(
    () => ({
      "service-request-tickets": data?.requestTickets.length ?? 0,
      "service-slas": activeSlas,
      "resolved-tickets": resolvedCount,
    }),
    [data, activeSlas, resolvedCount],
  );

  const recent = useMemo(() => recentTickets(data?.requestTickets ?? []), [data]);

  const ticketStatusMix = useMemo(() => {
    const rows = data?.requestTickets ?? [];
    const stages = [
      { key: "ticket_registered", label: "Registered", barClass: "bg-slate-400" },
      { key: "assigned", label: "Assigned", barClass: "bg-sky-600" },
      { key: "engineer_working", label: "Working", barClass: "bg-teal-600" },
      { key: "pending_customer", label: "Pending Customer", barClass: "bg-amber-500" },
      { key: "pending_oem", label: "Pending OEM", barClass: "bg-orange-500" },
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
              href="/service/service-request-tickets"
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-opacity duration-200 hover:opacity-90"
            >
              <Ticket className="size-3.5" />
              Request Tickets
            </Link>
            <Link
              href="/service/service-slas"
              className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border/80 bg-card px-3 text-sm font-medium shadow-sm transition-colors duration-200 hover:bg-muted"
            >
              <Clock className="size-3.5" />
              SLAs
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
          label="Open request tickets"
          value={loading ? "—" : String(openRequestTickets)}
          hint={`${data?.requestTickets.length ?? 0} total · ${countByStatus(data?.requestTickets ?? [], ["engineer_working", "assigned"])} in progress`}
          icon={Ticket}
          tone={openRequestTickets > 0 ? "default" : "success"}
        />
        <FinanceKpiCard
          label="Active SLAs"
          value={loading ? "—" : String(activeSlas)}
          hint={slaBreached > 0 ? `${slaBreached} breached or overdue` : "Tickets with SLA running"}
          icon={Clock}
          tone={slaBreached > 0 ? "danger" : activeSlas > 0 ? "warning" : "success"}
        />
        <FinanceKpiCard
          label="Resolved tickets"
          value={loading ? "—" : String(resolvedCount)}
          hint="Resolved or closed SOP tickets"
          icon={CheckCircle2}
          tone="success"
        />
        <FinanceKpiCard
          label="Awaiting assignment"
          value={loading ? "—" : String(countByStatus(data?.requestTickets ?? [], ["ticket_registered"]))}
          hint="New tickets waiting for service head"
          icon={Ticket}
          tone={countByStatus(data?.requestTickets ?? [], ["ticket_registered"]) > 0 ? "warning" : "success"}
        />
      </div>

      <ServicePipelineFunnel counts={pipelineCounts} loading={loading} />

      {authenticated && headAlerts.length > 0 ? (
        <section className="rounded-xl border border-amber-300/50 bg-amber-50/80 p-4 shadow-sm dark:border-amber-500/30 dark:bg-amber-950/20">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Bell className="size-4 text-amber-700 dark:text-amber-400" />
              <h2 className="text-sm font-medium tracking-tight">Service alerts</h2>
            </div>
            <Link href="/service/service-slas" className="text-xs font-medium text-primary hover:opacity-80">
              View SLAs
            </Link>
          </div>
          <ul className="space-y-2">
            {headAlerts.slice(0, 5).map((n) => (
              <li key={n.id} className="flex flex-wrap items-center gap-2 text-sm">
                <FinanceStatusBadge status={n.notification_type.replace(/_/g, " ")} />
                <span className="text-muted-foreground">{n.payload_json?.message ?? n.notification_type}</span>
                {n.request_id ? (
                  <Link
                    href={`/service/service-request-tickets/${n.request_id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {n.payload_json?.document_number ?? "View"}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {authenticated && myTickets.length > 0 ? (
        <section className="rounded-xl border border-primary/25 bg-primary/5 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-medium tracking-tight">My assigned tickets</h2>
              <p className="text-[11px] text-muted-foreground">Tickets assigned to you — open each ticket to start SLA</p>
            </div>
            <Link href="/service/service-request-tickets" className="text-xs font-medium text-primary hover:opacity-80">
              View all
            </Link>
          </div>
          <ul className="space-y-2">
            {myTickets.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/service/service-request-tickets/${t.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-card px-3 py-2 text-sm transition-colors hover:bg-accent/40"
                >
                  <span className="font-medium">{t.document_number} · {t.subject}</span>
                  <div className="flex items-center gap-2">
                    <FinanceStatusBadge status={t.status} />
                    {t.status === "assigned" ? (
                      <span className="text-[11px] font-medium text-amber-700">Tap to open</span>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-3">
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

      <div className="grid gap-3 xl:grid-cols-[1.4fr_1fr]">
        <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
            <div>
              <h2 className="text-sm font-medium tracking-tight">Recent request tickets</h2>
            </div>
            <Link
              href="/service/service-request-tickets"
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
                      No service request tickets yet.
                    </td>
                  </tr>
                ) : (
                  recent.map((row, idx) => (
                    <tr
                      key={String(row.id ?? idx)}
                      className="border-b border-border/50 transition-colors duration-150 last:border-0 hover:bg-accent/30"
                    >
                      <td className="max-w-[220px] truncate px-4 py-2.5">
                        <Link
                          href={`/service/service-request-tickets/${String(row.id)}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {String(row.subject ?? row.document_number ?? "—")}
                        </Link>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {String(row.document_number ?? "")}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 text-xs capitalize text-muted-foreground">
                        {String(row.priority ?? "—").replaceAll("_", " ")}
                      </td>
                      <td className="px-4 py-2.5 text-xs capitalize text-muted-foreground">
                        {String(row.mode_of_action ?? row.service_type ?? "—").replaceAll("_", " ")}
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
            <h2 className="text-sm font-medium tracking-tight">Request ticket status</h2>
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
