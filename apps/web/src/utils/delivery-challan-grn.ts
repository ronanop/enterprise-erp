import {
  getScmOvfPreview,
  type ProcOrder,
  type ScmOvfPreview,
  type ScmOvfStockAllocation,
  type ScmReceiptBatch,
} from "@/services/procurement-service";
import {
  buildChallanPrefillHeader,
  orderLineToChallanLine,
  resolveChallanTaxSupplyStates,
  resolveEntityPdfBlock,
} from "@/utils/delivery-challan-prefill";
import {
  emptyChallanLine,
  listDeliveryChallansByOrderId,
  upsertDeliveryChallan,
  type DeliveryChallanLine,
  type DeliveryChallanRecord,
  type GrnChallanKind,
} from "@/utils/delivery-challan-storage";
import { ovfProductKey } from "@/utils/ovf-stock";

export type ChallanItemsSourceMode = "full_po" | "selected_grns";

export function receiptBatchKey(batch: ScmReceiptBatch): string {
  if (batch.id) return String(batch.id);
  return `seq:${batch.sequence ?? 0}`;
}

function poBase(order: ProcOrder): string {
  return (order.company_po_number || order.document_number || "PO").trim();
}

function grnNumberForSequence(order: ProcOrder, sequence: number, maxSeq: number): string {
  const base = poBase(order);
  const current = (order.current_grn_number || "").trim();
  if (sequence === maxSeq && current) return current;
  return `${base}/${String(sequence).padStart(3, "0")}`;
}

function orderLinesForLatestBatch(order: ProcOrder): ScmReceiptBatch["lines"] {
  const lines = order.lines || [];
  const batchId = order.current_receipt_batch_id;
  const batchLines: ScmReceiptBatch["lines"] = [];
  for (const ln of lines) {
    const lastQty = Number(ln.last_receipt_qty) || 0;
    const received = Number(ln.quantity_received) || 0;
    let qty = 0;
    if (batchId && String(ln.last_receipt_batch_id || "") === String(batchId) && lastQty > 0) {
      qty = lastQty;
    } else if (!batchId && received > 0) {
      qty = received;
    }
    if (qty <= 0) continue;
    batchLines.push({
      order_line_id: ln.id,
      line_number: ln.line_number,
      product_name: ln.product_name,
      quantity: qty,
    });
  }
  return batchLines;
}

/** All GRN numbers for this PO (1..grn_sequence), with line detail where we have it. */
export function receiptBatchesFromOrder(order: ProcOrder): ScmReceiptBatch[] {
  const maxSeq = Math.max(
    Number(order.grn_sequence) || 0,
    parseGrnSequenceFromNumber(order.current_grn_number),
    1,
  );
  const latestLines = orderLinesForLatestBatch(order);
  const hasAnyReceived = (order.lines || []).some((ln) => Number(ln.quantity_received) > 0);
  if (maxSeq <= 1 && latestLines.length === 0 && !hasAnyReceived) return [];

  const out: ScmReceiptBatch[] = [];
  for (let s = 1; s <= maxSeq; s++) {
    const isLatest = s === maxSeq;
    out.push({
      id: isLatest ? order.current_receipt_batch_id ?? null : null,
      sequence: s,
      grn_number: grnNumberForSequence(order, s, maxSeq),
      receipt_at: isLatest ? order.current_receipt_batch_at ?? null : null,
      lines: isLatest ? latestLines : [],
    });
  }
  return out;
}

function parseGrnSequenceFromNumber(grnNumber: string | null | undefined): number {
  const value = (grnNumber || "").trim();
  if (!value) return 0;
  const tail = value.split("/").pop() || "";
  const n = Number.parseInt(tail, 10);
  return Number.isFinite(n) ? n : 0;
}

function mergeReceiptBatchLists(
  apiBatches: ScmReceiptBatch[],
  order: ProcOrder,
): ScmReceiptBatch[] {
  const fromOrder = receiptBatchesFromOrder(order);
  const bySeq = new Map<number, ScmReceiptBatch>();
  for (const batch of apiBatches) {
    const seq = Number(batch.sequence) || 0;
    if (seq > 0) bySeq.set(seq, batch);
  }
  const maxSeq = Math.max(
    ...[...bySeq.keys(), ...fromOrder.map((b) => b.sequence || 0), Number(order.grn_sequence) || 0],
    0,
  );
  if (maxSeq <= 0) return apiBatches.length > 0 ? apiBatches : fromOrder;

  const merged: ScmReceiptBatch[] = [];
  for (let s = 1; s <= maxSeq; s++) {
    const api = bySeq.get(s);
    const fallback = fromOrder.find((b) => b.sequence === s);
    if (api && (api.lines?.length || 0) > 0) {
      merged.push(api);
    } else if (api) {
      merged.push({
        ...api,
        grn_number: api.grn_number || fallback?.grn_number || grnNumberForSequence(order, s, maxSeq),
        lines: fallback?.lines?.length ? fallback.lines : api.lines,
      });
    } else if (fallback) {
      merged.push(fallback);
    } else {
      merged.push({
        id: null,
        sequence: s,
        grn_number: grnNumberForSequence(order, s, maxSeq),
        receipt_at: null,
        lines: [],
      });
    }
  }
  return merged;
}

