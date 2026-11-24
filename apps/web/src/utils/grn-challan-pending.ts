import {
  formatChallanGrnSummary,
  formatChallanItemsSummary,
  listDeliveryChallans,
  type DeliveryChallanRecord,
  type GrnChallanKind,
} from "@/utils/delivery-challan-storage";

export type GrnChallanStatus = "pending" | "saved";

export type PendingGrnChallanSource =
  | "grn"
  | "ovf_stock"
  | "ovf_grn_stock"
  | "po_grn_stock";

export type PendingGrnChallan = {
  id: string;
  orderId: string;
  batchKey: string;
  grnNumber: string;
  purchaseOrderNumber: string;
  vendorName: string;
  customerName?: string;
  itemsSummary?: string;
  kind: GrnChallanKind;
  createdAt: string;
  /** Set after the challan/billing form is saved. */
  status?: GrnChallanStatus;
  /** Challan number (DC) or invoice number (billing) - filled on save. */
  docNumber?: string;
  /** Challan date (DC) or invoice date (billing) - filled on save. */
  docDate?: string;
  /** localStorage record ID of the saved challan, for linking back. */
  savedRecordId?: string;
  /** Delivery challan this billing row was created from. */
  sourceChallanId?: string;
  /** GRN receipt vs OVF stock allocation (no GRN). */
  source?: PendingGrnChallanSource;
};

const STORAGE_KEY = "erp.procurement.grn-challan-pending";

