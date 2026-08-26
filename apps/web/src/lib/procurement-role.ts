/** Demo procurement persona: normal user vs team admin (local only). */

export type ProcurementRole = "user" | "admin";

const STORAGE_KEY = "erp.procurement.role";
export const PROCUREMENT_ROLE_EVENT = "erp-procurement-role-change";

export function readProcurementRole(): ProcurementRole {
  if (typeof window === "undefined") return "user";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === "admin" ? "admin" : "user";
  } catch {
    return "user";
  }
}

export function writeProcurementRole(role: ProcurementRole): void {
  window.localStorage.setItem(STORAGE_KEY, role);
  window.dispatchEvent(new Event(PROCUREMENT_ROLE_EVENT));
}

export function toggleProcurementRole(): ProcurementRole {
  const next: ProcurementRole = readProcurementRole() === "admin" ? "user" : "admin";
  writeProcurementRole(next);
  return next;
}
