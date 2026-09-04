/** Local demo store for procurement approval requests (user → admin). */

export type PoApprovalStatus = "pending" | "accepted" | "rejected";

/** finalize = issue an existing draft PO; create_po_in_stock = allow Create PO on IN STOCK OVF. */
export type PoApprovalKind = "finalize" | "create_po_in_stock";

export type PoApprovalDocument = {
  id: string;
  fileName: string;
  category: string;
  remarks: string | null;
  entityType: string;
  source: "ovf" | "po";
  attachmentSource?: string;
  externalUrl?: string | null;
};

export type PoApprovalRequest = {
  id: string;
  kind: PoApprovalKind;
  orderId: string;
  documentNumber: string;
  companyPoNumber: string | null;
  customerName: string | null;
  vendorId: string;
  vendorName: string | null;
  ovfId: string | null;
  ovfNo: string | null;
  /** Why create-PO was requested on an IN STOCK OVF. */
  reason: "stock_short" | "user_choice" | null;
  documents: PoApprovalDocument[];
  requestedByRole: "user";
  status: PoApprovalStatus;
  createdAt: string;
  decidedAt: string | null;
};

const STORAGE_KEY = "erp.procurement.po-approvals";
export const PROCUREMENT_APPROVALS_EVENT = "erp-procurement-approvals-change";

export function ovfCreatePoApprovalOrderKey(ovfId: string): string {
  return `ovf:${ovfId}`;
}

export function isOvfCreatePoApprovalOrderKey(orderId: string): boolean {
  return orderId.startsWith("ovf:");
}

export function ovfIdFromCreatePoApprovalOrderKey(orderId: string): string | null {
  if (!isOvfCreatePoApprovalOrderKey(orderId)) return null;
  return orderId.slice(4) || null;
}

function emitChange(): void {
  window.dispatchEvent(new Event(PROCUREMENT_APPROVALS_EVENT));
}

function normalizeDocument(row: Partial<PoApprovalDocument> | null | undefined): PoApprovalDocument | null {
  if (!row?.id || !row.fileName) return null;
  return {
    id: row.id,
    fileName: row.fileName,
    category: row.category || "other",
    remarks: row.remarks?.trim() || null,
    entityType: row.entityType || "ovf",
    source: row.source === "po" ? "po" : "ovf",
    attachmentSource: row.attachmentSource || "upload",
    externalUrl: row.externalUrl?.trim() || null,
  };
}

function normalizeApprovalRow(
  row: Partial<PoApprovalRequest> & {
    orderId?: string;
    documentNumber?: string;
    vendorId?: string;
  },
): PoApprovalRequest | null {
  if (!row?.orderId || !row.documentNumber || !row.vendorId || !row.id) return null;
  const documents = Array.isArray(row.documents)
    ? row.documents
        .map((doc) => normalizeDocument(doc))
        .filter((doc): doc is PoApprovalDocument => doc != null)
    : [];
  const kind: PoApprovalKind =
    row.kind === "create_po_in_stock" || isOvfCreatePoApprovalOrderKey(row.orderId)
      ? "create_po_in_stock"
      : "finalize";
  const reason =
    row.reason === "stock_short" || row.reason === "user_choice" ? row.reason : null;
  return {
    id: row.id,
    kind,
    orderId: row.orderId,
    documentNumber: row.documentNumber,
    companyPoNumber: row.companyPoNumber ?? null,
    customerName: (row.customerName || "").trim() || null,
    vendorId: row.vendorId,
    vendorName: (row.vendorName || "").trim() || null,
    ovfId: row.ovfId ?? (kind === "create_po_in_stock" ? ovfIdFromCreatePoApprovalOrderKey(row.orderId) : null),
    ovfNo: (row.ovfNo || "").trim() || null,
    reason,
    documents,
    requestedByRole: "user",
    status: row.status === "accepted" || row.status === "rejected" ? row.status : "pending",
    createdAt: row.createdAt || new Date().toISOString(),
    decidedAt: row.decidedAt ?? null,
  };
}

