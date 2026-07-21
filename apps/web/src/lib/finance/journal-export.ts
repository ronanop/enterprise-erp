import * as XLSX from "xlsx";

import type { Journal } from "@/services/journal-service";
import { journalDifference } from "@/services/journal-service";

type PeriodMap = Record<string, string>;

function shortId(value?: string | null): string {
  if (!value) return "";
  return value;
}

function rowsForExport(
  rows: Journal[],
  periodLabels: PeriodMap,
  resolveUser: (id?: string | null) => string,
) {
  return rows.map((r) => ({
    "Voucher No": r.journal_number,
    Date: r.journal_date,
    Type: r.journal_type,
    Period: r.period_id ? periodLabels[r.period_id] ?? r.period_id : "",
    Status: r.status,
    Workflow: r.workflow_status,
    Debit: r.total_debit,
    Credit: r.total_credit,
    Difference: journalDifference(r),
    "Created By": resolveUser(r.created_by),
    "Posted By": resolveUser(r.posted_by),
    "Posted At": r.posted_at ?? "",
    Description: r.description,
  }));
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportJournalsCsv(
  rows: Journal[],
  periodLabels: PeriodMap,
  resolveUser: (id?: string | null) => string = shortId,
) {
  const data = rowsForExport(rows, periodLabels, resolveUser);
  const ws = XLSX.utils.json_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(ws);
  downloadBlob(
    `journals-${new Date().toISOString().slice(0, 10)}.csv`,
    new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }),
  );
}

export function exportJournalsXlsx(
  rows: Journal[],
  periodLabels: PeriodMap,
  resolveUser: (id?: string | null) => string = shortId,
) {
  const data = rowsForExport(rows, periodLabels, resolveUser);
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Journals");
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  downloadBlob(
    `journals-${new Date().toISOString().slice(0, 10)}.xlsx`,
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
}
