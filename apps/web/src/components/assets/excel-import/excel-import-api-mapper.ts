/**
 * CR-004 Phase 8B — map preview rows → POST /assets/assets/import payload.
 */

import {
  normalizeLookupKey,
  normalizeOperationalStatus,
  parseImportDate,
} from "@/components/assets/excel-import/excel-import-mapper";
import type {
  ExcelImportMasterLookups,
  ExcelImportPreviewRow,
} from "@/components/assets/excel-import/excel-import.types";

export type AssetExcelImportApiRow = {
  row_number: number;
  preview_status: string;
  asset_tag: string;
  asset_name: string;
  branch_id: string;
  operational_status: string;
  employee_id?: string | null;
  department_id?: string | null;
  asset_category_id?: string | null;
  asset_type_id: string;
  serial_number?: string | null;
  make?: string | null;
  model?: string | null;
  configuration?: string | null;
  location_label?: string | null;
  issue_date?: string | null;
  delivery_reference_number?: string | null;
  delivery_reference_status?: string | null;
  delivery_challan_signature_status?: string | null;
  assignment_remarks?: string | null;
};

export type AssetExcelImportApiRequest = {
  company_id?: string | null;
  batch_size?: number;
  confirm_warnings: boolean;
  defaults: {
    asset_category_id: string;
    asset_type?: string;
    purchase_date?: string | null;
    purchase_cost?: string;
    currency_code?: string;
  };
  rows: AssetExcelImportApiRow[];
};

export type AssetExcelImportSummaryDto = {
  total_rows: number;
  imported: number;
  skipped: number;
  duplicates: number;
  warnings: number;
  failed: number;
  duration_ms: number;
  batch_count: number;
  rows: Array<{
    row_number: number;
    outcome: string;
    reason?: string | null;
    asset_id?: string | null;
    assignment_id?: string | null;
    operational_status?: string | null;
    warning?: boolean;
  }>;
};

function resolveId(
  map: Map<string, string>,
  raw: string | undefined,
): string | null {
  if (!raw?.trim()) return null;
  return map.get(normalizeLookupKey(raw)) ?? null;
}

/** Build importable API rows from Phase 8A preview (valid + optionally warning). */
export function buildImportPayloadRows(
  previewRows: ExcelImportPreviewRow[],
  lookups: ExcelImportMasterLookups,
  options: { includeWarnings: boolean },
): AssetExcelImportApiRow[] {
  const { includeWarnings } = options;
  const out: AssetExcelImportApiRow[] = [];
  for (const row of previewRows) {
    if (row.status === "invalid") continue;
    if (row.status === "warning" && !includeWarnings) continue;

    const branchId = resolveId(lookups.branchesByLabel, row.values.branch);
    if (!branchId) continue;

    const typeId = resolveId(lookups.typesByLabel, row.values.assetType);
    if (!typeId) continue;

    const ops = normalizeOperationalStatus(row.values.operationalStatus ?? "");
    if (!ops) continue;

    const tag = (row.values.assetTag ?? "").trim();
    const name = (row.values.laptopName ?? "").trim();
    if (!tag || !name) continue;

    const issue = parseImportDate(row.values.issueDate ?? "");
    out.push({
      row_number: row.rowNumber,
      preview_status: row.status,
      asset_tag: tag,
      asset_name: name,
      branch_id: branchId,
      operational_status: ops,
      employee_id: resolveId(lookups.employeesByKey, row.values.employeeId),
      department_id: resolveId(lookups.departmentsByLabel, row.values.department),
      asset_type_id: typeId,
      serial_number: (row.values.serialNumber ?? "").trim() || null,
      make: (row.values.manufacturer ?? "").trim() || null,
      model: (row.values.model ?? "").trim() || null,
      configuration: (row.values.configuration ?? "").trim() || null,
      location_label: (row.values.location ?? "").trim() || null,
      issue_date: issue.ok && issue.iso ? issue.iso : null,
      delivery_reference_number: (row.values.deliveryReference ?? "").trim() || null,
      delivery_reference_status: (row.values.deliveryStatus ?? "").trim() || null,
      delivery_challan_signature_status: (row.values.deliverySignature ?? "").trim() || null,
      assignment_remarks: (row.values.assignmentRemarks ?? "").trim() || null,
    });
  }
  return out;
}
