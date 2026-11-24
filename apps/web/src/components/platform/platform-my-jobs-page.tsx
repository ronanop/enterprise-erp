"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Briefcase,
  FileDown,
  FolderKanban,
  Handshake,
  Package,
  RefreshCw,
  Users,
  type LucideIcon,
} from "lucide-react";

import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { InvoiceGenerationTaskDialog } from "@/components/procurement/invoice-generation-task-dialog";
import { Button } from "@/components/ui/button";
import { useAuthUser } from "@/hooks/use-auth-user";
import { downloadQuoteExport } from "@/lib/crm/crm-record-actions";
import { isErpAdmin } from "@/lib/module-access";
import { cn } from "@/lib/utils";
import {
  loadPlatformMyJobs,
  totalPlatformMyJobCount,
  type PlatformMyJobModuleSection,
  type PlatformMyJobRow,
} from "@/services/platform-my-jobs-service";
import {
  acceptScmOvfCharges,
  acceptScmOvfHold,
  acceptScmPoApproval,
  finalizeScmOrder,
  rejectScmFinalizeApproval,
  rejectScmOvfCharges,
  rejectScmOvfHold,
} from "@/services/procurement-service";
import { decideMyJob, getQuote, listQuoteLines } from "@/services/sales-crm-service";
import {
  downloadInvoiceJobGrnPdf,
  downloadInvoiceJobPoPdf,
} from "@/utils/invoice-job-pdf";
import { buildScmPoPrintPdfAttachment } from "@/utils/scm-po-pdf-attach";

const MODULE_ICONS: Record<string, LucideIcon> = {
  crm: Handshake,
  projects: FolderKanban,
  hr: Users,
  procurement: Package,
};

type PendingDecision = {
  job: PlatformMyJobRow;
  outcome: "approved" | "rejected";
};

