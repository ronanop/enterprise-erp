"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Banknote, Pencil, RefreshCw } from "lucide-react";

import { ApAllocateDialog } from "@/components/finance/ap/ap-allocate-dialog";
import { ApInvoiceFormDialog } from "@/components/finance/ap/ap-invoice-form-dialog";
import { ApPaymentDialog } from "@/components/finance/ap/ap-payment-dialog";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import { JournalAttachmentsPanel } from "@/components/finance/journals/journal-attachments-panel";
import {
  JournalAuditTimeline,
  type AuditEvent,
} from "@/components/finance/journals/journal-audit-timeline";
import {
  JournalCommentsPanel,
  type JournalCommentItem,
} from "@/components/finance/journals/journal-comments-panel";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useUserDirectory } from "@/hooks/use-user-directory";
import { useUserPermissions } from "@/hooks/use-user-permissions";
import { ApiClientError, resourceService } from "@/services/api-client";
import {
  getApEntry,
  isApEditable,
  isInvoice,
  listInvoicePayments,
  runApAction,
  type ApEntry,
  type ApWorkflowAction,
} from "@/services/ap-service";
import { formatInrPrecise } from "@/services/finance-service";

type PendingAction = {
  action: ApWorkflowAction;
  title: string;
  description: string;
  tone?: "default" | "destructive";
};