export function readPoApprovals(): PoApprovalRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => normalizeApprovalRow(row as Partial<PoApprovalRequest>))
      .filter((row): row is PoApprovalRequest => row != null);
  } catch {
    return [];
  }
}

function writePoApprovals(rows: PoApprovalRequest[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  emitChange();
}

export function latestPoApprovalByOrderId(): Map<string, PoApprovalRequest> {
  const map = new Map<string, PoApprovalRequest>();
  for (const row of readPoApprovals()) {
    if (row.kind !== "finalize") continue;
    const prev = map.get(row.orderId);
    const ts = row.decidedAt || row.createdAt;
    const prevTs = prev ? prev.decidedAt || prev.createdAt : "";
    if (!prev || ts > prevTs) map.set(row.orderId, row);
  }
  return map;
}

export function listPendingPoApprovals(): PoApprovalRequest[] {
  return readPoApprovals()
    .filter((row) => row.status === "pending")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function findPendingApprovalForOrder(orderId: string): PoApprovalRequest | null {
  return (
    readPoApprovals().find(
      (row) => row.kind === "finalize" && row.orderId === orderId && row.status === "pending",
    ) ?? null
  );
}

export function findLatestApprovalForOrder(orderId: string): PoApprovalRequest | null {
  return (
    readPoApprovals()
      .filter((row) => row.kind === "finalize" && row.orderId === orderId)
      .sort((a, b) => (b.decidedAt || b.createdAt).localeCompare(a.decidedAt || a.createdAt))[0] ??
    null
  );
}

export function findLatestCreatePoInStockApprovalForOvf(ovfId: string): PoApprovalRequest | null {
  const key = ovfCreatePoApprovalOrderKey(ovfId);
  return (
    readPoApprovals()
      .filter(
        (row) =>
          row.kind === "create_po_in_stock" &&
          (row.ovfId === ovfId || row.orderId === key),
      )
      .sort((a, b) => (b.decidedAt || b.createdAt).localeCompare(a.decidedAt || a.createdAt))[0] ??
    null
  );
}

export function findPendingCreatePoInStockApprovalForOvf(ovfId: string): PoApprovalRequest | null {
  const latest = findLatestCreatePoInStockApprovalForOvf(ovfId);
  return latest?.status === "pending" ? latest : null;
}

export function hasAcceptedCreatePoInStockApproval(ovfId: string): boolean {
  return findLatestCreatePoInStockApprovalForOvf(ovfId)?.status === "accepted";
}

export function submitPoFinalizeApproval(input: {
  orderId: string;
  documentNumber: string;
  companyPoNumber?: string | null;
  customerName?: string | null;
  vendorId: string;
  vendorName?: string | null;
  ovfId?: string | null;
  documents?: PoApprovalDocument[];
}): PoApprovalRequest {
  const documents = (input.documents || [])
    .map((doc) => normalizeDocument(doc))
    .filter((doc): doc is PoApprovalDocument => doc != null);
  const existing = findPendingApprovalForOrder(input.orderId);
  if (existing) {
    const customerName = (input.customerName || "").trim() || existing.customerName;
    const vendorName = (input.vendorName || "").trim() || existing.vendorName;
    const nextDocuments = documents.length > 0 ? documents : existing.documents;
    const rows = readPoApprovals();
    const index = rows.findIndex((row) => row.id === existing.id);
    if (index >= 0) {
      const updated: PoApprovalRequest = {
        ...existing,
        kind: "finalize",
        customerName,
        vendorName,
        companyPoNumber: input.companyPoNumber ?? existing.companyPoNumber,
        ovfId: input.ovfId ?? existing.ovfId,
        documents: nextDocuments,
      };
      const next = [...rows];
      next[index] = updated;
      writePoApprovals(next);
      return updated;
    }
    return existing;
  }

  const row: PoApprovalRequest = {
    id: crypto.randomUUID(),
    kind: "finalize",
    orderId: input.orderId,
    documentNumber: input.documentNumber,
    companyPoNumber: input.companyPoNumber ?? null,
    customerName: (input.customerName || "").trim() || null,
    vendorId: input.vendorId,
    vendorName: (input.vendorName || "").trim() || null,
    ovfId: input.ovfId ?? null,
    ovfNo: null,
    reason: null,
    documents,
    requestedByRole: "user",
    status: "pending",
    createdAt: new Date().toISOString(),
    decidedAt: null,
  };
  writePoApprovals([row, ...readPoApprovals()]);
  return row;
}

/** User asks admin for permission to Create PO when OVF lines are all IN STOCK. */
export function submitCreatePoInStockApproval(input: {
  ovfId: string;
  ovfNo: string;
  customerName?: string | null;
  vendorName?: string | null;
  reason: "stock_short" | "user_choice";
}): PoApprovalRequest {
  const orderId = ovfCreatePoApprovalOrderKey(input.ovfId);
  const existing = findPendingCreatePoInStockApprovalForOvf(input.ovfId);
  if (existing) {
    const rows = readPoApprovals();
    const index = rows.findIndex((row) => row.id === existing.id);
    if (index >= 0) {
      const updated: PoApprovalRequest = {
        ...existing,
        ovfNo: input.ovfNo || existing.ovfNo,
        customerName: (input.customerName || "").trim() || existing.customerName,
        vendorName: (input.vendorName || "").trim() || existing.vendorName,
        reason: input.reason,
      };
      const next = [...rows];
      next[index] = updated;
      writePoApprovals(next);
      return updated;
    }
    return existing;
  }

  const row: PoApprovalRequest = {
    id: crypto.randomUUID(),
    kind: "create_po_in_stock",
    orderId,
    documentNumber: input.ovfNo || input.ovfId,
    companyPoNumber: null,
    customerName: (input.customerName || "").trim() || null,
    vendorId: "in-stock",
    vendorName: (input.vendorName || "").trim() || "IN STOCK",
    ovfId: input.ovfId,
    ovfNo: input.ovfNo || null,
    reason: input.reason,
    documents: [],
    requestedByRole: "user",
    status: "pending",
    createdAt: new Date().toISOString(),
    decidedAt: null,
  };
  writePoApprovals([row, ...readPoApprovals()]);
  return row;
}

/** Fill missing customer/vendor labels on stored approval rows (in place). */
export function enrichPoApprovals(
  patchByOrderId: Record<
    string,
    { customerName?: string | null; vendorName?: string | null; companyPoNumber?: string | null }
  >,
): PoApprovalRequest[] {
  const rows = readPoApprovals();
  let changed = false;
  const next = rows.map((row) => {
    const patch = patchByOrderId[row.orderId];
    if (!patch) return row;
    const customerName = row.customerName || (patch.customerName || "").trim() || null;
    const vendorName = row.vendorName || (patch.vendorName || "").trim() || null;
    const companyPoNumber = row.companyPoNumber || patch.companyPoNumber || null;
    if (
      customerName === row.customerName &&
      vendorName === row.vendorName &&
      companyPoNumber === row.companyPoNumber
    ) {
      return row;
    }
    changed = true;
    return { ...row, customerName, vendorName, companyPoNumber };
  });
  if (changed) writePoApprovals(next);
  return next;
}

export function setPoApprovalDocuments(
  id: string,
  documents: PoApprovalDocument[],
): PoApprovalRequest | null {
  const normalized = documents
    .map((doc) => normalizeDocument(doc))
    .filter((doc): doc is PoApprovalDocument => doc != null);
  const rows = readPoApprovals();
  const index = rows.findIndex((row) => row.id === id);
  if (index < 0) return null;
  const updated: PoApprovalRequest = {
    ...rows[index],
    documents: normalized,
  };
  const next = [...rows];
  next[index] = updated;
  writePoApprovals(next);
  return updated;
}

export function setPoApprovalStatus(
  id: string,
  status: Exclude<PoApprovalStatus, "pending">,
): PoApprovalRequest | null {
  const rows = readPoApprovals();
  const index = rows.findIndex((row) => row.id === id);
  if (index < 0) return null;
  const updated: PoApprovalRequest = {
    ...rows[index],
    status,
    decidedAt: new Date().toISOString(),
  };
  const next = [...rows];
  next[index] = updated;
  writePoApprovals(next);
  return updated;
}
