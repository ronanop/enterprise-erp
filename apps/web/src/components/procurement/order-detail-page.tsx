"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  FileDown,
  PackageCheck,
  RefreshCw,
  Truck,
} from "lucide-react";

import { DeliveryChallanFormPage } from "@/components/procurement/delivery-challan-form-page";
import { GrnPdfPickDialog } from "@/components/procurement/grn-pdf-pick-dialog";
import {
  ReceiptSerialsDialog,
  type ReceiptSerialDialogLine,
  type VendorInvoiceDraft,
  emptyVendorInvoiceDraft,
} from "@/components/procurement/receipt-serials-dialog";
import { ScmCommercialDocumentsPanel } from "@/components/procurement/scm-commercial-documents-panel";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useProcurementRole } from "@/hooks/use-procurement-role";
import {
  findLatestApprovalForOrder,
  findPendingApprovalForOrder,
  submitPoFinalizeApproval,
} from "@/lib/procurement-approvals";
import {
  listUnreadPoApprovalDecisionNotifications,
  markPoApprovalDecisionNotificationsReadForOrder,
  PROCUREMENT_APPROVAL_NOTIFICATIONS_EVENT,
  type PoApprovalDecisionNotification,
} from "@/lib/procurement-approval-notifications";
import { ApiClientError } from "@/services/api-client";
import {
  collectPoApprovalDocuments,
  finalizeScmOrder,
  formatInr,
  getPurchaseOrder,
  listVendorOptions,
  listVendorPos,
  resolveVendorOrgScope,
  updateLineReceipt,
  saveReceiptBatchVendorInvoice,
  uploadReceiptBatchAttachment,
  type ProcOrder,
} from "@/services/procurement-service";
import { fileToBase64 } from "@/services/sales-crm-service";
import type { GrnReceiptPdfContext } from "@/utils/grn-batch-pdf-download";
import { resolveReceiptBatchId } from "@/utils/resolve-receipt-batch-id";
import {
  buildDeliveryChallanPdfInputFromRecordResolved,
  downloadDeliveryChallanPdf,
} from "@/utils/delivery-challan-pdf";
import {
  formatChallanGrnSummary,
  listDeliveryChallansByOrderId,
  type DeliveryChallanRecord,
} from "@/utils/delivery-challan-storage";
import { downloadOrderPdf } from "@/utils/purchase-order-pdf";
import {
  getDeliveryStatus,
  shipmentStatusBadgeVariant,
} from "@/utils/delivery-status-storage";
import { deliveryStatusUpdateHref } from "@/utils/delivery-status-routes";
import { receiptGrnLabelForOrder } from "@/utils/receipt-grn-label";
import {
  resizeSerialSlots,
  receiptSerialSlotsWithNaDefaults,
  serialSlotsForSave,
  serialUnitCount,
  validateSerialSlots,
} from "@/utils/receipt-serial-numbers";

type ReceiptStatus = "pending" | "partial" | "delivered";
type PoDetailView = "po" | "grn";

function DetailItem({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm font-medium break-words text-foreground">{children}</dd>
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-lg border border-border/80 bg-card p-4 shadow-sm">
      <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
      {children}
    </section>
  );
}

/** Derive update status from received vs ordered qty. */
function receiptStatusFromQty(ordered: number, received: number): ReceiptStatus {
  if (!Number.isFinite(received) || received <= 0) return "pending";
  if (ordered > 0 && received >= ordered) return "delivered";
  return "partial";
}

function receiptBadgeVariant(
  status: ReceiptStatus,
): "default" | "secondary" | "outline" {
  if (status === "delivered") return "default";
  if (status === "partial") return "secondary";
  return "outline";
}

function formatOrderStatusLabel(status: string): string {
  return status.replaceAll("_", " ").trim() || "—";
}

function orderStatusBadgeClass(status: string, pendingApproval: boolean): string {
  if (pendingApproval) {
    return "border-amber-300 bg-amber-50 text-amber-900";
  }
  const value = status.toLowerCase();
  if (value === "draft" || value === "submitted") {
    return "border-sky-300 bg-sky-50 text-sky-900";
  }
  if (value === "approved" || value === "issued" || value === "ordered") {
    return "border-emerald-300 bg-emerald-50 text-emerald-900";
  }
  if (value === "partially_received") {
    return "border-amber-300 bg-amber-50 text-amber-900";
  }
  if (value === "received" || value === "delivered" || value === "closed" || value === "completed") {
    return "border-emerald-300 bg-emerald-50 text-emerald-900";
  }
  if (value === "cancelled" || value === "rejected") {
    return "border-red-300 bg-red-50 text-red-800";
  }
  return "border-border bg-muted/40 text-foreground";
}

function isReceiptLocked(ordered: number, quantityReceived: number): boolean {
  if (!Number.isFinite(quantityReceived) || quantityReceived <= 0) return false;
  if (!Number.isFinite(ordered) || ordered <= 0) return quantityReceived > 0;
  return quantityReceived >= ordered;
}

/** Keep typed qty without a leading zero; optionally clamp to maxAllowed. */
function normalizeQtyInput(raw: string, maxAllowed?: number): string {
  const value = raw.trim();
  if (value === "" || value === ".") return value;
  if (!/^\d*\.?\d*$/.test(value)) return value;
  let next = value;
  if (value.includes(".")) {
    const [intPart = "", frac = ""] = value.split(".");
    const normalizedInt = intPart.replace(/^0+(?=\d)/, "") || "0";
    next = `${normalizedInt}.${frac}`;
  } else {
    next = value.replace(/^0+(?=\d)/, "");
  }
  if (maxAllowed == null || next === "" || next === ".") return next;
  const n = Number(next);
  if (!Number.isFinite(n)) return next;
  if (n > maxAllowed) return String(maxAllowed);
  return next;
}

