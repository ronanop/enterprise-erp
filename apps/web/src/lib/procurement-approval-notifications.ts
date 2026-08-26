/** Local demo notifications for PO approval decisions (admin → SCM user). */

export type PoApprovalDecisionNotification = {
  id: string;
  approvalId: string;
  orderId: string;
  companyPoNumber: string | null;
  documentNumber: string;
  decision: "accepted" | "rejected";
  message: string;
  createdAt: string;
  read: boolean;
};

const STORAGE_KEY = "erp.procurement.po-approval-notifications";
export const PROCUREMENT_APPROVAL_NOTIFICATIONS_EVENT =
  "erp-procurement-po-approval-notifications-change";

function emitChange(): void {
  window.dispatchEvent(new Event(PROCUREMENT_APPROVAL_NOTIFICATIONS_EVENT));
}

function readAll(): PoApprovalDecisionNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => {
        const item = row as Partial<PoApprovalDecisionNotification>;
        if (!item?.id || !item.orderId || !item.approvalId) return null;
        if (item.decision !== "accepted" && item.decision !== "rejected") return null;
        return {
          id: item.id,
          approvalId: item.approvalId,
          orderId: item.orderId,
          companyPoNumber: item.companyPoNumber ?? null,
          documentNumber: item.documentNumber || "",
          decision: item.decision,
          message: item.message || "",
          createdAt: item.createdAt || new Date().toISOString(),
          read: Boolean(item.read),
        } satisfies PoApprovalDecisionNotification;
      })
      .filter((row): row is PoApprovalDecisionNotification => row != null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

function writeAll(rows: PoApprovalDecisionNotification[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  emitChange();
}

export function listPoApprovalDecisionNotifications(): PoApprovalDecisionNotification[] {
  return readAll();
}

export function countUnreadPoApprovalDecisionNotifications(): number {
  return readAll().filter((row) => !row.read).length;
}

export function listUnreadPoApprovalDecisionNotifications(): PoApprovalDecisionNotification[] {
  return readAll().filter((row) => !row.read);
}

export function pushPoApprovalDecisionNotification(input: {
  approvalId: string;
  orderId: string;
  companyPoNumber?: string | null;
  documentNumber: string;
  decision: "accepted" | "rejected";
  kind?: "finalize" | "create_po_in_stock";
}): PoApprovalDecisionNotification {
  const poLabel = input.companyPoNumber?.trim() || input.documentNumber;
  const message =
    input.kind === "create_po_in_stock"
      ? input.decision === "accepted"
        ? `Admin approved Create PO for ${poLabel} (IN STOCK). You can create the purchase order now.`
        : `Admin rejected Create PO for ${poLabel} (IN STOCK). Use inventory or request again if needed.`
      : input.decision === "accepted"
        ? `Admin accepted ${poLabel}. The purchase order is issued.`
        : `Admin rejected ${poLabel}. Edit and resubmit for approval if needed.`;
  const row: PoApprovalDecisionNotification = {
    id: crypto.randomUUID(),
    approvalId: input.approvalId,
    orderId: input.orderId,
    companyPoNumber: input.companyPoNumber ?? null,
    documentNumber: input.documentNumber,
    decision: input.decision,
    message,
    createdAt: new Date().toISOString(),
    read: false,
  };
  writeAll([row, ...readAll().filter((existing) => existing.approvalId !== input.approvalId)]);
  return row;
}

export function markPoApprovalDecisionNotificationRead(id: string): void {
  const rows = readAll();
  const index = rows.findIndex((row) => row.id === id);
  if (index < 0 || rows[index].read) return;
  const next = [...rows];
  next[index] = { ...rows[index], read: true };
  writeAll(next);
}

export function markPoApprovalDecisionNotificationsReadForOrder(orderId: string): void {
  const rows = readAll();
  let changed = false;
  const next = rows.map((row) => {
    if (row.orderId !== orderId || row.read) return row;
    changed = true;
    return { ...row, read: true };
  });
  if (changed) writeAll(next);
}

export function markAllPoApprovalDecisionNotificationsRead(): void {
  const rows = readAll();
  if (!rows.some((row) => !row.read)) return;
  writeAll(rows.map((row) => ({ ...row, read: true })));
}
