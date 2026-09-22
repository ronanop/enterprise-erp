import type { AccountingPeriod, FiscalYear } from "@/services/fiscal-service";
import { periodStatusLabel } from "@/services/fiscal-service";
import { downloadCsv, downloadXlsx } from "@/lib/spreadsheet";

function fiscalYearRows(
  rows: FiscalYear[],
  resolveUser: (id?: string | null) => string,
) {
  return rows.map((r) => ({
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
}

function periodRows(rows: AccountingPeriod[]) {
  return rows.map((r) => ({
    Month: r.period_name,
    Quarter: r.quarter ?? "",
    Status: periodStatusLabel(r.status),
    "Open Date": r.start_date,
    "Close Date": r.end_date,
    Locked: r.gl_closed || r.status === "hard_closed" ? "Yes" : "No",
    Year: r.fiscal_year_code ?? "",
    "Journal Count": r.journal_count ?? 0,
  }));
}

export function exportFiscalYearsCsv(
  rows: FiscalYear[],
  resolveUser: (id?: string | null) => string = () => "",
) {
  downloadCsv(
    `fiscal-years-${new Date().toISOString().slice(0, 10)}.csv`,
    fiscalYearRows(rows, resolveUser),
  );
}

export async function exportFiscalYearsXlsx(
  rows: FiscalYear[],
  resolveUser: (id?: string | null) => string = () => "",
) {
  await downloadXlsx(
    `fiscal-years-${new Date().toISOString().slice(0, 10)}.xlsx`,
    [{ name: "Fiscal Years", rows: fiscalYearRows(rows, resolveUser) }],
  );
}

export function exportPeriodsCsv(rows: AccountingPeriod[]) {
  downloadCsv(
    `accounting-periods-${new Date().toISOString().slice(0, 10)}.csv`,
    periodRows(rows),
  );
}

export async function exportPeriodsXlsx(rows: AccountingPeriod[]) {
  await downloadXlsx(
    `accounting-periods-${new Date().toISOString().slice(0, 10)}.xlsx`,
    [{ name: "Periods", rows: periodRows(rows) }],
  );
}

export function downloadFiscalImportTemplate() {
  downloadCsv("fiscal-year-import-template.csv", [
    {
      fiscal_year_code: "FY2026",
      fiscal_year_name: "Financial Year 2026",
      start_date: "2026-04-01",
      end_date: "2027-03-31",
      description: "",
    },
  ]);
}
