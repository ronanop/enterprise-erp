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

export type AnalyticsDashboard = {
  id: string;
  dashboard_number: string;
  dashboard_name: string;
  dashboard_type: string;
  status: string;
  layout_json: Record<string, unknown> | null;
  published_at: string | null;
  version: number;
};

export type AnalyticsWidget = {
  id: string;
  dashboard_id: string;
  widget_title: string;
  widget_type: string;
  kpi_id: string | null;
  metric_id: string | null;
  sequence_no: number;
  config_json: Record<string, unknown> | null;
  status: string;
};

export type AnalyticsReport = {
  id: string;
  report_number: string;
  report_name: string;
  report_type: string;
  status: string;
  output_format: string | null;
  definition_json: Record<string, unknown> | null;
  version: number;
};

export type AnalyticsKpi = {
  id: string;
  kpi_number: string;
  kpi_name: string;
  kpi_code: string;
  target_value: number | null;
  current_value: number | null;
  warning_threshold: number | null;
  critical_threshold: number | null;
  direction: string | null;
  period_grain: string | null;
  source_kpi_key: string | null;
  status: string;
  version: number;
};

export type AnalyticsKpiWrite = {
  kpi_name: string;
  kpi_code?: string;
  source_kpi_key?: string | null;
  target_value?: number | null;
  warning_threshold?: number | null;
  critical_threshold?: number | null;
  direction?: string | null;
  period_grain?: string | null;
};

export type AnalyticsDashboardWrite = {
  dashboard_name: string;
  dashboard_code?: string;
  dashboard_type?: string;
  audience_role?: string | null;
};

export type AnalyticsWidgetWrite = {
  dashboard_id: string;
  widget_title: string;
  widget_type?: string;
  kpi_id?: string | null;
};

export type AnalyticsKpiBreakdown = {
  dimension_label: string;
  value: number;
};

export type AnalyticsKpiHistoryPoint = {
  date: string;
  value: number;
};

export type AnalyticsKpiDetail = {
  kpi_code: string;
  current_value: number | null;
  target_value: number | null;
  breakdown: AnalyticsKpiBreakdown[];
  history: AnalyticsKpiHistoryPoint[];
};

/** Returns null for missing/invalid values — never coerces to 0. */
export function parseNullableNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function kpiMatchesPlaceholder(row: AnalyticsKpi, kpiKey: string): boolean {
  const needle = kpiKey.trim().toLowerCase();
  if (!needle) return false;
  const source = (row.source_kpi_key ?? "").toLowerCase();
  const code = row.kpi_code.toLowerCase();
  const nameSlug = row.kpi_name.toLowerCase().replace(/\s+/g, "_");
  if (source === needle || code === needle || nameSlug === needle) return true;
  if (source.endsWith(`.${needle}`)) return true;
  return source.split(/[._]/).includes(needle);
}

async function biUnwrap<T>(promise: Promise<{ data: T | null }>): Promise<T> {
  const res = await promise;
  if (res.data == null) throw new ApiClientError("Empty API response", 500);
  return res.data;
}

export async function getAnalyticsDashboard(id: string): Promise<AnalyticsDashboard> {
  return biUnwrap(resourceService.get<AnalyticsDashboard>("/analytics/dashboards", id));
}

export async function getAnalyticsReport(id: string): Promise<AnalyticsReport> {
  return biUnwrap(resourceService.get<AnalyticsReport>("/analytics/reports", id));
}

export async function getAnalyticsKpi(id: string): Promise<AnalyticsKpi> {
  return biUnwrap(resourceService.get<AnalyticsKpi>("/analytics/kpis", id));
}

export async function listAnalyticsKpis(): Promise<AnalyticsKpi[]> {
  const res = await resourceService.list<AnalyticsKpi>("/analytics/kpis", { page_size: 200 });
  return (normalizeRows(res.data) as AnalyticsKpi[]).map((row) => ({
    ...row,
    source_kpi_key: typeof row.source_kpi_key === "string" ? row.source_kpi_key : null,
    period_grain: typeof row.period_grain === "string" ? row.period_grain : null,
    current_value: parseNullableNumber(row.current_value),
    target_value: parseNullableNumber(row.target_value),
  }));
}

