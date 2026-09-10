import { ApiClientError, apiClient, resourceService } from "@/services/api-client";

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
  pfmeas: QualityRow[];
  ppaps: QualityRow[];
  scars: QualityRow[];
  recalls: QualityRow[];
  warrantyClaims: QualityRow[];
  spcReadings: QualityRow[];
  openPpaps: number;
  openScars: number;
  activeRecalls: number;
  recentWarrantyClaims: QualityRow[];
  pfmeaByStatus: Record<string, number>;
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

export function statusCountMap(rows: QualityRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const status = asStatus(row.status) || "unknown";
    out[status] = (out[status] ?? 0) + 1;
  }
  return out;
}

function recentOverviewDocs(rows: QualityRow[], limit = 8): QualityRow[] {
  return [...rows]
    .sort((a, b) =>
      String(b.created_at ?? b.document_date ?? b.document_number ?? "").localeCompare(
        String(a.created_at ?? a.document_date ?? a.document_number ?? ""),
      ),
    )
    .slice(0, limit);
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
    pfmeas,
    ppaps,
    scars,
    recalls,
    warrantyClaims,
    spcReadings,
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
    safeList("/quality/pfmeas"),
    safeList("/quality/ppaps"),
    safeList("/quality/scars"),
    safeList("/quality/recalls"),
    safeList("/quality/warranty-claims"),
    safeList("/quality/spc-readings"),
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
    pfmeas,
    ppaps,
    scars,
    recalls,
    warrantyClaims,
    spcReadings,
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
    pfmeas: pfmeas.rows,
    ppaps: ppaps.rows,
    scars: scars.rows,
    recalls: recalls.rows,
    warrantyClaims: warrantyClaims.rows,
    spcReadings: spcReadings.rows,
    openPpaps: countOpenDocs(ppaps.rows, ["approved", "rejected"]),
    openScars: countOpenDocs(scars.rows, ["closed", "cancelled"]),
    activeRecalls: countByStatus(recalls.rows, ["announced", "in_progress"]),
    recentWarrantyClaims: recentOverviewDocs(warrantyClaims.rows),
    pfmeaByStatus: statusCountMap(pfmeas.rows),
    errors,
    statusCodes,
    partial: errors.length > 0,
  };
}

export type QualityNcr = {
  id: string;
  document_number: string;
  document_date: string;
  source: string;
  severity: string;
  status: string;
  description: string | null;
  incoming_inspection_id?: string | null;
  inprocess_inspection_id?: string | null;
  final_inspection_id?: string | null;
  product_id?: string | null;
  vendor_id?: string | null;
  version: number;
};

export type QualityCapaAction = {
  id: string;
  sequence_no: number;
  action_text: string;
  status: string;
  due_date?: string | null;
};

export type QualityCapa = {
  id: string;
  document_number: string;
  document_date: string;
  ncr_id: string;
  capa_type: string;
  status: string;
  due_date: string | null;
  notes: string | null;
  version: number;
  root_causes?: { id: string; sequence_no: number; method: string; cause_text: string; status: string }[];
  corrective_actions?: QualityCapaAction[];
  preventive_actions?: QualityCapaAction[];
};

export type QualityInspectionLine = {
  id: string;
  line_number: number;
  characteristic_id: string;
  measured_value?: number | null;
  measured_text?: string | null;
  pass_fail: string | null;
  is_out_of_spec?: boolean;
  status: string;
};

export type QualityInspection = {
  id: string;
  document_number: string;
  document_date: string;
  result: string;
  status: string;
  version: number;
  company_id?: string;
  branch_id?: string;
  product_id?: string;
  vendor_id?: string;
  production_order_id?: string;
  warehouse_id?: string;
  uom_id?: string;
  inspection_plan_id?: string | null;
  inspected_qty?: number;
  accepted_qty?: number;
  rejected_qty?: number;
  lines?: QualityInspectionLine[];
};

export type QualityDefect = {
  id: string;
  document_number: string | null;
  company_id: string;
  defect_type_id: string;
  severity: string;
  quantity: number;
  description: string | null;
  source_inspection_type: string;
  incoming_inspection_id?: string | null;
  inprocess_inspection_id?: string | null;
  final_inspection_id?: string | null;
  product_id?: string | null;
  status: string;
  ncr_id: string | null;
  version: number;
};

export type QualityComplaint = {
  id: string;
  document_number: string;
  document_date: string;
  customer_id: string;
  complaint_type: string;
  quantity: number;
  description: string | null;
  status: string;
  ncr_id: string | null;
  version: number;
  company_id?: string;
};