export function fullPoChallanLines(
  order: ProcOrder,
  defaultShipTo = "",
  ovf: ScmOvfPreview | null = null,
): DeliveryChallanLine[] {
  const lines = order.lines || [];
  if (lines.length === 0) return [];
  const descByName = new Map<string, string>();
  if (ovf) {
    for (const ln of [...(ovf.vendor_lines || []), ...(ovf.customer_lines || [])]) {
      const key = (ln.product_name || "").trim().toLowerCase();
      const desc = (ln.description || "").trim();
      if (key && desc) descByName.set(key, desc);
    }
  }
  return lines.map((ln) => {
    const base = orderLineToChallanLine(ln, defaultShipTo);
    const key = base.product.trim().toLowerCase();
    const ovfDesc = (descByName.get(key) || "").trim();
    if (ovfDesc && ovfDesc.toLowerCase() !== key) {
      return { ...base, itemName: ovfDesc };
    }
    return base;
  });
}

/** One challan line per product — stock units with the same name are summed. */
export function mergeOvfStockAllocationsToChallanLines(
  allocations: ScmOvfStockAllocation[] | null | undefined,
): DeliveryChallanLine[] {
  const byProduct = new Map<
    string,
    { product: string; qty: number; serials: string[] }
  >();
  for (const row of allocations || []) {
    const product = (row.product_name || "").trim();
    if (!product) continue;
    const key = ovfProductKey(product);
    const qty = Number(row.quantity) || 0;
    if (qty <= 0) continue;
    const serial = (row.serial_number || "").trim();
    const prev = byProduct.get(key);
    if (prev) {
      prev.qty += qty;
      if (serial && serial !== "—" && serial !== "-" && !prev.serials.includes(serial)) {
        prev.serials.push(serial);
      }
    } else {
      byProduct.set(key, {
        product,
        qty,
        serials:
          serial && serial !== "—" && serial !== "-" ? [serial] : [],
      });
    }
  }
  return [...byProduct.values()].map(({ product, qty, serials }) => {
    const serialText = serials.join(", ");
    return {
      id: crypto.randomUUID(),
      product,
      itemName: serialText,
      quantitySent: String(qty),
      hsnSac: "",
      assetNo: serials.length === 1 ? serials[0] : "-",
      rate: "0",
      shipTo: "",
    };
  });
}

export function mergeSelectedGrnChallanLines(
  batches: ScmReceiptBatch[],
  selectedKeys: ReadonlySet<string>,
  order: ProcOrder | null,
  defaultShipTo = "",
  grnKind?: GrnChallanKind,
): DeliveryChallanLine[] {
  const orderLineById = new Map((order?.lines || []).map((ln) => [ln.id, ln]));
  const byLine = new Map<
    string,
    { product: string; name: string; qty: number; rate: number; hsn: string; shipTo: string }
  >();
  for (const batch of batches) {
    if (!selectedKeys.has(receiptBatchKey(batch))) continue;
    for (const ln of batch.lines || []) {
      const receiveQty = Number(ln.quantity) || 0;
      if (receiveQty <= 0) continue;
      const billQty = Number(ln.billing_quantity) || 0;
      let qty = receiveQty;
      if (grnKind === "billing") {
        qty = billQty > 0 ? billQty : ln.billing ? receiveQty : 0;
      } else if (grnKind === "delivery_challan") {
        // Unbilled remainder goes to delivery challan / stock.
        qty =
          billQty > 0 || ln.billing === true
            ? Math.max(0, Math.round((receiveQty - billQty) * 1e6) / 1e6)
            : receiveQty;
      }
      if (qty <= 0) continue;
      const key = ln.order_line_id;
      const ol = orderLineById.get(key);
      const product = (ln.product_name || ol?.product_name || ol?.product_code || `Line ${ln.line_number}`).trim();
      const name = lineDescription(product, ol?.description || ol?.product_code);
      const rate = Number(ol?.unit_cost) || 0;
      const prev = byLine.get(key);
      if (prev) {
        prev.qty += qty;
      } else {
        byLine.set(key, {
          product,
          name,
          qty,
          rate,
          hsn: "",
          shipTo: defaultShipTo,
        });
      }
    }
  }
  return [...byLine.values()].map(({ product, name, qty, rate, hsn, shipTo }) => ({
    id: crypto.randomUUID(),
    product,
    itemName: name,
    quantitySent: String(qty),
    hsnSac: hsn,
    assetNo: "-",
    rate: String(rate),
    shipTo,
  }));
}

