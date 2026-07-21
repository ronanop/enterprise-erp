import { apiClient, resourceService } from "@/services/api-client";

export const COA_API = "/finance/chart-of-accounts";
export const ACCOUNT_GROUPS_API = "/finance/account-groups";

export type ChartOfAccount = {
  id: string;
  company_id: string;
  account_group_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  normal_balance: string;
  parent_account_id?: string | null;
  is_posting_account: boolean;
  is_cost_center_enabled?: boolean;
  is_profit_center_enabled?: boolean;
  is_tax_applicable?: boolean;
  currency_code?: string | null;
  description?: string | null;
  status: string;
  version: number;
  created_by?: string | null;
  created_at?: string | null;
  updated_by?: string | null;
  updated_at?: string | null;
  parent_account_code?: string | null;
  parent_account_name?: string | null;
  account_group_code?: string | null;
  account_group_name?: string | null;
  balance?: number | null;
  child_count?: number | null;
};

export type AccountGroup = {
  id: string;
  company_id: string;
  group_code: string;
  group_name: string;
  account_type: string;
  parent_group_id?: string | null;
  display_order?: number;
  status: string;
};

export type CoaListResult = {
  items: ChartOfAccount[];
  total: number;
  page: number;
  page_size: number;
};

export type CoaListParams = {
  page?: number;
  page_size?: number;
  company_id?: string;
  status?: string;
  account_type?: string;
  account_group_id?: string;
  parent_account_id?: string;
  is_posting_account?: boolean;
  q?: string;
  sort_by?: string;
  sort_dir?: "asc" | "desc";
  tree?: boolean;
  paged?: boolean;
};

export type CoaSummary = {
  total_accounts: number;
  active_accounts: number;
  inactive_accounts: number;
  draft_accounts: number;
  assets: number;
  liabilities: number;
  equity: number;
  income: number;
  expense: number;
  recently_created: ChartOfAccount[];
};

export type CoaBalance = {
  account_id: string;
  account_code: string;
  debit_total: number;
  credit_total: number;
  balance: number;
};

export type CoaRelatedJournal = {
  id: string;
  journal_number: string;
  journal_date: string;
  description: string;
  status: string;
  total_debit: number;
  total_credit: number;
};

export type CoaCreatePayload = {
  account_group_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  normal_balance: string;
  parent_account_id?: string | null;
  is_posting_account?: boolean;
  is_cost_center_enabled?: boolean;
  is_profit_center_enabled?: boolean;
  is_tax_applicable?: boolean;
  currency_code?: string | null;
  description?: string | null;
  status?: string;
};

export type CoaUpdatePayload = Partial<CoaCreatePayload> & {
  version?: number | null;
};

export type CoaWorkflowAction =
  | "submit"
  | "approve"
  | "reject"
  | "activate"
  | "deactivate";

export type CoaImportRow = {
  account_group_id?: string | null;
  account_group_code?: string | null;
  account_code: string;
  account_name: string;
  account_type: string;
  normal_balance: string;
  parent_account_code?: string | null;
  is_posting_account?: boolean;
  is_cost_center_enabled?: boolean;
  currency_code?: string | null;
  description?: string | null;
  status?: string;
};

export type CoaImportResult = {
  created: number;
  failed: number;
  errors: string[];
};

function asListResult(data: unknown): CoaListResult {
  if (Array.isArray(data)) {
    return { items: data as ChartOfAccount[], total: data.length, page: 1, page_size: data.length };
  }
  const obj = (data ?? {}) as CoaListResult;
  return {
    items: Array.isArray(obj.items) ? obj.items : [],
    total: Number(obj.total ?? 0),
    page: Number(obj.page ?? 1),
    page_size: Number(obj.page_size ?? 25),
  };
}

export async function listAccounts(params: CoaListParams = {}): Promise<CoaListResult> {
  const res = await resourceService.list<CoaListResult | ChartOfAccount[]>(COA_API, {
    page: params.page ?? 1,
    page_size: params.page_size ?? 25,
    company_id: params.company_id,
    status: params.status,
    account_type: params.account_type,
    account_group_id: params.account_group_id,
    parent_account_id: params.parent_account_id,
    is_posting_account: params.is_posting_account,
    q: params.q,
    sort_by: params.sort_by ?? "account_code",
    sort_dir: params.sort_dir ?? "asc",
    tree: params.tree ? true : undefined,
    paged: params.paged === false ? undefined : true,
  });
  return asListResult(res.data);
}

export async function listAccountTree(params: Omit<CoaListParams, "tree" | "paged"> = {}) {
  // Backend overrides page_size to 500 when tree=true; keep request within API max.
  return listAccounts({ ...params, tree: true, paged: true, page_size: 500, page: 1 });
}

export async function getAccount(id: string) {
  const res = await resourceService.get<ChartOfAccount>(COA_API, id);
  return res.data as ChartOfAccount;
}

export async function createAccount(payload: CoaCreatePayload) {
  const res = await resourceService.create<ChartOfAccount>(COA_API, payload);
  return res.data as ChartOfAccount;
}

export async function updateAccount(id: string, payload: CoaUpdatePayload) {
  const res = await resourceService.update<ChartOfAccount>(COA_API, id, payload);
  return res.data as ChartOfAccount;
}

export async function deleteAccount(id: string) {
  await resourceService.delete(COA_API, id);
}

export async function getCoaSummary(companyId?: string) {
  const res = await apiClient<CoaSummary>(`${COA_API}/summary`, {
    method: "GET",
    query: { company_id: companyId },
  });
  return res.data as CoaSummary;
}

export async function getAccountBalance(id: string) {
  const res = await apiClient<CoaBalance>(`${COA_API}/${id}/balance`, { method: "GET" });
  return res.data as CoaBalance;
}

export async function listChildAccounts(id: string) {
  const res = await apiClient<ChartOfAccount[]>(`${COA_API}/${id}/children`, { method: "GET" });
  return (res.data ?? []) as ChartOfAccount[];
}

export async function listRelatedJournals(id: string) {
  const res = await apiClient<CoaRelatedJournal[]>(`${COA_API}/${id}/journals`, { method: "GET" });
  return (res.data ?? []) as CoaRelatedJournal[];
}

export async function listAccountGroups() {
  const res = await resourceService.list<AccountGroup[]>(ACCOUNT_GROUPS_API);
  const data = res.data;
  return (Array.isArray(data) ? data : []) as AccountGroup[];
}

export async function runCoaAction(
  id: string,
  action: CoaWorkflowAction,
  comments?: string,
) {
  const res = await resourceService.action<ChartOfAccount>(COA_API, id, action, {
    comments: comments ?? null,
  });
  return res.data as ChartOfAccount;
}

export async function importAccounts(rows: CoaImportRow[], companyId?: string) {
  const res = await apiClient<CoaImportResult>(`${COA_API}/import`, {
    method: "POST",
    body: { rows },
    query: { company_id: companyId },
  });
  return res.data as CoaImportResult;
}

export async function mergeAccounts(
  sourceAccountId: string,
  targetAccountId: string,
  comments?: string,
) {
  return apiClient(`${COA_API}/merge`, {
    method: "POST",
    body: {
      source_account_id: sourceAccountId,
      target_account_id: targetAccountId,
      comments: comments ?? null,
    },
  });
}

export function isCoaEditable(status?: string | null) {
  const s = (status ?? "").toLowerCase();
  return s === "draft" || s === "inactive";
}

export function accountTypeLabel(type?: string | null) {
  const t = (type ?? "").toLowerCase();
  if (t === "revenue") return "Income";
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "—";
}