export type QualityAudit = {
  id: string;
  company_id: string;
  document_number: string;
  document_date: string;
  audit_type: string;
  status: string;
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  version: number;
};

export type QualitySupplierScore = {
  id: string;
  company_id: string;
  branch_id: string | null;
  vendor_id: string;
  score_period_start: string;
  score_period_end: string;
  incoming_accept_rate: number | null;
  defect_rate: number | null;
  ncr_count: number | null;
  overall_score: number | null;
  status: string;
  version: number;
};

export type QmCharacteristic = {
  id: string;
  characteristic_code: string;
  characteristic_name: string;
  characteristic_type: string;
  target_value?: number | null;
  min_value?: number | null;
  max_value?: number | null;
  is_mandatory: boolean;
};

export type QmOption = { id: string; label: string; companyId?: string };

export type QualityReportSummary = {
  name: string;
  row_count: number;
  rows: Record<string, unknown>[];
};

async function unwrap<T>(promise: Promise<{ data: T | null }>): Promise<T> {
  const res = await promise;
  if (res.data == null) throw new ApiClientError("Empty API response", 500);
  return res.data;
}

export async function getQualityNcr(id: string): Promise<QualityNcr> {
  return unwrap(resourceService.get<QualityNcr>("/quality/ncrs", id));
}

export async function getQualityCapa(id: string): Promise<QualityCapa> {
  return unwrap(resourceService.get<QualityCapa>("/quality/capas", id));
}

export async function getIncomingInspection(id: string): Promise<QualityInspection> {
  return unwrap(resourceService.get<QualityInspection>("/quality/incoming-inspections", id));
}

export async function getInprocessInspection(id: string): Promise<QualityInspection> {
  return unwrap(resourceService.get<QualityInspection>("/quality/inprocess-inspections", id));
}

export async function getFinalInspection(id: string): Promise<QualityInspection> {
  return unwrap(resourceService.get<QualityInspection>("/quality/final-inspections", id));
}

export async function listQualityCapasByNcr(ncrId: string): Promise<QualityCapa[]> {
  const res = await resourceService.list<QualityCapa>("/quality/capas");
  const rows = normalizeRows(res.data);
  return rows.filter((r) => String(r.ncr_id) === ncrId) as QualityCapa[];
}

export async function listQualityDefectsByNcr(ncrId: string): Promise<QualityRow[]> {
  const res = await resourceService.list<QualityRow>("/quality/defects", { ncr_id: ncrId });
  return normalizeRows(res.data);
}

export async function qualityNcrAction(id: string, action: "submit" | "approve" | "close"): Promise<QualityNcr> {
  return unwrap(resourceService.action<QualityNcr>("/quality/ncrs", id, action));
}

export async function qualityCapaAction(
  id: string,
  action: "submit" | "approve" | "verify" | "close",
): Promise<QualityCapa> {
  return unwrap(resourceService.action<QualityCapa>("/quality/capas", id, action));
}

export async function qualityInspectionAction(
  type: "incoming" | "inprocess" | "final",
  id: string,
  action: string,
  body?: Record<string, unknown>,
): Promise<QualityInspection> {
  const base =
    type === "incoming"
      ? "/quality/incoming-inspections"
      : type === "inprocess"
        ? "/quality/inprocess-inspections"
        : "/quality/final-inspections";
  return unwrap(resourceService.action<QualityInspection>(base, id, action, body ?? {}));
}

export async function addIncomingInspectionLines(
  id: string,
  lines: Record<string, unknown>[],
): Promise<QualityInspection> {
  return unwrap(
    resourceService.action<QualityInspection>("/quality/incoming-inspections", id, "lines", {
      lines,
    }),
  );
}

export async function listQualityNcrs(): Promise<QualityNcr[]> {
  const res = await resourceService.list<QualityNcr>("/quality/ncrs");
  return normalizeRows(res.data) as QualityNcr[];
}

export async function listQualityDefects(): Promise<QualityDefect[]> {
  const res = await resourceService.list<QualityDefect>("/quality/defects");
  return normalizeRows(res.data) as QualityDefect[];
}