export function PlatformMyJobsPage() {
  const { moduleKeys, adminModuleKeys, user, loading: authLoading } = useAuthUser();
  const [sections, setSections] = useState<PlatformMyJobModuleSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [invoiceTaskId, setInvoiceTaskId] = useState<string | null>(null);
  const [pdfBusyKey, setPdfBusyKey] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingDecision | null>(null);
  const [remark, setRemark] = useState("");
  const [deciding, setDeciding] = useState(false);
  const [busyJobId, setBusyJobId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadPlatformMyJobs({
        moduleKeys,
        adminModuleKeys,
        isErpAdmin: isErpAdmin(user?.userType),
      });
      setSections(data);
    } catch (err) {
      setSections([]);
      setError(err instanceof Error ? err.message : "Failed to load My Jobs");
    } finally {
      setLoading(false);
    }
  }, [adminModuleKeys, moduleKeys, user?.userType]);

  useEffect(() => {
    if (authLoading) return;
    void load();
  }, [authLoading, load]);

  const total = totalPlatformMyJobCount(sections);
  const withJobs = sections.filter((s) => s.jobs.length > 0);
  const withErrors = sections.filter((s) => s.error && s.jobs.length === 0);

  async function onDownloadPo(job: PlatformMyJobRow) {
    if (!job.orderId) return;
    const key = `po-${job.id}`;
    setPdfBusyKey(key);
    setPdfError(null);
    try {
      // Admin / management PO approval: always Draft PO with watermark.
      const approvalDownload =
        job.actionKind === "proc_accept_po" || job.actionKind === "proc_issue_po";
      await downloadInvoiceJobPoPdf(job.orderId, {
        watermark: approvalDownload ? true : undefined,
      });
    } catch (err) {
      setPdfError(
        err instanceof Error && err.message.trim()
          ? err.message
          : "Failed to download PO PDF",
      );
    } finally {
      setPdfBusyKey(null);
    }
  }

  async function onDownloadGrn(job: PlatformMyJobRow) {
    if (!job.orderId || !job.receiptBatchId) return;
    const key = `grn-${job.id}`;
    setPdfBusyKey(key);
    setPdfError(null);
    try {
      await downloadInvoiceJobGrnPdf(job.orderId, job.receiptBatchId);
    } catch (err) {
      setPdfError(
        err instanceof Error && err.message.trim()
          ? err.message
          : "Failed to download GRN PDF",
      );
    } finally {
      setPdfBusyKey(null);
    }
  }

  async function onDownloadQuote(job: PlatformMyJobRow) {
    if (!job.quoteId) return;
    const key = `quote-${job.id}`;
    setPdfBusyKey(key);
    setPdfError(null);
    try {
      const [quoteRow, lineRows] = await Promise.all([
        getQuote(job.quoteId),
        listQuoteLines(job.quoteId),
      ]);
      await downloadQuoteExport(quoteRow, lineRows);
    } catch (err) {
      setPdfError(
        err instanceof Error && err.message.trim()
          ? err.message
          : "Failed to download quotation PDF",
      );
    } finally {
      setPdfBusyKey(null);
    }
  }

  function openDecision(job: PlatformMyJobRow, outcome: "approved" | "rejected") {
    setActionError(null);
    setRemark("");
    setPending({ job, outcome });
  }

  async function confirmDecision() {
    if (!pending) return;
    const { job, outcome } = pending;
    setDeciding(true);
    setActionError(null);
    setBusyJobId(job.id);
    try {
      const kind = job.actionKind;
      if (kind === "crm_approve" && job.crmTaskId) {
        await decideMyJob(
          job.crmTaskId,
          outcome,
          remark.trim() || undefined,
        );
      } else if (
        (kind === "proc_accept_po" || kind === "proc_issue_po") &&
        job.orderId
      ) {
        if (outcome === "rejected") {
          await rejectScmFinalizeApproval(job.orderId);
        } else if (kind === "proc_accept_po") {
          await acceptScmPoApproval(job.orderId);
        } else {
          // Issued vendor mail must use a clean PDF (no DRAFT watermark).
          const poPdf = await buildScmPoPrintPdfAttachment(job.orderId, {
            watermark: false,
          });
          await finalizeScmOrder(job.orderId, {
            po_pdf_base64: poPdf?.base64 ?? null,
            po_pdf_filename: poPdf?.filename ?? null,
          });
        }
      } else if (kind === "proc_hold" && job.ovfId) {
        if (outcome === "rejected") await rejectScmOvfHold(job.ovfId);
        else await acceptScmOvfHold(job.ovfId);
      } else if (kind === "proc_freight" && job.ovfId) {
        if (outcome === "rejected") await rejectScmOvfCharges(job.ovfId);
        else await acceptScmOvfCharges(job.ovfId);
      } else {
        throw new Error("This job cannot be decided here");
      }
      setPending(null);
      setRemark("");
      await load();
    } catch (err) {
      setActionError(
        err instanceof Error && err.message.trim()
          ? err.message
          : "Failed to record decision",
      );
    } finally {
      setDeciding(false);
      setBusyJobId(null);
    }
  }

  function decisionTitle(decision: PendingDecision): string {
    const { job, outcome } = decision;
    if (outcome === "rejected") {
      if (job.actionKind === "proc_accept_po" || job.actionKind === "proc_issue_po") {
        return "Reject PO approval?";
      }
      return "Reject this job?";
    }
    return `${job.approveLabel || "Approve"}?`;
  }

  function decisionDescription(decision: PendingDecision): string {
    const { job, outcome } = decision;
    const ref = job.reference || job.title;
    if (outcome === "rejected") {
      return `Reject “${ref}”. The requester can revise and resubmit.`;
    }
    if (job.actionKind === "proc_accept_po") {
      return `Accept PO “${ref}”. It will move to Management for Issue PO.`;
    }
    if (job.actionKind === "proc_issue_po") {
      return `Issue PO “${ref}”. It stays in Procurement for GRN / delivery.`;
    }
    if (job.actionKind === "proc_hold") {
      return `Approve the hold on “${ref}”. The OVF is held only after this accept.`;
    }
    if (job.actionKind === "proc_freight") {
      return `Approve the freight and finance change on “${ref}”. Current charges stay until you accept.`;
    }
    return `Approve “${ref}”.`;
  }

  function renderJobActions(job: PlatformMyJobRow) {
    const busy = busyJobId === job.id;
    const kind = job.actionKind;

    if (kind === "crm_approve") {
      return (
        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
          <Button
            type="button"
            size="sm"
            className="h-7 cursor-pointer px-2.5 text-xs transition-colors duration-200"
            disabled={busy || deciding}
            onClick={() => openDecision(job, "approved")}
          >
            {job.approveLabel || "Approve"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 cursor-pointer px-2.5 text-xs text-destructive transition-colors duration-200 hover:bg-destructive/5 hover:text-destructive"
            disabled={busy || deciding}
            onClick={() => openDecision(job, "rejected")}
          >
            Reject
          </Button>
          <Link
            href={job.href}
            className="inline-flex h-7 cursor-pointer items-center rounded-md border border-border/80 bg-background px-2.5 text-xs font-medium text-foreground transition-colors duration-200 hover:bg-muted"
          >
            Open
          </Link>
        </div>
      );
    }

    if (kind === "crm_complex") {
      return (
        <Link
          href={job.href}
          className="inline-flex h-7 cursor-pointer items-center rounded-md border border-primary/30 bg-primary/5 px-2.5 text-xs font-medium text-primary transition-colors duration-200 hover:bg-primary/10"
        >
          Complete in CRM
        </Link>
      );
    }

    if (
      kind === "proc_accept_po" ||
      kind === "proc_issue_po" ||
      kind === "proc_hold" ||
      kind === "proc_freight"
    ) {
      return (
        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
          <Button
            type="button"
            size="sm"
            className="h-7 cursor-pointer px-2.5 text-xs transition-colors duration-200"
            disabled={busy || deciding}
            onClick={() => openDecision(job, "approved")}
          >
            {job.approveLabel || (kind === "proc_issue_po" ? "Issue PO" : "Accept PO")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 cursor-pointer px-2.5 text-xs text-destructive transition-colors duration-200 hover:bg-destructive/5 hover:text-destructive"
            disabled={busy || deciding}
            onClick={() => openDecision(job, "rejected")}
          >
            Reject
          </Button>
          <Link
            href={job.href}
            className="inline-flex h-7 cursor-pointer items-center rounded-md border border-border/80 bg-background px-2.5 text-xs font-medium text-foreground transition-colors duration-200 hover:bg-muted"
          >
            Open
          </Link>
        </div>
      );
    }

    if (kind === "proc_invoice" && job.invoiceTaskId) {
      return (
        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
          <Button
            type="button"
            size="sm"
            className="h-7 cursor-pointer px-2.5 text-xs transition-colors duration-200"
            onClick={() => {
              const id = job.invoiceTaskId;
              if (id) setInvoiceTaskId(id);
            }}
          >
            {job.approveLabel || "Generate invoice"}
          </Button>
        </div>
      );
    }

    if (job.openMode === "invoice_generation_dialog" && job.invoiceTaskId) {
      return (
        <button
          type="button"
          className="inline-flex h-7 cursor-pointer items-center rounded-md border border-border/80 bg-background px-2.5 text-xs font-medium text-foreground transition-colors duration-200 hover:bg-muted"
          onClick={() => {
            const id = job.invoiceTaskId;
            if (id) setInvoiceTaskId(id);
          }}
        >
          Open
        </button>
      );
    }

    return (
      <Link
        href={job.href}
        className="inline-flex h-7 cursor-pointer items-center rounded-md border border-border/80 bg-background px-2.5 text-xs font-medium text-foreground transition-colors duration-200 hover:bg-muted"
      >
        Open
      </Link>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Jobs"
        description="Approvals and assigned work across every module you can access — one table per module."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer gap-1.5 transition-colors duration-200"
            onClick={() => void load()}
            disabled={loading || authLoading}
          >
            <RefreshCw
              className={cn("size-3.5", (loading || authLoading) && "animate-spin")}
              aria-hidden
            />
            Refresh
          </Button>
        }
      />

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      {pdfError || actionError ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {actionError || pdfError}
        </div>
      ) : null}

      {loading || authLoading ? (
        <div className="space-y-4" aria-busy="true" aria-live="polite">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-xl border border-border/70 bg-muted/40 motion-reduce:animate-none"
            />
          ))}
        </div>
      ) : null}

      {!loading && !authLoading && !error && withJobs.length === 0 && withErrors.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/80 bg-card/60 px-6 py-16 text-center">
          <Briefcase className="size-8 text-muted-foreground/70" aria-hidden />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">No jobs assigned</p>
            <p className="max-w-md text-sm text-muted-foreground">
              When CRM approvals, project delivery steps, HR requests, or procurement invoice
              jobs are assigned to you, they appear here grouped by module.
            </p>
          </div>
        </div>
      ) : null}

      {!loading && !authLoading && withJobs.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{total}</span> open job
          {total === 1 ? "" : "s"} across {withJobs.length} module
          {withJobs.length === 1 ? "" : "s"}
        </p>
      ) : null}

      <div className="space-y-6">
        {sections.map((section) => {
          if (section.jobs.length === 0 && !section.error) return null;
          const Icon = MODULE_ICONS[section.moduleKey] ?? Briefcase;
          return (
            <section
              key={section.moduleKey}
              className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-[0_1px_3px_0_rgba(0,0,0,0.03)]"
              aria-labelledby={`my-jobs-${section.moduleKey}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-muted/40 px-4 py-3 sm:px-5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4" strokeWidth={1.75} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h2
                      id={`my-jobs-${section.moduleKey}`}
                      className="truncate text-sm font-semibold tracking-tight text-foreground"
                    >
                      {section.moduleTitle}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {section.error
                        ? "Could not load"
                        : `${section.jobs.length} open job${section.jobs.length === 1 ? "" : "s"}`}
                    </p>
                  </div>
                </div>
                <Link
                  href={section.moduleHref}
                  className="cursor-pointer text-xs font-medium text-primary underline-offset-2 transition-colors duration-200 hover:underline"
                >
                  Open module
                </Link>
              </div>

              {section.error ? (
                <p className="px-4 py-4 text-sm text-muted-foreground sm:px-5">
                  {section.error}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-border/80 bg-muted/30 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        <th className="px-4 py-2.5 font-semibold sm:px-5">Job</th>
                        <th className="px-4 py-2.5 font-semibold sm:px-5">Reference</th>
                        <th className="px-4 py-2.5 font-semibold sm:px-5">Detail</th>
                        <th className="px-4 py-2.5 font-semibold sm:px-5">Status</th>
                        <th className="px-4 py-2.5 text-right font-semibold sm:px-5">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.jobs.map((job) => {
                        const showPdf = Boolean(job.showPoDownload && job.orderId);
                        const showQuote = Boolean(job.showQuoteDownload && job.quoteId);
                        const poBusy = pdfBusyKey === `po-${job.id}`;
                        const grnBusy = pdfBusyKey === `grn-${job.id}`;
                        const quoteBusy = pdfBusyKey === `quote-${job.id}`;
                        return (
                          <tr
                            key={job.id}
                            className="border-b border-border/50 last:border-0 transition-colors duration-150 hover:bg-muted/30"
                          >
                            <td className="px-4 py-3 font-medium text-foreground sm:px-5">
                              {job.title}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground sm:px-5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span>{job.reference || "—"}</span>
                                {showQuote ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-7 cursor-pointer gap-1 px-2 text-xs transition-colors duration-200"
                                    disabled={Boolean(pdfBusyKey)}
                                    title="Download quotation PDF"
                                    aria-label="Download quotation PDF"
                                    onClick={() => void onDownloadQuote(job)}
                                  >
                                    <FileDown className="size-3.5" aria-hidden />
                                    {quoteBusy ? "PDF…" : "Quote"}
                                  </Button>
                                ) : null}
                                {showPdf ? (
                                  <span className="inline-flex items-center gap-1.5">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="h-7 cursor-pointer gap-1 px-2 text-xs transition-colors duration-200"
                                      disabled={Boolean(pdfBusyKey)}
                                      title={
                                        job.actionKind === "proc_accept_po" ||
                                          job.actionKind === "proc_issue_po"
                                          ? "Download Draft PO PDF with watermark"
                                          : "Download PO print PDF"
                                      }
                                      aria-label={
                                        job.actionKind === "proc_accept_po" ||
                                          job.actionKind === "proc_issue_po"
                                          ? "Download Draft PO PDF with watermark"
                                          : "Download PO print PDF"
                                      }
                                      onClick={() => void onDownloadPo(job)}
                                    >
                                      <FileDown className="size-3.5" aria-hidden />
                                      {poBusy ? "PO…" : "PO"}
                                    </Button>
                                    {job.receiptBatchId ? (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="h-7 cursor-pointer gap-1 px-2 text-xs transition-colors duration-200"
                                        disabled={Boolean(pdfBusyKey)}
                                        title="Download GRN copy PDF"
                                        aria-label="Download GRN copy PDF"
                                        onClick={() => void onDownloadGrn(job)}
                                      >
                                        <FileDown className="size-3.5" aria-hidden />
                                        {grnBusy ? "GRN…" : "GRN PDF"}
                                      </Button>
                                    ) : null}
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td className="max-w-[280px] truncate px-4 py-3 text-muted-foreground sm:px-5">
                              {job.detail || "—"}
                            </td>
                            <td className="px-4 py-3 sm:px-5">
                              <FinanceStatusBadge status={job.status} />
                            </td>
                            <td className="px-4 py-3 text-right sm:px-5">
                              {renderJobActions(job)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })}
      </div>

      <InvoiceGenerationTaskDialog
        open={Boolean(invoiceTaskId)}
        taskId={invoiceTaskId}
        onClose={() => setInvoiceTaskId(null)}
        onCompleted={() => void load()}
      />

      <ConfirmDialog
        open={Boolean(pending)}
        title={pending ? decisionTitle(pending) : ""}
        description={pending ? decisionDescription(pending) : undefined}
        confirmLabel={
          pending?.outcome === "rejected"
            ? "Reject"
            : pending?.job.approveLabel || "Approve"
        }
        tone={pending?.outcome === "rejected" ? "destructive" : "default"}
        busy={deciding}
        onConfirm={() => void confirmDecision()}
        onCancel={() => {
          if (deciding) return;
          setPending(null);
          setRemark("");
          setActionError(null);
        }}
      >
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-slate-600">Remark (optional)</span>
          <textarea
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            rows={3}
            className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-foreground outline-none transition-colors duration-200 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
            placeholder="Add a short note…"
            disabled={deciding}
          />
        </label>
      </ConfirmDialog>
    </div>
  );
}
