/**
 * CR-004 Phase 7A — Inventory register export types.
 */

export type InventoryExportFormat = "xlsx" | "csv";

/** Ordered Excel/CSV columns (register ownership; no duplicates). */
export const INVENTORY_EXPORT_COLUMNS = [
  { key: "assetTag", label: "Asset Tag" },
  { key: "laptopName", label: "Laptop Name" },
  { key: "manufacturer", label: "Manufacturer" },
  { key: "model", label: "Model" },
  { key: "configuration", label: "Configuration" },
  { key: "currentHolder", label: "Current Holder" },
  { key: "employeeId", label: "Employee ID" },
  { key: "department", label: "Department" },
  { key: "branch", label: "Branch" },
  { key: "operationalStatus", label: "Operational Status" },
  { key: "lifecycleStatus", label: "Lifecycle Status" },
  { key: "issueDate", label: "Issue Date" },
  { key: "earlierUsedBy", label: "Earlier Used By" },
  { key: "deliveryReference", label: "Delivery Reference" },
  { key: "deliveryStatus", label: "Delivery Status" },
  { key: "assignmentRemarks", label: "Assignment Remarks" },
  { key: "returnRemarks", label: "Return Remarks" },
  { key: "location", label: "Location" },
] as const;

export type InventoryExportColumnKey = (typeof INVENTORY_EXPORT_COLUMNS)[number]["key"];

export type InventoryExportRow = Record<InventoryExportColumnKey, string>;

export type InventoryExportColumnDef = {
  key: InventoryExportColumnKey;
  label: string;
};

/** API pagination ceiling (asset module `get_pagination` le=200). */
export const INVENTORY_EXPORT_API_PAGE_SIZE = 200;

export type InventoryExportResult = {
  format: InventoryExportFormat;
  filename: string;
  rowCount: number;
};

export type InventoryExportErrorCode =
  | "fetch_failed"
  | "generate_failed"
  | "download_failed"
  | "empty";

export class InventoryExportError extends Error {
  readonly code: InventoryExportErrorCode;

  constructor(code: InventoryExportErrorCode, message: string) {
    super(message);
    this.name = "InventoryExportError";
    this.code = code;
  }
}
