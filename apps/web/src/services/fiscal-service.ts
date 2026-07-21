import { apiClient, resourceService } from "@/services/api-client";

export const FISCAL_YEARS_API = "/finance/fiscal-years";
export const PERIODS_API = "/finance/periods";

export type FiscalYear = {
  id: string;
  company_id: string;
  fiscal_year_code: string;
  fiscal_year_name: string;
  start_date: string;
  end_date: string;
  status: string;
  description?: string | null;
  is_default?: boolean;
  closed_at?: string | null;
  closed_by?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_by?: string | null;
  updated_at?: string | null;
  version?: number | null;
  period_count?: number | null;
  closed_period_count?: number | null;
  locked_period_count?: number | null;
  journal_count?: number | null;
};

export type AccountingPeriod = {
  id: string;
  company_id: string;
  fiscal_year_id: string;
  period_number: number;
  period_name: string;
  start_date: string;
  end_date: string;
  status: string;
  ar_closed: boolean;
  ap_closed: boolean;
  inventory_closed?: boolean;
  payroll_closed?: boolean;
  gl_closed: boolean;
  closed_at?: string | null;
  closed_by?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_by?: string | null;
  updated_at?: string | null;
  version?: number | null;
  fiscal_year_code?: string | null;
  fiscal_year_name?: string | null;
  journal_count?: number | null;
  journal_posting_allowed?: boolean | null;
  quarter?: number | null;
};

export type FiscalListResult = {
  items: FiscalYear[];
  total: number;
  page: number;
  page_size: number;
};

export type PeriodListResult = {
  items: AccountingPeriod[];
  total: number;
  page: number;
  page_size: number;
};

export type FiscalSummary = {
  active_fiscal_year: FiscalYear | null;
  total_fiscal_years: number;
  open_periods: number;
  closed_periods: number;
  locked_periods: number;
  current_period: AccountingPeriod | null;
  recently_closed_periods: AccountingPeriod[];
  year_close_progress_pct: number;
};

export type FiscalClosePreview = {
  fiscal_year_id: string;
  fiscal_year_code: string;
  open_journals: number;
  unclosed_periods: number;
  warnings: string[];
  can_close: boolean;
};

export type BulkPeriodResult = {
  succeeded: number;
  failed: number;
  errors: string[];
};

export type FiscalCreatePayload = {
  fiscal_year_code: string;
  fiscal_year_name: string;
  start_date: string;
  end_date: string;
  description?: string | null;
  is_default?: boolean;
};

export type FiscalUpdatePayload = Partial<FiscalCreatePayload> & {
  status?: string;
  version?: number | null;
};

export type PeriodBulkAction =
  | "open"
  | "close"
  | "lock"
  | "unlock"
  | "reopen"
  | "soft_close"
  | "hard_close";

export type FiscalWorkflowAction = "submit" | "approve" | "reject";

function asFiscalList(data: unknown): FiscalListResult {
  if (Array.isArray(data)) {
    return { items: data as FiscalYear[], total: data.length, page: 1, page_size: data.length };
  }
  const obj = (data ?? {}) as FiscalListResult;
  return {
    items: Array.isArray(obj.items) ? obj.items : [],
    total: Number(obj.total ?? 0),
    page: Number(obj.page ?? 1),
    page_size: Number(obj.page_size ?? 25),
  };
}

function asPeriodList(data: unknown): PeriodListResult {
  if (Array.isArray(data)) {
    return { items: data as AccountingPeriod[], total: data.length, page: 1, page_size: data.length };
  }
  const obj = (data ?? {}) as PeriodListResult;
  return {
    items: Array.isArray(obj.items) ? obj.items : [],
    total: Number(obj.total ?? 0),
    page: Number(obj.page ?? 1),
    page_size: Number(obj.page_size ?? 25),
  };
}

export async function listFiscalYears(params: {
  page?: number;
  page_size?: number;
  status?: string;
  q?: string;
  sort_by?: string;
  sort_dir?: "asc" | "desc";
  paged?: boolean;
} = {}) {
  const res = await resourceService.list<FiscalListResult | FiscalYear[]>(FISCAL_YEARS_API, {
    page: params.page ?? 1,
    page_size: params.page_size ?? 25,
    status: params.status,
    q: params.q,
    sort_by: params.sort_by ?? "start_date",
    sort_dir: params.sort_dir ?? "desc",
    paged: params.paged === false ? undefined : true,
  });
  return asFiscalList(res.data);
}

