"use client";

/** Delivery challan queue - pending + saved DCs with generated GRN numbers. */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileDown, FileText, Receipt, RefreshCw, Truck } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { procurementUi } from "@/components/procurement/procurement-ui";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  createInvoiceGenerationTasks,
  getInvoiceGenerationTaskForBatch,
  listInvoiceGenerationTasks,
  listInvoiceGenerationTasksForOrder,
  listOrderReceiptBatches,
  listProcurementInventory,
  listReceiptBatchAttachments,
  openReceiptBatchAttachment,
  pickVendorInvoiceAttachment,
  type ProcInvoiceGenerationTask,
  type ProcurementInventoryRow,
  type ReceiptBatchAttachment,
} from "@/services/procurement-service";
import { ApiClientError } from "@/services/api-client";
import {
  buildDeliveryChallanPdfInputFromRecordResolved,
  downloadDeliveryChallanPdf,
} from "@/utils/delivery-challan-pdf";
import {
  challanBillingTotals,
  emptyChallanLine,
  formatChallanItemsSummary,
  getDeliveryChallan,
  listDeliveryChallansByOrderId,
  peekNextDeliveryChallanNumber,
  upsertDeliveryChallan,
  type DeliveryChallanRecord,
  type GrnChallanKind,
} from "@/utils/delivery-challan-storage";
import {
  addPendingGrnChallan,
  listAllGrnChallansByKind,
  listDeliveryChallanQueueByKind,
  patchPendingGrnChallan,
  pendingGrnChallanHref,
  rememberBillingReceiptBatch,
  invoiceAlreadyCreatedForChallan,
  upsertPendingGrnChallan,
  type PendingGrnChallan,
} from "@/utils/grn-challan-pending";
import { deliveryStatusUpdateHref } from "@/utils/delivery-status-routes";
import {
  deliveryStatusUiMode,
  ensureDeliveryStatusForChallan,
  getDeliveryStatus,
  upsertDeliveryChallanBilling,
} from "@/utils/delivery-status-storage";
import {
  formatGeneratedGrnNumbers,
  isGeneratedGrnNumber,
  resolveDisplayGrnNumbers,
  uniqueGeneratedGrnNumbers,
} from "@/utils/grn-number-display";
import { formatUniquePoLabels } from "@/utils/format-po-labels";

type QueueTab = GrnChallanKind;

/** Pending billing row id -> Accounts invoice task details for the list. */
type BillingInvoiceReadyMap = Record<
  string,
  {
    ready: boolean;
    invoiceNumber?: string;
    invoiceDate?: string;
    itemsSummary?: string;
    quantity?: number;
    amount?: number;
    grnNumber?: string;
    status?: string;
    receiptBatchId?: string;
    attachmentId?: string;
    attachmentFileName?: string;
  }
>;

function dcInvoiceBatchKey(challanId: string): string {
  return `dc-invoice:${challanId}`;
}

function challanWasDispatched(challanId: string): boolean {
  const status = getDeliveryStatus(challanId);
  if (!status) return false;
  return deliveryStatusUiMode(status) === "tracking";
}

function stripQuoteTag(value: string | null | undefined): string {
  return (value || "").replace(/\[quote:[^\]]+\]\s*/gi, "").trim();
}

async function resolveReceiptBatchId(row: PendingGrnChallan): Promise<string | null> {
  const key = (row.batchKey || "").trim();
  if (looksLikeUuid(key)) return key;
  const orderId = (row.orderId || "").trim();
  if (!looksLikeUuid(orderId)) return null;
  try {
    const batches = await listOrderReceiptBatches(orderId);
    const withId = batches.filter((batch) => looksLikeUuid(String(batch.id || "")));
    const latest = withId[withId.length - 1];
    return latest ? String(latest.id) : null;
  } catch {
    return null;
  }
}

function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}

function formatBillingQty(value: number | undefined): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return "-";
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 1e4) / 1e4);
}

function formatBillingAmount(value: number | undefined): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return "-";
  return value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function pickInvoiceTaskForRow(
  row: PendingGrnChallan,
  tasks: ProcInvoiceGenerationTask[],
): ProcInvoiceGenerationTask | null {
  if (tasks.length === 0) return null;
  const batchId = row.batchKey?.trim() || "";
  if (looksLikeUuid(batchId)) {
    const byBatch = tasks.find((t) => String(t.receipt_batch_id) === batchId);
    if (byBatch) return byBatch;
  }
  const docNumber = (row.docNumber || "").trim().toLowerCase();
  if (docNumber && docNumber !== "-") {
    const byInvoice = tasks.find(
      (t) => (t.invoice_number || "").trim().toLowerCase() === docNumber,
    );
    if (byInvoice) return byInvoice;
  }
  const summary = stripQuoteTag(row.itemsSummary || "").toLowerCase();
  if (summary && summary !== "-") {
    const bySummary = tasks.find(
      (t) => stripQuoteTag(t.items_summary || "").toLowerCase() === summary,
    );
    if (bySummary) return bySummary;
  }
  // Only fall back to a lone task for this order — never stamp one completed
  // invoice onto every unmatched billing row (that duplicates invoice numbers).
  if (tasks.length === 1) return tasks[0];
  const pendingOnly = tasks.filter((t) => t.status === "pending");
  if (pendingOnly.length === 1) return pendingOnly[0];
  return null;
}

