import { ApiClientError, resourceService } from "@/services/api-client";

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