function roundTo(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function formatQtyDraftValue(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "";
  return String(roundTo(value, 4));
}

function formatCostDraftValue(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "";
  return String(roundTo(value, 2));
}

/** Unit cost draft — never above the PO unit cost. */
function normalizeCostInput(raw: string, maxAllowed: number): string {
  const value = raw.trim();
  if (value === "" || value === ".") return value;
  if (!/^\d*\.?\d*$/.test(value)) return value;
  let next = value;
  if (value.includes(".")) {
    const [intPart = "", frac = ""] = value.split(".");
    const normalizedInt = intPart.replace(/^0+(?=\d)/, "") || "0";
    const clippedFrac = frac.slice(0, 2);
    next = `${normalizedInt}.${clippedFrac}`;
  } else {
    next = value.replace(/^0+(?=\d)/, "");
  }
  if (next === "" || next === ".") return next;
  const n = Number(next);
  if (!Number.isFinite(n)) return next;
  const max = Math.max(0, maxAllowed);
  if (n > max) return formatCostDraftValue(max);
  return next;
}

function emptyReceiptDrafts(lines: Array<{ id: string; unit_cost?: number }>) {
  return {
    qty: Object.fromEntries(lines.map((ln) => [ln.id, ""])),
    cost: Object.fromEntries(
      lines.map((ln) => [ln.id, formatCostDraftValue(Number(ln.unit_cost) || 0)]),
    ),
  };
}

/** Match GRN / vendor-PO list: OVF commercial totals when GET order omits them. */
async function loadOrderWithCommercial(orderId: string): Promise<ProcOrder> {
  let row: ProcOrder;
  try {
    row = await getPurchaseOrder(orderId, { includeCommercial: true });
  } catch (err) {
    if (err instanceof ApiClientError && err.status >= 500) {
      row = await getPurchaseOrder(orderId);
    } else {
      throw err;
    }
  }
  const needsFallback =
    Boolean(row.source_document_id) &&
    !(Number(row.customer_total) > 0) &&
    Number(row.margin_amount) === 0;
  if (!needsFallback) return row;
  try {
    const pos = await listVendorPos();
    const match = pos.find((p) => p.id === orderId);
    if (!match) return row;
    return {
      ...row,
      vendor_total: match.vendor_total ?? row.vendor_total,
      customer_total: match.customer_total ?? row.customer_total,
      margin_amount: match.margin_amount ?? row.margin_amount,
    };
  } catch {
    return row;
  }
}

export function OrderDetailPage({ orderId }: { orderId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isAdmin } = useProcurementRole();
  const [order, setOrder] = useState<ProcOrder | null>(null);
  const [vendorName, setVendorName] = useState<string>("");
  const [vendorAddress, setVendorAddress] = useState<string>("");
  const [vendorGst, setVendorGst] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [savingReceipts, setSavingReceipts] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [grnPdfPickOpen, setGrnPdfPickOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qtyDraft, setQtyDraft] = useState<Record<string, string>>({});
  const [costDraft, setCostDraft] = useState<Record<string, string>>({});
  const [serialDraft, setSerialDraft] = useState<Record<string, string[]>>({});
  const [receiptSerialOpen, setReceiptSerialOpen] = useState(false);
  const [pendingReceiptLines, setPendingReceiptLines] = useState<ReceiptSerialDialogLine[]>([]);
  const [receiptModalError, setReceiptModalError] = useState<string | null>(null);
  const [vendorInvoiceDraft, setVendorInvoiceDraft] = useState<VendorInvoiceDraft>(
    emptyVendorInvoiceDraft,
  );
  const [challanOpen, setChallanOpen] = useState(false);
  const [challanSavedBanner, setChallanSavedBanner] = useState<string | null>(null);
  const [decisionNotice, setDecisionNotice] = useState<PoApprovalDecisionNotification | null>(
    null,
  );
  const [challanFormMounted, setChallanFormMounted] = useState(false);
  const [savedChallans, setSavedChallans] = useState<DeliveryChallanRecord[]>([]);
  const [challanPdfBusyId, setChallanPdfBusyId] = useState<string | null>(null);
  const challanSaveRef = useRef<(() => void) | null>(null);
  const [viewMode, setViewMode] = useState<PoDetailView>(() =>
    searchParams.get("tab") === "grn" ? "grn" : "po",
  );

  useEffect(() => {
    setViewMode(searchParams.get("tab") === "grn" ? "grn" : "po");
  }, [searchParams]);

  const setPoView = useCallback(
    (next: PoDetailView) => {
      setViewMode(next);
      const params = new URLSearchParams(searchParams.toString());
      if (next === "grn") params.set("tab", "grn");
      else params.delete("tab");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const refreshSavedChallans = useCallback(() => {
    setSavedChallans(listDeliveryChallansByOrderId(orderId));
  }, [orderId]);

  useEffect(() => {
    setChallanFormMounted(true);
  }, []);

  const closeChallanPanel = useCallback(() => {
    setChallanOpen(false);
    if (searchParams.get("challan") === "1") {
      router.back();
    }
  }, [router, searchParams]);

  const openChallanPanel = useCallback(() => {
    setChallanSavedBanner(null);
    if (searchParams.get("challan") !== "1") {
      const params = new URLSearchParams(searchParams.toString());
      params.set("challan", "1");
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    }
    setChallanOpen(true);
  }, [pathname, router, searchParams]);

  useEffect(() => {
    refreshSavedChallans();
  }, [refreshSavedChallans]);

  useEffect(() => {
    setChallanOpen(searchParams.get("challan") === "1");
  }, [searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const row = await loadOrderWithCommercial(orderId);
      setOrder(row);
      // Draft is "receive now" qty (additional), not cumulative total.
      const drafts = emptyReceiptDrafts(row.lines || []);
      setQtyDraft(drafts.qty);
      setCostDraft(drafts.cost);
      setSerialDraft({});
      setLoading(false);
      void listVendorOptions()
        .then((vendors) => {
          const matched = vendors.find((v) => v.id === row.vendor_id);
          setVendorName(matched?.label || row.vendor_id);
          const entry = matched?.addressEntries?.[0];
          setVendorAddress(entry?.address || matched?.address || "");
          setVendorGst(entry?.gstNumber || matched?.taxNumber || "");
        })
        .catch(() => {
          setVendorName(row.vendor_id);
          setVendorAddress("");
          setVendorGst("");
        });
    } catch (err) {
      setOrder(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load purchase order");
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (isAdmin) {
      setDecisionNotice(null);
      return;
    }
    const sync = () => {
      const unread = listUnreadPoApprovalDecisionNotifications().find(
        (row) => row.orderId === orderId,
      );
      if (!unread) return;
      setDecisionNotice(unread);
      markPoApprovalDecisionNotificationsReadForOrder(orderId);
    };
    sync();
    window.addEventListener(PROCUREMENT_APPROVAL_NOTIFICATIONS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(PROCUREMENT_APPROVAL_NOTIFICATIONS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [isAdmin, orderId]);

  async function onFinalize() {
    if (!order) return;
    setBusy(true);
    setError(null);
    try {
      if (!isAdmin) {
        const documents = await collectPoApprovalDocuments({
          orderId: order.id,
          ovfId: order.source_document_id,
        });
        submitPoFinalizeApproval({
          orderId: order.id,
          documentNumber: order.document_number,
          companyPoNumber: order.company_po_number,
          customerName: order.customer_name,
          vendorId: order.vendor_id,
          vendorName: vendorName || null,
          ovfId: order.source_document_id,
          documents,
        });
        setError(null);
        router.replace(`${pathname}?approval=pending`);
        return;
      }
      const updated = await finalizeScmOrder(order.id);
      setOrder(updated);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to finalize PO");
    } finally {
      setBusy(false);
    }
  }

  async function onDownloadPdf() {
    if (!order) return;
    setPdfBusy(true);
    setError(null);
    try {
      const draft = (order.status || "").toLowerCase() === "draft";
      await downloadOrderPdf(
        order,
        { name: vendorName, address: vendorAddress },
        undefined,
        { watermark: draft },
      );
    } catch (err) {
      const message =
        err instanceof Error && err.message.trim()
          ? err.message
          : "Failed to download PO PDF";
      console.error("PO PDF download failed", err);
      setError(message);
    } finally {
      setPdfBusy(false);
    }
  }

  async function onDownloadChallanPdf(challan: DeliveryChallanRecord) {
    setChallanPdfBusyId(challan.id);
    setError(null);
    try {
      const input = await buildDeliveryChallanPdfInputFromRecordResolved(challan);
      await downloadDeliveryChallanPdf(input);
    } catch (err) {
      setError(
        err instanceof Error && err.message.trim()
          ? err.message
          : "Failed to download delivery challan PDF",
      );
    } finally {
      setChallanPdfBusyId(null);
    }
  }

  async function confirmReceiptWithSerials() {
    if (!order || pendingReceiptLines.length === 0) return;
    if (["draft", "submitted", "cancelled"].includes((order.status || "").toLowerCase())) {
      setReceiptModalError("GRN receipt is locked until this PO is approved and issued.");
      return;
    }

    type PendingLine = ReceiptSerialDialogLine & {
      orderedQty: number;
      qty: number;
      status: ReceiptStatus;
      serials: string[];
      billing: boolean;
      billingQuantity: number;
    };

    const pending: PendingLine[] = [];
    for (const row of pendingReceiptLines) {
      const line = order.lines?.find((ln) => ln.id === row.lineId);
      if (!line) continue;
      const orderedQty = Number(line.quantity) || 0;
      const savedReceived = Number(line.quantity_received ?? 0);
      const serialUnits = serialUnitCount(row.additional);
      const slots = resizeSerialSlots(serialDraft[row.lineId] || [], serialUnits);
      const serialError = validateSerialSlots(slots, row.additional, row.productLabel);
      if (serialError) {
        setReceiptModalError(serialError);
        setSerialDraft((prev) => ({ ...prev, [row.lineId]: slots }));
        return;
      }
      const qty = Math.min(orderedQty, savedReceived + row.additional);
      pending.push({
        ...row,
        orderedQty,
        qty,
        status: receiptStatusFromQty(orderedQty, qty),
        serials: serialSlotsForSave(slots),
        billing: row.billingQuantity > 0,
        billingQuantity: row.billingQuantity,
      });
    }

    const invoiceTouched =
      vendorInvoiceDraft.files.length > 0 ||
      vendorInvoiceDraft.invoiceNumber.trim() !== "" ||
      vendorInvoiceDraft.invoiceDate.trim() !== "" ||
      vendorInvoiceDraft.quantity.trim() !== "" ||
      vendorInvoiceDraft.subtotal.trim() !== "";
    if (vendorInvoiceDraft.files.length > 0 && !vendorInvoiceDraft.invoiceNumber.trim()) {
      setReceiptModalError("Enter invoice number for the attached vendor invoice.");
      return;
    }
    if (invoiceTouched) {
      const qtyRaw = vendorInvoiceDraft.quantity.trim();
      const subRaw = vendorInvoiceDraft.subtotal.trim();
      if (qtyRaw && Number.isNaN(Number(qtyRaw))) {
        setReceiptModalError("Invoice quantity must be a number.");
        return;
      }
      if (subRaw && Number.isNaN(Number(subRaw))) {
        setReceiptModalError("Invoice total amount must be a number.");
        return;
      }
    }

    setSavingReceipts(true);
    setReceiptModalError(null);
    setError(null);
    try {
      let latest = order;
      for (const item of pending) {
        latest = await updateLineReceipt(latest.id, item.lineId, {
          quantity_received: item.qty,
          grn_status: item.status,
          serial_numbers: item.serials,
          billing: item.billingQuantity > 0,
          billing_quantity: item.billingQuantity,
        });
      }
      const refreshed = await loadOrderWithCommercial(latest.id);
      const batchId = resolveReceiptBatchId(refreshed);

      async function resolveUploadScope() {
        const branchId = refreshed.branch_id?.trim();
        const companyId = refreshed.company_id?.trim();
        if (branchId && companyId) {
          return { company_id: companyId, branch_id: branchId };
        }
        return resolveVendorOrgScope();
      }

      if (invoiceTouched && batchId) {
        const scope = await resolveUploadScope();
        if (!scope?.branch_id) {
          setError(
            "Receipt saved, but vendor invoice could not be saved (missing branch scope).",
          );
        } else {
          try {
            const qtyRaw = vendorInvoiceDraft.quantity.trim();
            const subRaw = vendorInvoiceDraft.subtotal.trim();
            const invoiceFiles = vendorInvoiceDraft.files;
            const primaryFile = invoiceFiles[0];
            const content_base64 = primaryFile ? await fileToBase64(primaryFile) : null;
            await saveReceiptBatchVendorInvoice(batchId, {
              vendor_invoice_number: vendorInvoiceDraft.invoiceNumber.trim() || null,
              vendor_invoice_date: vendorInvoiceDraft.invoiceDate.trim() || null,
              vendor_invoice_quantity: qtyRaw ? Number(qtyRaw) : null,
              vendor_invoice_subtotal: subRaw ? Number(subRaw) : null,
              file_name: primaryFile?.name ?? null,
              content_base64,
              content_type: primaryFile?.type || null,
              branch_id: scope.branch_id,
              company_id: scope.company_id ?? null,
            });
            for (let i = 1; i < invoiceFiles.length; i += 1) {
              const doc = invoiceFiles[i];
              await uploadReceiptBatchAttachment(batchId, {
                file_name: doc.name,
                content_base64: await fileToBase64(doc),
                content_type: doc.type || null,
                branch_id: scope.branch_id,
                company_id: scope.company_id ?? null,
              });
            }
          } catch (uploadErr) {
            const uploadDetail =
              uploadErr instanceof ApiClientError
                ? [uploadErr.message, ...uploadErr.errors].filter(Boolean).join(" — ")
                : uploadErr instanceof Error && uploadErr.message.trim()
                  ? uploadErr.message
                  : "Failed to save vendor invoice";
            setReceiptModalError(
              `Receipt saved, but vendor invoice failed: ${uploadDetail}`,
            );
            setOrder(refreshed);
            const drafts = emptyReceiptDrafts(refreshed.lines || []);
            setQtyDraft(drafts.qty);
            setCostDraft(drafts.cost);
            setSerialDraft({});
            setPendingReceiptLines([]);
            setVendorInvoiceDraft(emptyVendorInvoiceDraft());
            return;
          }
        }
      } else if (invoiceTouched && !batchId) {
        setError("Receipt saved, but vendor invoice could not be linked (no receipt batch).");
      }

      setOrder(refreshed);
      {
        const drafts = emptyReceiptDrafts(refreshed.lines || []);
        setQtyDraft(drafts.qty);
        setCostDraft(drafts.cost);
      }
      setSerialDraft({});
      setPendingReceiptLines([]);
      setVendorInvoiceDraft(emptyVendorInvoiceDraft());
      setReceiptSerialOpen(false);
    } catch (err) {
      const detail =
        err instanceof ApiClientError
          ? [err.message, ...err.errors].filter(Boolean).join(" — ")
          : err instanceof Error && err.message.trim()
            ? err.message
            : "Failed to update received qty";
      setReceiptModalError(detail || "Failed to update received qty");
    } finally {
      setSavingReceipts(false);
    }
  }

  function collectPendingReceiptLines():
    | { ok: true; lines: ReceiptSerialDialogLine[] }
    | { ok: false; message: string } {
    if (!order) return { ok: false, message: "Purchase order not loaded." };

    const lines: ReceiptSerialDialogLine[] = [];
    for (const line of order.lines || []) {
      const orderedQty = Number(line.quantity) || 0;
      const savedReceived = Number(line.quantity_received ?? 0);
      if (isReceiptLocked(orderedQty, savedReceived)) continue;

      const remaining = Math.max(0, orderedQty - savedReceived);
      const raw = (qtyDraft[line.id] ?? "").trim();
      if (raw === "" || raw === ".") continue;

      const additional = Number(raw);
      const label = line.product_name || line.product_code || `Line ${line.line_number}`;
      if (!Number.isFinite(additional) || additional <= 0) {
        return { ok: false, message: `Enter a valid receive qty for ${label} (1–${remaining}).` };
      }
      if (additional > remaining) {
        setQtyDraft((prev) => ({ ...prev, [line.id]: String(remaining) }));
        setCostDraft((prev) => ({
          ...prev,
          [line.id]: formatCostDraftValue(Number(line.unit_cost) || 0),
        }));
        return { ok: false, message: `You can receive at most ${remaining} more for ${label}.` };
      }

      lines.push({
        lineId: line.id,
        lineNo: line.line_number,
        productLabel: label,
        additional,
        // Default: bill full receive qty on vendor invoice; lower billing to add remainder to stock.
        billingQuantity: additional,
      });
    }

    if (lines.length === 0) {
      return { ok: false, message: "Enter a receive qty on at least one line before updating." };
    }
    return { ok: true, lines };
  }

  function openReceiptSerialModal() {
    if (
      !order ||
      ["draft", "submitted", "cancelled"].includes((order.status || "").toLowerCase())
    ) {
      setError("GRN receipt is locked until this PO is approved and issued.");
      return;
    }
    setError(null);
    setReceiptModalError(null);
    const result = collectPendingReceiptLines();
    if (!result.ok) {
      setError(result.message);
      return;
    }
    const draft: Record<string, string[]> = {};
    for (const row of result.lines) {
      draft[row.lineId] = receiptSerialSlotsWithNaDefaults(
        serialDraft[row.lineId] || [],
        serialUnitCount(row.additional),
      );
    }
    setSerialDraft(draft);
    setPendingReceiptLines(result.lines);
    setVendorInvoiceDraft(emptyVendorInvoiceDraft());
    setReceiptSerialOpen(true);
  }

  function closeReceiptSerialModal() {
    if (savingReceipts) return;
    setReceiptSerialOpen(false);
    setReceiptModalError(null);
    setVendorInvoiceDraft(emptyVendorInvoiceDraft());
  }

  /** GRN / receipt / challan only after admin finalizes (issued PO). */
  const canReceipt = Boolean(
    order &&
      !["draft", "submitted", "cancelled"].includes((order.status || "").toLowerCase()),
  );
  const showGrnWorkspace = canReceipt && viewMode === "grn";
  const pendingApproval = order ? findPendingApprovalForOrder(order.id) : null;
  const latestApproval = order ? findLatestApprovalForOrder(order.id) : null;
  const approvalRejected =
    Boolean(order) &&
    (order?.status || "").toLowerCase() === "draft" &&
    latestApproval?.status === "rejected" &&
    !pendingApproval;
  const approvalPendingFlag =
    searchParams.get("approval") === "pending" || Boolean(pendingApproval);
  const awaitingIssue =
    Boolean(order) &&
    (order?.status || "").toLowerCase() === "draft" &&
    (approvalPendingFlag || order?.source_module === "crm");
  const finalizeBlockedByApproval =
    Boolean(pendingApproval) || (isAdmin && approvalPendingFlag);
  const canFinalize =
    order &&
    order.status === "draft" &&
    order.source_module === "crm" &&
    (order.lines?.length ?? 0) > 0 &&
    !finalizeBlockedByApproval;
  const editPoHref =
    order?.source_module === "crm" && order.source_document_id
      ? `/procurement/scm/ovf/${order.source_document_id}/po`
      : null;
  const lineCount = order?.lines?.length ?? 0;
  const orderLines = useMemo(() => {
    const rows = [...(order?.lines || [])];
    rows.sort((a, b) => (Number(a.line_number) || 0) - (Number(b.line_number) || 0));
    return rows;
  }, [order?.lines]);
  const allLinesDelivered =
    lineCount > 0 &&
    orderLines.every((ln) =>
      isReceiptLocked(Number(ln.quantity) || 0, Number(ln.quantity_received ?? 0)),
    );
  /** Hide receive / GRN columns until the PO is issued and user opens GRN workspace. */
  const showReceiptColumns = showGrnWorkspace && !allLinesDelivered;

  useEffect(() => {
    // Wait until the PO has loaded — otherwise tab=grn is cleared while order is still null.
    if (!order) return;
    if (!canReceipt && viewMode === "grn") {
      setPoView("po");
    }
  }, [order, canReceipt, viewMode, setPoView]);

  useEffect(() => {
    if (!order) return;
    if (!canReceipt && challanOpen) {
      setChallanOpen(false);
    }
  }, [order, canReceipt, challanOpen]);

  const hasDraftReceiptQty = (order?.lines || []).some((ln) => {
    const orderedQty = Number(ln.quantity) || 0;
    const savedReceived = Number(ln.quantity_received ?? 0);
    if (isReceiptLocked(orderedQty, savedReceived)) return false;
    const raw = (qtyDraft[ln.id] ?? "").trim();
    if (!raw || raw === ".") return false;
    const additional = Number(raw);
    return Number.isFinite(additional) && additional > 0;
  });

  function onQtyDraftChange(
    lineId: string,
    value: string,
    maxAllowed: number,
    originalUnitCost: number,
  ) {
    const nextQty = normalizeQtyInput(value, maxAllowed);
    setQtyDraft((prev) => ({ ...prev, [lineId]: nextQty }));

    const remaining = Math.max(0, maxAllowed);
    const original = Math.max(0, originalUnitCost);
    if (nextQty === "" || nextQty === "." || remaining <= 0 || original <= 0) {
      setCostDraft((prev) => ({
        ...prev,
        [lineId]: formatCostDraftValue(original),
      }));
      return;
    }
    const qty = Number(nextQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      setCostDraft((prev) => ({
        ...prev,
        [lineId]: formatCostDraftValue(original),
      }));
      return;
    }
    // Scale unit cost with receive portion of remaining — never above PO unit cost.
    const scaled = Math.min(original, original * (qty / remaining));
    setCostDraft((prev) => ({
      ...prev,
      [lineId]: formatCostDraftValue(scaled),
    }));
  }

  function onCostDraftChange(
    lineId: string,
    value: string,
    maxAllowedQty: number,
    originalUnitCost: number,
  ) {
    const original = Math.max(0, originalUnitCost);
    const nextCost = normalizeCostInput(value, original);
    setCostDraft((prev) => ({ ...prev, [lineId]: nextCost }));

    const remaining = Math.max(0, maxAllowedQty);
    if (nextCost === "" || nextCost === "." || remaining <= 0 || original <= 0) {
      return;
    }
    const cost = Number(nextCost);
    if (!Number.isFinite(cost) || cost <= 0) {
      setQtyDraft((prev) => ({ ...prev, [lineId]: "" }));
      return;
    }
    // Inverse of receive↔cost scale: lower unit cost → lower receive qty.
    const qty = Math.min(remaining, remaining * (cost / original));
    setQtyDraft((prev) => ({
      ...prev,
      [lineId]: formatQtyDraftValue(qty),
    }));
  }

  const hasReceivedQty = (order?.lines || []).some(
    (ln) => Number(ln.quantity_received) > 0 || Number(ln.last_receipt_qty) > 0,
  );
  const grnPdfContext = useMemo((): GrnReceiptPdfContext | null => {
    if (!order) return null;
    const vendorAddressLines = vendorAddress.includes("\n")
      ? vendorAddress
          .split(/\r?\n/)
          .map((part) => part.trim())
          .filter(Boolean)
      : vendorAddress.trim()
        ? [vendorAddress.trim()]
        : [];
    return {
      poNumber: order.company_po_number?.trim() || order.document_number,
      documentDate: order.current_receipt_batch_at || order.document_date,
      vendorName: vendorName || undefined,
      vendorAddressLines,
      vendorGstNumber: vendorGst || undefined,
    };
  }, [order, vendorAddress, vendorName, vendorGst]);
  const receiptGrnLabel = useMemo(
    () => (order ? receiptGrnLabelForOrder(order) : ""),
    [order],
  );
  const tableMinWidth = showReceiptColumns
    ? "min-w-[1000px]"
    : showGrnWorkspace
      ? "min-w-[860px]"
      : "min-w-[640px]";
  const emptyColSpan = showReceiptColumns ? 9 : showGrnWorkspace ? 8 : 5;
  const backToScm = searchParams.get("from") === "scm";
  const backToGrns = searchParams.get("from") === "grns";
  const statusLabel = (order?.status || "").toLowerCase();

  return (
    <div className="space-y-4">
      <PageHeader
        {...(challanOpen
          ? { onBack: closeChallanPanel, backLabel: "PO" }
          : showGrnWorkspace && backToGrns
            ? { backHref: "/procurement/grns", backLabel: "GRNs" }
            : showGrnWorkspace
              ? {
                  onBack: () => setPoView("po"),
                  backLabel: "Purchase order",
                }
              : backToScm
                ? { backHref: "/procurement/scm", backLabel: "SCM queue" }
                : backToGrns
                  ? { backHref: "/procurement/grns", backLabel: "GRNs" }
                  : { backHref: "/procurement/orders", backLabel: "Purchase Orders" })}
        title={
          challanOpen
            ? "Create delivery challan"
            : order
              ? order.company_po_number?.trim() || order.document_number
              : "Purchase order"
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={`mr-1.5 size-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            {order && !challanOpen && !showGrnWorkspace ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer transition-colors duration-200"
                disabled={pdfBusy || lineCount === 0}
                onClick={() => void onDownloadPdf()}
              >
                <FileDown className="mr-1.5 size-3.5" />
                {pdfBusy ? "Preparing…" : "Download PO PDF"}
              </Button>
            ) : null}
            {canReceipt && !challanOpen && !showGrnWorkspace ? (
              <Button
                type="button"
                size="sm"
                className="cursor-pointer transition-colors duration-200"
                onClick={() => setPoView("grn")}
              >
                <PackageCheck className="mr-1.5 size-3.5" />
                Record GRN
              </Button>
            ) : null}
            {showGrnWorkspace && hasReceivedQty && !challanOpen ? (
              <Button
                type="button"
                size="sm"
                className="cursor-pointer transition-colors duration-200"
                onClick={() => openChallanPanel()}
              >
                <Truck className="mr-1.5 size-3.5" />
                {savedChallans.length > 0 ? "Add delivery challan" : "Create delivery challan"}
              </Button>
            ) : null}
            {showGrnWorkspace && challanOpen ? (
              <Button
                type="button"
                size="sm"
                className="cursor-pointer transition-colors duration-200"
                onClick={() => challanSaveRef.current?.()}
              >
                Save challan
              </Button>
            ) : null}
            {canFinalize && !showGrnWorkspace ? (
              <Button
                type="button"
                size="sm"
                className="cursor-pointer transition-colors duration-200"
                disabled={busy}
                onClick={() => void onFinalize()}
              >
                {isAdmin
                  ? "Finalize & issue"
                  : approvalRejected
                    ? "Resubmit for approval"
                    : "Send for admin approval"}
              </Button>
            ) : null}
            {isAdmin && approvalPendingFlag && !showGrnWorkspace ? (
              <Link
                href="/procurement/approval"
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "cursor-pointer transition-colors duration-200",
                )}
              >
                Review on Approval
              </Link>
            ) : null}
            {!isAdmin && approvalRejected && editPoHref && !showGrnWorkspace ? (
              <Link
                href={editPoHref}
                className={cn(
                  buttonVariants({ size: "sm", variant: "outline" }),
                  "cursor-pointer transition-colors duration-200",
                )}
              >
                Edit PO
              </Link>
            ) : null}
            {order?.status === "draft" && approvalPendingFlag ? (
              <span className="inline-flex items-center rounded-lg border border-amber-200/80 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900">
                {isAdmin ? "Pending your approval" : "Awaiting admin approval"}
              </span>
            ) : null}
            {approvalRejected ? (
              <span className="inline-flex items-center rounded-lg border border-red-200/80 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-800">
                Approval rejected
              </span>
            ) : null}
          </div>
        }
      />

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading && !order ? (
        <p className="text-sm text-muted-foreground">Loading purchase order…</p>
      ) : null}

      {challanSavedBanner ? (
        <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          {challanSavedBanner}
        </div>
      ) : null}

      {decisionNotice ? (
        <div
          className={cn(
            "rounded-md border px-3 py-2 text-sm",
            decisionNotice.decision === "accepted"
              ? "border-emerald-200/80 bg-emerald-50 text-emerald-950"
              : "border-red-200/80 bg-red-50 text-red-950",
          )}
        >
          {decisionNotice.message}
        </div>
      ) : null}

      {awaitingIssue ? (
        <div
          className={cn(
            "rounded-md border px-3 py-2 text-sm",
            approvalRejected
              ? "border-red-200/80 bg-red-50 text-red-950"
              : "border-amber-200/80 bg-amber-50 text-amber-950",
          )}
        >
          {approvalRejected
            ? "Admin rejected this finalize request. Edit the PO if needed, then resubmit for approval — the same company PO number is kept."
            : approvalPendingFlag
              ? isAdmin
                ? "A finalize request is waiting. Accept or reject it on Approval — do not issue this PO from here."
                : "Sent for admin approval. GRN, receipt, and delivery challan stay locked until an admin accepts and issues this PO."
              : "Draft PO. Send for admin approval before recording GRN or delivery."}
          {isAdmin && approvalPendingFlag ? (
            <>
              {" "}
              <Link
                href="/procurement/approval"
                className="cursor-pointer font-semibold underline underline-offset-2 transition-colors duration-200 hover:text-amber-800"
              >
                Open Approval
              </Link>
            </>
          ) : null}
          {!isAdmin && approvalRejected && editPoHref ? (
            <>
              {" "}
              <Link
                href={editPoHref}
                className="cursor-pointer font-semibold underline underline-offset-2 transition-colors duration-200 hover:text-red-800"
              >
                Edit PO
              </Link>
            </>
          ) : null}
        </div>
      ) : null}

      {order ? (
        <>
          {showGrnWorkspace && challanOpen && challanFormMounted ? (
            <DeliveryChallanFormPage
              embedded={{
                orderId: order.id,
                saveRef: challanSaveRef,
                onClose: closeChallanPanel,
                onSaved: () => {
                  setChallanSavedBanner(
                    "Delivery challan saved. Create another for the next GRN if needed.",
                  );
                  refreshSavedChallans();
                  closeChallanPanel();
                },
              }}
            />
          ) : !showGrnWorkspace ? (
            <>
              <SectionCard title="Purchase order overview">
                <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <DetailItem label="Company PO">
                    {order.company_po_number?.trim() || order.document_number}
                  </DetailItem>
                  <DetailItem label="PO date">{order.document_date || "—"}</DetailItem>
                  <DetailItem label="Status">
                    <Badge
                      variant="outline"
                      className={cn(
                        "uppercase",
                        orderStatusBadgeClass(statusLabel, approvalPendingFlag),
                      )}
                    >
                      {approvalPendingFlag
                        ? "Pending approval"
                        : formatOrderStatusLabel(statusLabel)}
                    </Badge>
                  </DetailItem>
                  <DetailItem label="Customer">{order.customer_name?.trim() || "—"}</DetailItem>
                  <DetailItem label="Vendor">{vendorName || "—"}</DetailItem>
                  <DetailItem label="Vendor GST">{vendorGst?.trim() || "—"}</DetailItem>
                  <DetailItem label="Vendor payment terms">
                    {order.payment_terms?.trim() || "—"}
                  </DetailItem>
                  <DetailItem label="Amount">{formatInr(order.total_amount)}</DetailItem>
                </dl>
                {vendorAddress.trim() ? (
                  <dl className="mt-3 grid gap-3 border-t border-border/60 pt-3 sm:grid-cols-2">
                    <DetailItem label="Vendor address" className="sm:col-span-2">
                      <span className="whitespace-pre-line font-normal text-muted-foreground">
                        {vendorAddress}
                      </span>
                    </DetailItem>
                  </dl>
                ) : null}
              </SectionCard>

              <ScmCommercialDocumentsPanel
                orderId={order.id}
                ovfId={
                  order.source_module === "crm" ? order.source_document_id : null
                }
                branchId={order.branch_id}
                companyId={order.company_id}
                title="Documents"
                allowUpload={false}
              />

              <div className="overflow-hidden rounded-lg border border-border bg-card">
                <div className="border-b border-border px-3 py-2">
                  <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <Building2 className="size-3.5 text-[#0369A1]" aria-hidden />
                    Order lines
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">S No.</th>
                        <th className="px-3 py-2 font-medium">Product</th>
                        <th className="px-3 py-2 text-right font-medium">Qty</th>
                        <th className="px-3 py-2 text-right font-medium">Unit cost</th>
                        <th className="px-3 py-2 text-right font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderLines.map((ln, index) => (
                        <tr key={ln.id} className="border-b border-border/70">
                          <td className="px-3 py-2 tabular-nums text-muted-foreground">
                            {index + 1}
                          </td>
                          <td className="px-3 py-2 font-medium">
                            {ln.product_name || ln.product_code || "—"}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {Number(ln.quantity) || 0}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatInr(ln.unit_cost)}
                          </td>
                          <td className="px-3 py-2 text-right font-medium tabular-nums">
                            {formatInr(ln.line_total)}
                          </td>
                        </tr>
                      ))}
                      {lineCount === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                            No line items on this purchase order.
                          </td>
                        </tr>
                      ) : (
                        <tr className="border-t border-border bg-muted/20 font-semibold">
                          <td colSpan={4} className="px-3 py-2.5 text-right">
                            Total
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {formatInr(order.total_amount)}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
          <>
          {savedChallans.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="border-b border-border px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Delivery challans ({savedChallans.length})
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Challan no.</th>
                      <th className="px-3 py-2 font-medium">Date</th>
                      <th className="px-3 py-2 font-medium">GRN</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {savedChallans.map((challan) => {
                      const statusLabel =
                        getDeliveryStatus(challan.id)?.shipmentStatus || "Pending dispatch";
                      return (
                      <tr key={challan.id} className="border-b border-border/70 last:border-0">
                        <td className="px-3 py-2 font-medium tabular-nums">{challan.challanNumber}</td>
                        <td className="px-3 py-2 tabular-nums">{challan.challanDate}</td>
                        <td className="px-3 py-2 font-medium tabular-nums">
                          {formatChallanGrnSummary(challan)}
                        </td>
                        <td className="px-3 py-2">
                          <Badge
                            variant={shipmentStatusBadgeVariant(statusLabel)}
                            className="text-[10px] uppercase tracking-wide"
                          >
                            {statusLabel}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1.5">
                            <Link
                              href={deliveryStatusUpdateHref(challan.id)}
                              className={cn(
                                buttonVariants({ size: "sm", variant: "outline" }),
                                "h-7 cursor-pointer gap-1 px-2 text-xs transition-colors duration-200",
                              )}
                            >
                              <Truck className="size-3.5" />
                              Status
                            </Link>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 cursor-pointer px-2 text-xs transition-colors duration-200"
                              disabled={challanPdfBusyId === challan.id}
                              onClick={() => void onDownloadChallanPdf(challan)}
                            >
                              <FileDown className="size-3.5" />
                              PDF
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Lines & receipt
              </div>
              {showReceiptColumns ? (
                <Button
                  type="button"
                  size="sm"
                  className="h-8 cursor-pointer transition-colors duration-200"
                  disabled={savingReceipts || busy || !hasDraftReceiptQty}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openReceiptSerialModal();
                  }}
                >
                  Update
                </Button>
              ) : null}
            </div>
            <div className="overflow-x-auto">
              <table className={cn("w-full text-left text-sm", tableMinWidth)}>
                <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">S No.</th>
                    <th className="px-3 py-2 font-medium">Product</th>
                    <th className="px-3 py-2 font-medium">Ordered</th>
                    <th className="px-3 py-2 text-center font-medium">Receive now</th>
                    {showReceiptColumns ? (
                      <th className="px-3 py-2 font-medium">Remaining</th>
                    ) : null}
                    <th className="px-3 py-2 font-medium">Unit cost</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 text-center font-medium">GRN PDF</th>
                    <th className="px-3 py-2 text-center font-medium">PO PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {orderLines.map((ln, index) => {
                    const orderedQty = Number(ln.quantity) || 0;
                    const savedReceived = Number(ln.quantity_received ?? 0);
                    const remainingSaved = Math.max(0, orderedQty - savedReceived);
                    const locked = isReceiptLocked(orderedQty, savedReceived);
                    const additional = Number(qtyDraft[ln.id] || 0);
                    const remainingAfterDraft = Math.max(
                      0,
                      remainingSaved - (Number.isFinite(additional) ? additional : 0),
                    );
                    const projectedReceived = Math.min(
                      orderedQty,
                      savedReceived + (Number.isFinite(additional) ? additional : 0),
                    );
                    const status = receiptStatusFromQty(orderedQty, projectedReceived);

                    return (
                      <tr key={ln.id} className="border-b border-border/70 align-top">
                        <td className="px-3 py-2 tabular-nums">{index + 1}</td>
                        <td className="px-3 py-2">{ln.product_name || ln.product_code || "—"}</td>
                        <td className="px-3 py-2 tabular-nums">{orderedQty}</td>
                        <td className="px-3 py-2 text-center">
                          {locked ? (
                            <span className="font-medium tabular-nums">{savedReceived}</span>
                          ) : (
                            <Input
                              className="mx-auto block h-8 w-24"
                              type="text"
                              inputMode="decimal"
                              value={qtyDraft[ln.id] ?? ""}
                              disabled={
                                !showGrnWorkspace ||
                                savingReceipts ||
                                busy ||
                                remainingSaved <= 0
                              }
                              onFocus={(e) => e.currentTarget.select()}
                              onChange={(e) =>
                                onQtyDraftChange(
                                  ln.id,
                                  e.target.value,
                                  remainingSaved,
                                  Number(ln.unit_cost) || 0,
                                )
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  openReceiptSerialModal();
                                }
                              }}
                            />
                          )}
                        </td>
                        {showReceiptColumns ? (
                          <td className="px-3 py-2">
                            {remainingAfterDraft > 0 ? (
                              <span className="font-medium tabular-nums text-amber-700">
                                {remainingAfterDraft}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">0</span>
                            )}
                          </td>
                        ) : null}
                        <td className="px-3 py-2">
                          {locked || !showReceiptColumns ? (
                            <span className="tabular-nums">{formatInr(ln.unit_cost)}</span>
                          ) : (
                            <Input
                              className="h-8 w-28 font-mono text-sm tabular-nums"
                              type="text"
                              inputMode="decimal"
                              aria-label={`Unit cost for ${ln.product_name || ln.product_code || "line"}`}
                              title={`Max ${formatInr(Number(ln.unit_cost) || 0)} (PO unit cost)`}
                              value={costDraft[ln.id] ?? ""}
                              disabled={
                                !showGrnWorkspace ||
                                savingReceipts ||
                                busy ||
                                remainingSaved <= 0
                              }
                              onFocus={(e) => e.currentTarget.select()}
                              onChange={(e) =>
                                onCostDraftChange(
                                  ln.id,
                                  e.target.value,
                                  remainingSaved,
                                  Number(ln.unit_cost) || 0,
                                )
                              }
                            />
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={receiptBadgeVariant(status)} className="uppercase">
                            {status}
                          </Badge>
                        </td>
                        {index === 0 ? (
                          <>
                            <td
                              rowSpan={Math.max(lineCount, 1)}
                              className="border-l border-border/60 px-3 py-2 align-middle"
                            >
                              <div className="flex justify-center">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-8 w-8 cursor-pointer border-border p-0 text-[#0369A1] transition-colors duration-200 hover:bg-sky-50 hover:text-[#0369A1]"
                                  disabled={!hasReceivedQty}
                                  title="GRN numbers, vendor invoice documents, and PDF"
                                  aria-label="GRN and vendor invoice"
                                  onClick={() => setGrnPdfPickOpen(true)}
                                >
                                  <FileDown className="size-4 stroke-[2]" />
                                </Button>
                              </div>
                            </td>
                            <td
                              rowSpan={Math.max(lineCount, 1)}
                              className="border-l border-border/60 px-3 py-2 align-middle"
                            >
                              <div className="flex justify-center">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-8 w-8 cursor-pointer border-border p-0 text-[#0369A1] transition-colors duration-200 hover:bg-sky-50 hover:text-[#0369A1]"
                                  disabled={pdfBusy || lineCount === 0}
                                  title="Download PO PDF"
                                  aria-label="Download PO PDF"
                                  onClick={() => void onDownloadPdf()}
                                >
                                  <FileDown className="size-4 stroke-[2]" />
                                </Button>
                              </div>
                            </td>
                          </>
                        ) : null}
                      </tr>
                    );
                  })}
                  {lineCount === 0 ? (
                    <tr>
                      <td
                        colSpan={emptyColSpan}
                        className="px-3 py-8 text-center text-muted-foreground"
                      >
                        No lines on this purchase order.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
          </>
          )}
        </>
      ) : null}

      {order ? (
        <ReceiptSerialsDialog
          open={receiptSerialOpen}
          grnLabel={receiptGrnLabel}
          lines={pendingReceiptLines}
          serialDraft={serialDraft}
          busy={savingReceipts}
          error={receiptModalError}
          onSerialDraftChange={(lineId, slots) =>
            setSerialDraft((prev) => ({ ...prev, [lineId]: slots }))
          }
          onBillingQuantityChange={(lineId, billingQuantity) => {
            setPendingReceiptLines((prev) =>
              prev.map((row) =>
                row.lineId === lineId ? { ...row, billingQuantity } : row,
              ),
            );
          }}
          onSerialImportError={setReceiptModalError}
          vendorInvoice={vendorInvoiceDraft}
          onVendorInvoiceChange={setVendorInvoiceDraft}
          onConfirm={() => void confirmReceiptWithSerials()}
          onClose={closeReceiptSerialModal}
        />
      ) : null}

      {order && grnPdfContext && grnPdfPickOpen ? (
        <GrnPdfPickDialog
          open
          orderId={order.id}
          poLabel={order.company_po_number?.trim() || order.document_number}
          pdfContext={grnPdfContext}
          onClose={() => setGrnPdfPickOpen(false)}
        />
      ) : null}
    </div>
  );
}