export function defaultSelectedGrnKeys(batches: ScmReceiptBatch[]): string[] {
  return batches
    .filter((batch) => (batch.lines || []).some((ln) => Number(ln.quantity) > 0))
    .map((batch) => receiptBatchKey(batch));
}

export function formatGrnLinePreview(batch: ScmReceiptBatch): string {
  const items = (batch.lines || []).filter((ln) => Number(ln.quantity) > 0);
  if (items.length === 0) return "No line detail recorded for this GRN";
  return items
    .map((ln) => {
      const name = (ln.product_name || `Line ${ln.line_number}`).trim();
      return `${name} × ${ln.quantity}`;
    })
    .join("; ");
}

export function resolveChallanReceiptBatches(
  apiBatches: ScmReceiptBatch[],
  order: ProcOrder | null,
): ScmReceiptBatch[] {
  if (!order) return apiBatches.length > 0 ? apiBatches : [];
  if (apiBatches.length === 0) return receiptBatchesFromOrder(order);
  return mergeReceiptBatchLists(apiBatches, order);
}

/**
 * After a GRN is posted, create (or reuse) a challan for that receipt batch
 * so delivery status can be set immediately — partial or full GRN.
 */
export async function createDeliveryChallanForLatestGrn(input: {
  order: ProcOrder;
  batches: ScmReceiptBatch[];
  vendorName?: string;
}): Promise<DeliveryChallanRecord> {
  const { order, batches, vendorName = "" } = input;
  let ovf: ScmOvfPreview | null = null;
  if (order.source_module === "crm" && order.source_document_id) {
    try {
      ovf = await getScmOvfPreview(order.source_document_id);
    } catch {
      ovf = null;
    }
  }

  const resolved = resolveChallanReceiptBatches(batches, order);
  const latest =
    [...resolved]
      .reverse()
      .find((batch) => (batch.lines || []).some((ln) => Number(ln.quantity) > 0)) ||
    resolved[resolved.length - 1] ||
    null;
  const batchKey = latest ? receiptBatchKey(latest) : "";
  const grnNumber = (latest?.grn_number || order.current_grn_number || "").trim();

  const existing = listDeliveryChallansByOrderId(order.id).find((row) => {
    if (batchKey && row.selectedGrnKeys?.includes(batchKey)) return true;
    if (grnNumber && row.selectedGrnNumbers?.includes(grnNumber)) return true;
    return false;
  });
  if (existing) return existing;

  const header = buildChallanPrefillHeader(order, ovf, order.entity_code);
  const entity = resolveEntityPdfBlock(order, header.poNumber, ovf);
  const tax = resolveChallanTaxSupplyStates(order, ovf);
  const selectedKeys = batchKey ? [batchKey] : [];
  const lines = selectedKeys.length
    ? mergeSelectedGrnChallanLines(
        resolved,
        new Set(selectedKeys),
        order,
        header.customerShipTo,
      )
    : [];
  const seq = latest?.sequence || Math.max(1, Number(order.grn_sequence) || 1);
  const poSeed = (order.company_po_number || order.document_number || "PO")
    .replaceAll("/", "-")
    .slice(-12);
  const today = new Date().toISOString().slice(0, 10);

  return upsertDeliveryChallan({
    id: crypto.randomUUID(),
    orderId: order.id,
    challanNumber: `CT/${poSeed}/${String(seq).padStart(3, "0")}`,
    challanDate: today,
    entityName: entity.entityName,
    entityAddressBlock: entity.entityAddressBlock,
    entityGstBlock: entity.entityGstBlock,
    documentType: "DELIVERY CHALLAN",
    copyLabel: "ORIGINAL FOR CONSIGNEE",
    customerName: header.customerName || order.customer_name?.trim() || "Customer",
    customerBillTo: header.customerBillTo,
    customerShipTo: header.customerShipTo,
    customerGstNo: header.customerGstNo,
    kindAttn: header.kindAttn,
    purchaseOrderNumber: header.poNumber,
    poDate: header.poDate,
    poNumberDate: header.poNumberDate,
    shipFromAddress: entity.shipFromAddress,
    billingState: tax.sourceOfSupply,
    shippingState: tax.destinationOfSupply,
    taxPercentage: header.taxPercentage || "18",
    remarks: header.remarks,
    taxRemarks: "",
    preparedBy: "",
    deliveredBy: "",
    vendorName: vendorName.trim(),
    itemsSourceMode: "selected_grns",
    selectedGrnKeys: selectedKeys,
    selectedGrnNumbers: grnNumber ? [grnNumber] : [],
    companyPoNumber: order.company_po_number?.trim() || order.document_number || "",
    lines: lines.length > 0 ? lines : [emptyChallanLine()],
    deliveryMode: "NRGP",
    transportDetails: "",
    driverVehicleDetails: "",
    senderSignature: "",
    receiverSignature: "",
  });
}