export function ApInvoiceDetailPage({ invoiceId }: { invoiceId: string }) {
  const { resolve } = useUserDirectory();
  const { can } = useUserPermissions();
  const canCreate = can("finance.ap:create");
  const canPayment = can("finance.ap:payment");

  const [entry, setEntry] = useState<ApEntry | null>(null);
  const [payments, setPayments] = useState<ApEntry[]>([]);
  const [auditRaw, setAuditRaw] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [allocateOpen, setAllocateOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getApEntry(invoiceId);
      setEntry(data);
      const pay = isInvoice(data) ? await listInvoicePayments(invoiceId).catch(() => []) : [];
      setPayments(pay);

      const auditRes = await resourceService.list("/audit/logs").catch(() => ({ data: [] }));
      const list = Array.isArray(auditRes.data) ? auditRes.data : [];
      setAuditRaw(
        list.filter((row) => String((row as Record<string, unknown>).entity_id ?? "") === invoiceId) as Record<string, unknown>[],
      );
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load AP entry");
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const auditEvents: AuditEvent[] = useMemo(
    () =>
      auditRaw.map((r, i) => ({
        id: String(r.id ?? i),
        operation: String(r.operation ?? "update"),
        performed_by: (r.performed_by as string) ?? null,
        created_at: (r.created_at as string) ?? null,
        detail:
          typeof r.new_value === "object" && r.new_value
            ? JSON.stringify(r.new_value)
            : String(r.new_value ?? r.detail ?? ""),
      })),
    [auditRaw],
  );

  const comments: JournalCommentItem[] = useMemo(
    () =>
      auditEvents
        .filter((e) => ["comment", "submit", "approve", "cancel", "reverse", "payment"].includes(e.operation))
        .map((e) => ({
          id: e.id,
          body: e.detail || e.operation,
          created_by: e.performed_by ?? "",
          created_at: e.created_at ?? "",
          source: e.operation === "comment" ? "comment" : "workflow",
        })),
    [auditEvents],
  );

  const editable = entry ? isApEditable(entry) : false;
  const status = (entry?.status ?? "").toLowerCase();
  const wf = (entry?.workflow_status ?? "").toLowerCase();

  const workflowActions: PendingAction[] = [];
  if (status === "draft" || wf === "draft") {
    workflowActions.push({
      action: "submit",
      title: "Submit for approval?",
      description: "Starts the AP approval workflow.",
    });
  }
  if (status === "submitted" || wf === "submitted") {
    workflowActions.push({
      action: "approve",
      title: "Approve this entry?",
      description: "Approves the invoice for posting.",
    });
  }
  if (["draft", "submitted", "open"].includes(status)) {
    workflowActions.push({
      action: "cancel",
      title: "Cancel this entry?",
      description: "Cancels the invoice. This cannot be undone.",
      tone: "destructive",
    });
  }
  if (["open", "partial", "paid", "posted"].includes(status)) {
    workflowActions.push({
      action: "reverse",
      title: "Reverse this entry?",
      description: "Creates a reversal entry.",
      tone: "destructive",
    });
  }

  async function confirmAction() {
    if (!pending || !entry) return;
    setBusy(true);
    setActionError(null);
    try {
      await runApAction(entry.id, pending.action);
      setPending(null);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : `Failed to ${pending.action}`);
    } finally {
      setBusy(false);
    }
  }

  if (loading && !entry) {
    return (
      <div className="space-y-3">
        <div className="h-10 animate-pulse rounded-lg bg-muted/70" />
        <div className="h-64 animate-pulse rounded-xl bg-muted/70" />
      </div>
    );
  }

  if (error && !entry) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">{error}</p>
        <Button type="button" variant="outline" className="cursor-pointer" onClick={() => void load()}>Retry</Button>
      </div>
    );
  }

  if (!entry) return null;

  const journalId = entry.journal_header_id;

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-20 -mx-1 border-b border-border/60 bg-background/95 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <PageHeader
          title={entry.document_number}
          description={`${entry.document_type} · ${entry.document_date} · ${entry.vendor_name ?? entry.vendor_code ?? "Vendor"}`}
          actions={
            <div className="flex flex-wrap gap-2">
              <Link href="/finance/ap" className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 text-sm hover:bg-muted">
                <ArrowLeft className="size-3.5" /> AP
              </Link>
              <Link href={`/finance/accounts-payable/vendors/${entry.vendor_id}`} className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 text-sm hover:bg-muted">
                Vendor ledger
              </Link>
              <Button type="button" variant="outline" size="sm" className="h-8 cursor-pointer gap-1.5" onClick={() => void load()}>
                <RefreshCw className="size-3.5" /> Refresh
              </Button>
              {canCreate && editable ? (
                <Button type="button" variant="outline" size="sm" className="h-8 cursor-pointer gap-1.5" onClick={() => setEditOpen(true)}>
                  <Pencil className="size-3.5" /> Edit
                </Button>
              ) : null}
              {canPayment && isInvoice(entry) && (entry.status === "open" || entry.status === "partial") ? (
                <>
                  <Button type="button" size="sm" className="h-8 cursor-pointer gap-1.5" onClick={() => setPaymentOpen(true)}>
                    <Banknote className="size-3.5" /> Payment
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="h-8 cursor-pointer" onClick={() => setAllocateOpen(true)}>
                    Allocate
                  </Button>
                </>
              ) : null}
              <FinanceStatusBadge status={entry.status} />
            </div>
          }
        />
      </div>

      {canCreate && workflowActions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {workflowActions.map((a) => (
            <Button
              key={a.action}
              type="button"
              variant={a.tone === "destructive" ? "destructive" : "default"}
              size="sm"
              className="cursor-pointer"
              disabled={busy}
              onClick={() => setPending(a)}
            >
              {a.action[0].toUpperCase() + a.action.slice(1)}
            </Button>
          ))}
        </div>
      ) : null}

      {actionError ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{actionError}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Outstanding</p>
          <p className="mt-2 font-mono text-xl tabular-nums">{formatInrPrecise(entry.outstanding_amount ?? entry.balance_amount)}</p>
        </div>
        <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Paid</p>
          <p className="mt-2 font-mono text-xl tabular-nums">{formatInrPrecise(entry.paid_amount ?? 0)}</p>
        </div>
        <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Balance</p>
          <p className="mt-2 font-mono text-xl tabular-nums">{formatInrPrecise(entry.balance_amount)}</p>
        </div>
        <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Due / Overdue</p>
          <p className="mt-2 text-sm font-mono">{entry.due_date}</p>
          {entry.days_overdue != null && entry.days_overdue > 0 ? (
            <p className="text-xs text-destructive">{entry.days_overdue} days overdue</p>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
        <h3 className="text-sm font-medium tracking-tight">Vendor &amp; Document</h3>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[11px] text-muted-foreground uppercase">Vendor</dt>
            <dd>
              <Link href={`/finance/accounts-payable/vendors/${entry.vendor_id}`} className="cursor-pointer hover:underline">
                {entry.vendor_name ?? entry.vendor_code ?? entry.vendor_id}
              </Link>
            </dd>
          </div>
          <div><dt className="text-[11px] text-muted-foreground uppercase">Currency</dt><dd className="font-mono uppercase">{entry.currency_code}</dd></div>
          <div><dt className="text-[11px] text-muted-foreground uppercase">Invoice date</dt><dd className="font-mono">{entry.document_date}</dd></div>
          <div><dt className="text-[11px] text-muted-foreground uppercase">Due date</dt><dd className="font-mono">{entry.due_date}</dd></div>
          <div><dt className="text-[11px] text-muted-foreground uppercase">Workflow</dt><dd className="capitalize">{entry.workflow_status ?? "—"}</dd></div>
          <div><dt className="text-[11px] text-muted-foreground uppercase">Created by</dt><dd>{resolve(entry.created_by)}</dd></div>
        </dl>
      </div>

      <div className="rounded-xl border border-border/80 bg-card shadow-sm">
        <div className="border-b border-border/70 px-3 py-2.5">
          <h3 className="text-sm font-medium tracking-tight">Invoice Lines</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-[11px] text-muted-foreground uppercase">
                <th className="px-2 py-2 text-left">Description</th>
                <th className="px-2 py-2 text-right">Debit</th>
                <th className="px-2 py-2 text-right">Credit</th>
                <th className="px-2 py-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/40">
                <td className="px-2 py-1.5 text-xs">{entry.document_type} · {entry.document_number}</td>
                <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">{formatInrPrecise(entry.debit_amount)}</td>
                <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">{formatInrPrecise(entry.credit_amount)}</td>
                <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">{formatInrPrecise(entry.balance_amount)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {payments.length > 0 ? (
        <div className="rounded-xl border border-border/80 bg-card shadow-sm">
          <div className="border-b border-border/70 px-3 py-2.5">
            <h3 className="text-sm font-medium tracking-tight">Payments &amp; Allocations</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border/70 bg-muted/40 text-[11px] text-muted-foreground uppercase">
                  <th className="px-2 py-2 text-left">Document</th>
                  <th className="px-2 py-2 text-left">Date</th>
                  <th className="px-2 py-2 text-left">Type</th>
                  <th className="px-2 py-2 text-right">Amount</th>
                  <th className="px-2 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-border/40 hover:bg-muted/40">
                    <td className="px-2 py-1.5 font-mono text-xs">
                      <Link href={`/finance/accounts-payable/invoices/${p.id}`} className="cursor-pointer hover:underline">{p.document_number}</Link>
                    </td>
                    <td className="px-2 py-1.5 font-mono text-xs">{p.document_date}</td>
                    <td className="px-2 py-1.5 text-xs capitalize">{p.document_type}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">{formatInrPrecise(p.debit_amount || p.credit_amount)}</td>
                    <td className="px-2 py-1.5"><FinanceStatusBadge status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
        <h3 className="text-sm font-medium tracking-tight">Ledger Impact</h3>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[11px] text-muted-foreground uppercase">Journal</dt>
            <dd>
              {journalId ? (
                <Link href={`/finance/journals/${journalId}`} className="cursor-pointer font-mono hover:underline">
                  View journal entry
                </Link>
              ) : (
                <span className="text-muted-foreground">Not yet posted to GL</span>
              )}
            </dd>
          </div>
          <div><dt className="text-[11px] text-muted-foreground uppercase">Aging bucket</dt><dd>{entry.aging_bucket ?? "—"}</dd></div>
        </dl>
      </div>

      <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm">
        <h3 className="mb-2 text-sm font-medium tracking-tight">Audit Timeline</h3>
        <JournalAuditTimeline events={auditEvents} resolveUser={resolve} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {journalId ? (
          <JournalCommentsPanel
            journalId={journalId}
            items={comments}
            resolveUser={resolve}
            onPosted={() => void load()}
            readOnly={!editable}
          />
        ) : (
          <div className="rounded-xl border border-border/80 bg-card p-3.5 text-xs text-muted-foreground shadow-sm">
            Comments require a linked journal.
          </div>
        )}
        {journalId ? (
          <JournalAttachmentsPanel journalId={journalId} readOnly={!editable} />
        ) : (
          <div className="rounded-xl border border-border/80 bg-card p-3.5 text-xs text-muted-foreground shadow-sm">
            Attachments available when journal is linked.
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(pending)}
        title={pending?.title ?? ""}
        description={pending?.description}
        confirmLabel={pending ? pending.action[0].toUpperCase() + pending.action.slice(1) : "Confirm"}
        tone={pending?.tone}
        busy={busy}
        onCancel={() => !busy && setPending(null)}
        onConfirm={() => void confirmAction()}
      />

      <ApInvoiceFormDialog open={editOpen} entry={entry} onClose={() => setEditOpen(false)} onSaved={() => void load()} />
      <ApPaymentDialog
        open={paymentOpen}
        defaultVendorId={entry.vendor_id}
        defaultInvoiceId={entry.id}
        onClose={() => setPaymentOpen(false)}
        onSaved={() => void load()}
      />
      <ApAllocateDialog open={allocateOpen} onClose={() => setAllocateOpen(false)} onSaved={() => void load()} />
    </div>
  );
}
