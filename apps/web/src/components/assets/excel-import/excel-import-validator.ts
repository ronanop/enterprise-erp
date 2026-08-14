/**
 * Template + row validators for Excel import preview (read-only).
 */

import {
  applyColumnMapping,
  normalizeDcSignatureStatus,
  normalizeDeliveryStatus,
  normalizeLookupKey,
  normalizeOperationalStatus,
  parseImportDate,
  requiredFieldsUnmapped,
  suggestColumnMapping,
} from "@/components/assets/excel-import/excel-import-mapper";
import {
  EXCEL_IMPORT_HARD_MAX_ROWS,
  EXCEL_IMPORT_LARGE_FILE_ROW_THRESHOLD,
  EXCEL_IMPORT_TARGET_FIELDS,
  type ExcelImportColumnMapping,
  type ExcelImportIssue,
  type ExcelImportMasterLookups,
  type ExcelImportPreviewRow,
  type ExcelImportRawSheet,
  type ExcelImportTemplateResult,
  type ExcelImportValidationSummary,
} from "@/components/assets/excel-import/excel-import.types";

export function validateImportTemplate(
  sheet: ExcelImportRawSheet,
  mapping?: ExcelImportColumnMapping,
): ExcelImportTemplateResult {
  const suggested = mapping ?? suggestColumnMapping(sheet.headers);
  const missingRequired = requiredFieldsUnmapped(suggested);
  const issues: ExcelImportIssue[] = missingRequired.map((field) => {
    const def = EXCEL_IMPORT_TARGET_FIELDS.find((f) => f.key === field)!;
    return {
      severity: "error" as const,
      code: "missing_required_column" as const,
      message: `Required column not mapped: ${def.label}`,
      field,
    };
  });

  if (sheet.rows.length === 0) {
    issues.push({
      severity: "error",
      code: "empty_workbook",
      message: "Workbook has no data rows",
    });
  }

  if (sheet.rows.length > EXCEL_IMPORT_LARGE_FILE_ROW_THRESHOLD) {
    issues.push({
      severity: "warning",
      code: "large_file",
      message: `File has ${sheet.rows.length} rows (threshold ${EXCEL_IMPORT_LARGE_FILE_ROW_THRESHOLD}). Preview may be slow.`,
    });
  }

  if (sheet.rows.length > EXCEL_IMPORT_HARD_MAX_ROWS) {
    issues.push({
      severity: "error",
      code: "large_file",
      message: `File exceeds hard limit of ${EXCEL_IMPORT_HARD_MAX_ROWS} rows for preview`,
    });
  }

  const ok =
    missingRequired.length === 0 &&
    sheet.rows.length > 0 &&
    sheet.rows.length <= EXCEL_IMPORT_HARD_MAX_ROWS;

  return { missingRequired, suggestedMapping: suggested, issues, ok };
}

function lookupHit(map: Map<string, string>, raw: string): boolean {
  const key = normalizeLookupKey(raw);
  if (!key) return false;
  if (map.has(key)) return true;
  // loose contains for employee labels
  for (const [k] of map) {
    if (k === key || k.includes(key) || key.includes(k)) return true;
  }
  return false;
}

