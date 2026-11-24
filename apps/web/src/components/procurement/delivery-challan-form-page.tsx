"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Eye,
  FileDown,
  FileText,
  FileUp,
  ListChecks,
  Package,
  Paperclip,
  PenLine,
  Trash2,
  Truck,
} from "lucide-react";

import {
  FinanceField,
  FinanceSelect,
  FinanceTextarea,
} from "@/components/finance/journals/finance-form-field";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DeliverySectionCard } from "@/components/procurement/delivery-section-card";
import { DeliveryStatusBillDialog } from "@/components/procurement/delivery-status-bill-dialog";
import {
  DeliveryBillTakenBadge,
  DeliveryBillTakenButton,
} from "@/components/procurement/delivery-bill-taken-badge";
import { assertSafeUploadFile } from "@/lib/safe-attachment";
import { ApiClientError, formatApiError } from "@/services/api-client";
import {
  getInvoiceGenerationTaskForBatch,
  getPurchaseOrder,
  getScmOvfPreview,
  listInvoiceGenerationTasksForOrder,
  listOrderReceiptBatches,
  listProcurementInventory,
  listReceiptBatchAttachments,
  listVendorOptions,
  openReceiptBatchAttachment,
  saveReceiptBatchVendorInvoice,
  type ProcInvoiceGenerationTask,
  type ProcOrder,
  type ReceiptBatchAttachment,
  type ScmOvfPreview,
  type ScmReceiptBatch,
  type VendorOption,
} from "@/services/procurement-service";
import { fileToBase64 } from "@/services/sales-crm-service";
import {
  expandGrnNumberList,
  fullPoChallanLines,
  mergeGrnInventoryStockToChallanLines,
  mergeInventoryAndPoChallanLines,
  mergeOvfStockAllocationsToChallanLines,
  mergeSelectedGrnChallanLines,
  ovfInventorySelectionToChallanLines,
  receiptBatchKey,
  resolveChallanReceiptBatches,
  type ChallanItemsSourceMode,
} from "@/utils/delivery-challan-grn";
import {
  buildDeliveryChallanPdfInput,
  downloadDeliveryChallanPdf,
  openDeliveryChallanPdfPreview,
} from "@/utils/delivery-challan-pdf";
import {
  applyCustomerPoToChallanFields,
  buildChallanPrefillHeader,
  resolveCustomerPoFields,
  formatPoNumberDateLine,
  resolveChallanTaxSupplyStates,
  resolveEntityPdfBlock,
} from "@/utils/delivery-challan-prefill";
import {
  computeDeliveryChallanTaxSummary,
} from "@/utils/delivery-challan-totals";
import { formatInrPdf } from "@/utils/purchase-order-amount-words";
import {
  emptyChallanLine,
  getDeliveryChallan,
  peekNextDeliveryChallanNumber,
  upsertDeliveryChallan,
  type DeliveryChallanLine,
  type DeliveryChallanMode,
  type GrnChallanKind,
} from "@/utils/delivery-challan-storage";
import { resolveChallanBillStatus } from "@/utils/delivery-challan-bill";
import { patchPendingGrnChallan, upsertPendingGrnChallan } from "@/utils/grn-challan-pending";
import { ensureDeliveryStatusForChallan, getDeliveryStatus } from "@/utils/delivery-status-storage";
import { syncOvfTimelineForChallan, syncOvfTimelineForDeliveryStatus } from "@/utils/ovf-timeline-sync";
import {
  ovfGrnStockSourceKey,
  ovfStockSourceKey,
  poGrnStockSourceKey,
  takeOvfInventoryShipSelection,
  clearPoGrnPendingShipSelection,
  takePoGrnPendingShipSelection,
  takePoGrnStockShipSelection,
} from "@/utils/ovf-stock";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const READ_ONLY_INPUT =
  "h-8 cursor-default bg-muted/40 text-foreground read-only:opacity-100";

function pickBillingInvoiceTask(
  tasks: ProcInvoiceGenerationTask[],
): ProcInvoiceGenerationTask | null {
  if (tasks.length === 0) return null;
  const completed = tasks.find(
    (task) => task.status === "completed" && Boolean(task.invoice_number?.trim()),
  );
  if (completed) return completed;
  const pending = tasks.find((task) => task.status === "pending");
  return pending || tasks[0] || null;
}

const NO_SPINNER =
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

const PDF_DOCUMENT_TYPE_DC = "DELIVERY CHALLAN";
const PDF_DOCUMENT_TYPE_BILLING = "BILLING";
const PDF_COPY_LABEL = "ORIGINAL FOR CONSIGNEE";
const DELIVERY_CHALLAN_LIST_HREF = "/procurement/delivery-challan";

function resolveChallanModuleExitHref(returnTo: string | null): string {
  if (!returnTo) return DELIVERY_CHALLAN_LIST_HREF;
  if (/\/orders\/[^/]+/.test(returnTo)) return DELIVERY_CHALLAN_LIST_HREF;
  return returnTo;
}

function safeProcurementReturnTo(raw: string | null): string | null {
  if (!raw?.trim()) return null;
  try {
    const path = decodeURIComponent(raw.trim());
    if (!path.startsWith("/procurement/") || path.includes("://")) return null;
    return path;
  } catch {
    return null;
  }
}

function challanBackLabel(backHref: string, kind?: GrnChallanKind | "" | null): string {
  if (kind === "billing") return "Back to billing";
  if (/\/orders\/[^/]+/.test(backHref)) return "Purchase order";
  if (backHref.includes("/grns")) return "GRNs";
  if (backHref.includes("/inventory")) return "Inventory";
  if (backHref.includes("/delivery-challan")) return "Delivery challans";
  return "Delivery challans";
}

type DeliveryChallanFormPageProps = {
  challanId?: string;
  /** Render on PO detail (or similar) without navigating to /delivery-challan */
  embedded?: {
    orderId: string;
    onClose: () => void;
    onSaved?: (recordId: string) => void;
  };
};