export async function getAnalyticsKpiDetail(id: string): Promise<AnalyticsKpiDetail> {
  const row = await biUnwrap(
    resourceService.get<AnalyticsKpiDetail>("/analytics/kpis", `${id}/detail`),
  );
  const raw = row as AnalyticsKpiDetail & { breakdown?: unknown };
  const breakdown = Array.isArray(raw.breakdown)
    ? raw.breakdown
        .filter((item): item is AnalyticsKpiBreakdown => !!item && typeof item === "object")
        .map((item) => {
          const value = parseNullableNumber(item.value);
          return {
            dimension_label: String(item.dimension_label ?? ""),
            value,
          };
        })
        .filter(
          (item): item is AnalyticsKpiBreakdown =>
            item.dimension_label !== "" && item.value != null,
        )
    : [];
  const historyRaw = (row as AnalyticsKpiDetail & { history?: unknown }).history;
  const history = Array.isArray(historyRaw)
    ? historyRaw
        .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
        .map((item) => {
          const value = parseNullableNumber(item.value);
          const date = item.date != null ? String(item.date) : "";
          return { date, value };
        })
        .filter((item): item is AnalyticsKpiHistoryPoint => item.date !== "" && item.value != null)
    : [];
  return {
    kpi_code: row.kpi_code,
    current_value: parseNullableNumber(row.current_value),
    target_value: parseNullableNumber(row.target_value),
    breakdown,
    history,
  };
}

export async function listDashboardWidgets(dashboardId: string): Promise<AnalyticsWidget[]> {
  const res = await resourceService.list<AnalyticsWidget>("/analytics/dashboard-widgets", { page_size: 200 });
  return normalizeRows(res.data).filter((r) => String(r.dashboard_id) === dashboardId) as AnalyticsWidget[];
}

export async function listReportExecutions(reportId: string): Promise<AnalyticsRow[]> {
  const res = await resourceService.list<AnalyticsRow>("/analytics/report-executions");
  return normalizeRows(res.data).filter((r) => String(r.report_id) === reportId);
}

export async function analyticsDashboardAction(
  id: string,
  action: "submit" | "approve" | "publish",
): Promise<AnalyticsDashboard> {
  return biUnwrap(resourceService.action<AnalyticsDashboard>("/analytics/dashboards", id, action));
}

export async function analyticsReportAction(
  id: string,
  action: "submit" | "approve" | "publish" | "run",
): Promise<AnalyticsReport> {
  return biUnwrap(resourceService.action<AnalyticsReport>("/analytics/reports", id, action));
}

export async function analyticsKpiAction(
  id: string,
  action: "submit" | "approve",
): Promise<AnalyticsKpi> {
  return biUnwrap(resourceService.action<AnalyticsKpi>("/analytics/kpis", id, action));
}

export async function createAnalyticsKpi(body: AnalyticsKpiWrite): Promise<AnalyticsKpi> {
  return biUnwrap(resourceService.create<AnalyticsKpi>("/analytics/kpis", body));
}

export async function updateAnalyticsKpi(
  id: string,
  body: Partial<AnalyticsKpiWrite>,
): Promise<AnalyticsKpi> {
  return biUnwrap(resourceService.update<AnalyticsKpi>("/analytics/kpis", id, body));
}

export async function createAnalyticsDashboard(
  body: AnalyticsDashboardWrite,
): Promise<AnalyticsDashboard> {
  return biUnwrap(resourceService.create<AnalyticsDashboard>("/analytics/dashboards", body));
}

export async function createDashboardWidget(body: AnalyticsWidgetWrite): Promise<AnalyticsWidget> {
  return biUnwrap(resourceService.create<AnalyticsWidget>("/analytics/dashboard-widgets", body));
}

export async function loadExecutiveKpis(): Promise<AnalyticsKpi[]> {
  const res = await resourceService.list<AnalyticsKpi>("/analytics/kpis");
  return normalizeRows(res.data) as AnalyticsKpi[];
}

export async function loadExecutiveDashboards(): Promise<AnalyticsDashboard[]> {
  const res = await resourceService.list<AnalyticsDashboard>("/analytics/dashboards");
  const rows = normalizeRows(res.data) as AnalyticsDashboard[];
  return rows.filter((d) => d.dashboard_type === "executive");
}