/**
 * Mirror open / recent My Jobs invoice-generation tasks into the Billing queue.
 * GRN save creates server tasks without always writing localStorage rows.
 */
function syncBillingQueueFromInvoiceTasks(tasks: ProcInvoiceGenerationTask[]): void {
  const byBatch = new Map<string, ProcInvoiceGenerationTask>();
  for (const task of tasks) {
    const batchId = String(task.receipt_batch_id || "").trim();
    if (!looksLikeUuid(batchId)) continue;
    const prev = byBatch.get(batchId);
    const prevAt = prev?.created_at || "";
    const nextAt = task.created_at || "";
    if (!prev || nextAt >= prevAt) {
      byBatch.set(batchId, task);
    }
  }
  for (const task of byBatch.values()) {
    const batchId = String(task.receipt_batch_id).trim();
    const orderId = String(task.order_header_id || "").trim();
    if (!looksLikeUuid(orderId)) continue;
    const companyPo = (task.purchase_order_number || "").trim();
    const invoiceNumber = (task.invoice_number || "").trim();
    const invoiceDate = (task.invoice_date || "").trim().slice(0, 10);
    const completed = String(task.status || "").toLowerCase() === "completed";
    upsertPendingGrnChallan({
      orderId,
      batchKey: batchId,
      grnNumber: (task.grn_number || "").trim() || "-",
      purchaseOrderNumber: companyPo,
      vendorName: (task.vendor_name || "").trim(),
      customerName: (task.customer_name || "").trim(),
      itemsSummary: stripQuoteTag(task.items_summary) || "-",
      kind: "billing",
      source: "grn",
      createdAt: task.created_at || undefined,
      docNumber: invoiceNumber || undefined,
      docDate: invoiceDate || undefined,
      ...(completed && invoiceNumber
        ? { status: "saved" as const }
        : {}),
    });
    rememberBillingReceiptBatch(
      {
        id: batchId,
        orderId,
        batchKey: batchId,
        kind: "billing",
      },
      batchId,
    );
  }
}

/** One billing row per invoice (or per receipt batch / queue id when still pending). */
function collapseBillingQueueRows(
  rows: PendingGrnChallan[],
  readiness: BillingInvoiceReadyMap,
): PendingGrnChallan[] {
  const groups = new Map<string, PendingGrnChallan>();
  const rank = (row: PendingGrnChallan) => {
    const meta = readiness[row.id];
    const invoice = (meta?.invoiceNumber || row.docNumber || "").trim();
    const date = (meta?.invoiceDate || row.docDate || row.createdAt || "").trim();
    return `${date}\0${row.createdAt}\0${invoice}`;
  };
  for (const row of rows) {
    const meta = readiness[row.id];
    const invoice = (meta?.invoiceNumber || row.docNumber || "").trim().toLowerCase();
    const po = (row.purchaseOrderNumber || row.orderId || "").trim().toLowerCase();
    const batch = looksLikeUuid(row.batchKey || "")
      ? (row.batchKey || "").trim().toLowerCase()
      : "";
    const key =
      invoice && invoice !== "-"
        ? `inv:${po}:${invoice}`
        : batch
          ? `batch:${batch}`
          : `id:${row.savedRecordId || row.id}`;
    const existing = groups.get(key);
    if (!existing || rank(row) > rank(existing)) {
      groups.set(key, row);
    }
  }
  return [...groups.values()];
}

function taskBillingMeta(task: ProcInvoiceGenerationTask | null): BillingInvoiceReadyMap[string] {
  if (!task) return { ready: false };
  const qty =
    Number(task.suggested_quantity) > 0
      ? Number(task.suggested_quantity)
      : Number(task.invoice_quantity) > 0
        ? Number(task.invoice_quantity)
        : undefined;
  const amount =
    Number(task.suggested_amount) > 0
      ? Number(task.suggested_amount)
      : Number(task.invoice_amount) > 0
        ? Number(task.invoice_amount)
        : undefined;
  const invoiceNumber = task.invoice_number?.trim() || undefined;
  const invoiceDate = task.invoice_date?.slice(0, 10) || undefined;
  const ready = task.status === "completed" && Boolean(invoiceNumber || invoiceDate);
  const receiptBatchId = String(task.receipt_batch_id || "").trim() || undefined;
  return {
    ready,
    invoiceNumber,
    invoiceDate,
    itemsSummary: task.items_summary?.trim() || undefined,
    quantity: qty,
    amount,
    grnNumber: task.grn_number?.trim() || undefined,
    status: task.status,
    receiptBatchId: receiptBatchId && looksLikeUuid(receiptBatchId) ? receiptBatchId : undefined,
  };
}

function pickInvoiceAttachment(
  attachments: ReceiptBatchAttachment[],
): ReceiptBatchAttachment | null {
  return pickVendorInvoiceAttachment(attachments);
}

