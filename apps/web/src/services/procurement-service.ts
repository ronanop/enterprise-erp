import { ApiClientError, apiClient, resourceService } from "@/services/api-client";

export type ProcurementRow = Record<string, unknown>;

export type ProcurementOverview = {
  requisitions: ProcurementRow[];
  rfqs: ProcurementRow[];
  vendorQuotations: ProcurementRow[];
  comparisons: ProcurementRow[];
  orders: ProcurementRow[];
  grns: ProcurementRow[];
  invoices: ProcurementRow[];
  returns: ProcurementRow[];
  contracts: ProcurementRow[];
  performance: ProcurementRow[];
  errors: string[];
  statusCodes: number[];
  partial: boolean;
};

function normalizeRows(data: unknown): ProcurementRow[] {
  if (Array.isArray(data)) {
    return data.filter((row): row is ProcurementRow => !!row && typeof row === "object");
  }
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["items", "results", "records", "data", "lines"]) {
      if (Array.isArray(obj[key])) return normalizeRows(obj[key]);
    }
    return [obj];
  }
  return [];
}

async function safeList(
  apiPath: string,
): Promise<{ rows: ProcurementRow[]; error?: string; status?: number }> {
  try {
    const response = await resourceService.list(apiPath);
    return { rows: normalizeRows(response.data) };
  } catch (err) {
    if (err instanceof ApiClientError) {
      return { rows: [], error: err.message, status: err.status };
    }
    return { rows: [], error: `Failed to load ${apiPath}`, status: 500 };
  }
}

