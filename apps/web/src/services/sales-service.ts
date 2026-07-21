import { ApiClientError, resourceService } from "@/services/api-client";

export type SalesRow = Record<string, unknown>;

export type SalesOverview = {
  quotations: SalesRow[];
  orders: SalesRow[];
  deliveries: SalesRow[];
  invoices: SalesRow[];
  returns: SalesRow[];
  priceLists: SalesRow[];
  discountRules: SalesRow[];
  customerCredit: SalesRow[];
  errors: string[];
  statusCodes: number[];
  partial: boolean;
};

function normalizeRows(data: unknown): SalesRow[] {
  if (Array.isArray(data)) {
    return data.filter((row): row is SalesRow => !!row && typeof row === "object");
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
): Promise<{ rows: SalesRow[]; error?: string; status?: number }> {
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

export function formatInrPrecise(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
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

export function sumField(rows: SalesRow[], field: string): number {
  return rows.reduce((sum, row) => sum + asNumber(row[field]), 0);
}

export function countByStatus(rows: SalesRow[], statuses: string[]): number {
  const set = new Set(statuses.map((s) => s.toLowerCase()));
  return rows.filter((row) => set.has(asStatus(row.status))).length;
}

export function countOpenDocs(rows: SalesRow[], closedStatuses: string[]): number {
  const closed = new Set(closedStatuses.map((s) => s.toLowerCase()));
  return rows.filter((row) => {
    const status = asStatus(row.status);
    if (!status) return true;
    return !closed.has(status);
  }).length;
}

export function creditHoldCount(rows: SalesRow[]): number {
  return rows.filter((row) => row.credit_hold === true || asStatus(row.status) === "on_hold").length;
}

export async function loadSalesOverview(): Promise<SalesOverview> {
  const [
    quotations,
    orders,
    deliveries,
    invoices,
    returns,
    priceLists,
    discountRules,
    customerCredit,
  ] = await Promise.all([
    safeList("/sales/quotations"),
    safeList("/sales/orders"),
    safeList("/sales/deliveries"),
    safeList("/sales/invoices"),
    safeList("/sales/returns"),
    safeList("/sales/price-lists"),
    safeList("/sales/discount-rules"),
    safeList("/sales/customer-credit"),
  ]);

  const results = [
    quotations,
    orders,
    deliveries,
    invoices,
    returns,
    priceLists,
    discountRules,
    customerCredit,
  ];
  const errors = results.map((r) => r.error).filter((e): e is string => Boolean(e));
  const statusCodes = results
    .map((r) => r.status)
    .filter((s): s is number => typeof s === "number");

  return {
    quotations: quotations.rows,
    orders: orders.rows,
    deliveries: deliveries.rows,
    invoices: invoices.rows,
    returns: returns.rows,
    priceLists: priceLists.rows,
    discountRules: discountRules.rows,
    customerCredit: customerCredit.rows,
    errors,
    statusCodes,
    partial: errors.length > 0,
  };
}

export { normalizeRows };
