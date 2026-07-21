import { ApiClientError, resourceService } from "@/services/api-client";

export type InventoryRow = Record<string, unknown>;

export type InventoryOverview = {
  stock: InventoryRow[];
  bins: InventoryRow[];
  batches: InventoryRow[];
  serials: InventoryRow[];
  reservations: InventoryRow[];
  transfers: InventoryRow[];
  adjustments: InventoryRow[];
  cycleCounts: InventoryRow[];
  policies: InventoryRow[];
  valuation: InventoryRow[];
  errors: string[];
  statusCodes: number[];
  partial: boolean;
};

function normalizeRows(data: unknown): InventoryRow[] {
  if (Array.isArray(data)) {
    return data.filter((row): row is InventoryRow => !!row && typeof row === "object");
  }
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    // ReportSummaryResponse: { name, row_count, rows: [...] }
    if (Array.isArray(obj.rows)) return normalizeRows(obj.rows);
    for (const key of ["items", "results", "records", "data", "lines", "layers"]) {
      if (Array.isArray(obj[key])) return normalizeRows(obj[key]);
    }
    return [obj];
  }
  return [];
}

async function safeList(
  apiPath: string,
): Promise<{ rows: InventoryRow[]; error?: string; status?: number; raw?: unknown }> {
  try {
    const response = await resourceService.list(apiPath);
    return { rows: normalizeRows(response.data), raw: response.data };
  } catch (err) {
    if (err instanceof ApiClientError) {
      return { rows: [], error: err.message, status: err.status };
    }
    return { rows: [], error: `Failed to load ${apiPath}`, status: 500 };
  }
}

export function formatQty(value: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value);
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

export function sumField(rows: InventoryRow[], field: string): number {
  return rows.reduce((sum, row) => sum + asNumber(row[field]), 0);
}

export function countOpenDocs(rows: InventoryRow[], closedStatuses: string[]): number {
  const closed = new Set(closedStatuses.map((s) => s.toLowerCase()));
  return rows.filter((row) => {
    const status = asStatus(row.status);
    if (!status) return true;
    return !closed.has(status);
  }).length;
}

export function valuationTotal(rows: InventoryRow[]): number {
  return rows.reduce(
    (sum, row) => sum + asNumber(row.remaining_qty) * asNumber(row.unit_cost),
    0,
  );
}

export async function loadInventoryOverview(): Promise<InventoryOverview> {
  const [
    stock,
    bins,
    batches,
    serials,
    reservations,
    transfers,
    adjustments,
    cycleCounts,
    policies,
    valuation,
  ] = await Promise.all([
    safeList("/inventory/stock"),
    safeList("/inventory/bins"),
    safeList("/inventory/batches"),
    safeList("/inventory/serials"),
    safeList("/inventory/reservations"),
    safeList("/inventory/transfers"),
    safeList("/inventory/adjustments"),
    safeList("/inventory/cycle-counts"),
    safeList("/inventory/policies"),
    safeList("/inventory/valuation/layers"),
  ]);

  const results = [
    stock,
    bins,
    batches,
    serials,
    reservations,
    transfers,
    adjustments,
    cycleCounts,
    policies,
    valuation,
  ];
  const errors = results.map((r) => r.error).filter((e): e is string => Boolean(e));
  const statusCodes = results
    .map((r) => r.status)
    .filter((s): s is number => typeof s === "number");

  return {
    stock: stock.rows,
    bins: bins.rows,
    batches: batches.rows,
    serials: serials.rows,
    reservations: reservations.rows,
    transfers: transfers.rows,
    adjustments: adjustments.rows,
    cycleCounts: cycleCounts.rows,
    policies: policies.rows,
    valuation: valuation.rows,
    errors,
    statusCodes,
    partial: errors.length > 0,
  };
}

export async function loadInventoryReport(apiPath: string): Promise<{
  rows: InventoryRow[];
  name?: string;
  rowCount?: number;
}> {
  const { rows, error, status, raw } = await safeList(apiPath);
  if (error) throw new ApiClientError(error, status ?? 500);
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    return {
      rows,
      name: typeof obj.name === "string" ? obj.name : undefined,
      rowCount: typeof obj.row_count === "number" ? obj.row_count : rows.length,
    };
  }
  return { rows };
}

export { normalizeRows };
