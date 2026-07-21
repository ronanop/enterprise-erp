import { ApiClientError, resourceService } from "@/services/api-client";

export type ManufacturingRow = Record<string, unknown>;

export type ManufacturingOverview = {
  boms: ManufacturingRow[];
  routings: ManufacturingRow[];
  workCenters: ManufacturingRow[];
  machines: ManufacturingRow[];
  orders: ManufacturingRow[];
  issues: ManufacturingRow[];
  returns: ManufacturingRow[];
  receipts: ManufacturingRow[];
  scrap: ManufacturingRow[];
  wip: ManufacturingRow[];
  variances: ManufacturingRow[];
  errors: string[];
  statusCodes: number[];
  partial: boolean;
};

function normalizeRows(data: unknown): ManufacturingRow[] {
  if (Array.isArray(data)) {
    return data.filter((row): row is ManufacturingRow => !!row && typeof row === "object");
  }
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.rows)) return normalizeRows(obj.rows);
    for (const key of ["items", "results", "records", "data", "lines"]) {
      if (Array.isArray(obj[key])) return normalizeRows(obj[key]);
    }
    return [obj];
  }
  return [];
}

async function safeList(
  apiPath: string,
): Promise<{ rows: ManufacturingRow[]; error?: string; status?: number }> {
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

export function formatQty(value: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value);
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

export function sumField(rows: ManufacturingRow[], field: string): number {
  return rows.reduce((sum, row) => sum + asNumber(row[field]), 0);
}

export function countByStatus(rows: ManufacturingRow[], statuses: string[]): number {
  const set = new Set(statuses.map((s) => s.toLowerCase()));
  return rows.filter((row) => set.has(asStatus(row.status))).length;
}

export function countOpenDocs(rows: ManufacturingRow[], closedStatuses: string[]): number {
  const closed = new Set(closedStatuses.map((s) => s.toLowerCase()));
  return rows.filter((row) => {
    const status = asStatus(row.status);
    if (!status) return true;
    return !closed.has(status);
  }).length;
}

export async function loadManufacturingOverview(): Promise<ManufacturingOverview> {
  const [
    boms,
    routings,
    workCenters,
    machines,
    orders,
    issues,
    returns,
    receipts,
    scrap,
    wip,
    variances,
  ] = await Promise.all([
    safeList("/manufacturing/boms"),
    safeList("/manufacturing/routings"),
    safeList("/manufacturing/work-centers"),
    safeList("/manufacturing/machines"),
    safeList("/manufacturing/production-orders"),
    safeList("/manufacturing/material-issues"),
    safeList("/manufacturing/material-returns"),
    safeList("/manufacturing/production-receipts"),
    safeList("/manufacturing/scrap"),
    safeList("/manufacturing/wip"),
    safeList("/manufacturing/variances"),
  ]);

  const results = [
    boms,
    routings,
    workCenters,
    machines,
    orders,
    issues,
    returns,
    receipts,
    scrap,
    wip,
    variances,
  ];
  const errors = results.map((r) => r.error).filter((e): e is string => Boolean(e));
  const statusCodes = results
    .map((r) => r.status)
    .filter((s): s is number => typeof s === "number");

  return {
    boms: boms.rows,
    routings: routings.rows,
    workCenters: workCenters.rows,
    machines: machines.rows,
    orders: orders.rows,
    issues: issues.rows,
    returns: returns.rows,
    receipts: receipts.rows,
    scrap: scrap.rows,
    wip: wip.rows,
    variances: variances.rows,
    errors,
    statusCodes,
    partial: errors.length > 0,
  };
}
