import { escapeHtml, openPrintDocument } from "@/lib/html";
import { downloadCsv, downloadXlsx } from "@/lib/spreadsheet";
import type { GlEntry } from "@/services/gl-service";

function rowsForExport(rows: GlEntry[]) {
  return rows.map((r) => ({
    "Journal No": r.journal_number ?? "",
    "Voucher No": r.entry_number,
    "Posting Date": r.entry_date,
    "Fiscal Year": r.fiscal_year_code ?? "",
    Period: r.period_name ?? "",
    "Account Code": r.account_code,
    "Account Name": r.account_name ?? "",
    "Cost Center": r.cost_center_name ?? r.cost_center_id ?? "",
    Project: r.project_ref ?? "",
    Debit: r.base_debit_amount,
    Credit: r.base_credit_amount,
    "Running Balance": r.running_balance ?? "",
    Status: r.journal_status ?? "posted",
    Currency: r.currency_code ?? "",
    Description: r.description ?? "",
  }));
}

export function exportGlCsv(rows: GlEntry[]) {
  downloadCsv(
    `general-ledger-${new Date().toISOString().slice(0, 10)}.csv`,
    rowsForExport(rows),
  );
}

export async function exportGlXlsx(rows: GlEntry[]) {
  await downloadXlsx(
    `general-ledger-${new Date().toISOString().slice(0, 10)}.xlsx`,
    [{ name: "General Ledger", rows: rowsForExport(rows) }],
  );
}

export function printGlTable(title: string, rows: GlEntry[]) {
  const safeTitle = escapeHtml(title);
  const body = rows
    .map(
      (r) =>
        `<tr>
          <td>${escapeHtml(r.journal_number ?? "")}</td>
          <td>${escapeHtml(r.entry_number)}</td>
          <td>${escapeHtml(r.entry_date)}</td>
          <td>${escapeHtml(r.account_code)}</td>
          <td>${escapeHtml(r.account_name ?? "")}</td>
          <td style="text-align:right">${Number(r.base_debit_amount).toFixed(2)}</td>
          <td style="text-align:right">${Number(r.base_credit_amount).toFixed(2)}</td>
          <td>${escapeHtml(r.journal_status ?? "posted")}</td>
        </tr>`,
    )
    .join("");
  openPrintDocument(`<!doctype html><html><head><title>${safeTitle}</title>
    <style>
      body{font-family:Inter,system-ui,sans-serif;font-size:12px;color:#0f172a;padding:24px}
      h1{font-size:16px;margin:0 0 12px}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left}
      th{background:#f8fafc;font-size:11px;text-transform:uppercase}
    </style></head><body>
    <h1>${safeTitle}</h1>
    <table><thead><tr>
      <th>Journal</th><th>Voucher</th><th>Date</th><th>Account</th><th>Name</th><th>Debit</th><th>Credit</th><th>Status</th>
    </tr></thead><tbody>${body}</tbody></table>
    </body></html>`);
}
