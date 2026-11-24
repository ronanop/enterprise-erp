"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, FileDown, RefreshCw } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { InvoiceGenerationTaskDialog } from "@/components/procurement/invoice-generation-task-dialog";
import { Button } from "@/components/ui/button";
import { formatApiError } from "@/services/api-client";
import {
  listMyInvoiceGenerationTasks,
  type ProcInvoiceGenerationTask,
} from "@/services/procurement-service";
import {
  downloadInvoiceJobGrnPdf,
  downloadInvoiceJobPoPdf,
} from "@/utils/invoice-job-pdf";

export function ProcurementInvoiceJobsPage() {
  const [tasks, setTasks] = useState<ProcInvoiceGenerationTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<ProcInvoiceGenerationTask | null>(null);
  const [pdfBusyKey, setPdfBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listMyInvoiceGenerationTasks("pending");
      setTasks(rows);
    } catch (err) {
      setTasks([]);
      setError(formatApiError(err, "Failed to load invoice generation jobs"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onDownloadPo(task: ProcInvoiceGenerationTask) {
    const key = `po-${task.id}`;
    setPdfBusyKey(key);
    setError(null);
    try {
      await downloadInvoiceJobPoPdf(task.order_header_id);
    } catch (err) {
      setError(formatApiError(err, "Failed to download PO PDF"));
    } finally {
      setPdfBusyKey(null);
    }
  }

  async function onDownloadGrn(task: ProcInvoiceGenerationTask) {
    const key = `grn-${task.id}`;
    setPdfBusyKey(key);
    setError(null);
    try {
      await downloadInvoiceJobGrnPdf(task.order_header_id, task.receipt_batch_id);
    } catch (err) {
      setError(formatApiError(err, "Failed to download GRN PDF"));
    } finally {
      setPdfBusyKey(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Jobs"
        description="Invoice generation tasks assigned to Accounts from Billing GRNs."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer gap-1.5 transition-colors duration-200"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
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
      {message ? (
        <div
          role="status"
          className="rounded-xl border border-border/70 bg-muted/40 px-4 py-3 text-sm text-foreground"
        >
          {message}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading jobs…</p>
      ) : null}

      {!loading && tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/80 bg-card/60 px-6 py-16 text-center">
          <Briefcase className="size-8 text-muted-foreground/70" aria-hidden />
          <p className="text-sm font-semibold text-foreground">No pending invoice jobs</p>
          <p className="max-w-md text-sm text-muted-foreground">
            When SCM saves a GRN with Billing disposition, invoice generation tasks appear here.
          </p>
          <Link
            href="/my-jobs"
            className="cursor-pointer text-xs font-medium text-primary underline-offset-2 transition-colors duration-200 hover:underline"
          >
            Open platform My Jobs
          </Link>
        </div>
      ) : null}

      {!loading && tasks.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border/80 bg-muted/30 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                <th className="px-4 py-2.5">GRN</th>
                <th className="px-4 py-2.5">PO</th>
                <th className="px-4 py-2.5">Sent by</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const poBusy = pdfBusyKey === `po-${task.id}`;
                const grnBusy = pdfBusyKey === `grn-${task.id}`;
                return (
                  <tr
                    key={task.id}
                    className="border-b border-border/50 last:border-0 transition-colors duration-150 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 text-muted-foreground">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">
                          {task.grn_number?.trim() || "—"}
                        </span>
                        {task.receipt_batch_id ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 cursor-pointer gap-1 px-2 text-xs transition-colors duration-200"
                            disabled={Boolean(pdfBusyKey)}
                            title="Download GRN copy PDF"
                            aria-label="Download GRN copy PDF"
                            onClick={() => void onDownloadGrn(task)}
                          >
                            <FileDown className="size-3.5" aria-hidden />
                            {grnBusy ? "GRN…" : "GRN PDF"}
                          </Button>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">
                          {task.purchase_order_number?.trim() || "—"}
                        </span>
                        {task.order_header_id ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 cursor-pointer gap-1 px-2 text-xs transition-colors duration-200"
                            disabled={Boolean(pdfBusyKey)}
                            title="Download PO print PDF"
                            aria-label="Download PO print PDF"
                            onClick={() => void onDownloadPo(task)}
                          >
                            <FileDown className="size-3.5" aria-hidden />
                            {poBusy ? "PO…" : "PO PDF"}
                          </Button>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {task.requested_by_name?.trim() || "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="cursor-pointer transition-colors duration-200"
                        onClick={() => {
                          setMessage(null);
                          setError(null);
                          setActiveTask(task);
                        }}
                      >
                        Fill invoice
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <InvoiceGenerationTaskDialog
        open={Boolean(activeTask)}
        task={activeTask}
        onClose={() => setActiveTask(null)}
        onCompleted={() => {
          setMessage("Invoice details saved. Billing can prefill these values.");
          void load();
        }}
      />
    </div>
  );
}
