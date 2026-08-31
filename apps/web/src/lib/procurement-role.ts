/** Procurement persona labels used by UI copy. Admin is ERP module-admin assignment. */

export type ProcurementRole = "user" | "admin";

/** @deprecated Local storage role toggle removed — kept for type/event compatibility only. */
export const PROCUREMENT_ROLE_EVENT = "erp-procurement-role-change";

/** @deprecated Prefer useProcurementRole() which reads ERP module admin assignment. */
export function readProcurementRole(): ProcurementRole {
  return "user";
}

/** @deprecated No-op — ERP module admin assignment is the source of truth. */
export function writeProcurementRole(_role: ProcurementRole): void {}

/** @deprecated No-op — ERP module admin assignment is the source of truth. */
export function toggleProcurementRole(): ProcurementRole {
  return "user";
}
