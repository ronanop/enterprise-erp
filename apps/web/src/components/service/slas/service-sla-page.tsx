"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Bell, Clock, RefreshCw, Shield } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { ResourceListView } from "@/components/module/resource-list-view";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  ApiClientError,
  formatDurationMinutes,
  listServiceHeadNotifications,
  listSlaTracker,
  type ServiceNotification,
  type SlaTrackerItem,
} from "@/services/service-request-ticket-service";

type Tab = "active" | "policies";

export function ServiceSlaPage() {
  const [tab, setTab] = useState<Tab>("active");
  const [rows, setRows] = useState<SlaTrackerItem[]>([]);
  const [notifications, setNotifications] = useState<ServiceNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [slaRows, notifs] = await Promise.all([
        listSlaTracker(),
        listServiceHeadNotifications().catch(() => []),
      ]);
      setRows(slaRows);
      setNotifications(notifs);
    } catch (err) {
      setRows([]);
      setError(err instanceof ApiClientError ? err.message : "Failed to load SLA tracker");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "active") void load();
  }, [tab, load]);

  const breachedCount = useMemo(() => rows.filter((r) => r.is_breached).length, [rows]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="SLAs"
        description="Track active ticket SLA clocks and manage SLA policy definitions."
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
          {notifications.length > 0 ? (
            <div className="rounded-lg border border-border/70 bg-muted/30 px-4 py-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Bell className="size-4 text-primary" />
                Service head alerts
              </div>
              <ul className="space-y-1.5 text-sm">
                {notifications.slice(0, 5).map((n) => (
                  <li key={n.id} className="flex flex-wrap items-center gap-2 text-muted-foreground">
                    <FinanceStatusBadge status={n.notification_type.replace(/_/g, " ")} />
                    <span>{n.payload_json?.message ?? n.notification_type}</span>
                    {n.request_id ? (
                      <Link href={`/service/service-request-tickets/${n.request_id}`} className="text-primary hover:underline">
                        {n.payload_json?.document_number ?? "View ticket"}
                      </Link>
                    ) : null}
                    {n.sent_at ? <span className="text-xs">{n.sent_at.slice(0, 16).replace("T", " ")}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {breachedCount > 0 ? (
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="size-4 shrink-0" />
              {breachedCount} ticket{breachedCount === 1 ? "" : "s"} breached or past due
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
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-3 py-12 text-center text-muted-foreground">
                        <Clock className="mx-auto mb-2 size-8 opacity-40" />
                        No active ticket SLAs. SLAs start when an engineer opens an assigned ticket.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
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
