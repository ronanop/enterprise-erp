"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { DeliveryStatusBillDialog } from "@/components/procurement/delivery-status-bill-dialog";
import {
  DeliveryBillTakenBadge,
  DeliveryBillTakenButton,
} from "@/components/procurement/delivery-bill-taken-badge";
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
import {
  fullPoChallanLines,
  mergeInventoryAndPoChallanLines,
  mergeOvfStockAllocationsToChallanLines,
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
  type GrnChallanKind,
} from "@/utils/delivery-challan-storage";
import { resolveChallanBillStatus } from "@/utils/delivery-challan-bill";
import { patchPendingGrnChallan } from "@/utils/grn-challan-pending";
import { deliveryStatusUpdateHref } from "@/utils/delivery-status-routes";
import { ensureDeliveryStatusForChallan } from "@/utils/delivery-status-storage";
import { ovfStockSourceKey } from "@/utils/ovf-stock";

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
  };
};

export function DeliveryChallanFormPage({ challanId, embedded }: DeliveryChallanFormPageProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderIdParam = embedded?.orderId ?? searchParams.get("orderId");
  const grnKeyParam = searchParams.get("grnKey");
  const kindParam = searchParams.get("kind") as GrnChallanKind | null;
  const ovfIdParam = searchParams.get("ovfId");
  const ovfShipSource = searchParams.get("source");
  const isOvfShip =
    Boolean(ovfIdParam?.trim()) &&
    (ovfShipSource === "ovf_stock" ||
      ovfShipSource === "ovf_po" ||
      ovfShipSource === "ovf_combined");
  const isOvfStock = Boolean(ovfIdParam?.trim()) && ovfShipSource === "ovf_stock";
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
  const [grnKind, setGrnKind] = useState<GrnChallanKind | "">("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
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
    setGrnKind(saved.grnKind ?? "");
    setInvoiceNumber(saved.invoiceNumber ?? "");
    setInvoiceDate(saved.invoiceDate ?? "");
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
          const seed = (ovf.ovf_no || "OVF").replace(/\//g, "-").slice(-6);
          setChallanNumber((current) => current || `CT/23-24/${seed}`);

          const orderIdForShip = (orderIdParam || ovf.purchase_order_id || "").trim();
          const needsOrder =
            ovfShipSource === "ovf_po" || ovfShipSource === "ovf_combined";

          if (ovfShipSource === "ovf_stock") {
            setOrderId(ovfIdParam);
            setItemsSourceMode("selected_grns");
            setSelectedGrnKeys([ovfStockSourceKey(ovfIdParam)]);
            const allocLines = mergeOvfStockAllocationsToChallanLines(ovf.stock_allocations);
            setLines(allocLines.length > 0 ? allocLines : [emptyChallanLine()]);
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
          const companyPo = order.company_po_number?.trim() || order.document_number || "";
          if (companyPo) setPurchaseOrderNumber(companyPo);
          if (order.document_date) setPoDate(String(order.document_date).slice(0, 10));

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
          // Skip the auto-apply effect triggered by the state setters above — we
          // already compute and set the correct lines immediately below.
          skipAutoApplyLinesRef.current = true;
          const resolvedBatches = resolveChallanReceiptBatches(batches, order);
          const matchedBatch = resolvedBatches.find(
            (batch) => receiptBatchKey(batch) === fromGrn,
          );
          if (matchedBatch?.vendor_invoice_number) {
            setInvoiceNumber(String(matchedBatch.vendor_invoice_number).trim());
          }
          if (matchedBatch?.vendor_invoice_date) {
            setInvoiceDate(String(matchedBatch.vendor_invoice_date).slice(0, 10));
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
          // Skip the auto-apply effect — we set lines directly below.
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
  }, [challanId, grnKeyParam, kindParam, orderIdParam, isOvfShip, ovfIdParam, ovfShipSource]);

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
      grnKind: grnKind || undefined,
      invoiceNumber: invoiceNumber.trim() || undefined,
      invoiceDate: invoiceDate.trim() || undefined,
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
    setLoadError(null);
    const saved = upsertDeliveryChallan(buildSavePayload());
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
    if (orderId && selectedGrnKeys[0]) {
      const gk = grnKind === "billing" || grnKind === "delivery_challan" ? grnKind : undefined;
      if (gk) {
        patchPendingGrnChallan(orderId, selectedGrnKeys[0], gk, {
          status: "saved",
          docNumber: grnKind === "billing" ? invoiceNumber.trim() || challanNumber.trim() : challanNumber.trim(),
          docDate: grnKind === "billing" ? invoiceDate.trim() || challanDate.trim() : challanDate.trim(),
          savedRecordId: recordId,
        });
      }
    }
    setHasSaved(true);
    if (!embedded) {
      router.push(deliveryStatusUpdateHref(recordId));
      return;
    }
    setBanner("Delivery challan saved. You can download the PDF now.");
    if (embedded) {
      embedded.onSaved?.(recordId);
    }
  }

  async function onPreviewPdf() {
    setPdfBusy(true);
    setLoadError(null);
    try {
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
          {selectedGrnNumbers.length > 0 ? (
            <FinanceField label="GRN number">
              <Input value={selectedGrnNumbers.join(", ")} readOnly className="h-8 bg-muted/30" />
            </FinanceField>
          ) : null}
        </div>
        {grnKind === "billing" ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <FinanceField label="Invoice number *">
              <Input
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="h-8"
                placeholder="Customer / cache invoice no."
              />
            </FinanceField>
            <FinanceField label="Invoice date *">
              <Input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="h-8"
              />
            </FinanceField>
          </div>
        ) : null}
        {null}
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
                <th className="w-16 px-2 py-2 font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((row, index) => (
                <tr key={row.id} className="border-b border-border/70 align-top">
                  <td className="px-2 py-2 tabular-nums text-muted-foreground">{index + 1}</td>
                  <td className="px-2 py-2">
                    <Input
                      value={row.product}
                      onChange={(e) => setLineField(row.id, "product", e.target.value)}
                      className="h-8 min-w-[240px]"
                      placeholder="Product name"
                      title={row.product || undefined}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      value={row.itemName}
                      onChange={(e) => setLineField(row.id, "itemName", e.target.value)}
                      className="h-8 min-w-[180px]"
                      placeholder="Description"
                      title={row.itemName || undefined}
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
                      className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-destructive transition-colors duration-200 hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={() => removeLine(row.id)}
                      disabled={isOvfStock}
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
          disabled={isOvfStock}
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