/** Prefer the delivery challan for Set dispatch; fall back to a billing record. */
function resolveBillingDispatchChallanId(
  row: PendingGrnChallan,
  invoiceNumber?: string,
): string | null {
  if (row.sourceChallanId && getDeliveryChallan(row.sourceChallanId)) {
    return row.sourceChallanId;
  }
  if (row.savedRecordId) {
    const saved = getDeliveryChallan(row.savedRecordId);
    if (saved?.sourceChallanId && getDeliveryChallan(saved.sourceChallanId)) {
      return saved.sourceChallanId;
    }
  }
  const orderId = (row.orderId || "").trim();
  if (orderId) {
    const delivery = listDeliveryChallansByOrderId(orderId).find(
      (challan) => (challan.grnKind || "delivery_challan") !== "billing",
    );
    if (delivery) return delivery.id;
  }
  if (row.savedRecordId && getDeliveryChallan(row.savedRecordId)) {
    return row.savedRecordId;
  }
  const invoice = (invoiceNumber || row.docNumber || "").trim().toLowerCase();
  if (invoice && invoice !== "-") {
    const byInvoice = listDeliveryChallansByOrderId(orderId || row.orderId || "").find(
      (challan) =>
        challan.grnKind === "billing" &&
        (challan.invoiceNumber || challan.challanNumber || "").trim().toLowerCase() ===
          invoice,
    );
    if (byInvoice) return byInvoice.id;
  }
  if (orderId) {
    const billing = listDeliveryChallansByOrderId(orderId).find(
      (challan) => challan.grnKind === "billing",
    );
    if (billing) return billing.id;
  }
  return null;
}

/** Ensure a challan exists so Billing Open can land on Delivery Status Set dispatch. */
function ensureBillingDispatchChallan(
  row: PendingGrnChallan,
  meta: BillingInvoiceReadyMap[string],
): string {
  const invoiceNumber = (meta.invoiceNumber || row.docNumber || "").trim();
  const existingId = resolveBillingDispatchChallanId(row, invoiceNumber);
  const invoiceDate =
    (meta.invoiceDate || row.docDate || "").trim().slice(0, 10) ||
    new Date().toISOString().slice(0, 10);

  if (existingId) {
    if (meta.ready && invoiceNumber) {
      upsertDeliveryChallanBilling({
        challanId: existingId,
        billStatus: "fully_billed",
        billedQuantity:
          meta.quantity != null && meta.quantity > 0 ? String(meta.quantity) : "0",
        billInvoiceNumber: invoiceNumber,
        billInvoiceDate: invoiceDate,
      });
    }
    const existing = getDeliveryChallan(existingId);
    const isDelivery =
      Boolean(existing) && (existing!.grnKind || "delivery_challan") !== "billing";
    patchPendingGrnChallan(row.orderId, row.batchKey, "billing", {
      status: "saved",
      ...(isDelivery
        ? { sourceChallanId: existingId }
        : { savedRecordId: existingId }),
      docNumber: invoiceNumber || row.docNumber,
      docDate: invoiceDate || row.docDate,
    });
    return existingId;
  }

  const batchKey = looksLikeUuid(row.batchKey || "") ? (row.batchKey || "").trim() : "";
  const qtyLabel =
    meta.quantity != null && meta.quantity > 0 ? String(meta.quantity) : "";
  const line = emptyChallanLine();
  const summary = stripQuoteTag(meta.itemsSummary || row.itemsSummary || "");
  if (summary && summary !== "-") {
    line.itemName = summary.replace(/\s*\(\d+(?:\.\d+)?\)/g, "").trim() || summary;
    line.quantitySent = qtyLabel;
  } else if (qtyLabel) {
    line.itemName = "Item";
    line.quantitySent = qtyLabel;
  }

  const saved = upsertDeliveryChallan({
    id: crypto.randomUUID(),
    orderId: looksLikeUuid(row.orderId || "") ? row.orderId : null,
    challanNumber: invoiceNumber || peekNextDeliveryChallanNumber(),
    challanDate: invoiceDate,
    entityName: "",
    entityAddressBlock: "",
    entityGstBlock: "",
    documentType: "TAX INVOICE",
    copyLabel: "ORIGINAL FOR CONSIGNEE",
    customerName: row.customerName?.trim() || "Customer",
    customerBillTo: "",
    customerShipTo: "",
    customerGstNo: "",
    kindAttn: "",
    purchaseOrderNumber: row.purchaseOrderNumber || "",
    poDate: "",
    poNumberDate: "",
    shipFromAddress: "",
    billingState: "",
    shippingState: "",
    taxPercentage: "18",
    remarks: "",
    taxRemarks: "",
    preparedBy: "",
    deliveredBy: "",
    vendorName: row.vendorName || "",
    itemsSourceMode: "selected_grns",
    selectedGrnKeys: batchKey ? [batchKey] : [],
    selectedGrnNumbers:
      row.grnNumber && row.grnNumber !== "-"
        ? [row.grnNumber]
        : meta.grnNumber
          ? [meta.grnNumber]
          : [],
    grnKind: "billing",
    invoiceNumber: invoiceNumber || undefined,
    invoiceDate,
    sourceChallanId: row.sourceChallanId,
    companyPoNumber: row.purchaseOrderNumber || "",
    lines: [line],
    deliveryMode: "NRGP",
    transportDetails: "",
    driverVehicleDetails: "",
    senderSignature: "",
    receiverSignature: "",
  });
  ensureDeliveryStatusForChallan(saved, {
    billStatus: invoiceNumber ? "fully_billed" : "unbilled",
    billInvoiceNumber: invoiceNumber || undefined,
    billInvoiceDate: invoiceNumber ? invoiceDate : undefined,
    billedQuantity:
      meta.quantity != null && meta.quantity > 0 ? String(meta.quantity) : undefined,
  });
  patchPendingGrnChallan(row.orderId, row.batchKey, "billing", {
    status: "saved",
    savedRecordId: saved.id,
    docNumber: invoiceNumber || row.docNumber,
    docDate: invoiceDate || row.docDate,
  });
  return saved.id;
}