export function validateImportRows(
  sheet: ExcelImportRawSheet,
  mapping: ExcelImportColumnMapping,
  lookups: ExcelImportMasterLookups,
): ExcelImportValidationSummary {
  const mapped = applyColumnMapping(sheet, mapping);
  const fileIssues: ExcelImportIssue[] = [];
  const previewRows: ExcelImportPreviewRow[] = [];

  const tagCounts = new Map<string, number[]>();
  for (const row of mapped) {
    const tag = (row.values.assetTag ?? "").trim().toLowerCase();
    if (!tag) continue;
    const list = tagCounts.get(tag) ?? [];
    list.push(row.rowNumber);
    tagCounts.set(tag, list);
  }
  const duplicateTags = new Set<string>();
  for (const [tag, rows] of tagCounts) {
    if (rows.length > 1) {
      duplicateTags.add(tag);
      fileIssues.push({
        severity: "error",
        code: "duplicate_asset_tag",
        message: `Duplicate Asset Tag "${tag}" in rows ${rows.join(", ")}`,
        field: "assetTag",
        value: tag,
      });
    }
  }

  for (const row of mapped) {
    const issues: ExcelImportIssue[] = [];
    const values = { ...row.values };

    const requireNonEmpty: Array<{ key: keyof typeof values; label: string }> = [
      { key: "assetTag", label: "Asset Tag" },
      { key: "laptopName", label: "Laptop Name" },
      { key: "branch", label: "Branch" },
      { key: "operationalStatus", label: "Operational Status" },
    ];

    for (const req of requireNonEmpty) {
      if (!values[req.key]?.trim()) {
        issues.push({
          severity: "error",
          code: "empty_mandatory",
          message: `${req.label} is required`,
          rowNumber: row.rowNumber,
          field: req.key,
        });
      }
    }

    const tag = values.assetTag?.trim().toLowerCase() ?? "";
    if (tag && duplicateTags.has(tag)) {
      issues.push({
        severity: "error",
        code: "duplicate_asset_tag",
        message: `Duplicate Asset Tag in file: ${values.assetTag}`,
        rowNumber: row.rowNumber,
        field: "assetTag",
        value: values.assetTag,
      });
    }

    if (values.operationalStatus?.trim()) {
      const normalized = normalizeOperationalStatus(values.operationalStatus);
      if (!normalized) {
        issues.push({
          severity: "error",
          code: "invalid_operational_status",
          message: `Invalid operational status: ${values.operationalStatus}`,
          rowNumber: row.rowNumber,
          field: "operationalStatus",
          value: values.operationalStatus,
        });
      } else {
        values.operationalStatus = normalized;
      }
    }

    if (values.branch?.trim()) {
      if (!lookupHit(lookups.branchesByLabel, values.branch)) {
        issues.push({
          severity: "error",
          code: "invalid_branch",
          message: `Unknown branch: ${values.branch}`,
          rowNumber: row.rowNumber,
          field: "branch",
          value: values.branch,
        });
      }
    }

    if (values.department?.trim()) {
      if (!lookupHit(lookups.departmentsByLabel, values.department)) {
        issues.push({
          severity: "error",
          code: "invalid_department",
          message: `Unknown department: ${values.department}`,
          rowNumber: row.rowNumber,
          field: "department",
          value: values.department,
        });
      }
    }

    if (values.category?.trim()) {
      if (!lookupHit(lookups.categoriesByLabel, values.category)) {
        issues.push({
          severity: "error",
          code: "invalid_category",
          message: `Unknown asset category: ${values.category}`,
          rowNumber: row.rowNumber,
          field: "category",
          value: values.category,
        });
      }
    }

    if (values.employeeId?.trim()) {
      if (!lookupHit(lookups.employeesByKey, values.employeeId)) {
        issues.push({
          severity: "error",
          code: "invalid_employee",
          message: `Unknown employee ID: ${values.employeeId}`,
          rowNumber: row.rowNumber,
          field: "employeeId",
          value: values.employeeId,
        });
      }
    }

    if (values.issueDate?.trim()) {
      const parsed = parseImportDate(values.issueDate);
      if (!parsed.ok) {
        issues.push({
          severity: "error",
          code: "invalid_date",
          message: `Invalid issue date: ${values.issueDate}`,
          rowNumber: row.rowNumber,
          field: "issueDate",
          value: values.issueDate,
        });
      } else {
        values.issueDate = parsed.iso;
      }
    }

    if (values.deliveryStatus?.trim()) {
      const normalized = normalizeDeliveryStatus(values.deliveryStatus);
      if (!normalized) {
        issues.push({
          severity: "error",
          code: "invalid_delivery_status",
          message: `Invalid delivery status: ${values.deliveryStatus}`,
          rowNumber: row.rowNumber,
          field: "deliveryStatus",
          value: values.deliveryStatus,
        });
      } else {
        values.deliveryStatus = normalized;
      }
    }

    if (values.deliverySignature?.trim()) {
      const normalized = normalizeDcSignatureStatus(values.deliverySignature);
      if (!normalized) {
        issues.push({
          severity: "error",
          code: "invalid_dc_signature_status",
          message: `Invalid DC signature status: ${values.deliverySignature}`,
          rowNumber: row.rowNumber,
          field: "deliverySignature",
          value: values.deliverySignature,
        });
      } else {
        values.deliverySignature = normalized;
      }
    }

    // Assigned without employee → warning
    if (
      values.operationalStatus === "ASSIGNED" &&
      !values.employeeId?.trim() &&
      !issues.some((i) => i.field === "employeeId" && i.code === "empty_mandatory")
    ) {
      issues.push({
        severity: "warning",
        code: "empty_mandatory",
        message: "ASSIGNED status without Employee ID",
        rowNumber: row.rowNumber,
        field: "employeeId",
      });
    }

    const hasError = issues.some((i) => i.severity === "error");
    const hasWarning = issues.some((i) => i.severity === "warning");
    const status = hasError ? "invalid" : hasWarning ? "warning" : "valid";

    previewRows.push({
      rowNumber: row.rowNumber,
      status,
      values,
      issues,
    });
  }

  const validCount = previewRows.filter((r) => r.status === "valid").length;
  const invalidCount = previewRows.filter((r) => r.status === "invalid").length;
  const warningCount = previewRows.filter((r) => r.status === "warning").length;
  const rowIssues = previewRows.flatMap((r) => r.issues);

  return {
    totalRows: previewRows.length,
    validCount,
    invalidCount,
    warningCount,
    issues: [...fileIssues, ...rowIssues],
    previewRows,
  };
}
