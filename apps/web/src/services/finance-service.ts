import { ApiClientError, resourceService } from "@/services/api-client";
import { AGING_BUCKETS } from "@/config/finance";

export type FinanceRow = Record<string, unknown>;

export type AgingBucketKey = (typeof AGING_BUCKETS)[number];

export type AgingSummary = Record<AgingBucketKey, { count: number; amount: number }>;

export type FinanceOverview = {
  journals: FinanceRow[];
  ar: FinanceRow[];
  ap: FinanceRow[];
  periods: FinanceRow[];
  accounts: FinanceRow[];
  fiscalYears: FinanceRow[];
  errors: string[];
  statusCodes: number[];
  partial: boolean;
};

function normalizeRows(data: unknown): FinanceRow[] {
  if (Array.isArray(data)) {
    return data.filter((row): row is FinanceRow => !!row && typeof row === "object");
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
): Promise<{ rows: FinanceRow[]; error?: string; status?: number }> {
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

export function sumBalances(rows: FinanceRow[]): number {
  return rows.reduce((sum, row) => sum + asNumber(row.balance_amount), 0);
}

export function countByStatus(rows: FinanceRow[], statuses: string[]): number {
  const set = new Set(statuses.map((s) => s.toLowerCase()));
  return rows.filter((row) => set.has(asStatus(row.status))).length;
}

export function emptyAgingSummary(): AgingSummary {
  return {
    "0-30": { count: 0, amount: 0 },
    "31-60": { count: 0, amount: 0 },
    "61-90": { count: 0, amount: 0 },
    "90+": { count: 0, amount: 0 },
  };
}

export function summarizeAging(rows: FinanceRow[]): AgingSummary {
  const summary = emptyAgingSummary();
  for (const row of rows) {
    const raw = typeof row.aging_bucket === "string" ? row.aging_bucket : "0-30";
    const bucket = (AGING_BUCKETS.includes(raw as AgingBucketKey) ? raw : "90+") as AgingBucketKey;
    summary[bucket].count += 1;
    summary[bucket].amount += asNumber(row.balance_amount);
  }
  return summary;
}

export function openPeriodCount(periods: FinanceRow[]): number {
  return periods.filter((p) => {
    const status = asStatus(p.status);
    return status === "open" || status === "active" || status === "current";
  }).length;
}

export async function loadFinanceOverview(): Promise<FinanceOverview> {
  const [journals, ar, ap, periods, accounts, fiscalYears] = await Promise.all([
    safeList("/finance/journals"),
    safeList("/finance/ar"),
    safeList("/finance/ap"),
    safeList("/finance/periods"),
    safeList("/finance/chart-of-accounts"),
    safeList("/finance/fiscal-years"),
  ]);

  const results = [journals, ar, ap, periods, accounts, fiscalYears];
  const errors = results.map((r) => r.error).filter((e): e is string => Boolean(e));
  const statusCodes = results
    .map((r) => r.status)
    .filter((s): s is number => typeof s === "number");

  return {
    journals: journals.rows,
    ar: ar.rows,
    ap: ap.rows,
    periods: periods.rows,
    accounts: accounts.rows,
    fiscalYears: fiscalYears.rows,
    errors,
    statusCodes,
    partial: errors.length > 0,
  };
}

export async function loadFinanceReport(apiPath: string): Promise<FinanceRow[]> {
  const { rows, error, status } = await safeList(apiPath);
  if (error) throw new ApiClientError(error, status ?? 500);
  return rows;
}

export { normalizeRows };