export async function loadQualityReports(): Promise<QualityReportSummary[]> {
  const paths = [
    "inspection-summary",
    "defect-summary",
    "ncr-summary",
    "capa-summary",
    "kpi-dashboard",
    "ppap-status-summary",
    "scar-summary",
    "spc-capability-summary",
    "warranty-trend",
  ] as const;
  const results = await Promise.all(
    paths.map(async (path) => {
      try {
        return await unwrap(apiClient<QualityReportSummary>(`/quality/reports/${path}`));
      } catch {
        return { name: path, row_count: 0, rows: [] };
      }
    }),
  );
  return results.map((r, i) => ({
    name: typeof r === "object" && r && "name" in r ? String(r.name) : paths[i],
    row_count: typeof r === "object" && r && "row_count" in r ? Number(r.row_count) : 0,
    rows:
      typeof r === "object" && r && Array.isArray((r as QualityReportSummary).rows)
        ? (r as QualityReportSummary).rows
        : [],
  }));
}

export async function getQualityDefect(id: string): Promise<QualityDefect> {
  return unwrap(resourceService.get<QualityDefect>("/quality/defects", id));
}

export async function getQualityComplaint(id: string): Promise<QualityComplaint> {
  return unwrap(resourceService.get<QualityComplaint>("/quality/complaints", id));
}

export async function getQualityAudit(id: string): Promise<QualityAudit> {
  return unwrap(resourceService.get<QualityAudit>("/quality/audits", id));
}

export async function getQualitySupplierScore(id: string): Promise<QualitySupplierScore> {
  return unwrap(resourceService.get<QualitySupplierScore>("/quality/supplier-quality", id));
}

export async function createIncomingInspection(body: Record<string, unknown>): Promise<QualityInspection> {
  return unwrap(resourceService.create<QualityInspection>("/quality/incoming-inspections", body));
}

export async function updateIncomingInspection(
  id: string,
  body: Record<string, unknown>,
): Promise<QualityInspection> {
  return unwrap(resourceService.update<QualityInspection>("/quality/incoming-inspections", id, body));
}

export async function createInprocessInspection(body: Record<string, unknown>): Promise<QualityInspection> {
  return unwrap(resourceService.create<QualityInspection>("/quality/inprocess-inspections", body));
}

export async function createFinalInspection(body: Record<string, unknown>): Promise<QualityInspection> {
  return unwrap(resourceService.create<QualityInspection>("/quality/final-inspections", body));
}

export async function createQualityNcr(body: Record<string, unknown>): Promise<QualityNcr> {
  return unwrap(resourceService.create<QualityNcr>("/quality/ncrs", body));
}

export async function createQualityCapa(body: Record<string, unknown>): Promise<QualityCapa> {
  return unwrap(resourceService.create<QualityCapa>("/quality/capas", body));
}

export async function createQualityDefect(body: Record<string, unknown>): Promise<QualityDefect> {
  return unwrap(resourceService.create<QualityDefect>("/quality/defects", body));
}

export async function createQualityComplaint(body: Record<string, unknown>): Promise<QualityComplaint> {
  return unwrap(resourceService.create<QualityComplaint>("/quality/complaints", body));
}

export async function createQualityAudit(body: Record<string, unknown>): Promise<QualityAudit> {
  return unwrap(resourceService.create<QualityAudit>("/quality/audits", body));
}

export async function getQualityPpap(id: string): Promise<QualityPpap> {
  return unwrap(resourceService.get<QualityPpap>("/quality/ppaps", id));
}

export async function createQualityPpap(body: Record<string, unknown>): Promise<QualityPpap> {
  return unwrap(resourceService.create<QualityPpap>("/quality/ppaps", body));
}

export async function qualityPpapAction(
  id: string,
  action: "submit" | "approve" | "reject" | "interim",
): Promise<QualityPpap> {
  return unwrap(resourceService.action<QualityPpap>("/quality/ppaps", id, action));
}

export type QualityScar = {
  id: string;
  company_id: string;
  branch_id: string;
  document_number: string;
  document_date: string;
  vendor_id: string;
  product_id: string | null;
  ncr_id: string | null;
  capa_id: string | null;
  severity: string;
  description: string | null;
  supplier_response: string | null;
  due_date: string | null;
  status: string;
  workflow_status: string | null;
  version: number;
};

export async function getQualityScar(id: string): Promise<QualityScar> {
  return unwrap(resourceService.get<QualityScar>("/quality/scars", id));
}

export async function createQualityScar(body: Record<string, unknown>): Promise<QualityScar> {
  return unwrap(resourceService.create<QualityScar>("/quality/scars", body));
}

