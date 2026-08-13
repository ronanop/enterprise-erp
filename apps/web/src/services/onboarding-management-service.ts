/**
 * Enterprise Digital Onboarding service.
 * Rich case/portal/checklist data lives in localStorage; recruitment offers/API
 * onboarding rows are merged when available.
 */

import { resourceService } from "@/services/api-client";
import { registerLocalEmployee, updateLocalEmployeeLifecycle } from "@/services/hr-master-connector";
import { applyOnboardingPortalToEmployee } from "@/services/employee-management-service";
import { loadRecruitmentOverview, type RecruitmentRow } from "@/services/recruitment-service";
import { portalToWizardDraft } from "@/lib/onboarding-to-employee";
import { isJoiningDateReached } from "@/lib/onboarding-workflow";
import { previewNextEmployeeCode } from "@/services/employee-management-service";
import {
  DEFAULT_MANAGER_CHECKLIST,
  POST_JOIN_HR_CHECKLIST,
  emptyPortal,
  PORTAL_STEPS,
  type ChecklistItem,
  type InvitationChannel,
  type OnboardingAuditEntry,
  type OnboardingCase,
  type OnboardingCaseStatus,
  type OnboardingDocument,
  type OnboardingFilters,
  type PortalPayload,
  type PortalStepId,
  type StartOnboardingInput,
} from "@/types/onboarding-management";

const CASES_KEY = "erp_onboarding_cases_v1";
const AUDIT_KEY = "erp_onboarding_audit_v1";
const SEQ_KEY = "erp_onboarding_seq_v1";
const INVITE_EXPIRY_DEFAULT_DAYS = 14;

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

function writeJson(key: string, value: unknown): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function appendOnboardingAudit(entry: Omit<OnboardingAuditEntry, "id" | "at">): void {
  const all = readJson<OnboardingAuditEntry[]>(AUDIT_KEY, []);
  all.unshift({ ...entry, id: crypto.randomUUID(), at: nowIso() });
  writeJson(AUDIT_KEY, all.slice(0, 5000));
}

export function listOnboardingAudit(caseId?: string): OnboardingAuditEntry[] {
  const all = readJson<OnboardingAuditEntry[]>(AUDIT_KEY, []);
  return caseId ? all.filter((a) => a.caseId === caseId) : all;
}

function nextCaseCode(): string {
  const n = readJson<number>(SEQ_KEY, 0) + 1;
  writeJson(SEQ_KEY, n);
  return `ONB-${String(n).padStart(6, "0")}`;
}

function buildPostJoinChecklist(): ChecklistItem[] {
  const hr = POST_JOIN_HR_CHECKLIST.map((t) => ({
    id: crypto.randomUUID(),
    code: t.code,
    name: t.name,
    owner: "hr" as const,
    status: "pending" as const,
  }));
  const mgr = DEFAULT_MANAGER_CHECKLIST.map((t) => ({
    id: crypto.randomUUID(),
    code: t.code,
    name: t.name,
    owner: "manager" as const,
    status: "pending" as const,
  }));
  return [...hr, ...mgr];
}

function buildDefaultChecklist(): ChecklistItem[] {
  return [];
}

function calcProgress(portal: PortalPayload, checklist: ChecklistItem[], status: OnboardingCaseStatus): number {
  if (status === "joined") return 100;
  if (status === "pending_join") return 96;
  if (status === "ready_to_join") return 92;
  const stepIdx = PORTAL_STEPS.findIndex((s) => s.id === portal.currentStep);
  const portalPct = portal.submittedAt
    ? 85
    : Math.round(((Math.max(stepIdx, 0) + 1) / PORTAL_STEPS.length) * 80);
  return Math.min(100, portalPct);
}

