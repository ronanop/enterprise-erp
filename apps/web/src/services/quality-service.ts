import { ApiClientError, resourceService } from "@/services/api-client";

export type QualityRow = Record<string, unknown>;

export type QualityOverview = {
  plans: QualityRow[];
  samplingPlans: QualityRow[];
  characteristics: QualityRow[];
  defectTypes: QualityRow[];
  incoming: QualityRow[];
  inprocess: QualityRow[];
  final: QualityRow[];
  defects: QualityRow[];
  ncrs: QualityRow[];
  capas: QualityRow[];
  supplierQuality: QualityRow[];
  complaints: QualityRow[];
  audits: QualityRow[];
  scores: QualityRow[];
  errors: string[];
  statusCodes: number[];
  partial: boolean;
};

function normalizeRows(data: unknown): QualityRow[] {
  if (Array.isArray(data)) {
    return data.filter((row): row is QualityRow => !!row && typeof row === "object");
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
): Promise<{ rows: QualityRow[]; error?: string; status?: number }> {
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

export function countByStatus(rows: QualityRow[], statuses: string[]): number {
  const set = new Set(statuses.map((s) => s.toLowerCase()));
  return rows.filter((row) => set.has(asStatus(row.status))).length;
}

export function countBySeverity(rows: QualityRow[], severities: string[]): number {
  const set = new Set(severities.map((s) => s.toLowerCase()));
  return rows.filter((row) => set.has(asStatus(row.severity))).length;
}

export function countOpenDocs(rows: QualityRow[], closedStatuses: string[]): number {
  const closed = new Set(closedStatuses.map((s) => s.toLowerCase()));
  return rows.filter((row) => {
    const status = asStatus(row.status);
    if (!status) return true;
    return !closed.has(status);
  }).length;
}

export function countRejectedResults(rows: QualityRow[]): number {
  return rows.filter((row) => {
    const result = asStatus(row.result);
    return result === "rejected" || result === "rework_required";
  }).length;
}

export async function loadQualityOverview(): Promise<QualityOverview> {
  const [
    plans,
    samplingPlans,
    characteristics,
    defectTypes,
    incoming,
    inprocess,
    final,
    defects,
    ncrs,
    capas,
    supplierQuality,
    complaints,
    audits,
    scores,
  ] = await Promise.all([
    safeList("/quality/plans"),
    safeList("/quality/sampling-plans"),
    safeList("/quality/characteristics"),
    safeList("/quality/defect-types"),
    safeList("/quality/incoming-inspections"),
    safeList("/quality/inprocess-inspections"),
    safeList("/quality/final-inspections"),
    safeList("/quality/defects"),
    safeList("/quality/ncrs"),
    safeList("/quality/capas"),
    safeList("/quality/supplier-quality"),
    safeList("/quality/complaints"),
    safeList("/quality/audits"),
    safeList("/quality/scores"),
  ]);

  const results = [
    plans,
    samplingPlans,
    characteristics,
    defectTypes,
    incoming,
    inprocess,
    final,
    defects,
    ncrs,
    capas,
    supplierQuality,
    complaints,
    audits,
    scores,
  ];
  const errors = results.map((r) => r.error).filter((e): e is string => Boolean(e));
  const statusCodes = results
    .map((r) => r.status)
    .filter((s): s is number => typeof s === "number");

  return {
    plans: plans.rows,
    samplingPlans: samplingPlans.rows,
    characteristics: characteristics.rows,
    defectTypes: defectTypes.rows,
    incoming: incoming.rows,
    inprocess: inprocess.rows,
    final: final.rows,
    defects: defects.rows,
    ncrs: ncrs.rows,
    capas: capas.rows,
    supplierQuality: supplierQuality.rows,
    complaints: complaints.rows,
    audits: audits.rows,
    scores: scores.rows,
    errors,
    statusCodes,
    partial: errors.length > 0,
  };
}
