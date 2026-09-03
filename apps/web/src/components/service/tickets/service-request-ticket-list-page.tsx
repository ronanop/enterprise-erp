"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Plus, RefreshCw, Ticket, X } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import {
  SERVICE_TABLE_HEAD_ROW,
  ServiceErrorBanner,
  ServiceInfoBanner,
  ServiceListPanel,
  ServicePage,
} from "@/components/service/service-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { serviceStatusGroupFromKey, serviceSupportModeLabel } from "@/config/service-dashboard";
import { useUserPermissions } from "@/hooks/use-user-permissions";
import { shouldScopeServiceToMine } from "@/lib/service-engineer-access";
import {
  ApiClientError,
  exportTicketsCsv,
  exportTicketsXlsx,
  formatStatus,
  listServiceRequestTickets,
  type ServiceRequestTicket,
} from "@/services/service-request-ticket-service";

const PRIORITIES = ["", "p1", "p2", "p3", "p4", "critical", "high", "medium", "low"];
const STATUSES = [
  "",
  "ticket_registered",
  "awaiting_assignment",
  "assigned",
  "engineer_working",
  "pending_customer",
  "pending_oem",
  "resolved",
  "closed",
];
const MODES = ["", "remote_support", "onsite_support", "oem_support"];

export function ServiceRequestTicketListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile } = useUserPermissions();
  const engineerScoped = shouldScopeServiceToMine(profile?.roleCodes, profile?.permissions);
  const urlGroup = searchParams.get("group");
  const urlStatus = searchParams.get("status");
  const urlMode = searchParams.get("mode");
  const urlMine = searchParams.get("mine") === "1";
  const statusGroup = urlGroup ? serviceStatusGroupFromKey(urlGroup) : undefined;

  const [rows, setRows] = useState<ServiceRequestTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [priority, setPriority] = useState("");
  const [status, setStatus] = useState(() => urlStatus ?? "");
  const [mode, setMode] = useState(() => urlMode ?? "");
  const [view, setView] = useState<"all" | "mine">(() => (engineerScoped || urlMine ? "mine" : "all"));

  useEffect(() => {
    setStatus(urlStatus ?? "");
  }, [urlStatus]);

  useEffect(() => {
    setMode(urlMode ?? "");
  }, [urlMode]);

  useEffect(() => {
    if (engineerScoped || urlMine) {
      setView("mine");
    }
  }, [engineerScoped, urlMine]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listServiceRequestTickets({
        q: q || undefined,
        priority: priority || undefined,
        status: statusGroup ? undefined : status || undefined,
        mode: mode || undefined,
        mine: engineerScoped || view === "mine",
        page_size: 200,
      });
      setRows(data);
    } catch (err) {
      setRows([]);
      setError(err instanceof ApiClientError ? err.message : "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }, [q, priority, status, mode, view, statusGroup, engineerScoped]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!statusGroup) return rows;
    const allowed = new Set(statusGroup.statuses.map((s) => s.toLowerCase()));
    return rows.filter((row) => allowed.has(String(row.status ?? "").toLowerCase()));
  }, [rows, statusGroup]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "")),
    [filtered],
  );

  const clearDashboardFilter = () => {
    router.replace("/service/service-request-tickets");
    setStatus("");
    setMode("");
  };

  return (
    <ServicePage>
      <PageHeader
        title={engineerScoped ? "My Service Request Tickets" : "Service Request Tickets"}
        description={
          engineerScoped
            ? "Tickets assigned to you as Service Engineer."
            : "Service Head queue — assign owners from ticket detail; manage engineers under Users."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                void exportTicketsXlsx().catch((err) =>
                  setError(err instanceof ApiClientError ? err.message : "Excel export failed"),
                )
              }
            >
              <Download className="size-3.5" />
              Excel Export
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => exportTicketsCsv(sorted)}>
              <Download className="size-3.5" />
              CSV
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Link
              href="/service/service-request-tickets/new"
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground"
            >
              <Plus className="size-3.5" />
              New Ticket
            </Link>
          </div>
        }
      />

      {error ? <ServiceErrorBanner>{error}</ServiceErrorBanner> : null}

      {statusGroup || urlStatus || urlMode ? (
        <ServiceInfoBanner>
          <span className="inline-flex flex-wrap items-center gap-2">
            Filter from dashboard:{" "}
            <span className="font-medium">
              {statusGroup?.label ??
                (urlStatus ? formatStatus(urlStatus) : null) ??
                (urlMode ? serviceSupportModeLabel(urlMode) : "")}
            </span>
            <Button type="button" size="sm" variant="outline" className="h-7 gap-1" onClick={clearDashboardFilter}>
              <X className="size-3" />
              Clear
            </Button>
          </span>
        </ServiceInfoBanner>
      ) : null}

      <ServiceListPanel>
        <div className="border-b border-border/70 px-4 py-3">
          {!engineerScoped ? (
            <div className="mb-3 flex gap-2">
              <Button type="button" size="sm" variant={view === "all" ? "default" : "outline"} onClick={() => setView("all")}>
                All Tickets
              </Button>
              <Button type="button" size="sm" variant={view === "mine" ? "default" : "outline"} onClick={() => setView("mine")}>
                My Assigned Tickets
              </Button>
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Input placeholder="Search tickets…" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="">All priorities</option>
              {PRIORITIES.filter(Boolean).map((p) => (
                <option key={p} value={p}>{p.toUpperCase()}</option>
              ))}
            </select>
            <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {STATUSES.filter(Boolean).map((s) => (
                <option key={s} value={s}>{formatStatus(s)}</option>
              ))}
            </select>
            <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="">All modes</option>
              {MODES.filter(Boolean).map((m) => (
                <option key={m} value={m}>{formatStatus(m)}</option>
              ))}
            </select>
            <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
              Apply filters
            </Button>
          </div>
        </div>

        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className={SERVICE_TABLE_HEAD_ROW}>
                <th className="px-4 py-2.5">Ticket #</th>
                <th className="px-4 py-2.5">Subject</th>
                <th className="px-4 py-2.5">Contact</th>
                <th className="px-4 py-2.5">Priority</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Mode</th>
                <th className="px-4 py-2.5">Created</th>
                <th className="px-4 py-2.5">Due</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    <Ticket className="mx-auto mb-2 size-8 opacity-40" />
                    No service request tickets found.
                  </td>
                </tr>
              ) : (
                sorted.map((row) => (
                  <tr key={row.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-mono text-xs">
                      <Link href={`/service/service-request-tickets/${row.id}`} className="text-primary hover:underline">
                        {row.document_number}
                      </Link>
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-2.5">{row.subject}</td>
                    <td className="px-4 py-2.5">{row.contact_name ?? "—"}</td>
                    <td className="px-4 py-2.5"><FinanceStatusBadge status={row.priority} /></td>
                    <td className="px-4 py-2.5"><FinanceStatusBadge status={row.status} /></td>
                    <td className="px-4 py-2.5">{row.mode_of_action ? formatStatus(row.mode_of_action) : "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{row.created_at?.slice(0, 10)}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{row.due_at?.slice(0, 10) ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </ServiceListPanel>
    </ServicePage>
  );
}