function refreshCaseDerived(c: OnboardingCase): OnboardingCase {
  let status = c.status;
  const today = new Date().toISOString().slice(0, 10);
  if (
    c.joiningDate &&
    c.joiningDate < today &&
    !["joined", "cancelled", "ready_to_join", "pending_join"].includes(c.status)
  ) {
    status = "overdue";
  }
  return {
    ...c,
    status,
    progressPct: calcProgress(c.portal, c.checklist, status),
    updatedAt: c.updatedAt,
  };
}

function loadCases(): OnboardingCase[] {
  return readJson<OnboardingCase[]>(CASES_KEY, []).map(refreshCaseDerived);
}

function saveCases(cases: OnboardingCase[]): boolean {
  return writeJson(CASES_KEY, cases);
}

function upsertCase(next: OnboardingCase): OnboardingCase | null {
  const all = loadCases();
  const idx = all.findIndex((c) => c.id === next.id);
  const refreshed = refreshCaseDerived({ ...next, updatedAt: nowIso() });
  if (idx >= 0) all[idx] = refreshed;
  else all.unshift(refreshed);
  if (!saveCases(all)) return null;
  return refreshed;
}

function candidateName(row: RecruitmentRow): string {
  return (
    String(row.full_name ?? row.candidate_name ?? row.display_name ?? "").trim() ||
    [row.first_name, row.last_name].filter(Boolean).join(" ").trim() ||
    String(row.email ?? row.id ?? "Candidate")
  );
}

export type AcceptedOfferOption = {
  id: string;
  code: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string;
  department: string;
  designation: string;
  ctc?: string;
};

export type OnboardingDirectory = {
  cases: OnboardingCase[];
  acceptedOffers: AcceptedOfferOption[];
  departments: string[];
  apiOnboardingCount: number;
};

export async function loadOnboardingDirectory(): Promise<OnboardingDirectory> {
  let acceptedOffers: AcceptedOfferOption[] = [];
  let apiOnboardingCount = 0;
  try {
    const overview = await loadRecruitmentOverview();
    apiOnboardingCount = overview.onboarding.length;
    const candMap = new Map<string, RecruitmentRow>();
    for (const c of overview.candidates) {
      if (c.id != null) candMap.set(String(c.id), c);
    }
    acceptedOffers = overview.offers
      .filter((o) => {
        const s = String(o.status ?? "").toLowerCase();
        return s.includes("accept") || s === "accepted";
      })
      .map((o) => {
        const cand = o.candidate_id != null ? candMap.get(String(o.candidate_id)) : undefined;
        return {
          id: String(o.id),
          code: String(o.document_number ?? o.offer_number ?? `OFF-${String(o.id).slice(0, 6)}`),
          candidateId: String(o.candidate_id ?? ""),
          candidateName: cand ? candidateName(cand) : String(o.candidate_name ?? "Candidate"),
          candidateEmail: String(cand?.email ?? o.email ?? ""),
          candidatePhone: String(cand?.phone ?? cand?.mobile ?? o.phone ?? ""),
          department: String(o.department_name ?? o.department_id ?? "—"),
          designation: String(o.designation_name ?? o.designation_id ?? "—"),
          ctc: o.ctc != null ? String(o.ctc) : undefined,
        };
      });
  } catch {
    /* offline / unauthenticated — local cases still load */
  }

  const cases = loadCases();
  const departments = Array.from(
    new Set(cases.map((c) => c.department).filter((d) => d && d !== "—")),
  ).sort();

  return { cases, acceptedOffers, departments, apiOnboardingCount };
}

export type OnboardingStatBucket =
  | "invitations_sent"
  | "pending_forms"
  | "documents_pending"
  | "ready_to_join"
  | "pending_join"
  | "joined_today";

