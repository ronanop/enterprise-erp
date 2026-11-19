import type { ProcOrder, ScmReceiptBatch } from "@/services/procurement-service";
import { orderLineToChallanLine } from "@/utils/delivery-challan-prefill";
import type { DeliveryChallanLine } from "@/utils/delivery-challan-storage";

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
): DeliveryChallanLine[] {
  const lines = order.lines || [];
  if (lines.length === 0) return [];
  return lines.map((ln) => orderLineToChallanLine(ln, defaultShipTo));
}

export function mergeSelectedGrnChallanLines(
  batches: ScmReceiptBatch[],
  selectedKeys: ReadonlySet<string>,
  order: ProcOrder | null,
  defaultShipTo = "",
): DeliveryChallanLine[] {
  const orderLineById = new Map((order?.lines || []).map((ln) => [ln.id, ln]));
  const byLine = new Map<
    string,
    { name: string; qty: number; rate: number; hsn: string; shipTo: string }
  >();
  for (const batch of batches) {
    if (!selectedKeys.has(receiptBatchKey(batch))) continue;
    for (const ln of batch.lines || []) {
      const qty = Number(ln.quantity) || 0;
      if (qty <= 0) continue;
      const key = ln.order_line_id;
      const ol = orderLineById.get(key);
      const name = (ln.product_name || ol?.product_name || `Line ${ln.line_number}`).trim();
      const rate = Number(ol?.unit_cost) || 0;
      const prev = byLine.get(key);
      if (prev) {
        prev.qty += qty;
      } else {
        byLine.set(key, {
          name,
          qty,
          rate,
          hsn: "",
          shipTo: defaultShipTo,
        });
      }
    }
  }
  return [...byLine.values()].map(({ name, qty, rate, hsn, shipTo }) => ({
    id: crypto.randomUUID(),
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
