import { ApiClientError, apiClient, resourceService } from "@/services/api-client";
import { getAccessToken } from "@/lib/auth";
import { cachedFetch, invalidateClientCache, peekCachedValue } from "@/lib/client-cache";
import { env } from "@/utils/env";

/** Short TTL so tab switches reuse in-flight / recent list responses. */
const PROCUREMENT_LIST_TTL_MS = 45_000;

export const PROCUREMENT_INVENTORY_CACHE_KEY = "erp.procurement.inventory";
export const PROCUREMENT_OVERVIEW_CACHE_KEY = "erp.procurement.overview";
export const PROCUREMENT_SCM_QUEUE_CACHE_KEY = "erp.procurement.scm-queue";
export const PROCUREMENT_ORDERS_CACHE_KEY = "erp.procurement.orders";
export const PROCUREMENT_VENDOR_POS_CACHE_KEY = "erp.procurement.vendor-pos";
export const PROCUREMENT_VENDOR_OPTIONS_CACHE_KEY = "erp.procurement.vendor-options";

export function peekProcurementInventoryFromCache(): ProcurementInventoryRow[] | null {
  return peekCachedValue<ProcurementInventoryRow[]>(PROCUREMENT_INVENTORY_CACHE_KEY);
}

export function invalidateProcurementListCache(): void {
  invalidateClientCache("erp.procurement.");
}

/** Warm list APIs before navigation (hover / focus on workspace tabs). Failures are ignored. */
function prefetchQuiet(promise: Promise<unknown>): void {
  void promise.catch(() => {
    /* Prefetch only; pages show errors when they await the same cached key. */
  });
}

export function prefetchProcurementTab(href: string): void {
  const path = (href.split("?")[0] ?? href).replace(/\/$/, "") || "/";
  if (path === "/procurement") {
    prefetchQuiet(loadProcurementOverview());
    prefetchQuiet(listProcurementInventory());
    return;
  }
  if (path === "/procurement/scm" || path.startsWith("/procurement/scm/")) {
    prefetchQuiet(listScmQueue());
    prefetchQuiet(listVendorOptions());
    return;
  }
  if (path === "/procurement/orders" || path.startsWith("/procurement/orders/")) {
    prefetchQuiet(listPurchaseOrders());
    prefetchQuiet(listVendorOptions());
    return;
  }
  if (path === "/procurement/grns") {
    prefetchQuiet(listVendorPos());
    prefetchQuiet(listVendorOptions());
    return;
  }
  if (path === "/procurement/delivery-challan" || path.startsWith("/procurement/delivery-challan/")) {
    prefetchQuiet(listVendorPos());
    prefetchQuiet(listPurchaseOrders());
    prefetchQuiet(listVendorOptions());
    return;
  }
  if (path === "/procurement/delivery-status" || path.startsWith("/procurement/delivery-status/")) {
    prefetchQuiet(listPurchaseOrders());
    prefetchQuiet(listVendorOptions());
    return;
  }
  if (path === "/procurement/vendors") {
    prefetchQuiet(listVendorOptions());
    prefetchQuiet(listPurchaseOrders());
    return;
  }
  if (path === "/procurement/inventory") {
    prefetchQuiet(listProcurementInventory());
    prefetchQuiet(listVendorOptions());
    prefetchQuiet(listPurchaseOrders());
  }
}

export type ProcurementRow = Record<string, unknown>;