function readAll(): PendingGrnChallan[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PendingGrnChallan[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(rows: PendingGrnChallan[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function listPendingGrnChallans(): PendingGrnChallan[] {
  return readAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function listPendingGrnChallansByKind(kind: GrnChallanKind): PendingGrnChallan[] {
  return listPendingGrnChallans().filter((row) => row.kind === kind);
}

export function listAllGrnChallansByKind(kind: GrnChallanKind): PendingGrnChallan[] {
  return readAll()
    .filter((row) => row.kind === kind)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function inferChallanSource(record: DeliveryChallanRecord): PendingGrnChallanSource {
  const key = record.selectedGrnKeys[0] || "";
  if (key.startsWith("ovf-stock:")) return "ovf_stock";
  if (key.startsWith("ovf-grn-stock:")) return "ovf_grn_stock";
  if (key.startsWith("po-grn-stock:")) return "po_grn_stock";
  if (record.selectedGrnNumbers.length > 0) return "grn";
  if (record.orderId && record.selectedGrnKeys.length === 0) return "ovf_grn_stock";
  return "grn";
}

function grnSummaryForChallan(record: DeliveryChallanRecord): string {
  return formatChallanGrnSummary(record);
}

function challanRecordToQueueRow(record: DeliveryChallanRecord): PendingGrnChallan {
  const kind = record.grnKind || "delivery_challan";
  const source = inferChallanSource(record);
  const isBilling = kind === "billing";

  return {
    id: record.id,
    orderId: record.orderId || record.id,
    batchKey: record.selectedGrnKeys[0] || `saved:${record.id}`,
    grnNumber: grnSummaryForChallan(record),
    purchaseOrderNumber: record.purchaseOrderNumber,
    vendorName: record.vendorName,
    customerName: record.customerName,
    itemsSummary: formatChallanItemsSummary(record.lines),
    kind,
    createdAt: record.createdAt,
    status: "saved",
    docNumber: isBilling
      ? record.invoiceNumber?.trim() || record.challanNumber
      : record.challanNumber,
    docDate: isBilling
      ? record.invoiceDate?.trim() || record.challanDate
      : record.challanDate,
    savedRecordId: record.id,
    sourceChallanId: record.sourceChallanId,
    source,
  };
}

/** Pending queue rows plus saved challans not already linked in the queue. */
export function listDeliveryChallanQueueByKind(kind: GrnChallanKind): PendingGrnChallan[] {
  const allSaved = listDeliveryChallans();
  const savedById = new Map(allSaved.map((record) => [record.id, record]));

  const queueRows = readAll()
    .filter((row) => row.kind === kind)
    .map((row) => {
      // Heal older saves that never got status/doc fields written back to the queue.
      if (row.status === "saved" && row.docNumber && row.savedRecordId) return row;
      const savedId = row.savedRecordId;
      if (!savedId) return row;
      const saved = savedById.get(savedId);
      if (!saved) return row;
      const healed = challanRecordToQueueRow(saved);
      return {
        ...row,
        status: "saved" as const,
        docNumber: healed.docNumber || row.docNumber,
        docDate: healed.docDate || row.docDate,
        savedRecordId: saved.id,
        customerName: healed.customerName || row.customerName,
        vendorName: healed.vendorName || row.vendorName,
        purchaseOrderNumber: healed.purchaseOrderNumber || row.purchaseOrderNumber,
      };
    });
  const linkedSavedIds = new Set(
    queueRows.map((row) => row.savedRecordId).filter((id): id is string => Boolean(id)),
  );

  const savedRows = allSaved
    .filter((record) => (record.grnKind || "delivery_challan") === kind)
    .filter((record) => !linkedSavedIds.has(record.id))
    .map(challanRecordToQueueRow);

  const seen = new Set<string>();
  const merged = [...queueRows, ...savedRows].filter((row) => {
    const key = row.savedRecordId || row.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return merged.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function addPendingGrnChallan(
  input: Omit<PendingGrnChallan, "id" | "createdAt">,
): PendingGrnChallan {
  const rows = readAll().filter(
    (row) =>
      !(
        row.orderId === input.orderId &&
        row.batchKey === input.batchKey &&
        row.kind === input.kind
      ),
  );
  const row: PendingGrnChallan = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  writeAll([row, ...rows]);
  return row;
}

/** Insert or update a queue entry (used when saving challans from any source). */
export function upsertPendingGrnChallan(
  input: Omit<PendingGrnChallan, "id" | "createdAt"> &
    Partial<Pick<PendingGrnChallan, "id" | "createdAt">>,
): PendingGrnChallan {
  const rows = readAll();
  const idx = rows.findIndex(
    (row) =>
      row.orderId === input.orderId &&
      row.batchKey === input.batchKey &&
      row.kind === input.kind,
  );
  if (idx >= 0) {
    const next = { ...rows[idx], ...input };
    rows[idx] = next;
    writeAll(rows);
    return next;
  }
  const row: PendingGrnChallan = {
    ...input,
    id: input.id || crypto.randomUUID(),
    createdAt: input.createdAt || new Date().toISOString(),
  };
  writeAll([row, ...rows]);
  return row;
}

export function removePendingGrnChallan(
  orderId: string,
  batchKey: string,
  kind?: GrnChallanKind,
): void {
  writeAll(
    readAll().filter((row) => {
      if (row.orderId !== orderId || row.batchKey !== batchKey) return true;
      if (kind && row.kind !== kind) return true;
      return false;
    }),
  );
}

/** Update mutable fields on an existing queue entry without replacing it. */
export function patchPendingGrnChallan(
  orderId: string,
  batchKey: string,
  kind: GrnChallanKind,
  patch: Partial<
    Pick<
      PendingGrnChallan,
      | "customerName"
      | "itemsSummary"
      | "status"
      | "docNumber"
      | "docDate"
      | "savedRecordId"
      | "grnNumber"
    >
  >,
): void {
  const rows = readAll().map((row) => {
    if (row.orderId !== orderId || row.batchKey !== batchKey || row.kind !== kind) return row;
    return { ...row, ...patch };
  });
  writeAll(rows);
}

/** Point a billing queue row at the GRN receipt used for the My Jobs task. */
export function rememberBillingReceiptBatch(
  row: Pick<PendingGrnChallan, "id" | "orderId" | "batchKey" | "kind">,
  receiptBatchId: string,
): void {
  const rows = readAll().map((current) => {
    const same =
      current.id === row.id ||
      (current.orderId === row.orderId &&
        current.batchKey === row.batchKey &&
        current.kind === row.kind);
    if (!same) return current;
    return { ...current, batchKey: receiptBatchId };
  });
  writeAll(rows);
}

/** True when this delivery challan already has a billing / invoice row. */
export function invoiceAlreadyCreatedForChallan(challan: DeliveryChallanRecord): boolean {
  const key = `dc-invoice:${challan.id}`;
  const summary = formatChallanItemsSummary(challan.lines)
    .replace(/\[quote:[^\]]+\]\s*/gi, "")
    .trim()
    .toLowerCase();
  const queued = listAllGrnChallansByKind("billing").some((row) => {
    if (row.batchKey === key || row.sourceChallanId === challan.id) return true;
    if (!summary || row.orderId !== (challan.orderId || challan.id)) return false;
    const items = (row.itemsSummary || "")
      .replace(/\[quote:[^\]]+\]\s*/gi, "")
      .trim()
      .toLowerCase();
    return Boolean(items) && (items === summary || items.includes(summary) || summary.includes(items));
  });
  if (queued) return true;
  return listDeliveryChallans().some(
    (row) =>
      (row.grnKind || "delivery_challan") === "billing" && row.sourceChallanId === challan.id,
  );
}

function isDeliveryChallanNumber(value: string): boolean {
  return /^DC\//i.test(value.trim());
}

/** Invoice number for a DC or a direct billing document. Challan numbers are not invoices. */
export function invoiceNumberForDeliveryChallan(challan: DeliveryChallanRecord): string {
  const own = (challan.invoiceNumber || "").trim();
  if ((challan.grnKind || "delivery_challan") === "billing") {
    if (own && !isDeliveryChallanNumber(own)) return own;
    const doc = (challan.challanNumber || "").trim();
    return doc && !isDeliveryChallanNumber(doc) ? doc : "";
  }
  const linked = listDeliveryChallans().find(
    (row) =>
      (row.grnKind || "delivery_challan") === "billing" && row.sourceChallanId === challan.id,
  );
  const fromLinked = (linked?.invoiceNumber || linked?.challanNumber || "").trim();
  if (fromLinked && !isDeliveryChallanNumber(fromLinked)) return fromLinked;
  const key = `dc-invoice:${challan.id}`;
  const summary = formatChallanItemsSummary(challan.lines)
    .replace(/\[quote:[^\]]+\]\s*/gi, "")
    .trim()
    .toLowerCase();
  const queued = listAllGrnChallansByKind("billing").find((row) => {
    if (row.batchKey === key || row.sourceChallanId === challan.id) return true;
    if (!summary || row.orderId !== (challan.orderId || challan.id)) return false;
    const items = (row.itemsSummary || "")
      .replace(/\[quote:[^\]]+\]\s*/gi, "")
      .trim()
      .toLowerCase();
    return Boolean(items) && (items === summary || items.includes(summary) || summary.includes(items));
  });
  const fromQueue = (queued?.docNumber || "").trim();
  if (fromQueue && !isDeliveryChallanNumber(fromQueue)) return fromQueue;
  return "";
}

function parseOvfIdFromBatchKey(batchKey: string): string | null {
  const stockMatch = batchKey.match(/^ovf-stock:(.+)$/);
  if (stockMatch?.[1]) return stockMatch[1];
  const grnMatch = batchKey.match(/^ovf-grn-stock:([^:]+)/);
  if (grnMatch?.[1]) return grnMatch[1];
  return null;
}

export function pendingGrnChallanHref(row: PendingGrnChallan): string {
  if (row.source === "ovf_stock" || row.batchKey.startsWith("ovf-stock:")) {
    const ovfId = parseOvfIdFromBatchKey(row.batchKey) || row.orderId;
    const params = new URLSearchParams({
      source: "ovf_stock",
      ovfId,
      kind: row.kind,
      returnTo: "/procurement/delivery-challan",
    });
    return `/procurement/delivery-challan/new?${params.toString()}`;
  }
  if (row.source === "ovf_grn_stock" || row.batchKey.startsWith("ovf-grn-stock:")) {
    const ovfId = parseOvfIdFromBatchKey(row.batchKey) || "";
    const params = new URLSearchParams({
      source: "ovf_grn_stock",
      orderId: row.orderId,
      kind: row.kind,
      returnTo: "/procurement/delivery-challan",
    });
    if (ovfId) params.set("ovfId", ovfId);
    return `/procurement/delivery-challan/new?${params.toString()}`;
  }
  if (row.source === "po_grn_stock" || row.batchKey.startsWith("po-grn-stock:")) {
    const params = new URLSearchParams({
      source: "po_grn_stock",
      orderId: row.orderId,
      kind: row.kind,
      returnTo: "/procurement/delivery-challan",
    });
    if (row.batchKey) params.set("batchKey", row.batchKey);
    return `/procurement/delivery-challan/new?${params.toString()}`;
  }
  const params = new URLSearchParams({
    orderId: row.orderId,
    grnKey: row.batchKey,
    kind: row.kind,
    returnTo: "/procurement/delivery-challan",
  });
  return `/procurement/delivery-challan/new?${params.toString()}`;
}
