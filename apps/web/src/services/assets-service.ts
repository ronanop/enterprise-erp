import { ApiClientError, resourceService } from "@/services/api-client";

export type AssetsRow = Record<string, unknown>;

export type AssetsOverview = {
  categories: AssetsRow[];
  assets: AssetsRow[];
  components: AssetsRow[];
  assignments: AssetsRow[];
  transfers: AssetsRow[];
  locations: AssetsRow[];
  warranties: AssetsRow[];
  insurances: AssetsRow[];
  maintenancePlans: AssetsRow[];
  maintenances: AssetsRow[];
  depreciations: AssetsRow[];
  disposals: AssetsRow[];
  audits: AssetsRow[];
  meterReadings: AssetsRow[];
  errors: string[];
  statusCodes: number[];
  partial: boolean;
};

function normalizeRows(data: unknown): AssetsRow[] {
  if (Array.isArray(data)) {
    return data.filter(
      (row): row is AssetsRow => !!row && typeof row === "object",
    );
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
): Promise<{ rows: AssetsRow[]; error?: string; status?: number }> {
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

export function sumField(rows: AssetsRow[], field: string): number {
  return rows.reduce((sum, row) => sum + asNumber(row[field]), 0);
}

export function countByStatus(rows: AssetsRow[], statuses: string[]): number {
  const set = new Set(statuses.map((s) => s.toLowerCase()));
  return rows.filter((row) => set.has(asStatus(row.status))).length;
}

export function countOpenDocs(
  rows: AssetsRow[],
  closedStatuses: string[],
): number {
  const closed = new Set(closedStatuses.map((s) => s.toLowerCase()));
  return rows.filter((row) => {
    const status = asStatus(row.status);
    if (!status) return true;
    return !closed.has(status);
  }).length;
}

export async function loadAssetsOverview(): Promise<AssetsOverview> {
  const [
    categories,
    assets,
    components,
    assignments,
    transfers,
    locations,
    warranties,
    insurances,
    maintenancePlans,
    maintenances,
    depreciations,
    disposals,
    audits,
    meterReadings,
  ] = await Promise.all([
    safeList("/assets/asset-categories"),
    safeList("/assets/assets"),
    safeList("/assets/asset-components"),
    safeList("/assets/asset-assignments"),
    safeList("/assets/asset-transfers"),
    safeList("/assets/asset-locations"),
    safeList("/assets/asset-warranties"),
    safeList("/assets/asset-insurances"),
    safeList("/assets/maintenance-plans"),
    safeList("/assets/asset-maintenances"),
    safeList("/assets/asset-depreciations"),
    safeList("/assets/asset-disposals"),
    safeList("/assets/asset-audits"),
    safeList("/assets/meter-readings"),
  ]);

  const results = [
    categories,
    assets,
    components,
    assignments,
    transfers,
    locations,
    warranties,
    insurances,
    maintenancePlans,
    maintenances,
    depreciations,
    disposals,
    audits,
    meterReadings,
  ];
  const errors = results.map((r) => r.error).filter((e): e is string => Boolean(e));
  const statusCodes = results
    .map((r) => r.status)
    .filter((s): s is number => typeof s === "number");

  return {
    categories: categories.rows,
    assets: assets.rows,
    components: components.rows,
    assignments: assignments.rows,
    transfers: transfers.rows,
    locations: locations.rows,
    warranties: warranties.rows,
    insurances: insurances.rows,
    maintenancePlans: maintenancePlans.rows,
    maintenances: maintenances.rows,
    depreciations: depreciations.rows,
    disposals: disposals.rows,
    audits: audits.rows,
    meterReadings: meterReadings.rows,
    errors,
    statusCodes,
    partial: errors.length > 0,
  };
}
