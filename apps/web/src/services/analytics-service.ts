import { ApiClientError, resourceService } from "@/services/api-client";

export type AnalyticsRow = Record<string, unknown>;

export type AnalyticsOverview = {
  dashboards: AnalyticsRow[];
  widgets: AnalyticsRow[];
  reports: AnalyticsRow[];
  schedules: AnalyticsRow[];
  datasets: AnalyticsRow[];
  metrics: AnalyticsRow[];
  kpis: AnalyticsRow[];
  dimensions: AnalyticsRow[];
  alertRules: AnalyticsRow[];
  subscriptions: AnalyticsRow[];
  exports: AnalyticsRow[];
  imports: AnalyticsRow[];
  errors: string[];
  statusCodes: number[];
  partial: boolean;
};

function normalizeRows(data: unknown): AnalyticsRow[] {
  if (Array.isArray(data)) {
    return data.filter(
      (row): row is AnalyticsRow => !!row && typeof row === "object",
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
): Promise<{ rows: AnalyticsRow[]; error?: string; status?: number }> {
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

export function countByStatus(rows: AnalyticsRow[], statuses: string[]): number {
  const set = new Set(statuses.map((s) => s.toLowerCase()));
  return rows.filter((row) => set.has(asStatus(row.status))).length;
}

export function countOpenDocs(
  rows: AnalyticsRow[],
  closedStatuses: string[],
): number {
  const closed = new Set(closedStatuses.map((s) => s.toLowerCase()));
  return rows.filter((row) => {
    const status = asStatus(row.status);
    if (!status) return true;
    return !closed.has(status);
  }).length;
}

export async function loadAnalyticsOverview(): Promise<AnalyticsOverview> {
  const [
    dashboards,
    widgets,
    reports,
    schedules,
    datasets,
    metrics,
    kpis,
    dimensions,
    alertRules,
    subscriptions,
    exports,
    imports,
  ] = await Promise.all([
    safeList("/analytics/dashboards"),
    safeList("/analytics/dashboard-widgets"),
    safeList("/analytics/reports"),
    safeList("/analytics/report-schedules"),
    safeList("/analytics/datasets"),
    safeList("/analytics/metrics"),
    safeList("/analytics/kpis"),
    safeList("/analytics/dimensions"),
    safeList("/analytics/alert-rules"),
    safeList("/analytics/subscriptions"),
    safeList("/analytics/data-exports"),
    safeList("/analytics/data-imports"),
  ]);

  const results = [
    dashboards,
    widgets,
    reports,
    schedules,
    datasets,
    metrics,
    kpis,
    dimensions,
    alertRules,
    subscriptions,
    exports,
    imports,
  ];
  const errors = results.map((r) => r.error).filter((e): e is string => Boolean(e));
  const statusCodes = results
    .map((r) => r.status)
    .filter((s): s is number => typeof s === "number");

  return {
    dashboards: dashboards.rows,
    widgets: widgets.rows,
    reports: reports.rows,
    schedules: schedules.rows,
    datasets: datasets.rows,
    metrics: metrics.rows,
    kpis: kpis.rows,
    dimensions: dimensions.rows,
    alertRules: alertRules.rows,
    subscriptions: subscriptions.rows,
    exports: exports.rows,
    imports: imports.rows,
    errors,
    statusCodes,
    partial: errors.length > 0,
  };
}
