import { apiClient, resourceService } from "@/services/api-client";

export const AR_API = "/finance/ar";

export type ArEntry = {
  id: string;
  customer_id: string;
  document_number: string;
  document_date: string;
  due_date: string;
  document_type: string;
  debit_amount: number;
  credit_amount: number;
  balance_amount: number;
  currency_code: string;
  exchange_rate?: number;
  status: string;
  workflow_status?: string | null;
  aging_bucket?: string | null;
  company_id?: string | null;
  branch_id?: string | null;
  journal_header_id?: string | null;
  source_module?: string | null;
  source_document_id?: string | null;
  created_at?: string | null;
  created_by?: string | null;
  updated_at?: string | null;
  updated_by?: string | null;
  version?: number;
  customer_code?: string | null;
  customer_name?: string | null;
  outstanding_amount?: number | null;
  paid_amount?: number | null;
  days_overdue?: number | null;
};

export type ArListResult = {
  items: ArEntry[];
  total: number;
  page: number;
  page_size: number;
  total_outstanding: number;
  total_paid: number;
  total_balance: number;
};

export type ArListParams = {
  page?: number;
  page_size?: number;
  company_id?: string;
  customer_id?: string;
  document_type?: string;
  status?: string;
  workflow_status?: string;
  currency_code?: string;
  q?: string;
  from_date?: string;
  to_date?: string;
  due_from?: string;
  due_to?: string;
  overdue_only?: boolean;
  sort_by?: string;
  sort_dir?: "asc" | "desc";
  paged?: boolean;
};

export type ArAgingBucket = {
  bucket: string;
  amount: number;
  count: number;
};

export type ArSummary = {
  outstanding_receivables: number;
  collected_today: number;
  overdue_invoices: number;
  overdue_amount: number;
  current_month_collections: number;
  customer_count: number;
  collection_efficiency: number;
  aging: ArAgingBucket[];
  open_invoice_count: number;
  receipt_count: number;
};

export type ArAgingReport = {
  as_of: string;
  buckets: ArAgingBucket[];
  items: ArEntry[];
  total_outstanding: number;
};

export type ArCustomerLedgerLine = {
  id: string;
  document_number: string;
  document_date: string;
  due_date?: string | null;
  document_type: string;
  debit_amount: number;
  credit_amount: number;
  balance_amount: number;
  status: string;
  running_balance: number;
  currency_code: string;
};

export type ArCustomerLedger = {
  customer_id: string;
  customer_code?: string | null;
  customer_name?: string | null;
  opening_balance: number;
  closing_balance: number;
  invoice_total: number;
  receipt_total: number;
  adjustment_total: number;
  lines: ArCustomerLedgerLine[];
};

export type ArCreatePayload = {
  branch_id: string;
  customer_id: string;
  document_date: string;
  due_date: string;
  document_type: string;
  debit_amount?: number;
  credit_amount?: number;
  currency_code?: string;
  company_id?: string | null;
  exchange_rate?: number;
};

export type ArUpdatePayload = {
  document_date?: string;
  due_date?: string;
  debit_amount?: number;
  credit_amount?: number;
  currency_code?: string;
  exchange_rate?: number;
};

export type ArReceiptPayload = {
  branch_id: string;
  customer_id: string;
  document_date: string;
  amount: number;
  currency_code?: string;
  company_id?: string | null;
  exchange_rate?: number;
  allocate_to_invoice_id?: string | null;
  notes?: string | null;
};

export type ArAllocationLine = {
  invoice_id: string;
  amount: number;
};

export type ArAllocatePayload = {
  receipt_id: string;
  allocations: ArAllocationLine[];
};

export type ArPaymentPayload = {
  amount: number;
  receipt_id?: string | null;
};

export type ArWorkflowAction = "submit" | "approve" | "cancel" | "reverse";

function asListResult(data: unknown): ArListResult {
  if (Array.isArray(data)) {
    const items = data as ArEntry[];
    return {
      items,
      total: items.length,
      page: 1,
      page_size: items.length,
      total_outstanding: items.reduce((s, e) => s + Number(e.outstanding_amount ?? e.balance_amount ?? 0), 0),
      total_paid: items.reduce((s, e) => s + Number(e.paid_amount ?? 0), 0),
      total_balance: items.reduce((s, e) => s + Number(e.balance_amount ?? 0), 0),
    };
  }
  const obj = (data ?? {}) as ArListResult;
  return {
    items: Array.isArray(obj.items) ? obj.items : [],
    total: Number(obj.total ?? 0),
    page: Number(obj.page ?? 1),
    page_size: Number(obj.page_size ?? 25),
    total_outstanding: Number(obj.total_outstanding ?? 0),
    total_paid: Number(obj.total_paid ?? 0),
    total_balance: Number(obj.total_balance ?? 0),
  };
}