export function formatInr(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function asStatus(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : "";
}

export function sumField(rows: ProcurementRow[], field: string): number {
  return rows.reduce((sum, row) => sum + asNumber(row[field]), 0);
}

export function countOpenDocs(rows: ProcurementRow[], closedStatuses: string[]): number {
  const closed = new Set(closedStatuses.map((s) => s.toLowerCase()));
  return rows.filter((row) => {
    const status = asStatus(row.status);
    if (!status) return true;
    return !closed.has(status);
  }).length;
}

export function averageScore(rows: ProcurementRow[]): number {
  if (rows.length === 0) return 0;
  const total = rows.reduce((sum, row) => sum + asNumber(row.overall_score), 0);
  return total / rows.length;
}

export async function loadProcurementOverview(): Promise<ProcurementOverview> {
  const [
    requisitions,
    rfqs,
    vendorQuotations,
    comparisons,
    orders,
    grns,
    invoices,
    returns,
    contracts,
    performance,
  ] = await Promise.all([
    safeList("/procurement/requisitions"),
    safeList("/procurement/rfqs"),
    safeList("/procurement/vendor-quotations"),
    safeList("/procurement/comparisons"),
    safeList("/procurement/orders"),
    safeList("/procurement/grns"),
    safeList("/procurement/invoices"),
    safeList("/procurement/returns"),
    safeList("/procurement/contracts"),
    safeList("/procurement/performance"),
  ]);

  const results = [
    requisitions,
    rfqs,
    vendorQuotations,
    comparisons,
    orders,
    grns,
    invoices,
    returns,
    contracts,
    performance,
  ];
  const errors = results.map((r) => r.error).filter((e): e is string => Boolean(e));
  const statusCodes = results
    .map((r) => r.status)
    .filter((s): s is number => typeof s === "number");

  return {
    requisitions: requisitions.rows,
    rfqs: rfqs.rows,
    vendorQuotations: vendorQuotations.rows,
    comparisons: comparisons.rows,
    orders: orders.rows,
    grns: grns.rows,
    invoices: invoices.rows,
    returns: returns.rows,
    contracts: contracts.rows,
    performance: performance.rows,
    errors,
    statusCodes,
    partial: errors.length > 0,
  };
}

export { normalizeRows };

/* -------------------------------------------------------------------------- */
/* SCM workflow (CRM OVF → vendor PO → GRN)                                   */
/* -------------------------------------------------------------------------- */

const SCM_API = "/procurement/scm";

export type ScmQueueItem = {
  ovf_id: string;
  ovf_no: string;
  customer_name: string | null;
  quote_name: string | null;
  account_name: string | null;
  po_number: string | null;
  owner_name: string | null;
  blueprint_state: string;
  company_id: string;
  branch_id: string;
  vendor_line_count: number;
  vendor_total: number;
  purchase_order_id: string | null;
  purchase_order_number: string | null;
  purchase_order_status: string | null;
  can_create_po: boolean;
};

export type ScmVendorLine = {
  line_id: string;
  line_no: number;
  product_name: string;
  qty: number;
  unit_price: number;
  line_total: number;
};

export type ScmOvfPreview = {
  ovf_id: string;
  ovf_no: string;
  company_id: string;
  branch_id: string;
  quote_id: string;
  opportunity_id: string;
  po_number: string | null;
  customer_name: string | null;
  quote_name: string | null;
  account_name: string | null;
  owner_name: string | null;
  blueprint_state: string;
  freight: number;
  additional_charges: number;
  vendor_payment_days: number;
  total_margin_amount: number;
  vendor_lines: ScmVendorLine[];
  purchase_order_id: string | null;
  purchase_order_number: string | null;
  can_create_po: boolean;
};

export type ScmVendorPoLine = {
  id: string;
  line_number: number;
  product_name: string | null;
  quantity: number;
  quantity_received: number;
  unit_cost: number;
  line_total: number;
  status: string;
  grn_status: string;
};

export type ScmVendorPo = {
  id: string;
  document_number: string;
  document_date: string;
  vendor_id: string;
  status: string;
  currency_code: string;
  total_amount: number;
  source_module: string | null;
  source_document_type: string | null;
  source_document_id: string | null;
  grn_status: string;
  line_count: number;
  lines: ScmVendorPoLine[];
};

export type ProcOrder = {
  id: string;
  document_number: string;
  document_date: string;
  vendor_id: string;
  status: string;
  currency_code: string;
  payment_terms: string | null;
  total_amount: number;
  received_amount: number;
  source_module: string | null;
  source_document_id: string | null;
  version: number;
  lines: Array<{
    id: string;
    line_number: number;
    product_id: string;
    product_code: string | null;
    product_name: string | null;
    quantity: number;
    quantity_received: number;
    unit_cost: number;
    line_total: number;
    status: string;
  }>;
};

function unwrapData<T>(payload: { data?: T | null }): T {
  if (payload.data === undefined || payload.data === null) {
    throw new ApiClientError("Empty API response", 500);
  }
  return payload.data;
}

export async function listScmQueue(): Promise<ScmQueueItem[]> {
  const res = await apiClient<ScmQueueItem[]>(`${SCM_API}/queue`);
  return unwrapData(res);
}

export async function getScmOvfPreview(ovfId: string): Promise<ScmOvfPreview> {
  const res = await apiClient<ScmOvfPreview>(`${SCM_API}/ovf/${ovfId}`);
  return unwrapData(res);
}

export async function createPoFromOvf(
  ovfId: string,
  body: {
    vendor_id: string;
    document_date?: string;
    currency_code?: string;
    payment_terms?: string | null;
    expected_delivery_date?: string | null;
    finalize?: boolean;
  },
): Promise<ProcOrder> {
  const res = await apiClient<ProcOrder>(`${SCM_API}/ovf/${ovfId}/purchase-orders`, {
    method: "POST",
    body,
  });
  return unwrapData(res);
}

export async function finalizeScmOrder(orderId: string): Promise<ProcOrder> {
  const res = await apiClient<ProcOrder>(`${SCM_API}/orders/${orderId}/finalize`, {
    method: "POST",
    body: {},
  });
  return unwrapData(res);
}

export async function listVendorPos(): Promise<ScmVendorPo[]> {
  const res = await apiClient<ScmVendorPo[]>(`${SCM_API}/vendor-pos`);
  return unwrapData(res);
}

export async function getPurchaseOrder(orderId: string): Promise<ProcOrder> {
  const res = await resourceService.get<ProcOrder>("/procurement/orders", orderId);
  return unwrapData(res);
}

export async function updateLineReceipt(
  orderId: string,
  lineId: string,
  body: { quantity_received: number; grn_status?: string | null },
): Promise<ProcOrder> {
  const res = await apiClient<ProcOrder>(
    `${SCM_API}/orders/${orderId}/lines/${lineId}/receipt`,
    { method: "PATCH", body },
  );
  return unwrapData(res);
}

export type VendorOption = { id: string; label: string };

export async function listVendorOptions(): Promise<VendorOption[]> {
  const res = await resourceService.list<Record<string, unknown>>("/vendors");
  const rows = normalizeRows(res.data);
  return rows.map((row) => {
    const id = String(row.id ?? "");
    const name =
      String(row.vendor_name ?? row.name ?? row.display_name ?? row.code ?? id).trim() || id;
    return { id, label: name };
  }).filter((v) => v.id);
}
