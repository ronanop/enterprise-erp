import type { Journal } from "@/services/journal-service";
import { journalDifference } from "@/services/journal-service";
import { downloadCsv, downloadXlsx } from "@/lib/spreadsheet";

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

export function exportJournalsCsv(
  rows: Journal[],
  periodLabels: PeriodMap,
  resolveUser: (id?: string | null) => string = shortId,
) {
  downloadCsv(
    `journals-${new Date().toISOString().slice(0, 10)}.csv`,
    rowsForExport(rows, periodLabels, resolveUser),
  );
}

export async function exportJournalsXlsx(
  rows: Journal[],
  periodLabels: PeriodMap,
  resolveUser: (id?: string | null) => string = shortId,
) {
  await downloadXlsx(
    `journals-${new Date().toISOString().slice(0, 10)}.xlsx`,
    [{ name: "Journals", rows: rowsForExport(rows, periodLabels, resolveUser) }],
  );
}
