"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Clock, RefreshCw, Shield, X } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { ResourceListView } from "@/components/module/resource-list-view";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useUserPermissions } from "@/hooks/use-user-permissions";
import { shouldScopeServiceToMine } from "@/lib/service-engineer-access";
import {
  ApiClientError,
  formatDurationMinutes,
  listSlaTracker,
  type SlaTrackerItem,
} from "@/services/service-request-ticket-service";

type Tab = "active" | "policies";

const SLA_FILTER_LABELS: Record<string, string> = {
  within: "Within SLA",
  breached: "Breached",
  at_risk: "At risk",
  on_track: "On track",
};

function filterSlaRows(rows: SlaTrackerItem[], filter: string | null): SlaTrackerItem[] {
  if (!filter) return rows;
  switch (filter) {
    case "breached":
      return rows.filter((r) => r.is_breached);
    case "within":
      return rows.filter((r) => !r.is_breached);
    case "at_risk":
      return rows.filter((r) => !r.is_breached && r.sla_status === "at_risk");
    case "on_track":
      return rows.filter((r) => !r.is_breached && r.sla_status !== "at_risk");
    default:
      return rows;
  }
}

export function ServiceSlaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile } = useUserPermissions();
  const engineerScoped = shouldScopeServiceToMine(profile?.roleCodes, profile?.permissions);
  const slaFilter = searchParams.get("filter");
  const urlMine = searchParams.get("mine") === "1";
  const scopedToMine = engineerScoped || urlMine;
  const [tab, setTab] = useState<Tab>("active");
  const [rows, setRows] = useState<SlaTrackerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listSlaTracker({ mine: scopedToMine }));
    } catch (err) {
      setRows([]);
      setError(err instanceof ApiClientError ? err.message : "Failed to load SLA tracker");
    } finally {
      setLoading(false);
    }
  }, [scopedToMine]);

  useEffect(() => {
    if (tab === "active") void load();
  }, [tab, load]);

  const breachedCount = useMemo(() => rows.filter((r) => r.is_breached).length, [rows]);
  const filteredRows = useMemo(() => filterSlaRows(rows, slaFilter), [rows, slaFilter]);

  const clearDashboardFilter = () => {
    router.replace("/service/service-slas");
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={scopedToMine ? "My SLAs" : "SLAs"}
        actions={
          tab === "active" ? (
            <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          ) : null
        }
      />

      <div className="flex gap-2">
        <Button type="button" size="sm" variant={tab === "active" ? "default" : "outline"} onClick={() => setTab("active")}>
          <Clock className="size-3.5" />
          Active Ticket SLAs
          {rows.length > 0 ? <span className="ml-1 rounded bg-primary-foreground/20 px-1.5 text-[10px]">{rows.length}</span> : null}
        </Button>
        <Button type="button" size="sm" variant={tab === "policies" ? "default" : "outline"} onClick={() => setTab("policies")}>
          <Shield className="size-3.5" />
          SLA Policies
        </Button>
      </div>

      {tab === "policies" ? (
        <ResourceListView
          moduleKey="service"
          moduleTitle="Service"
          title="SLA Policies"
          description="Master SLA definitions used when tickets are opened."
          apiPath="/service/service-slas"
        />
      ) : (
        <>
          {breachedCount > 0 ? (
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="size-4 shrink-0" />
              {breachedCount} ticket{breachedCount === 1 ? "" : "s"} breached or past due
            </div>
          ) : null}

          {slaFilter && SLA_FILTER_LABELS[slaFilter] ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-sky-200/80 bg-sky-50 px-3 py-2 text-sm text-sky-950">
              <span>
                Filter from dashboard: <span className="font-medium">{SLA_FILTER_LABELS[slaFilter]}</span>
              </span>
              <Button type="button" size="sm" variant="outline" className="h-7 gap-1" onClick={clearDashboardFilter}>
                <X className="size-3" />
                Clear
              </Button>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className="rounded-lg border border-border/70 bg-card p-4 shadow-sm">
            <div className="erp-scroll overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                    <th className="px-3 py-2">Ticket #</th>
                    <th className="px-3 py-2">Subject</th>
                    <th className="px-3 py-2">Owner</th>
                    <th className="px-3 py-2">Priority</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">SLA Started</th>
                    <th className="px-3 py-2">Due</th>
                    <th className="px-3 py-2">Elapsed</th>
                    <th className="px-3 py-2">Remaining</th>
                    <th className="px-3 py-2">SLA</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">
                        Loading active SLAs…
                      </td>
                    </tr>
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-3 py-12 text-center text-muted-foreground">
                        <Clock className="mx-auto mb-2 size-8 opacity-40" />
                        {rows.length === 0
                          ? "No active ticket SLAs. SLAs start when a ticket is created or an email is received (weekends included)."
                          : "No tickets match this SLA filter."}
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => (
                      <tr key={row.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="px-3 py-2 font-mono text-xs">
                          <Link
                            href={`/service/service-request-tickets/${row.id}`}
                            className="text-primary hover:underline"
                          >
                            {row.document_number}
                          </Link>
                        </td>
                        <td className="max-w-[180px] truncate px-3 py-2">{row.subject}</td>
                        <td className="px-3 py-2">{row.owner_name ?? "—"}</td>
                        <td className="px-3 py-2">
                          <FinanceStatusBadge status={row.priority} />
                        </td>
                        <td className="px-3 py-2">
                          <FinanceStatusBadge status={row.status} />
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {row.sla_started_at?.slice(0, 16).replace("T", " ")}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {row.due_at?.slice(0, 16).replace("T", " ") ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-xs">{formatDurationMinutes(row.elapsed_minutes)}</td>
                        <td className="px-3 py-2 text-xs">
                          {row.remaining_minutes != null ? (
                            <span className={row.remaining_minutes < 0 ? "font-medium text-destructive" : ""}>
                              {row.remaining_minutes < 0 ? "-" : ""}
                              {formatDurationMinutes(row.remaining_minutes)}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <FinanceStatusBadge
                            status={row.is_breached ? "breached" : row.sla_status ?? "within_sla"}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
