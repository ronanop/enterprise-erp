/**
 * IT & Admin — requisitions (ID card, visiting card, t-shirts, gifts).
 * Local PWA store until a dedicated API exists.
 */

export type RequisitionItemType =
  | "id_card"
  | "visiting_card"
  | "t_shirt"
  | "gift";

export type RequisitionStatus = "submitted" | "in_progress" | "fulfilled" | "rejected";

export type AdminRequisition = {
  id: string;
  itemType: RequisitionItemType;
  quantity: number;
  notes: string;
  employeeName: string;
  employeeCode: string;
  email: string;
  status: RequisitionStatus;
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = "erp_it_admin_requisitions_v1";

export const REQUISITION_ITEM_OPTIONS: {
  value: RequisitionItemType;
  label: string;
  hint: string;
}[] = [
  { value: "id_card", label: "ID card", hint: "Employee identity badge / access card" },
  { value: "visiting_card", label: "Visiting card", hint: "Printed business cards" },
  { value: "t_shirt", label: "T-shirt", hint: "Company branded apparel" },
  { value: "gift", label: "Gift", hint: "Corporate gift / welcome kit item" },
];

function readAll(): AdminRequisition[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AdminRequisition[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(rows: AdminRequisition[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

function nowIso() {
  return new Date().toISOString();
}

export function listRequisitions(): AdminRequisition[] {
  return readAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createRequisition(input: {
  itemType: RequisitionItemType;
  quantity: number;
  notes?: string;
  employeeName: string;
  employeeCode?: string;
  email?: string;
}): AdminRequisition {
  const all = readAll();
  const row: AdminRequisition = {
    id: crypto.randomUUID(),
    itemType: input.itemType,
    quantity: Math.max(1, Math.floor(input.quantity) || 1),
    notes: (input.notes || "").trim(),
    employeeName: input.employeeName.trim() || "Employee",
    employeeCode: (input.employeeCode || "").trim(),
    email: (input.email || "").trim(),
    status: "submitted",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  writeAll([row, ...all]);
  return row;
}

export function updateRequisitionStatus(
  id: string,
  status: RequisitionStatus,
): AdminRequisition | null {
  const all = readAll();
  const idx = all.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  all[idx] = { ...all[idx], status, updatedAt: nowIso() };
  writeAll(all);
  return all[idx];
}

export function requisitionItemLabel(type: RequisitionItemType): string {
  return REQUISITION_ITEM_OPTIONS.find((o) => o.value === type)?.label ?? type;
}
