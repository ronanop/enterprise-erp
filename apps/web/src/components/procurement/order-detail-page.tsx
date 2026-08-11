"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FileDown, RefreshCw, Truck } from "lucide-react";

import { DeliveryChallanFormPage } from "@/components/procurement/delivery-challan-form-page";
import { GrnPdfPickDialog } from "@/components/procurement/grn-pdf-pick-dialog";
import {
  ReceiptSerialsDialog,
  type ReceiptSerialDialogLine,
  type VendorInvoiceDraft,
  emptyVendorInvoiceDraft,
} from "@/components/procurement/receipt-serials-dialog";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";
import {
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
  buildDeliveryChallanPdfInputFromRecord,
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
  validateSerialSlots,
} from "@/utils/receipt-serial-numbers";

type ReceiptStatus = "pending" | "partial" | "delivered";

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
  const [serialDraft, setSerialDraft] = useState<Record<string, string[]>>({});
  const [receiptSerialOpen, setReceiptSerialOpen] = useState(false);
  const [pendingReceiptLines, setPendingReceiptLines] = useState<ReceiptSerialDialogLine[]>([]);
  const [receiptModalError, setReceiptModalError] = useState<string | null>(null);
  const [vendorInvoiceDraft, setVendorInvoiceDraft] = useState<VendorInvoiceDraft>(
    emptyVendorInvoiceDraft,
  );
  const [challanOpen, setChallanOpen] = useState(false);
  const [challanSavedBanner, setChallanSavedBanner] = useState<string | null>(null);
  const [challanFormMounted, setChallanFormMounted] = useState(false);
  const [savedChallans, setSavedChallans] = useState<DeliveryChallanRecord[]>([]);
  const [challanPdfBusyId, setChallanPdfBusyId] = useState<string | null>(null);
  const challanSaveRef = useRef<(() => void) | null>(null);

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
      setQtyDraft(Object.fromEntries((row.lines || []).map((ln) => [ln.id, "" ])));
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

  async function onFinalize() {
    if (!order) return;
    setBusy(true);
    setError(null);
    try {
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
      await downloadOrderPdf(order, { name: vendorName, address: vendorAddress });
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
      const input = buildDeliveryChallanPdfInputFromRecord(challan);
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
      const slots = resizeSerialSlots(serialDraft[row.lineId] || [], row.additional);
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
            setQtyDraft(
              Object.fromEntries((refreshed.lines || []).map((ln) => [ln.id, "" ])),
            );
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
      setQtyDraft(
        Object.fromEntries((refreshed.lines || []).map((ln) => [ln.id, "" ])),
      );
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
        return { ok: false, message: `You can receive at most ${remaining} more for ${label}.` };
      }
      if (!Number.isInteger(additional)) {
        return {
          ok: false,
          message: `Receive qty for ${label} must be a whole number when capturing serial numbers.`,
        };
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
        row.additional,
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

  const canReceipt =
    order &&
    !["draft", "submitted", "cancelled"].includes((order.status || "").toLowerCase());
  const canFinalize =
    order &&
    order.status === "draft" &&
    order.source_module === "crm" &&
    (order.lines?.length ?? 0) > 0;
  const lineCount = order?.lines?.length ?? 0;
  const allLinesDelivered =
    lineCount > 0 &&
    (order?.lines || []).every((ln) =>
      isReceiptLocked(Number(ln.quantity) || 0, Number(ln.quantity_received ?? 0)),
    );
  const showReceiptColumns = !allLinesDelivered;
  const hasDraftReceiptQty = (order?.lines || []).some((ln) => {
    const orderedQty = Number(ln.quantity) || 0;
    const savedReceived = Number(ln.quantity_received ?? 0);
    if (isReceiptLocked(orderedQty, savedReceived)) return false;
    const raw = (qtyDraft[ln.id] ?? "").trim();
    if (!raw || raw === ".") return false;
    const additional = Number(raw);
    return Number.isFinite(additional) && additional > 0;
  });

  function onQtyDraftChange(lineId: string, value: string, maxAllowed: number) {
    const next = normalizeQtyInput(value, maxAllowed);
    setQtyDraft((prev) => ({ ...prev, [lineId]: next }));
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
  const tableMinWidth = showReceiptColumns ? "min-w-[1000px]" : "min-w-[860px]";
  const emptyColSpan = showReceiptColumns ? 9 : 8;

  return (
    <div className="space-y-4">
      <PageHeader
        {...(challanOpen
          ? { onBack: closeChallanPanel, backLabel: "PO" }
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
            {hasReceivedQty && !challanOpen ? (
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
            {challanOpen ? (
              <Button
                type="button"
                size="sm"
                className="cursor-pointer transition-colors duration-200"
                onClick={() => challanSaveRef.current?.()}
              >
                Save challan
              </Button>
            ) : null}
            {canFinalize ? (
              <Button
                type="button"
                size="sm"
                className="cursor-pointer transition-colors duration-200"
                disabled={busy}
                onClick={() => void onFinalize()}
              >
                Finalize &amp; issue
              </Button>
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

      {order ? (
        <>
          {challanOpen && challanFormMounted ? (
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
                Lines &amp; receipt
              </div>
              {showReceiptColumns && canReceipt ? (
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
                  {(order.lines || []).map((ln, index) => {
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
                        <td className="px-3 py-2 tabular-nums">{ln.line_number}</td>
                        <td className="px-3 py-2">{ln.product_name || ln.product_code || "—"}</td>
                        <td className="px-3 py-2 tabular-nums">{orderedQty}</td>
                        <td className="px-3 py-2 text-center">
                          {locked ? (
                            <span className="tabular-nums font-medium">{savedReceived}</span>
                          ) : (
                            <Input
                              className="mx-auto block h-8 w-24"
                              type="text"
                              inputMode="decimal"
                              value={qtyDraft[ln.id] ?? ""}
                              disabled={
                                !canReceipt || savingReceipts || busy || remainingSaved <= 0
                              }
                              onFocus={(e) => e.currentTarget.select()}
                              onChange={(e) =>
                                onQtyDraftChange(ln.id, e.target.value, remainingSaved)
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
                              <span className="tabular-nums font-medium text-amber-700">
                                {remainingAfterDraft}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">0</span>
                            )}
                          </td>
                        ) : null}
                        <td className="px-3 py-2 tabular-nums">{formatInr(ln.unit_cost)}</td>
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