export function DeliveryChallanFormPage({ challanId, embedded }: DeliveryChallanFormPageProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderIdParam = embedded?.orderId ?? searchParams.get("orderId");
  const grnKeyParam = searchParams.get("grnKey");
  const batchKeyParam = searchParams.get("batchKey");
  const kindParam = searchParams.get("kind") as GrnChallanKind | null;
  const fromChallanParam = searchParams.get("fromChallan");
  const ovfIdParam = searchParams.get("ovfId");
  const ovfShipSource = searchParams.get("source");
  const isOvfShip =
    Boolean(ovfIdParam?.trim()) &&
    (ovfShipSource === "ovf_stock" ||
      ovfShipSource === "ovf_grn_stock" ||
      ovfShipSource === "ovf_po" ||
      ovfShipSource === "ovf_combined");
  const isOvfStock = Boolean(ovfIdParam?.trim()) && ovfShipSource === "ovf_stock";
  const isOvfGrnStock = Boolean(ovfIdParam?.trim()) && ovfShipSource === "ovf_grn_stock";
  const isPoGrnStock =
    ovfShipSource === "po_grn_stock" && Boolean(orderIdParam?.trim());
  const isOvfPrefilledLines = isOvfStock || isOvfGrnStock || isPoGrnStock;
  const returnToParam = searchParams.get("returnTo");
  const fromInventory = searchParams.get("from") === "inventory";
  const returnTo = useMemo(() => safeProcurementReturnTo(returnToParam), [returnToParam]);
  const backHref = resolveChallanModuleExitHref(
    returnTo || (fromInventory ? "/procurement/inventory" : null),
  );
  const isNew = !challanId;
  const isLocked = Boolean(challanId) && !embedded;

  const [recordId, setRecordId] = useState(() => challanId ?? "");
  useEffect(() => {
    if (!challanId && !recordId) {
      setRecordId(crypto.randomUUID());
    }
  }, [challanId, recordId]);

  const [orderId, setOrderId] = useState<string | null>(orderIdParam);
  const [challanNumber, setChallanNumber] = useState(() =>
    isNew ? peekNextDeliveryChallanNumber() : "",
  );
  const [challanDate, setChallanDate] = useState(todayIso());
  const [customerName, setCustomerName] = useState("");
  const [customerBillTo, setCustomerBillTo] = useState("");
  const [customerShipTo, setCustomerShipTo] = useState("");
  const [customerGstNo, setCustomerGstNo] = useState("");
  const [kindAttn, setKindAttn] = useState("");
  const [purchaseOrderNumber, setPurchaseOrderNumber] = useState("");
  const [poDate, setPoDate] = useState("");
  const [remarks, setRemarks] = useState("Not for Sale, Delivery Purpose Only");
  const [preparedBy, setPreparedBy] = useState("");
  const [deliveredBy, setDeliveredBy] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [lines, setLines] = useState<DeliveryChallanLine[]>([emptyChallanLine()]);
  const [deliveryMode, setDeliveryMode] = useState<DeliveryChallanMode>("NRGP");
  const [transportDetails, setTransportDetails] = useState("");
  const [driverVehicleDetails, setDriverVehicleDetails] = useState("");
  const [senderSignature, setSenderSignature] = useState("");
  const [receiverSignature, setReceiverSignature] = useState("");
  const [itemsSourceMode, setItemsSourceMode] = useState<ChallanItemsSourceMode>("full_po");
  const [selectedGrnKeys, setSelectedGrnKeys] = useState<string[]>([]);
  const [linkedGrnNumbers, setLinkedGrnNumbers] = useState<string[]>([]);
  const [grnKind, setGrnKind] = useState<GrnChallanKind | "">(() =>
    kindParam === "billing" || kindParam === "delivery_challan"
      ? kindParam
      : challanId
        ? ""
        : "delivery_challan",
  );
  const backLabel = challanBackLabel(backHref, grnKind || kindParam);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [sourceChallanId, setSourceChallanId] = useState<string | null>(null);
  const [invoiceDocument, setInvoiceDocument] = useState<{
    id: string;
    fileName: string;
  } | null>(null);
  const [invoiceDocBusy, setInvoiceDocBusy] = useState(false);
  const invoiceFileInputRef = useRef<HTMLInputElement>(null);
  const [loadedOrder, setLoadedOrder] = useState<ProcOrder | null>(null);
  const [ovfContext, setOvfContext] = useState<ScmOvfPreview | null>(null);
  const [grnBatches, setGrnBatches] = useState<ScmReceiptBatch[]>([]);
  const [banner, setBanner] = useState<string | null>(null);
  const [hasSaved, setHasSaved] = useState(!isNew);
  const [billOpen, setBillOpen] = useState(false);
  const [billTick, setBillTick] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [prefillBusy, setPrefillBusy] = useState(Boolean(challanId || orderIdParam || isOvfShip));
  const [inventoryProductOptions, setInventoryProductOptions] = useState<
    Array<{ name: string; description: string; rate: string; availableQty: number }>
  >([]);
  const skipAutoApplyLinesRef = useRef(Boolean(challanId));
  const linesLockedFromSaveRef = useRef(Boolean(challanId));

  /** Challan/PO header, customer identity, and lines come from PO/stock — not free-edit. */
  const lockSourceFields =
    isLocked ||
    hasSaved ||
    grnKind === "billing" ||
    isOvfPrefilledLines ||
    Boolean(orderIdParam?.trim()) ||
    Boolean(loadedOrder);

  const defaultShipTo = "";

  const effectiveGrnBatches = useMemo(
    () => resolveChallanReceiptBatches(grnBatches, loadedOrder),
    [grnBatches, loadedOrder],
  );

  const applyLinesFromSource = useCallback(
    (
      mode: ChallanItemsSourceMode = itemsSourceMode,
      keys: string[] = selectedGrnKeys,
      batches: ScmReceiptBatch[] = effectiveGrnBatches,
    ) => {
      if (!loadedOrder) return;
      if (mode === "full_po") {
        const next = fullPoChallanLines(loadedOrder, defaultShipTo, ovfContext);
        setLines(next.length > 0 ? next : [emptyChallanLine()]);
        return;
      }
      const merged = mergeSelectedGrnChallanLines(
        batches,
        new Set(keys),
        loadedOrder,
        defaultShipTo,
        grnKind || undefined,
      );
      setLines(merged.length > 0 ? merged : [emptyChallanLine()]);
    },
    [defaultShipTo, effectiveGrnBatches, grnKind, itemsSourceMode, loadedOrder, ovfContext, selectedGrnKeys],
  );

  const selectedGrnNumbers = useMemo(() => {
    if (linkedGrnNumbers.length > 0) return linkedGrnNumbers;
    const keySet = new Set(selectedGrnKeys);
    return effectiveGrnBatches
      .filter((batch) => keySet.has(receiptBatchKey(batch)))
      .map((batch) => batch.grn_number)
      .filter(Boolean);
  }, [effectiveGrnBatches, linkedGrnNumbers, selectedGrnKeys]);

  const poNumberDatePdf = useMemo(
    () => formatPoNumberDateLine(purchaseOrderNumber, poDate),
    [purchaseOrderNumber, poDate],
  );

  const entityPdf = useMemo(
    () =>
      resolveEntityPdfBlock(
        loadedOrder,
        purchaseOrderNumber.trim(),
        ovfContext,
      ),
    [loadedOrder, ovfContext, purchaseOrderNumber],
  );

  const taxPercentagePdf = useMemo(() => {
    const fromOvf = ovfContext?.tax_percentage;
    if (fromOvf != null && Number(fromOvf) > 0) return String(fromOvf);
    return "18";
  }, [ovfContext]);

  const taxPlaceStates = useMemo(
    () => resolveChallanTaxSupplyStates(loadedOrder, ovfContext),
    [loadedOrder, ovfContext],
  );

  const taxSummary = useMemo(() => {
    const pct = Number(taxPercentagePdf) || 0;
    const activeLines = lines.filter((ln) => ln.itemName.trim() || ln.product.trim());
    return computeDeliveryChallanTaxSummary({
      lines: activeLines,
      taxPct: pct,
      sourceOfSupply: taxPlaceStates.sourceOfSupply,
      destinationOfSupply: taxPlaceStates.destinationOfSupply,
      formatAmount: formatInrPdf,
    });
  }, [lines, taxPercentagePdf, taxPlaceStates]);

  const pdfInput = useMemo(
    () =>
      buildDeliveryChallanPdfInput({
        entityName: entityPdf.entityName,
        entityAddressBlock: entityPdf.entityAddressBlock,
        entityGstBlock: entityPdf.entityGstBlock,
        documentType:
          grnKind === "billing" ? PDF_DOCUMENT_TYPE_BILLING : PDF_DOCUMENT_TYPE_DC,
        copyLabel: PDF_COPY_LABEL,
        challanNumber:
          grnKind === "billing"
            ? invoiceNumber.trim() || challanNumber
            : challanNumber,
        challanDate:
          grnKind === "billing"
            ? invoiceDate.trim() || challanDate
            : challanDate,
        customerName,
        customerBillTo,
        customerShipTo,
        customerGstNo,
        kindAttn,
        poNumber: purchaseOrderNumber,
        poDate,
        shipFromAddress: entityPdf.shipFromAddress,
        remarks,
        preparedBy,
        deliveredBy,
        taxPercentage: taxPercentagePdf,
        billingState: taxPlaceStates.sourceOfSupply,
        shippingState: taxPlaceStates.destinationOfSupply,
        taxRemarks: "",
        deliveryMode,
        lines,
      }),
    [
      entityPdf,
      grnKind,
      invoiceNumber,
      invoiceDate,
      challanNumber,
      challanDate,
      customerName,
      customerBillTo,
      customerShipTo,
      customerGstNo,
      kindAttn,
      purchaseOrderNumber,
      poDate,
      remarks,
      preparedBy,
      deliveredBy,
      taxPercentagePdf,
      taxPlaceStates,
      deliveryMode,
      lines,
    ],
  );

  useEffect(() => {
    if (linesLockedFromSaveRef.current) return;
    if (skipAutoApplyLinesRef.current) {
      skipAutoApplyLinesRef.current = false;
      return;
    }
    if (!loadedOrder || prefillBusy) return;
    applyLinesFromSource();
  }, [applyLinesFromSource, loadedOrder, prefillBusy, itemsSourceMode, selectedGrnKeys, effectiveGrnBatches]);

  useEffect(() => {
    if (prefillBusy || grnKind !== "billing") {
      if (grnKind !== "billing") setInvoiceDocument(null);
      return;
    }
    void refreshBillingInvoiceDocument();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh when billing context settles
  }, [prefillBusy, grnKind, invoiceNumber, effectiveGrnBatches, orderId, orderIdParam]);

  function applyPrefillHeader(
    order: ProcOrder,
    ovf: ScmOvfPreview | null,
    companyPoNumber: string,
    vendorLabel: string,
  ) {
    const header = buildChallanPrefillHeader(order, ovf, order.entity_code);
    setCustomerName(header.customerName);
    setCustomerBillTo(header.customerBillTo);
    setCustomerShipTo(header.customerShipTo);
    setCustomerGstNo(header.customerGstNo);
    setKindAttn(header.kindAttn);
    setPurchaseOrderNumber(header.poNumber);
    setPoDate(header.poDate);
    setRemarks(header.remarks);
    setVendorName(vendorLabel);
    setChallanDate(order.document_date || todayIso());
    setChallanNumber((current) => current.trim() || peekNextDeliveryChallanNumber());
  }

  useEffect(() => {
    if (!fromInventory || !isNew) return;
    let cancelled = false;
    void (async () => {
      try {
        const inventory = await listProcurementInventory();
        if (cancelled) return;
        const byName = new Map<
          string,
          { name: string; description: string; rate: string; availableQty: number }
        >();
        for (const row of inventory) {
          const name = (row.product_name || "").trim();
          if (!name) continue;
          const qty =
            Number(row.received_quantity) > 0
              ? Number(row.received_quantity)
              : 1;
          const existing = byName.get(name);
          if (existing) {
            existing.availableQty += qty;
            if (!existing.description && row.description?.trim()) {
              existing.description = row.description.trim();
            }
            if (!existing.rate && Number(row.unit_cost) > 0) {
              existing.rate = String(row.unit_cost);
            }
          } else {
            byName.set(name, {
              name,
              description: (row.description || "").trim(),
              rate: Number(row.unit_cost) > 0 ? String(row.unit_cost) : "",
              availableQty: qty,
            });
          }
        }
        setInventoryProductOptions(
          Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name)),
        );
      } catch {
        if (!cancelled) setInventoryProductOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fromInventory, isNew]);

  function applyInventoryProductToLine(lineId: string, productName: string) {
    const option = inventoryProductOptions.find((row) => row.name === productName);
    setLines((current) =>
      current.map((row) => {
        if (row.id !== lineId) return row;
        if (!productName) {
          return { ...row, product: "", itemName: "", rate: "", quantitySent: "" };
        }
        return {
          ...row,
          product: productName,
          itemName: option?.description || row.itemName,
          rate: option?.rate || row.rate,
          quantitySent:
            row.quantitySent.trim() ||
            (option && option.availableQty > 0 ? "1" : row.quantitySent),
        };
      }),
    );
  }

  async function loadOrderContext(orderIdValue: string) {
    const [order, vendorRows, batches] = await Promise.all([
      getPurchaseOrder(orderIdValue),
      listVendorOptions().catch(() => [] as VendorOption[]),
      listOrderReceiptBatches(orderIdValue).catch(() => [] as ScmReceiptBatch[]),
    ]);
    const vendor = vendorRows.find((row) => row.id === order.vendor_id);
    const poNumber = order.company_po_number?.trim() || order.document_number;
    let ovf: ScmOvfPreview | null = null;
    if (order.source_module === "crm" && order.source_document_id) {
      try {
        ovf = await getScmOvfPreview(order.source_document_id);
      } catch {
        ovf = null;
      }
    }
    return { order, vendor, poNumber, batches, ovf };
  }

  function hydrateFromSaved(saved: ReturnType<typeof getDeliveryChallan>) {
    if (!saved) return;
    setOrderId(saved.orderId);
    setChallanNumber(saved.challanNumber);
    setChallanDate(saved.challanDate);
    setCustomerName(saved.customerName);
    setCustomerBillTo(saved.customerBillTo);
    setCustomerShipTo(saved.customerShipTo);
    setCustomerGstNo(saved.customerGstNo);
    setKindAttn(saved.kindAttn);
    setPurchaseOrderNumber(saved.purchaseOrderNumber);
    setPoDate(saved.poDate);
    setRemarks(saved.remarks);
    setPreparedBy(saved.preparedBy);
    setDeliveredBy(saved.deliveredBy);
    setVendorName(saved.vendorName);
    setLines(saved.lines.length > 0 ? saved.lines : [emptyChallanLine()]);
    setDeliveryMode(saved.deliveryMode ?? "NRGP");
    setTransportDetails(saved.transportDetails);
    setDriverVehicleDetails(saved.driverVehicleDetails);
    setSenderSignature(saved.senderSignature);
    setReceiverSignature(saved.receiverSignature);
    setItemsSourceMode(saved.itemsSourceMode ?? "full_po");
    setSelectedGrnKeys(saved.selectedGrnKeys ?? []);
    setLinkedGrnNumbers(
      (saved.selectedGrnNumbers || []).map((n) => String(n ?? "").trim()).filter(Boolean),
    );
    setGrnKind(saved.grnKind ?? "");
    setInvoiceNumber(saved.invoiceNumber ?? "");
    setInvoiceDate(saved.invoiceDate ?? "");
    setSourceChallanId(saved.sourceChallanId ?? null);
  }

  useEffect(() => {
    if (challanId) {
      const saved = getDeliveryChallan(challanId);
      if (!saved) {
        setLoadError("Delivery challan not found.");
        setPrefillBusy(false);
        return;
      }
      hydrateFromSaved(saved);
      if (saved.orderId) {
        void (async () => {
          try {
            const [{ order, batches, ovf }, inventory] = await Promise.all([
              loadOrderContext(saved.orderId!),
              listProcurementInventory().catch(() => []),
            ]);
            setLoadedOrder(order);
            setOvfContext(ovf);
            setGrnBatches(batches);
            const fromSaved = (saved.selectedGrnNumbers || [])
              .map((n) => String(n ?? "").trim())
              .filter(Boolean);
            const fromBatches = batches
              .map((batch) => (batch.grn_number || "").trim())
              .filter(Boolean);
            const fromInventory = inventory
              .filter((row) => row.source === "grn" && row.order_id === saved.orderId)
              .map((row) => (row.grn_number || "").trim())
              .filter(Boolean);
            const resolvedGrns = [
              ...new Set(
                fromSaved.length > 0
                  ? fromSaved
                  : fromBatches.length > 0
                    ? fromBatches
                    : fromInventory,
              ),
            ];
            if (resolvedGrns.length > 0) {
              setLinkedGrnNumbers(resolvedGrns);
              if (fromSaved.join(", ") !== resolvedGrns.join(", ")) {
                upsertDeliveryChallan({
                  ...saved,
                  selectedGrnNumbers: resolvedGrns,
                });
              }
            }
            const corrected = applyCustomerPoToChallanFields(
              {
                purchaseOrderNumber: saved.purchaseOrderNumber,
                poDate: saved.poDate,
                poNumberDate: saved.poNumberDate,
              },
              order,
              ovf,
            );
            if (
              corrected.purchaseOrderNumber !== saved.purchaseOrderNumber ||
              corrected.poDate !== saved.poDate
            ) {
              setPurchaseOrderNumber(corrected.purchaseOrderNumber);
              setPoDate(corrected.poDate);
              upsertDeliveryChallan({
                ...saved,
                purchaseOrderNumber: corrected.purchaseOrderNumber,
                poDate: corrected.poDate,
                poNumberDate: corrected.poNumberDate || saved.poNumberDate,
                selectedGrnNumbers:
                  resolvedGrns.length > 0 ? resolvedGrns : saved.selectedGrnNumbers,
              });
            }
          } catch {
            /* optional */
          } finally {
            setPrefillBusy(false);
          }
        })();
      } else {
        setPrefillBusy(false);
      }
      return;
    }

    if (!challanId && fromChallanParam && kindParam === "billing") {
      const source = getDeliveryChallan(fromChallanParam);
      if (!source || source.grnKind === "billing") {
        setLoadError("Delivery challan not found.");
        setPrefillBusy(false);
        return;
      }
      hydrateFromSaved(source);
      setGrnKind("billing");
      setInvoiceNumber("");
      setInvoiceDate("");
      setChallanNumber("");
      setSourceChallanId(source.id);
      setHasSaved(false);
      linesLockedFromSaveRef.current = true;
      skipAutoApplyLinesRef.current = true;
      if (source.orderId) {
        void (async () => {
          try {
            const { order, batches, ovf } = await loadOrderContext(source.orderId!);
            setLoadedOrder(order);
            setOvfContext(ovf);
            setGrnBatches(batches);
          } catch {
            /* header already copied from the delivery challan */
          } finally {
            setPrefillBusy(false);
          }
        })();
      } else {
        setPrefillBusy(false);
      }
      return;
    }

    if (isPoGrnStock && orderIdParam) {
      let cancelled = false;
      setPrefillBusy(true);
      setLoadError(null);
      void (async () => {
        try {
          const shipSelection =
            takePoGrnStockShipSelection(orderIdParam) ||
            (batchKeyParam ? takePoGrnPendingShipSelection(batchKeyParam) : null);
          const [{ order, vendor, batches, ovf, poNumber }, inventory] = await Promise.all([
            loadOrderContext(orderIdParam),
            listProcurementInventory(),
          ]);
          if (cancelled) return;
          setOrderId(orderIdParam);
          setLoadedOrder(order);
          setOvfContext(ovf);
          setGrnBatches(batches);
          skipAutoApplyLinesRef.current = true;
          linesLockedFromSaveRef.current = true;
          setGrnKind(
            kindParam === "billing" || kindParam === "delivery_challan"
              ? kindParam
              : "delivery_challan",
          );
          applyPrefillHeader(order, ovf, poNumber, vendor?.label || "");
          setItemsSourceMode("selected_grns");
          setSelectedGrnKeys([]);
          const grnNumsFromSelection = expandGrnNumberList(
            (shipSelection?.lines || []).map((line) => {
              const fromLine = (line.grn_number || "").trim();
              if (fromLine) return fromLine;
              if (!line.stock_unit_id) return "";
              const inv = inventory.find(
                (row) => String(row.stock_unit_id) === String(line.stock_unit_id),
              );
              return (inv?.grn_number || "").trim();
            }),
          );
          const grnNumsFromInventory = expandGrnNumberList(
            inventory
              .filter(
                (row) =>
                  row.source === "grn" &&
                  row.order_id === orderIdParam &&
                  (Number(row.received_quantity) || 0) > 0,
              )
              .map((row) => (row.grn_number || "").trim()),
          );
          setLinkedGrnNumbers(
            grnNumsFromSelection.length > 0 ? grnNumsFromSelection : grnNumsFromInventory,
          );
          if (kindParam === "billing") {
            try {
              const invoiceTask = pickBillingInvoiceTask(
                await listInvoiceGenerationTasksForOrder(orderIdParam),
              );
              if (invoiceTask?.invoice_number) {
                setInvoiceNumber(String(invoiceTask.invoice_number).trim());
              }
              if (invoiceTask?.invoice_date) {
                setInvoiceDate(String(invoiceTask.invoice_date).slice(0, 10));
              }
            } catch {
              /* optional prefill from Accounts My Jobs */
            }
          }
          const selectionAsOvf = shipSelection
            ? {
              ovf_id: ovf?.ovf_id || order.source_document_id || "",
              order_id: shipSelection.order_id,
              lines: shipSelection.lines,
            }
            : null;
          const grnStockLines = selectionAsOvf
            ? ovfInventorySelectionToChallanLines(selectionAsOvf, ovf, inventory)
            : mergeGrnInventoryStockToChallanLines(inventory, orderIdParam, ovf, order);
          setLines(grnStockLines.length > 0 ? grnStockLines : [emptyChallanLine()]);
          if (grnStockLines.length === 0) {
            setLoadError("No GRN warehouse stock found for this purchase order.");
          }
        } catch (err) {
          if (!cancelled) {
            setLoadError(
              formatApiError(err, "Failed to load purchase order GRN stock for challan."),
            );
          }
        } finally {
          if (!cancelled) setPrefillBusy(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    if (isOvfShip && ovfIdParam) {
      let cancelled = false;
      setPrefillBusy(true);
      setLoadError(null);
      void (async () => {
        try {
          const ovf = await getScmOvfPreview(ovfIdParam);
          if (cancelled) return;
          setOvfContext(ovf);
          skipAutoApplyLinesRef.current = true;
          linesLockedFromSaveRef.current = true;
          setGrnKind(
            kindParam === "billing" || kindParam === "delivery_challan"
              ? kindParam
              : "delivery_challan",
          );
          const customer = (ovf.customer_name || ovf.account_name || "").trim();
          setCustomerName(customer);
          setCustomerBillTo((ovf.billing_address || "").trim() || customer);
          setCustomerShipTo(
            (ovf.shipping_address || "").trim() ||
            (ovf.billing_address || "").trim() ||
            customer,
          );
          setCustomerGstNo((ovf.customer_gst || "").trim());
          const attn = [ovf.shipping_contact_person, ovf.billing_contact_person]
            .map((value) => (value || "").trim())
            .filter(Boolean)
            .join(" / ");
          setKindAttn(attn);
          setPurchaseOrderNumber((ovf.po_number || "").trim());
          setPoDate((ovf.po_date || "").slice(0, 10));
          setVendorName((ovf.vendor_name || ovf.distributor_name || "").trim());
          setRemarks("Not for Sale, Delivery Purpose Only");
          setChallanNumber((current) => current.trim() || peekNextDeliveryChallanNumber());

          const orderIdForShip = (orderIdParam || ovf.purchase_order_id || "").trim();
          const needsOrder =
            ovfShipSource === "ovf_po" || ovfShipSource === "ovf_combined";

          if (ovfShipSource === "ovf_stock") {
            setOrderId(ovfIdParam);
            setItemsSourceMode("selected_grns");
            setSelectedGrnKeys([ovfStockSourceKey(ovfIdParam)]);
            const shipSelection = takeOvfInventoryShipSelection(ovfIdParam);
            const allocLines = shipSelection
              ? ovfInventorySelectionToChallanLines(shipSelection, ovf)
              : mergeOvfStockAllocationsToChallanLines(ovf.stock_allocations, ovf);
            setLines(allocLines.length > 0 ? allocLines : [emptyChallanLine()]);
            return;
          }

          if (ovfShipSource === "ovf_grn_stock") {
            const orderIdForGrn = (orderIdParam || ovf.purchase_order_id || "").trim();
            if (!orderIdForGrn) {
              setLoadError("Link a purchase order before shipping GRN warehouse stock.");
              setLines([emptyChallanLine()]);
              return;
            }
            const shipSelection = takeOvfInventoryShipSelection(ovfIdParam);
            const [{ order, vendor, batches }, inventory] = await Promise.all([
              loadOrderContext(orderIdForGrn),
              listProcurementInventory(),
            ]);
            if (cancelled) return;
            setOrderId(orderIdForGrn);
            setLoadedOrder(order);
            setGrnBatches(batches);
            if (vendor?.label) setVendorName(vendor.label);
            const customerPo = resolveCustomerPoFields(order, ovf);
            setPurchaseOrderNumber(customerPo.poNumber);
            setPoDate(customerPo.poDate || (ovf.po_date || "").slice(0, 10));
            setItemsSourceMode("selected_grns");
            setSelectedGrnKeys([]);
            const grnNumsFromSelection = expandGrnNumberList(
              (shipSelection?.lines || []).map((line) => {
                const fromLine = (line.grn_number || "").trim();
                if (fromLine) return fromLine;
                if (!line.stock_unit_id) return "";
                const inv = inventory.find(
                  (row) => String(row.stock_unit_id) === String(line.stock_unit_id),
                );
                return (inv?.grn_number || "").trim();
              }),
            );
            const grnNumsFromInventory = expandGrnNumberList(
              inventory
                .filter(
                  (row) =>
                    row.source === "grn" &&
                    row.order_id === orderIdForGrn &&
                    (Number(row.received_quantity) || 0) > 0,
                )
                .map((row) => (row.grn_number || "").trim()),
            );
            setLinkedGrnNumbers(
              grnNumsFromSelection.length > 0 ? grnNumsFromSelection : grnNumsFromInventory,
            );
            const grnStockLines = shipSelection
              ? ovfInventorySelectionToChallanLines(shipSelection, ovf, inventory)
              : mergeGrnInventoryStockToChallanLines(inventory, orderIdForGrn, ovf, order);
            setLines(grnStockLines.length > 0 ? grnStockLines : [emptyChallanLine()]);
            if (grnStockLines.length === 0) {
              setLoadError("No GRN warehouse stock found for this purchase order.");
            }
            return;
          }

          if (needsOrder && !orderIdForShip) {
            setLoadError(
              ovfShipSource === "ovf_po"
                ? "Create a purchase order before shipping PO items."
                : "Create a purchase order before combining inventory and PO items on one challan.",
            );
            setLines([emptyChallanLine()]);
            return;
          }

          const { order, vendor, batches } = await loadOrderContext(orderIdForShip);
          if (cancelled) return;
          setOrderId(orderIdForShip);
          setLoadedOrder(order);
          setGrnBatches(batches);
          if (vendor?.label) setVendorName(vendor.label);
          const customerPo = resolveCustomerPoFields(order, ovf);
          setPurchaseOrderNumber(customerPo.poNumber);
          setPoDate(customerPo.poDate || (ovf.po_date || "").slice(0, 10));

          if (ovfShipSource === "ovf_po") {
            setItemsSourceMode("full_po");
            setSelectedGrnKeys([]);
            const itemLines = fullPoChallanLines(order, "", ovf);
            setLines(itemLines.length > 0 ? itemLines : [emptyChallanLine()]);
            return;
          }

          // ovf_combined
          setItemsSourceMode("selected_grns");
          setSelectedGrnKeys([ovfStockSourceKey(ovfIdParam)]);
          const combined = mergeInventoryAndPoChallanLines(
            ovf.stock_allocations,
            order,
            ovf,
          );
          setLines(combined.length > 0 ? combined : [emptyChallanLine()]);
        } catch (err) {
          if (!cancelled) {
            setLoadError(
              formatApiError(err, "Failed to load OVF / purchase order for challan."),
            );
          }
        } finally {
          if (!cancelled) setPrefillBusy(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    if (!orderIdParam) {
      setPrefillBusy(false);
      return;
    }

    let cancelled = false;
    setPrefillBusy(true);
    setLoadError(null);
    void (async () => {
      try {
        const { order, vendor, poNumber, batches, ovf } = await loadOrderContext(orderIdParam);
        if (cancelled) return;
        setOrderId(orderIdParam);
        setLoadedOrder(order);
        setOvfContext(ovf);
        setGrnBatches(batches);
        const resolvedHeader = (() => {
          const h = buildChallanPrefillHeader(order, ovf, order.entity_code);
          return h;
        })();
        applyPrefillHeader(order, ovf, poNumber, vendor?.label || "");
        const fromGrn = grnKeyParam?.trim() || "";
        const kind = kindParam === "billing" || kindParam === "delivery_challan" ? kindParam : "";
        if (fromGrn && kind && resolvedHeader.customerName) {
          patchPendingGrnChallan(orderIdParam, fromGrn, kind, {
            customerName: resolvedHeader.customerName,
          });
        }
        if (fromGrn) {
          setItemsSourceMode("selected_grns");
          setSelectedGrnKeys([fromGrn]);
          setGrnKind(kind);
          // Skip the auto-apply effect triggered by the state setters above - we
          // already compute and set the correct lines immediately below.
          skipAutoApplyLinesRef.current = true;
          const resolvedBatches = resolveChallanReceiptBatches(batches, order);
          const matchedBatch = resolvedBatches.find(
            (batch) => receiptBatchKey(batch) === fromGrn,
          );
          if (kind === "billing") {
            try {
              let invoiceTask: ProcInvoiceGenerationTask | null = null;
              if (matchedBatch?.id) {
                invoiceTask = await getInvoiceGenerationTaskForBatch(String(matchedBatch.id));
              }
              if (!invoiceTask?.invoice_number) {
                invoiceTask = pickBillingInvoiceTask(
                  await listInvoiceGenerationTasksForOrder(orderIdParam),
                );
              }
              if (invoiceTask?.invoice_number) {
                setInvoiceNumber(String(invoiceTask.invoice_number).trim());
              }
              if (invoiceTask?.invoice_date) {
                setInvoiceDate(String(invoiceTask.invoice_date).slice(0, 10));
              } else if (matchedBatch?.vendor_invoice_date) {
                setInvoiceDate(String(matchedBatch.vendor_invoice_date).slice(0, 10));
              }
              if (!invoiceTask?.invoice_number && matchedBatch?.vendor_invoice_number) {
                setInvoiceNumber(String(matchedBatch.vendor_invoice_number).trim());
              }
            } catch {
              if (matchedBatch?.vendor_invoice_number) {
                setInvoiceNumber(String(matchedBatch.vendor_invoice_number).trim());
              }
              if (matchedBatch?.vendor_invoice_date) {
                setInvoiceDate(String(matchedBatch.vendor_invoice_date).slice(0, 10));
              }
            }
          }
          const merged = mergeSelectedGrnChallanLines(
            resolvedBatches,
            new Set([fromGrn]),
            order,
            "",
            kind || undefined,
          );
          setLines(merged.length > 0 ? merged : [emptyChallanLine()]);
        } else {
          setItemsSourceMode("full_po");
          setSelectedGrnKeys([]);
          // Skip the auto-apply effect - we set lines directly below.
          skipAutoApplyLinesRef.current = true;
          const itemLines = fullPoChallanLines(order, "", ovf);
          setLines(itemLines.length > 0 ? itemLines : [emptyChallanLine()]);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            formatApiError(
              err,
              "Failed to load purchase order. If this persists, run: cd apps/api && alembic upgrade head",
            ),
          );
        }
      } finally {
        if (!cancelled) setPrefillBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    challanId,
    grnKeyParam,
    batchKeyParam,
    kindParam,
    fromChallanParam,
    orderIdParam,
    isOvfShip,
    isPoGrnStock,
    ovfIdParam,
    ovfShipSource,
  ]);

  const setLineField = useCallback(
    (id: string, key: keyof Omit<DeliveryChallanLine, "id">, value: string) => {
      setLines((current) =>
        current.map((row) => (row.id === id ? { ...row, [key]: value } : row)),
      );
    },
    [],
  );

  function addLine() {
    setLines((current) => [...current, emptyChallanLine()]);
  }

  function removeLine(id: string) {
    setLines((current) => {
      const next = current.filter((row) => row.id !== id);
      return next.length > 0 ? next : [emptyChallanLine()];
    });
  }

  function resolveSaveGrnKeys(): string[] {
    if (selectedGrnKeys.length > 0) return selectedGrnKeys;
    if (isOvfGrnStock && ovfIdParam?.trim()) {
      return [ovfGrnStockSourceKey(ovfIdParam.trim(), recordId)];
    }
    if (isPoGrnStock && orderIdParam?.trim()) {
      return [
        (batchKeyParam || "").trim() || poGrnStockSourceKey(orderIdParam.trim(), recordId),
      ];
    }
    return selectedGrnKeys;
  }

  function buildSavePayload() {
    const entity = resolveEntityPdfBlock(
      loadedOrder,
      purchaseOrderNumber.trim(),
      ovfContext,
    );
    const resolvedKind: GrnChallanKind =
      grnKind === "billing" || grnKind === "delivery_challan"
        ? grnKind
        : "delivery_challan";
    return {
      id: recordId,
      orderId,
      challanNumber:
        resolvedKind === "billing"
          ? invoiceNumber.trim() || challanNumber.trim()
          : challanNumber.trim(),
      challanDate:
        resolvedKind === "billing"
          ? invoiceDate.trim() || challanDate
          : challanDate,
      entityName: entity.entityName,
      entityAddressBlock: entity.entityAddressBlock,
      entityGstBlock: entity.entityGstBlock,
      documentType:
        resolvedKind === "billing" ? PDF_DOCUMENT_TYPE_BILLING : PDF_DOCUMENT_TYPE_DC,
      copyLabel: PDF_COPY_LABEL,
      customerName: customerName.trim(),
      customerBillTo: customerBillTo.trim(),
      customerShipTo: customerShipTo.trim(),
      customerGstNo: customerGstNo.trim(),
      kindAttn: kindAttn.trim(),
      purchaseOrderNumber: purchaseOrderNumber.trim(),
      poDate,
      poNumberDate: poNumberDatePdf,
      shipFromAddress: entity.shipFromAddress,
      billingState: taxPlaceStates.sourceOfSupply,
      shippingState: taxPlaceStates.destinationOfSupply,
      taxPercentage: taxPercentagePdf,
      remarks: remarks.trim(),
      taxRemarks: "",
      preparedBy: preparedBy.trim(),
      deliveredBy: deliveredBy.trim(),
      vendorName: vendorName.trim(),
      itemsSourceMode,
      selectedGrnKeys: resolveSaveGrnKeys(),
      selectedGrnNumbers,
      grnKind: resolvedKind,
      invoiceNumber: invoiceNumber.trim() || undefined,
      invoiceDate: invoiceDate.trim() || undefined,
      sourceChallanId: sourceChallanId || undefined,
      lines,
      deliveryMode,
      transportDetails: transportDetails.trim(),
      driverVehicleDetails: driverVehicleDetails.trim(),
      senderSignature: senderSignature.trim(),
      receiverSignature: receiverSignature.trim(),
    };
  }

  function onSave() {
    if (grnKind === "billing") {
      if (!invoiceNumber.trim()) {
        setLoadError("Invoice number is required for billing GRNs.");
        return;
      }
      if (!invoiceDate.trim()) {
        setLoadError("Invoice date is required for billing GRNs.");
        return;
      }
    }
    let numberToSave = challanNumber.trim();
    if (grnKind === "billing") {
      numberToSave = invoiceNumber.trim() || numberToSave;
      if (numberToSave && numberToSave !== challanNumber.trim()) {
        setChallanNumber(numberToSave);
      }
    } else if (!numberToSave) {
      numberToSave = peekNextDeliveryChallanNumber();
      setChallanNumber(numberToSave);
    }
    if (!numberToSave) {
      setLoadError(
        grnKind === "billing" ? "Invoice number is required." : "Challan number is required.",
      );
      return;
    }
    if (!purchaseOrderNumber.trim()) {
      setLoadError("Customer PO number is required.");
      return;
    }
    if (!customerName.trim()) {
      setLoadError("Customer name is required.");
      return;
    }
    setLoadError(null);
    const existingChallan = recordId ? getDeliveryChallan(recordId) : null;
    const saved = upsertDeliveryChallan({
      ...buildSavePayload(),
      challanNumber: numberToSave,
    });
    syncOvfTimelineForChallan(saved, {
      ovfId: ovfIdParam,
      isCreate: !existingChallan,
    });
    ensureDeliveryStatusForChallan(
      saved,
      grnKind === "billing" && invoiceNumber.trim()
        ? {
          billStatus: "fully_billed",
          billInvoiceNumber: invoiceNumber.trim(),
          billInvoiceDate: invoiceDate.trim(),
          billedQuantity: String(
            saved.lines.reduce((sum, line) => sum + (Number(line.quantitySent) || 0), 0),
          ),
        }
        : { billStatus: "unbilled" },
    );
    if (grnKind === "billing" && invoiceNumber.trim()) {
      const status = getDeliveryStatus(saved.id);
      if (status) syncOvfTimelineForDeliveryStatus(saved, status, null);
    }
    const resolvedKind: GrnChallanKind =
      grnKind === "billing" || grnKind === "delivery_challan"
        ? grnKind
        : "delivery_challan";
    const saveKeys = resolveSaveGrnKeys();
    const batchKey = saveKeys[0] || `saved:${saved.id}`;
    let pendingOrderId = orderId || saved.orderId || saved.id;
    let source: "grn" | "ovf_stock" | "ovf_grn_stock" | "po_grn_stock" = "grn";
    if (batchKey.startsWith("ovf-stock:")) {
      source = "ovf_stock";
      pendingOrderId = ovfIdParam?.trim() || pendingOrderId;
    } else if (batchKey.startsWith("ovf-grn-stock:")) {
      source = "ovf_grn_stock";
    } else if (batchKey.startsWith("po-grn-stock:")) {
      source = "po_grn_stock";
    }
    upsertPendingGrnChallan({
      orderId: pendingOrderId,
      batchKey,
      grnNumber:
        selectedGrnNumbers.length > 0
          ? selectedGrnNumbers.join(", ")
          : source === "ovf_stock"
            ? "-"
            : batchKey.startsWith("ovf-")
              ? "-"
              : batchKey.startsWith("saved:")
                ? "-"
                : batchKey,
      purchaseOrderNumber: purchaseOrderNumber.trim(),
      vendorName: vendorName.trim(),
      customerName: customerName.trim(),
      kind: resolvedKind,
      status: "saved",
      docNumber:
        resolvedKind === "billing"
          ? invoiceNumber.trim() || challanNumber.trim() || numberToSave
          : challanNumber.trim() || numberToSave,
      docDate:
        resolvedKind === "billing"
          ? invoiceDate.trim() || challanDate.trim()
          : challanDate.trim(),
      savedRecordId: saved.id,
      source,
    });
    if (source === "po_grn_stock" || batchKey.startsWith("po-grn-stock:")) {
      clearPoGrnPendingShipSelection(batchKey);
    }
    // Keep stored challan kind aligned with the tab it belongs to.
    if (saved.grnKind !== resolvedKind) {
      upsertDeliveryChallan({ ...saved, grnKind: resolvedKind });
    }
    setHasSaved(true);
    if (!embedded) {
      router.push(
        resolvedKind === "billing"
          ? "/procurement/delivery-challan?tab=billing"
          : "/procurement/delivery-challan",
      );
      return;
    }
    setBanner("Delivery challan saved. You can download the PDF now.");
    if (embedded) {
      embedded.onSaved?.(recordId);
    }
  }

  function pickInvoiceAttachment(
    attachments: ReceiptBatchAttachment[],
  ): ReceiptBatchAttachment | null {
    if (!attachments.length) return null;
    const byName = attachments.find((file) =>
      /invoice/i.test(file.file_name || ""),
    );
    return byName || attachments[attachments.length - 1] || attachments[0] || null;
  }

  async function resolveBillingInvoiceBatchIds(): Promise<string[]> {
    const ids: string[] = [];
    const seen = new Set<string>();
    const push = (value: string | null | undefined) => {
      const id = String(value || "").trim();
      if (!id || seen.has(id)) return;
      seen.add(id);
      ids.push(id);
    };

    const keySet = new Set(
      (selectedGrnKeys.length > 0
        ? selectedGrnKeys
        : effectiveGrnBatches.map((batch) => receiptBatchKey(batch))
      )
        .map((key) => key.trim())
        .filter(Boolean),
    );
    for (const batch of effectiveGrnBatches) {
      if (keySet.has(receiptBatchKey(batch))) push(batch.id);
    }

    // po-grn-stock / synthetic keys often won't match receiptBatchKey — use invoice task batch.
    try {
      const resolvedOrderId = String(orderId || orderIdParam || loadedOrder?.id || "").trim();
      if (resolvedOrderId) {
        const tasks = await listInvoiceGenerationTasksForOrder(resolvedOrderId);
        const preferred =
          tasks.find(
            (task) =>
              task.status === "completed" &&
              Boolean(task.invoice_number?.trim()) &&
              (!invoiceNumber.trim() ||
                task.invoice_number?.trim() === invoiceNumber.trim()),
          ) ||
          pickBillingInvoiceTask(tasks) ||
          null;
        if (preferred?.receipt_batch_id) push(preferred.receipt_batch_id);
      }
    } catch {
      /* optional */
    }

    for (const batch of effectiveGrnBatches) push(batch.id);
    return ids;
  }

  async function resolveBillingInvoiceDocument(): Promise<{
    id: string;
    fileName: string;
  } | null> {
    if (invoiceDocument?.id) return invoiceDocument;
    const batchIds = await resolveBillingInvoiceBatchIds();
    for (const batchId of batchIds) {
      const batch = effectiveGrnBatches.find((row) => String(row.id) === batchId);
      try {
        const attachments =
          batch?.attachments && batch.attachments.length > 0
            ? batch.attachments
            : await listReceiptBatchAttachments(batchId);
        const file = pickInvoiceAttachment(attachments);
        if (file?.id) {
          return {
            id: String(file.id),
            fileName: file.file_name || "Invoice document",
          };
        }
      } catch {
        /* try next */
      }
    }
    return null;
  }

  async function refreshBillingInvoiceDocument() {
    if (grnKind !== "billing") {
      setInvoiceDocument(null);
      return;
    }
    try {
      const doc = await resolveBillingInvoiceDocument();
      setInvoiceDocument(doc);
    } catch {
      setInvoiceDocument(null);
    }
  }

  async function onAttachInvoiceDocument(file: File | null) {
    if (!file || grnKind !== "billing") return;
    const batchIds = await resolveBillingInvoiceBatchIds();
    const batchId = batchIds[0] || "";
    if (!batchId) {
      setLoadError("No billing GRN batch found to attach the invoice document.");
      return;
    }
    const branchId = loadedOrder?.branch_id || "";
    const companyId = loadedOrder?.company_id || null;
    if (!branchId) {
      setLoadError("Branch context is required to attach the invoice document.");
      return;
    }
    setInvoiceDocBusy(true);
    setLoadError(null);
    try {
      assertSafeUploadFile(file);
      const content_base64 = await fileToBase64(file);
      await saveReceiptBatchVendorInvoice(batchId, {
        vendor_invoice_number: invoiceNumber.trim() || null,
        vendor_invoice_date: invoiceDate.trim() || null,
        file_name: file.name,
        content_base64,
        content_type: file.type || null,
        branch_id: branchId,
        company_id: companyId,
      });
      // Refresh batch list so attachment summaries stick for later preview.
      if (orderId || orderIdParam) {
        const batches = await listOrderReceiptBatches(String(orderId || orderIdParam));
        setGrnBatches(batches);
      }
      const attachments = await listReceiptBatchAttachments(batchId);
      const attached = pickInvoiceAttachment(attachments);
      if (!attached?.id) {
        throw new Error("Invoice document uploaded but could not be opened yet. Try Preview again.");
      }
      setInvoiceDocument({
        id: String(attached.id),
        fileName: attached.file_name || file.name,
      });
      setBanner("Invoice document attached. You can preview it now.");
    } catch (err) {
      setLoadError(formatApiError(err, "Failed to attach invoice document"));
    } finally {
      setInvoiceDocBusy(false);
      if (invoiceFileInputRef.current) invoiceFileInputRef.current.value = "";
    }
  }

  async function onPreviewPdf() {
    setPdfBusy(true);
    setLoadError(null);
    try {
      // Billing: open the Accounts-attached invoice document, not a generated challan draft.
      if (grnKind === "billing") {
        const doc = await resolveBillingInvoiceDocument();
        if (!doc?.id) {
          throw new Error(
            "No invoice document is attached for this billing GRN yet. Attach the invoice file below, then preview.",
          );
        }
        setInvoiceDocument(doc);
        await openReceiptBatchAttachment(doc.id);
        return;
      }
      await openDeliveryChallanPdfPreview(pdfInput, { watermark: !hasSaved });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to preview PDF");
    } finally {
      setPdfBusy(false);
    }
  }

  async function onDownloadPdf() {
    if (!hasSaved) {
      setLoadError("Save the challan before downloading the PDF.");
      return;
    }
    setPdfBusy(true);
    setLoadError(null);
    try {
      await downloadDeliveryChallanPdf(pdfInput);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to download PDF");
    } finally {
      setPdfBusy(false);
    }
  }

  function onSelectedGrnKeysChange(next: string[]) {
    linesLockedFromSaveRef.current = false;
    setSelectedGrnKeys(next);
    if (itemsSourceMode === "selected_grns" && loadedOrder) {
      applyLinesFromSource("selected_grns", next, effectiveGrnBatches);
    }
  }

  function onItemsSourceModeChange(mode: ChallanItemsSourceMode) {
    linesLockedFromSaveRef.current = false;
    setItemsSourceMode(mode);
    applyLinesFromSource(mode, selectedGrnKeys, effectiveGrnBatches);
  }

  const savedChallan = hasSaved && recordId ? getDeliveryChallan(recordId) : null;
  const billStatus = savedChallan ? resolveChallanBillStatus(savedChallan) : "none";
  void billTick;

  const footerActions = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {hasSaved ? (
        <>
          <DeliveryBillTakenBadge status={billStatus === "none" ? "unbilled" : billStatus} />
          <DeliveryBillTakenButton
            status={billStatus === "none" ? "unbilled" : billStatus}
            onClick={() => setBillOpen(true)}
          />
        </>
      ) : null}
      {!isLocked && !hasSaved ? (
        <Button
          type="button"
          size="sm"
          className="cursor-pointer transition-colors duration-200"
          disabled={prefillBusy || !recordId}
          onClick={onSave}
        >
          Save
        </Button>
      ) : null}
      {grnKind !== "billing" ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="cursor-pointer transition-colors duration-200"
          onClick={() => void onPreviewPdf()}
          disabled={prefillBusy || pdfBusy}
          title={hasSaved ? "Preview PDF" : "Preview draft PDF with watermark"}
        >
          <Eye className="mr-1.5 size-3.5" />
          {hasSaved ? "Preview PDF" : "Preview draft"}
        </Button>
      ) : null}
      {hasSaved ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="cursor-pointer transition-colors duration-200"
          onClick={() => void onDownloadPdf()}
          disabled={prefillBusy || pdfBusy}
        >
          <FileDown className="mr-1.5 size-3.5" />
          Download PDF
        </Button>
      ) : null}
    </div>
  );

  if (isNew && !recordId) {
    return <p className="text-sm text-muted-foreground">Loading challan…</p>;
  }

  return (
    <div className={cn("space-y-4", embedded && "rounded-lg border border-border bg-card p-4")}>
      {!embedded ? (
        <PageHeader
          backHref={backHref}
          backLabel={backLabel}
          title={
            isLocked
              ? challanNumber || (grnKind === "billing" ? "Billing" : "Delivery challan")
              : isNew
                ? grnKind === "billing"
                  ? "Create billing"
                  : "Create delivery challan"
                : challanNumber || (grnKind === "billing" ? "Billing" : "Delivery challan")
          }
        />
      ) : null}

      {loadError ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {loadError}
        </div>
      ) : null}

      {prefillBusy ? (
        <p className="text-sm text-muted-foreground">Loading challan…</p>
      ) : null}

      {banner ? (
        <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          {banner}
        </div>
      ) : null}

      <fieldset
        disabled={isLocked || hasSaved}
        className="m-0 min-w-0 space-y-4 border-0 p-0 disabled:opacity-100"
      >
        <DeliverySectionCard
          title={grnKind === "billing" ? "Invoice details" : "Challan & purchase order"}
          icon={FileText}
        >
          {loadedOrder ? (
            <p className="mb-3 text-sm font-medium text-foreground">{entityPdf.entityName}</p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {grnKind === "billing" ? (
              <>
                <FinanceField label="Invoice number *">
                  <Input
                    value={invoiceNumber}
                    readOnly
                    className={READ_ONLY_INPUT}
                    placeholder="From Accounts My Jobs"
                    title="Fetched from Accounts invoice generation"
                  />
                </FinanceField>
                <FinanceField label="Invoice date *">
                  <Input
                    type="date"
                    value={invoiceDate}
                    readOnly
                    className={READ_ONLY_INPUT}
                    title="Fetched from Accounts invoice generation"
                  />
                </FinanceField>
                <div className="sm:col-span-2 lg:col-span-4 space-y-1.5">
                  <span className="text-xs font-medium text-foreground">Invoice document *</span>
                  <input
                    ref={invoiceFileInputRef}
                    type="file"
                    className="sr-only"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,application/pdf,image/*"
                    disabled={invoiceDocBusy || isLocked || hasSaved}
                    onChange={(e) => void onAttachInvoiceDocument(e.target.files?.[0] || null)}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 cursor-pointer gap-1.5 transition-colors duration-200"
                      disabled={invoiceDocBusy || isLocked || hasSaved}
                      onClick={() => invoiceFileInputRef.current?.click()}
                    >
                      <Paperclip className="size-3.5" aria-hidden />
                      {invoiceDocument?.id ? "Replace file" : "Attach document"}
                    </Button>
                    {invoiceDocument?.fileName ? (
                      <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-md border border-border/70 bg-muted/30 px-2 py-1 text-xs text-foreground">
                        <FileUp className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="truncate" title={invoiceDocument.fileName}>
                          {invoiceDocument.fileName}
                        </span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Accounts completed this invoice without a file — attach it here to preview.
                      </span>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                <FinanceField label="Challan number">
                  <Input
                    value={challanNumber}
                    onChange={
                      lockSourceFields ? undefined : (e) => setChallanNumber(e.target.value)
                    }
                    readOnly={lockSourceFields}
                    className={lockSourceFields ? READ_ONLY_INPUT : "h-8"}
                  />
                </FinanceField>
                <FinanceField label="Challan date">
                  <Input
                    type="date"
                    value={challanDate}
                    onChange={
                      lockSourceFields ? undefined : (e) => setChallanDate(e.target.value)
                    }
                    readOnly={lockSourceFields}
                    className={lockSourceFields ? READ_ONLY_INPUT : "h-8"}
                  />
                </FinanceField>
              </>
            )}
            <FinanceField label="Customer PO number">
              <Input
                value={purchaseOrderNumber}
                onChange={
                  lockSourceFields ? undefined : (e) => setPurchaseOrderNumber(e.target.value)
                }
                readOnly={lockSourceFields}
                className={lockSourceFields ? READ_ONLY_INPUT : "h-8"}
              />
            </FinanceField>
            <FinanceField label="Customer PO date">
              <Input
                type="date"
                value={poDate}
                onChange={lockSourceFields ? undefined : (e) => setPoDate(e.target.value)}
                readOnly={lockSourceFields}
                className={lockSourceFields ? READ_ONLY_INPUT : "h-8"}
              />
            </FinanceField>
          </div>
        </DeliverySectionCard>

        <DeliverySectionCard title="Customer" icon={FileText}>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
            <FinanceField label="Customer name">
              <Input
                value={customerName}
                onChange={
                  lockSourceFields ? undefined : (e) => setCustomerName(e.target.value)
                }
                readOnly={lockSourceFields}
                className={lockSourceFields ? READ_ONLY_INPUT : "h-8"}
              />
            </FinanceField>
            <FinanceField label="Customer GST no.">
              <Input
                value={customerGstNo}
                onChange={
                  lockSourceFields ? undefined : (e) => setCustomerGstNo(e.target.value)
                }
                readOnly={lockSourceFields}
                className={lockSourceFields ? READ_ONLY_INPUT : "h-8"}
              />
            </FinanceField>
            <FinanceField label="Customer bill to">
              <FinanceTextarea
                value={customerBillTo}
                onChange={
                  lockSourceFields ? undefined : (e) => setCustomerBillTo(e.target.value)
                }
                readOnly={lockSourceFields}
                rows={4}
                className={lockSourceFields ? "cursor-default bg-muted/40" : undefined}
              />
            </FinanceField>
            <FinanceField label="Customer ship to">
              <FinanceTextarea
                value={customerShipTo}
                onChange={
                  lockSourceFields ? undefined : (e) => setCustomerShipTo(e.target.value)
                }
                readOnly={lockSourceFields}
                rows={4}
                className={lockSourceFields ? "cursor-default bg-muted/40" : undefined}
              />
            </FinanceField>
            <FinanceField label="Kind attn / site contact">
              <Input
                value={kindAttn}
                onChange={(e) => setKindAttn(e.target.value)}
                className="h-8"
              />
            </FinanceField>
            <FinanceField label="Remarks">
              <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} className="h-8" />
            </FinanceField>
          </div>
        </DeliverySectionCard>

        {null /* Items on challan / Source section hidden */}

        <DeliverySectionCard title="Line items" icon={Package}>
          <div className="erp-scroll overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-12 px-2 py-2 font-medium">S.No</th>
                  <th className="min-w-[260px] px-2 py-2 font-medium">Product</th>
                  <th className="min-w-[200px] px-2 py-2 font-medium">Description</th>
                  <th className="w-24 px-2 py-2 font-medium">HSN/SAC</th>
                  <th className="w-20 px-2 py-2 font-medium">Asset</th>
                  <th className="w-20 px-2 py-2 font-medium">Qty</th>
                  <th className="w-24 px-2 py-2 font-medium">Rate</th>
                  {lockSourceFields ? null : (
                    <th className="w-16 px-2 py-2 font-medium"> </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {lines.map((row, index) => (
                  <tr key={row.id} className="border-b border-border/70 align-top">
                    <td className="px-2 py-2 tabular-nums text-muted-foreground">{index + 1}</td>
                    <td className="px-2 py-2">
                      {fromInventory && isNew && !lockSourceFields ? (
                        <FinanceSelect
                          value={row.product}
                          onChange={(e) => applyInventoryProductToLine(row.id, e.target.value)}
                          className="h-8 min-w-[240px]"
                          aria-label={`Inventory product for line ${index + 1}`}
                          disabled={isLocked || isOvfPrefilledLines}
                        >
                          <option value="">Select inventory item…</option>
                          {inventoryProductOptions.map((opt) => (
                            <option key={opt.name} value={opt.name}>
                              {opt.name}
                              {opt.availableQty > 0 ? ` (${opt.availableQty} avail.)` : ""}
                            </option>
                          ))}
                          {row.product &&
                            !inventoryProductOptions.some((opt) => opt.name === row.product) ? (
                            <option value={row.product}>{row.product}</option>
                          ) : null}
                        </FinanceSelect>
                      ) : (
                        <Input
                          value={row.product}
                          onChange={
                            lockSourceFields
                              ? undefined
                              : (e) => setLineField(row.id, "product", e.target.value)
                          }
                          readOnly={lockSourceFields}
                          className={cn(
                            "min-w-[240px]",
                            lockSourceFields ? READ_ONLY_INPUT : "h-8",
                          )}
                          placeholder="Product name"
                          title={row.product || undefined}
                        />
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        value={(row.itemName || "").replace(/^\[quote:[^\]]+\]\s*/i, "")}
                        onChange={
                          lockSourceFields
                            ? undefined
                            : (e) => setLineField(row.id, "itemName", e.target.value)
                        }
                        readOnly={lockSourceFields}
                        className={cn(
                          "min-w-[180px]",
                          lockSourceFields ? READ_ONLY_INPUT : "h-8",
                        )}
                        placeholder="Description"
                        title={
                          (row.itemName || "").replace(/^\[quote:[^\]]+\]\s*/i, "") || undefined
                        }
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        value={row.hsnSac}
                        onChange={
                          lockSourceFields
                            ? undefined
                            : (e) => setLineField(row.id, "hsnSac", e.target.value)
                        }
                        readOnly={lockSourceFields}
                        className={lockSourceFields ? READ_ONLY_INPUT : "h-8"}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        value={row.assetNo}
                        onChange={
                          lockSourceFields
                            ? undefined
                            : (e) => setLineField(row.id, "assetNo", e.target.value)
                        }
                        readOnly={lockSourceFields}
                        className={lockSourceFields ? READ_ONLY_INPUT : "h-8"}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        value={row.quantitySent}
                        onChange={
                          lockSourceFields
                            ? undefined
                            : (e) => setLineField(row.id, "quantitySent", e.target.value)
                        }
                        readOnly={lockSourceFields}
                        className={cn(
                          NO_SPINNER,
                          lockSourceFields ? READ_ONLY_INPUT : "h-8",
                        )}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        value={row.rate}
                        onChange={
                          lockSourceFields
                            ? undefined
                            : (e) => setLineField(row.id, "rate", e.target.value)
                        }
                        readOnly={lockSourceFields}
                        className={cn(
                          NO_SPINNER,
                          lockSourceFields ? READ_ONLY_INPUT : "h-8",
                        )}
                      />
                    </td>
                    {lockSourceFields ? null : (
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          aria-label="Remove line"
                          title="Remove"
                          className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-destructive transition-colors duration-200 hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
                          onClick={() => removeLine(row.id)}
                          disabled={isOvfPrefilledLines}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {lockSourceFields ? null : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 h-7 cursor-pointer px-2 text-xs"
              onClick={addLine}
              disabled={isOvfPrefilledLines}
            >
              Add item
            </Button>
          )}

          <div className="mt-4 flex justify-end">
            <div className="w-full max-w-md overflow-hidden rounded-md border border-border text-sm">
              <table className="w-full">
                <tbody>
                  {taxSummary.rows.map((row) => (
                    <tr
                      key={row.label}
                      className="border-b border-border/70 last:border-b-0"
                    >
                      <td
                        className={cn(
                          "px-3 py-2 text-foreground",
                          row.emphasis && "font-semibold",
                        )}
                      >
                        {row.rateLabel ? `${row.label} (${row.rateLabel})` : row.label}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right tabular-nums",
                          row.emphasis && "font-semibold",
                        )}
                      >
                        {row.amount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </DeliverySectionCard>

        <DeliverySectionCard title="Transport" icon={Truck}>
          <fieldset className="mb-4 space-y-2">
            <legend className="text-xs font-medium text-muted-foreground">Mode of delivery</legend>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-6">
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="challan-delivery-mode"
                  className="mt-0.5 size-4 cursor-pointer accent-primary"
                  checked={deliveryMode === "NRGP"}
                  onChange={() => setDeliveryMode("NRGP")}
                />
                <span>
                  <span className="font-medium text-foreground">NRGP</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Non-returnable gate pass
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="challan-delivery-mode"
                  className="mt-0.5 size-4 cursor-pointer accent-primary"
                  checked={deliveryMode === "RGP"}
                  onChange={() => setDeliveryMode("RGP")}
                />
                <span>
                  <span className="font-medium text-foreground">RGP</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Returnable gate pass
                  </span>
                </span>
              </label>
            </div>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <FinanceField label="Transport details">
              <FinanceTextarea
                value={transportDetails}
                onChange={(e) => setTransportDetails(e.target.value)}
                rows={3}
              />
            </FinanceField>
            <FinanceField label="Driver / vehicle details">
              <FinanceTextarea
                value={driverVehicleDetails}
                onChange={(e) => setDriverVehicleDetails(e.target.value)}
                rows={3}
              />
            </FinanceField>
          </div>
        </DeliverySectionCard>

        <DeliverySectionCard title="Signatures" icon={PenLine}>
          <div className="grid gap-3 sm:grid-cols-2">
            <FinanceField label="Signature of sender">
              <FinanceTextarea
                value={senderSignature}
                onChange={(e) => setSenderSignature(e.target.value)}
                rows={2}
              />
            </FinanceField>
            <FinanceField label="Signature of receiver">
              <FinanceTextarea
                value={receiverSignature}
                onChange={(e) => setReceiverSignature(e.target.value)}
                rows={2}
              />
            </FinanceField>
          </div>
        </DeliverySectionCard>
      </fieldset>

      <div className="border-t border-border/60 pt-4">{footerActions}</div>

      <DeliveryStatusBillDialog
        open={billOpen}
        challanId={billOpen ? recordId : null}
        onClose={() => setBillOpen(false)}
        onSaved={() => setBillTick((n) => n + 1)}
      />
    </div>
  );
}