export async function qualityScarAction(
  id: string,
  action: "issue" | "record-response" | "verify" | "close",
  body?: Record<string, unknown>,
): Promise<QualityScar> {
  return unwrap(resourceService.action<QualityScar>("/quality/scars", id, action, body ?? {}));
}

export type QualityVinTraceComponent = {
  id: string;
  line_number: number;
  product_id: string;
  batch_id: string | null;
  quantity: string | number;
  source_module: string | null;
  source_document_type: string | null;
  source_document_id: string | null;
};

export type QualityVinTrace = {
  id: string;
  document_number: string;
  document_date: string;
  vin: string;
  product_id: string;
  final_inspection_id: string | null;
  production_order_id: string | null;
  status: string;
  version: number;
  components: QualityVinTraceComponent[];
};

export async function getQualityVinTrace(id: string): Promise<QualityVinTrace> {
  return unwrap(resourceService.get<QualityVinTrace>("/quality/vin-traces", id));
}

export async function createQualityVinTrace(body: Record<string, unknown>): Promise<QualityVinTrace> {
  return unwrap(resourceService.create<QualityVinTrace>("/quality/vin-traces", body));
}

export type QualityWarrantyClaim = {
  id: string;
  company_id: string;
  branch_id: string;
  document_number: string;
  document_date: string;
  vin_trace_id: string;
  vin: string | null;
  customer_id: string | null;
  product_id: string;
  component_product_id: string | null;
  quantity: string | number;
  description: string | null;
  claim_type: string;
  capa_id: string | null;
  ncr_id: string | null;
  customer_complaint_id: string | null;
  status: string;
  version: number;
};

export async function getQualityWarrantyClaim(id: string): Promise<QualityWarrantyClaim> {
  return unwrap(resourceService.get<QualityWarrantyClaim>("/quality/warranty-claims", id));
}

export async function createQualityWarrantyClaim(body: Record<string, unknown>): Promise<QualityWarrantyClaim> {
  return unwrap(resourceService.create<QualityWarrantyClaim>("/quality/warranty-claims", body));
}

export async function updateQualityWarrantyClaim(
  id: string,
  body: Record<string, unknown>,
): Promise<QualityWarrantyClaim> {
  return unwrap(resourceService.update<QualityWarrantyClaim>("/quality/warranty-claims", id, body));
}

export async function qualityWarrantyClaimAction(
  id: string,
  action: "investigate" | "link-capa" | "close",
  body?: Record<string, unknown>,
): Promise<QualityWarrantyClaim> {
  return unwrap(resourceService.action<QualityWarrantyClaim>("/quality/warranty-claims", id, action, body ?? {}));
}

export type QualityRecall = {
  id: string;
  company_id: string;
  branch_id: string;
  document_number: string;
  document_date: string;
  product_id: string;
  trigger_reason: string | null;
  vin_from: string | null;
  vin_to: string | null;
  status: string;
  capa_id: string | null;
  ncr_id: string | null;
  warranty_claim_id: string | null;
  version: number;
};

export async function getQualityRecall(id: string): Promise<QualityRecall> {
  return unwrap(resourceService.get<QualityRecall>("/quality/recalls", id));
}

export async function createQualityRecall(body: Record<string, unknown>): Promise<QualityRecall> {
  return unwrap(resourceService.create<QualityRecall>("/quality/recalls", body));
}

export async function updateQualityRecall(id: string, body: Record<string, unknown>): Promise<QualityRecall> {
  return unwrap(resourceService.update<QualityRecall>("/quality/recalls", id, body));
}

export async function qualityRecallAction(
  id: string,
  action: "announce" | "close",
): Promise<QualityRecall> {
  return unwrap(resourceService.action<QualityRecall>("/quality/recalls", id, action));
}

export async function getQualityPfmea(id: string): Promise<QualityPfmea> {
  return unwrap(resourceService.get<QualityPfmea>("/quality/pfmeas", id));
}

export async function createPfmea(body: Record<string, unknown>): Promise<QualityPfmea> {
  return unwrap(resourceService.create<QualityPfmea>("/quality/pfmeas", body));
}

export type QualityPpap = {
  id: string;
  company_id: string;
  branch_id: string;
  document_number: string;
  document_date: string;
  vendor_id: string;
  product_id: string;
  submission_level: string;
  status: string;
  inspection_plan_id: string;
  pfmea_id: string | null;
  workflow_status: string | null;
  notes: string | null;
  version: number;
};