export async function listArEntries(params: ArListParams = {}): Promise<ArListResult> {
  const res = await resourceService.list<ArListResult | ArEntry[]>(AR_API, {
    page: params.page ?? 1,
    page_size: params.page_size ?? 25,
    company_id: params.company_id,
    customer_id: params.customer_id,
    document_type: params.document_type,
    status: params.status,
    workflow_status: params.workflow_status,
    currency_code: params.currency_code,
    q: params.q,
    from_date: params.from_date,
    to_date: params.to_date,
    due_from: params.due_from,
    due_to: params.due_to,
    overdue_only: params.overdue_only ? true : undefined,
    sort_by: params.sort_by ?? "document_date",
    sort_dir: params.sort_dir ?? "desc",
    paged: params.paged === false ? undefined : true,
  });
  return asListResult(res.data);
}

export async function getArEntry(id: string): Promise<ArEntry> {
  const res = await resourceService.get<ArEntry>(AR_API, id);
  if (!res.data) throw new Error("AR entry not found");
  return res.data;
}

export async function getArSummary(companyId?: string): Promise<ArSummary> {
  const res = await apiClient<ArSummary>(`${AR_API}/summary`, {
    method: "GET",
    query: { company_id: companyId },
  });
  return res.data as ArSummary;
}

export async function getArAging(asOf?: string, companyId?: string): Promise<ArAgingReport> {
  const res = await apiClient<ArAgingReport>(`${AR_API}/aging`, {
    method: "GET",
    query: { as_of: asOf, company_id: companyId },
  });
  return res.data as ArAgingReport;
}

export async function getCustomerLedger(
  customerId: string,
  params: { company_id?: string; from_date?: string; to_date?: string } = {},
): Promise<ArCustomerLedger> {
  const res = await apiClient<ArCustomerLedger>(`${AR_API}/customers/${customerId}`, {
    method: "GET",
    query: params,
  });
  return res.data as ArCustomerLedger;
}

export async function listInvoicePayments(invoiceId: string): Promise<ArEntry[]> {
  const res = await apiClient<ArEntry[]>(`${AR_API}/${invoiceId}/payments`, { method: "GET" });
  return Array.isArray(res.data) ? res.data : [];
}

export async function createArEntry(payload: ArCreatePayload): Promise<ArEntry> {
  const res = await resourceService.create<ArEntry>(AR_API, payload);
  if (!res.data) throw new Error("Failed to create AR entry");
  return res.data;
}

export async function updateArEntry(id: string, payload: ArUpdatePayload): Promise<ArEntry> {
  const res = await resourceService.update<ArEntry>(AR_API, id, payload);
  if (!res.data) throw new Error("Failed to update AR entry");
  return res.data;
}

export async function createReceipt(payload: ArReceiptPayload): Promise<ArEntry> {
  const res = await apiClient<ArEntry>(`${AR_API}/receipts`, { method: "POST", body: payload });
  if (!res.data) throw new Error("Failed to create receipt");
  return res.data;
}

export async function allocateReceipt(payload: ArAllocatePayload): Promise<ArEntry> {
  const res = await apiClient<ArEntry>(`${AR_API}/allocate`, { method: "POST", body: payload });
  if (!res.data) throw new Error("Failed to allocate receipt");
  return res.data;
}

export async function recordPayment(invoiceId: string, payload: ArPaymentPayload): Promise<ArEntry> {
  const res = await resourceService.action<ArEntry>(AR_API, invoiceId, "payment", payload);
  if (!res.data) throw new Error("Failed to record payment");
  return res.data;
}

export async function runArAction(id: string, action: ArWorkflowAction): Promise<ArEntry> {
  const res = await resourceService.action<ArEntry>(AR_API, id, action);
  if (!res.data) throw new Error(`Failed to ${action} AR entry`);
  return res.data;
}

export function isArEditable(entry: Pick<ArEntry, "status" | "workflow_status">): boolean {
  const status = (entry.status ?? "").toLowerCase();
  const wf = (entry.workflow_status ?? "").toLowerCase();
  return status === "draft" || wf === "draft";
}

export function isInvoice(entry: Pick<ArEntry, "document_type">): boolean {
  const t = (entry.document_type ?? "").toLowerCase();
  return t === "invoice" || t === "debit_note";
}

export function isReceipt(entry: Pick<ArEntry, "document_type">): boolean {
  const t = (entry.document_type ?? "").toLowerCase();
  return t === "receipt" || t === "payment" || t === "allocation";
}
