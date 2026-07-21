import { apiClient, resourceService } from "@/services/api-client";

export const AP_API = "/finance/ap";

export type ApEntry = {
  id: string;
  vendor_id: string;
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
  vendor_code?: string | null;
  vendor_name?: string | null;
  outstanding_amount?: number | null;
  paid_amount?: number | null;
  days_overdue?: number | null;
};

export type ApListResult = {
  items: ApEntry[];
  total: number;
  page: number;
  page_size: number;
  total_outstanding: number;
  total_paid: number;
  total_balance: number;
};

export type ApListParams = {
  page?: number;
  page_size?: number;
  company_id?: string;
  vendor_id?: string;
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

export type ApAgingBucket = {
  bucket: string;
  amount: number;
  count: number;
};

export type ApVendorAgingSummary = {
  vendor_id: string;
  vendor_code?: string | null;
  vendor_name?: string | null;
  total: number;
  bucket_0_30: number;
  bucket_31_60: number;
  bucket_61_90: number;
  bucket_90_plus: number;
};

export type ApSummary = {
  outstanding_payables: number;
  payments_due_today: number;
  payments_due_today_count: number;
  overdue_bills: number;
  overdue_amount: number;
  current_month_payments: number;
  vendor_count: number;
  payment_efficiency: number;
  cash_requirement: number;
  aging: ApAgingBucket[];
  open_invoice_count: number;
  payment_count: number;
};

export type ApAgingReport = {
  as_of: string;
  buckets: ApAgingBucket[];
  items: ApEntry[];
  vendor_summary: ApVendorAgingSummary[];
  total_outstanding: number;
};

export type ApVendorLedgerLine = {
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

export type ApVendorLedger = {
  vendor_id: string;
  vendor_code?: string | null;
  vendor_name?: string | null;
  opening_balance: number;
  closing_balance: number;
  invoice_total: number;
  payment_total: number;
  adjustment_total: number;
  lines: ApVendorLedgerLine[];
};

export type ApCreatePayload = {
  branch_id: string;
  vendor_id: string;
  document_date: string;
  due_date: string;
  document_type: string;
  debit_amount?: number;
  credit_amount?: number;
  currency_code?: string;
  company_id?: string | null;
  exchange_rate?: number;
};

export type ApUpdatePayload = {
  document_date?: string;
  due_date?: string;
  debit_amount?: number;
  credit_amount?: number;
  currency_code?: string;
  exchange_rate?: number;
};

export type ApPaymentCreatePayload = {
  branch_id: string;
  vendor_id: string;
  document_date: string;
  amount: number;
  currency_code?: string;
  company_id?: string | null;
  exchange_rate?: number;
  allocate_to_invoice_id?: string | null;
  notes?: string | null;
  payment_advice?: string | null;
};

export type ApAllocationLine = {
  invoice_id: string;
  amount: number;
};

export type ApAllocatePayload = {
  payment_id: string;
  allocations: ApAllocationLine[];
};

export type ApPaymentPayload = {
  amount: number;
  payment_id?: string | null;
};

export type ApWorkflowAction = "submit" | "approve" | "cancel" | "reverse";

function asListResult(data: unknown): ApListResult {
  if (Array.isArray(data)) {
    const items = data as ApEntry[];
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
  const obj = (data ?? {}) as ApListResult;
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

export async function listApEntries(params: ApListParams = {}): Promise<ApListResult> {
  const res = await resourceService.list<ApListResult | ApEntry[]>(AP_API, {
    page: params.page ?? 1,
    page_size: params.page_size ?? 25,
    company_id: params.company_id,
    vendor_id: params.vendor_id,
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

export async function getApEntry(id: string): Promise<ApEntry> {
  const res = await resourceService.get<ApEntry>(AP_API, id);
  if (!res.data) throw new Error("AP entry not found");
  return res.data;
}

export async function getApSummary(companyId?: string): Promise<ApSummary> {
  const res = await apiClient<ApSummary>(`${AP_API}/summary`, {
    method: "GET",
    query: { company_id: companyId },
  });
  return res.data as ApSummary;
}

export async function getApAging(asOf?: string, companyId?: string): Promise<ApAgingReport> {
  const res = await apiClient<ApAgingReport>(`${AP_API}/aging`, {
    method: "GET",
    query: { as_of: asOf, company_id: companyId },
  });
  return res.data as ApAgingReport;
}

export async function getVendorLedger(
  vendorId: string,
  params: { company_id?: string; from_date?: string; to_date?: string } = {},
): Promise<ApVendorLedger> {
  const res = await apiClient<ApVendorLedger>(`${AP_API}/vendors/${vendorId}`, {
    method: "GET",
    query: params,
  });
  return res.data as ApVendorLedger;
}

export async function listInvoicePayments(invoiceId: string): Promise<ApEntry[]> {
  const res = await apiClient<ApEntry[]>(`${AP_API}/${invoiceId}/payments`, { method: "GET" });
  return Array.isArray(res.data) ? res.data : [];
}

export async function createApEntry(payload: ApCreatePayload): Promise<ApEntry> {
  const res = await resourceService.create<ApEntry>(AP_API, payload);
  if (!res.data) throw new Error("Failed to create AP entry");
  return res.data;
}

export async function updateApEntry(id: string, payload: ApUpdatePayload): Promise<ApEntry> {
  const res = await resourceService.update<ApEntry>(AP_API, id, payload);
  if (!res.data) throw new Error("Failed to update AP entry");
  return res.data;
}

export async function createPayment(payload: ApPaymentCreatePayload): Promise<ApEntry> {
  const res = await apiClient<ApEntry>(`${AP_API}/payments`, { method: "POST", body: payload });
  if (!res.data) throw new Error("Failed to create payment");
  return res.data;
}

export async function allocatePayment(payload: ApAllocatePayload): Promise<ApEntry> {
  const res = await apiClient<ApEntry>(`${AP_API}/allocate`, { method: "POST", body: payload });
  if (!res.data) throw new Error("Failed to allocate payment");
  return res.data;
}

export async function recordPayment(invoiceId: string, payload: ApPaymentPayload): Promise<ApEntry> {
  const res = await resourceService.action<ApEntry>(AP_API, invoiceId, "payment", payload);
  if (!res.data) throw new Error("Failed to record payment");
  return res.data;
}

export async function runApAction(id: string, action: ApWorkflowAction): Promise<ApEntry> {
  const res = await resourceService.action<ApEntry>(AP_API, id, action);
  if (!res.data) throw new Error(`Failed to ${action} AP entry`);
  return res.data;
}

export function isApEditable(entry: Pick<ApEntry, "status" | "workflow_status">): boolean {
  const status = (entry.status ?? "").toLowerCase();
  const wf = (entry.workflow_status ?? "").toLowerCase();
  return status === "draft" || wf === "draft";
}

export function isInvoice(entry: Pick<ApEntry, "document_type">): boolean {
  const t = (entry.document_type ?? "").toLowerCase();
  return t === "invoice" || t === "credit_note";
}

export function isPayment(entry: Pick<ApEntry, "document_type">): boolean {
  const t = (entry.document_type ?? "").toLowerCase();
  return t === "payment" || t === "allocation";
}