export async function listPeriods(params: {
  page?: number;
  page_size?: number;
  fiscal_year_id?: string;
  status?: string;
  q?: string;
  sort_by?: string;
  sort_dir?: "asc" | "desc";
  paged?: boolean;
} = {}) {
  const res = await resourceService.list<PeriodListResult | AccountingPeriod[]>(PERIODS_API, {
    page: params.page ?? 1,
    page_size: params.page_size ?? 50,
    fiscal_year_id: params.fiscal_year_id,
    status: params.status,
    q: params.q,
    sort_by: params.sort_by ?? "period_number",
    sort_dir: params.sort_dir ?? "asc",
    paged: params.paged === false ? undefined : true,
  });
  return asPeriodList(res.data);
}

export async function getFiscalSummary() {
  const res = await apiClient<FiscalSummary>(`${FISCAL_YEARS_API}/summary`, { method: "GET" });
  return res.data as FiscalSummary;
}

export async function getFiscalYear(id: string) {
  const res = await resourceService.get<FiscalYear>(FISCAL_YEARS_API, id);
  return res.data as FiscalYear;
}

export async function createFiscalYear(payload: FiscalCreatePayload) {
  const res = await resourceService.create<FiscalYear>(FISCAL_YEARS_API, payload);
  return res.data as FiscalYear;
}

export async function updateFiscalYear(id: string, payload: FiscalUpdatePayload) {
  const res = await resourceService.update<FiscalYear>(FISCAL_YEARS_API, id, payload);
  return res.data as FiscalYear;
}

export async function deleteFiscalYear(id: string) {
  await resourceService.delete(FISCAL_YEARS_API, id);
}

export async function getFiscalClosePreview(id: string) {
  const res = await apiClient<FiscalClosePreview>(`${FISCAL_YEARS_API}/${id}/close-preview`, {
    method: "GET",
  });
  return res.data as FiscalClosePreview;
}

export async function closeFiscalYear(id: string) {
  const res = await resourceService.action<FiscalYear>(FISCAL_YEARS_API, id, "close");
  return res.data as FiscalYear;
}

export async function archiveFiscalYear(id: string) {
  const res = await resourceService.action<FiscalYear>(FISCAL_YEARS_API, id, "archive");
  return res.data as FiscalYear;
}

export async function activateFiscalYear(id: string, comments?: string) {
  const res = await resourceService.action<FiscalYear>(FISCAL_YEARS_API, id, "activate", {
    comments: comments ?? null,
  });
  return res.data as FiscalYear;
}

export async function deactivateFiscalYear(id: string, comments?: string) {
  const res = await resourceService.action<FiscalYear>(FISCAL_YEARS_API, id, "deactivate", {
    comments: comments ?? null,
  });
  return res.data as FiscalYear;
}

export async function runFiscalWorkflow(id: string, action: FiscalWorkflowAction, comments?: string) {
  const res = await resourceService.action<FiscalYear>(FISCAL_YEARS_API, id, action, {
    comments: comments ?? null,
  });
  return res.data as FiscalYear;
}

export async function getPeriod(id: string) {
  const res = await resourceService.get<AccountingPeriod>(PERIODS_API, id);
  return res.data as AccountingPeriod;
}

export async function runPeriodAction(
  id: string,
  action: "open" | "close" | "lock" | "unlock" | "reopen" | "soft-close" | "hard-close",
) {
  const res = await resourceService.action<AccountingPeriod>(PERIODS_API, id, action);
  return res.data as AccountingPeriod;
}

export async function bulkPeriodAction(
  periodIds: string[],
  action: PeriodBulkAction,
  comments?: string,
) {
  const res = await apiClient<BulkPeriodResult>(`${PERIODS_API}/bulk`, {
    method: "POST",
    body: { period_ids: periodIds, action, comments: comments ?? null },
  });
  return res.data as BulkPeriodResult;
}

export async function importFiscalYears(
  rows: FiscalCreatePayload[],
  companyId?: string,
) {
  const res = await apiClient<{ created: number; failed: number; errors: string[] }>(
    `${FISCAL_YEARS_API}/import`,
    { method: "POST", body: { rows }, query: { company_id: companyId } },
  );
  return res.data!;
}

export function isFiscalEditable(status?: string | null) {
  const s = (status ?? "").toLowerCase();
  return s === "open";
}

export function periodStatusLabel(status?: string | null) {
  const s = (status ?? "").toLowerCase();
  if (s === "soft_closed") return "Closed";
  if (s === "hard_closed") return "Locked";
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "—";
}