export type QualityPfmeaLine = {
  id: string;
  sequence_no: number;
  process_step: string | null;
  failure_mode: string | null;
  failure_effect: string | null;
  failure_cause: string | null;
  severity: number;
  occurrence: number;
  detection: number;
  rpn: number;
  characteristic_id: string | null;
  recommended_action: string | null;
  status: string;
};

export type QualityPfmea = {
  id: string;
  company_id: string;
  pfmea_code: string;
  pfmea_name: string;
  inspection_plan_id: string;
  product_id: string | null;
  process_name: string | null;
  revision: string | null;
  status: string;
  notes: string | null;
  lines: QualityPfmeaLine[];
  version: number;
};

export type QualityInspectionPlan = {
  id: string;
  company_id: string;
  plan_code: string;
  plan_name: string;
  inspection_type: string;
  product_id: string | null;
  sampling_plan_id: string | null;
  revision?: string | null;
  process_name?: string | null;
  status: string;
  notes: string | null;
  version: number;
};

export type QualityScore = {
  id: string;
  score_code: string | null;
  score_dimension: string;
  period_start: string;
  period_end: string;
  first_pass_yield: number | null;
  defect_rate: number | null;
  status: string;
  version: number;
};

export async function getInspectionPlan(id: string): Promise<QualityInspectionPlan> {
  return unwrap(resourceService.get<QualityInspectionPlan>("/quality/plans", id));
}

export async function createInspectionPlan(body: Record<string, unknown>): Promise<QualityInspectionPlan> {
  return unwrap(resourceService.create<QualityInspectionPlan>("/quality/plans", body));
}

export async function activateInspectionPlan(id: string): Promise<QualityInspectionPlan> {
  return unwrap(resourceService.action<QualityInspectionPlan>("/quality/plans", id, "activate"));
}

export async function getMasterRecord(apiPath: string, id: string): Promise<QualityRow> {
  try {
    return (await unwrap(resourceService.get<QualityRow>(apiPath, id))) as QualityRow;
  } catch {
    const res = await resourceService.list(apiPath);
    const rows = normalizeRows(res.data);
    const row = rows.find((r) => String(r.id) === id);
    if (!row) throw new ApiClientError("Record not found", 404);
    return row;
  }
}

export async function qualityScoreAction(
  id: string,
  action: "publish",
  body?: Record<string, unknown>,
): Promise<QualityScore> {
  return unwrap(resourceService.action<QualityScore>("/quality/scores", id, action, body ?? {}));
}

export async function createQualitySupplierScore(
  body: Record<string, unknown>,
): Promise<QualitySupplierScore> {
  return unwrap(resourceService.create<QualitySupplierScore>("/quality/supplier-quality", body));
}

export async function createSamplingPlan(body: Record<string, unknown>): Promise<QualityRow> {
  return unwrap(resourceService.create<QualityRow>("/quality/sampling-plans", body));
}

export async function createCharacteristic(body: Record<string, unknown>): Promise<QmCharacteristic> {
  return unwrap(resourceService.create<QmCharacteristic>("/quality/characteristics", body));
}

export async function createDefectType(body: Record<string, unknown>): Promise<QualityRow> {
  return unwrap(resourceService.create<QualityRow>("/quality/defect-types", body));
}

export async function createQualityScore(body: Record<string, unknown>): Promise<QualityScore> {
  return unwrap(resourceService.create<QualityScore>("/quality/scores", body));
}

export async function qualityComplaintAction(
  id: string,
  action: "investigate" | "close",
): Promise<QualityComplaint> {
  return unwrap(resourceService.action<QualityComplaint>("/quality/complaints", id, action));
}

export async function qualityAuditAction(
  id: string,
  action: "start" | "complete" | "close",
): Promise<QualityAudit> {
  return unwrap(resourceService.action<QualityAudit>("/quality/audits", id, action));
}

export async function qualitySupplierScoreAction(
  id: string,
  action: "publish",
): Promise<QualitySupplierScore> {
  return unwrap(resourceService.action<QualitySupplierScore>("/quality/supplier-quality", id, action));
}

export async function linkDefectToNcr(defectId: string, ncrId: string): Promise<QualityDefect> {
  return unwrap(
    resourceService.action<QualityDefect>("/quality/defects", defectId, "link-ncr", { ncr_id: ncrId }),
  );
}

export async function listQmCharacteristics(planId?: string): Promise<QmCharacteristic[]> {
  const res = await resourceService.list<QmCharacteristic>("/quality/characteristics", {
    inspection_plan_id: planId,
  });
  return normalizeRows(res.data) as QmCharacteristic[];
}

