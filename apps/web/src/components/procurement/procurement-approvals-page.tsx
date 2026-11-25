"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { BadgeCheck, Check, Download, Eye, Loader2, Paperclip, RefreshCw, X } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import {
  ProcurementErrorBanner,
  ProcurementKpiCard,
  ProcurementListPanel,
  ProcurementPage,
  procurementUi,
} from "@/components/procurement/procurement-ui";
import { Button } from "@/components/ui/button";
import { useProcurementApprovalAccess } from "@/hooks/use-procurement-approval-access";
import { useProcurementApprovals } from "@/hooks/use-procurement-approvals";
import {
  enrichPoApprovals,
  isOvfCreatePoApprovalOrderKey,
  readPoApprovals,
  setPoApprovalDocuments,
  type PoApprovalDocument,
  type PoApprovalRequest,
} from "@/lib/procurement-approvals";
import { cn } from "@/lib/utils";
import { formatApiError } from "@/services/api-client";
import {
  collectPoApprovalDocuments,
  downloadScmCommercialAttachment,
  getScmOvfPreview,
  listPurchaseOrders,
  listVendorOptions,
  openScmCommercialAttachment,
} from "@/services/procurement-service";
import { downloadInvoiceJobPoPdf } from "@/utils/invoice-job-pdf";
import { buildScmOvfPdfBlob } from "@/utils/scm-ovf-pdf";

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function statusTone(status: PoApprovalRequest["status"]): string {
  if (status === "accepted") return "border-emerald-200/80 bg-emerald-50 text-emerald-800";
  if (status === "rejected") return "border-red-200/80 bg-red-50 text-red-800";
  if (status === "notified") return "border-sky-200/80 bg-sky-50 text-sky-900";
  return "border-amber-200/80 bg-amber-50 text-amber-900";
}

function approvalKindLabel(row: PoApprovalRequest): string {
  if (row.kind === "hold_ovf") return "OVF hold";
  if (row.kind === "freight_finance") {
    return row.status === "notified" ? "Freight change notice" : "Freight & finance";
  }
  if (row.kind === "create_po_in_stock") return "Create PO (IN STOCK)";
  if (row.stageLabel) return row.stageLabel;
  if (row.scmApprovalStage === "management") return "Management PO approval";
  if (row.scmApprovalStage === "accept_po") return "Accept PO";
  return "Accept PO";
}

function canDecideRow(
  row: PoApprovalRequest,
  access: {
    isAdmin: boolean;
    canDecideAcceptPo: boolean;
    canDecideManagement: boolean;
    canDecideHold: boolean;
    canDecideFreight: boolean;
    canDecideStage: (stage: "accept_po" | "management" | null | undefined) => boolean;
  },
): boolean {
  if (row.status !== "pending") return false;
  if (row.kind === "hold_ovf") return access.canDecideHold;
  if (row.kind === "freight_finance") return access.canDecideFreight;
  if (row.kind === "create_po_in_stock") return access.isAdmin;
  return access.canDecideStage(row.scmApprovalStage || "accept_po");
}

function approvalPrimaryHref(row: PoApprovalRequest): string {
  if (
    (row.kind === "create_po_in_stock" ||
      row.kind === "hold_ovf" ||
      row.kind === "freight_finance") &&
    row.ovfId
  ) {
    return `/procurement/scm/ovf/${row.ovfId}`;
  }
  if (isOvfCreatePoApprovalOrderKey(row.orderId)) {
    const ovfId = row.ovfId || row.orderId.slice(4);
    return `/procurement/scm/ovf/${ovfId}`;
  }
  return `/procurement/orders/${row.orderId}`;
}

function approvalPrimaryLabel(row: PoApprovalRequest): string {
  if (row.kind === "create_po_in_stock") {
    return row.ovfNo || row.documentNumber || "OVF";
  }
  return row.companyPoNumber || row.documentNumber;
}