export type ProcurementOverview = {
  scmQueue: ProcurementRow[];
  orders: ProcurementRow[];
  grns: ProcurementRow[];
  invoices: ProcurementRow[];
  vendorPos: ProcurementRow[];
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

export function peekProcurementOverviewFromCache(): ProcurementOverview | null {
  return peekCachedValue<ProcurementOverview>(PROCUREMENT_OVERVIEW_CACHE_KEY);
}

export async function loadProcurementOverview(): Promise<ProcurementOverview> {
  return cachedFetch(PROCUREMENT_OVERVIEW_CACHE_KEY, PROCUREMENT_LIST_TTL_MS, async () => {
    const [scmQueue, orders, grns, invoices, vendorPos] = await Promise.all([
      safeList("/procurement/scm/queue"),
      safeList("/procurement/orders"),
      safeList("/procurement/grns"),
      safeList("/procurement/invoices"),
      safeList("/procurement/scm/vendor-pos"),
    ]);

    const results = [scmQueue, orders, grns, invoices, vendorPos];
    const errors = results.map((r) => r.error).filter((e): e is string => Boolean(e));
    const statusCodes = results
      .map((r) => r.status)
      .filter((s): s is number => typeof s === "number");

    return {
      scmQueue: scmQueue.rows,
      orders: orders.rows,
      grns: grns.rows,
      invoices: invoices.rows,
      vendorPos: vendorPos.rows,
      errors,
      statusCodes,
      partial: errors.length > 0,
    };
  });
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
  company_po_number: string | null;
  owner_name: string | null;
  blueprint_state: string;
  company_id: string;
  branch_id: string;
  vendor_line_count: number;
  vendor_qty: number;
  vendor_total: number;
  customer_total?: number;
  customer_total_with_tax?: number;
  margin_amount?: number;
  vendor_payment_days?: number;
  customer_payment_days?: number;
  vendor_name: string | null;
  oem_name: string | null;
  /** When the OVF/PO arrived in the SCM queue (shared to SCM). */
  received_at?: string | null;
  delivery_period?: string | null;
  expected_delivery_date?: string | null;
  purchase_order_id: string | null;
  purchase_order_number: string | null;
  purchase_order_status: string | null;
  scm_on_hold?: boolean;
  scm_on_hold_at?: string | null;
  can_create_po: boolean;
};

export type ScmVendorLine = {
  line_id: string;
  line_no: number;
  product_name: string;
  description?: string | null;
  qty: number;
  unit_price: number;
  line_total: number;
  gst_pct?: number;
  gst_amount?: number;
  total_with_gst?: number;
};

export type ScmMarginLine = {
  line_no: number;
  product_name: string;
  description?: string | null;
  qty: number;
  margin_amount: number;
  margin_pct: number;
};

export type ScmOvfPreview = {
  ovf_id: string;
  ovf_no: string;
  company_id: string;
  branch_id: string;
  quote_id: string;
  opportunity_id: string;
  quote_no: string | null;
  po_number: string | null;
  /** Customer PO date (YYYY-MM-DD). */
  po_date?: string | null;
  /** Customer delivery date / period from OVF (often YYYY-MM-DD). */
  delivery_period?: string | null;
  customer_name: string | null;
  quote_name: string | null;
  account_name: string | null;
  owner_name: string | null;
  oem_name: string | null;
  oem_contact_person: string | null;
  oem_contact_email: string | null;
  oem_contact_number: string | null;
  blueprint_state: string;
  approval_status: string | null;
  freight: number;
  additional_charges: number;
  vendor_payment_days: number;
  customer_payment_days: number;
  finance_cost_pct: number;
  total_margin_amount: number;
  total_margin_pct: number;
  products_margin_amount: number;
  billing_address: string | null;
  shipping_address: string | null;
  billing_state: string | null;
  shipping_state: string | null;
  billing_contact_person: string | null;
  shipping_contact_person: string | null;
  customer_gst: string | null;
  tax_percentage: number;
  ovf_approver: string | null;
  vendor_name: string | null;
  company_po_number: string | null;
  vendor_lines: ScmVendorLine[];
  customer_lines: ScmVendorLine[];
  margin_lines: ScmMarginLine[];
  purchase_order_id: string | null;
  purchase_order_number: string | null;
  can_create_po: boolean;
  scm_on_hold?: boolean;
  scm_on_hold_at?: string | null;
  scm_hold_blocked?: boolean;
  scm_last_hold_since?: string | null;
  scm_last_hold_released_at?: string | null;
  scm_hold_history?: ScmOvfHoldHistoryEntry[];
  scm_on_hold_remark?: string | null;
  purchase_order_status?: string | null;
};

export type ScmOvfHoldHistoryEntry = {
  started_at: string;
  released_at: string;
  remark?: string | null;
};

export type ScmVendorPoLine = {
  id: string;
  line_number: number;
  product_name: string | null;
  quantity: number;
  quantity_received: number;
  last_receipt_qty?: number;
  last_receipt_batch_id?: string | null;
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
  company_po_number?: string | null;
  vendor_total?: number;
  customer_total?: number;
  margin_amount?: number;
  grn_status: string;
  /** When receipt qty was last saved on any line (ISO datetime). */
  receipt_saved_at?: string | null;
  current_receipt_batch_id?: string | null;
  current_grn_number?: string | null;
  grn_sequence?: number;
  line_count: number;
  lines: ScmVendorPoLine[];
};

export type ProcOrder = {
  id: string;
  document_number: string;
  document_date: string;
  vendor_id: string;
  company_id?: string;
  branch_id?: string;
  status: string;
  currency_code: string;
  payment_terms: string | null;
  total_amount: number;
  received_amount: number;
  source_module: string | null;
  source_document_id: string | null;
  company_po_number: string | null;
  entity_code?: string | null;
  customer_name: string | null;
  approved_by_name?: string | null;
  customer_po_number?: string | null;
  ovf_date?: string | null;
  vendor_total?: number;
  customer_total?: number;
  customer_tax_amount?: number;
  customer_total_with_tax?: number;
  vendor_tax_amount?: number;
  vendor_total_with_tax?: number;
  margin_amount?: number;
  margin_pct?: number;
  description?: string | null;
  current_receipt_batch_id?: string | null;
  current_receipt_batch_at?: string | null;
  current_grn_number?: string | null;
  grn_sequence?: number;
  version: number;
  lines: Array<{
    id: string;
    line_number: number;
    product_id: string;
    product_code: string | null;
    product_name: string | null;
    quantity: number;
    quantity_received: number;
    last_receipt_qty?: number;
    last_receipt_batch_id?: string | null;
    last_receipt_serial_numbers?: string[] | null;
    last_receipt_billing?: boolean;
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

export function peekScmQueueFromCache(): ScmQueueItem[] | null {
  return peekCachedValue<ScmQueueItem[]>(PROCUREMENT_SCM_QUEUE_CACHE_KEY);
}

export async function listScmQueue(): Promise<ScmQueueItem[]> {
  return cachedFetch(PROCUREMENT_SCM_QUEUE_CACHE_KEY, PROCUREMENT_LIST_TTL_MS, async () => {
    const res = await apiClient<ScmQueueItem[]>(`${SCM_API}/queue`);
    return unwrapData(res);
  });
}

export async function getScmOvfPreview(ovfId: string): Promise<ScmOvfPreview> {
  const res = await apiClient<ScmOvfPreview>(`${SCM_API}/ovf/${ovfId}`);
  return unwrapData(res);
}

export async function holdScmOvf(ovfId: string, remark: string): Promise<ScmOvfPreview> {
  const res = await apiClient<ScmOvfPreview>(`${SCM_API}/ovf/${ovfId}/hold`, {
    method: "POST",
    body: { remark: remark.trim() },
  });
  invalidateProcurementListCache();
  return unwrapData(res);
}

export async function releaseScmOvfHold(ovfId: string): Promise<ScmOvfPreview> {
  const res = await apiClient<ScmOvfPreview>(`${SCM_API}/ovf/${ovfId}/release-hold`, {
    method: "POST",
    body: {},
  });
  invalidateProcurementListCache();
  return unwrapData(res);
}

export async function updateScmOvfCharges(
  ovfId: string,
  body: {
    freight: number;
    additional_charges: number;
    finance_cost_pct: number;
  },
): Promise<ScmOvfPreview> {
  const res = await apiClient<ScmOvfPreview>(`${SCM_API}/ovf/${ovfId}/charges`, {
    method: "PATCH",
    body,
  });
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
    entity_code: string;
    finalize?: boolean;
    hold?: boolean;
  },
): Promise<ProcOrder> {
  const res = await apiClient<ProcOrder>(`${SCM_API}/ovf/${ovfId}/purchase-orders`, {
    method: "POST",
    body,
  });
  invalidateProcurementListCache();
  return unwrapData(res);
}

export async function peekNextCompanyPoNumber(
  entityCode: string,
  companyId?: string,
): Promise<{ entity_code: string; company_po_number: string }> {
  const params = new URLSearchParams({ entity_code: entityCode });
  if (companyId) params.set("company_id", companyId);
  const res = await apiClient<{ entity_code: string; company_po_number: string }>(
    `${SCM_API}/company-po-numbers/next?${params.toString()}`,
  );
  return unwrapData(res);
}

export async function finalizeScmOrder(orderId: string): Promise<ProcOrder> {
  const res = await apiClient<ProcOrder>(`${SCM_API}/orders/${orderId}/finalize`, {
    method: "POST",
    body: {},
  });
  invalidateProcurementListCache();
  return unwrapData(res);
}

export function peekVendorPosFromCache(): ScmVendorPo[] | null {
  return peekCachedValue<ScmVendorPo[]>(PROCUREMENT_VENDOR_POS_CACHE_KEY);
}

export async function listVendorPos(): Promise<ScmVendorPo[]> {
  return cachedFetch(PROCUREMENT_VENDOR_POS_CACHE_KEY, PROCUREMENT_LIST_TTL_MS, async () => {
    const res = await apiClient<ScmVendorPo[]>(`${SCM_API}/vendor-pos`);
    return unwrapData(res);
  });
}

export type ProcurementInventoryRow = {
  order_id: string | null;
  order_line_id?: string | null;
  receipt_batch_id?: string | null;
  grn_number: string;
  receipt_at: string | null;
  company_po_number: string;
  vendor_id: string | null;
  product_name: string | null;
  line_number: number;
  unit_index: number;
  serial_number: string;
  source: "grn" | "import" | string;
  received_quantity?: number;
  billing_quantity?: number;
  unit_cost?: number;
  description?: string | null;
  stock_unit_id?: string | null;
  import_line_id?: string | null;
};

export async function createPoFromInventory(payload: {
  vendor_id: string;
  entity_code: string;
  document_date?: string;
  payment_terms?: string | null;
  approved_by_name?: string | null;
  lines?: Array<{ product_name: string; quantity: number; unit_cost?: number }>;
}): Promise<ProcOrder> {
  const res = await apiClient<ProcOrder>(`${SCM_API}/inventory/purchase-orders`, {
    method: "POST",
    body: {
      vendor_id: payload.vendor_id,
      entity_code: payload.entity_code,
      document_date: payload.document_date || null,
      payment_terms: payload.payment_terms ?? null,
      approved_by_name: payload.approved_by_name?.trim() || null,
      lines: payload.lines ?? [],
    },
  });
  invalidateProcurementListCache();
  return unwrapData(res);
}

export async function listProcurementInventory(): Promise<ProcurementInventoryRow[]> {
  return cachedFetch(PROCUREMENT_INVENTORY_CACHE_KEY, PROCUREMENT_LIST_TTL_MS, async () => {
    const res = await apiClient<ProcurementInventoryRow[]>(`${SCM_API}/inventory`);
    return unwrapData(res);
  });
}

export async function updateInventoryStockSerial(
  stockUnitId: string,
  serial_number: string,
): Promise<void> {
  await apiClient(`${SCM_API}/inventory/stock-units/${stockUnitId}/serial`, {
    method: "PATCH",
    body: { serial_number },
  });
  invalidateProcurementListCache();
}

export async function updateInventoryImportSerial(
  importLineId: string,
  serial_number: string,
): Promise<void> {
  await apiClient(`${SCM_API}/inventory/import-lines/${importLineId}/serial`, {
    method: "PATCH",
    body: { serial_number },
  });
  invalidateProcurementListCache();
}

export async function clearProcurementInventoryStock(): Promise<{ removed: number }> {
  const res = await apiClient<{ removed: number }>(`${SCM_API}/inventory/clear-stock`, {
    method: "POST",
  });
  invalidateProcurementListCache();
  return unwrapData(res);
}

export async function importProcurementInventory(
  lines: Array<{ product_name: string; serial_number: string; order_id?: string | null }>,
): Promise<{ imported: number }> {
  const body = {
    lines: lines.map((line) => ({
      product_name: line.product_name,
      serial_number: line.serial_number,
      order_id: line.order_id || null,
    })),
  };
  const res = await apiClient<{ imported: number }>(`${SCM_API}/inventory/import`, {
    method: "POST",
    body,
  });
  invalidateProcurementListCache();
  return unwrapData(res);
}

export type ScmReceiptBatchLine = {
  order_line_id: string;
  line_number: number;
  product_name: string | null;
  quantity: number;
  serial_numbers?: string[] | null;
  billing?: boolean;
  billing_quantity?: number;
};

export type ScmReceiptBatch = {
  id: string | null;
  sequence: number;
  grn_number: string;
  receipt_at: string | null;
  vendor_invoice_number?: string | null;
  vendor_invoice_date?: string | null;
  vendor_invoice_quantity?: number | null;
  vendor_invoice_subtotal?: number | null;
  lines: ScmReceiptBatchLine[];
  attachments?: ReceiptBatchAttachment[];
};

export type VendorInvoiceExtractResult = {
  vendor_invoice_number: string | null;
  vendor_invoice_date: string | null;
  vendor_invoice_quantity: number | null;
  vendor_invoice_subtotal: number | null;
};

export async function extractVendorInvoiceFromFile(
  file: File,
): Promise<VendorInvoiceExtractResult> {
  const { fileToBase64 } = await import("@/services/sales-crm-service");
  const content_base64 = await fileToBase64(file);
  const res = await apiClient<VendorInvoiceExtractResult>(`${SCM_API}/vendor-invoice/extract`, {
    method: "POST",
    body: { file_name: file.name, content_base64 },
  });
  return unwrapData(res);
}

export async function saveReceiptBatchVendorInvoice(
  batchId: string,
  body: {
    vendor_invoice_number?: string | null;
    vendor_invoice_date?: string | null;
    vendor_invoice_quantity?: number | null;
    vendor_invoice_subtotal?: number | null;
    file_name?: string | null;
    content_base64?: string | null;
    content_type?: string | null;
    branch_id: string;
    company_id?: string | null;
  },
): Promise<ScmReceiptBatch> {
  const res = await apiClient<ScmReceiptBatch>(
    `${SCM_API}/receipt-batches/${batchId}/vendor-invoice`,
    { method: "PATCH", body },
  );
  return unwrapData(res);
}

export async function listOrderReceiptBatches(orderId: string): Promise<ScmReceiptBatch[]> {
  const res = await apiClient<ScmReceiptBatch[]>(
    `${SCM_API}/orders/${orderId}/receipt-batches`,
  );
  return unwrapData(res);
}

export type ReceiptBatchAttachment = {
  id: string;
  file_name: string;
  content_type: string | null;
  size: number | null;
};

export async function listReceiptBatchAttachments(
  batchId: string,
): Promise<ReceiptBatchAttachment[]> {
  const res = await apiClient<ReceiptBatchAttachment[]>(
    `${SCM_API}/receipt-batches/${batchId}/attachments`,
  );
  return unwrapData(res);
}

export async function openReceiptBatchAttachment(attachmentId: string): Promise<void> {
  const token = getAccessToken();
  const response = await fetch(
    `${env.apiUrl}${SCM_API}/receipt-batch-attachments/${attachmentId}/content`,
    {
      headers: {
        Accept: "*/*",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to open attachment (${response.status})`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function getPurchaseOrder(
  orderId: string,
  options?: { includeCommercial?: boolean },
): Promise<ProcOrder> {
  const res = await apiClient<ProcOrder>(`/procurement/orders/${orderId}`, {
    method: "GET",
    query: options?.includeCommercial ? { include_commercial: true } : undefined,
  });
  return unwrapData(res);
}

export async function listPurchaseOrders(options?: {
  includeCommercial?: boolean;
}): Promise<ProcOrder[]> {
  if (options?.includeCommercial) {
    const res = await resourceService.list<ProcOrder>("/procurement/orders", {
      include_commercial: true,
    });
    return normalizeRows(res.data) as unknown as ProcOrder[];
  }
  return cachedFetch(PROCUREMENT_ORDERS_CACHE_KEY, PROCUREMENT_LIST_TTL_MS, async () => {
    const res = await resourceService.list<ProcOrder>("/procurement/orders");
    return normalizeRows(res.data) as unknown as ProcOrder[];
  });
}

export function peekPurchaseOrdersFromCache(): ProcOrder[] | null {
  return peekCachedValue<ProcOrder[]>(PROCUREMENT_ORDERS_CACHE_KEY);
}

export type ProcGrn = {
  id: string;
  document_number: string;
  document_date: string;
  order_header_id: string;
  vendor_id: string;
  status: string;
  subtotal_amount: number;
  version: number;
  lines: Array<{
    id: string;
    order_line_id: string;
    line_number: number;
    product_id: string;
    quantity: number;
    quantity_rejected: number;
    status: string;
  }>;
};

export async function listGoodsReceipts(): Promise<ProcGrn[]> {
  const res = await resourceService.list<ProcGrn>("/procurement/grns");
  return normalizeRows(res.data) as unknown as ProcGrn[];
}

export async function getGoodsReceipt(grnId: string): Promise<ProcGrn> {
  const res = await resourceService.get<ProcGrn>("/procurement/grns", grnId);
  return unwrapData(res);
}

export async function updateLineReceipt(
  orderId: string,
  lineId: string,
  body: {
    quantity_received: number;
    grn_status?: string | null;
    serial_numbers?: string[] | null;
    billing?: boolean;
    billing_quantity?: number;
  },
): Promise<ProcOrder> {
  const res = await apiClient<ProcOrder>(
    `${SCM_API}/orders/${orderId}/lines/${lineId}/receipt`,
    { method: "PATCH", body },
  );
  invalidateProcurementListCache();
  return unwrapData(res);
}

export async function uploadReceiptBatchAttachment(
  batchId: string,
  body: {
    file_name: string;
    content_base64: string;
    content_type?: string | null;
    branch_id: string;
    company_id?: string | null;
  },
): Promise<{ id: string; file_name: string }> {
  const res = await apiClient<{ id: string; file_name: string }>(
    `${SCM_API}/receipt-batches/${batchId}/attachments`,
    { method: "POST", body },
  );
  return unwrapData(res);
}

export type VendorPostalAddress = {
  country: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
};

export type VendorAddressEntry = {
  address: string;
  gstNumber: string;
  sourceOfSupply: string;
  destinationOfSupply: string;
  billing?: VendorPostalAddress;
  shipping?: VendorPostalAddress;
};

export type VendorOption = {
  id: string;
  label: string;
  /** Primary / selected display address */
  address: string;
  /** Address lines only (for display / legacy) */
  addresses: string[];
  /** Full address book: each GST registration can have its own supply states */
  addressEntries: VendorAddressEntry[];
  taxNumber: string;
  vendorCode?: string;
  vendorType?: string;
  status?: string;
  version?: number;
  companyId?: string;
  branchId?: string;
  email?: string;
  mobile?: string;
  contactFirstName?: string;
  contactLastName?: string;
};

export function emptyPostalAddress(
  partial?: Partial<VendorPostalAddress>,
): VendorPostalAddress {
  return {
    country: partial?.country?.trim() || "India",
    street: partial?.street?.trim() || "",
    city: partial?.city?.trim() || "",
    state: partial?.state?.trim() || "",
    pincode: partial?.pincode?.trim() || "",
  };
}

export function composePostalAddress(addr?: VendorPostalAddress | null): string {
  if (!addr) return "";
  return [addr.street, addr.city, addr.state, addr.pincode, addr.country]
    .map((part) => (part || "").trim())
    .filter(Boolean)
    .join(", ");
}

function parsePostalAddress(value: unknown): VendorPostalAddress | undefined {
  if (!value || typeof value !== "object") return undefined;
  const row = value as Record<string, unknown>;
  const street =
    (typeof row.street === "string" && row.street) ||
    (typeof row.line1 === "string" && row.line1) ||
    (typeof row.address === "string" && row.address) ||
    "";
  const city = typeof row.city === "string" ? row.city : "";
  const state = typeof row.state === "string" ? row.state : "";
  const pincode =
    (typeof row.pincode === "string" && row.pincode) ||
    (typeof row.postal_code === "string" && row.postal_code) ||
    "";
  const country =
    (typeof row.country === "string" && row.country) ||
    (typeof row.country_code === "string" && row.country_code === "IN" ? "India" : "") ||
    "India";
  if (!street && !city && !state && !pincode) return undefined;
  return emptyPostalAddress({ country, street, city, state, pincode });
}

function formatAddressJson(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const addr = value as Record<string, unknown>;
  if (typeof addr.address === "string" && addr.address.trim()) {
    return addr.address.trim();
  }
  if (typeof addr.line1 === "string" && addr.line1.trim() && !addr.city) {
    return addr.line1.trim();
  }
  const structured = [addr.line1, addr.city, addr.state, addr.postal_code, addr.country_code]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(", ");
  return structured;
}

function emptyAddressEntry(partial?: Partial<VendorAddressEntry>): VendorAddressEntry {
  const billing = partial?.billing
    ? emptyPostalAddress(partial.billing)
    : undefined;
  const shipping = partial?.shipping
    ? emptyPostalAddress(partial.shipping)
    : undefined;
  const composed =
    partial?.address?.trim() ||
    composePostalAddress(billing) ||
    composePostalAddress(shipping) ||
    "";
  return {
    address: composed,
    gstNumber: partial?.gstNumber?.trim() || "",
    sourceOfSupply: partial?.sourceOfSupply?.trim() || "",
    destinationOfSupply: partial?.destinationOfSupply?.trim() || "",
    billing,
    shipping,
  };
}

function parseAddressEntry(entry: unknown, fallbackGst = ""): VendorAddressEntry | null {
  if (typeof entry === "string") {
    const address = entry.trim();
    if (!address) return null;
    return emptyAddressEntry({ address, gstNumber: fallbackGst });
  }
  if (!entry || typeof entry !== "object") return null;
  const row = entry as Record<string, unknown>;
  const billing = parsePostalAddress(row.billing) || parsePostalAddress(row);
  const shipping = parsePostalAddress(row.shipping);
  const address =
    formatAddressJson(row) ||
    (typeof row.address === "string" ? row.address.trim() : "") ||
    composePostalAddress(billing) ||
    composePostalAddress(shipping);
  if (!address) return null;
  return emptyAddressEntry({
    address,
    gstNumber:
      (typeof row.gst_number === "string" && row.gst_number) ||
      (typeof row.gstNumber === "string" && row.gstNumber) ||
      (typeof row.tax_number === "string" && row.tax_number) ||
      fallbackGst,
    sourceOfSupply:
      (typeof row.source_of_supply === "string" && row.source_of_supply) ||
      (typeof row.sourceOfSupply === "string" && row.sourceOfSupply) ||
      (typeof row.state === "string" && row.state) ||
      "",
    destinationOfSupply:
      (typeof row.destination_of_supply === "string" && row.destination_of_supply) ||
      (typeof row.destinationOfSupply === "string" && row.destinationOfSupply) ||
      "",
    billing,
    shipping,
  });
}

export function parseVendorAddressEntries(
  value: unknown,
  fallbackGst = "",
): VendorAddressEntry[] {
  if (!value || typeof value !== "object") return [];
  const addr = value as Record<string, unknown>;
  const entries: VendorAddressEntry[] = [];
  if (Array.isArray(addr.addresses)) {
    for (const entry of addr.addresses) {
      const parsed = parseAddressEntry(entry, entries.length === 0 ? fallbackGst : "");
      if (parsed) entries.push(parsed);
    }
  }
  if (entries.length === 0) {
    const primary = parseAddressEntry(addr, fallbackGst);
    if (primary) entries.push(primary);
  }
  return entries;
}

function parseVendorAddresses(value: unknown): string[] {
  return parseVendorAddressEntries(value).map((entry) => entry.address);
}

export function buildVendorAddressJson(
  addresses: Array<string | VendorAddressEntry>,
  extras?: {
    contactFirstName?: string;
    contactLastName?: string;
  },
): Record<string, unknown> | null {
  const entries = addresses
    .map((entry) =>
      typeof entry === "string"
        ? emptyAddressEntry({ address: entry })
        : emptyAddressEntry(entry),
    )
    .filter((entry) => entry.address);
  if (entries.length === 0) return null;
  const primary = entries[0];
  const billing = primary.billing || emptyPostalAddress({ street: primary.address });
  return {
    line1: billing.street || primary.address,
    city: billing.city || "",
    country_code: billing.country === "India" || !billing.country ? "IN" : billing.country.slice(0, 3).toUpperCase(),
    postal_code: billing.pincode || null,
    state: primary.sourceOfSupply || null,
    contact: {
      first_name: extras?.contactFirstName?.trim() || null,
      last_name: extras?.contactLastName?.trim() || null,
    },
    billing: {
      country: billing.country,
      street: billing.street,
      city: billing.city,
      state: billing.state,
      pincode: billing.pincode,
    },
    shipping: primary.shipping
      ? {
          country: primary.shipping.country,
          street: primary.shipping.street,
          city: primary.shipping.city,
          state: primary.shipping.state,
          pincode: primary.shipping.pincode,
        }
      : null,
    addresses: entries.map((entry) => ({
      address: entry.address,
      gst_number: entry.gstNumber || null,
      source_of_supply: entry.sourceOfSupply || null,
      destination_of_supply: entry.destinationOfSupply || null,
      billing: entry.billing
        ? {
            country: entry.billing.country,
            street: entry.billing.street,
            city: entry.billing.city,
            state: entry.billing.state,
            pincode: entry.billing.pincode,
          }
        : null,
      shipping: entry.shipping
        ? {
            country: entry.shipping.country,
            street: entry.shipping.street,
            city: entry.shipping.city,
            state: entry.shipping.state,
            pincode: entry.shipping.pincode,
          }
        : null,
    })),
  };
}

function toVendorOption(
  row: Record<string, unknown>,
  fallback?: {
    vendor_name?: string;
    vendor_type?: string;
    company_id?: string;
    branch_id?: string;
    addressEntries?: VendorAddressEntry[];
    email?: string;
    mobile?: string;
    contactFirstName?: string;
    contactLastName?: string;
  },
): VendorOption {
  const id = String(row.id ?? "");
  const taxNumber = typeof row.tax_number === "string" ? row.tax_number : "";
  const parsed = parseVendorAddressEntries(row.address_json, taxNumber);
  const addressEntries =
    parsed.length > 0 ? parsed : fallback?.addressEntries?.filter((e) => e.address) || [];
  const addresses = addressEntries.map((e) => e.address);
  const addrJson =
    row.address_json && typeof row.address_json === "object"
      ? (row.address_json as Record<string, unknown>)
      : {};
  const contact =
    addrJson.contact && typeof addrJson.contact === "object"
      ? (addrJson.contact as Record<string, unknown>)
      : {};
  return {
    id,
    label: String(row.vendor_name ?? fallback?.vendor_name ?? id).trim(),
    address: addresses[0] ?? "",
    addresses,
    addressEntries,
    taxNumber: taxNumber || addressEntries[0]?.gstNumber || "",
    vendorCode: typeof row.vendor_code === "string" ? row.vendor_code : undefined,
    vendorType:
      typeof row.vendor_type === "string" ? row.vendor_type : fallback?.vendor_type,
    status: typeof row.status === "string" ? row.status : undefined,
    version: typeof row.version === "number" ? row.version : undefined,
    companyId:
      row.company_id != null
        ? String(row.company_id)
        : fallback?.company_id,
    branchId:
      row.branch_id != null ? String(row.branch_id) : fallback?.branch_id,
    email:
      (typeof row.email === "string" && row.email) ||
      fallback?.email ||
      undefined,
    mobile:
      (typeof row.mobile === "string" && row.mobile) ||
      fallback?.mobile ||
      undefined,
    contactFirstName:
      (typeof contact.first_name === "string" && contact.first_name) ||
      fallback?.contactFirstName ||
      undefined,
    contactLastName:
      (typeof contact.last_name === "string" && contact.last_name) ||
      fallback?.contactLastName ||
      undefined,
  };
}

export function peekVendorOptionsFromCache(): VendorOption[] | null {
  return peekCachedValue<VendorOption[]>(PROCUREMENT_VENDOR_OPTIONS_CACHE_KEY);
}

export async function listVendorOptions(): Promise<VendorOption[]> {
  return cachedFetch(PROCUREMENT_VENDOR_OPTIONS_CACHE_KEY, 5 * 60_000, async () => {
    const res = await resourceService.list<Record<string, unknown>>("/vendors");
    const rows = normalizeRows(res.data);
    return rows.map((row) => toVendorOption(row)).filter((v) => v.id);
  });
}

export async function createVendorOption(input: {
  vendor_name: string;
  company_id: string;
  branch_id: string;
  addresses?: string[];
  addressEntries?: VendorAddressEntry[];
  vendor_type?: string;
  email?: string | null;
  mobile?: string | null;
  contactFirstName?: string;
  contactLastName?: string;
  tax_number?: string | null;
}): Promise<VendorOption> {
  const addressEntries =
    input.addressEntries?.filter((e) => e.address.trim()) ||
    (input.addresses || []).map((address) => emptyAddressEntry({ address }));
  const body = {
    vendor_name: input.vendor_name.trim(),
    vendor_type: input.vendor_type || "domestic",
    company_id: input.company_id,
    branch_id: input.branch_id,
    tax_number: input.tax_number?.trim() || addressEntries[0]?.gstNumber || null,
    email: input.email?.trim() || null,
    mobile: input.mobile?.trim() || null,
    address_json: buildVendorAddressJson(addressEntries, {
      contactFirstName: input.contactFirstName,
      contactLastName: input.contactLastName,
    }),
  };
  const res = await resourceService.create<Record<string, unknown>>("/vendors", body);
  invalidateClientCache("erp.procurement.vendor-options");
  const row = (res.data ?? res) as Record<string, unknown>;
  return toVendorOption(row, {
    vendor_name: input.vendor_name,
    vendor_type: input.vendor_type,
    company_id: input.company_id,
    branch_id: input.branch_id,
    addressEntries,
    email: input.email || undefined,
    mobile: input.mobile || undefined,
    contactFirstName: input.contactFirstName,
    contactLastName: input.contactLastName,
  });
}

export async function resolveVendorOrgScope(): Promise<{
  company_id: string;
  branch_id: string;
} | null> {
  const vendors = await listVendorOptions().catch(() => [] as VendorOption[]);
  const fromVendor = vendors.find((v) => v.companyId && v.branchId);
  if (fromVendor?.companyId && fromVendor.branchId) {
    return { company_id: fromVendor.companyId, branch_id: fromVendor.branchId };
  }

  const queue = await listScmQueue().catch(() => []);
  const fromQueue = queue.find((row) => row.company_id && row.branch_id);
  if (fromQueue?.company_id && fromQueue.branch_id) {
    return { company_id: fromQueue.company_id, branch_id: fromQueue.branch_id };
  }

  const res = await resourceService.list<Record<string, unknown>>("/branches").catch(() => null);
  if (!res) return null;
  const rows = normalizeRows(res.data);
  const branch = rows.find((row) => row.id && row.company_id);
  if (!branch?.id || !branch.company_id) return null;
  return { company_id: String(branch.company_id), branch_id: String(branch.id) };
}

export async function updateVendorOption(input: {
  vendor_id: string;
  version: number;
  vendor_name: string;
  vendor_type?: string;
  tax_number?: string | null;
  addresses?: string[];
  addressEntries?: VendorAddressEntry[];
  email?: string | null;
  mobile?: string | null;
  contactFirstName?: string;
  contactLastName?: string;
}): Promise<VendorOption> {
  const addressEntries =
    input.addressEntries?.filter((e) => e.address.trim()) ||
    (input.addresses || []).map((address) => emptyAddressEntry({ address }));
  const res = await apiClient<Record<string, unknown>>(`/vendors/${input.vendor_id}`, {
    method: "PUT",
    body: {
      version: input.version,
      vendor_name: input.vendor_name.trim(),
      vendor_type: input.vendor_type || undefined,
      tax_number:
        input.tax_number?.trim() ||
        addressEntries[0]?.gstNumber ||
        null,
      email: input.email?.trim() || null,
      mobile: input.mobile?.trim() || null,
      address_json: buildVendorAddressJson(addressEntries, {
        contactFirstName: input.contactFirstName,
        contactLastName: input.contactLastName,
      }),
    },
  });
  invalidateClientCache("erp.procurement.vendor-options");
  const row = (res.data ?? res) as Record<string, unknown>;
  return toVendorOption(row, {
    vendor_name: input.vendor_name,
    vendor_type: input.vendor_type,
    addressEntries,
    email: input.email || undefined,
    mobile: input.mobile || undefined,
    contactFirstName: input.contactFirstName,
    contactLastName: input.contactLastName,
  });
}

export async function updateVendorAddresses(input: {
  vendor_id: string;
  version: number;
  addresses: Array<string | VendorAddressEntry>;
}): Promise<VendorOption> {
  const addressEntries = input.addresses
    .map((entry) =>
      typeof entry === "string"
        ? emptyAddressEntry({ address: entry })
        : emptyAddressEntry(entry),
    )
    .filter((entry) => entry.address);
  const res = await apiClient<Record<string, unknown>>(`/vendors/${input.vendor_id}`, {
    method: "PUT",
    body: {
      version: input.version,
      tax_number: addressEntries[0]?.gstNumber || null,
      address_json: buildVendorAddressJson(addressEntries),
    },
  });
  invalidateClientCache("erp.procurement.vendor-options");
  const row = (res.data ?? res) as Record<string, unknown>;
  return toVendorOption(row, { addressEntries });
}
