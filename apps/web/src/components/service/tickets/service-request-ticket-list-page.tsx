"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Mail, Plus, RefreshCw, Ticket } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ApiClientError,
  exportTicketsCsv,
  formatStatus,
  getEmailAutomationStatus,
  listServiceRequestTickets,
  testEmailToTicket,
  type EmailAutomationStatus,
  type ServiceRequestTicket,
} from "@/services/service-request-ticket-service";

const PRIORITIES = ["", "p1", "p2", "p3", "p4", "critical", "high", "medium", "low"];
const STATUSES = [
  "",
  "ticket_registered",
  "assigned",
  "engineer_working",
  "pending_customer",
  "pending_oem",
  "resolved",
  "closed",
];
const MODES = ["", "remote_support", "onsite_support"];

export function ServiceRequestTicketListPage() {
  const [rows, setRows] = useState<ServiceRequestTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [priority, setPriority] = useState("");
  const [status, setStatus] = useState("");
  const [mode, setMode] = useState("");
  const [view, setView] = useState<"all" | "mine">("all");
  const [emailStatus, setEmailStatus] = useState<EmailAutomationStatus | null>(null);
  const [emailTesting, setEmailTesting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listServiceRequestTickets({
        q: q || undefined,
        priority: priority || undefined,
        status: status || undefined,
        mode: mode || undefined,
        mine: view === "mine",
        page_size: 200,
      });
      setRows(data);
    } catch (err) {
      setRows([]);
      setError(err instanceof ApiClientError ? err.message : "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }, [q, priority, status, mode, view]);

  useEffect(() => {
    void load();
    void getEmailAutomationStatus()
      .then(setEmailStatus)
      .catch(() => setEmailStatus(null));
  }, [load]);

  const onTestEmailTicket = async () => {
    setEmailTesting(true);
    setError(null);
    try {
      const result = await testEmailToTicket({
        message_id: `test-${Date.now()}@local`,
        from_address: "customer@example.com",
        from_name: "Test Customer",
        subject: "Email test — automatic ticket",
        body_text: "This is a test email body to verify email-to-ticket automation.",
      });
      await load();
      setError(null);
      alert(`Ticket created: ${result.document_number ?? result.ticket_id}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Email test failed");
    } finally {
      setEmailTesting(false);
    }
  };

  const sorted = useMemo(
    () => [...rows].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "")),
    [rows],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Service Request Tickets"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => exportTicketsCsv(sorted)}>
              <Download className="size-3.5" />
              Export
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

      {emailStatus ? (
        <div className="rounded-lg border border-border/70 bg-muted/30 px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Mail className="size-4 text-primary" />
              <span className="font-medium">Email → Ticket automation</span>
              <FinanceStatusBadge status={emailStatus.enabled ? "active" : "inactive"} />
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>SMTP: {emailStatus.smtp_configured ? "ready" : "not configured"}</span>
              <span>IMAP: {emailStatus.imap_configured ? "polling" : "off"}</span>
              <span>Processed: {emailStatus.recent_ingests}</span>
            </div>
            {emailStatus.enabled ? (
              <Button type="button" variant="outline" size="sm" disabled={emailTesting} onClick={() => void onTestEmailTicket()}>
                {emailTesting ? "Creating…" : "Test email → ticket"}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="rounded-lg border border-border/70 bg-card p-4 shadow-sm">
        <div className="mb-4 flex gap-2">
          <Button type="button" size="sm" variant={view === "all" ? "default" : "outline"} onClick={() => setView("all")}>
            All Tickets
          </Button>
          <Button type="button" size="sm" variant={view === "mine" ? "default" : "outline"} onClick={() => setView("mine")}>
            My Assigned Tickets
          </Button>
        </div>
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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

        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                <th className="px-3 py-2">Ticket #</th>
                <th className="px-3 py-2">Subject</th>
                <th className="px-3 py-2">Contact</th>
                <th className="px-3 py-2">Priority</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Mode</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2">Due</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">Loading…</td></tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-12 text-center text-muted-foreground">
                    <Ticket className="mx-auto mb-2 size-8 opacity-40" />
                    No service request tickets found.
                  </td>
                </tr>
              ) : (
                sorted.map((row) => (
                  <tr key={row.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs">
                      <Link href={`/service/service-request-tickets/${row.id}`} className="text-primary hover:underline">
                        {row.document_number}
                      </Link>
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2">{row.subject}</td>
                    <td className="px-3 py-2">{row.contact_name ?? "—"}</td>
                    <td className="px-3 py-2"><FinanceStatusBadge status={row.priority} /></td>
                    <td className="px-3 py-2"><FinanceStatusBadge status={row.status} /></td>
                    <td className="px-3 py-2">{row.mode_of_action ? formatStatus(row.mode_of_action) : "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{row.created_at?.slice(0, 10)}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{row.due_at?.slice(0, 10) ?? "—"}</td>
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
