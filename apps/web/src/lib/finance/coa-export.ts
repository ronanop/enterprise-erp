import * as XLSX from "xlsx";

import type { ChartOfAccount } from "@/services/coa-service";
import { accountTypeLabel } from "@/services/coa-service";

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function rowsForExport(
  rows: ChartOfAccount[],
  resolveUser: (id?: string | null) => string,
) {
  return rows.map((r) => ({
    "Account Code": r.account_code,
    "Account Name": r.account_name,
    Parent: r.parent_account_code
      ? `${r.parent_account_code} · ${r.parent_account_name ?? ""}`
      : "",
    "Account Type": accountTypeLabel(r.account_type),
    Category: r.account_group_name ?? r.account_group_code ?? "",
    Currency: r.currency_code ?? "",
    Status: r.status,
    "Allow Posting": r.is_posting_account ? "Yes" : "No",
    Balance: r.balance ?? 0,
    "Created By": resolveUser(r.created_by),
    "Normal Balance": r.normal_balance,
    Description: r.description ?? "",
  }));
}

export function exportCoaCsv(
  rows: ChartOfAccount[],
  resolveUser: (id?: string | null) => string = () => "",
) {
  const data = rowsForExport(rows, resolveUser);
  const ws = XLSX.utils.json_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(ws);
  downloadBlob(
    `chart-of-accounts-${new Date().toISOString().slice(0, 10)}.csv`,
    new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }),
  );
}

export function exportCoaXlsx(
  rows: ChartOfAccount[],
  resolveUser: (id?: string | null) => string = () => "",
) {
  const data = rowsForExport(rows, resolveUser);
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Chart of Accounts");
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  downloadBlob(
    `chart-of-accounts-${new Date().toISOString().slice(0, 10)}.xlsx`,
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
}

export function downloadCoaImportTemplate() {
  const sample = [
    {
      account_group_code: "ASSET",
      account_code: "1000",
      account_name: "Cash",
      account_type: "asset",
      normal_balance: "debit",
      parent_account_code: "",
      is_posting_account: true,
      is_cost_center_enabled: false,
      currency_code: "INR",
      description: "",
      status: "draft",
    },
  ];
  const ws = XLSX.utils.json_to_sheet(sample);
  const csv = XLSX.utils.sheet_to_csv(ws);
  downloadBlob(
    "coa-import-template.csv",
    new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }),
  );
}
