/** Aggregate ordered / GRN / billed quantities for a single purchase order. */

export type PoFulfillmentLineInput = {
  id: string;
  product_name?: string | null;
  product_code?: string | null;
  quantity: number;
  quantity_received: number;
  last_receipt_billing_quantity?: number;
};

export type PoFulfillmentBatchLineInput = {
  order_line_id: string;
  quantity: number;
  billing_quantity?: number;
};

export type PoFulfillmentBatchInput = {
  id: string | null;
  grn_number: string;
  lines: PoFulfillmentBatchLineInput[];
};

export type PoFulfillmentLineMetrics = {
  lineId: string;
  productLabel: string;
  orderedQty: number;
  receivedQty: number;
  remainingQty: number;
  billedQty: number;
  unbilledQty: number;
};

export type PoFulfillmentMetrics = {
  lineCount: number;
  grnCount: number;
  orderedQty: number;
  receivedQty: number;
  remainingQty: number;
  billedQty: number;
  unbilledQty: number;
  receivePct: number;
  billPctOfReceived: number;
  lines: PoFulfillmentLineMetrics[];
};

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

function productLabel(line: PoFulfillmentLineInput): string {
  return (line.product_name || line.product_code || "Unnamed product").trim() || "Unnamed product";
}

export function buildPoFulfillmentMetrics(
  lines: PoFulfillmentLineInput[],
  batches: PoFulfillmentBatchInput[] = [],
): PoFulfillmentMetrics {
  const active = lines.filter((ln) => Number(ln.quantity) > 0 || Number(ln.quantity_received) > 0);
  const lineIds = new Set(active.map((ln) => ln.id));

  // Only bill qty from batch lines that belong to this PO's lines.
  const billedByLine = new Map<string, number>();
  let batchLineHits = 0;
  for (const batch of batches) {
    for (const bl of batch.lines || []) {
      if (!lineIds.has(bl.order_line_id)) continue;
      batchLineHits += 1;
      const prev = billedByLine.get(bl.order_line_id) ?? 0;
      billedByLine.set(
        bl.order_line_id,
        prev + Math.max(0, Number(bl.billing_quantity) || 0),
      );
    }
  }

  const lineRows: PoFulfillmentLineMetrics[] = active.map((ln) => {
    const orderedQty = round6(Math.max(0, Number(ln.quantity) || 0));
    const receivedQty = round6(Math.max(0, Number(ln.quantity_received) || 0));
    const remainingQty = round6(Math.max(0, orderedQty - receivedQty));
    let billedQty =
      batchLineHits > 0
        ? billedByLine.get(ln.id) ?? 0
        : Math.max(0, Number(ln.last_receipt_billing_quantity) || 0);
    billedQty = round6(Math.min(billedQty, receivedQty));
    const unbilledQty = round6(Math.max(0, receivedQty - billedQty));
    return {
      lineId: ln.id,
      productLabel: productLabel(ln),
      orderedQty,
      receivedQty,
      remainingQty,
      billedQty,
      unbilledQty,
    };
  });

  const orderedQty = round6(lineRows.reduce((sum, row) => sum + row.orderedQty, 0));
  const receivedQty = round6(lineRows.reduce((sum, row) => sum + row.receivedQty, 0));
  const remainingQty = round6(Math.max(0, orderedQty - receivedQty));
  const billedQty = round6(lineRows.reduce((sum, row) => sum + row.billedQty, 0));
  const unbilledQty = round6(Math.max(0, receivedQty - billedQty));

  const scopedBatches = batches.filter((b) =>
    (b.lines || []).some((bl) => lineIds.has(bl.order_line_id)),
  );

  return {
    lineCount: lineRows.length,
    grnCount: scopedBatches.filter((b) => (b.grn_number || "").trim() || (b.lines?.length ?? 0) > 0)
      .length,
    orderedQty,
    receivedQty,
    remainingQty,
    billedQty,
    unbilledQty,
    receivePct: orderedQty > 0 ? Math.round((receivedQty / orderedQty) * 1000) / 10 : 0,
    billPctOfReceived:
      receivedQty > 0 ? Math.round((billedQty / receivedQty) * 1000) / 10 : 0,
    lines: lineRows,
  };
}

export function formatPoQty(qty: number): string {
  if (!Number.isFinite(qty)) return "0";
  const rounded = round6(qty);
  return Number.isInteger(rounded)
    ? rounded.toLocaleString("en-IN")
    : rounded.toLocaleString("en-IN", { maximumFractionDigits: 4 });
}