export function matchesOnboardingStatBucket(
  c: OnboardingCase,
  bucket: OnboardingStatBucket,
  today = new Date().toISOString().slice(0, 10),
): boolean {
  switch (bucket) {
    case "invitations_sent":
      return [
        "invitation_sent",
        "in_progress",
        "submitted",
        "hr_review",
        "ready_to_join",
        "pending_join",
        "joined",
      ].includes(c.status);
    case "pending_forms":
      return ["invitation_sent", "in_progress"].includes(c.status);
    case "documents_pending": {
      const docs = c.portal.documents;
      return (
        !c.portal.submittedAt &&
        (docs.length < 3 || docs.some((d) => d.verifyStatus === "pending"))
      );
    }
    case "ready_to_join":
      return c.status === "ready_to_join";
    case "pending_join":
      return c.status === "pending_join";
    case "joined_today":
      return c.activatedAt?.slice(0, 10) === today;
    default:
      return true;
  }
}

export function computeOnboardingStats(cases: OnboardingCase[]) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    invitationsSent: cases.filter((c) => matchesOnboardingStatBucket(c, "invitations_sent", today))
      .length,
    pendingForms: cases.filter((c) => matchesOnboardingStatBucket(c, "pending_forms", today))
      .length,
    documentsPending: cases.filter((c) =>
      matchesOnboardingStatBucket(c, "documents_pending", today),
    ).length,
    readyToJoin: cases.filter((c) => matchesOnboardingStatBucket(c, "ready_to_join", today))
      .length,
    pendingJoin: cases.filter((c) => matchesOnboardingStatBucket(c, "pending_join", today))
      .length,
    joinedToday: cases.filter((c) => matchesOnboardingStatBucket(c, "joined_today", today))
      .length,
    overdue: cases.filter((c) => c.status === "overdue").length,
    total: cases.length,
    completionRate:
      cases.length === 0
        ? 0
        : Math.round((cases.filter((c) => c.status === "joined").length / cases.length) * 100),
  };
}

