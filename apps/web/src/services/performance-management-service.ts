/**
 * Enterprise Performance Management service — local rich store + HR API merge.
 */

import { loadHrOverview } from "@/services/hr-service";
import { loadHrMasterDirectory, type HrMasterOption } from "@/services/hr-master-connector";
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
    if (goals.length === 0 && overview.goals.length) {
      goals = overview.goals.map((g, i) => ({
        id: String(g.id ?? crypto.randomUUID()),
        goalCode: String(g.document_number ?? g.goal_code ?? `GOL-${String(i + 1).padStart(6, "0")}`),
        title: String(g.goal_title ?? g.title ?? "Goal"),
        description: String(g.description ?? ""),
        goalType: "individual",
        category: "kpi",
        employeeName: String(g.employee_name ?? g.employee_id ?? "Employee"),
        assignedBy: actor(),
        department: String(g.department_name ?? "—"),
        priority: "medium",
        weightage: Number(g.weightage ?? 10),
        targetValue: Number(g.target_value ?? 100),
        currentProgress: Number(g.progress_pct ?? g.current_value ?? 0),
        startDate: String(g.start_date ?? "").slice(0, 10),
        dueDate: String(g.due_date ?? g.end_date ?? "").slice(0, 10),
        status: String(g.status ?? "in_progress").toLowerCase().includes("complete")
          ? "completed"
          : String(g.status ?? "").toLowerCase().includes("draft")
            ? "draft"
            : "in_progress",
        createdAt: nowIso(),
        updatedAt: nowIso(),
      }));
      save(KEYS.goals, goals);
    }
    if (reviews.length === 0 && overview.reviews.length) {
      reviews = overview.reviews.map((r, i) => ({
        id: String(r.id ?? crypto.randomUUID()),
        reviewCode: String(r.document_number ?? `REV-${String(i + 1).padStart(6, "0")}`),
        cycleId: "",
        employeeName: String(r.employee_name ?? r.employee_id ?? "Employee"),
        managerName: String(r.manager_name ?? "Manager"),
        reviewerName: "",
        hrName: "HR",
        selfAssessment: "",
        managerAssessment: "",
        peerReview: "",
        finalComments: "",
        overallRating: Number(r.overall_rating ?? 0),
        recommendation: "none",
        status: String(r.status ?? "draft").toLowerCase().includes("approv")
          ? "completed"
          : String(r.status ?? "").toLowerCase().includes("submit")
            ? "manager_pending"
            : "draft",
        attachmentName: "",
        createdAt: nowIso(),
        updatedAt: nowIso(),
      }));
      save(KEYS.reviews, reviews);
    }
    if (appraisals.length === 0 && overview.appraisals.length) {
      appraisals = overview.appraisals.map((a, i) => ({
        id: String(a.id ?? crypto.randomUUID()),
        appraisalCode: String(a.document_number ?? `APR-${String(i + 1).padStart(6, "0")}`),
        employeeName: String(a.employee_name ?? a.employee_id ?? "Employee"),
        cycleName: String(a.cycle_name ?? "Annual"),
        salaryRecommendation: "",
        promotionRecommendation: "",
        bonusRecommendation: "",
        trainingRecommendation: "",
        workflowStage: String(a.status ?? "").toLowerCase().includes("approv") ? "approved" : "manager",
        overallRating: Number(a.overall_rating ?? 0),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      }));
      save(KEYS.appraisals, appraisals);
    }
  } catch {
    /* offline */
  }

  const goalDepts = Array.from(
    new Set(
      [
        ...departments,
        ...load<PerformanceGoal>(KEYS.goals).map((g) => g.department),
        ...load<KpiDefinition>(KEYS.kpis).map((k) => k.department),
      ].filter((d) => d && d !== "—"),
    ),
  ).sort();

  return {
    goals: load(KEYS.goals),
    kpis: load(KEYS.kpis),
    okrs: load(KEYS.okrs),
    cycles: load(KEYS.cycles),
    reviews: load(KEYS.reviews),
    feedback: load(KEYS.feedback),
    meetings: load(KEYS.meetings),
    probation: load(KEYS.probation),
    pips: load(KEYS.pips),
    appraisals: load(KEYS.appraisals),
    departments: goalDepts,
    employees,
  };
}

export function computePerformanceStats(dir: PerformanceDirectory) {
  const today = nowIso().slice(0, 10);
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

export function createGoal(
  input: Omit<PerformanceGoal, "id" | "goalCode" | "createdAt" | "updatedAt">,
): PerformanceGoal {
  const row: PerformanceGoal = {
    ...input,
    id: crypto.randomUUID(),
    goalCode: nextCode("goal", "GOL"),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
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

export function createKpi(input: Omit<KpiDefinition, "id" | "createdAt">): KpiDefinition {
  const row: KpiDefinition = { ...input, id: crypto.randomUUID(), createdAt: nowIso() };
  const all = load<KpiDefinition>(KEYS.kpis);
  all.unshift(row);
  save(KEYS.kpis, all);
  appendPmsAudit({ action: "kpi_created", detail: row.name, actor: actor() });
  return row;
}

export function createOkr(input: Omit<OkrObjective, "id" | "createdAt" | "progressPct">): OkrObjective {
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

export function createReview(
  input: Omit<PerformanceReview, "id" | "reviewCode" | "createdAt" | "updatedAt">,
): PerformanceReview {
  const row: PerformanceReview = {
    ...input,
    id: crypto.randomUUID(),
    reviewCode: nextCode("review", "REV"),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
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

export function createAppraisal(
  input: Omit<AppraisalRecord, "id" | "appraisalCode" | "createdAt" | "updatedAt">,
): AppraisalRecord {
  const row: AppraisalRecord = {
    ...input,
    id: crypto.randomUUID(),
    appraisalCode: nextCode("appraisal", "APR"),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
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