function approvalIsWithoutOvf(row: PoApprovalRequest): boolean {
  if (row.kind === "create_po_in_stock" || row.kind === "hold_ovf") return false;
  return !(row.ovfNo || "").trim() && !(row.ovfId || "").trim();
}

async function openApprovalDocument(doc: PoApprovalDocument): Promise<void> {
  if (doc.attachmentSource === "generated" && doc.id.startsWith("generated-ovf-pdf:")) {
    const ovfId = doc.id.slice("generated-ovf-pdf:".length);
    const preview = await getScmOvfPreview(ovfId);
    const { blob, fileName } = await buildScmOvfPdfBlob(preview);
    const url = URL.createObjectURL(blob);
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) {
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.rel = "noopener";
      a.click();
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }
  await openScmCommercialAttachment(doc.id, {
    source: doc.attachmentSource || "upload",
    external_url: doc.externalUrl || null,
    file_name: doc.fileName,
  });
}

async function downloadApprovalDocument(doc: PoApprovalDocument): Promise<void> {
  if (doc.attachmentSource === "generated" && doc.id.startsWith("generated-ovf-pdf:")) {
    const ovfId = doc.id.slice("generated-ovf-pdf:".length);
    const preview = await getScmOvfPreview(ovfId);
    const { blob, fileName } = await buildScmOvfPdfBlob(preview);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.rel = "noopener";
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  await downloadScmCommercialAttachment(doc.id, doc.fileName, {
    source: doc.attachmentSource || "upload",
    external_url: doc.externalUrl || null,
  });
}

function ApprovalDocuments({
  documents,
  onOpenError,
}: {
  documents: PoApprovalDocument[];
  onOpenError: (message: string) => void;
}) {
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  if (documents.length === 0) {
    return <span className="text-xs text-muted-foreground">No documents</span>;
  }
  return (
    <ul className="space-y-1">
      {documents.map((doc) => (
        <li key={doc.id} className="flex items-start gap-1.5">
          <Paperclip className="mt-0.5 size-3 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0 flex-1">
            <button
              type="button"
              className="min-w-0 max-w-full cursor-pointer truncate text-left text-xs font-medium text-sky-800 transition-colors duration-200 hover:underline"
              disabled={openingId === doc.id}
              title={`View ${doc.fileName}`}
              onClick={() => {
                setOpeningId(doc.id);
                void openApprovalDocument(doc)
                  .catch((err) =>
                    onOpenError(err instanceof Error ? err.message : "Failed to open document"),
                  )
                  .finally(() => setOpeningId(null));
              }}
            >
              {openingId === doc.id ? "Opening…" : doc.fileName}
            </button>
          </div>
          <button
            type="button"
            className="mt-0.5 inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            title={`Download ${doc.fileName}`}
            aria-label={`Download ${doc.fileName}`}
            disabled={downloadingId === doc.id}
            onClick={() => {
              setDownloadingId(doc.id);
              void downloadApprovalDocument(doc)
                .catch((err) =>
                  onOpenError(err instanceof Error ? err.message : "Failed to download document"),
                )
                .finally(() => setDownloadingId(null));
            }}
          >
            {downloadingId === doc.id ? (
              <Loader2 className="size-3 animate-spin" aria-hidden />
            ) : (
              <Download className="size-3" aria-hidden />
            )}
          </button>
          <Eye className="mt-0.5 size-3 shrink-0 text-muted-foreground" aria-hidden />
        </li>
      ))}
    </ul>
  );
}

function DocumentsInsideToggle({
  documents,
  onOpenError,
}: {
  documents: PoApprovalDocument[];
  onOpenError: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const count = documents.length;
  return (
    <div className="mt-1.5 space-y-1.5">
      <button
        type="button"
        className={cn(
          "inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors duration-200",
          open
            ? "border-sky-300 bg-sky-50 text-sky-900"
            : "border-border bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground",
        )}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Paperclip className="size-3" aria-hidden />
        {count === 0 ? "No documents" : `${count} document${count === 1 ? "" : "s"}`}
      </button>
      {open ? (
        <div className="rounded-md border border-border/70 bg-muted/20 px-2.5 py-2">
          <ApprovalDocuments documents={documents} onOpenError={onOpenError} />
        </div>
      ) : null}
    </div>
  );
}

export function ProcurementApprovalsPage() {
  const access = useProcurementApprovalAccess();
  const { isAdmin, canDecideApprovals } = access;
  const { rows, pending, pendingCount, decide, refresh, loadError } = useProcurementApprovals();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [downloadingPoId, setDownloadingPoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "accepted" | "rejected" | "notified">(
    "all",
  );
  const [enriching, setEnriching] = useState(false);

  const hydrateLabels = useCallback(async () => {
    const current = readPoApprovals();
    if (current.length === 0) return;
    const needsHydration = current.some(
      (row) => !row.customerName || !row.vendorName || row.documents.length === 0,
    );
    if (!needsHydration) return;

    setEnriching(true);
    try {
      const [orders, vendors] = await Promise.all([
        listPurchaseOrders().catch(() => []),
        listVendorOptions().catch(() => []),
      ]);
      const vendorById = Object.fromEntries(vendors.map((v) => [v.id, v.label]));
      const orderById = Object.fromEntries(orders.map((o) => [o.id, o]));
      const patch: Record<
        string,
        { customerName?: string | null; vendorName?: string | null; companyPoNumber?: string | null }
      > = {};
      for (const row of current) {
        const order = orderById[row.orderId];
        patch[row.orderId] = {
          customerName: order?.customer_name || null,
          vendorName:
            vendorById[row.vendorId] ||
            vendorById[order?.vendor_id || ""] ||
            null,
          companyPoNumber: order?.company_po_number || null,
        };
        if (row.documents.length === 0) {
          const documents = await collectPoApprovalDocuments({
            orderId: row.orderId,
            ovfId: row.ovfId || order?.source_document_id,
          }).catch(() => []);
          if (documents.length > 0) {
            setPoApprovalDocuments(row.id, documents);
          }
        }
      }
      enrichPoApprovals(patch);
      void refresh();
    } catch (err) {
      setError(formatApiError(err, "Failed to load customer / vendor names"));
    } finally {
      setEnriching(false);
    }
  }, [refresh]);

  useEffect(() => {
    void hydrateLabels();
  }, [hydrateLabels, rows.length]);

  const visible = useMemo(() => {
    const source = canDecideApprovals && filter === "pending" ? pending : rows;
    if (filter === "all") return source;
    return source.filter((row) => row.status === filter);
  }, [canDecideApprovals, filter, pending, rows]);

  const acceptedCount = rows.filter((row) => row.status === "accepted").length;
  const rejectedCount = rows.filter((row) => row.status === "rejected").length;

  async function onDownloadPo(row: PoApprovalRequest, event?: MouseEvent) {
    event?.preventDefault();
    event?.stopPropagation();
    if (row.kind !== "finalize" || isOvfCreatePoApprovalOrderKey(row.orderId)) return;
    setDownloadingPoId(row.id);
    setError(null);
    try {
      // Admin / management review: Draft PO with watermark until issued to vendor.
      await downloadInvoiceJobPoPdf(row.orderId, { watermark: true });
    } catch (err) {
      setError(formatApiError(err, "Failed to download PO PDF"));
    } finally {
      setDownloadingPoId(null);
    }
  }

  async function onAccept(row: PoApprovalRequest, event?: MouseEvent) {
    event?.preventDefault();
    event?.stopPropagation();
    setBusyId(row.id);
    setError(null);
    setSuccess(null);
    try {
      await decide(row, "accepted");
      if (row.kind === "hold_ovf") {
        setSuccess("Hold approved. The OVF is now on hold.");
      } else if (row.kind === "freight_finance") {
        setSuccess("Freight and finance approved. The OVF now uses the new values.");
      } else if (row.kind === "create_po_in_stock") {
        setSuccess(
          "Create PO approved. Requester can create the PO in SCM - nothing is sent to Projects.",
        );
      } else if ((row.scmApprovalStage || "accept_po") === "accept_po") {
        setSuccess("PO accepted. It is now waiting for Management approval.");
      } else {
        setSuccess(
          "PO issued. It stays in Procurement (GRN / delivery). It is not sent to Projects - share only from Installation.",
        );
      }
    } catch (err) {
      setError(
        formatApiError(
          err,
          row.kind === "create_po_in_stock"
            ? "Failed to approve Create PO request"
            : "Failed to accept approval request",
        ),
      );
    } finally {
      setBusyId(null);
    }
  }

  async function onReject(row: PoApprovalRequest, event?: MouseEvent) {
    event?.preventDefault();
    event?.stopPropagation();
    setBusyId(row.id);
    setError(null);
    setSuccess(null);
    try {
      await decide(row, "rejected");
      setSuccess("Request rejected. Requester can edit and resubmit.");
    } catch (err) {
      setError(formatApiError(err, "Failed to reject request"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ProcurementPage>
      <PageHeader
        title="Approval"
        description={
          canDecideApprovals
            ? "Accept PO first, then Management issues the PO. Create PO (IN STOCK) stays admin-only. Issuing does not send the PO to Projects."
            : "Track Create PO (IN STOCK) and finalize requests you sent. You get a notification when an approver decides."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => {
                setError(null);
                setSuccess(null);
                void refresh();
                void hydrateLabels();
              }}
            >
              <RefreshCw
                className={cn("mr-1.5 size-3.5", enriching && "animate-spin")}
              />
              Refresh
            </Button>
          </div>
        }
      />

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        <ProcurementKpiCard
          label={canDecideApprovals ? "PENDING REQUESTS" : "MY REQUESTS"}
          value={String(pendingCount)}
          icon={BadgeCheck}
          tone="warning"
        />
        <ProcurementKpiCard
          label="ACCEPTED"
          value={String(acceptedCount)}
          icon={Check}
          tone="success"
        />
        <ProcurementKpiCard label="REJECTED" value={String(rejectedCount)} icon={X} tone="danger" />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            { key: "all", label: "All" },
            { key: "pending", label: "Pending" },
            { key: "notified", label: "Notices" },
            { key: "accepted", label: "Accepted" },
            { key: "rejected", label: "Rejected" },
          ] as const
        ).map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => setFilter(chip.key)}
            className={cn(
              "cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium transition-colors duration-200",
              filter === chip.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {loadError ? <ProcurementErrorBanner>{loadError}</ProcurementErrorBanner> : null}
      {error ? <ProcurementErrorBanner>{error}</ProcurementErrorBanner> : null}
      {success ? (
        <div className="rounded-md border border-emerald-200/80 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
          {success}
        </div>
      ) : null}

      <ProcurementListPanel>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 px-3 py-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {visible.length} request{visible.length === 1 ? "" : "s"}
          </p>
        </div>
        {visible.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            {canDecideApprovals
              ? "No approval requests match this filter."
              : "No approval requests yet. Request Create PO on an IN STOCK OVF, or finalize a draft PO."}
          </div>
        ) : (
          <div className={procurementUi.tableScroll}>
            <table className={cn(procurementUi.table, "min-w-[980px]")}>
              <thead className={procurementUi.thead}>
                <tr>
                  <th className="px-3 py-2 font-medium">Request</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Customer</th>
                  <th className="px-3 py-2 font-medium">Vendor</th>
                  <th className="px-3 py-2 font-medium">Requested by</th>
                  <th className="px-3 py-2 font-medium">Requested at</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.id} className="border-t border-border/60">
                    <td className="px-3 py-2.5 align-top">
                      <Link
                        href={approvalPrimaryHref(row)}
                        className="cursor-pointer font-semibold text-foreground transition-colors duration-200 hover:text-sky-800"
                      >
                        {approvalPrimaryLabel(row)}
                      </Link>
                      {approvalIsWithoutOvf(row) ? (
                        <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-amber-800">
                          Without OVF
                        </p>
                      ) : null}
                      {row.kind === "hold_ovf" && row.holdRemark ? (
                        <p className="text-[11px] text-muted-foreground">Remark: {row.holdRemark}</p>
                      ) : null}
                      {row.kind === "freight_finance" && row.chargeSummary ? (
                        <p className="text-[11px] text-muted-foreground">{row.chargeSummary}</p>
                      ) : null}
                      {row.kind === "create_po_in_stock" && row.reason ? (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {row.reason === "stock_short"
                            ? "Reason: stock short / already used"
                            : "Reason: create PO instead of inventory"}
                        </p>
                      ) : null}
                      <DocumentsInsideToggle
                        documents={row.documents}
                        onOpenError={(message) => setError(message)}
                      />
                    </td>
                    <td className="px-3 py-2.5 text-xs font-medium text-muted-foreground">
                      {approvalKindLabel(row)}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-foreground">
                      {row.customerName || "-"}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-foreground">
                      {row.vendorName || "-"}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-foreground">
                      {row.requestedByName || "-"}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-muted-foreground">
                      {formatWhen(row.createdAt)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          "inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          statusTone(row.status),
                        )}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                        <Link
                          href={approvalPrimaryHref(row)}
                          className="cursor-pointer rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors duration-200 hover:bg-muted/50 hover:text-foreground"
                        >
                          {row.kind === "create_po_in_stock" ||
                          row.kind === "hold_ovf" ||
                          row.kind === "freight_finance"
                            ? "Open OVF"
                            : "Open PO"}
                        </Link>
                        {row.kind === "finalize" &&
                          !isOvfCreatePoApprovalOrderKey(row.orderId) ? (
                          <button
                            type="button"
                            disabled={downloadingPoId === row.id}
                            title="Download Draft PO PDF with watermark"
                            onClick={(event) => void onDownloadPo(row, event)}
                            className={cn(
                              "inline-flex cursor-pointer items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground",
                              "transition-colors duration-200 hover:bg-muted/50 hover:text-foreground",
                              "disabled:cursor-not-allowed disabled:opacity-60",
                            )}
                          >
                            {downloadingPoId === row.id ? (
                              <Loader2 className="size-3 animate-spin" aria-hidden />
                            ) : (
                              <Download className="size-3" aria-hidden />
                            )}
                            {downloadingPoId === row.id ? "PO…" : "PO"}
                          </button>
                        ) : null}
                        {canDecideRow(row, access) ? (
                          <>
                            <button
                              type="button"
                              disabled={busyId === row.id}
                              onClick={(event) => void onAccept(row, event)}
                              className={cn(
                                "inline-flex cursor-pointer items-center gap-1 rounded-md bg-[#0F172A] px-2.5 py-1 text-[11px] font-semibold text-white",
                                "transition-[opacity,transform] duration-200 hover:opacity-90",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                                "disabled:cursor-not-allowed disabled:opacity-60",
                              )}
                            >
                              {busyId === row.id ? (
                                <Loader2 className="size-3 animate-spin" aria-hidden />
                              ) : (
                                <Check className="size-3" aria-hidden />
                              )}
                              {row.kind === "hold_ovf"
                                ? "Approve hold"
                                : row.kind === "freight_finance"
                                  ? "Approve charges"
                                  : row.kind === "create_po_in_stock"
                                    ? "Approve Create PO"
                                    : (row.scmApprovalStage || "accept_po") === "management"
                                      ? "Issue PO"
                                      : "Accept PO"}
                            </button>
                            <button
                              type="button"
                              disabled={busyId === row.id}
                              onClick={(event) => void onReject(row, event)}
                              className={cn(
                                "inline-flex cursor-pointer items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-800",
                                "transition-colors duration-200 hover:bg-red-100",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                                "disabled:cursor-not-allowed disabled:opacity-60",
                              )}
                            >
                              <X className="size-3" aria-hidden />
                              Reject
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ProcurementListPanel>
    </ProcurementPage>
  );
}
