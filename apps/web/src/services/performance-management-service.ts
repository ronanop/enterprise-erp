/**
 * Enterprise Performance Management service — local rich store + HR API merge.
 */

import { loadHrOverview } from "@/services/hr-service";
import { loadHrMasterDirectory, type HrMasterOption } from "@/services/hr-master-connector";
import { resourceService } from "@/services/api-client";
import type {
  AppraisalRecord,
  ContinuousFeedback,
  KpiDefinition,
  OkrObjective,
  OneOnOneMeeting,
  PerformanceAudit,
  PerformanceFilters,
  PerformanceGoal,
  PerformanceReview,
  PipPlan,
  ProbationCase,
  ReviewCycle,
} from "@/types/performance-management";

const KEYS = {
  goals: "erp_pms_goals_v1",
  kpis: "erp_pms_kpis_v1",
  okrs: "erp_pms_okrs_v1",
  cycles: "erp_pms_cycles_v1",
  reviews: "erp_pms_reviews_v1",
  feedback: "erp_pms_feedback_v1",
  meetings: "erp_pms_meetings_v1",
  probation: "erp_pms_probation_v1",
  pips: "erp_pms_pips_v1",
  appraisals: "erp_pms_appraisals_v1",
  audit: "erp_pms_audit_v1",
  seq: "erp_pms_seq_v1",
} as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readBranchId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  for (const key of ["erp_org_context_v1", "erp_ats_api_context_v1", "erp_pay_api_context_v1"]) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { branchId?: string };
      if (parsed.branchId && UUID_RE.test(parsed.branchId)) return parsed.branchId;
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

type Seq = { goal: number; review: number; appraisal: number };

function actor(): string {
  if (typeof window === "undefined") return "HR User";
  try {
    const raw = localStorage.getItem("erp_user_profile");
    if (raw) {
      const p = JSON.parse(raw) as { email?: string; full_name?: string };
      return p.full_name || p.email || "HR User";
    }
  } catch {
    /* ignore */
  }
  return "HR User";
}

