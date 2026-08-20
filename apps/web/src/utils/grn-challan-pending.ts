import type { GrnChallanKind } from "@/utils/delivery-challan-storage";

export type GrnChallanStatus = "pending" | "saved";

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
  /** Challan number (DC) or invoice number (billing) — filled on save. */
  docNumber?: string;
  /** Challan date (DC) or invoice date (billing) — filled on save. */
  docDate?: string;
  /** localStorage record ID of the saved challan, for linking back. */
  savedRecordId?: string;
  /** GRN receipt vs OVF stock allocation (no GRN). */
  source?: "grn" | "ovf_stock";
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
  patch: Partial<Pick<PendingGrnChallan, "customerName" | "itemsSummary" | "status" | "docNumber" | "docDate" | "savedRecordId">>,
): void {
  const rows = readAll().map((row) => {
    if (row.orderId !== orderId || row.batchKey !== batchKey || row.kind !== kind) return row;
    return { ...row, ...patch };
  });
  writeAll(rows);
}

export function pendingGrnChallanHref(row: PendingGrnChallan): string {
  if (row.source === "ovf_stock" || row.batchKey.startsWith("ovf-stock:")) {
    const ovfId = row.orderId;
    const params = new URLSearchParams({
      source: "ovf_stock",
      ovfId,
      kind: row.kind,
      returnTo: "/procurement/delivery-challan",
    });
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
