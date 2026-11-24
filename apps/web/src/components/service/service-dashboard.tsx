"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, Clock3, RefreshCw, Users, type LucideIcon } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  ServiceSlaComplianceBarChart,
  ServiceStatusBarChart,
} from "@/components/service/service-dashboard-charts";
import {
  SERVICE_STATUS_GROUPS,
  type ServiceDashboardLinkOpts,
  serviceSlaLabelHref,
  serviceStatusGroupHref,
} from "@/config/service-dashboard";
import { useUserPermissions } from "@/hooks/use-user-permissions";
import { isAuthenticated } from "@/lib/auth";
import { shouldScopeServiceToMine } from "@/lib/service-engineer-access";
import { resolveServiceLoginRoleLabel } from "@/lib/service-role-label";
import { cn } from "@/lib/utils";
import {
  approveReopenRequest,
  ApiClientError,
  getServiceDashboardSummary,
  listPendingReopenRequests,
  rejectReopenRequest,
  type PendingReopenQueueItem,
  type ServiceDashboardSummary,
  type SlaComplianceSummary,
} from "@/services/service-request-ticket-service";

function slaComplianceCounts(summary: SlaComplianceSummary, linkOpts?: ServiceDashboardLinkOpts) {
  return [
    { name: "Currently breached", count: summary.active_breached, href: serviceSlaLabelHref("Currently breached", linkOpts) },
    { name: "SLA paused", count: summary.active_paused ?? 0, href: serviceSlaLabelHref("SLA paused", linkOpts) },
    { name: "Closed within SLA", count: summary.closed_within_sla, href: serviceSlaLabelHref("Closed within SLA", linkOpts) },
    { name: "Closed after breach", count: summary.closed_after_breach, href: serviceSlaLabelHref("Closed after breach", linkOpts) },
  ];
}

function statusGroupBar(
  byStatus: ServiceDashboardSummary["by_status"],
  linkOpts?: ServiceDashboardLinkOpts,
): { name: string; value: number; href?: string }[] {
  const countByKey = new Map(byStatus.map((s) => [s.key, s.count]));
  return SERVICE_STATUS_GROUPS.map((group) => ({
    name: group.label,
    value: group.statuses.reduce((sum, st) => sum + (countByKey.get(st) ?? 0), 0),
    href: serviceStatusGroupHref(group.label, linkOpts),
  })).filter((item) => item.value > 0);
}

function priorityBar(
  byPriority: ServiceDashboardSummary["by_priority"],
  linkOpts?: ServiceDashboardLinkOpts,
): { name: string; value: number; href?: string }[] {
  return byPriority.map((p) => ({
    name: p.label || p.key.toUpperCase(),
    value: p.count,
    href: `/service/service-request-tickets?priority=${encodeURIComponent(p.key)}${linkOpts?.mine ? "&mine=1" : ""}`,
  }));
}

function KpiTile({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: number;
  hint?: string;
  href?: string;
}) {
  const body = (
    <>
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 font-mono text-2xl font-semibold tabular-nums tracking-tight text-foreground">
        {value.toLocaleString("en-IN")}
      </p>
      {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-xl border border-border/60 bg-card px-4 py-3 shadow-sm transition-colors hover:bg-muted/40"
      >
        {body}
      </Link>
    );
  }
  return <div className="rounded-xl border border-border/60 bg-card px-4 py-3 shadow-sm">{body}</div>;
}