export function filterOnboardingCases(
  cases: OnboardingCase[],
  query: string,
  filters: OnboardingFilters,
  statsBucket?: OnboardingStatBucket | null,
): OnboardingCase[] {
  const q = query.trim().toLowerCase();
  const today = new Date().toISOString().slice(0, 10);
  return cases.filter((c) => {
    if (statsBucket && !matchesOnboardingStatBucket(c, statsBucket, today)) return false;
    if (filters.status !== "all" && c.status !== filters.status) return false;
    if (filters.department !== "all" && c.department !== filters.department) return false;
    if (filters.overdueOnly && c.status !== "overdue") return false;
    if (filters.joiningFrom && c.joiningDate < filters.joiningFrom) return false;
    if (filters.joiningTo && c.joiningDate > filters.joiningTo) return false;
    if (!q) return true;
    const hay = [
      c.caseCode,
      c.candidateName,
      c.candidateEmail,
      c.offerCode,
      c.department,
      c.designation,
      c.employeeId,
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export async function startOnboarding(input: StartOnboardingInput): Promise<OnboardingCase> {
  const id = crypto.randomUUID();
  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const expires = new Date();
  expires.setDate(expires.getDate() + (input.invitationExpiryDays || INVITE_EXPIRY_DEFAULT_DAYS));

  const caseRow: OnboardingCase = {
    id,
    caseCode: nextCaseCode(),
    candidateId: input.candidateId || crypto.randomUUID(),
    candidateName: input.candidateName,
    candidateEmail: input.candidateEmail,
    candidatePhone: input.candidatePhone,
    offerId: "",
    offerCode: "",
    joiningDate: input.joiningDate,
    entityId: input.entityId || "",
    entityName: input.entityName || "",
    department: input.department,
    designation: input.designation,
    reportingManager: input.reportingManager,
    branch: input.branch,
    shift: "",
    leavePolicy: "",
    employmentType: input.employmentType,
    buddy: undefined,
    hrOwner: input.hrOwner || actor(),
    status: "draft",
    portal: emptyPortal(input.candidateEmail, input.candidatePhone, input.candidateName),
    checklist: buildDefaultChecklist(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    progressPct: 0,
    invitation: {
      token,
      sentAt: "",
      expiresAt: expires.toISOString(),
      channel: "email",
      resendCount: 0,
    },
  };

  const saved = upsertCase(caseRow);
  appendOnboardingAudit({
    caseId: saved.id,
    action: "start_onboarding",
    detail: `Started onboarding ${saved.caseCode} for ${saved.candidateName}`,
    actor: actor(),
  });

  // Best-effort API create — schema is minimal; ignore failures
  try {
    await resourceService.create("/recruitment/onboarding", {
      branch_id: null,
      status: "draft",
    });
  } catch {
    /* local case is source of truth for enterprise UI */
  }

  return saved;
}

export function getInvitationUrl(token: string): string {
  if (typeof window === "undefined") return `/onboarding/${token}`;
  return `${window.location.origin}/onboarding/${token}`;
}

export function sendInvitation(
  caseId: string,
  channel: InvitationChannel,
  expiryDays?: number,
): OnboardingCase | null {
  const all = loadCases();
  const c = all.find((x) => x.id === caseId);
  if (!c) return null;

  const expires = new Date();
  expires.setDate(expires.getDate() + (expiryDays ?? INVITE_EXPIRY_DEFAULT_DAYS));
  const token = c.invitation?.token || crypto.randomUUID().replace(/-/g, "").slice(0, 16);

  const next: OnboardingCase = {
    ...c,
    status: c.status === "draft" || c.status === "invitation_sent" ? "invitation_sent" : c.status,
    invitation: {
      token,
      sentAt: nowIso(),
      expiresAt: expires.toISOString(),
      channel,
      lastChannel: channel,
      resendCount: (c.invitation?.resendCount ?? 0) + (c.invitation?.sentAt ? 1 : 0),
    },
  };
  const saved = upsertCase(next);
  appendOnboardingAudit({
    caseId,
    action: "send_invitation",
    detail: `Invitation via ${channel} → ${getInvitationUrl(token)}`,
    actor: actor(),
  });
  return saved;
}

export function getCaseByToken(token: string): OnboardingCase | null {
  const c = loadCases().find((x) => x.invitation?.token === token) ?? null;
  if (!c?.invitation) return null;
  if (new Date(c.invitation.expiresAt).getTime() < Date.now()) {
    return { ...c, status: "overdue" };
  }
  return c;
}

export function getCaseById(id: string): OnboardingCase | null {
  return loadCases().find((c) => c.id === id) ?? null;
}

export function savePortalProgress(
  token: string,
  portal: PortalPayload,
  advanceStatus = true,
): OnboardingCase | null {
  const all = loadCases();
  const idx = all.findIndex((x) => x.invitation?.token === token);
  if (idx < 0) return null;
  const c = all[idx];
  const nextStatus: OnboardingCaseStatus =
    advanceStatus && c.status === "invitation_sent" ? "in_progress" : c.status;
  const next = upsertCase({ ...c, portal, status: nextStatus });
  if (!next) return null;
  appendOnboardingAudit({
    caseId: c.id,
    action: "portal_save",
    detail: `Candidate saved step ${portal.currentStep}`,
    actor: c.candidateName,
  });
  return next;
}

export function submitPortal(token: string, portal: PortalPayload): OnboardingCase | null {
  const submitted: PortalPayload = {
    ...portal,
    submittedAt: nowIso(),
    currentStep: "review",
  };
  const all = loadCases();
  const idx = all.findIndex((x) => x.invitation?.token === token);
  if (idx < 0) return null;
  const c = all[idx];
  const next = upsertCase({
    ...c,
    portal: submitted,
    status: "hr_review",
  });
  appendOnboardingAudit({
    caseId: c.id,
    action: "portal_submit",
    detail: "Candidate submitted onboarding forms",
    actor: c.candidateName,
  });
  return next;
}

export function updateChecklistItem(
  caseId: string,
  itemId: string,
  status: ChecklistItem["status"],
  notes?: string,
): OnboardingCase | null {
  const c = getCaseById(caseId);
  if (!c) return null;
  const checklist = c.checklist.map((item) =>
    item.id === itemId
      ? {
          ...item,
          status,
          notes: notes ?? item.notes,
          completedAt: status === "done" ? nowIso() : item.completedAt,
        }
      : item,
  );
  const next = upsertCase({
    ...c,
    checklist,
  });
  appendOnboardingAudit({
    caseId,
    action: "checklist_update",
    detail: `Task ${itemId.slice(0, 8)} → ${status}`,
    actor: actor(),
  });
  return next;
}

export function verifyDocument(
  caseId: string,
  docId: string,
  verifyStatus: OnboardingDocument["verifyStatus"],
  notes?: string,
): OnboardingCase | null {
  const c = getCaseById(caseId);
  if (!c) return null;
  const documents = c.portal.documents.map((d) =>
    d.id === docId ? { ...d, verifyStatus, notes } : d,
  );
  const next = upsertCase({
    ...c,
    portal: { ...c.portal, documents },
  });
  appendOnboardingAudit({
    caseId,
    action: "verify_document",
    detail: `Document ${docId.slice(0, 8)} → ${verifyStatus}`,
    actor: actor(),
  });
  return next;
}

export function markReadyToJoin(caseId: string): OnboardingCase | null {
  const c = getCaseById(caseId);
  if (!c) return null;
  const next = upsertCase({ ...c, status: "ready_to_join" });
  appendOnboardingAudit({
    caseId,
    action: "ready_to_join",
    detail: "HR marked candidate ready to join",
    actor: actor(),
  });
  return next;
}

export function approveCandidateReview(caseId: string): OnboardingCase | null {
  const c = getCaseById(caseId);
  if (!c) return null;
  if (!c.portal.submittedAt) {
    throw new Error("Candidate has not submitted the onboarding portal yet.");
  }
  const pendingDocs = c.portal.documents.filter((d) => d.verifyStatus === "pending");
  if (pendingDocs.length > 0) {
    throw new Error("Verify or reject all uploaded documents before approving.");
  }
  const rejected = c.portal.documents.filter((d) => d.verifyStatus === "rejected");
  if (rejected.length > 0) {
    throw new Error("Some documents were rejected — ask the candidate to re-upload.");
  }
  const today = new Date().toISOString().slice(0, 10);
  const nextStatus: OnboardingCaseStatus =
    c.joiningDate && c.joiningDate > today ? "ready_to_join" : "ready_to_join";
  const next = upsertCase({ ...c, status: nextStatus });
  appendOnboardingAudit({
    caseId,
    action: "approve_review",
    detail: "HR approved candidate information and documents",
    actor: actor(),
  });
  return next;
}

/** Create employee profile after HR approval. Activates immediately if joining date has passed. */
export async function completeOnboarding(
  caseId: string,
  opts?: { employeeCode?: string; shiftId?: string },
): Promise<OnboardingCase | null> {
  const c = getCaseById(caseId);
  if (!c) return null;

  if (!["ready_to_join"].includes(c.status)) {
    throw new Error("Approve the candidate submission before completing onboarding.");
  }
  if (!c.portal.submittedAt) {
    throw new Error("Candidate has not submitted the onboarding portal yet.");
  }

  const activateNow = isJoiningDateReached(c.joiningDate);
  const employeeCode = (opts?.employeeCode || previewNextEmployeeCode()).trim().toUpperCase();

  const apiOnboardingId = (c as OnboardingCase & { apiOnboardingId?: string }).apiOnboardingId;
  let employmentId =
    (c as OnboardingCase & { apiEmploymentId?: string }).apiEmploymentId || "";
  let employeeUuid = c.employeeId || "";

  if (apiOnboardingId) {
    try {
      if (!employmentId) {
        const res = await resourceService.action<Record<string, unknown>>(
          "/recruitment/onboarding",
          apiOnboardingId,
          "complete",
          { designation: c.designation || "Employee" },
        );
        employeeUuid = String(res.data?.employee_id ?? employeeUuid);
        employmentId = String(res.data?.hr_employment_request_id ?? "");
      }

      if (activateNow && employmentId) {
        await resourceService.action("/hr/employment", employmentId, "activate", {
          employee_code: employeeCode,
          shift_id: opts?.shiftId || null,
          start_probation: true,
          probation_days: 90,
          mark_payroll_eligible: true,
        });
      }

      // Import portal personal / IDs / bank / photo onto the employee record
      if (employeeUuid && employeeUuid !== employeeCode) {
        await applyOnboardingPortalToEmployee(
          employeeUuid,
          portalToWizardDraft(c, employeeCode),
        );
      }

      const checklist = buildPostJoinChecklist().map((item) =>
        ["GEN_EMP_ID", "CREATE_PROFILE", "APPROVE_INFO"].includes(item.code)
          ? { ...item, status: "done" as const, completedAt: nowIso() }
          : item,
      );
      const next = upsertCase({
        ...c,
        employeeId: employeeCode,
        apiEmploymentId: employmentId,
        checklist,
        status: activateNow ? "joined" : "pending_join",
        activatedAt: activateNow ? nowIso() : undefined,
        progressPct: activateNow ? 100 : 96,
      } as OnboardingCase & { apiEmploymentId?: string });
      appendOnboardingAudit({
        caseId,
        action: activateNow ? "activate_employee" : "complete_onboarding",
        detail: activateNow
          ? `Activated Emp ID ${employeeCode}; employment ${employmentId || "n/a"}`
          : `Employee profile created (${employeeCode}); activation pending until ${c.joiningDate || "joining date"}`,
        actor: actor(),
      });
      return next;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Completion failed";
      appendOnboardingAudit({
        caseId,
        action: "complete_onboarding_failed",
        detail: msg,
        actor: actor(),
      });
      throw err;
    }
  }

  const nameParts = c.candidateName.trim().split(/\s+/);
  const firstName = nameParts[0] || c.candidateName;
  const lastName = nameParts.slice(1).join(" ");

  const local = registerLocalEmployee({
    firstName,
    lastName,
    email: c.candidateEmail,
    phone: c.candidatePhone,
    department: c.department,
    designation: c.designation,
    branch: c.branch,
    shift: c.shift,
    leavePolicy: c.leavePolicy,
    employmentType: c.employmentType,
    reportingManager: c.reportingManager,
    joiningDate: c.joiningDate,
    employeeCode,
    lifecycleStatus: activateNow ? "probation" : "onboarding",
  });

  await applyOnboardingPortalToEmployee(local.id, portalToWizardDraft(c, employeeCode));

  const checklist = buildPostJoinChecklist().map((item) =>
    ["GEN_EMP_ID", "CREATE_PROFILE", "APPROVE_INFO"].includes(item.code)
      ? { ...item, status: "done" as const, completedAt: nowIso() }
      : item,
  );
  const next = upsertCase({
    ...c,
    employeeId: local.employeeCode,
    checklist,
    status: activateNow ? "joined" : "pending_join",
    activatedAt: activateNow ? nowIso() : undefined,
    progressPct: activateNow ? 100 : 96,
  });

  try {
    const key = "erp_onboarding_activated_employees_v1";
    const list = readJson<
      {
        employeeCode: string;
        caseId: string;
        at: string;
      }[]
    >(key, []);
    list.unshift({ employeeCode: local.employeeCode, caseId, at: nowIso() });
    writeJson(key, list.slice(0, 200));
  } catch {
    /* ignore */
  }

  appendOnboardingAudit({
    caseId,
    action: activateNow ? "activate_employee" : "complete_onboarding",
    detail: activateNow
      ? `Local activate Emp ID ${local.employeeCode}`
      : `Local profile ${local.employeeCode} — pending activation until ${c.joiningDate || "joining date"}`,
    actor: actor(),
  });
  return next;
}

/** Activate a pending employee on or after joining date. */
export async function activateOnboardingEmployee(
  caseId: string,
  opts?: { employeeCode?: string; shiftId?: string },
): Promise<OnboardingCase | null> {
  const c = getCaseById(caseId);
  if (!c) return null;

  if (c.status !== "pending_join") {
    throw new Error("Complete onboarding first to create the employee profile.");
  }
  if (!isJoiningDateReached(c.joiningDate)) {
    throw new Error(
      `Joining date is ${c.joiningDate}. Activation is available on or after that date.`,
    );
  }
  if (!c.employeeId) {
    throw new Error("Employee profile not found for this onboarding case.");
  }

  const employeeCode = (opts?.employeeCode || c.employeeId).trim().toUpperCase();
  const apiOnboardingId = (c as OnboardingCase & { apiOnboardingId?: string }).apiOnboardingId;
  const employmentId =
    (c as OnboardingCase & { apiEmploymentId?: string }).apiEmploymentId || "";

  if (apiOnboardingId && employmentId) {
    try {
      await resourceService.action("/hr/employment", employmentId, "activate", {
        employee_code: employeeCode,
        shift_id: opts?.shiftId || null,
        start_probation: true,
        probation_days: 90,
        mark_payroll_eligible: true,
      });

      const next = upsertCase({
        ...c,
        employeeId: employeeCode,
        status: "joined",
        activatedAt: nowIso(),
        progressPct: 100,
      });
      appendOnboardingAudit({
        caseId,
        action: "activate_employee",
        detail: `Activated Emp ID ${employeeCode}; employment ${employmentId}`,
        actor: actor(),
      });
      return next;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Activation failed";
      appendOnboardingAudit({
        caseId,
        action: "activate_employee_failed",
        detail: msg,
        actor: actor(),
      });
      throw err;
    }
  }

  updateLocalEmployeeLifecycle(c.employeeId, "probation");

  const next = upsertCase({
    ...c,
    employeeId: employeeCode,
    status: "joined",
    activatedAt: nowIso(),
    progressPct: 100,
  });
  appendOnboardingAudit({
    caseId,
    action: "activate_employee",
    detail: `Local activate Emp ID ${employeeCode}`,
    actor: actor(),
  });
  return next;
}

/** @deprecated Use completeOnboarding or activateOnboardingEmployee */
export async function activateEmployee(
  caseId: string,
  opts?: { employeeCode?: string; shiftId?: string },
): Promise<OnboardingCase | null> {
  const c = getCaseById(caseId);
  if (!c) return null;
  if (c.status === "pending_join") {
    return activateOnboardingEmployee(caseId, opts);
  }
  return completeOnboarding(caseId, opts);
}

export function exportOnboardingCsv(cases: OnboardingCase[]): string {
  const header = [
    "Case",
    "Candidate",
    "Email",
    "Offer",
    "Joining Date",
    "Department",
    "Designation",
    "Status",
    "Progress %",
    "Employee ID",
  ];
  const lines = cases.map((c) =>
    [
      c.caseCode,
      c.candidateName,
      c.candidateEmail,
      c.offerCode,
      c.joiningDate,
      c.department,
      c.designation,
      c.status,
      String(c.progressPct),
      c.employeeId ?? "",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

export function downloadTextFile(filename: string, content: string, mime = "text/csv"): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function joiningThisWeek(cases: OnboardingCase[]): OnboardingCase[] {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  const a = start.toISOString().slice(0, 10);
  const b = end.toISOString().slice(0, 10);
  return cases.filter((c) => c.joiningDate >= a && c.joiningDate <= b);
}

export function stepIndex(step: PortalStepId): number {
  return PORTAL_STEPS.findIndex((s) => s.id === step);
}
