import { ApiClientError, resourceService } from "@/services/api-client";

export type GrcRow = Record<string, unknown>;

export type GrcOverview = {
  policies: GrcRow[];
  policyVersions: GrcRow[];
  controls: GrcRow[];
  controlTests: GrcRow[];
  riskCategories: GrcRow[];
  risks: GrcRow[];
  riskAssessments: GrcRow[];
  riskTreatments: GrcRow[];
  frameworks: GrcRow[];
  complianceAssessments: GrcRow[];
  auditPlans: GrcRow[];
  audits: GrcRow[];
  findings: GrcRow[];
  correctiveActions: GrcRow[];
  exceptions: GrcRow[];
  incidents: GrcRow[];
  errors: string[];
  statusCodes: number[];
  partial: boolean;
};

function normalizeRows(data: unknown): GrcRow[] {
  if (Array.isArray(data)) {
    return data.filter(
      (row): row is GrcRow => !!row && typeof row === "object",
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
): Promise<{ rows: GrcRow[]; error?: string; status?: number }> {
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

export function countByStatus(rows: GrcRow[], statuses: string[]): number {
  const set = new Set(statuses.map((s) => s.toLowerCase()));
  return rows.filter((row) => set.has(asStatus(row.status))).length;
}

export function countOpenDocs(
  rows: GrcRow[],
  closedStatuses: string[],
): number {
  const closed = new Set(closedStatuses.map((s) => s.toLowerCase()));
  return rows.filter((row) => {
    const status = asStatus(row.status);
    if (!status) return true;
    return !closed.has(status);
  }).length;
}

export async function loadGrcOverview(): Promise<GrcOverview> {
  const [
    policies,
    policyVersions,
    controls,
    controlTests,
    riskCategories,
    risks,
    riskAssessments,
    riskTreatments,
    frameworks,
    complianceAssessments,
    auditPlans,
    audits,
    findings,
    correctiveActions,
    exceptions,
    incidents,
  ] = await Promise.all([
    safeList("/grc/policies"),
    safeList("/grc/policy-versions"),
    safeList("/grc/controls"),
    safeList("/grc/control-tests"),
    safeList("/grc/risk-categories"),
    safeList("/grc/risk-registers"),
    safeList("/grc/risk-assessments"),
    safeList("/grc/risk-treatments"),
    safeList("/grc/compliance-frameworks"),
    safeList("/grc/compliance-assessments"),
    safeList("/grc/audit-plans"),
    safeList("/grc/audits"),
    safeList("/grc/audit-findings"),
    safeList("/grc/corrective-actions"),
    safeList("/grc/exceptions"),
    safeList("/grc/incidents"),
  ]);

  const results = [
    policies,
    policyVersions,
    controls,
    controlTests,
    riskCategories,
    risks,
    riskAssessments,
    riskTreatments,
    frameworks,
    complianceAssessments,
    auditPlans,
    audits,
    findings,
    correctiveActions,
    exceptions,
    incidents,
  ];
  const errors = results.map((r) => r.error).filter((e): e is string => Boolean(e));
  const statusCodes = results
    .map((r) => r.status)
    .filter((s): s is number => typeof s === "number");

  return {
    policies: policies.rows,
    policyVersions: policyVersions.rows,
    controls: controls.rows,
    controlTests: controlTests.rows,
    riskCategories: riskCategories.rows,
    risks: risks.rows,
    riskAssessments: riskAssessments.rows,
    riskTreatments: riskTreatments.rows,
    frameworks: frameworks.rows,
    complianceAssessments: complianceAssessments.rows,
    auditPlans: auditPlans.rows,
    audits: audits.rows,
    findings: findings.rows,
    correctiveActions: correctiveActions.rows,
    exceptions: exceptions.rows,
    incidents: incidents.rows,
    errors,
    statusCodes,
    partial: errors.length > 0,
  };
}