function ChartPanel({
  title,
  subtitle,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4 shadow-sm",
        "transition-[box-shadow,border-color] duration-200 hover:border-primary/25 hover:shadow-md",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/35 to-transparent"
        aria-hidden
      />
      <div className="mb-3 flex items-start gap-2.5">
        {Icon ? (
          <span
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/40 text-foreground"
            aria-hidden
          >
            <Icon className="size-3.5" />
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
          {subtitle ? (
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export function ServiceDashboard() {
  const { profile, loading: profileLoading } = useUserPermissions();
  const scopedToMine = shouldScopeServiceToMine(profile?.roleCodes, profile?.permissions);
  const canApproveReopen = (profile?.permissions ?? []).includes("service.request:approve");
  const linkOpts = useMemo<ServiceDashboardLinkOpts>(() => ({ mine: scopedToMine }), [scopedToMine]);
  const loginRoleLabel = useMemo(
    () =>
      profile
        ? resolveServiceLoginRoleLabel({
            email: profile.email,
            designation: profile.designation,
            roleName: profile.roleName,
            roleNames: profile.roleNames,
            roleCodes: profile.roleCodes,
            permissions: profile.permissions,
          })
        : null,
    [profile],
  );

  const [summary, setSummary] = useState<ServiceDashboardSummary | null>(null);
  const [pendingReopens, setPendingReopens] = useState<PendingReopenQueueItem[]>([]);
  const [reopenBusyId, setReopenBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    setAuthenticated(isAuthenticated());
  }, []);

  const load = useCallback(async () => {
    if (profileLoading) return;

    setLoading(true);
    setError(null);
    try {
      const authed = isAuthenticated();
      setAuthenticated(authed);
      if (!authed) {
        setSummary(null);
        setPendingReopens([]);
        return;
      }

      const data = await getServiceDashboardSummary({ mine: scopedToMine });
      setSummary(data);

      if (canApproveReopen && (data.pending_reopen_requests ?? 0) > 0) {
        try {
          setPendingReopens(await listPendingReopenRequests());
        } catch {
          setPendingReopens([]);
        }
      } else {
        setPendingReopens([]);
      }
    } catch (err) {
      setSummary(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [profileLoading, scopedToMine, canApproveReopen]);

  useEffect(() => {
    void load();
  }, [load]);

  const statusBar = useMemo(
    () => statusGroupBar(summary?.by_status ?? [], linkOpts),
    [summary?.by_status, linkOpts],
  );
  const priorityBarData = useMemo(
    () => priorityBar(summary?.by_priority ?? [], linkOpts),
    [summary?.by_priority, linkOpts],
  );
  const slaCompliance = useMemo(
    () =>
      slaComplianceCounts(
        summary?.sla ?? { active_breached: 0, active_paused: 0, closed_within_sla: 0, closed_after_breach: 0 },
        linkOpts,
      ),
    [summary?.sla, linkOpts],
  );

  const onApproveReopen = async (id: string) => {
    setReopenBusyId(id);
    try {
      await approveReopenRequest(id);
      await load();
    } finally {
      setReopenBusyId(null);
    }
  };

  const onRejectReopen = async (id: string) => {
    const reason = window.prompt("Rejection reason (required):") ?? "";
    if (!reason.trim()) return;
    setReopenBusyId(id);
    try {
      await rejectReopenRequest(id, reason.trim() || undefined);
      await load();
    } finally {
      setReopenBusyId(null);
    }
  };

  const authBlocked = !authenticated;

  return (
    <div className="space-y-5">
      {profile && loginRoleLabel ? (
        <div className="flex items-center gap-3">
          <span
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-muted/50 text-xs font-semibold tracking-wide text-foreground"
            aria-hidden
          >
            {profile.initials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{profile.displayName}</p>
            <p className="truncate text-xs text-muted-foreground">
              Signed in as <span className="font-medium text-foreground">{loginRoleLabel}</span>
            </p>
          </div>
        </div>
      ) : null}

      <PageHeader
        title={scopedToMine ? "My Service Dashboard" : "Service Dashboard"}
        description={
          loginRoleLabel
            ? scopedToMine
              ? `${loginRoleLabel} view — tickets assigned to you (last 30 days).`
              : `${loginRoleLabel} overview — live aggregates from the service desk.`
            : undefined
        }
        actions={
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3 text-sm font-medium shadow-sm transition-colors duration-200 hover:bg-muted disabled:opacity-60"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
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

      {error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {summary ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <KpiTile label="Tickets (30d)" value={summary.total_tickets} />
          <KpiTile label="Open" value={summary.open_tickets} />
          <KpiTile label="Unassigned" value={summary.unassigned_tickets} />
          <KpiTile
            label="SLA paused"
            value={summary.sla.active_paused ?? 0}
            hint="Open tickets with frozen SLA"
            href={serviceSlaLabelHref("SLA paused", linkOpts)}
          />
          <KpiTile
            label="Pending reopens"
            value={summary.pending_reopen_requests}
            hint={canApproveReopen ? "Approve from queue below" : undefined}
          />
        </div>
      ) : null}

      {canApproveReopen && pendingReopens.length > 0 ? (
        <section className="rounded-xl border border-amber-200/80 bg-amber-50/80 p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-amber-950">Pending reopen requests</h2>
          <ul className="mt-3 space-y-2">
            {pendingReopens.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-amber-200/60 bg-white/80 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <Link
                    href={`/service/service-request-tickets/${row.request_id}`}
                    className="font-mono text-xs font-medium text-primary hover:underline"
                  >
                    {row.document_number ?? row.request_id.slice(0, 8)}
                  </Link>
                  <p className="truncate text-sm font-medium text-foreground">{row.subject ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{row.reason ?? "No reason provided."}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    size="sm"
                    disabled={reopenBusyId === row.id}
                    onClick={() => void onApproveReopen(row.id)}
                  >
                    Approve
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={reopenBusyId === row.id}
                    onClick={() => void onRejectReopen(row.id)}
                  >
                    Reject
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartPanel title="Ticket status" icon={Activity} subtitle="Grouped lifecycle stages">
          <ServiceStatusBarChart data={statusBar} loading={loading} />
        </ChartPanel>
        <ChartPanel title="SLA overview" icon={Clock3}>
          <ServiceSlaComplianceBarChart data={slaCompliance} loading={loading} />
        </ChartPanel>
        <ChartPanel title="Priority mix" icon={Users} className="lg:col-span-2">
          <ServiceStatusBarChart data={priorityBarData} loading={loading} />
        </ChartPanel>
      </div>

      {summary && !scopedToMine && summary.engineer_workload.length > 0 ? (
        <ChartPanel title="Engineer workload" subtitle="Open tickets and active breaches">
          <div className="erp-scroll overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-border/70 text-[11px] tracking-wide text-muted-foreground uppercase">
                  <th className="px-2 py-1.5">Engineer</th>
                  <th className="px-2 py-1.5">Open</th>
                  <th className="px-2 py-1.5">Breached</th>
                </tr>
              </thead>
              <tbody>
                {summary.engineer_workload.slice(0, 12).map((row) => (
                  <tr key={row.owner_employee_id} className="border-b border-border/40">
                    <td className="px-2 py-1.5">{row.owner_name ?? "—"}</td>
                    <td className="px-2 py-1.5 font-mono text-xs tabular-nums">{row.open_tickets}</td>
                    <td className="px-2 py-1.5 font-mono text-xs tabular-nums text-destructive">
                      {row.breached_tickets}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartPanel>
      ) : null}

      {summary && summary.repeated_circuits.length > 0 ? (
        <ChartPanel title="Repeated circuits" subtitle="Multiple tickets on the same CKT (30d)">
          <ul className="space-y-2 text-sm">
            {summary.repeated_circuits.slice(0, 8).map((c) => (
              <li key={c.ckt_id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/50 px-3 py-2">
                <span className="font-mono text-xs">{c.ckt_id}</span>
                <span className="text-muted-foreground">{c.customer_name ?? "—"}</span>
                <span className="font-mono text-xs tabular-nums">{c.ticket_count} tickets</span>
              </li>
            ))}
          </ul>
        </ChartPanel>
      ) : null}
    </div>
  );
}