export async function loadQmOptions(): Promise<{
  companies: QmOption[];
  branches: QmOption[];
  products: QmOption[];
  warehouses: QmOption[];
  uoms: QmOption[];
  vendors: QmOption[];
  customers: QmOption[];
  defectTypes: QmOption[];
  inspectionPlans: QmOption[];
  productionOrders: QmOption[];
  ncrs: QmOption[];
  pfmeas: QmOption[];
  capas: QmOption[];
  vinTraces: QmOption[];
  complaints: QmOption[];
  warrantyClaims: QmOption[];
}> {
  const paths = [
    "/companies",
    "/branches",
    "/products",
    "/warehouses",
    "/uoms",
    "/vendors",
    "/customers",
    "/quality/defect-types",
    "/quality/plans",
    "/manufacturing/production-orders",
    "/quality/ncrs",
    "/quality/pfmeas",
    "/quality/capas",
    "/quality/vin-traces",
    "/quality/complaints",
    "/quality/warranty-claims",
  ] as const;
  const labelKeys: Record<string, string[]> = {
    "/companies": ["company_name", "legal_name", "name"],
    "/branches": ["branch_name", "name"],
    "/products": ["product_name", "product_code", "name"],
    "/warehouses": ["warehouse_name", "name"],
    "/uoms": ["uom_name", "uom_code", "name"],
    "/vendors": ["vendor_name", "name"],
    "/customers": ["customer_name", "name"],
    "/quality/defect-types": ["defect_type_name", "defect_type_code", "name"],
    "/quality/plans": ["plan_name", "plan_code", "name"],
    "/manufacturing/production-orders": ["document_number", "order_number", "name"],
    "/quality/ncrs": ["document_number", "name"],
    "/quality/pfmeas": ["pfmea_name", "pfmea_code", "name"],
    "/quality/capas": ["document_number", "name"],
    "/quality/vin-traces": ["vin", "document_number"],
    "/quality/complaints": ["document_number", "name"],
    "/quality/warranty-claims": ["document_number", "vin"],
  };

  const results = await Promise.allSettled(paths.map((p) => resourceService.list(p)));

  const toOptions = (path: string, settled: PromiseSettledResult<{ data: unknown }>): QmOption[] => {
    if (settled.status !== "fulfilled") return [];
    const list = normalizeRows(settled.value.data);
    const keys = labelKeys[path] ?? ["name"];
    return list.map((row) => {
      const companyId = row.company_id != null ? String(row.company_id) : undefined;
      const companyCode = typeof row.company_code === "string" ? row.company_code : "";
      const label =
        keys.map((k) => row[k]).find((v) => typeof v === "string" && v) ?? String(row.id);
      const tagged =
        path === "/quality/ncrs" && companyCode ? `${String(label)} (${companyCode})` : String(label);
      return { id: String(row.id), label: tagged, companyId };
    });
  };

  const companies = toOptions(paths[0], results[0]);
  const companyLabel = new Map(companies.map((c) => [c.id, c.label]));
  const ncrs = toOptions(paths[10], results[10]).map((n) => {
    const plant = n.companyId ? companyLabel.get(n.companyId) : undefined;
    return plant && !n.label.includes(plant) ? { ...n, label: `${n.label} · ${plant}` } : n;
  });

  return {
    companies,
    branches: toOptions(paths[1], results[1]),
    products: toOptions(paths[2], results[2]),
    warehouses: toOptions(paths[3], results[3]),
    uoms: toOptions(paths[4], results[4]),
    vendors: toOptions(paths[5], results[5]),
    customers: toOptions(paths[6], results[6]),
    defectTypes: toOptions(paths[7], results[7]),
    inspectionPlans: toOptions(paths[8], results[8]),
    productionOrders: toOptions(paths[9], results[9]),
    ncrs,
    pfmeas: toOptions(paths[11], results[11]),
    capas: toOptions(paths[12], results[12]),
    vinTraces: toOptions(paths[13], results[13]),
    complaints: toOptions(paths[14], results[14]),
    warrantyClaims: toOptions(paths[15], results[15]),
  };
}

export function exportReportCsv(report: QualityReportSummary): void {
  if (!report.rows.length) return;
  const headers = Object.keys(report.rows[0]);
  const lines = [
    headers.join(","),
    ...report.rows.map((row) =>
      headers.map((h) => JSON.stringify(row[h] ?? "")).join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${report.name.replace(/\s+/g, "-")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
