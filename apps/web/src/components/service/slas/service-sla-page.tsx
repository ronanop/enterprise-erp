"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Clock, ExternalLink, RefreshCw, Shield, X } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { ResourceListView } from "@/components/module/resource-list-view";
import { PageHeader } from "@/components/layout/page-header";
import { ServicePageNoticeHost } from "@/components/service/service-page-notice";
import { SlaHistoryTimeline } from "@/components/service/slas/sla-history-timeline";
import { Button } from "@/components/ui/button";
import { useUserPermissions } from "@/hooks/use-user-permissions";
import { shouldScopeServiceToMine } from "@/lib/service-engineer-access";
import { CustomerPrioritySlaPanel } from "@/components/service/slas/customer-priority-sla-panel";
import {
  ApiClientError,
  formatDurationMinutes,
  listSlaTracker,
  listTicketSlaPauses,
  type SlaTrackerItem,
  type TicketSlaPauseItem,
} from "@/services/service-request-ticket-service";

type Tab = "active" | "policies";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

const SLA_FILTER_LABELS: Record<string, string> = {
  within: "Within SLA",
  breached: "Breached",
  at_risk: "At risk",
  on_track: "On track",
  paused: "SLA paused",
};

function filterSlaRows(rows: SlaTrackerItem[], filter: string | null): SlaTrackerItem[] {
  if (!filter) return rows;
  switch (filter) {
    case "breached":
      return rows.filter((r) => r.is_breached && !r.is_paused);
    case "paused":
      return rows.filter((r) => Boolean(r.is_paused));
    case "within":
      return rows.filter((r) => !r.is_breached && !r.is_paused);
    case "at_risk":
      return rows.filter((r) => !r.is_breached && !r.is_paused && r.sla_status === "at_risk");
    case "on_track":
      return rows.filter((r) => !r.is_breached && !r.is_paused && r.sla_status !== "at_risk");
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<SlaTrackerItem | null>(null);
  const [history, setHistory] = useState<TicketSlaPauseItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

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

  useEffect(() => {
    setPage(1);
  }, [slaFilter, scopedToMine, pageSize]);

  useEffect(() => {
    if (!selected) {
      setHistory([]);
      setHistoryError(null);
      return;
    }
    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError(null);
    void listTicketSlaPauses(selected.id)
      .then((items) => {
        if (!cancelled) setHistory(items);
      })
      .catch((err) => {
        if (!cancelled) {
          setHistory([]);
          setHistoryError(err instanceof ApiClientError ? err.message : "Failed to load SLA history");
        }
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const breachedCount = useMemo(() => rows.filter((r) => r.is_breached && !r.is_paused).length, [rows]);
  const pausedCount = useMemo(() => rows.filter((r) => Boolean(r.is_paused)).length, [rows]);
  const filteredRows = useMemo(() => filterSlaRows(rows, slaFilter), [rows, slaFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, pageSize, safePage]);
  const rangeFrom = filteredRows.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeTo = Math.min(safePage * pageSize, filteredRows.length);

  const pageNotices = useMemo(() => {
    const items: Array<{ id: string; tone: "danger" | "warning" | "info"; message: string }> = [];
    if (pausedCount > 0) {
      items.push({
        id: `sla-paused-${pausedCount}`,
        tone: "warning",
        message: `${pausedCount} open ticket${pausedCount === 1 ? "" : "s"} with SLA paused`,
      });
    }
    if (breachedCount > 0) {
      items.push({
        id: `sla-breached-${breachedCount}`,
        tone: "danger",
        message: `${breachedCount} ticket${breachedCount === 1 ? "" : "s"} breached or past due`,
      });
    }
    return items;
  }, [breachedCount, pausedCount]);

  const clearDashboardFilter = () => {
    router.replace("/service/service-slas");
  };

  return (
    <div className="space-y-4">
      <ServicePageNoticeHost notices={pageNotices} />

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
        {pausedCount > 0 ? (
          <Button
            type="button"
            size="sm"
            variant={slaFilter === "paused" ? "default" : "outline"}
            onClick={() => router.replace(slaFilter === "paused" ? "/service/service-slas" : "/service/service-slas?filter=paused")}
          >
            Paused
            <span className="ml-1 rounded bg-primary-foreground/20 px-1.5 text-[10px]">{pausedCount}</span>
          </Button>
        ) : null}
        <Button type="button" size="sm" variant={tab === "policies" ? "default" : "outline"} onClick={() => setTab("policies")}>
          <Shield className="size-3.5" />
          SLA Policies
        </Button>
      </div>

      {tab === "policies" ? (
        <div className="space-y-6">
          <CustomerPrioritySlaPanel />
          <ResourceListView
            moduleKey="service"
            moduleTitle="Service"
            title="SLA Policies"
            description="Master SLA definitions used when tickets are opened."
            apiPath="/service/service-slas"
          />
        </div>
      ) : (
        <>
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

          <div className="grid min-w-0 items-start gap-4 lg:grid-cols-3">
            <div className="min-w-0 rounded-lg border border-border/70 bg-card p-4 shadow-sm lg:col-span-2">
              <p className="mb-3 text-xs text-muted-foreground">
                Click a ticket row to view its <span className="font-semibold text-foreground">SLA history</span>{" "}
                (paused / reason / unpaused).
              </p>
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
                      pagedRows.map((row) => {
                        const isSelected = selected?.id === row.id;
                        return (
                          <tr
                            key={row.id}
                            className={`cursor-pointer border-b border-border/50 hover:bg-muted/30 ${
                              isSelected ? "bg-primary/5" : ""
                            }`}
                            onClick={() => setSelected(row)}
                          >
                            <td className="px-3 py-2 font-mono text-xs">
                              <span className={isSelected ? "font-semibold text-primary" : "text-primary"}>
                                {row.document_number}
                              </span>
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
                              <div className="flex flex-wrap items-center gap-1">
                                {row.is_paused ? <FinanceStatusBadge status="pending" label="Paused" /> : null}
                                <FinanceStatusBadge
                                  status={row.is_breached ? "breached" : row.sla_status ?? "within_sla"}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    Showing {rangeFrom}–{rangeTo} of {filteredRows.length}
                  </span>
                  <label className="inline-flex items-center gap-1.5">
                    <span>Rows</span>
                    <select
                      className="h-8 cursor-pointer rounded-lg border border-input bg-transparent px-2 text-sm text-foreground"
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value))}
                      disabled={loading}
                    >
                      {PAGE_SIZE_OPTIONS.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    disabled={loading || safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Page {safePage} / {totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    disabled={loading || safePage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>

            <aside className="min-w-0 rounded-xl border border-border/80 bg-card shadow-sm lg:sticky lg:top-4">
              <div className="border-b border-border/60 bg-muted/35 px-4 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-xs font-semibold tracking-[0.08em] text-foreground uppercase">
                      SLA History
                    </h2>
                    {selected ? (
                      <p className="mt-1 truncate font-mono text-xs font-semibold text-foreground">
                        {selected.document_number}
                      </p>
                    ) : null}
                  </div>
                  {selected ? (
                    <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => setSelected(null)}>
                      <X className="size-3.5" />
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="min-w-0 space-y-3 p-4">
                {!selected ? (
                  <p className="rounded-lg border border-dashed border-border/70 px-3 py-8 text-center text-sm text-muted-foreground">
                    Select a ticket to see paused / reason / unpaused history.
                  </p>
                ) : (
                  <>
                    <div className="space-y-2 rounded-lg border border-border/60 bg-background/70 px-3 py-2.5 text-xs">
                      <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-x-2">
                        <span className="font-semibold text-foreground/80">Subject</span>
                        <span className="min-w-0 break-words font-medium">{selected.subject}</span>
                      </div>
                      <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-x-2">
                        <span className="font-semibold text-foreground/80">Owner</span>
                        <span className="font-medium">{selected.owner_name ?? "—"}</span>
                      </div>
                      <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-x-2">
                        <span className="font-semibold text-foreground/80">SLA</span>
                        <span className="flex flex-wrap items-center gap-1">
                          {selected.is_paused ? <FinanceStatusBadge status="pending" label="Paused" /> : null}
                          <FinanceStatusBadge
                            status={selected.is_breached ? "breached" : selected.sla_status ?? "within_sla"}
                          />
                        </span>
                      </div>
                      {selected.due_at ? (
                        <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-x-2">
                          <span className="font-semibold text-foreground/80">Due</span>
                          <span className="font-medium tabular-nums">
                            {selected.due_at.slice(0, 16).replace("T", " ")}
                          </span>
                        </div>
                      ) : null}
                    </div>

                    <Link
                      href={`/service/service-request-tickets/${selected.id}`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input px-3 text-xs font-medium hover:bg-muted/40"
                    >
                      <ExternalLink className="size-3.5" />
                      Open ticket
                    </Link>

                    {historyLoading ? (
                      <p className="text-sm text-muted-foreground">Loading SLA history…</p>
                    ) : historyError ? (
                      <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        {historyError}
                      </p>
                    ) : (
                      <SlaHistoryTimeline
                        pauses={history}
                        emptyText="No pause / unpause events for this ticket yet."
                        maxHeightClassName="max-h-[28rem]"
                      />
                    )}
                  </>
                )}
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
