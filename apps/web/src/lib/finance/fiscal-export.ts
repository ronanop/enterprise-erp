import * as XLSX from "xlsx";

import type { AccountingPeriod, FiscalYear } from "@/services/fiscal-service";
import { periodStatusLabel } from "@/services/fiscal-service";

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportFiscalYearsCsv(
  rows: FiscalYear[],
  resolveUser: (id?: string | null) => string = () => "",
) {
  const data = rows.map((r) => ({
    Code: r.fiscal_year_code,
    Name: r.fiscal_year_name,
    "Start Date": r.start_date,
    "End Date": r.end_date,
    Status: r.status,
    Closed: r.status === "closed" ? "Yes" : "No",
    Default: r.is_default ? "Yes" : "No",
    Periods: r.period_count ?? 0,
    "Created By": resolveUser(r.created_by),
    "Last Updated": r.updated_at?.slice(0, 19) ?? "",
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(ws);
  downloadBlob(
    `fiscal-years-${new Date().toISOString().slice(0, 10)}.csv`,
    new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }),
  );
}

export function exportFiscalYearsXlsx(
  rows: FiscalYear[],
  resolveUser: (id?: string | null) => string = () => "",
) {
  const data = rows.map((r) => ({
    Code: r.fiscal_year_code,
    Name: r.fiscal_year_name,
    "Start Date": r.start_date,
    "End Date": r.end_date,
    Status: r.status,
    Closed: r.status === "closed" ? "Yes" : "No",
    Default: r.is_default ? "Yes" : "No",
    Periods: r.period_count ?? 0,
    "Created By": resolveUser(r.created_by),
    "Last Updated": r.updated_at?.slice(0, 19) ?? "",
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Fiscal Years");
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  downloadBlob(
    `fiscal-years-${new Date().toISOString().slice(0, 10)}.xlsx`,
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
}

export function exportPeriodsCsv(rows: AccountingPeriod[]) {
  const data = rows.map((r) => ({
    Month: r.period_name,
    Quarter: r.quarter ?? "",
    Status: periodStatusLabel(r.status),
    "Open Date": r.start_date,
    "Close Date": r.end_date,
    Locked: r.gl_closed || r.status === "hard_closed" ? "Yes" : "No",
    Year: r.fiscal_year_code ?? "",
    "Journal Count": r.journal_count ?? 0,
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(ws);
  downloadBlob(
    `accounting-periods-${new Date().toISOString().slice(0, 10)}.csv`,
    new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }),
  );
}

export function exportPeriodsXlsx(rows: AccountingPeriod[]) {
  const data = rows.map((r) => ({
    Month: r.period_name,
    Quarter: r.quarter ?? "",
    Status: periodStatusLabel(r.status),
    "Open Date": r.start_date,
    "Close Date": r.end_date,
    Locked: r.gl_closed || r.status === "hard_closed" ? "Yes" : "No",
    Year: r.fiscal_year_code ?? "",
    "Journal Count": r.journal_count ?? 0,
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Periods");
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  downloadBlob(
    `accounting-periods-${new Date().toISOString().slice(0, 10)}.xlsx`,
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
}

export function downloadFiscalImportTemplate() {
  const sample = [
    {
      fiscal_year_code: "FY2026",
      fiscal_year_name: "Financial Year 2026",
      start_date: "2026-04-01",
      end_date: "2027-03-31",
      description: "",
    },
  ];
  const ws = XLSX.utils.json_to_sheet(sample);
  const csv = XLSX.utils.sheet_to_csv(ws);
  downloadBlob(
    "fiscal-year-import-template.csv",
    new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }),
  );
}
