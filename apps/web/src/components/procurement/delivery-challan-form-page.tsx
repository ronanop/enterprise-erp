"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Eye,
  FileDown,
  FileText,
  ListChecks,
  Package,
  PenLine,
  Trash2,
  Truck,
} from "lucide-react";

import { FinanceField, FinanceTextarea } from "@/components/finance/journals/finance-form-field";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DeliverySectionCard } from "@/components/procurement/delivery-section-card";
import { ApiClientError, formatApiError } from "@/services/api-client";
import {
  getPurchaseOrder,
  getScmOvfPreview,
  listOrderReceiptBatches,
  listVendorOptions,
  type ProcOrder,
  type ScmOvfPreview,
  type ScmReceiptBatch,
  type VendorOption,
} from "@/services/procurement-service";
import { ChallanGrnMultiSelect } from "@/components/procurement/challan-grn-multi-select";
import {
  fullPoChallanLines,
  mergeSelectedGrnChallanLines,
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
  upsertDeliveryChallan,
  type DeliveryChallanLine,
  type DeliveryChallanMode,
} from "@/utils/delivery-challan-storage";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const NO_SPINNER =
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

const PDF_DOCUMENT_TYPE = "DELIVERY CHALLAN";
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

function challanBackLabel(backHref: string): string {
  if (/\/orders\/[^/]+/.test(backHref)) return "Purchase order";
  if (backHref.includes("/grns")) return "GRNs";
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
    /** Parent PageHeader triggers save via this ref when embedded. */
    saveRef?: RefObject<(() => void) | null>;
  };
};

