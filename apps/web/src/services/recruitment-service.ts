import { ApiClientError, resourceService } from "@/services/api-client";

export type RecruitmentRow = Record<string, unknown>;

export type RecruitmentOverview = {
  requisitions: RecruitmentRow[];
  postings: RecruitmentRow[];
  sources: RecruitmentRow[];
  recruiters: RecruitmentRow[];
  candidates: RecruitmentRow[];
  applications: RecruitmentRow[];
  stages: RecruitmentRow[];
  interviews: RecruitmentRow[];
  feedback: RecruitmentRow[];
  offers: RecruitmentRow[];
  bgv: RecruitmentRow[];
  talentPools: RecruitmentRow[];
  onboarding: RecruitmentRow[];
  onboardingTasks: RecruitmentRow[];
  errors: string[];
  statusCodes: number[];
  partial: boolean;
};

function normalizeRows(data: unknown): RecruitmentRow[] {
  if (Array.isArray(data)) {
    return data.filter(
      (row): row is RecruitmentRow => !!row && typeof row === "object",
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
): Promise<{ rows: RecruitmentRow[]; error?: string; status?: number }> {
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

export function sumField(rows: RecruitmentRow[], field: string): number {
  return rows.reduce((sum, row) => sum + asNumber(row[field]), 0);
}

export function countByStatus(rows: RecruitmentRow[], statuses: string[]): number {
  const set = new Set(statuses.map((s) => s.toLowerCase()));
  return rows.filter((row) => set.has(asStatus(row.status))).length;
}

export function countOpenDocs(
  rows: RecruitmentRow[],
  closedStatuses: string[],
): number {
  const closed = new Set(closedStatuses.map((s) => s.toLowerCase()));
  return rows.filter((row) => {
    const status = asStatus(row.status);
    if (!status) return true;
    return !closed.has(status);
  }).length;
}

export function candidateDisplayName(row: RecruitmentRow): string {
  const full = row.full_name;
  if (typeof full === "string" && full.trim()) return full;
  const first = typeof row.first_name === "string" ? row.first_name : "";
  const last = typeof row.last_name === "string" ? row.last_name : "";
  const joined = `${first} ${last}`.trim();
  return joined || String(row.candidate_code ?? row.document_number ?? "—");
}

export async function loadRecruitmentOverview(): Promise<RecruitmentOverview> {
  const [
    requisitions,
    postings,
    sources,
    recruiters,
    candidates,
    applications,
    stages,
    interviews,
    feedback,
    offers,
    bgv,
    talentPools,
    onboarding,
    onboardingTasks,
  ] = await Promise.all([
    safeList("/recruitment/job-requisitions"),
    safeList("/recruitment/job-postings"),
    safeList("/recruitment/recruitment-sources"),
    safeList("/recruitment/recruiters"),
    safeList("/recruitment/candidates"),
    safeList("/recruitment/applications"),
    safeList("/recruitment/application-stages"),
    safeList("/recruitment/interviews"),
    safeList("/recruitment/interview-feedback"),
    safeList("/recruitment/offers"),
    safeList("/recruitment/background-verifications"),
    safeList("/recruitment/talent-pools"),
    safeList("/recruitment/onboarding"),
    safeList("/recruitment/onboarding-tasks"),
  ]);

  const results = [
    requisitions,
    postings,
    sources,
    recruiters,
    candidates,
    applications,
    stages,
    interviews,
    feedback,
    offers,
    bgv,
    talentPools,
    onboarding,
    onboardingTasks,
  ];
  const errors = results.map((r) => r.error).filter((e): e is string => Boolean(e));
  const statusCodes = results
    .map((r) => r.status)
    .filter((s): s is number => typeof s === "number");

  return {
    requisitions: requisitions.rows,
    postings: postings.rows,
    sources: sources.rows,
    recruiters: recruiters.rows,
    candidates: candidates.rows,
    applications: applications.rows,
    stages: stages.rows,
    interviews: interviews.rows,
    feedback: feedback.rows,
    offers: offers.rows,
    bgv: bgv.rows,
    talentPools: talentPools.rows,
    onboarding: onboarding.rows,
    onboardingTasks: onboardingTasks.rows,
    errors,
    statusCodes,
    partial: errors.length > 0,
  };
}
