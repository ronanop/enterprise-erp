/**
 * Maps InventoryRowViewModel → flat export rows (existing mapper fields only).
 */

import type { InventoryRowViewModel } from "@/components/assets/inventory.mapper";
import {
  INVENTORY_EXPORT_COLUMNS,
  type InventoryExportColumnDef,
  type InventoryExportColumnKey,
  type InventoryExportRow,
} from "@/components/assets/inventory/export/inventory-export.types";

export function getInventoryExportColumns(): InventoryExportColumnDef[] {
  return INVENTORY_EXPORT_COLUMNS.map((c) => ({ key: c.key, label: c.label }));
}

export function getInventoryExportColumnLabels(): string[] {
  return INVENTORY_EXPORT_COLUMNS.map((c) => c.label);
}

export function mapInventoryRowToExportRow(row: InventoryRowViewModel): InventoryExportRow {
  return {
    assetTag: row.assetTag,
    laptopName: row.laptopName,
    manufacturer: row.manufacturer,
    model: row.model,
    configuration: row.configuration,
    currentHolder: row.currentHolder,
    employeeId: row.employeeId,
    department: row.department,
    branch: row.branch,
    operationalStatus: row.operationalStatus,
    lifecycleStatus: row.lifecycleStatus,
    issueDate: row.issueDate,
    earlierUsedBy: row.expandable.earlierUsedBy,
    deliveryReference: row.expandable.deliveryChallan,
    deliveryStatus: row.expandable.deliveryReferenceStatus,
    assignmentRemarks: row.expandable.assignmentRemarks,
    returnRemarks: row.expandable.returnRemarks,
    location: row.location,
  };
}

export function mapInventoryRowsToExportRows(rows: InventoryRowViewModel[]): InventoryExportRow[] {
  return rows.map(mapInventoryRowToExportRow);
}

/** Ordered label → value records for sheet libraries. */
export function exportRowsToLabeledRecords(
  rows: InventoryExportRow[],
): Array<Record<string, string>> {
  return rows.map((row) => {
    const out: Record<string, string> = {};
    for (const col of INVENTORY_EXPORT_COLUMNS) {
      out[col.label] = row[col.key] ?? "";
    }
    return out;
  });
}

export function assertExportColumnOrder(keys: InventoryExportColumnKey[]): boolean {
  const expected = INVENTORY_EXPORT_COLUMNS.map((c) => c.key);
  if (keys.length !== expected.length) return false;
  return keys.every((k, i) => k === expected[i]);
}
