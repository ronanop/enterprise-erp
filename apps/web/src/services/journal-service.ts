import { ApiClientError, apiClient, resourceService } from "@/services/api-client";

export const JOURNALS_API = "/finance/journals";

export type JournalLine = {
  id?: string;
  line_number: number;
  account_id: string;
  description?: string | null;
  debit_amount: number;
  credit_amount: number;
  base_debit_amount?: number;
  base_credit_amount?: number;
  currency_code?: string | null;
  cost_center_id?: string | null;
  profit_center_id?: string | null;
  tax_id?: string | null;
  customer_id?: string | null;
  vendor_id?: string | null;
  reference_number?: string | null;
};

export type Journal = {
  id: string;
  company_id: string;
  branch_id: string;
  journal_number: string;
  journal_date: string;
  journal_type: string;
  description: string;
  fiscal_year_id?: string | null;
  period_id?: string | null;
  currency_code?: string | null;
  exchange_rate?: number | null;
  total_debit: number;
  total_credit: number;
  status: string;
  workflow_status: string;
  workflow_instance_id?: string | null;
  posted_at?: string | null;
  posted_by?: string | null;
  reversal_of_id?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_by?: string | null;
  updated_at?: string | null;
  version?: number | null;
  lines?: JournalLine[];
};

export type JournalListResult = {
  items: Journal[];
  total: number;
  page: number;
  page_size: number;
};

export type JournalListParams = {
  page?: number;
  page_size?: number;
  company_id?: string;
  status?: string;
  journal_type?: string;
  period_id?: string;
  q?: string;
  sort_by?: string;
  sort_dir?: "asc" | "desc";
};

export type JournalCreatePayload = {
  branch_id: string;
  journal_date: string;
  description: string;
  journal_type?: string;
  currency_code?: string;
  exchange_rate?: number;
  period_id?: string | null;
  company_id?: string | null;
};

export type JournalUpdatePayload = {
  journal_date?: string;
  description?: string;
  journal_type?: string;
  currency_code?: string;
  exchange_rate?: number;
  period_id?: string | null;
  branch_id?: string;
  version?: number | null;
};

export type JournalLineCreatePayload = {
  line_number: number;
  account_id: string;
  debit_amount?: number;
  credit_amount?: number;
  description?: string | null;
  cost_center_id?: string | null;
  tax_id?: string | null;
  customer_id?: string | null;
  vendor_id?: string | null;
};

export type JournalLineUpdatePayload = Partial<JournalLineCreatePayload> & {
  reference_number?: string | null;
};

function asJournalList(data: unknown): JournalListResult {
  if (data && typeof data === "object" && Array.isArray((data as JournalListResult).items)) {
    const d = data as JournalListResult;
    return {
      items: d.items,
      total: d.total ?? d.items.length,
      page: d.page ?? 1,
      page_size: d.page_size ?? d.items.length,
    };
  }
  if (Array.isArray(data)) {
    return {
      items: data as Journal[],
      total: data.length,
      page: 1,
      page_size: data.length,
    };
  }
  return { items: [], total: 0, page: 1, page_size: 25 };
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (i === attempts - 1) break;
      await new Promise((r) => setTimeout(r, 350 * (i + 1)));
    }
  }
  throw last;
}

export async function listJournals(
  params: JournalListParams = {},
): Promise<JournalListResult> {
  return withRetry(async () => {
    const res = await resourceService.list<JournalListResult | Journal[]>(JOURNALS_API, {
      page: params.page ?? 1,
      page_size: params.page_size ?? 25,
      company_id: params.company_id,
      status: params.status,
      journal_type: params.journal_type,
      period_id: params.period_id,
      q: params.q,
      sort_by: params.sort_by ?? "journal_date",
      sort_dir: params.sort_dir ?? "desc",
    });
    return asJournalList(res.data);
  });
}

export async function getJournal(id: string): Promise<Journal> {
  return withRetry(async () => {
    const res = await resourceService.get<Journal>(JOURNALS_API, id);
    if (!res.data) throw new ApiClientError("Journal not found", 404);
    return res.data;
  });
}

export async function createJournal(payload: JournalCreatePayload): Promise<Journal> {
  const res = await resourceService.create<Journal>(JOURNALS_API, payload);
  if (!res.data) throw new ApiClientError("Failed to create journal", 500);
  return res.data;
}

export async function updateJournal(
  id: string,
  payload: JournalUpdatePayload,
): Promise<Journal> {
  const res = await resourceService.update<Journal>(JOURNALS_API, id, payload);
  if (!res.data) throw new ApiClientError("Failed to update journal", 500);
  return res.data;
}

export async function addJournalLine(
  journalId: string,
  payload: JournalLineCreatePayload,
): Promise<JournalLine> {
  const res = await resourceService.action<JournalLine>(
    JOURNALS_API,
    journalId,
    "lines",
    payload,
  );
  if (!res.data) throw new ApiClientError("Failed to add journal line", 500);
  return res.data;
}

export async function updateJournalLine(
  journalId: string,
  lineId: string,
  payload: JournalLineUpdatePayload,
): Promise<JournalLine> {
  const res = await apiClient<JournalLine>(
    `${JOURNALS_API}/${journalId}/lines/${lineId}`,
    { method: "PATCH", body: payload },
  );
  if (!res.data) throw new ApiClientError("Failed to update journal line", 500);
  return res.data;
}

export async function deleteJournalLine(
  journalId: string,
  lineId: string,
): Promise<void> {
  await apiClient(`${JOURNALS_API}/${journalId}/lines/${lineId}`, {
    method: "DELETE",
  });
}

export async function reorderJournalLines(
  journalId: string,
  lineIds: string[],
): Promise<Journal> {
  const res = await apiClient<Journal>(`${JOURNALS_API}/${journalId}/lines/reorder`, {
    method: "POST",
    body: { line_ids: lineIds },
  });
  if (!res.data) throw new ApiClientError("Failed to reorder lines", 500);
  return res.data;
}

export async function addJournalComment(
  journalId: string,
  comment: string,
): Promise<Record<string, unknown>> {
  const res = await resourceService.action<Record<string, unknown>>(
    JOURNALS_API,
    journalId,
    "comments",
    { comment },
  );
  return res.data ?? {};
}

export type JournalWorkflowAction =
  | "submit"
  | "approve"
  | "reject"
  | "post"
  | "reverse";

export async function runJournalAction(
  journalId: string,
  action: JournalWorkflowAction,
  comments?: string,
): Promise<unknown> {
  const body =
    action === "post" || action === "reverse"
      ? undefined
      : { comments: comments ?? null };
  const res = await resourceService.action(JOURNALS_API, journalId, action, body);
  return res.data;
}

export function journalDifference(journal: Pick<Journal, "total_debit" | "total_credit">): number {
  return Number((journal.total_debit - journal.total_credit).toFixed(4));
}

export function isJournalBalanced(
  journal: Pick<Journal, "total_debit" | "total_credit">,
): boolean {
  return Math.abs(journalDifference(journal)) < 0.0001;
}

export function isJournalEditable(status?: string | null): boolean {
  return (status ?? "").toLowerCase() === "draft";
}
