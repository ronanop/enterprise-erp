"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckCircle2,
  Circle,
  FileDown,
  FileText,
  MailCheck,
  Package,
  PackageCheck,
  Receipt,
  Send,
  Truck,
  TriangleAlert,
  Upload,
  XCircle,
} from "lucide-react";

import { DeliveryCorrespondencePanel } from "@/components/procurement/delivery-correspondence-panel";
import {
  ShipInventoryLinePicker,
  type InventoryLineSelection,
} from "@/components/procurement/ship-inventory-line-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";
import {
  consumeProcurementInventoryUnits,
  createInvoiceGenerationTasks,
  createScmVendorDispatch,
  getPurchaseOrder,
  getScmOrderFulfillment,
  listOrderReceiptBatches,
  listProcurementInventory,
  listVendorOptions,
  recordScmVendorResponse,
  sendScmCustomerOrderProcessed,
  sendScmPoToVendor,
  shareScmCustomerDispatch,
  updateLineReceipt,
  uploadScmCustomerPod,
  upsertScmCustomerDelivery,
  type ProcOrder,
  type ProcurementInventoryRow,
  type ScmFulfillmentLineState,
  type ScmFulfillmentState,
  type ScmReceiptBatch,
  type ScmVendorDispatch,
} from "@/services/procurement-service";
import { addPendingGrnChallan } from "@/utils/grn-challan-pending";
import { downloadBatchGrnPdf } from "@/utils/grn-batch-pdf-download";
import {
  buildGrnPoInventoryShipLines,
  poGrnStockChallanHref,
  poGrnStockSourceKey,
  setPoGrnPendingShipSelection,
  setPoGrnStockShipSelection,
  type OvfShipDocumentKind,
} from "@/utils/ovf-stock";

function dateOnly(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : "";
}

function displayDate(value: string | null | undefined): string {
  const raw = dateOnly(value);
  return raw || "—";
}

type VendorDecisionChoice = "accepted" | "rejected";

function vendorDecisionKey(orderId: string): string {
  return `erp.po-vendor-decision:${orderId}`;
}

/** Keeps the chosen Accept / Reject branch across page refreshes. */
function readVendorDecisionChoice(orderId: string): VendorDecisionChoice | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(vendorDecisionKey(orderId));
    return raw === "accepted" || raw === "rejected" ? raw : null;
  } catch {
    return null;
  }
}

function writeVendorDecisionChoice(orderId: string, choice: VendorDecisionChoice | null) {
  if (typeof window === "undefined") return;
  try {
    if (choice) window.localStorage.setItem(vendorDecisionKey(orderId), choice);
    else window.localStorage.removeItem(vendorDecisionKey(orderId));
  } catch {
    /* storage unavailable */
  }
}

