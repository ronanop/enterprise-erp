"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, RefreshCw, X } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { localDateKey } from "@/config/service-dashboard";
import { useUserPermissions } from "@/hooks/use-user-permissions";
import { shouldScopeServiceToMine } from "@/lib/service-engineer-access";
import {
  ApiClientError,
  formatStatus,
  listResolvedTickets,
  SOLUTION_TYPES,
  type ResolvedTicketItem,
} from "@/services/service-request-ticket-service";

const solutionLabel = (value: string | null) =>
  SOLUTION_TYPES.find((s) => s.value === value)?.label ?? (value ? formatStatus(value) : "—");

export function ServiceResolvedTicketsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile } = useUserPermissions();
  const engineerScoped = shouldScopeServiceToMine(profile?.roleCodes, profile?.permissions);
  const dayFilter = searchParams.get("day");
  const slaOutcome = searchParams.get("sla_outcome");
  const urlMine = searchParams.get("mine") === "1";
  const scopedToMine = engineerScoped || urlMine;

  const [rows, setRows] = useState<ResolvedTicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listResolvedTickets({
        q: q || undefined,
        page_size: 200,
        sla_outcome: slaOutcome === "within" || slaOutcome === "breach" ? slaOutcome : undefined,
        mine: scopedToMine,
      });
      setRows(data);
    } catch (err) {
      setRows([]);
      setError(err instanceof ApiClientError ? err.message : "Failed to load resolved tickets");
    } finally {
      setLoading(false);
    }
  }, [q, slaOutcome, scopedToMine]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRows = useMemo(() => {
    if (!dayFilter) return rows;
    return rows.filter((row) => {
      const raw = row.resolved_at ?? row.closed_at;
      if (!raw) return false;
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) return false;
      return localDateKey(d) === dayFilter;
    });
  }, [rows, dayFilter]);

  const dayLabel = dayFilter
    ? new Date(`${dayFilter}T12:00:00`).toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  const slaOutcomeLabel =
    slaOutcome === "within" ? "Closed within SLA" : slaOutcome === "breach" ? "Closed after breach" : null;

  const clearDashboardFilter = () => {
    router.replace("/service/resolved-tickets");
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Resolved Tickets"
        actions={
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {dayFilter || slaOutcomeLabel ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-sky-200/80 bg-sky-50 px-3 py-2 text-sm text-sky-950">
          <span>
            Filter from dashboard:{" "}
            <span className="font-medium">{dayLabel ?? slaOutcomeLabel}</span>
          </span>
          <Button type="button" size="sm" variant="outline" className="h-7 gap-1" onClick={clearDashboardFilter}>
            <X className="size-3" />
            Clear
          </Button>
        </div>
      ) : null}

      <div className="rounded-lg border border-border/70 bg-card p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap gap-3">
          <Input
            className="max-w-sm"
            placeholder="Search ticket #, subject, solution…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
            Search
          </Button>
        </div>

        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                <th className="px-3 py-2">Ticket #</th>
                <th className="px-3 py-2">Subject</th>
                <th className="px-3 py-2">Owner</th>
                <th className="px-3 py-2">Priority</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Solution Type</th>
                <th className="px-3 py-2">Solution Summary</th>
                <th className="px-3 py-2">Resolved</th>
                <th className="px-3 py-2">Closed</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                    Loading resolved tickets…
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-12 text-center text-muted-foreground">
                    <CheckCircle2 className="mx-auto mb-2 size-8 opacity-40" />
                    {rows.length === 0 ? "No resolved tickets found." : "No resolved tickets on this day."}
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
                    <td className="max-w-[160px] truncate px-3 py-2">{row.subject}</td>
                    <td className="px-3 py-2">{row.owner_name ?? "—"}</td>
                    <td className="px-3 py-2">
                      <FinanceStatusBadge status={row.priority} />
                    </td>
                    <td className="px-3 py-2">
                      <FinanceStatusBadge status={row.status} />
                    </td>
                    <td className="px-3 py-2">{solutionLabel(row.solution_type)}</td>
                    <td className="max-w-[220px] truncate px-3 py-2 text-muted-foreground">
                      {row.solution_summary ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {row.resolved_at?.slice(0, 16).replace("T", " ") ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {row.closed_at?.slice(0, 16).replace("T", " ") ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
