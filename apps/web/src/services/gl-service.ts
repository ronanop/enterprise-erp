import { apiClient, resourceService } from "@/services/api-client";

export const GL_API = "/finance/gl";

export type GlEntry = {
  id: string;
  entry_number: string;
  entry_date: string;
  account_id: string;
  account_code: string;
  debit_amount: number;
  credit_amount: number;
  base_debit_amount: number;
  base_credit_amount: number;
  currency_code?: string | null;
  description?: string | null;
  company_id?: string | null;
  branch_id?: string | null;
  period_id?: string | null;
  fiscal_year_id?: string | null;
  journal_header_id?: string | null;
  journal_line_id?: string | null;
  cost_center_id?: string | null;
  profit_center_id?: string | null;
  exchange_rate?: number | null;
  is_reversal?: boolean;
  posted_at?: string | null;
  posted_by?: string | null;
  created_at?: string | null;
  account_name?: string | null;
  journal_number?: string | null;
  journal_status?: string | null;
  journal_type?: string | null;
  workflow_status?: string | null;
  period_name?: string | null;
  fiscal_year_code?: string | null;
  cost_center_name?: string | null;
  project_ref?: string | null;
  running_balance?: number | null;
};

export type GlListResult = {
  items: GlEntry[];
  total: number;
  page: number;
  page_size: number;
  total_debit: number;
  total_credit: number;
};

export type GlListParams = {
  page?: number;
  page_size?: number;
  company_id?: string;
  account_id?: string;
  period_id?: string;
  fiscal_year_id?: string;
  branch_id?: string;
  cost_center_id?: string;
  currency_code?: string;
  status?: string;
  q?: string;
  from_date?: string;
  to_date?: string;
  sort_by?: string;
  sort_dir?: "asc" | "desc";
  paged?: boolean;
  running_balance?: boolean;
};

export type GlSummary = {
  total_accounts: number;
  active_ledger_accounts: number;
  total_debits: number;
  total_credits: number;
  current_balance: number;
  todays_transactions: number;
  current_fiscal_year_code?: string | null;
  current_fiscal_year_id?: string | null;
  current_period_name?: string | null;
  current_period_id?: string | null;
};

export type GlAccountLedgerLine = {
  id?: string | null;
  entry_date: string;
  entry_number: string;
  journal_header_id?: string | null;
  journal_number?: string | null;
  description?: string | null;
  debit_amount: number;
  credit_amount: number;
  running_balance: number;
};

export type GlMonthlySummary = {
  year: number;
  month: number;
  label: string;
  debit_total: number;
  credit_total: number;
  net: number;
};

export type GlAccountLedger = {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  normal_balance: string;
  status: string;
  opening_balance: number;
  debit_total: number;
  credit_total: number;
  closing_balance: number;
  lines: GlAccountLedgerLine[];
  monthly_summary: GlMonthlySummary[];
  related_journal_ids: string[];
};

export type GlTrialBalancePreviewLine = {
  account_id: string;
  account_code: string;
  account_name: string;
  opening: number;
  debit: number;
  credit: number;
  closing: number;
};

export type GlTrialBalancePreview = {
  lines: GlTrialBalancePreviewLine[];
  total_opening: number;
  total_debit: number;
  total_credit: number;
  total_closing: number;
  difference: number;
};

function asListResult(data: unknown): GlListResult {
  if (Array.isArray(data)) {
    const items = data as GlEntry[];
    return {
      items,
      total: items.length,
      page: 1,
      page_size: items.length,
      total_debit: items.reduce((s, e) => s + Number(e.base_debit_amount || 0), 0),
      total_credit: items.reduce((s, e) => s + Number(e.base_credit_amount || 0), 0),
    };
  }
  const obj = (data ?? {}) as GlListResult;
  return {
    items: Array.isArray(obj.items) ? obj.items : [],
    total: Number(obj.total ?? 0),
    page: Number(obj.page ?? 1),
    page_size: Number(obj.page_size ?? 25),
    total_debit: Number(obj.total_debit ?? 0),
    total_credit: Number(obj.total_credit ?? 0),
  };
}

export async function listGlEntries(params: GlListParams = {}): Promise<GlListResult> {
  const res = await resourceService.list<GlListResult | GlEntry[]>(GL_API, {
    page: params.page ?? 1,
    page_size: params.page_size ?? 25,
    company_id: params.company_id,
    account_id: params.account_id,
    period_id: params.period_id,
    fiscal_year_id: params.fiscal_year_id,
    branch_id: params.branch_id,
    cost_center_id: params.cost_center_id,
    currency_code: params.currency_code,
    status: params.status,
    q: params.q,
    from_date: params.from_date,
    to_date: params.to_date,
    sort_by: params.sort_by ?? "entry_date",
    sort_dir: params.sort_dir ?? "asc",
    paged: params.paged === false ? undefined : true,
    running_balance: params.running_balance ? true : undefined,
  });
  return asListResult(res.data);
}

export async function getGlEntry(id: string) {
  const res = await resourceService.get<GlEntry>(GL_API, id);
  return res.data as GlEntry;
}

export async function getGlSummary(companyId?: string) {
  const res = await apiClient<GlSummary>(`${GL_API}/summary`, {
    method: "GET",
    query: { company_id: companyId },
  });
  return res.data as GlSummary;
}

export async function getAccountLedger(
  accountId: string,
  params: {
    company_id?: string;
    period_id?: string;
    fiscal_year_id?: string;
    from_date?: string;
    to_date?: string;
  } = {},
) {
  const res = await apiClient<GlAccountLedger>(`${GL_API}/accounts/${accountId}`, {
    method: "GET",
    query: params,
  });
  return res.data as GlAccountLedger;
}

export async function getTrialBalancePreview(params: {
  company_id?: string;
  period_id?: string;
  fiscal_year_id?: string;
  from_date?: string;
  to_date?: string;
} = {}) {
  const res = await apiClient<GlTrialBalancePreview>(`${GL_API}/trial-balance-preview`, {
    method: "GET",
    query: params,
  });
  return res.data as GlTrialBalancePreview;
}
