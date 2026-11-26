import { newUuid } from "@/lib/uuid";
/**
 * IT & Admin - requisitions (ID card, visiting card, t-shirts, gifts).
 * Local PWA store until a dedicated API exists.
 */

export type RequisitionItemType =
  | "id_card"
  | "visiting_card"
  | "t_shirt"
  | "gift";

export type RequisitionStatus = "submitted" | "in_progress" | "fulfilled" | "rejected";

export type GiftCategory = "welcome_kit" | "festival" | "appreciation" | "event";
export type GiftRecipientType = "employee" | "client" | "guest";
export type TShirtSize = "XS" | "S" | "M" | "L" | "XL" | "XXL" | "XXXL";

export type AdminRequisition = {
  id: string;
  itemType: RequisitionItemType;
  quantity: number;
  notes: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  email: string;
  department: string;
  designation: string;
  dateOfBirth: string;
  companyName: string;
  branchName: string;
  tShirtSize: string;
  giftCategory: string;
  recipientType: string;
  recipientName: string;
  purpose: string;
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

export const T_SHIRT_SIZE_OPTIONS: { value: TShirtSize; label: string }[] = [
  { value: "XS", label: "XS" },
  { value: "S", label: "S" },
  { value: "M", label: "M" },
  { value: "L", label: "L" },
  { value: "XL", label: "XL" },
  { value: "XXL", label: "XXL" },
  { value: "XXXL", label: "XXXL" },
];

export const GIFT_CATEGORY_OPTIONS: { value: GiftCategory; label: string }[] = [
  { value: "welcome_kit", label: "Welcome Kit" },
  { value: "festival", label: "Festival Gift" },
  { value: "appreciation", label: "Appreciation" },
  { value: "event", label: "Event" },
];

export const GIFT_RECIPIENT_TYPE_OPTIONS: { value: GiftRecipientType; label: string }[] = [
  { value: "employee", label: "Employee" },
  { value: "client", label: "Client" },
  { value: "guest", label: "Guest" },
];

function readAll(): AdminRequisition[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<AdminRequisition>[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeRow);
  } catch {
    return [];
  }
}

function normalizeRow(row: Partial<AdminRequisition>): AdminRequisition {
  return {
    id: String(row.id || newUuid()),
    itemType: (row.itemType as RequisitionItemType) || "id_card",
    quantity: Math.max(1, Number(row.quantity) || 1),
    notes: String(row.notes || ""),
    employeeId: String(row.employeeId || ""),
    employeeName: String(row.employeeName || ""),
    employeeCode: String(row.employeeCode || ""),
    email: String(row.email || ""),
    department: String(row.department || ""),
    designation: String(row.designation || ""),
    dateOfBirth: String(row.dateOfBirth || ""),
    companyName: String(row.companyName || ""),
    branchName: String(row.branchName || ""),
    tShirtSize: String(row.tShirtSize || ""),
    giftCategory: String(row.giftCategory || ""),
    recipientType: String(row.recipientType || ""),
    recipientName: String(row.recipientName || ""),
    purpose: String(row.purpose || ""),
    status: (row.status as RequisitionStatus) || "submitted",
    createdAt: String(row.createdAt || new Date().toISOString()),
    updatedAt: String(row.updatedAt || row.createdAt || new Date().toISOString()),
  };
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

export type CreateRequisitionInput = {
  itemType: RequisitionItemType;
  quantity?: number;
  notes?: string;
  employeeId?: string;
  employeeName: string;
  employeeCode?: string;
  email?: string;
  department?: string;
  designation?: string;
  dateOfBirth?: string;
  companyName?: string;
  branchName?: string;
  tShirtSize?: string;
  giftCategory?: string;
  recipientType?: string;
  recipientName?: string;
  purpose?: string;
};

export function createRequisition(input: CreateRequisitionInput): AdminRequisition {
  const all = readAll();
  const row = normalizeRow({
    id: newUuid(),
    itemType: input.itemType,
    quantity: Math.max(1, Math.floor(input.quantity ?? 1) || 1),
    notes: (input.notes || "").trim(),
    employeeId: (input.employeeId || "").trim(),
    employeeName: input.employeeName.trim() || "Employee",
    employeeCode: (input.employeeCode || "").trim(),
    email: (input.email || "").trim(),
    department: (input.department || "").trim(),
    designation: (input.designation || "").trim(),
    dateOfBirth: (input.dateOfBirth || "").trim(),
    companyName: (input.companyName || "").trim(),
    branchName: (input.branchName || "").trim(),
    tShirtSize: (input.tShirtSize || "").trim(),
    giftCategory: (input.giftCategory || "").trim(),
    recipientType: (input.recipientType || "").trim(),
    recipientName: (input.recipientName || "").trim(),
    purpose: (input.purpose || "").trim(),
    status: "submitted",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
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

export function giftCategoryLabel(value: string): string {
  return GIFT_CATEGORY_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function giftRecipientTypeLabel(value: string): string {
  return GIFT_RECIPIENT_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}
