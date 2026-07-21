import * as XLSX from "xlsx";

import type { GlEntry } from "@/services/gl-service";

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

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
  const data = rowsForExport(rows);
  const ws = XLSX.utils.json_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(ws);
  downloadBlob(
    `general-ledger-${new Date().toISOString().slice(0, 10)}.csv`,
    new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }),
  );
}

export function exportGlXlsx(rows: GlEntry[]) {
  const data = rowsForExport(rows);
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "General Ledger");
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  downloadBlob(
    `general-ledger-${new Date().toISOString().slice(0, 10)}.xlsx`,
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
}

export function printGlTable(title: string, rows: GlEntry[]) {
  const win = window.open("", "_blank", "noopener,noreferrer,width=1200,height=800");
  if (!win) return;
  const body = rows
    .map(
      (r) =>
        `<tr>
          <td>${r.journal_number ?? ""}</td>
          <td>${r.entry_number}</td>
          <td>${r.entry_date}</td>
          <td>${r.account_code}</td>
          <td>${r.account_name ?? ""}</td>
          <td style="text-align:right">${Number(r.base_debit_amount).toFixed(2)}</td>
          <td style="text-align:right">${Number(r.base_credit_amount).toFixed(2)}</td>
          <td>${r.journal_status ?? "posted"}</td>
        </tr>`,
    )
    .join("");
  win.document.write(`<!doctype html><html><head><title>${title}</title>
    <style>
      body{font-family:Inter,system-ui,sans-serif;font-size:12px;color:#0f172a;padding:24px}
      h1{font-size:16px;margin:0 0 12px}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left}
      th{background:#f8fafc;font-size:11px;text-transform:uppercase}
    </style></head><body>
    <h1>${title}</h1>
    <table><thead><tr>
      <th>Journal</th><th>Voucher</th><th>Date</th><th>Account</th><th>Name</th><th>Debit</th><th>Credit</th><th>Status</th>
    </tr></thead><tbody>${body}</tbody></table>
    <script>window.onload=()=>{window.print();}</script>
    </body></html>`);
  win.document.close();
}
