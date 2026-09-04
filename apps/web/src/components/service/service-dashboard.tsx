"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, Clock3, RefreshCw, Wrench } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import {
  ServiceSlaComplianceBarChart,
  ServiceStatusBarChart,
  ServiceSupportModeChart,
} from "@/components/service/service-dashboard-charts";
import {
  ServiceErrorBanner,
  ServiceInfoBanner,
  ServicePage,
  ServiceSection,
  ServiceWarnBanner,
} from "@/components/service/service-ui";
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
    {
      name: "Currently breached",
      count: summary.active_breached,
      href: serviceSlaLabelHref("Currently breached", linkOpts),
    },
    {
      name: "Closed within SLA",
      count: summary.closed_within_sla,
      href: serviceSlaLabelHref("Closed within SLA", linkOpts),
    },
    {
      name: "Closed after breach",
      count: summary.closed_after_breach,
      href: serviceSlaLabelHref("Closed after breach", linkOpts),
    },
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
        setSlaComplianceSummary({
          active_breached: 0,
          closed_within_sla: 0,
          closed_after_breach: 0,
        });
        return;
      }

      try {
        setSlaComplianceSummary(await getSlaComplianceSummary({ mine: scopedToMine }));
      } catch {
        setSlaComplianceSummary({
          active_breached: 0,
          closed_within_sla: 0,
          closed_after_breach: 0,
        });
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
  const slaCompliance = useMemo(
    () => slaComplianceCounts(slaComplianceSummary, linkOpts),
    [slaComplianceSummary, linkOpts],
  );
  const supportModes = useMemo(() => supportModeCounts(tickets, linkOpts), [tickets, linkOpts]);

  const authBlocked =
    Boolean(data?.statusCodes?.includes(401)) ||
    (!authenticated && Boolean(data?.errors?.length));

  return (
    <ServicePage>
      <PageHeader
        title={scopedToMine ? "My Service Dashboard" : "Service Dashboard"}
        description={
          scopedToMine
            ? "Tickets assigned to you — status, SLA, and support mode."
            : "Service Head overview — assign engineers from Users, then work the ticket queue."
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
        <ServiceWarnBanner>
          Sign in to load live service data.{" "}
          <Link href="/login" className="cursor-pointer font-medium underline underline-offset-2">
            Go to login
          </Link>
        </ServiceWarnBanner>
      ) : null}

      {data?.partial && !authBlocked ? (
        <ServiceInfoBanner>
          Some service endpoints returned errors. Showing available records.
        </ServiceInfoBanner>
      ) : null}

      {data?.errors?.length && !authBlocked ? (
        <ServiceErrorBanner>{data.errors[0]}</ServiceErrorBanner>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <ServiceSection title="Ticket status" icon={Activity}>
          <ServiceStatusBarChart data={statusBar} loading={loading} />
        </ServiceSection>
        <ServiceSection title="SLA overview" icon={Clock3}>
          <ServiceSlaComplianceBarChart data={slaCompliance} loading={loading} />
        </ServiceSection>
        <ServiceSection title="Support mode" icon={Wrench} className="lg:col-span-2">
          <ServiceSupportModeChart data={supportModes} loading={loading} />
        </ServiceSection>
      </div>
    </ServicePage>
  );
}
