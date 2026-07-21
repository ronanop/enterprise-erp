import { apiClient } from "@/services/api-client";

export const REPORTS_API = "/finance/reports";

export type ReportCatalogItem = {
  key: string;
  title: string;
  description: string;
  href: string;
  category: string;
};

export type TrialBalanceLine = {
  account_id: string;
  account_code: string;
  account_name: string;
  opening: number;
  debit_total: number;
  credit_total: number;
  closing: number;
  balance: number;
  account_type?: string | null;
};

export type TrialBalanceReport = {
  lines: TrialBalanceLine[];
  total_opening: number;
  total_debit: number;
  total_credit: number;
  total_closing: number;
  difference: number;
  period_id?: string | null;
  fiscal_year_id?: string | null;
  from_date?: string | null;
  to_date?: string | null;
};

export type StatementLine = {
  account_id?: string | null;
  account_code?: string | null;
  account_name: string;
  account_type?: string | null;
  amount: number;
  previous_amount: number;
  variance: number;
  section?: string | null;
  is_total?: boolean;
  level?: number;
};

export type BalanceSheetReport = {
  assets: StatementLine[];
  liabilities: StatementLine[];
  equity: StatementLine[];
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
  previous_total_assets: number;
  previous_total_liabilities: number;
  previous_total_equity: number;
  as_of?: string | null;
  previous_as_of?: string | null;
};

export type ProfitLossReport = {
  revenue: StatementLine[];
  cogs: StatementLine[];
  operating_expenses: StatementLine[];
  total_revenue: number;
  total_cogs: number;
  gross_profit: number;
  total_operating_expenses: number;
  operating_income: number;
  net_profit: number;
  previous_total_revenue: number;
  previous_gross_profit: number;
  previous_operating_income: number;
  previous_net_profit: number;
  from_date?: string | null;
  to_date?: string | null;
};

export type CashFlowSectionLine = {
  label: string;
  amount: number;
};

export type CashFlowReport = {
  operating: CashFlowSectionLine[];
  investing: CashFlowSectionLine[];
  financing: CashFlowSectionLine[];
  net_operating: number;
  net_investing: number;
  net_financing: number;
  net_change: number;
  opening_cash: number;
  closing_cash: number;
  from_date?: string | null;
  to_date?: string | null;
};

export type JournalRegisterLine = {
  id: string;
  journal_number: string;
  journal_date?: string | null;
  journal_type?: string | null;
  reference?: string | null;
  description?: string | null;
  status: string;
  workflow_status?: string | null;
  total_debit: number;
  total_credit: number;
  currency_code?: string | null;
  period_id?: string | null;
  fiscal_year_id?: string | null;
  created_by?: string | null;
};

export type JournalRegisterReport = {
  items: JournalRegisterLine[];
  total: number;
  total_debit: number;
  total_credit: number;
};

export type GlReportLine = {
  id: string;
  entry_number: string;
  entry_date: string;
  account_id: string;
  account_code: string;
  account_name?: string | null;
  journal_number?: string | null;
  journal_header_id?: string | null;
  description?: string | null;
  debit_amount: number;
  credit_amount: number;
  cost_center_id?: string | null;
  currency_code?: string | null;
  journal_status?: string | null;
};

export type GlReport = {
  items: GlReportLine[];
  total: number;
  total_debit: number;
  total_credit: number;
};

export type AgingBucket = {
  bucket: string;
  amount: number;
  count: number;
};

export type ArAgingReportItem = {
  id: string;
  customer_id: string;
  document_number: string;
  document_date?: string;
  due_date?: string | null;
  balance_amount: number;
  aging_bucket?: string | null;
  status?: string;
  customer_code?: string | null;
  customer_name?: string | null;
};

export type ArAgingReport = {
  as_of: string;
  buckets: AgingBucket[];
  items: ArAgingReportItem[];
  total_outstanding: number;
};

export type ApAgingReportItem = {
  id: string;
  vendor_id: string;
  document_number: string;
  document_date?: string;
  due_date?: string | null;
  balance_amount: number;
  aging_bucket?: string | null;
  status?: string;
  vendor_code?: string | null;
  vendor_name?: string | null;
};

export type ApAgingReport = {
  as_of: string;
  buckets: AgingBucket[];
  items: ApAgingReportItem[];
  total_outstanding: number;
};

export type TaxSummaryLine = {
  tax_type: string;
  transaction_type: string;
  taxable_amount: number;
  tax_amount: number;
  count: number;
};

export type TaxSummaryReport = {
  lines: TaxSummaryLine[];
  total_taxable: number;
  total_tax: number;
};

export type CostCenterSummaryLine = {
  cost_center_id?: string | null;
  cost_center_name?: string | null;
  debit_total: number;
  credit_total: number;
  net: number;
  entry_count: number;
};

export type CostCenterSummaryReport = {
  lines: CostCenterSummaryLine[];
  total_debit: number;
  total_credit: number;
};

export type ReportQuery = Record<string, string | number | boolean | null | undefined>;

async function fetchReport<T>(path: string, query?: ReportQuery): Promise<T> {
  const res = await apiClient<T>(`${REPORTS_API}${path}`, { method: "GET", query });
  return res.data as T;
}

export function getReportCatalog() {
  return fetchReport<ReportCatalogItem[]>("/catalog");
}

export function getTrialBalanceReport(query?: ReportQuery) {
  return fetchReport<TrialBalanceReport>("/trial-balance", { full: true, ...query });
}

export function getBalanceSheetReport(query?: ReportQuery) {
  return fetchReport<BalanceSheetReport>("/balance-sheet", query);
}

export function getProfitLossReport(query?: ReportQuery) {
  return fetchReport<ProfitLossReport>("/profit-loss", query);
}

export function getCashFlowReport(query?: ReportQuery) {
  return fetchReport<CashFlowReport>("/cash-flow", query);
}

export function getJournalRegisterReport(query?: ReportQuery) {
  return fetchReport<JournalRegisterReport>("/journal-register", query);
}

export function getGlReport(query?: ReportQuery) {
  return fetchReport<GlReport>("/general-ledger", query);
}

export function getArAgingReport(query?: ReportQuery) {
  return fetchReport<ArAgingReport>("/ar-aging", { full: true, ...query });
}

export function getApAgingReport(query?: ReportQuery) {
  return fetchReport<ApAgingReport>("/ap-aging", { full: true, ...query });
}

export function getTaxSummaryReport(query?: ReportQuery) {
  return fetchReport<TaxSummaryReport>("/tax-summary", query);
}

export function getCostCenterReport(query?: ReportQuery) {
  return fetchReport<CostCenterSummaryReport>("/cost-center", query);
}

export function filtersToQuery(filters: {
  companyId?: string;
  branchId?: string;
  fiscalYearId?: string;
  periodId?: string;
  fromDate?: string;
  toDate?: string;
  asOf?: string;
  currency?: string;
  costCenterId?: string;
  accountId?: string;
  status?: string;
  q?: string;
}): ReportQuery {
  return {
    company_id: filters.companyId || undefined,
    branch_id: filters.branchId || undefined,
    fiscal_year_id: filters.fiscalYearId || undefined,
    period_id: filters.periodId || undefined,
    from_date: filters.fromDate || undefined,
    to_date: filters.toDate || undefined,
    as_of: filters.asOf || undefined,
    currency_code: filters.currency || undefined,
    cost_center_id: filters.costCenterId || undefined,
    account_id: filters.accountId || undefined,
    status: filters.status || undefined,
    q: filters.q || undefined,
  };
}