export type DeliveryStatusGrnItemRow = {
  id: string;
  product: string;
  description: string;
  orderedQty: string;
  grnQty: string;
  unitCost: string;
};

function lineDescription(
  product: string,
  extra?: string | null,
): string {
  const fromField = (extra || "").trim();
  if (fromField && fromField.toLowerCase() !== product.trim().toLowerCase()) {
    return fromField;
  }
  const sep = " — ";
  const idx = product.indexOf(sep);
  if (idx > 0) return product.slice(idx + sep.length).trim();
  return "";
}

export function deliveryStatusGrnItemRowsFromChallan(
  challan: DeliveryChallanRecord,
): DeliveryStatusGrnItemRow[] {
  return (challan.lines || [])
    .filter((line) => (line.product || "").trim() || (line.itemName || "").trim() || (line.quantitySent || "").trim())
    .map((line, index) => {
      const product = (line.product || "").trim() || (line.itemName || "").trim() || "—";
      return {
        id: line.id || `challan-line-${index}`,
        product,
        description: lineDescription(product, line.itemName) || "—",
        orderedQty: "—",
        grnQty: (line.quantitySent || "").trim() || "—",
        unitCost: (line.rate || "").trim() || "—",
      };
    });
}

export function deliveryStatusGrnItemRowsFromBatches(
  batches: ScmReceiptBatch[],
  order: ProcOrder | null,
): DeliveryStatusGrnItemRow[] {
  const orderLineById = new Map((order?.lines || []).map((ln) => [ln.id, ln]));
  const byLine = new Map<string, DeliveryStatusGrnItemRow>();
  for (const batch of batches) {
    for (const ln of batch.lines || []) {
      const qty = Number(ln.quantity) || 0;
      if (qty <= 0) continue;
      const ol = orderLineById.get(ln.order_line_id);
      const product = (
        ln.product_name ||
        ol?.product_name ||
        ol?.product_code ||
        `Line ${ln.line_number}`
      ).trim();
      const description =
        lineDescription(product, ol?.description || ol?.product_code) || "—";
      const prev = byLine.get(ln.order_line_id);
      if (prev) {
        const nextQty = (Number(prev.grnQty) || 0) + qty;
        prev.grnQty = String(nextQty);
      } else {
        byLine.set(ln.order_line_id, {
          id: ln.order_line_id,
          product,
          description,
          orderedQty: ol ? String(Number(ol.quantity) || 0) : "—",
          grnQty: String(qty),
          unitCost: ol ? String(Number(ol.unit_cost) || 0) : "—",
        });
      }
    }
  }
  return [...byLine.values()];
}

export function matchChallanReceiptBatches(
  batches: ScmReceiptBatch[],
  challan: DeliveryChallanRecord,
): ScmReceiptBatch[] {
  const selectedKeys = new Set((challan.selectedGrnKeys || []).filter(Boolean));
  const selectedNums = new Set(
    (challan.selectedGrnNumbers || []).map((n) => String(n ?? "").trim()).filter(Boolean),
  );
  const matched = batches.filter((batch) => {
    if (selectedKeys.has(receiptBatchKey(batch))) return true;
    const grn = (batch.grn_number || "").trim();
    return Boolean(grn && selectedNums.has(grn));
  });
  if (matched.length > 0) return matched;
  return batches.filter((batch) => (batch.lines || []).some((ln) => Number(ln.quantity) > 0));
}