function nowIso(): string {
  return new Date().toISOString();
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

function nextCode(kind: keyof Seq, prefix: string): string {
  const seq = readJson<Seq>(KEYS.seq, { goal: 0, review: 0, appraisal: 0 });
  seq[kind] += 1;
  writeJson(KEYS.seq, seq);
  return `${prefix}-${String(seq[kind]).padStart(6, "0")}`;
}

export function appendPmsAudit(entry: Omit<PerformanceAudit, "id" | "at">): void {
  const all = readJson<PerformanceAudit[]>(KEYS.audit, []);
  all.unshift({ ...entry, id: crypto.randomUUID(), at: nowIso() });
  writeJson(KEYS.audit, all.slice(0, 5000));
}

export function listPmsAudit(): PerformanceAudit[] {
  return readJson<PerformanceAudit[]>(KEYS.audit, []);
}

function load<T>(key: string): T[] {
  return readJson<T[]>(key, []);
}
function save<T>(key: string, rows: T[]) {
  writeJson(key, rows);
}

export type PerformanceDirectory = {
  goals: PerformanceGoal[];
  kpis: KpiDefinition[];
  okrs: OkrObjective[];
  cycles: ReviewCycle[];
  reviews: PerformanceReview[];
  feedback: ContinuousFeedback[];
  meetings: OneOnOneMeeting[];
  probation: ProbationCase[];
  pips: PipPlan[];
  appraisals: AppraisalRecord[];
  departments: string[];
  employees: HrMasterOption[];
};

export async function loadPerformanceDirectory(): Promise<PerformanceDirectory> {
  let goals = load<PerformanceGoal>(KEYS.goals);
  let reviews = load<PerformanceReview>(KEYS.reviews);
  let appraisals = load<AppraisalRecord>(KEYS.appraisals);
  let employees: HrMasterOption[] = [];
  let departments: string[] = [];

  try {
    const master = await loadHrMasterDirectory();
    employees = master.employees;
    departments = master.departments.map((d) => d.label);
  } catch {
    /* fall through */
  }

  try {
    const overview = await loadHrOverview();
    if (employees.length === 0) {
      for (const e of overview.profiles ?? []) {
        const name = String(e.full_name ?? e.display_name ?? "").trim();
        if (name) {
          employees.push({
            id: String(e.id ?? e.employee_id ?? name),
            label: name,
            code: String(e.employee_code ?? ""),
            department: String(e.department_name ?? ""),
          });
        }
      }
    }
    if (overview.goals.length) {
      const localOnly = goals.filter((g) => !UUID_RE.test(g.id));
      goals = [
        ...overview.goals.map((g, i) => ({
        id: String(g.id ?? crypto.randomUUID()),
        goalCode: String(g.document_number ?? g.goal_code ?? `GOL-${String(i + 1).padStart(6, "0")}`),
        title: String(g.goal_title ?? g.title ?? "Goal"),
        description: String(g.description ?? ""),
        goalType: "individual" as const,
        category: "kpi" as const,
        employeeName: String(g.employee_name ?? g.employee_id ?? "Employee"),
        assignedBy: actor(),
        department: String(g.department_name ?? "—"),
        priority: "medium" as const,
        weightage: Number(g.weightage ?? 10),
        targetValue: Number(g.target_value ?? 100),
        currentProgress: Number(g.progress_pct ?? g.current_value ?? 0),
        startDate: String(g.start_date ?? "").slice(0, 10),
        dueDate: String(g.due_date ?? g.end_date ?? "").slice(0, 10),
        status: String(g.status ?? "in_progress").toLowerCase().includes("complete")
          ? ("completed" as const)
          : String(g.status ?? "").toLowerCase().includes("draft")
            ? ("draft" as const)
            : ("in_progress" as const),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      })),
        ...localOnly,
      ];
      save(KEYS.goals, goals);
    }
    if (overview.reviews.length) {
      const localOnly = reviews.filter((r) => !UUID_RE.test(r.id));
      reviews = [
        ...overview.reviews.map((r, i) => ({
        id: String(r.id ?? crypto.randomUUID()),
        reviewCode: String(r.document_number ?? `REV-${String(i + 1).padStart(6, "0")}`),
        cycleId: "",
        employeeName: String(r.employee_name ?? r.employee_id ?? "Employee"),
        managerName: String(r.manager_name ?? "Reporting manager"),
        reviewerName: "",
        hrName: "HR",
        selfAssessment: "",
        managerAssessment: "",
        peerReview: "",
        finalComments: "",
        overallRating: Number(r.overall_rating ?? 0),
        recommendation: "none" as const,
        status: String(r.status ?? "draft").toLowerCase().includes("approv")
          ? ("completed" as const)
          : String(r.status ?? "").toLowerCase().includes("submit")
            ? ("manager_pending" as const)
            : ("draft" as const),
        attachmentName: "",
        createdAt: nowIso(),
        updatedAt: nowIso(),
      })),
        ...localOnly,
      ];
      save(KEYS.reviews, reviews);
    }
    if (overview.appraisals.length) {
      const localOnly = appraisals.filter((a) => !UUID_RE.test(a.id));
      appraisals = [
        ...overview.appraisals.map((a, i) => ({
        id: String(a.id ?? crypto.randomUUID()),
        appraisalCode: String(a.document_number ?? `APR-${String(i + 1).padStart(6, "0")}`),
        employeeName: String(a.employee_name ?? a.employee_id ?? "Employee"),
        cycleName: String(a.cycle_name ?? "Annual"),
        salaryRecommendation: "",
        promotionRecommendation: "",
        bonusRecommendation: "",
        trainingRecommendation: "",
        workflowStage: String(a.status ?? "").toLowerCase().includes("approv")
          ? ("approved" as const)
          : ("manager" as const),
        overallRating: Number(a.overall_rating ?? 0),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      })),
        ...localOnly,
      ];
      save(KEYS.appraisals, appraisals);
    }
  } catch {
    /* offline */
  }

  let kpis = load<KpiDefinition>(KEYS.kpis);
  let okrs = load<OkrObjective>(KEYS.okrs);
  try {
    const [kpiRes, okrRes] = await Promise.all([
      resourceService.list("/hr/kpis", { page_size: 200 }).catch(() => ({ data: [] })),
      resourceService.list("/hr/okrs", { page_size: 200 }).catch(() => ({ data: [] })),
    ]);
    const kpiRows = (Array.isArray(kpiRes.data) ? kpiRes.data : []) as Record<string, unknown>[];
    if (kpiRows.length) {
      const localOnly = kpis.filter((k) => !UUID_RE.test(k.id));
      kpis = [
        ...kpiRows.map((k) => ({
          id: String(k.id),
          name: String(k.name ?? ""),
          department: String(k.department ?? ""),
          designation: String(k.designation ?? ""),
          weightage: Number(k.weightage ?? 0),
          target: Number(k.target ?? 0),
          measureType: (String(k.measure_type ?? "number") === "percentage"
            ? "percentage"
            : String(k.measure_type ?? "") === "currency"
              ? "currency"
              : "number") as KpiDefinition["measureType"],
          ratingScale: Number(k.rating_scale ?? 5),
          createdAt: String(k.created_at ?? nowIso()),
        })),
        ...localOnly,
      ];
      save(KEYS.kpis, kpis);
    }
    const okrRows = (Array.isArray(okrRes.data) ? okrRes.data : []) as Record<string, unknown>[];
    if (okrRows.length) {
      const localOnly = okrs.filter((o) => !UUID_RE.test(o.id));
      okrs = [
        ...okrRows.map((o) => ({
          id: String(o.id),
          title: String(o.title ?? ""),
          owner: String(o.owner ?? ""),
          department: String(o.department ?? ""),
          weightage: Number(o.weightage ?? 0),
          progressPct: Number(o.progress_pct ?? 0),
          keyResults: (Array.isArray(o.key_results) ? o.key_results : []).map(
            (kr: Record<string, unknown>) => ({
              id: String(kr.id ?? crypto.randomUUID()),
              title: String(kr.title ?? ""),
              progressPct: Number(kr.progress_pct ?? 0),
              weightage: Number(kr.weightage ?? 1),
            }),
          ),
          createdAt: String(o.created_at ?? nowIso()),
        })),
        ...localOnly,
      ];
      save(KEYS.okrs, okrs);
    }
  } catch {
    /* offline */
  }

  const goalDepts = Array.from(
    new Set(
      [
        ...departments,
        ...goals.map((g) => g.department),
        ...kpis.map((k) => k.department),
      ].filter((d) => d && d !== "—"),
    ),
  ).sort();

  return {
    goals,
    kpis,
    okrs,
    cycles: load(KEYS.cycles),
    reviews,
    feedback: load(KEYS.feedback),
    meetings: load(KEYS.meetings),
    probation: load(KEYS.probation),
    pips: load(KEYS.pips),
    appraisals,
    departments: goalDepts,
    employees,
  };
}

export function computePerformanceStats(dir: PerformanceDirectory) {
  const upcoming = dir.reviews.filter(
    (r) => !["completed", "cancelled"].includes(r.status),
  ).length;
  return {
    activeCycles: dir.cycles.filter((c) => c.status === "active").length,
    goalsAssigned: dir.goals.length,
    goalsCompleted: dir.goals.filter((g) => g.status === "completed").length,
    pendingReviews: dir.reviews.filter((r) =>
      ["draft", "self_pending", "manager_pending", "hr_pending"].includes(r.status),
    ).length,
    completedReviews: dir.reviews.filter((r) => r.status === "completed").length,
    highPerformers: dir.reviews.filter((r) => r.overallRating >= 4 && r.status === "completed").length,
    onPip: dir.pips.filter((p) => p.status === "active").length,
    upcomingReviews: upcoming,
  };
}

export async function createGoal(
  input: Omit<PerformanceGoal, "id" | "goalCode" | "createdAt" | "updatedAt">,
): Promise<PerformanceGoal> {
  const row: PerformanceGoal = {
    ...input,
    id: crypto.randomUUID(),
    goalCode: nextCode("goal", "GOL"),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  try {
    const branchId = readBranchId();
    const employeeId = input.employeeId && UUID_RE.test(input.employeeId) ? input.employeeId : undefined;
    let reviewId =
      input.performanceReviewId && UUID_RE.test(input.performanceReviewId)
        ? input.performanceReviewId
        : load<PerformanceReview>(KEYS.reviews).find(
            (r) => UUID_RE.test(r.id) && (!employeeId || r.employeeId === employeeId),
          )?.id;

    if (branchId && employeeId && !reviewId) {
      const today = nowIso().slice(0, 10);
      const yearStart = `${today.slice(0, 4)}-01-01`;
      const yearEnd = `${today.slice(0, 4)}-12-31`;
      const reviewRes = await resourceService.create<Record<string, unknown>>("/hr/performance-reviews", {
        branch_id: branchId,
        employee_id: employeeId,
        reviewer_employee_id: employeeId,
        review_cycle: "Goal cycle",
        period_start: input.startDate || yearStart,
        period_end: input.dueDate || yearEnd,
      });
      reviewId = String(reviewRes.data?.id ?? "");
      if (reviewId) {
        const reviewRow: PerformanceReview = {
          id: reviewId,
          reviewCode: String(reviewRes.data?.document_number ?? nextCode("review", "REV")),
          cycleId: "",
          employeeId,
          employeeName: input.employeeName,
          managerName: input.assignedBy,
          reviewerEmployeeId: employeeId,
          reviewerName: input.assignedBy,
          hrName: "HR",
          selfAssessment: "",
          managerAssessment: "",
          peerReview: "",
          finalComments: "",
          overallRating: 0,
          recommendation: "none",
          status: "draft",
          attachmentName: "",
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        const reviews = load<PerformanceReview>(KEYS.reviews);
        reviews.unshift(reviewRow);
        save(KEYS.reviews, reviews);
      }
    }

    if (reviewId && UUID_RE.test(reviewId)) {
      const seq = load<PerformanceGoal>(KEYS.goals).filter((g) => g.performanceReviewId === reviewId).length + 1;
      const res = await resourceService.create<Record<string, unknown>>("/hr/goals", {
        performance_review_id: reviewId,
        employee_id: employeeId || null,
        sequence_no: seq,
        goal_title: input.title,
        goal_description: input.description || null,
        target_value: input.targetValue,
        actual_value: input.currentProgress,
        weight_percent: input.weightage,
      });
      const apiId = String(res.data?.id ?? "");
      if (apiId) {
        row.id = apiId;
        row.performanceReviewId = reviewId;
        row.employeeId = employeeId;
        row.goalCode = String(res.data?.document_number ?? row.goalCode);
      }
    }
  } catch (err) {
    console.warn("createGoal API failed; local cache kept", err);
  }
  const all = load<PerformanceGoal>(KEYS.goals);
  all.unshift(row);
  save(KEYS.goals, all);
  appendPmsAudit({ action: "goal_created", detail: `${row.goalCode} — ${row.title}`, actor: actor() });
  return row;
}

export function updateGoalProgress(id: string, progress: number, status?: PerformanceGoal["status"]) {
  const all = load<PerformanceGoal>(KEYS.goals);
  const idx = all.findIndex((g) => g.id === id);
  if (idx < 0) return null;
  all[idx] = {
    ...all[idx],
    currentProgress: progress,
    status: status ?? (progress >= all[idx].targetValue ? "completed" : all[idx].status),
    updatedAt: nowIso(),
  };
  save(KEYS.goals, all);
  appendPmsAudit({
    action: "goal_updated",
    detail: `${all[idx].goalCode} progress ${progress}`,
    actor: actor(),
  });
  return all[idx];
}

export async function createKpi(
  input: Omit<KpiDefinition, "id" | "createdAt">,
): Promise<KpiDefinition> {
  const row: KpiDefinition = { ...input, id: crypto.randomUUID(), createdAt: nowIso() };
  try {
    const branchId = readBranchId();
    if (branchId) {
      const measure =
        input.measureType === "percentage"
          ? "percentage"
          : input.measureType === "currency"
            ? "currency"
            : "number";
      const res = await resourceService.create<Record<string, unknown>>("/hr/kpis", {
        branch_id: branchId,
        name: input.name,
        department: input.department || "",
        designation: input.designation || null,
        weightage: input.weightage,
        target: input.target,
        measure_type: measure,
        rating_scale: input.ratingScale || 5,
        status: "active",
      });
      const apiId = String(res.data?.id ?? "");
      if (apiId) {
        row.id = apiId;
        row.createdAt = String(res.data?.created_at ?? row.createdAt);
      }
    }
  } catch (err) {
    console.warn("createKpi API failed; local cache kept", err);
  }
  const all = load<KpiDefinition>(KEYS.kpis);
  all.unshift(row);
  save(KEYS.kpis, all);
  appendPmsAudit({ action: "kpi_created", detail: row.name, actor: actor() });
  return row;
}

export async function createOkr(
  input: Omit<OkrObjective, "id" | "createdAt" | "progressPct">,
): Promise<OkrObjective> {
  const progress =
    input.keyResults.length === 0
      ? 0
      : Math.round(
          input.keyResults.reduce((s, kr) => s + kr.progressPct * (kr.weightage || 1), 0) /
            Math.max(1, input.keyResults.reduce((s, kr) => s + (kr.weightage || 1), 0)),
        );
  const row: OkrObjective = {
    ...input,
    id: crypto.randomUUID(),
    progressPct: progress,
    createdAt: nowIso(),
  };
  try {
    const branchId = readBranchId();
    if (branchId) {
      const res = await resourceService.create<Record<string, unknown>>("/hr/okrs", {
        branch_id: branchId,
        title: input.title,
        owner: input.owner || "",
        department: input.department || "",
        weightage: input.weightage,
        status: "active",
        key_results: input.keyResults.map((kr, i) => ({
          title: kr.title,
          progress_pct: kr.progressPct,
          weightage: kr.weightage || 1,
          sequence_no: i + 1,
        })),
      });
      const apiId = String(res.data?.id ?? "");
      if (apiId) {
        row.id = apiId;
        row.progressPct = Number(res.data?.progress_pct ?? progress);
        const apiKrs = Array.isArray(res.data?.key_results) ? res.data.key_results : [];
        if (apiKrs.length) {
          row.keyResults = apiKrs.map((kr: Record<string, unknown>) => ({
            id: String(kr.id ?? crypto.randomUUID()),
            title: String(kr.title ?? ""),
            progressPct: Number(kr.progress_pct ?? 0),
            weightage: Number(kr.weightage ?? 1),
          }));
        }
        row.createdAt = String(res.data?.created_at ?? row.createdAt);
      }
    }
  } catch (err) {
    console.warn("createOkr API failed; local cache kept", err);
  }
  const all = load<OkrObjective>(KEYS.okrs);
  all.unshift(row);
  save(KEYS.okrs, all);
  appendPmsAudit({ action: "okr_created", detail: row.title, actor: actor() });
  return row;
}

export function createCycle(input: Omit<ReviewCycle, "id" | "createdAt">): ReviewCycle {
  const row: ReviewCycle = { ...input, id: crypto.randomUUID(), createdAt: nowIso() };
  const all = load<ReviewCycle>(KEYS.cycles);
  all.unshift(row);
  save(KEYS.cycles, all);
  appendPmsAudit({ action: "cycle_created", detail: row.name, actor: actor() });
  return row;
}

export async function createReview(
  input: Omit<PerformanceReview, "id" | "reviewCode" | "createdAt" | "updatedAt">,
): Promise<PerformanceReview> {
  const row: PerformanceReview = {
    ...input,
    id: crypto.randomUUID(),
    reviewCode: nextCode("review", "REV"),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  try {
    const branchId = readBranchId();
    const employeeId = input.employeeId && UUID_RE.test(input.employeeId) ? input.employeeId : undefined;
    const reviewerId =
      input.reviewerEmployeeId && UUID_RE.test(input.reviewerEmployeeId)
        ? input.reviewerEmployeeId
        : employeeId;
    if (branchId && employeeId && reviewerId) {
      const today = nowIso().slice(0, 10);
      const yearStart = `${today.slice(0, 4)}-01-01`;
      const yearEnd = `${today.slice(0, 4)}-12-31`;
      const cycle = load<ReviewCycle>(KEYS.cycles).find((c) => c.id === input.cycleId);
      const res = await resourceService.create<Record<string, unknown>>("/hr/performance-reviews", {
        branch_id: branchId,
        employee_id: employeeId,
        reviewer_employee_id: reviewerId,
        review_cycle: cycle?.name || "Annual",
        period_start: cycle?.startDate || yearStart,
        period_end: cycle?.endDate || yearEnd,
        overall_rating: input.overallRating || null,
      });
      const apiId = String(res.data?.id ?? "");
      if (apiId) {
        row.id = apiId;
        row.employeeId = employeeId;
        row.reviewerEmployeeId = reviewerId;
        row.reviewCode = String(res.data?.document_number ?? row.reviewCode);
      }
    }
  } catch (err) {
    console.warn("createReview API failed; local cache kept", err);
  }
  const all = load<PerformanceReview>(KEYS.reviews);
  all.unshift(row);
  save(KEYS.reviews, all);
  appendPmsAudit({
    action: "review_submitted",
    detail: `${row.reviewCode} for ${row.employeeName}`,
    actor: actor(),
  });
  return row;
}

export function updateReview(id: string, patch: Partial<PerformanceReview>) {
  const all = load<PerformanceReview>(KEYS.reviews);
  const idx = all.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  const prev = all[idx].overallRating;
  all[idx] = { ...all[idx], ...patch, updatedAt: nowIso() };
  save(KEYS.reviews, all);
  if (patch.overallRating != null && patch.overallRating !== prev) {
    appendPmsAudit({
      action: "rating_changed",
      detail: `${all[idx].reviewCode} rating ${prev} → ${patch.overallRating}`,
      actor: actor(),
    });
  }
  return all[idx];
}

export function giveFeedback(input: Omit<ContinuousFeedback, "id" | "createdAt">): ContinuousFeedback {
  const row: ContinuousFeedback = { ...input, id: crypto.randomUUID(), createdAt: nowIso() };
  const all = load<ContinuousFeedback>(KEYS.feedback);
  all.unshift(row);
  save(KEYS.feedback, all);
  appendPmsAudit({
    action: "feedback_received",
    detail: `${row.feedbackType} for ${row.employeeName}`,
    actor: actor(),
  });
  return row;
}

export function scheduleOneOnOne(input: Omit<OneOnOneMeeting, "id" | "createdAt">): OneOnOneMeeting {
  const row: OneOnOneMeeting = { ...input, id: crypto.randomUUID(), createdAt: nowIso() };
  const all = load<OneOnOneMeeting>(KEYS.meetings);
  all.unshift(row);
  save(KEYS.meetings, all);
  appendPmsAudit({
    action: "meeting_scheduled",
    detail: `1:1 ${row.employeeName} / ${row.managerName} on ${row.meetingDate}`,
    actor: actor(),
  });
  return row;
}

export function createProbation(input: Omit<ProbationCase, "id" | "createdAt">): ProbationCase {
  const row: ProbationCase = { ...input, id: crypto.randomUUID(), createdAt: nowIso() };
  const all = load<ProbationCase>(KEYS.probation);
  all.unshift(row);
  save(KEYS.probation, all);
  return row;
}

export function updateProbation(id: string, patch: Partial<ProbationCase>) {
  const all = load<ProbationCase>(KEYS.probation);
  const idx = all.findIndex((p) => p.id === id);
  if (idx < 0) return null;
  all[idx] = { ...all[idx], ...patch };
  save(KEYS.probation, all);
  return all[idx];
}

export function startPip(input: Omit<PipPlan, "id" | "createdAt">): PipPlan {
  const row: PipPlan = { ...input, id: crypto.randomUUID(), createdAt: nowIso() };
  const all = load<PipPlan>(KEYS.pips);
  all.unshift(row);
  save(KEYS.pips, all);
  appendPmsAudit({ action: "pip_started", detail: `PIP for ${row.employeeName}`, actor: actor() });
  return row;
}

export async function createAppraisal(
  input: Omit<AppraisalRecord, "id" | "appraisalCode" | "createdAt" | "updatedAt">,
): Promise<AppraisalRecord> {
  const row: AppraisalRecord = {
    ...input,
    id: crypto.randomUUID(),
    appraisalCode: nextCode("appraisal", "APR"),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  try {
    const branchId = readBranchId();
    const employeeId = input.employeeId && UUID_RE.test(input.employeeId) ? input.employeeId : undefined;
    let reviewId =
      input.performanceReviewId && UUID_RE.test(input.performanceReviewId)
        ? input.performanceReviewId
        : load<PerformanceReview>(KEYS.reviews).find(
            (r) => UUID_RE.test(r.id) && (!employeeId || r.employeeId === employeeId),
          )?.id;

    if (branchId && employeeId && !reviewId) {
      const today = nowIso().slice(0, 10);
      const yearStart = `${today.slice(0, 4)}-01-01`;
      const yearEnd = `${today.slice(0, 4)}-12-31`;
      const reviewRes = await resourceService.create<Record<string, unknown>>("/hr/performance-reviews", {
        branch_id: branchId,
        employee_id: employeeId,
        reviewer_employee_id: employeeId,
        review_cycle: input.cycleName || "Appraisal",
        period_start: yearStart,
        period_end: yearEnd,
        overall_rating: input.overallRating || null,
      });
      reviewId = String(reviewRes.data?.id ?? "");
      if (reviewId) {
        const reviews = load<PerformanceReview>(KEYS.reviews);
        reviews.unshift({
          id: reviewId,
          reviewCode: String(reviewRes.data?.document_number ?? nextCode("review", "REV")),
          cycleId: "",
          employeeId,
          employeeName: input.employeeName,
          managerName: "Reporting manager",
          reviewerEmployeeId: employeeId,
          reviewerName: "Reporting manager",
          hrName: "HR",
          selfAssessment: "",
          managerAssessment: "",
          peerReview: "",
          finalComments: "",
          overallRating: input.overallRating || 0,
          recommendation: "none",
          status: "draft",
          attachmentName: "",
          createdAt: nowIso(),
          updatedAt: nowIso(),
        });
        save(KEYS.reviews, reviews);
      }
    }

    if (reviewId && UUID_RE.test(reviewId)) {
      const seq =
        load<AppraisalRecord>(KEYS.appraisals).filter((a) => a.performanceReviewId === reviewId).length + 1;
      const area =
        [input.salaryRecommendation, input.promotionRecommendation, input.bonusRecommendation]
          .filter(Boolean)
          .join("; ") || "Overall";
      const res = await resourceService.create<Record<string, unknown>>("/hr/appraisals", {
        performance_review_id: reviewId,
        employee_id: employeeId || null,
        sequence_no: seq,
        appraisal_area: area.slice(0, 200),
        rating: Math.max(1, Math.min(5, Math.round(input.overallRating) || 3)),
        comments: input.trainingRecommendation || null,
      });
      const apiId = String(res.data?.id ?? "");
      if (apiId) {
        row.id = apiId;
        row.performanceReviewId = reviewId;
        row.employeeId = employeeId;
        row.appraisalCode = String(res.data?.document_number ?? row.appraisalCode);
      }
    }
  } catch (err) {
    console.warn("createAppraisal API failed; local cache kept", err);
  }
  const all = load<AppraisalRecord>(KEYS.appraisals);
  all.unshift(row);
  save(KEYS.appraisals, all);
  appendPmsAudit({
    action: "appraisal_started",
    detail: `${row.appraisalCode} — ${row.employeeName}`,
    actor: actor(),
  });
  return row;
}

export function advanceAppraisal(id: string): AppraisalRecord | null {
  const flow: AppraisalRecord["workflowStage"][] = ["manager", "hr", "director", "approved"];
  const all = load<AppraisalRecord>(KEYS.appraisals);
  const idx = all.findIndex((a) => a.id === id);
  if (idx < 0) return null;
  const cur = all[idx].workflowStage;
  const i = flow.indexOf(cur);
  if (i < 0 || i >= flow.length - 1) return all[idx];
  all[idx] = { ...all[idx], workflowStage: flow[i + 1], updatedAt: nowIso() };
  save(KEYS.appraisals, all);
  if (all[idx].workflowStage === "approved") {
    appendPmsAudit({
      action: "promotion_approved",
      detail: `${all[idx].appraisalCode} workflow approved`,
      actor: actor(),
    });
  }
  return all[idx];
}

export function filterGoals(goals: PerformanceGoal[], f: PerformanceFilters) {
  const q = f.query.trim().toLowerCase();
  return goals.filter((g) => {
    if (f.status !== "all" && g.status !== f.status) return false;
    if (f.department !== "all" && g.department !== f.department) return false;
    if (!q) return true;
    return [g.goalCode, g.title, g.employeeName, g.department].join(" ").toLowerCase().includes(q);
  });
}

export function performanceDistribution(reviews: PerformanceReview[]) {
  const buckets = [0, 0, 0, 0, 0];
  for (const r of reviews.filter((x) => x.overallRating > 0)) {
    const i = Math.min(4, Math.max(0, Math.round(r.overallRating) - 1));
    buckets[i] += 1;
  }
  return buckets.map((count, i) => ({ rating: i + 1, count }));
}

export function goalCompletionByDept(goals: PerformanceGoal[]) {
  const map = new Map<string, { total: number; done: number }>();
  for (const g of goals) {
    const cur = map.get(g.department) ?? { total: 0, done: 0 };
    cur.total += 1;
    if (g.status === "completed") cur.done += 1;
    map.set(g.department, cur);
  }
  return Array.from(map.entries()).map(([department, v]) => ({
    department,
    pct: v.total ? Math.round((v.done / v.total) * 100) : 0,
    done: v.done,
    total: v.total,
  }));
}

export function exportGoalsCsv(goals: PerformanceGoal[]): string {
  const h = ["Goal ID", "Title", "Employee", "Status", "Progress", "Due"];
  const lines = goals.map((g) =>
    [g.goalCode, g.title, g.employeeName, g.status, g.currentProgress, g.dueDate]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [h.join(","), ...lines].join("\n");
}

export function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