export function DeliveryChallanFormPage({ challanId, embedded }: DeliveryChallanFormPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderIdParam = embedded?.orderId ?? searchParams.get("orderId");
  const returnToParam = searchParams.get("returnTo");
  const returnTo = useMemo(() => safeProcurementReturnTo(returnToParam), [returnToParam]);
  const backHref = resolveChallanModuleExitHref(returnTo);
  const backLabel = challanBackLabel(backHref);
  const isNew = !challanId;
  const isLocked = Boolean(challanId) && !embedded;

  const [recordId, setRecordId] = useState(() => challanId ?? "");
  useEffect(() => {
    if (!challanId && !recordId) {
      setRecordId(crypto.randomUUID());
    }
  }, [challanId, recordId]);

  const [orderId, setOrderId] = useState<string | null>(orderIdParam);
  const [challanNumber, setChallanNumber] = useState("");
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
  const [loadedOrder, setLoadedOrder] = useState<ProcOrder | null>(null);
  const [ovfContext, setOvfContext] = useState<ScmOvfPreview | null>(null);
  const [grnBatches, setGrnBatches] = useState<ScmReceiptBatch[]>([]);
  const [banner, setBanner] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [prefillBusy, setPrefillBusy] = useState(Boolean(challanId || orderIdParam));
  const skipAutoApplyLinesRef = useRef(Boolean(challanId));
  const linesLockedFromSaveRef = useRef(Boolean(challanId));

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
        const next = fullPoChallanLines(loadedOrder, defaultShipTo);
        setLines(next.length > 0 ? next : [emptyChallanLine()]);
        return;
      }
      const merged = mergeSelectedGrnChallanLines(
        batches,
        new Set(keys),
        loadedOrder,
        defaultShipTo,
      );
      setLines(merged.length > 0 ? merged : [emptyChallanLine()]);
    },
    [defaultShipTo, effectiveGrnBatches, itemsSourceMode, loadedOrder, selectedGrnKeys],
  );

  const selectedGrnNumbers = useMemo(() => {
    const keySet = new Set(selectedGrnKeys);
    return effectiveGrnBatches
      .filter((batch) => keySet.has(receiptBatchKey(batch)))
      .map((batch) => batch.grn_number);
  }, [effectiveGrnBatches, selectedGrnKeys]);

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
    const activeLines = lines.filter((ln) => ln.itemName.trim());
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
        documentType: PDF_DOCUMENT_TYPE,
        copyLabel: PDF_COPY_LABEL,
        challanNumber,
        challanDate,
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
    const challanSeed = (companyPoNumber || order.document_number || "PO").replace(/\//g, "-").slice(-6);
    setChallanNumber(`CT/23-24/${challanSeed}`);
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
            const { order, batches, ovf } = await loadOrderContext(saved.orderId!);
            setLoadedOrder(order);
            setOvfContext(ovf);
            setGrnBatches(batches);
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
        applyPrefillHeader(order, ovf, poNumber, vendor?.label || "");
        setItemsSourceMode("full_po");
        setSelectedGrnKeys([]);
        skipAutoApplyLinesRef.current = false;
        const itemLines = fullPoChallanLines(order, "");
        setLines(itemLines.length > 0 ? itemLines : [emptyChallanLine()]);
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
  }, [challanId, orderIdParam]);

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

  function buildSavePayload() {
    const entity = resolveEntityPdfBlock(
      loadedOrder,
      purchaseOrderNumber.trim(),
      ovfContext,
    );
    return {
      id: recordId,
      orderId,
      challanNumber: challanNumber.trim(),
      challanDate,
      entityName: entity.entityName,
      entityAddressBlock: entity.entityAddressBlock,
      entityGstBlock: entity.entityGstBlock,
      documentType: PDF_DOCUMENT_TYPE,
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
      selectedGrnKeys,
      selectedGrnNumbers,
      lines,
      deliveryMode,
      transportDetails: transportDetails.trim(),
      driverVehicleDetails: driverVehicleDetails.trim(),
      senderSignature: senderSignature.trim(),
      receiverSignature: receiverSignature.trim(),
    };
  }

  function onSave() {
    if (!challanNumber.trim()) {
      setLoadError("Challan number is required.");
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
    upsertDeliveryChallan(buildSavePayload());
    setBanner("Delivery challan saved.");
    if (embedded) {
      embedded.onSaved?.(recordId);
      return;
    }
    window.setTimeout(() => {
      router.push(resolveChallanModuleExitHref(returnTo));
    }, 400);
  }

  const saveHandlerRef = useRef(onSave);
  saveHandlerRef.current = onSave;

  useEffect(() => {
    const saveRef = embedded?.saveRef;
    if (!saveRef) return;
    saveRef.current = () => saveHandlerRef.current();
    return () => {
      saveRef.current = null;
    };
  }, [embedded]);

  async function onPreviewPdf() {
    setPdfBusy(true);
    setLoadError(null);
    try {
      await openDeliveryChallanPdfPreview(pdfInput);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to preview PDF");
    } finally {
      setPdfBusy(false);
    }
  }

  async function onDownloadPdf() {
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

  const pdfActions = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="cursor-pointer transition-colors duration-200"
        onClick={() => void onPreviewPdf()}
        disabled={prefillBusy || pdfBusy}
      >
        <Eye className="mr-1.5 size-3.5" />
        Preview PDF
      </Button>
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
    </div>
  );

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      {!embedded ? (
        <Link
          href={backHref}
          className={cn(
            buttonVariants({ size: "sm", variant: "outline" }),
            "cursor-pointer transition-colors duration-200",
          )}
        >
          <ArrowLeft className="mr-1.5 size-3.5" />
          Back
        </Link>
      ) : null}
      {!embedded && !isLocked ? (
        <Button
          type="button"
          size="sm"
          className="cursor-pointer transition-colors duration-200"
          disabled={prefillBusy || !recordId}
          onClick={onSave}
        >
          Save challan
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
          title={isLocked ? challanNumber || "Delivery challan" : isNew ? "Create delivery challan" : challanNumber || "Delivery challan"}
          actions={headerActions}
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
        disabled={isLocked}
        className="m-0 min-w-0 space-y-4 border-0 p-0 disabled:opacity-100"
      >
      <DeliverySectionCard title="Challan & purchase order" icon={FileText}>
        {loadedOrder ? (
          <p className="mb-3 text-sm font-medium text-foreground">{entityPdf.entityName}</p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FinanceField label="Challan number">
            <Input
              value={challanNumber}
              onChange={(e) => setChallanNumber(e.target.value)}
              className="h-8"
            />
          </FinanceField>
          <FinanceField label="Challan date">
            <Input
              type="date"
              value={challanDate}
              onChange={(e) => setChallanDate(e.target.value)}
              className="h-8"
            />
          </FinanceField>
          <FinanceField label="Customer PO number">
            <Input
              value={purchaseOrderNumber}
              onChange={(e) => setPurchaseOrderNumber(e.target.value)}
              className="h-8"
            />
          </FinanceField>
          <FinanceField label="Customer PO date">
            <Input
              type="date"
              value={poDate}
              onChange={(e) => setPoDate(e.target.value)}
              className="h-8"
            />
          </FinanceField>
        </div>
      </DeliverySectionCard>

      <DeliverySectionCard title="Customer" icon={FileText}>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          <FinanceField label="Customer name">
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="h-8"
              placeholder="OVF customer name; falls back to account / company if blank"
            />
          </FinanceField>
          <FinanceField label="Customer GST no.">
            <Input
              value={customerGstNo}
              onChange={(e) => setCustomerGstNo(e.target.value)}
              className="h-8"
            />
          </FinanceField>
          <FinanceField label="Customer bill to">
            <FinanceTextarea
              value={customerBillTo}
              onChange={(e) => setCustomerBillTo(e.target.value)}
              rows={4}
            />
          </FinanceField>
          <FinanceField label="Customer ship to">
            <FinanceTextarea
              value={customerShipTo}
              onChange={(e) => setCustomerShipTo(e.target.value)}
              rows={4}
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
          <FinanceField label="Prepared by">
            <Input
              value={preparedBy}
              onChange={(e) => setPreparedBy(e.target.value)}
              className="h-8"
            />
          </FinanceField>
          <FinanceField label="Delivered by">
            <Input
              value={deliveredBy}
              onChange={(e) => setDeliveredBy(e.target.value)}
              className="h-8"
            />
          </FinanceField>
        </div>
      </DeliverySectionCard>

      {loadedOrder ? (
        <DeliverySectionCard title="Items on challan" icon={ListChecks}>
          <div className="space-y-4">
            <fieldset className="space-y-2">
              <legend className="text-xs font-medium text-muted-foreground">Source</legend>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="challan-items-source"
                    className="size-4 cursor-pointer accent-primary"
                    checked={itemsSourceMode === "full_po"}
                    onChange={() => onItemsSourceModeChange("full_po")}
                  />
                  <span className="font-medium text-foreground">All PO line items</span>
                </label>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="challan-items-source"
                    className="mt-0.5 size-4 cursor-pointer accent-primary"
                    checked={itemsSourceMode === "selected_grns"}
                    onChange={() => onItemsSourceModeChange("selected_grns")}
                    disabled={effectiveGrnBatches.length === 0}
                  />
                  <span>
                    <span className="font-medium text-foreground">Selected GRN(s)</span>
                    {effectiveGrnBatches.length === 0 ? (
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        Open this form from a PO with saved GRN receipts (GRN list → Create
                        challan).
                      </span>
                    ) : null}
                  </span>
                </label>
              </div>
            </fieldset>
            {itemsSourceMode === "selected_grns" && effectiveGrnBatches.length > 0 ? (
              <ChallanGrnMultiSelect
                batches={effectiveGrnBatches}
                selectedKeys={selectedGrnKeys}
                disabled={isLocked}
                onChange={onSelectedGrnKeysChange}
              />
            ) : null}
          </div>
        </DeliverySectionCard>
      ) : null}

      <DeliverySectionCard title="Line items" icon={Package}>
        <div className="erp-scroll overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-2 py-2 font-medium">S.No</th>
                <th className="px-2 py-2 font-medium">Description</th>
                <th className="w-24 px-2 py-2 font-medium">HSN/SAC</th>
                <th className="w-20 px-2 py-2 font-medium">Asset</th>
                <th className="w-20 px-2 py-2 font-medium">Qty</th>
                <th className="w-24 px-2 py-2 font-medium">Rate (vendor)</th>
                <th className="w-16 px-2 py-2 font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((row, index) => (
                <tr key={row.id} className="border-b border-border/70 align-top">
                  <td className="px-2 py-2 tabular-nums text-muted-foreground">{index + 1}</td>
                  <td className="px-2 py-2">
                    <Input
                      value={row.itemName}
                      onChange={(e) => setLineField(row.id, "itemName", e.target.value)}
                      className="h-8"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      value={row.hsnSac}
                      onChange={(e) => setLineField(row.id, "hsnSac", e.target.value)}
                      className="h-8"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      value={row.assetNo}
                      onChange={(e) => setLineField(row.id, "assetNo", e.target.value)}
                      className="h-8"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      value={row.quantitySent}
                      onChange={(e) => setLineField(row.id, "quantitySent", e.target.value)}
                      className={cn("h-8", NO_SPINNER)}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      value={row.rate}
                      onChange={(e) => setLineField(row.id, "rate", e.target.value)}
                      className={cn("h-8", NO_SPINNER)}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      aria-label="Remove line"
                      title="Remove"
                      className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-destructive transition-colors duration-200 hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      onClick={() => removeLine(row.id)}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2 h-7 cursor-pointer px-2 text-xs"
          onClick={addLine}
        >
          Add item
        </Button>

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

      <div className="border-t border-border/60 pt-4">{pdfActions}</div>
    </div>
  );
}