function enrichQueueRowsWithGeneratedGrns(
  rows: PendingGrnChallan[],
  inventory: ProcurementInventoryRow[],
): PendingGrnChallan[] {
  return rows.map((row) => {
    const saved =
      row.savedRecordId ? getDeliveryChallan(row.savedRecordId) : null;
    const numbers = resolveDisplayGrnNumbers({
      stored: [row.grnNumber, ...(saved?.selectedGrnNumbers || [])],
      orderId: row.orderId || saved?.orderId,
      inventory,
    });
    const label = formatGeneratedGrnNumbers(numbers);

    if (numbers.length > 0) {
      if (!isGeneratedGrnNumber(row.grnNumber) || row.grnNumber !== label) {
        patchPendingGrnChallan(row.orderId, row.batchKey, row.kind, {
          grnNumber: label,
        });
      }
      if (
        saved &&
        uniqueGeneratedGrnNumbers(saved.selectedGrnNumbers).join("\0") !== numbers.join("\0")
      ) {
        upsertDeliveryChallan({
          ...saved,
          selectedGrnNumbers: numbers,
        });
      }
    }

    return { ...row, grnNumber: label };
  });
}

export function DeliveryChallanListPage() {
  const [tab, setTab] = useState<QueueTab>("delivery_challan");
  const [pendingBilling, setPendingBilling] = useState<PendingGrnChallan[]>([]);
  const [pendingDc, setPendingDc] = useState<PendingGrnChallan[]>([]);
  const [billingInvoiceReady, setBillingInvoiceReady] = useState<BillingInvoiceReadyMap>({});
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null);
  const [invoiceBusyId, setInvoiceBusyId] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [accountsNotice, setAccountsNotice] = useState<string | null>(null);

  async function onDownloadPdf(challan: DeliveryChallanRecord) {
    setPdfBusyId(challan.id);
    setPdfError(null);
    try {
      const input = await buildDeliveryChallanPdfInputFromRecordResolved(challan);
      await downloadDeliveryChallanPdf(input);
    } catch (err) {
      setPdfError(
        err instanceof Error
          ? err.message
          : "Failed to download PDF",
      );
    } finally {
      setPdfBusyId(null);
    }
  }

  async function onDownloadBillingInvoicePdf(
    row: PendingGrnChallan,
    meta: BillingInvoiceReadyMap[string] | undefined,
  ) {
    const busyKey = `billing:${row.id}`;
    setPdfBusyId(busyKey);
    setPdfError(null);
    try {
      let attachmentId = (meta?.attachmentId || "").trim();
      let fileName = (meta?.attachmentFileName || "").trim();
      let batchId =
        meta?.receiptBatchId?.trim() ||
        (looksLikeUuid(row.batchKey || "") ? (row.batchKey || "").trim() : "");

      if (!attachmentId) {
        if (!batchId) {
          batchId = (await resolveReceiptBatchId(row)) || "";
        }
        if (!batchId) {
          throw new Error(
            "No invoice document is attached for this billing row yet. Complete the My Jobs invoice with a file first.",
          );
        }
        const attachments = await listReceiptBatchAttachments(batchId);
        const file = pickInvoiceAttachment(attachments);
        attachmentId = String(file?.id || "").trim();
        fileName = (file?.file_name || fileName || "").trim();
      }
      if (!attachmentId) {
        throw new Error(
          "No invoice document is attached for this billing row yet. Complete the My Jobs invoice with a file first.",
        );
      }
      // Force-download the My Jobs vendor-invoice attach (not a generated billing PDF).
      await openReceiptBatchAttachment(attachmentId, {
        download: true,
        fileName: fileName || "invoice.pdf",
        timeoutMs: 90_000,
      });
    } catch (err) {
      setPdfError(
        err instanceof Error ? err.message : "Failed to download billing invoice PDF",
      );
    } finally {
      setPdfBusyId(null);
    }
  }

  useEffect(() => {
    try {
      const msg = sessionStorage.getItem("erp.procurement.accounts-invoice-notified");
      if (msg) {
        sessionStorage.removeItem("erp.procurement.accounts-invoice-notified");
        setAccountsNotice(msg);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const load = useCallback(async () => {
    // Pull My Jobs invoice tasks into Billing so GRN-created jobs always appear.
    try {
      const openTasks = await listInvoiceGenerationTasks({ limit: 200 });
      syncBillingQueueFromInvoiceTasks(openTasks);
    } catch {
      /* local queue still usable if tenant task list is unavailable */
    }

    const billing = listDeliveryChallanQueueByKind("billing");
    const dc = listDeliveryChallanQueueByKind("delivery_challan");
    setPendingBilling(billing);
    setPendingDc(dc);

    let nextBilling = billing;
    let nextDc = dc;
    try {
      const inventory = await listProcurementInventory();
      nextBilling = enrichQueueRowsWithGeneratedGrns(billing, inventory);
      nextDc = enrichQueueRowsWithGeneratedGrns(dc, inventory);
      setPendingBilling(nextBilling);
      setPendingDc(nextDc);
    } catch {
      /* keep local queue rows if inventory is unavailable */
    }

    const billingRowsForMeta = nextBilling.filter(
      (r) => !r.status || r.status === "pending" || r.status === "saved",
    );
    const readiness: BillingInvoiceReadyMap = {};
    const orderIds = [
      ...new Set(
        billingRowsForMeta
          .map((row) => row.orderId?.trim())
          .filter((id): id is string => Boolean(id) && looksLikeUuid(id)),
      ),
    ];
    const tasksByOrder = new Map<string, ProcInvoiceGenerationTask[]>();
    await Promise.all(
      orderIds.map(async (orderId) => {
        try {
          const tasks = await listInvoiceGenerationTasksForOrder(orderId);
          tasksByOrder.set(orderId, tasks);
        } catch {
          tasksByOrder.set(orderId, []);
        }
      }),
    );

    await Promise.all(
      billingRowsForMeta.map(async (row) => {
        const orderId = row.orderId?.trim() || "";
        let task = pickInvoiceTaskForRow(row, tasksByOrder.get(orderId) || []);
        const batchId = row.batchKey?.trim() || "";
        if (!task && looksLikeUuid(batchId)) {
          try {
            task = await getInvoiceGenerationTaskForBatch(batchId);
          } catch {
            task = null;
          }
        }
        if (!task && (!row.status || row.status === "pending") && looksLikeUuid(orderId)) {
          const receiptBatchId = await resolveReceiptBatchId(row);
          if (receiptBatchId) {
            try {
              const summary = stripQuoteTag(row.itemsSummary);
              const parsedQty = [...summary.matchAll(/\((\d+(?:\.\d+)?)\)/g)]
                .map((m) => Number(m[1]))
                .filter((n) => Number.isFinite(n) && n > 0)
                .reduce((a, b) => a + b, 0);
              const created = await createInvoiceGenerationTasks({
                order_id: orderId,
                receipt_batch_id: receiptBatchId,
                items_summary: summary,
                vendor_name: row.vendorName,
                customer_name: row.customerName || "",
                grn_number:
                  row.grnNumber && row.grnNumber !== "-" ? row.grnNumber : undefined,
                billing_quantity: parsedQty > 0 ? parsedQty : undefined,
              });
              task = created[0] || null;
              if (!looksLikeUuid(batchId)) {
                rememberBillingReceiptBatch(row, receiptBatchId);
              }
              setAccountsNotice(
                "Invoice generation was sent to the Invoice generation user. It appears in their My Jobs.",
              );
            } catch (err) {
              const detail =
                err instanceof ApiClientError
                  ? [err.message, ...err.errors].filter(Boolean).join(" - ")
                  : err instanceof Error && err.message.trim()
                    ? err.message
                    : "Could not send invoice generation";
              setPdfError(
                `Pending billing for ${row.purchaseOrderNumber || "this PO"} was not sent to My Jobs: ${detail}`,
              );
            }
          } else {
            setPdfError(
              `Pending billing for ${row.purchaseOrderNumber || "this PO"} has no GRN receipt, so it was not sent to My Jobs.`,
            );
          }
        }
        const meta = taskBillingMeta(task);
        if (!meta.itemsSummary && row.itemsSummary?.trim()) {
          meta.itemsSummary = stripQuoteTag(row.itemsSummary);
        }
        if (!meta.grnNumber && row.grnNumber?.trim() && row.grnNumber !== "-") {
          meta.grnNumber = row.grnNumber.trim();
        }
        const companyPo = (task?.purchase_order_number || "").trim();
        if (companyPo && companyPo !== (row.purchaseOrderNumber || "").trim()) {
          patchPendingGrnChallan(row.orderId, row.batchKey, "billing", {
            purchaseOrderNumber: companyPo,
          });
        }
        if (
          (meta.quantity == null || meta.quantity <= 0) &&
          meta.itemsSummary
        ) {
          const parsed = [...meta.itemsSummary.matchAll(/\((\d+(?:\.\d+)?)\)/g)].map(
            (m) => Number(m[1]),
          );
          const sum = parsed.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
          if (sum > 0) meta.quantity = sum;
        }
        if (!meta.receiptBatchId && looksLikeUuid(batchId)) {
          meta.receiptBatchId = batchId;
        }
        if (meta.ready && meta.receiptBatchId && !meta.attachmentId) {
          try {
            const attachments = await listReceiptBatchAttachments(meta.receiptBatchId);
            const file = pickInvoiceAttachment(attachments);
            if (file?.id) {
              meta.attachmentId = String(file.id);
              meta.attachmentFileName = file.file_name || undefined;
            }
          } catch {
            /* attachment optional until Accounts file is readable */
          }
        }
        readiness[row.id] = meta;
        if (meta.ready && (meta.invoiceNumber || meta.invoiceDate)) {
          patchPendingGrnChallan(row.orderId, row.batchKey, "billing", {
            docNumber: meta.invoiceNumber || row.docNumber,
            docDate: meta.invoiceDate || row.docDate,
          });
          // Surface the PO on Delivery Status so Set dispatch can start from Billing.
          ensureBillingDispatchChallan(row, meta);
        }
      }),
    );
    setBillingInvoiceReady(readiness);
    // Re-read after task sync / company-PO patches / dispatch challan ensures.
    setPendingBilling(listDeliveryChallanQueueByKind("billing"));
  }, []);

  useEffect(() => {
    const tabParam = new URLSearchParams(window.location.search).get("tab");
    if (tabParam === "billing" || tabParam === "delivery_challan") {
      setTab(tabParam);
    }
  }, []);

  async function createInvoiceFromChallan(challan: DeliveryChallanRecord) {
    if (invoiceBusyId) return;
    setInvoiceBusyId(challan.id);
    setPdfError(null);
    try {
      const batchKey = dcInvoiceBatchKey(challan.id);
      const already = invoiceAlreadyCreatedForChallan(challan);
      if (!already) {
        addPendingGrnChallan({
          orderId: challan.orderId || challan.id,
          batchKey,
          grnNumber: challan.selectedGrnNumbers.join(", ") || "-",
          purchaseOrderNumber: challan.purchaseOrderNumber,
          vendorName: challan.vendorName,
          customerName: challan.customerName,
          itemsSummary: formatChallanItemsSummary(challan.lines),
          kind: "billing",
          sourceChallanId: challan.id,
          source: challan.selectedGrnKeys[0]?.startsWith("ovf-stock:")
            ? "ovf_stock"
            : "grn",
        });
      }
      const receiptBatchId = await resolveReceiptBatchId({
        id: batchKey,
        orderId: challan.orderId || challan.id,
        batchKey: challan.selectedGrnKeys.find((key) => looksLikeUuid(key)) || "",
        grnNumber: "",
        purchaseOrderNumber: "",
        vendorName: "",
        kind: "billing",
        createdAt: "",
      });
      if (!challan.orderId || !receiptBatchId) {
        setPdfError(
          "This delivery challan has no GRN receipt, so invoice generation was not sent to My Jobs.",
        );
        setTab("billing");
        await load();
        return;
      }
      const summary = stripQuoteTag(formatChallanItemsSummary(challan.lines));
      const totals = challanBillingTotals(challan.lines);
      await createInvoiceGenerationTasks({
        order_id: challan.orderId,
        receipt_batch_id: receiptBatchId,
        items_summary: summary,
        vendor_name: challan.vendorName,
        customer_name: challan.customerName,
        grn_number: challan.selectedGrnNumbers.join(", ") || undefined,
        billing_quantity: totals.quantity > 0 ? totals.quantity : undefined,
        billing_amount: totals.amount > 0 ? totals.amount : undefined,
      });
      rememberBillingReceiptBatch(
        {
          id: batchKey,
          orderId: challan.orderId,
          batchKey,
          kind: "billing",
        },
        receiptBatchId,
      );
      try {
        sessionStorage.setItem(
          "erp.procurement.accounts-invoice-notified",
          "Invoice generation was sent to the Invoice generation user. It appears in their My Jobs.",
        );
      } catch {
        /* ignore */
      }
      setAccountsNotice(
        "Invoice generation was sent to the Invoice generation user. It appears in their My Jobs.",
      );
      setTab("billing");
      await load();
    } catch (err) {
      const detail =
        err instanceof ApiClientError
          ? [err.message, ...err.errors].filter(Boolean).join(" - ")
          : err instanceof Error && err.message.trim()
            ? err.message
            : "Could not create the invoice";
      setPdfError(detail);
    } finally {
      setInvoiceBusyId(null);
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

  const pendingForTab =
    tab === "billing"
      ? collapseBillingQueueRows(pendingBilling, billingInvoiceReady)
      : pendingDc;
  const tableRows = [...pendingForTab].sort((a, b) => {
    if (tab === "billing") {
      const aMeta = billingInvoiceReady[a.id];
      const bMeta = billingInvoiceReady[b.id];
      const aStamp = `${aMeta?.invoiceDate || a.docDate || ""}\0${a.createdAt}`;
      const bStamp = `${bMeta?.invoiceDate || b.docDate || ""}\0${b.createdAt}`;
      const byStamp = bStamp.localeCompare(aStamp);
      if (byStamp !== 0) return byStamp;
      return b.createdAt.localeCompare(a.createdAt);
    }
    const aPending = !a.status || a.status === "pending";
    const bPending = !b.status || b.status === "pending";
    if (aPending !== bPending) return aPending ? -1 : 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
  const pendingDcCount = pendingDc.filter((r) => !r.status || r.status === "pending").length;
  const pendingBillingCount = pendingBilling.filter((r) => !r.status || r.status === "pending").length;

  return (
    <div className={procurementUi.page}>
      <PageHeader
        title="Delivery"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => void load()}
            >
              <RefreshCw className="mr-1.5 size-3.5" />
              Refresh
            </Button>
          </div>
        }
      />

      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="Delivery challan or billing"
      >
        <Button
          type="button"
          role="tab"
          aria-selected={tab === "delivery_challan"}
          size="sm"
          variant={tab === "delivery_challan" ? "default" : "outline"}
          className="cursor-pointer transition-colors duration-200"
          onClick={() => setTab("delivery_challan")}
        >
          <Truck className="mr-1.5 size-3.5" />
          Delivery challan
          {pendingDcCount > 0 ? (
            <span className="ml-1.5 rounded-md bg-background/20 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
              {pendingDcCount}
            </span>
          ) : null}
        </Button>
        <Button
          type="button"
          role="tab"
          aria-selected={tab === "billing"}
          size="sm"
          variant={tab === "billing" ? "default" : "outline"}
          className="cursor-pointer transition-colors duration-200"
          onClick={() => setTab("billing")}
        >
          <FileText className="mr-1.5 size-3.5" />
          Billing
          {pendingBillingCount > 0 ? (
            <span className="ml-1.5 rounded-md bg-background/20 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
              {pendingBillingCount}
            </span>
          ) : null}
        </Button>
      </div>

      {accountsNotice ? (
        <div
          role="status"
          className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950"
        >
          {accountsNotice}
        </div>
      ) : null}

      <p className="text-sm text-muted-foreground">
        Delivery challan = item delivered without taking a bill.
        {tab === "billing" ? (
          <>
            {" "}
            Billing stays <span className="font-medium text-foreground">Pending</span> until
            Accounts completes invoice details in My Jobs.
          </>
        ) : null}
      </p>

      {pdfError ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {pdfError}
        </div>
      ) : null}

      <PendingGrnQueueCard
        label={tab === "billing" ? "Billing" : "Delivery challans"}
        rows={tableRows}
        isBilling={tab === "billing"}
        billingInvoiceReady={billingInvoiceReady}
        pdfBusyId={pdfBusyId}
        invoiceBusyId={invoiceBusyId}
        onDownloadPdf={onDownloadPdf}
        onDownloadBillingPdf={onDownloadBillingInvoicePdf}
        onCreateInvoice={createInvoiceFromChallan}
        emptyLabel={
          tab === "billing" ? "No billing documents." : "No delivery challans."
        }
      />
    </div>
  );
}

function PendingGrnQueueCard({
  label,
  rows,
  isBilling,
  emptyLabel,
  billingInvoiceReady,
  pdfBusyId,
  invoiceBusyId,
  onDownloadPdf,
  onDownloadBillingPdf,
  onCreateInvoice,
}: {
  label: string;
  rows: PendingGrnChallan[];
  isBilling: boolean;
  emptyLabel: string;
  billingInvoiceReady: BillingInvoiceReadyMap;
  pdfBusyId: string | null;
  invoiceBusyId: string | null;
  onDownloadPdf: (challan: DeliveryChallanRecord) => void | Promise<void>;
  onDownloadBillingPdf: (
    row: PendingGrnChallan,
    meta: BillingInvoiceReadyMap[string] | undefined,
  ) => void | Promise<void>;
  onCreateInvoice: (challan: DeliveryChallanRecord) => void | Promise<void>;
}) {
  const router = useRouter();

  return (
    <div className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </h2>
      <div className={procurementUi.tableShell} aria-label={label}>
        <div className={procurementUi.tableScroll}>
          <table className={cn(procurementUi.table, isBilling ? "min-w-[1100px]" : "min-w-[980px]")}>
            <thead className={procurementUi.thead}>
              <tr>
                <th className={procurementUi.th}>{isBilling ? "Invoice number" : "Challan number"}</th>
                <th className={procurementUi.th}>{isBilling ? "Invoice date" : "Challan date"}</th>
                <th className={procurementUi.th}>
                  {isBilling ? "Company PO number" : "PO number"}
                </th>
                {isBilling ? (
                  <>
                    <th className={procurementUi.th}>Items</th>
                    <th className={procurementUi.th}>Qty</th>
                    <th className={procurementUi.th}>Amount</th>
                  </>
                ) : null}
                <th className={procurementUi.th}>Vendor name</th>
                <th className={procurementUi.th}>Customer name</th>
                <th className={procurementUi.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={isBilling ? 9 : 6} className={procurementUi.empty}>
                    {emptyLabel}
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const isSaved = row.status === "saved";
                  const invoiceMeta = billingInvoiceReady[row.id];
                  const canOpen = isSaved || !isBilling || Boolean(invoiceMeta?.ready);
                  const savedChallan =
                    isSaved && row.savedRecordId ? getDeliveryChallan(row.savedRecordId) : null;
                  const openDispatch = Boolean(savedChallan) && !isBilling;
                  const billingDispatchId = isBilling
                    ? resolveBillingDispatchChallanId(
                        row,
                        invoiceMeta?.invoiceNumber || row.docNumber,
                      )
                    : null;
                  const href = isBilling
                    ? billingDispatchId
                      ? deliveryStatusUpdateHref(billingDispatchId)
                      : "/procurement/delivery-status"
                    : openDispatch && savedChallan
                      ? deliveryStatusUpdateHref(savedChallan.id)
                      : isSaved && row.savedRecordId
                        ? `/procurement/delivery-challan/${row.savedRecordId}`
                        : pendingGrnChallanHref(row);
                  const displayInvoiceNumber =
                    row.docNumber ||
                    invoiceMeta?.invoiceNumber ||
                    "-";
                  const displayInvoiceDate =
                    row.docDate ||
                    invoiceMeta?.invoiceDate ||
                    "-";
                  const rawItems =
                    invoiceMeta?.itemsSummary ||
                    row.itemsSummary?.trim() ||
                    "-";
                  const displayItems =
                    rawItems === "-"
                      ? "-"
                      : stripQuoteTag(rawItems.replace(/\s*\(\d+(?:\.\d+)?\)/g, "")) || rawItems;
                  const billingPdfBusy = pdfBusyId === `billing:${row.id}`;
                  const pdfBusy = Boolean(savedChallan && pdfBusyId === savedChallan.id);
                  const billingDispatched = Boolean(
                    billingDispatchId && challanWasDispatched(billingDispatchId),
                  );
                  const goBillingDispatch = () => {
                    if (!canOpen || !isBilling) return;
                    const challanId = ensureBillingDispatchChallan(
                      row,
                      invoiceMeta || { ready: true },
                    );
                    router.push(deliveryStatusUpdateHref(challanId));
                  };
                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        procurementUi.tr,
                        canOpen
                          ? "cursor-pointer"
                          : "cursor-default opacity-95",
                      )}
                      role={canOpen ? "link" : undefined}
                      tabIndex={canOpen ? 0 : undefined}
                      onClick={() => {
                        if (!canOpen) return;
                        if (isBilling) {
                          goBillingDispatch();
                          return;
                        }
                        router.push(href);
                      }}
                      onKeyDown={(e) => {
                        if (!canOpen) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          if (isBilling) {
                            goBillingDispatch();
                            return;
                          }
                          router.push(href);
                        }
                      }}
                    >
                      <td className={cn(procurementUi.td, "font-medium tabular-nums", isSaved || canOpen ? "text-foreground" : "text-muted-foreground")}>
                        {isBilling ? displayInvoiceNumber : row.docNumber || "-"}
                      </td>
                      <td className={cn(procurementUi.tdNumeric, "text-muted-foreground")}>
                        {isBilling ? displayInvoiceDate : row.docDate || "-"}
                      </td>
                      <td className={cn(procurementUi.td, "max-w-[180px] font-medium tabular-nums")}>
                        {formatUniquePoLabels(row.purchaseOrderNumber)}
                      </td>
                      {isBilling ? (
                        <>
                          <td className={cn(procurementUi.td, "max-w-[220px]")}>
                            <span className="line-clamp-2" title={displayItems}>
                              {displayItems}
                            </span>
                          </td>
                          <td className={cn(procurementUi.tdNumeric, "tabular-nums")}>
                            {formatBillingQty(invoiceMeta?.quantity)}
                          </td>
                          <td className={cn(procurementUi.tdNumeric, "tabular-nums")}>
                            {formatBillingAmount(invoiceMeta?.amount)}
                          </td>
                        </>
                      ) : null}
                      <td className={procurementUi.tdMuted}>{row.vendorName || "-"}</td>
                      <td className={procurementUi.td}>{row.customerName?.trim() || "-"}</td>
                      <td className={procurementUi.td} onClick={(e) => e.stopPropagation()}>
                        <div className={procurementUi.rowActions}>
                          {canOpen ? (
                            isBilling ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className={cn(
                                  procurementUi.actionBtn,
                                  "cursor-pointer text-[#0369A1] hover:text-[#0369A1]",
                                )}
                                title="Open Delivery Status to set dispatch"
                                onClick={goBillingDispatch}
                              >
                                {billingDispatched ? "Update status" : "Open"}
                              </Button>
                            ) : (
                              <Link
                                href={href}
                                className={cn(
                                  buttonVariants({ size: "sm", variant: "ghost" }),
                                  procurementUi.actionBtn,
                                  "text-[#0369A1] hover:text-[#0369A1]",
                                )}
                              >
                                {openDispatch
                                  ? savedChallan && challanWasDispatched(savedChallan.id)
                                    ? "Update status"
                                    : "Set dispatch"
                                  : "Open"}
                              </Link>
                            )
                          ) : (
                            <span
                              className="inline-flex h-8 items-center px-2 text-xs font-medium text-muted-foreground"
                              title="Waiting for Accounts to submit invoice details in My Jobs"
                            >
                              Pending
                            </span>
                          )}
                          {savedChallan &&
                          !isBilling &&
                          challanWasDispatched(savedChallan.id) &&
                          !invoiceAlreadyCreatedForChallan(savedChallan) ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={invoiceBusyId === savedChallan.id}
                              className={cn(
                                procurementUi.actionBtn,
                                "cursor-pointer text-[#0369A1] hover:text-[#0369A1]",
                              )}
                              title="Create an invoice for this dispatched delivery challan"
                              onClick={() => void onCreateInvoice(savedChallan)}
                            >
                              <Receipt className="mr-1 size-3.5" />
                              {invoiceBusyId === savedChallan.id ? "Creating…" : "Create invoice"}
                            </Button>
                          ) : null}
                          {isBilling && canOpen ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={billingPdfBusy}
                              className={cn(
                                procurementUi.actionBtn,
                                "cursor-pointer text-[#0369A1] hover:text-[#0369A1]",
                              )}
                              title="Download the invoice document attached in My Jobs"
                              aria-label={`Download invoice document for ${displayInvoiceNumber}`}
                              onClick={() => void onDownloadBillingPdf(row, invoiceMeta)}
                            >
                              <FileDown className="mr-1 size-3.5" />
                              {billingPdfBusy ? "…" : "Billing PDF"}
                            </Button>
                          ) : null}
                          {!isBilling && savedChallan ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={pdfBusy}
                              className={cn(
                                procurementUi.actionBtn,
                                "cursor-pointer text-[#0369A1] hover:text-[#0369A1]",
                              )}
                              title="Download DC PDF"
                              aria-label={`Download DC PDF for ${row.docNumber || savedChallan.challanNumber}`}
                              onClick={() => void onDownloadPdf(savedChallan)}
                            >
                              <FileDown className="mr-1 size-3.5" />
                              {pdfBusy ? "…" : "DC PDF"}
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
