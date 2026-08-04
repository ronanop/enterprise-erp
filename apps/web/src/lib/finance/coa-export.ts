import type { ChartOfAccount } from "@/services/coa-service";
import { accountTypeLabel } from "@/services/coa-service";
import { downloadCsv, downloadXlsx } from "@/lib/spreadsheet";

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
  downloadCsv(
    `chart-of-accounts-${new Date().toISOString().slice(0, 10)}.csv`,
    rowsForExport(rows, resolveUser),
  );
}

export async function exportCoaXlsx(
  rows: ChartOfAccount[],
  resolveUser: (id?: string | null) => string = () => "",
) {
  await downloadXlsx(
    `chart-of-accounts-${new Date().toISOString().slice(0, 10)}.xlsx`,
    [{ name: "Chart of Accounts", rows: rowsForExport(rows, resolveUser) }],
  );
}

export function downloadCoaImportTemplate() {
  downloadCsv("coa-import-template.csv", [
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
  ]);
}
