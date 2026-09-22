import { downloadXlsxMatrix, type SpreadsheetCellValue } from "@/lib/spreadsheet";
import { formatReportCellValue, isReportAmountColumn } from "@/lib/crm/report-amount";
import { ApiClientError, apiClient } from "@/services/api-client";

const CRM_REPORTS_API = "/crm/reports";

export type CrmReportModule = {
  key: string;
  label: string;
};

export type CrmReportColumn = {
  key: string;
  label: string;
};

export type CrmSavedReportDefinition = {
  columns: string[];
  column_labels?: Record<string, string>;
};

export type CrmSavedReport = {
  id: string;
  report_code: string;
  report_name: string;
  primary_module: string;
  folder_name: string | null;
  description: string | null;
  definition_json: CrmSavedReportDefinition;
  owner_user_id: string;
  status: string;
  company_id: string;
  version: number;
  updated_at?: string | null;
  created_at?: string | null;
};

export type CrmReportRunColumn = {
  key: string;
  label: string;
};

export type CrmReportRunResult = {
  columns: CrmReportRunColumn[];
  rows: Record<string, unknown>[];
  record_count: number;
  primary_module: string;
  module_label: string;
};

export type CrmSavedReportCreateInput = {
  report_name: string;
  primary_module: string;
  columns: string[];
  folder_name?: string | null;
  description?: string | null;
};

export type CrmSavedReportUpdateInput = {
  report_name?: string;
  columns?: string[];
  folder_name?: string | null;
  description?: string | null;
  version?: number;
};

function requireData<T>(data: T | null | undefined, fallback: string): T {
  if (data == null) {
    throw new ApiClientError(fallback, 502);
  }
  return data;
}

export async function listCrmReportModules(): Promise<CrmReportModule[]> {
  const res = await apiClient<CrmReportModule[]>(`${CRM_REPORTS_API}/modules`, {
    method: "GET",
  });
  return requireData(res.data, "Report modules returned no data");
}

export async function listCrmReportColumns(moduleKey: string): Promise<CrmReportColumn[]> {
  const res = await apiClient<CrmReportColumn[]>(
    `${CRM_REPORTS_API}/modules/${encodeURIComponent(moduleKey)}/columns`,
    { method: "GET" },
  );
  return requireData(res.data, "Report columns returned no data");
}

export async function listSavedCrmReports(): Promise<CrmSavedReport[]> {
  const res = await apiClient<CrmSavedReport[]>(`${CRM_REPORTS_API}/saved`, {
    method: "GET",
  });
  return requireData(res.data, "Saved reports returned no data");
}

export async function getSavedCrmReport(reportId: string): Promise<CrmSavedReport> {
  const res = await apiClient<CrmSavedReport>(`${CRM_REPORTS_API}/saved/${reportId}`, {
    method: "GET",
  });
  return requireData(res.data, "Saved report returned no data");
}

export async function createSavedCrmReport(
  body: CrmSavedReportCreateInput,
): Promise<CrmSavedReport> {
  const res = await apiClient<CrmSavedReport>(`${CRM_REPORTS_API}/saved`, {
    method: "POST",
    body,
  });
  return requireData(res.data, "Create report returned no data");
}

export async function updateSavedCrmReport(
  reportId: string,
  body: CrmSavedReportUpdateInput,
): Promise<CrmSavedReport> {
  const res = await apiClient<CrmSavedReport>(`${CRM_REPORTS_API}/saved/${reportId}`, {
    method: "PATCH",
    body,
  });
  return requireData(res.data, "Update report returned no data");
}

export async function deleteSavedCrmReport(reportId: string): Promise<void> {
  await apiClient<{ id: string }>(`${CRM_REPORTS_API}/saved/${reportId}`, {
    method: "DELETE",
  });
}

export async function cloneSavedCrmReport(
  reportId: string,
  body?: { report_name?: string },
): Promise<CrmSavedReport> {
  const res = await apiClient<CrmSavedReport>(`${CRM_REPORTS_API}/saved/${reportId}/clone`, {
    method: "POST",
    body: body ?? {},
  });
  return requireData(res.data, "Clone report returned no data");
}

export async function runCrmReport(body: {
  primary_module: string;
  columns: string[];
  preview_limit?: number;
}): Promise<CrmReportRunResult> {
  const res = await apiClient<CrmReportRunResult>(`${CRM_REPORTS_API}/run`, {
    method: "POST",
    body,
  });
  return requireData(res.data, "Report run returned no data");
}

export async function runSavedCrmReport(
  reportId: string,
  previewLimit?: number,
): Promise<CrmReportRunResult> {
  const res = await apiClient<CrmReportRunResult>(`${CRM_REPORTS_API}/saved/${reportId}/run`, {
    method: "GET",
    query: previewLimit != null ? { preview_limit: previewLimit } : undefined,
  });
  return requireData(res.data, "Saved report run returned no data");
}

function sanitizeReportFilename(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[^\w\s.-]+/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_.-]+|[_.-]+$/g, "");
  return `${cleaned || "report"}.xlsx`;
}

function cellDisplayValue(columnKey: string, value: unknown): string | number | boolean | null {
  if (value == null) return null;
  if (isReportAmountColumn(columnKey)) {
    return formatReportCellValue(columnKey, value);
  }
  if (typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatGeneratedOn(date = new Date()): string {
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** Zoho-style Excel export for a CRM report run. */
export async function exportCrmReportXlsx(opts: {
  reportName: string;
  userName: string;
  run: CrmReportRunResult;
}): Promise<void> {
  const { reportName, userName, run } = opts;
  const colCount = Math.max(run.columns.length, 1);

  const padRow = (cells: SpreadsheetCellValue[]): SpreadsheetCellValue[] => {
    if (cells.length >= colCount) return cells;
    return [...cells, ...Array.from({ length: colCount - cells.length }, () => null)];
  };

  const headerRow: SpreadsheetCellValue[] = run.columns.map((col) => ({
    value: col.label,
    fontWeight: "bold" as const,
  }));

  const dataRows: SpreadsheetCellValue[][] = run.rows.map((row) =>
    run.columns.map((col) => cellDisplayValue(col.key, row[col.key])),
  );

  const matrix: SpreadsheetCellValue[][] = [
    padRow([{ value: reportName, fontWeight: "bold" }]),
    padRow([`Generated by ${userName} on ${formatGeneratedOn()}`]),
    padRow([]),
    padRow([`Record Count : ${run.record_count}`]),
    padRow([]),
    padRow(headerRow.length > 0 ? headerRow : ["-"]),
    ...dataRows.map((row) => padRow(row)),
  ];

  await downloadXlsxMatrix(sanitizeReportFilename(reportName), [
    { name: "Report", data: matrix },
  ]);
}
