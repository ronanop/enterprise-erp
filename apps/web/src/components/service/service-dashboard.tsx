"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import {
  ServiceSlaComplianceBarChart,
  ServiceStatusBarChart,
  ServiceSupportModeChart,
} from "@/components/service/service-dashboard-charts";
import {
  SERVICE_STATUS_GROUPS,
  SERVICE_SUPPORT_MODES,
  type ServiceDashboardLinkOpts,
  serviceSlaLabelHref,
  serviceStatusGroupHref,
  serviceSupportModeHref,
} from "@/config/service-dashboard";
import { useUserPermissions } from "@/hooks/use-user-permissions";
import { isAuthenticated } from "@/lib/auth";
import { shouldScopeServiceToMine } from "@/lib/service-engineer-access";
import {
  countByStatus,
  loadServiceOverview,
  type ServiceOverview,
  type ServiceRow,
} from "@/services/service-mgmt-service";
import {
  getSlaComplianceSummary,
  type SlaComplianceSummary,
} from "@/services/service-request-ticket-service";

function groupStatusCounts(rows: ServiceRow[], linkOpts?: ServiceDashboardLinkOpts) {
  return SERVICE_STATUS_GROUPS.map((group) => ({
    name: group.label,
    value: countByStatus(rows, [...group.statuses]),
    href: serviceStatusGroupHref(group.label, linkOpts),
  })).filter((item) => item.value > 0);
}

function slaComplianceCounts(summary: SlaComplianceSummary, linkOpts?: ServiceDashboardLinkOpts) {
  return [
    { name: "Currently breached", count: summary.active_breached, href: serviceSlaLabelHref("Currently breached", linkOpts) },
    { name: "Closed within SLA", count: summary.closed_within_sla, href: serviceSlaLabelHref("Closed within SLA", linkOpts) },
    { name: "Closed after breach", count: summary.closed_after_breach, href: serviceSlaLabelHref("Closed after breach", linkOpts) },
  ];
}

function supportModeCounts(rows: ServiceRow[], linkOpts?: ServiceDashboardLinkOpts) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const mode = String(row.mode_of_action ?? "").toLowerCase();
    if (!mode) continue;
    map.set(mode, (map.get(mode) ?? 0) + 1);
  }
  return SERVICE_SUPPORT_MODES.map(({ key, label }) => ({
    name: label,
    count: map.get(key) ?? 0,
    href: serviceSupportModeHref(key, linkOpts),
  }));
}

function ChartPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
      <div className="border-b border-border/70 px-4 py-3">
        <h2 className="text-sm font-medium tracking-tight">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export function ServiceDashboard() {
  const { profile, loading: profileLoading } = useUserPermissions();
  const scopedToMine = shouldScopeServiceToMine(profile?.roleCodes, profile?.permissions);
  const linkOpts = useMemo<ServiceDashboardLinkOpts>(() => ({ mine: scopedToMine }), [scopedToMine]);

  const [data, setData] = useState<ServiceOverview | null>(null);
  const [slaComplianceSummary, setSlaComplianceSummary] = useState<SlaComplianceSummary>({
    active_breached: 0,
    closed_within_sla: 0,
    closed_after_breach: 0,
  });
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    setAuthenticated(isAuthenticated());
  }, []);

  const load = useCallback(async () => {
    if (profileLoading) return;

    setLoading(true);
    try {
      const authed = isAuthenticated();
      setAuthenticated(authed);
      const overview = await loadServiceOverview({ mine: scopedToMine });
      setData(overview);

      if (!authed) {
        setSlaComplianceSummary({ active_breached: 0, closed_within_sla: 0, closed_after_breach: 0 });
        return;
      }

      try {
        setSlaComplianceSummary(await getSlaComplianceSummary({ mine: scopedToMine }));
      } catch {
        setSlaComplianceSummary({ active_breached: 0, closed_within_sla: 0, closed_after_breach: 0 });
      }
    } finally {
      setLoading(false);
    }
  }, [profileLoading, scopedToMine]);

  useEffect(() => {
    void load();
  }, [load]);

  const tickets = data?.requestTickets ?? [];
  const statusBar = useMemo(() => groupStatusCounts(tickets, linkOpts), [tickets, linkOpts]);
  const slaCompliance = useMemo(() => slaComplianceCounts(slaComplianceSummary, linkOpts), [slaComplianceSummary, linkOpts]);
  const supportModes = useMemo(() => supportModeCounts(tickets, linkOpts), [tickets, linkOpts]);

  const authBlocked =
    Boolean(data?.statusCodes.includes(401)) ||
    (!authenticated && Boolean(data?.errors.length));

  return (
    <div className="space-y-5">
      <PageHeader
        title={scopedToMine ? "My Service Dashboard" : "Service Dashboard"}
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

      {data?.partial && !authBlocked ? (
        <div className="rounded-xl border border-border/80 bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
          Some service endpoints returned errors. Showing available records.
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <ChartPanel title="Ticket status">
          <ServiceStatusBarChart data={statusBar} loading={loading} />
        </ChartPanel>
        <ChartPanel title="SLA overview">
          <ServiceSlaComplianceBarChart data={slaCompliance} loading={loading} />
        </ChartPanel>
        <ChartPanel title="Support mode">
          <ServiceSupportModeChart data={supportModes} loading={loading} />
        </ChartPanel>
      </div>
    </div>
  );
}