/** Calendar add that stays on the local date. Avoids UTC shifting the day. */
function addCalendarDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mm}-${dd}`;
}

type DispatchDocRef = { file_name?: string; content_base64?: string };

function asDispatchDoc(raw: unknown): DispatchDocRef | null {
  if (!raw || typeof raw !== "object") return null;
  const doc = raw as DispatchDocRef;
  if (!(doc.file_name || "").trim() && !(doc.content_base64 || "").trim()) return null;
  return doc;
}

function downloadDispatchDoc(doc: DispatchDocRef, fallbackName: string) {
  const b64 = (doc.content_base64 || "").trim();
  if (!b64 || typeof window === "undefined") return;
  const name = (doc.file_name || "").trim() || fallbackName;
  const a = document.createElement("a");
  a.href = `data:application/octet-stream;base64,${b64}`;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function dispatchDocEntries(dispatch: ScmVendorDispatch): {
  key: string;
  label: string;
  doc: DispatchDocRef;
}[] {
  const refs =
    dispatch.attachment_refs && !Array.isArray(dispatch.attachment_refs)
      ? dispatch.attachment_refs
      : {};
  const out: { key: string; label: string; doc: DispatchDocRef }[] = [];
  for (const [key, label] of [
    ["dc", "Delivery challan"],
    ["invoice", "Vendor invoice"],
    ["lr_awb", "LR / AWB"],
  ] as const) {
    const doc = asDispatchDoc(refs[key]);
    if (doc) out.push({ key, label, doc });
  }
  return out;
}

const STEPS: { id: string; label: string; stages: string[] }[] = [
  {
    id: "send",
    label: "Send PO",
    stages: ["awaiting_vendor_send"],
  },
  {
    id: "vendor",
    label: "Vendor response",
    stages: ["awaiting_vendor_response", "vendor_rejected", "vendor_accepted"],
  },
  {
    id: "customer_mail",
    label: "Customer EDD mail",
    stages: ["vendor_accepted"],
  },
  {
    id: "dispatch",
    label: "Vendor dispatch",
    stages: ["customer_notified", "vendor_dispatch_recorded"],
  },
  {
    id: "grn",
    label: "GRN",
    stages: ["vendor_dispatch_recorded", "grn_in_stock", "customer_delivery_ready"],
  },
  {
    id: "delivery",
    label: "Customer delivery",
    stages: ["customer_delivery_ready", "customer_dispatched", "delivered"],
  },
];

function stageIndex(stage: string | null | undefined): number {
  const s = stage || "awaiting_vendor_send";
  if (s === "vendor_rejected") return 1;
  if (s === "delivered") return STEPS.length;
  if (s === "customer_dispatched") return 5;
  if (s === "customer_delivery_ready" || s === "grn_in_stock") return 4;
  if (s === "vendor_dispatch_recorded") return 3;
  if (s === "customer_notified") return 3;
  if (s === "vendor_accepted") return 2;
  if (s === "awaiting_vendor_response") return 1;
  return 0;
}

type Props = {
  order: ProcOrder;
  isAdmin: boolean;
  onSaved: () => void;
};

export function PoFulfillmentPanel({ order, isAdmin, onSaved }: Props) {
  const router = useRouter();
  const [state, setState] = useState<ScmFulfillmentState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [correspondenceKey, setCorrespondenceKey] = useState(0);

  const [vendorEmail, setVendorEmail] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [vendorDecision, setVendorDecision] = useState<"accepted" | "rejected" | null>(null);
  const [vendorEdd, setVendorEdd] = useState("");
  const [rejectRemark, setRejectRemark] = useState("");
  const [dcNumber, setDcNumber] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [lrAwb, setLrAwb] = useState("");
  const [dcDoc, setDcDoc] = useState<{ file_name: string; content_base64: string } | null>(
    null,
  );
  const [invoiceDoc, setInvoiceDoc] = useState<{
    file_name: string;
    content_base64: string;
  } | null>(null);
  const [lrDoc, setLrDoc] = useState<{ file_name: string; content_base64: string } | null>(
    null,
  );
  const [dispatchDate, setDispatchDate] = useState("");
  const [ewayNotes, setEwayNotes] = useState("");
  const [transportNotes, setTransportNotes] = useState("");
  const [dispatchQtys, setDispatchQtys] = useState<Record<string, string>>({});
  const [dispatchFormKey, setDispatchFormKey] = useState(0);
  const [grnBusyId, setGrnBusyId] = useState<string | null>(null);
  const [receiptBatches, setReceiptBatches] = useState<ScmReceiptBatch[]>([]);
  const [grnPdfBusyKey, setGrnPdfBusyKey] = useState<string | null>(null);
  const [vendorLabel, setVendorLabel] = useState<string>("");
  const [poInventoryRows, setPoInventoryRows] = useState<ProcurementInventoryRow[]>([]);
  const [poInventoryLoading, setPoInventoryLoading] = useState(false);
  const [shipKind, setShipKind] = useState<OvfShipDocumentKind>("delivery_challan");
  const [inventorySelection, setInventorySelection] = useState<InventoryLineSelection>({});
  const [shipBusy, setShipBusy] = useState(false);

  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [instructions, setInstructions] = useState("");
  const [docTaxInvoice, setDocTaxInvoice] = useState(true);
  const [docDc, setDocDc] = useState(false);
  const [docEway, setDocEway] = useState(false);
  const [docPacking, setDocPacking] = useState(false);
  const [transporter, setTransporter] = useState("");
  const [custLr, setCustLr] = useState("");
  const [custInvoice, setCustInvoice] = useState("");
  const [custDc, setCustDc] = useState("");
  const [custEdd, setCustEdd] = useState("");
  const [podNote, setPodNote] = useState("");
  const [podFileName, setPodFileName] = useState<string | null>(null);
  const [podBase64, setPodBase64] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [row, batches] = await Promise.all([
        getScmOrderFulfillment(order.id),
        listOrderReceiptBatches(order.id).catch(() => [] as ScmReceiptBatch[]),
      ]);
      setState(row);
      setReceiptBatches(batches);
      setVendorEmail((row.vendor_email || "").trim());
      setCustomerEmail((row.customer_email || "").trim());
      setVendorEdd(dateOnly(row.expected_delivery_date));
      setVendorLabel((row.vendor_name || "").trim());
      if (row.fulfillment_stage === "awaiting_vendor_response") {
        setVendorDecision(readVendorDecisionChoice(order.id));
      }
      const meta = row.customer_delivery_meta || {};
      setDeliveryAddress(String(meta.delivery_address || ""));
      setContactName(String(meta.contact_name || ""));
      setContactPhone(String(meta.contact_phone || ""));
      setDeliveryDate(dateOnly(String(meta.delivery_date || "")));
      setDeliveryTime(String(meta.delivery_time || ""));
      setInstructions(String(meta.instructions || ""));
      setDocTaxInvoice(meta.doc_tax_invoice !== false);
      setDocDc(Boolean(meta.doc_delivery_challan));
      setDocEway(Boolean(meta.doc_eway));
      setDocPacking(Boolean(meta.doc_packing_list));
      setTransporter(String(meta.transporter_name || ""));
      setCustLr(String(meta.lr_awb || ""));
      setCustInvoice(String(meta.invoice_number || ""));
      setCustDc(String(meta.dc_number || ""));
      setCustEdd(dateOnly(String(meta.customer_edd || row.customer_promised_delivery_date || "")));
      const nextQtys: Record<string, string> = {};
      for (const ln of row.lines) {
        nextQtys[ln.order_line_id] =
          ln.remaining_to_dispatch > 0 ? String(ln.remaining_to_dispatch) : "0";
      }
      setDispatchQtys(nextQtys);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to load fulfillment state",
      );
    } finally {
      setLoading(false);
    }
  }, [order.id]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!order.vendor_id) return;
      try {
        const vendors = await listVendorOptions();
        if (cancelled) return;
        const match = vendors.find((v) => v.id === order.vendor_id);
        if (match?.label) setVendorLabel(match.label);
      } catch {
        /* keep fulfillment vendor_name */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [order.vendor_id]);

  useEffect(() => {
    void load();
  }, [load, order.fulfillment_stage, order.version]);

  const stage = state?.fulfillment_stage || order.fulfillment_stage || "awaiting_vendor_send";
  const activeIdx = stageIndex(stage);
  const rejected = stage === "vendor_rejected";
  const hasRemainingToDispatch = (state?.lines || []).some(
    (ln) => Number(ln.remaining_to_dispatch || 0) > 1e-9,
  );
  const allWavesGrnDone =
    (state?.dispatches || []).length > 0 &&
    (state?.dispatches || []).every((d) => (d.grn_status || "").toLowerCase() === "done");
  const hasAnyWaveGrn = (state?.dispatches || []).some((d) => {
    const status = (d.grn_status || "").toLowerCase();
    return status === "done" || status === "partial" || Number(d.grn_received_qty ?? 0) > 0;
  });
  const inventoryShipLineOptions = useMemo(
    () => buildGrnPoInventoryShipLines(poInventoryRows, [order.id]),
    [poInventoryRows, order.id],
  );
  const hasSelectedInventoryShipLines = inventoryShipLineOptions.some(
    (line) =>
      inventorySelection[line.id]?.selected && (inventorySelection[line.id]?.qty ?? 0) > 0,
  );

  useEffect(() => {
    if (!hasAnyWaveGrn) {
      setPoInventoryRows([]);
      return;
    }
    let cancelled = false;
    setPoInventoryLoading(true);
    void listProcurementInventory()
      .then((rows) => {
        if (!cancelled) setPoInventoryRows(rows);
      })
      .catch(() => {
        if (!cancelled) setPoInventoryRows([]);
      })
      .finally(() => {
        if (!cancelled) setPoInventoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hasAnyWaveGrn, order.id, order.version, state?.dispatches]);

  useEffect(() => {
    if (!hasAnyWaveGrn) return;
    setInventorySelection((prev) => {
      const next: InventoryLineSelection = { ...prev };
      let changed = false;
      for (const line of inventoryShipLineOptions) {
        if (!next[line.id]) {
          next[line.id] = { selected: true, qty: line.max_qty };
          changed = true;
          continue;
        }
        const clampedQty = Math.min(next[line.id].qty, line.max_qty);
        if (clampedQty !== next[line.id].qty) {
          next[line.id] = { ...next[line.id], qty: clampedQty };
          changed = true;
        }
      }
      for (const id of Object.keys(next)) {
        if (!inventoryShipLineOptions.some((line) => line.id === id)) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [hasAnyWaveGrn, inventoryShipLineOptions]);

  async function continueBillingOrDc() {
    if (!hasSelectedInventoryShipLines || shipBusy) return;
    setShipBusy(true);
    setError(null);
    setNotice(null);
    try {
      const selectedLines = inventoryShipLineOptions
        .filter(
          (line) =>
            inventorySelection[line.id]?.selected &&
            (inventorySelection[line.id]?.qty ?? 0) > 0,
        )
        .map((line) => {
          const qty = Math.min(inventorySelection[line.id].qty, line.max_qty);
          const unitIds = (line.stock_unit_ids || []).slice(0, Math.max(1, Math.ceil(qty)));
          return {
            id: line.id,
            source: line.source,
            product_name: line.product_name,
            qty,
            stock_unit_id: unitIds[0] || line.stock_unit_id,
            stock_unit_ids: unitIds,
            serial_number: null as string | null,
            grn_number: line.grn_number,
            unit_cost: line.unit_cost,
          };
        });
      const stockUnitIds = [
        ...new Set(selectedLines.flatMap((line) => line.stock_unit_ids || []).filter(Boolean)),
      ];
      if (stockUnitIds.length > 0) {
        await consumeProcurementInventoryUnits(stockUnitIds, order.company_id || null);
      }

      const itemsSummary = selectedLines
        .map((line) => {
          const qty = Number.isInteger(line.qty)
            ? String(line.qty)
            : String(Math.round(line.qty * 1e6) / 1e6);
          return `${line.product_name} (${qty})`;
        })
        .join(", ")
        .slice(0, 500);
      const grnNumbers = [
        ...new Set(
          selectedLines.map((line) => (line.grn_number || "").trim()).filter(Boolean),
        ),
      ];
      const batchKey = poGrnStockSourceKey(order.id, crypto.randomUUID());
      addPendingGrnChallan({
        orderId: order.id,
        batchKey,
        grnNumber: grnNumbers.join(", ") || "-",
        purchaseOrderNumber:
          order.company_po_number?.trim() || order.document_number?.trim() || "",
        vendorName: (vendorLabel || state?.vendor_name || "").trim(),
        customerName: (order.customer_name || "").trim(),
        itemsSummary: itemsSummary || "-",
        kind: shipKind,
        source: "po_grn_stock",
      });

      const shipSelection = {
        order_id: order.id,
        lines: selectedLines.map(({ stock_unit_ids: _ids, ...line }) => line),
      };
      setPoGrnStockShipSelection(shipSelection);
      setPoGrnPendingShipSelection(batchKey, shipSelection);

      if (shipKind === "billing") {
        // One My Jobs invoice task for this selection — not one task per GRN wave.
        const selectedUnitIdSet = new Set(stockUnitIds.map(String));
        const selectedInventory = poInventoryRows.filter(
          (row) => row.stock_unit_id && selectedUnitIdSet.has(String(row.stock_unit_id)),
        );
        let anchorBatchId =
          selectedInventory
            .map((row) => (row.receipt_batch_id || "").trim())
            .find(Boolean) || "";
        if (!anchorBatchId && grnNumbers.length > 0) {
          const grnSet = new Set(grnNumbers);
          anchorBatchId =
            receiptBatches
              .filter((batch) => grnSet.has(String(batch.grn_number || "").trim()))
              .map((batch) => String(batch.id || "").trim())
              .find(Boolean) || "";
        }
        if (!anchorBatchId) {
          anchorBatchId =
            receiptBatches
              .map((batch) => String(batch.id || "").trim())
              .find(Boolean) || "";
        }

        const selectionQty = selectedLines.reduce(
          (sum, line) => sum + (Number(line.qty) || 0),
          0,
        );
        const selectionAmount = selectedLines.reduce((sum, line) => {
          const qty = Number(line.qty) || 0;
          const unit = Number(line.unit_cost) || 0;
          return sum + qty * unit;
        }, 0);
        const selectionGrnLabel = [
          ...new Set(
            selectedInventory
              .map((row) => (row.grn_number || "").trim())
              .filter(Boolean)
              .concat(grnNumbers),
          ),
        ].join(", ");

        let invoiceNotifyError: string | null = null;
        if (!anchorBatchId) {
          invoiceNotifyError = "No GRN receipt batch found to start invoice generation.";
        } else {
          try {
            await createInvoiceGenerationTasks({
              order_id: order.id,
              receipt_batch_id: anchorBatchId,
              items_summary: itemsSummary,
              vendor_name: vendorLabel || state?.vendor_name || "",
              customer_name: order.customer_name || "",
              grn_number: selectionGrnLabel,
              billing_quantity: selectionQty,
              billing_amount: Math.round(selectionAmount * 100) / 100,
            });
          } catch (notifyErr) {
            invoiceNotifyError =
              notifyErr instanceof ApiClientError
                ? [notifyErr.message, ...notifyErr.errors].filter(Boolean).join(" - ")
                : notifyErr instanceof Error && notifyErr.message.trim()
                  ? notifyErr.message
                  : "Could not notify Accounts";
          }
        }
        try {
          sessionStorage.setItem(
            "erp.procurement.accounts-invoice-notified",
            invoiceNotifyError
              ? `Billing queued, but Accounts was not notified: ${invoiceNotifyError}`
              : "Accounts was notified to fill invoice number, date, quantity, and amount in My Jobs.",
          );
        } catch {
          /* ignore */
        }
        if (invoiceNotifyError) {
          setError(`Billing queued, but Accounts was not notified: ${invoiceNotifyError}`);
        }
      }

      // Refresh local stock so picker hides consumed units if user navigates back.
      const rows = await listProcurementInventory().catch(() => [] as ProcurementInventoryRow[]);
      setPoInventoryRows(rows);

      router.push(
        poGrnStockChallanHref(
          order.id,
          shipKind,
          "/procurement/delivery-challan",
          order.source_document_id || null,
          batchKey,
        ),
      );
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Failed to continue to billing / delivery challan",
      );
      setShipBusy(false);
    }
  }

  async function recordWaveGrn(dispatch: ScmVendorDispatch) {
    setGrnBusyId(dispatch.id);
    setError(null);
    setNotice(null);
    try {
      let po = await getPurchaseOrder(order.id);
      const lineById = new Map((po.lines || []).map((ln) => [ln.id, ln]));
      let any = false;
      for (const dln of dispatch.lines || []) {
        const rem = Number(dln.grn_remaining_qty ?? 0);
        if (!(rem > 1e-9)) continue;
        const line = lineById.get(dln.order_line_id);
        if (!line) continue;
        const saved = Number(line.quantity_received ?? 0);
        const ordered = Number(line.quantity) || 0;
        const next = Math.min(ordered, saved + rem);
        const delta = next - saved;
        if (!(delta > 1e-9)) continue;
        const units = Math.floor(delta + 1e-9);
        const serials = units > 0 ? Array.from({ length: units }, () => "NA") : [];
        // Receive into inventory first. Billing / DC happen later from stock.
        po = await updateLineReceipt(po.id, line.id, {
          quantity_received: next,
          grn_status: next + 1e-9 >= ordered ? "delivered" : "partial",
          serial_numbers: serials,
          billing: false,
          billing_quantity: 0,
          delivery_challan_quantity: 0,
          vendor_dispatch_id: dispatch.id,
        });
        any = true;
        for (const ln of po.lines || []) {
          lineById.set(ln.id, ln);
        }
      }
      if (!any) {
        setError("Nothing left to GRN on this dispatch wave");
        return;
      }
      await load();
      onSaved();
      setNotice(
        `GRN recorded for dispatch wave #${dispatch.sequence} — units added to inventory.`,
      );
      setCorrespondenceKey((k) => k + 1);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Failed to record GRN for this dispatch wave",
      );
    } finally {
      setGrnBusyId(null);
    }
  }

  const statusBadge = useMemo(() => {
    if (rejected) {
      return (
        <Badge className="rounded-full border-transparent bg-red-100 px-2.5 py-0.5 text-[11px] font-semibold text-red-800">
          Vendor rejected
        </Badge>
      );
    }
    if (stage === "delivered") {
      return (
        <Badge className="rounded-full border-transparent bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
          Delivered
        </Badge>
      );
    }
    return (
      <Badge className="rounded-full border-transparent bg-sky-100 px-2.5 py-0.5 text-[11px] font-semibold text-sky-900">
        {STEPS[Math.min(activeIdx, STEPS.length - 1)]?.label || "Fulfillment"}
      </Badge>
    );
  }, [activeIdx, rejected, stage]);

  function qtyDefaultsFromLines(lines: ScmFulfillmentLineState[]): Record<string, string> {
    const next: Record<string, string> = {};
    for (const ln of lines) {
      next[ln.order_line_id] =
        ln.remaining_to_dispatch > 0 ? String(ln.remaining_to_dispatch) : "0";
    }
    return next;
  }

  function resetVendorDispatchForm(lines?: ScmFulfillmentLineState[]) {
    setDcNumber("");
    setInvoiceNumber("");
    setLrAwb("");
    setDcDoc(null);
    setInvoiceDoc(null);
    setLrDoc(null);
    setDispatchDate("");
    setEwayNotes("");
    setTransportNotes("");
    setDispatchFormKey((k) => k + 1);
    setDispatchQtys(qtyDefaultsFromLines(lines || state?.lines || []));
  }

  async function runAction(label: string, fn: () => Promise<ScmFulfillmentState>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const row = await fn();
      setState(row);
      setNotice(label);
      setCorrespondenceKey((k) => k + 1);
      onSaved();
      return row;
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : label);
      return null;
    } finally {
      setBusy(false);
    }
  }

  function readFileAsDoc(
    file: File | null,
    onReady: (doc: { file_name: string; content_base64: string } | null) => void,
  ) {
    if (!file) {
      onReady(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const b64 = result.includes(",") ? result.split(",")[1] : result;
      if (!b64) {
        onReady(null);
        return;
      }
      onReady({ file_name: file.name, content_base64: b64 });
    };
    reader.readAsDataURL(file);
  }

  function onPodFile(file: File | null) {
    if (!file) {
      setPodFileName(null);
      setPodBase64(null);
      return;
    }
    readFileAsDoc(file, (doc) => {
      setPodFileName(doc?.file_name ?? null);
      setPodBase64(doc?.content_base64 ?? null);
    });
  }

  function clampReceivedQty(raw: string, maxQty: number): string {
    if (raw.trim() === "") return "";
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return "0";
    if (n > maxQty) return String(maxQty);
    return raw;
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-[0_1px_3px_0_rgba(0,0,0,0.03)]">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 bg-muted/30 px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Truck className="size-4" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight text-foreground sm:text-base">
              Fulfillment
            </h2>
            <p className="mt-0.5 max-w-xl text-xs leading-relaxed text-muted-foreground">
              Send PO to vendor, capture response, notify customer, record dispatch, GRN into
              stock, then customer delivery and POD.
            </p>
          </div>
        </div>
        {statusBadge}
      </header>

      <div className="space-y-4 p-4 sm:p-5">
        {error ? (
          <p
            role="alert"
            className="flex items-center gap-1.5 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive"
          >
            <TriangleAlert className="size-3.5 shrink-0" aria-hidden /> {error}
          </p>
        ) : null}
        {notice ? (
          <p
            role="status"
            className="flex items-center gap-1.5 rounded-lg border border-emerald-200/80 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800"
          >
            <MailCheck className="size-3.5 shrink-0" aria-hidden /> {notice}
          </p>
        ) : null}

        <ol className="flex flex-wrap gap-2">
          {STEPS.map((step, idx) => {
            const done = !rejected && activeIdx > idx;
            const current = !rejected && activeIdx === idx;
            const failed = rejected && idx === 1;
            return (
              <li
                key={step.id}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors duration-200 ${failed
                  ? "border-red-200 bg-red-50 text-red-800"
                  : done
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : current
                      ? "border-sky-200 bg-sky-50 text-sky-900"
                      : "border-border/70 bg-muted/30 text-muted-foreground"
                  }`}
              >
                {failed ? (
                  <XCircle className="size-3.5" aria-hidden />
                ) : done ? (
                  <CheckCircle2 className="size-3.5" aria-hidden />
                ) : current ? (
                  <Package className="size-3.5" aria-hidden />
                ) : (
                  <Circle className="size-3.5" aria-hidden />
                )}
                {step.label}
              </li>
            );
          })}
        </ol>

        {loading && !state ? (
          <p className="text-xs text-muted-foreground">Loading fulfillment…</p>
        ) : null}

        {/* Step 1: Send PO */}
        {stage === "awaiting_vendor_send" ? (
          <div className="space-y-3 rounded-xl border border-border/70 bg-background p-3.5 sm:p-4">
            <h3 className="text-xs font-semibold tracking-tight text-foreground">
              Send PO to vendor
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Emails the purchase order PDF to the vendor and starts the acceptance wait.
            </p>
            <label className="block space-y-1.5">
              <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Vendor email
              </span>
              <Input
                type="email"
                value={vendorEmail}
                onChange={(e) => setVendorEmail(e.target.value)}
                disabled={busy}
                className="h-9 cursor-text text-[13px] transition-colors duration-200"
              />
            </label>
            <Button
              type="button"
              size="sm"
              disabled={busy || !vendorEmail.trim()}
              className="h-9 cursor-pointer transition-colors duration-200"
              onClick={() =>
                void runAction("PO emailed to vendor", () =>
                  sendScmPoToVendor(order.id, { email: vendorEmail.trim() }),
                )
              }
            >
              <Send className="mr-1.5 size-3.5" aria-hidden />
              Send PO to vendor
            </Button>
          </div>
        ) : null}

        {/* Step 2: Vendor response → Accept (EDD + customer mail) or Reject (remark) */}
        {stage === "awaiting_vendor_response" ? (
          <div className="space-y-3 rounded-xl border border-border/70 bg-background p-3.5 sm:p-4">
            <h3 className="text-xs font-semibold tracking-tight text-foreground">
              Vendor response
            </h3>
            <p className="text-[11px] text-muted-foreground">
              PO sent {displayDate(state?.po_sent_to_vendor_at)}. Choose accept or reject.
            </p>
            <div className="flex flex-wrap gap-2">
              {vendorDecision !== "rejected" ? (
                <Button
                  type="button"
                  size="sm"
                  variant={vendorDecision === "accepted" ? "default" : "outline"}
                  disabled={busy}
                  className="h-9 cursor-pointer transition-colors duration-200"
                  onClick={() => {
                    setVendorDecision("accepted");
                    writeVendorDecisionChoice(order.id, "accepted");
                    setError(null);
                    setNotice(null);
                  }}
                >
                  <Check className="mr-1.5 size-3.5" aria-hidden />
                  Accept
                </Button>
              ) : null}
              {vendorDecision !== "accepted" ? (
                <Button
                  type="button"
                  size="sm"
                  variant={vendorDecision === "rejected" ? "default" : "outline"}
                  disabled={busy}
                  className="h-9 cursor-pointer transition-colors duration-200"
                  onClick={() => {
                    setVendorDecision("rejected");
                    writeVendorDecisionChoice(order.id, "rejected");
                    setError(null);
                    setNotice(null);
                  }}
                >
                  <XCircle className="mr-1.5 size-3.5" aria-hidden />
                  Reject
                </Button>
              ) : null}
            </div>

            {vendorDecision === "accepted" ? (
              <div className="space-y-3 rounded-lg border border-border/60 bg-muted/10 p-3">
                <p className="text-[11px] text-muted-foreground">
                  Enter the vendor EDD. Customer EDD is that date plus 4 days, and that Customer
                  EDD is the date in the customer mail. Sending the mail does not change it.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                      Vendor EDD
                    </span>
                    <Input
                      type="date"
                      value={vendorEdd}
                      onChange={(e) => setVendorEdd(e.target.value)}
                      disabled={busy}
                      className="h-9 cursor-pointer text-[13px] transition-colors duration-200"
                    />
                  </label>
                  <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
                    <dt className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                      Customer EDD
                    </dt>
                    <dd className="mt-1 text-sm font-semibold tabular-nums text-foreground">
                      {vendorEdd ? addCalendarDays(vendorEdd, 4) : "—"}
                    </dd>
                  </div>
                </div>
                <label className="block space-y-1.5">
                  <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    Customer email
                  </span>
                  <Input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    disabled={busy}
                    placeholder="customer@company.com"
                    className="h-9 cursor-text text-[13px] transition-colors duration-200"
                  />
                </label>
                <Button
                  type="button"
                  size="sm"
                  disabled={busy || !vendorEdd || !customerEmail.trim()}
                  className="h-9 cursor-pointer transition-colors duration-200"
                  onClick={() =>
                    void runAction("Accepted — order-processed mail sent", async () => {
                      await recordScmVendorResponse(order.id, {
                        status: "accepted",
                        expected_delivery_date: vendorEdd,
                      });
                      return sendScmCustomerOrderProcessed(order.id, {
                        email: customerEmail.trim(),
                      });
                    })
                  }
                >
                  <Send className="mr-1.5 size-3.5" aria-hidden />
                  Accept & send customer mail
                </Button>
              </div>
            ) : null}

            {vendorDecision === "rejected" ? (
              <div className="space-y-3 rounded-lg border border-red-200/70 bg-red-50/40 p-3">
                <p className="text-[11px] text-red-900/80">
                  Enter rejection remarks. The PO will stop at vendor rejected.
                </p>
                <label className="block space-y-1.5">
                  <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    Remarks (required)
                  </span>
                  <Textarea
                    value={rejectRemark}
                    onChange={(e) => setRejectRemark(e.target.value)}
                    disabled={busy}
                    rows={3}
                    placeholder="Reason the vendor rejected this PO"
                    className="cursor-text text-[13px] transition-colors duration-200"
                  />
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy || !rejectRemark.trim()}
                  className="h-9 cursor-pointer border-red-300 text-red-800 transition-colors duration-200 hover:bg-red-50"
                  onClick={() =>
                    void runAction("PO rejected by vendor", () =>
                      recordScmVendorResponse(order.id, {
                        status: "rejected",
                        remark: rejectRemark.trim(),
                      }),
                    )
                  }
                >
                  <XCircle className="mr-1.5 size-3.5" aria-hidden />
                  Confirm reject — PO rejected
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {rejected ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-900 sm:p-4">
            <p className="font-semibold">PO got rejected</p>
            <p className="mt-1 whitespace-pre-wrap">
              {state?.vendor_response_remark || "No remarks recorded."}
            </p>
          </div>
        ) : null}

        {/* Fallback if accept saved but customer mail not yet sent */}
        {stage === "vendor_accepted" ? (
          <div className="space-y-3 rounded-xl border border-border/70 bg-background p-3.5 sm:p-4">
            <h3 className="text-xs font-semibold tracking-tight text-foreground">
              Customer order-processed mail
            </h3>
            <dl className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
                <dt className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                  Vendor EDD
                </dt>
                <dd className="mt-1 text-sm font-semibold tabular-nums">
                  {displayDate(state?.expected_delivery_date)}
                </dd>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
                <dt className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                  Customer EDD
                </dt>
                <dd className="mt-1 text-sm font-semibold tabular-nums">
                  {displayDate(state?.customer_promised_delivery_date)}
                </dd>
              </div>
            </dl>
            <label className="block space-y-1.5">
              <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Customer email
              </span>
              <Input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                disabled={busy}
                className="h-9 cursor-text text-[13px] transition-colors duration-200"
              />
            </label>
            <Button
              type="button"
              size="sm"
              disabled={busy || !customerEmail.trim()}
              className="h-9 cursor-pointer transition-colors duration-200"
              onClick={() =>
                void runAction("Order-processed mail sent", () =>
                  sendScmCustomerOrderProcessed(order.id, {
                    email: customerEmail.trim(),
                  }),
                )
              }
            >
              <Send className="mr-1.5 size-3.5" aria-hidden />
              Send customer mail
            </Button>
          </div>
        ) : null}

        {/* Step 4: Vendor dispatch — only while ordered qty remains to dispatch */}
        {hasRemainingToDispatch &&
          (stage === "customer_notified" ||
            stage === "vendor_dispatch_recorded" ||
            stage === "grn_in_stock" ||
            stage === "customer_delivery_ready") ? (
          <div className="space-y-3 rounded-xl border border-border/70 bg-background p-3.5 sm:p-4">
            <h3 className="text-xs font-semibold tracking-tight text-foreground">
              Vendor dispatch
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Partial receipts are allowed. After each wave, docs are saved under Dispatch
              waves and this form resets so the vendor can send the next DC / invoice /
              LR until remaining qty is 0.
            </p>
            <div key={dispatchFormKey} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="space-y-1.5">
                <span className="text-[11px] font-medium text-muted-foreground uppercase">
                  DC number <span className="text-destructive">*</span>
                </span>
                <Input
                  value={dcNumber}
                  onChange={(e) => setDcNumber(e.target.value)}
                  disabled={busy}
                  className="h-9 text-[13px]"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[11px] font-medium text-muted-foreground uppercase">
                  DC document <span className="text-destructive">*</span>
                </span>
                <Input
                  type="file"
                  accept=".pdf,image/*"
                  disabled={busy}
                  className="h-9 cursor-pointer text-[12px]"
                  onChange={(e) =>
                    readFileAsDoc(e.target.files?.[0] || null, setDcDoc)
                  }
                />
                {dcDoc ? (
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {dcDoc.file_name}
                  </span>
                ) : null}
              </label>
              <label className="space-y-1.5">
                <span className="text-[11px] font-medium text-muted-foreground uppercase">
                  Invoice number <span className="text-destructive">*</span>
                </span>
                <Input
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  disabled={busy}
                  className="h-9 text-[13px]"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[11px] font-medium text-muted-foreground uppercase">
                  Invoice document <span className="text-destructive">*</span>
                </span>
                <Input
                  type="file"
                  accept=".pdf,image/*"
                  disabled={busy}
                  className="h-9 cursor-pointer text-[12px]"
                  onChange={(e) =>
                    readFileAsDoc(e.target.files?.[0] || null, setInvoiceDoc)
                  }
                />
                {invoiceDoc ? (
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {invoiceDoc.file_name}
                  </span>
                ) : null}
              </label>
              <label className="space-y-1.5">
                <span className="text-[11px] font-medium text-muted-foreground uppercase">
                  LR / AWB <span className="text-destructive">*</span>
                </span>
                <Input
                  value={lrAwb}
                  onChange={(e) => setLrAwb(e.target.value)}
                  disabled={busy}
                  className="h-9 text-[13px]"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[11px] font-medium text-muted-foreground uppercase">
                  LR / AWB document <span className="text-destructive">*</span>
                </span>
                <Input
                  type="file"
                  accept=".pdf,image/*"
                  disabled={busy}
                  className="h-9 cursor-pointer text-[12px]"
                  onChange={(e) =>
                    readFileAsDoc(e.target.files?.[0] || null, setLrDoc)
                  }
                />
                {lrDoc ? (
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {lrDoc.file_name}
                  </span>
                ) : null}
              </label>
              <label className="space-y-1.5">
                <span className="text-[11px] font-medium text-muted-foreground uppercase">
                  Dispatch date
                </span>
                <Input
                  type="date"
                  value={dispatchDate}
                  onChange={(e) => setDispatchDate(e.target.value)}
                  disabled={busy}
                  className="h-9 cursor-pointer text-[13px]"
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-[11px] font-medium text-muted-foreground uppercase">
                  E-way notes
                </span>
                <Input
                  value={ewayNotes}
                  onChange={(e) => setEwayNotes(e.target.value)}
                  disabled={busy}
                  className="h-9 text-[13px]"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[11px] font-medium text-muted-foreground uppercase">
                  Transport notes
                </span>
                <Input
                  value={transportNotes}
                  onChange={(e) => setTransportNotes(e.target.value)}
                  disabled={busy}
                  className="h-9 text-[13px]"
                />
              </label>
            </div>
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <table className="min-w-full text-left text-[12px]">
                <thead className="bg-muted/40 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                  <tr>
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2 text-right">Ordered</th>
                    <th className="px-3 py-2 text-right">Received qty</th>
                    <th className="px-3 py-2 text-right">Remaining qty</th>
                  </tr>
                </thead>
                <tbody>
                  {(state?.lines || []).map((ln) => {
                    const maxQty = Math.max(0, Number(ln.remaining_to_dispatch) || 0);
                    return (
                      <tr key={ln.order_line_id} className="border-t border-border/50">
                        <td className="px-3 py-2 font-medium text-foreground">
                          {ln.product_name || ln.product_code || ln.order_line_id}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{ln.ordered_qty}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{ln.dispatched_qty}</td>
                        <td className="px-3 py-2 text-right">
                          <Input
                            type="number"
                            min={0}
                            max={maxQty}
                            step="1"
                            value={dispatchQtys[ln.order_line_id] ?? "0"}
                            disabled={busy || maxQty <= 0}
                            onChange={(e) =>
                              setDispatchQtys((prev) => ({
                                ...prev,
                                [ln.order_line_id]: clampReceivedQty(e.target.value, maxQty),
                              }))
                            }
                            className="ml-auto h-8 w-24 text-right text-[12px]"
                            aria-label={`Remaining qty (max ${maxQty})`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Button
              type="button"
              size="sm"
              disabled={
                busy ||
                !dcNumber.trim() ||
                !invoiceNumber.trim() ||
                !lrAwb.trim() ||
                !dcDoc ||
                !invoiceDoc ||
                !lrDoc
              }
              className="h-9 cursor-pointer transition-colors duration-200"
              onClick={() => {
                if (!dcNumber.trim() || !dcDoc) {
                  setError("DC number and DC document are required");
                  return;
                }
                if (!invoiceNumber.trim() || !invoiceDoc) {
                  setError("Invoice number and invoice document are required");
                  return;
                }
                if (!lrAwb.trim() || !lrDoc) {
                  setError("LR / AWB number and document are required");
                  return;
                }
                const lines = (state?.lines || [])
                  .map((ln) => {
                    const maxQty = Math.max(0, Number(ln.remaining_to_dispatch) || 0);
                    const qty = Math.min(
                      Math.max(0, Number(dispatchQtys[ln.order_line_id] || 0)),
                      maxQty,
                    );
                    return { order_line_id: ln.order_line_id, dispatch_qty: qty };
                  })
                  .filter((ln) => ln.dispatch_qty > 0);
                if (!lines.length) {
                  setError("Enter received qty for at least one line (≤ ordered qty)");
                  return;
                }
                void (async () => {
                  const row = await runAction("Vendor dispatch recorded", () =>
                    createScmVendorDispatch(order.id, {
                      dc_number: dcNumber.trim(),
                      invoice_number: invoiceNumber.trim(),
                      lr_awb_number: lrAwb.trim(),
                      dispatch_date: dispatchDate || null,
                      eway_notes: ewayNotes.trim() || null,
                      transport_notes: transportNotes.trim() || null,
                      attachment_refs: {
                        dc: dcDoc,
                        invoice: invoiceDoc,
                        lr_awb: lrDoc,
                      },
                      lines,
                    }),
                  );
                  if (row) {
                    resetVendorDispatchForm(row.lines);
                    const remaining = (row.lines || []).reduce(
                      (sum, ln) => sum + Number(ln.remaining_to_dispatch || 0),
                      0,
                    );
                    if (remaining > 1e-9) {
                      setNotice(
                        `Wave saved. Remaining qty ${remaining} — enter the next vendor dispatch details.`,
                      );
                    } else {
                      setNotice("All ordered qty recorded. Proceed to GRN.");
                    }
                  }
                })();
              }}
            >
              <Truck className="mr-1.5 size-3.5" aria-hidden />
              Record vendor dispatch
            </Button>
          </div>
        ) : null}

        {/* Always keep dispatch/GRN history visible once waves exist */}
        {(state?.dispatches || []).length > 0 ? (
          <div className="rounded-xl border border-border/70 bg-muted/10 p-3.5 text-xs sm:p-4">
            <h3 className="text-xs font-semibold text-foreground">Dispatch &amp; GRN history</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Each vendor dispatch wave stays here for reference. Record GRN posts that
              wave into stock; download the GRN PDF when ready.
            </p>
            <ul className="mt-3 space-y-3">
              {(state?.dispatches || []).map((d) => {
                const docs = dispatchDocEntries(d);
                const waveQty =
                  Number(d.grn_dispatch_qty ?? 0) ||
                  d.lines.reduce((sum, ln) => sum + Number(ln.dispatch_qty || 0), 0);
                const grnQty = Number(d.grn_received_qty ?? 0);
                const grnStatus = (d.grn_status || "pending").toLowerCase();
                const grnDone = grnStatus === "done";
                const grnPartial = grnStatus === "partial";
                const activeBatches = receiptBatches.filter(
                  (b) =>
                    !(b.reversed || (b.reversal_status || "").toLowerCase() === "reversed"),
                );
                const byDispatchId = activeBatches.filter(
                  (b) => String(b.vendor_dispatch_id || "") === String(d.id),
                );
                const grnSet = new Set(
                  (d.grn_numbers || []).map((n) => String(n || "").trim()).filter(Boolean),
                );
                const byGrnNumber =
                  byDispatchId.length === 0 && grnSet.size > 0
                    ? activeBatches.filter((b) => grnSet.has(String(b.grn_number || "").trim()))
                    : [];
                const waveBatches = byDispatchId.length > 0 ? byDispatchId : byGrnNumber;
                return (
                  <li
                    key={d.id}
                    className="rounded-lg border border-border/60 bg-background px-3 py-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          Dispatch wave #{d.sequence}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          Dispatched {displayDate(d.dispatch_date)}
                        </p>
                      </div>
                      <Badge
                        className={`rounded-full border-transparent px-2.5 py-0.5 text-[10px] font-semibold ${grnDone
                          ? "bg-emerald-100 text-emerald-800"
                          : grnPartial
                            ? "bg-amber-100 text-amber-900"
                            : "bg-slate-100 text-slate-700"
                          }`}
                      >
                        {grnDone ? "GRN done" : grnPartial ? "GRN partial" : "GRN pending"}
                      </Badge>
                    </div>

                    <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-md border border-border/50 bg-muted/20 px-2.5 py-2">
                        <dt className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                          Delivery challan (DC)
                        </dt>
                        <dd className="mt-0.5 text-[13px] font-semibold tabular-nums text-foreground">
                          {d.dc_number || "—"}
                        </dd>
                      </div>
                      <div className="rounded-md border border-border/50 bg-muted/20 px-2.5 py-2">
                        <dt className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                          Vendor invoice
                        </dt>
                        <dd className="mt-0.5 text-[13px] font-semibold tabular-nums text-foreground">
                          {d.invoice_number || "—"}
                        </dd>
                      </div>
                      <div className="rounded-md border border-border/50 bg-muted/20 px-2.5 py-2">
                        <dt className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                          LR / AWB
                        </dt>
                        <dd className="mt-0.5 text-[13px] font-semibold tabular-nums text-foreground">
                          {d.lr_awb_number || "—"}
                        </dd>
                      </div>
                      <div className="rounded-md border border-border/50 bg-muted/20 px-2.5 py-2">
                        <dt className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                          Received into stock
                        </dt>
                        <dd className="mt-0.5 text-[13px] font-semibold tabular-nums text-foreground">
                          {grnQty} / {waveQty}
                        </dd>
                      </div>
                    </dl>

                    {docs.length > 0 ? (
                      <div className="mt-3">
                        <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                          Vendor documents
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-2">
                          {docs.map(({ key, label, doc }) => (
                            <button
                              key={`${d.id}-${key}`}
                              type="button"
                              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border/70 bg-muted/30 px-2 py-1.5 text-[11px] font-medium text-foreground transition-colors duration-200 hover:bg-muted/50"
                              onClick={() =>
                                downloadDispatchDoc(
                                  doc,
                                  `${label}_wave_${d.sequence}.pdf`,
                                )
                              }
                              title={doc.file_name || label}
                            >
                              <FileText className="size-3.5 shrink-0" aria-hidden />
                              <span>{label}</span>
                              {doc.file_name ? (
                                <span className="max-w-[12rem] truncate text-muted-foreground">
                                  {doc.file_name}
                                </span>
                              ) : null}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-3">
                      <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                        GRN copies
                      </p>
                      {waveBatches.length > 0 ? (
                        <ul className="mt-1.5 space-y-1.5">
                          {waveBatches.map((batch) => {
                            const busyKey = `${d.id}:${batch.id || batch.sequence}`;
                            return (
                              <li
                                key={busyKey}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/15 px-2.5 py-2"
                              >
                                <div className="min-w-0">
                                  <p className="text-[12px] font-semibold tabular-nums text-foreground">
                                    {batch.grn_number}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground">
                                    {displayDate(batch.receipt_at)}
                                    {(batch.lines || []).length
                                      ? ` · ${(batch.lines || []).reduce((s, ln) => s + Number(ln.quantity || 0), 0)} qty`
                                      : ""}
                                  </p>
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={grnPdfBusyKey === busyKey}
                                  className="h-8 cursor-pointer transition-colors duration-200"
                                  onClick={() => {
                                    setGrnPdfBusyKey(busyKey);
                                    setError(null);
                                    void downloadBatchGrnPdf(batch, {
                                      poNumber:
                                        order.company_po_number?.trim() ||
                                        order.document_number,
                                      documentDate:
                                        batch.receipt_at ||
                                        order.document_date ||
                                        new Date().toISOString(),
                                      vendorName: vendorLabel || state?.vendor_name || undefined,
                                      vendorAddressLines: [],
                                    })
                                      .catch((err) =>
                                        setError(
                                          err instanceof Error
                                            ? err.message
                                            : "Failed to download GRN PDF",
                                        ),
                                      )
                                      .finally(() => setGrnPdfBusyKey(null));
                                  }}
                                >
                                  <FileDown className="mr-1.5 size-3.5" aria-hidden />
                                  {grnPdfBusyKey === busyKey
                                    ? "Preparing…"
                                    : "Download GRN PDF"}
                                </Button>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (d.grn_numbers || []).length > 0 ? (
                        <p className="mt-1.5 text-[12px] tabular-nums text-foreground">
                          {(d.grn_numbers || []).join(", ")}
                        </p>
                      ) : (
                        <p className="mt-1.5 text-[11px] text-muted-foreground">
                          No GRN recorded for this wave yet.
                        </p>
                      )}
                    </div>

                    {!grnDone ? (
                      <div className="mt-3">
                        <Button
                          type="button"
                          size="sm"
                          disabled={busy || grnBusyId !== null}
                          className="h-8 cursor-pointer transition-colors duration-200"
                          onClick={() => void recordWaveGrn(d)}
                        >
                          <PackageCheck className="mr-1.5 size-3.5" aria-hidden />
                          {grnBusyId === d.id ? "Recording GRN…" : "Record GRN"}
                        </Button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {/* Billing / DC from GRN stock — available after any wave GRN */}
        {hasAnyWaveGrn ? (
          <div className="space-y-3 rounded-xl border border-border/70 bg-background p-3.5 sm:p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-xs font-semibold tracking-tight text-foreground">
                  Billing or delivery challan
                </h3>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Choose billing or DC for units already in stock from GRN on this PO.
                  Select all or partial, then continue to the same form as before.
                </p>
              </div>
              <Badge className="rounded-full border-transparent bg-sky-100 px-2.5 py-0.5 text-[10px] font-semibold text-sky-900">
                {inventoryShipLineOptions.length} in stock
              </Badge>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                Document type
              </p>
              {(
                [
                  {
                    value: "billing" as const,
                    title: "Billing",
                    detail: "Invoice path — same as GRN billing / Accounts My Jobs.",
                  },
                  {
                    value: "delivery_challan" as const,
                    title: "Delivery challan",
                    detail: "Ship without billing now. Bill can be taken later.",
                  },
                ] as const
              ).map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 transition-colors duration-200",
                    "border-border hover:bg-muted/40 has-[:checked]:border-sky-400 has-[:checked]:bg-sky-50/70",
                  )}
                >
                  <input
                    type="radio"
                    name="po-fulfillment-ship-kind"
                    className="mt-0.5 cursor-pointer accent-sky-700"
                    value={option.value}
                    checked={shipKind === option.value}
                    onChange={() => setShipKind(option.value)}
                  />
                  <span className="min-w-0 space-y-0.5">
                    <span className="block text-sm font-medium text-foreground">
                      {option.title}
                    </span>
                    <span className="block text-xs text-muted-foreground">{option.detail}</span>
                  </span>
                </label>
              ))}
            </div>

            <div className="space-y-2.5 rounded-md border border-border bg-muted/20 p-2.5">
              <ShipInventoryLinePicker
                lines={inventoryShipLineOptions}
                selection={inventorySelection}
                onSelectionChange={setInventorySelection}
                loading={poInventoryLoading}
                emptyLabel="No GRN warehouse stock on this PO yet. Record GRN on a dispatch wave first."
              />
            </div>

            <Button
              type="button"
              size="sm"
              disabled={
                busy || shipBusy || poInventoryLoading || !hasSelectedInventoryShipLines
              }
              className="h-9 cursor-pointer transition-colors duration-200"
              onClick={() => void continueBillingOrDc()}
            >
              <Receipt className="mr-1.5 size-3.5" aria-hidden />
              {shipBusy
                ? "Opening…"
                : shipKind === "billing"
                  ? "Continue to billing"
                  : "Continue to delivery challan"}
            </Button>
          </div>
        ) : null}

        {stage === "customer_dispatched" ? (
          <div className="space-y-3 rounded-xl border border-border/70 bg-background p-3.5 sm:p-4">
            <h3 className="text-xs font-semibold tracking-tight text-foreground">
              Customer POD
            </h3>
            <label className="block space-y-1.5">
              <span className="text-[11px] font-medium text-muted-foreground uppercase">
                Proof of delivery file
              </span>
              <Input
                type="file"
                accept=".pdf,image/*"
                disabled={busy}
                className="h-9 cursor-pointer text-[13px]"
                onChange={(e) => onPodFile(e.target.files?.[0] || null)}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[11px] font-medium text-muted-foreground uppercase">
                Note
              </span>
              <Textarea
                value={podNote}
                onChange={(e) => setPodNote(e.target.value)}
                disabled={busy}
                rows={2}
                className="text-[13px]"
              />
            </label>
            <Button
              type="button"
              size="sm"
              disabled={busy}
              className="h-9 cursor-pointer transition-colors duration-200"
              onClick={() =>
                void runAction("POD recorded — order delivered", () =>
                  uploadScmCustomerPod(order.id, {
                    pod_file_name: podFileName,
                    pod_content_base64: podBase64,
                    note: podNote.trim() || null,
                  }),
                )
              }
            >
              <Upload className="mr-1.5 size-3.5" aria-hidden />
              Upload POD / mark delivered
            </Button>
          </div>
        ) : null}

        {stage === "delivered" ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-900 sm:p-4">
            <p className="font-semibold">Fulfillment complete</p>
            <p className="mt-1">
              POD recorded {displayDate(state?.customer_pod_uploaded_at)}. Actual delivery{" "}
              {displayDate(order.actual_delivery_date)}.
            </p>
          </div>
        ) : null}

        <DeliveryCorrespondencePanel
          orderId={order.id}
          customerName={order.customer_name || state?.customer_name}
          refreshKey={correspondenceKey}
          canEditTemplates={isAdmin}
        />
      </div>
    </section>
  );
}
