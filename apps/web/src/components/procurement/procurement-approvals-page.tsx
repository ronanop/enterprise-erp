"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, Check, Eye, Loader2, Paperclip, RefreshCw, X } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import {
  ProcurementErrorBanner,
  ProcurementKpiCard,
  ProcurementListPanel,
  ProcurementPage,
  procurementUi,
} from "@/components/procurement/procurement-ui";
import { Button } from "@/components/ui/button";
import { useProcurementApprovals } from "@/hooks/use-procurement-approvals";
import { useProcurementRole } from "@/hooks/use-procurement-role";
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
  finalizeScmOrder,
  listPurchaseOrders,
  listVendorOptions,
  openScmCommercialAttachment,
} from "@/services/procurement-service";

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
  return "border-amber-200/80 bg-amber-50 text-amber-900";
}

function approvalKindLabel(row: PoApprovalRequest): string {
  return row.kind === "create_po_in_stock" ? "Create PO (IN STOCK)" : "Finalize PO";
}

function approvalPrimaryHref(row: PoApprovalRequest): string {
  if (row.kind === "create_po_in_stock" && row.ovfId) {
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

function ApprovalDocuments({
  documents,
  onOpenError,
}: {
  documents: PoApprovalDocument[];
  onOpenError: (message: string) => void;
}) {
  const [openingId, setOpeningId] = useState<string | null>(null);
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
              title={`${doc.source === "po" ? "PO" : "OVF"} · ${doc.category}`}
              onClick={() => {
                setOpeningId(doc.id);
                void openScmCommercialAttachment(doc.id, {
                  source: doc.attachmentSource || "upload",
                  external_url: doc.externalUrl || null,
                  file_name: doc.fileName,
                })
                  .catch((err) =>
                    onOpenError(err instanceof Error ? err.message : "Failed to open document"),
                  )
                  .finally(() => setOpeningId(null));
              }}
            >
              {openingId === doc.id ? "Opening…" : doc.fileName}
            </button>
            {doc.remarks ? (
              <p className="mt-0.5 text-[11px] text-muted-foreground">{doc.remarks}</p>
            ) : null}
          </div>
          <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
            {doc.source === "po" ? "PO" : "OVF"}
          </span>
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
  const { isAdmin } = useProcurementRole();
  const { rows, pending, pendingCount, decide, refresh } = useProcurementApprovals();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "accepted" | "rejected">("all");
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
      refresh();
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
    const source = isAdmin && filter === "pending" ? pending : rows;
    if (filter === "all") return source;
    return source.filter((row) => row.status === filter);
  }, [isAdmin, filter, pending, rows]);

  const acceptedCount = rows.filter((row) => row.status === "accepted").length;
  const rejectedCount = rows.filter((row) => row.status === "rejected").length;

  async function onAccept(row: PoApprovalRequest) {
    setBusyId(row.id);
    setError(null);
    try {
      if (row.kind === "finalize") {
        await finalizeScmOrder(row.orderId);
      }
      decide(row.id, "accepted");
    } catch (err) {
      setError(
        formatApiError(
          err,
          row.kind === "create_po_in_stock"
            ? "Failed to approve Create PO request"
            : "Failed to accept finalize request",
        ),
      );
    } finally {
      setBusyId(null);
    }
  }

  function onReject(row: PoApprovalRequest) {
    setBusyId(row.id);
    setError(null);
    try {
      decide(row.id, "rejected");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ProcurementPage>
      <PageHeader
        title="Approval"
        description={
          isAdmin
            ? "Approve Create PO for IN STOCK OVFs, or accept finalize to issue a draft PO. Reject so the requester can edit and resubmit."
            : "Track Create PO (IN STOCK) and finalize requests you sent. You get a notification when an admin decides."
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
                refresh();
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
          label={isAdmin ? "PENDING REQUESTS" : "MY REQUESTS"}
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

      {error ? <ProcurementErrorBanner>{error}</ProcurementErrorBanner> : null}

      <ProcurementListPanel>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 px-3 py-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {visible.length} request{visible.length === 1 ? "" : "s"}
          </p>
        </div>
        {visible.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            {isAdmin
              ? "No approval requests match this filter."
              : "No approval requests yet. Request Create PO on an IN STOCK OVF, or finalize a draft PO."}
          </div>
        ) : (
          <div className={procurementUi.tableScroll}>
            <table className={cn(procurementUi.table, "min-w-[880px]")}>
              <thead className={procurementUi.thead}>
                <tr>
                  <th className="px-3 py-2 font-medium">Request</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Customer</th>
                  <th className="px-3 py-2 font-medium">Vendor</th>
                  <th className="px-3 py-2 font-medium">Requested</th>
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
                      {row.customerName || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-foreground">
                      {row.vendorName || "—"}
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
                          {row.kind === "create_po_in_stock" ? "Open OVF" : "Open PO"}
                        </Link>
                        {isAdmin && row.status === "pending" ? (
                          <>
                            <button
                              type="button"
                              disabled={busyId === row.id}
                              onClick={() => void onAccept(row)}
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
                              {row.kind === "create_po_in_stock"
                                ? "Approve Create PO"
                                : "Accept finalize"}
                            </button>
                            <button
                              type="button"
                              disabled={busyId === row.id}
                              onClick={() => onReject(row)}
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
