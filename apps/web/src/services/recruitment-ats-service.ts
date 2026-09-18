/**
 * Enterprise ATS service — API-first with local cache fallback.
 */

import { resourceService } from "@/services/api-client";
import { loadRecruitmentOverview, candidateDisplayName, asStatus } from "@/services/recruitment-service";
import type {
  AtsAuditEntry,
  AtsCandidate,
  AtsDocument,
  AtsFilters,
  AtsInterview,
  AtsOffer,
  CandidatePipelineStatus,
  CreateCandidateInput,
  CreateJobInput,
  JobOpening,
  PipelineApplication,
  PipelineStage,
  StageHistoryEntry,
} from "@/types/recruitment-ats";
import { PIPELINE_STAGES } from "@/types/recruitment-ats";
import {
  computeBackoutRate,
  markBackedOut as cfgMarkBackedOut,
  markHired as cfgMarkHired,
  markOfferDeclined as cfgMarkOfferDeclined,
  markRejected as cfgMarkRejected,
  nextStage,
  normalizeStage,
} from "@/config/pipeline-config";
import { devError, devWarn } from "@/lib/dev-log";

const JOBS_KEY = "erp_ats_jobs_v1";
const CANDS_KEY = "erp_ats_candidates_v1";
const APPS_KEY = "erp_ats_applications_v1";
const INTS_KEY = "erp_ats_interviews_v1";
const OFFERS_KEY = "erp_ats_offers_v1";
const DOCS_KEY = "erp_ats_docs_v1";
const AUDIT_KEY = "erp_ats_audit_v1";
const SEQ_KEY = "erp_ats_seq_v1";

type SeqBag = { job: number; cand: number; app: number; int: number; offer: number };

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

function nextCode(kind: keyof SeqBag, prefix: string, pad = 6): string {
  const seq = readJson<SeqBag>(SEQ_KEY, { job: 0, cand: 0, app: 0, int: 0, offer: 0 });
  seq[kind] += 1;
  writeJson(SEQ_KEY, seq);
  return `${prefix}-${String(seq[kind]).padStart(pad, "0")}`;
}

export function appendAtsAudit(entry: Omit<AtsAuditEntry, "id" | "at">): void {
  const all = readJson<AtsAuditEntry[]>(AUDIT_KEY, []);
  all.unshift({ ...entry, id: crypto.randomUUID(), at: nowIso() });
  writeJson(AUDIT_KEY, all.slice(0, 5000));
}

export function listAtsAudit(): AtsAuditEntry[] {
  return readJson<AtsAuditEntry[]>(AUDIT_KEY, []);
}

function loadJobs(): JobOpening[] {
  return readJson<JobOpening[]>(JOBS_KEY, []);
}
function saveJobs(rows: JobOpening[]) {
  writeJson(JOBS_KEY, rows);
}
function loadCandidates(): AtsCandidate[] {
  return readJson<AtsCandidate[]>(CANDS_KEY, []).map((c) => ({
    ...c,
    address: c.address ?? "",
    state: c.state ?? "",
    pincode: c.pincode ?? "",
    resumeUrl: c.resumeUrl ?? "",
  }));
}
function saveCandidates(rows: AtsCandidate[]) {
  writeJson(CANDS_KEY, rows);
}
function loadApps(): PipelineApplication[] {
  return readJson<PipelineApplication[]>(APPS_KEY, []);
}
function saveApps(rows: PipelineApplication[]) {
  writeJson(APPS_KEY, rows);
}
function loadInterviews(): AtsInterview[] {
  return readJson<AtsInterview[]>(INTS_KEY, []).map((i) => ({
    ...i,
    round: i.round || (i.interviewType as AtsInterview["round"]) || "round_1",
    participantIds: i.participantIds ?? [],
    participantNames: i.participantNames ?? [],
    resumeLink: i.resumeLink ?? "",
    sectionContent: i.sectionContent ?? "",
  }));
}
function saveInterviews(rows: AtsInterview[]) {
  writeJson(INTS_KEY, rows);
}
function loadOffers(): AtsOffer[] {
  return readJson<AtsOffer[]>(OFFERS_KEY, []).map((o) => ({
    ...o,
    templateFileName: o.templateFileName ?? o.offerLetterName ?? "",
    mergedPreview: o.mergedPreview ?? "",
  }));
}
function saveOffers(rows: AtsOffer[]) {
  writeJson(OFFERS_KEY, rows);
}
function loadDocs(): AtsDocument[] {
  return readJson<AtsDocument[]>(DOCS_KEY, []);
}
function saveDocs(rows: AtsDocument[]) {
  writeJson(DOCS_KEY, rows);
}

export type AtsDirectory = {
  jobs: JobOpening[];
  candidates: AtsCandidate[];
  applications: PipelineApplication[];
  interviews: AtsInterview[];
  offers: AtsOffer[];
  documents: AtsDocument[];
  departments: string[];
  apiPartial: boolean;
};

export async function loadAtsDirectory(): Promise<AtsDirectory> {
  let jobs = loadJobs();
  let candidates = loadCandidates();
  let applications = loadAppsNormalized();
  const interviews = loadInterviews();
  let offers = loadOffers();
  const documents = loadDocs();
  let apiPartial = false;

  try {
    const overview = await loadRecruitmentOverview();
    apiPartial = overview.partial;

    // Prefer API as SoR for lists when overview returns rows (local cache becomes mirror).
    if (overview.requisitions.length) {
      const localOnly = jobs.filter((j) => !j.apiId);
      jobs = [
        ...overview.requisitions.map((r, i) => ({
        id: String(r.id ?? crypto.randomUUID()),
        jobCode: String(r.document_number ?? `JOB-${String(i + 1).padStart(6, "0")}`),
        title: String(r.requisition_title ?? r.title ?? "Role"),
        department: String(r.department_name ?? r.department_id ?? "—"),
        designation: String(r.designation_name ?? r.designation_id ?? "—"),
        employmentType: (String(r.employment_type ?? "full_time") as JobOpening["employmentType"]),
        branch: String(r.branch_name ?? r.branch_id ?? "Head Office"),
        location: String(r.location ?? r.city ?? "—"),
        hiringManager: String(r.hiring_manager_name ?? "—"),
        recruiter: String(r.recruiter_name ?? "—"),
        positions: Number(r.openings_count ?? 1),
        filled: Number(r.filled_count ?? 0),
        salaryMin: Number(r.salary_band_min ?? 0),
        salaryMax: Number(r.salary_band_max ?? 0),
        experienceMin: Number(r.min_experience_years ?? 0),
        experienceMax: Number(r.max_experience_years ?? 0),
        skills: [] as string[],
        description: String(r.description ?? ""),
        deadline: String(r.target_hire_date ?? ""),
        priority: (String(r.priority ?? "medium").toLowerCase() as JobOpening["priority"]) || "medium",
        status:
          asStatus(r.status).includes("hold")
            ? ("on_hold" as const)
            : asStatus(r.status).includes("close") || asStatus(r.status).includes("filled")
              ? ("closed" as const)
              : asStatus(r.status).includes("draft")
                ? ("draft" as const)
                : ("open" as const),
        createdAt: String(r.created_at ?? r.posted_at ?? nowIso()),
        updatedAt: String(r.updated_at ?? r.created_at ?? nowIso()),
        apiId: String(r.id ?? ""),
      })),
        ...localOnly,
      ];
      saveJobs(jobs);
    }

    if (overview.candidates.length) {
      const localOnly = candidates.filter((c) => !c.apiId);
      candidates = [
        ...overview.candidates.map((c, i) => ({
        id: String(c.id ?? crypto.randomUUID()),
        candidateCode: String(c.candidate_code ?? `CAN-${String(i + 1).padStart(6, "0")}`),
        fullName: candidateDisplayName(c),
        email: String(c.email ?? ""),
        phone: String(c.mobile ?? c.phone ?? ""),
        alternatePhone: "",
        gender: String(c.gender ?? ""),
        dob: String(c.date_of_birth ?? ""),
        currentCompany: String(c.current_employer ?? ""),
        currentDesignation: String(c.current_title ?? ""),
        experienceYears: Number(c.total_experience_years ?? 0),
        expectedSalary: Number(c.expected_ctc ?? 0),
        noticePeriodDays: Number(c.notice_period_days ?? 0),
        location: String(c.location ?? ""),
        address: String(c.address ?? c.location ?? ""),
        state: String(c.state ?? ""),
        pincode: String(c.pincode ?? c.pin_code ?? ""),
        resumeName: String(c.resume_name ?? ""),
        resumeUrl: String(c.resume_uri ?? c.resume_url ?? ""),
        portfolioUrl: "",
        linkedinUrl: String(c.linkedin_url ?? ""),
        source: "other" as const,
        recruiter: String(c.recruiter_name ?? ""),
        createdAt: String(c.created_at ?? nowIso()),
        updatedAt: String(c.updated_at ?? c.created_at ?? nowIso()),
        apiId: String(c.id ?? ""),
      })),
        ...localOnly,
      ];
      saveCandidates(candidates);
    }

    if (overview.applications.length) {
      applications = overview.applications.map((a, i) => {
        const stageRaw = String(a.current_stage_code ?? a.status ?? "sourced").toLowerCase();
        const statusRaw = String(a.status ?? "active").toLowerCase();
        const stage = normalizeStage(stageRaw);
        let status: CandidatePipelineStatus = "active";
        if (statusRaw === "hired" || statusRaw.includes("hire")) status = "hired";
        else if (statusRaw === "backed_out") status = "backed_out";
        else if (statusRaw === "offer_declined") status = "offer_declined";
        else if (statusRaw === "rejected" || statusRaw.includes("reject")) status = "rejected";
        else if (
          ["applied", "screening", "interview", "selected", "offer", "on_hold", "active", "sourced"].some(
            (s) => statusRaw === s || statusRaw.includes(s),
          )
        ) {
          status = "active";
        } else if (statusRaw === "withdrawn") {
          status = "backed_out";
        }

        const exitedAtStage = a.exited_at_stage
          ? normalizeStage(String(a.exited_at_stage))
          : status !== "active"
            ? stage
            : null;

        return {
          id: String(a.id ?? crypto.randomUUID()),
          applicationCode: String(a.document_number ?? `APP-${String(i + 1).padStart(6, "0")}`),
          candidateId: String(a.candidate_id ?? ""),
          jobId: String(a.job_requisition_id ?? ""),
          stage,
          status,
          appliedAt: String(a.applied_at ?? nowIso()).slice(0, 10),
          notes: "",
          updatedAt: nowIso(),
          stageEnteredAt: String(a.updated_at ?? a.applied_at ?? nowIso()),
          exitedAtStage,
          exitedAt: a.exited_at ? String(a.exited_at) : null,
          exitReason: a.exit_reason
            ? String(a.exit_reason)
            : a.rejection_reason
              ? String(a.rejection_reason)
              : null,
          stageHistory: [
            {
              stage,
              label: PIPELINE_STAGES.find((s) => s.id === stage)?.label ?? stage,
              enteredAt: String(a.applied_at ?? nowIso()).slice(0, 10),
            },
          ] satisfies StageHistoryEntry[],
        };
      });
      saveApps(applications);
    }

    if (overview.offers.length) {
      offers = overview.offers.map((o, i) => {
        const s = asStatus(o.status);
        const status: AtsOffer["status"] = s.includes("accept")
          ? "accepted"
          : s.includes("reject")
            ? "rejected"
            : s.includes("expir")
              ? "expired"
              : s.includes("sent") || s.includes("issued")
                ? "sent"
                : "draft";
        return {
          id: String(o.id ?? crypto.randomUUID()),
          offerCode: String(o.document_number ?? `OFF-${String(i + 1).padStart(6, "0")}`),
          candidateId: String(o.candidate_id ?? ""),
          jobId: String(o.job_requisition_id ?? ""),
          applicationId: String(o.application_id ?? ""),
          department: String(o.department_name ?? o.department_id ?? "—"),
          joiningDate: String(o.joining_date ?? ""),
          ctc: Number(o.offered_ctc ?? o.ctc ?? 0),
          expiryDate: String(o.offer_valid_until ?? ""),
          offerLetterName: String(o.offer_letter_uri ?? ""),
          templateFileName: String(o.template_file_name ?? o.offer_letter_uri ?? ""),
          mergedPreview: String(o.merged_preview ?? ""),
          status,
          createdAt: String(o.created_at ?? nowIso()),
          updatedAt: String(o.updated_at ?? o.created_at ?? nowIso()),
        };
      });
      saveOffers(offers);
    }
  } catch {
    apiPartial = true;
  }

  const departments = Array.from(
    new Set(jobs.map((j) => j.department).filter((d) => d && d !== "—")),
  ).sort();

  return {
    jobs,
    candidates,
    applications,
    interviews,
    offers,
    documents,
    departments,
    apiPartial,
  };
}

export function computeAtsStats(dir: AtsDirectory) {
  const openJobs = dir.jobs.filter((j) => j.status === "open");
  const shortlisted = dir.applications.filter(
    (a) =>
      a.status === "active" &&
      ["interview_round_1", "interview_round_2", "hr_discussion"].includes(a.stage),
  );
  const interviewScheduled = dir.interviews.filter((i) => i.status === "scheduled");
  const offersSent = dir.offers.filter((o) => o.status === "sent");
  const offersAccepted = dir.offers.filter((o) => o.status === "accepted");
  const hired = dir.applications.filter((a) => a.status === "hired");
  const backedOut = dir.applications.filter((a) => a.status === "backed_out");
  const bgPending = dir.applications.filter(
    (a) => a.status === "active" && a.stage === "background_check",
  );
  const filled = dir.jobs.reduce((s, j) => s + j.filled, 0);

  let avgDays = 0;
  const hiredApps = dir.applications.filter((a) => a.status === "hired" && a.appliedAt);
  if (hiredApps.length) {
    const sum = hiredApps.reduce((acc, a) => {
      const start = new Date(a.appliedAt).getTime();
      const end = new Date(a.exitedAt || a.updatedAt).getTime();
      return acc + Math.max(0, Math.round((end - start) / 86400000));
    }, 0);
    avgDays = Math.round(sum / hiredApps.length);
  }

  return {
    openPositions: openJobs.reduce((s, j) => s + Math.max(0, j.positions - j.filled), 0),
    applications: dir.applications.length,
    shortlisted: shortlisted.length,
    interviewScheduled: interviewScheduled.length,
    offersSent: offersSent.length,
    offersAccepted: offersAccepted.length,
    positionsFilled: filled || hired.length,
    avgTimeToHire: avgDays,
    backgroundChecksPending: bgPending.length,
    backedOut: backedOut.length,
    backoutRate: computeBackoutRate(hired.length, backedOut.length),
    offerAcceptanceRate:
      offersSent.length + offersAccepted.length === 0
        ? 0
        : Math.round(
            (offersAccepted.length /
              Math.max(1, offersAccepted.length + dir.offers.filter((o) => o.status === "rejected").length)) *
              100,
          ),
  };
}

export async function createJob(input: CreateJobInput): Promise<JobOpening> {
  const row: JobOpening = {
    ...input,
    id: crypto.randomUUID(),
    jobCode: nextCode("job", "JOB"),
    filled: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  // Persist via Recruitment API when branch + hiring manager UUIDs are available on window context
  try {
    const ctx = readJson<{
      branchId?: string;
      departmentId?: string;
      hiringManagerEmployeeId?: string;
    }>("erp_ats_api_context_v1", {});
    if (ctx.branchId && ctx.departmentId && ctx.hiringManagerEmployeeId) {
      const res = await resourceService.create<Record<string, unknown>>("/recruitment/job-requisitions", {
        branch_id: ctx.branchId,
        requisition_title: input.title,
        department_id: ctx.departmentId,
        employment_type: input.employmentType || "permanent",
        openings_count: input.positions || 1,
        hiring_manager_employee_id: ctx.hiringManagerEmployeeId,
        priority: input.priority || "medium",
        min_experience_years: input.experienceMin,
        max_experience_years: input.experienceMax,
        salary_band_min: input.salaryMin,
        salary_band_max: input.salaryMax,
        currency_code: "INR",
        job_description: input.description,
        status: "draft",
      });
      const apiId = String(res.data?.id ?? "");
      const doc = String(res.data?.document_number ?? row.jobCode);
      if (apiId) {
        row.apiId = apiId;
        row.jobCode = doc;
        row.id = apiId;
      }
    }
  } catch (err) {
    devWarn("ATS createJob API failed; keeping local cache");
  }

  const all = loadJobs();
  all.unshift(row);
  saveJobs(all);
  appendAtsAudit({
    action: "create_job",
    detail: `Created ${row.jobCode} — ${row.title}${row.apiId ? " (API)" : " (local)"}`,
    actor: actor(),
    entityId: row.id,
  });
  return row;
}

export async function updateJob(id: string, patch: Partial<JobOpening>): Promise<JobOpening | null> {
  const all = loadJobs();
  const idx = all.findIndex((j) => j.id === id);
  if (idx < 0) return null;
  const prev = all[idx];
  all[idx] = { ...all[idx], ...patch, updatedAt: nowIso() };
  const row = all[idx];

  // Publish / open path: submit → approve requisition, then create+publish posting when apiId present
  if (row.apiId && patch.status === "open" && prev.status !== "open") {
    try {
      const ctx = readJson<{ branchId?: string }>("erp_ats_api_context_v1", {});
      await resourceService.action("/recruitment/job-requisitions", row.apiId, "submit", {});
      await resourceService.action("/recruitment/job-requisitions", row.apiId, "approve", {});
      if (ctx.branchId) {
        const posting = await resourceService.create<Record<string, unknown>>("/recruitment/job-postings", {
          branch_id: ctx.branchId,
          job_requisition_id: row.apiId,
          posting_title: row.title,
          channel: "career_site",
          status: "draft",
        });
        const postingId = String(posting.data?.id ?? "");
        if (postingId) {
          await resourceService.action("/recruitment/job-postings", postingId, "publish", {});
        }
      }
      appendAtsAudit({
        action: "publish_job",
        detail: `Published ${row.jobCode} via API`,
        actor: actor(),
        entityId: id,
      });
    } catch (err) {
      devWarn("ATS publishJob API failed; local status still updated");
    }
  }

  saveJobs(all);
  appendAtsAudit({
    action: "update_job",
    detail: `Updated ${row.jobCode}`,
    actor: actor(),
    entityId: id,
  });
  return row;
}

/** Explicit publish helper used by ATS UI actions. */
export async function publishJob(id: string): Promise<JobOpening | null> {
  return updateJob(id, { status: "open" });
}

export async function createCandidate(input: CreateCandidateInput): Promise<AtsCandidate> {
  // Duplicate detection by email
  const existing = loadCandidates().find(
    (c) => c.email && input.email && c.email.toLowerCase() === input.email.toLowerCase(),
  );
  if (existing) {
    appendAtsAudit({
      action: "duplicate_candidate",
      detail: `Duplicate email blocked: ${input.email} matches ${existing.candidateCode}`,
      actor: actor(),
      entityId: existing.id,
    });
    throw new Error(`Duplicate candidate: ${existing.candidateCode} already uses ${input.email}`);
  }

  const nameParts = input.fullName.trim().split(/\s+/);
  const firstName = nameParts[0] || input.fullName;
  const lastName = nameParts.slice(1).join(" ") || "-";

  const row: AtsCandidate = {
    ...input,
    id: crypto.randomUUID(),
    candidateCode: nextCode("cand", "CAN"),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  try {
    const res = await resourceService.create<Record<string, unknown>>("/recruitment/candidates", {
      first_name: firstName,
      last_name: lastName,
      full_name: input.fullName,
      email: input.email,
      mobile: input.phone || null,
      current_title: input.currentDesignation || null,
      current_employer: input.currentCompany || null,
      total_experience_years: input.experienceYears ?? null,
      status: "prospect",
    });
    const apiId = String(res.data?.id ?? "");
    const code = String(res.data?.candidate_code ?? row.candidateCode);
    if (apiId) {
      row.apiId = apiId;
      row.id = apiId;
      row.candidateCode = code;
    }
  } catch (err) {
    devWarn("ATS createCandidate API failed; keeping local cache");
  }

  const all = loadCandidates();
  all.unshift(row);
  saveCandidates(all);
  appendAtsAudit({
    action: "create_candidate",
    detail: `Added ${row.candidateCode} — ${row.fullName}${row.apiId ? " (API)" : " (local)"}`,
    actor: actor(),
    entityId: row.id,
  });
  return row;
}

export async function updateCandidate(
  id: string,
  patch: Partial<CreateCandidateInput>,
): Promise<AtsCandidate | null> {
  const all = loadCandidates();
  const idx = all.findIndex((c) => c.id === id);
  if (idx < 0) return null;

  if (patch.email) {
    const dup = all.find(
      (c) =>
        c.id !== id &&
        c.email &&
        c.email.toLowerCase() === patch.email!.toLowerCase(),
    );
    if (dup) {
      throw new Error(`Duplicate email: ${dup.candidateCode} already uses ${patch.email}`);
    }
  }

  all[idx] = { ...all[idx], ...patch, updatedAt: nowIso() };
  const row = all[idx];

  try {
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRe.test(id)) {
      const nameParts = (patch.fullName ?? row.fullName).trim().split(/\s+/);
      await resourceService.update("/recruitment/candidates", id, {
        first_name: nameParts[0] || row.fullName,
        last_name: nameParts.slice(1).join(" ") || "-",
        full_name: patch.fullName ?? row.fullName,
        email: patch.email ?? row.email,
        mobile: patch.phone ?? row.phone,
        current_title: patch.currentDesignation ?? row.currentDesignation,
        current_employer: patch.currentCompany ?? row.currentCompany,
        total_experience_years: patch.experienceYears ?? row.experienceYears,
      });
    }
  } catch {
    devWarn("ATS updateCandidate API failed; local cache kept");
  }

  saveCandidates(all);
  appendAtsAudit({
    action: "update_candidate",
    detail: `Updated ${row.candidateCode}`,
    actor: actor(),
    entityId: id,
  });
  return row;
}

export function updateApplicationNotes(
  applicationId: string,
  notes: string,
): PipelineApplication | null {
  const apps = loadApps();
  const idx = apps.findIndex((a) => a.id === applicationId);
  if (idx < 0) return null;
  apps[idx] = { ...apps[idx], notes, updatedAt: nowIso() };
  saveApps(apps);
  appendAtsAudit({
    action: "update_notes",
    detail: `Updated notes on ${apps[idx].applicationCode}`,
    actor: actor(),
    entityId: applicationId,
  });
  return apps[idx];
}

export async function applyCandidateToJob(
  candidateId: string,
  jobId: string,
  stage: PipelineStage = "sourced",
): Promise<PipelineApplication> {
  const apps = loadApps();
  const dup = apps.find(
    (a) => a.candidateId === candidateId && a.jobId === jobId && a.status === "active",
  );
  if (dup) return dup;

  const row: PipelineApplication = {
    id: crypto.randomUUID(),
    applicationCode: nextCode("app", "APP"),
    candidateId,
    jobId,
    stage: normalizeStage(stage),
    status: "active",
    appliedAt: nowIso().slice(0, 10),
    notes: "",
    updatedAt: nowIso(),
    stageEnteredAt: nowIso(),
    stageHistory: [
      {
        stage: normalizeStage(stage),
        label: PIPELINE_STAGES.find((s) => s.id === normalizeStage(stage))?.label ?? stage,
        enteredAt: nowIso().slice(0, 10),
      },
    ],
  };

  try {
    const ctx = readJson<{ branchId?: string }>("erp_ats_api_context_v1", {});
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (ctx.branchId && uuidRe.test(candidateId) && uuidRe.test(jobId)) {
      const res = await resourceService.create<Record<string, unknown>>("/recruitment/applications", {
        branch_id: ctx.branchId,
        candidate_id: candidateId,
        job_requisition_id: jobId,
        status: "active",
        current_stage_code: "sourced",
      });
      const apiId = String(res.data?.id ?? "");
      if (apiId) {
        row.id = apiId;
        row.applicationCode = String(res.data?.document_number ?? row.applicationCode);
      }
    }
  } catch (err) {
    devWarn("ATS applyCandidateToJob API failed; local cache kept");
  }

  apps.unshift(row);
  saveApps(apps);
  appendAtsAudit({
    action: "apply",
    detail: `Application ${row.applicationCode} → ${row.stage}`,
    actor: actor(),
    entityId: row.id,
  });
  return row;
}

const ATS_TO_API_STAGE: Record<PipelineStage, string> = {
  sourced: "sourced",
  screening: "screening",
  interview_round_1: "interview_round_1",
  interview_round_2: "interview_round_2",
  hr_discussion: "hr_discussion",
  background_check: "background_check",
  offer_sent: "offer_sent",
  offer_accepted: "offer_accepted",
};

function appendHistory(
  app: PipelineApplication,
  next: PipelineStage,
): StageHistoryEntry[] {
  const hist = [...(app.stageHistory ?? [])];
  const last = hist[hist.length - 1];
  if (last && !last.exitedAt) {
    last.exitedAt = nowIso().slice(0, 10);
  }
  hist.push({
    stage: next,
    label: PIPELINE_STAGES.find((s) => s.id === next)?.label ?? next,
    enteredAt: nowIso().slice(0, 10),
  });
  return hist;
}

function normalizeCachedApp(app: PipelineApplication): PipelineApplication {
  const stage = normalizeStage(app.stage as string);
  const status = (app.status as CandidatePipelineStatus) || "active";
  return {
    ...app,
    stage,
    status:
      status === "hired" ||
      status === "rejected" ||
      status === "backed_out" ||
      status === "offer_declined" ||
      status === "active"
        ? status
        : "active",
  };
}

function loadAppsNormalized(): PipelineApplication[] {
  return loadApps().map(normalizeCachedApp);
}

export async function moveApplicationStage(
  applicationId: string,
  stage: PipelineStage,
): Promise<PipelineApplication | null> {
  const apps = loadAppsNormalized();
  const idx = apps.findIndex((a) => a.id === applicationId);
  if (idx < 0) return null;
  if (apps[idx].status !== "active") {
    // Offer / exit flows may attempt a stage move on a closed application — no-op.
    return apps[idx];
  }

  const target = normalizeStage(stage);

  try {
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRe.test(applicationId)) {
      await resourceService.action("/recruitment/applications", applicationId, "advance", {
        stage: ATS_TO_API_STAGE[target] || target,
      });
    }
  } catch (err) {
    devWarn("ATS moveApplicationStage API failed; local cache kept");
  }

  apps[idx] = {
    ...apps[idx],
    stage: target,
    updatedAt: nowIso(),
    stageEnteredAt: nowIso(),
    stageHistory: appendHistory(apps[idx], target),
  };
  saveApps(apps);

  appendAtsAudit({
    action: "pipeline_move",
    detail: `${apps[idx].applicationCode} → ${target}`,
    actor: actor(),
    entityId: applicationId,
  });
  return apps[idx];
}

export async function advanceApplication(applicationId: string): Promise<PipelineApplication | null> {
  const apps = loadAppsNormalized();
  const app = apps.find((a) => a.id === applicationId);
  if (!app) return null;
  const nxt = nextStage(app.stage);
  if (!nxt) throw new Error("Already at final stage");
  return moveApplicationStage(applicationId, nxt);
}

export async function rejectApplication(
  applicationId: string,
  reason: string,
): Promise<PipelineApplication | null> {
  const apps = loadAppsNormalized();
  const idx = apps.findIndex((a) => a.id === applicationId);
  if (idx < 0) return null;
  const result = cfgMarkRejected({ stage: apps[idx].stage, exitReason: reason });

  try {
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRe.test(applicationId)) {
      await resourceService.action("/recruitment/applications", applicationId, "reject", {
        reason,
      });
    }
  } catch (err) {
    devWarn("ATS rejectApplication API failed; local cache kept");
  }

  apps[idx] = {
    ...apps[idx],
    status: result.status,
    exitedAtStage: result.exitedAtStage,
    exitReason: result.exitReason,
    exitedAt: nowIso(),
    updatedAt: nowIso(),
  };
  saveApps(apps);
  appendAtsAudit({
    action: "reject",
    detail: `${apps[idx].applicationCode} rejected at ${result.exitedAtStage}: ${reason}`,
    actor: actor(),
    entityId: applicationId,
  });
  return apps[idx];
}

export async function markApplicationHired(
  applicationId: string,
): Promise<PipelineApplication | null> {
  const apps = loadAppsNormalized();
  const idx = apps.findIndex((a) => a.id === applicationId);
  if (idx < 0) return null;
  cfgMarkHired({ stage: apps[idx].stage, status: apps[idx].status });

  try {
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRe.test(applicationId)) {
      await resourceService.action("/recruitment/applications", applicationId, "mark-hired", {});
    }
  } catch (err) {
    devWarn("ATS markApplicationHired API failed; local cache kept");
  }

  apps[idx] = {
    ...apps[idx],
    status: "hired",
    exitedAtStage: "offer_accepted",
    exitedAt: nowIso(),
    updatedAt: nowIso(),
  };
  saveApps(apps);

  const jobs = loadJobs();
  const jIdx = jobs.findIndex((j) => j.id === apps[idx].jobId);
  if (jIdx >= 0) {
    jobs[jIdx] = {
      ...jobs[jIdx],
      filled: Math.min(jobs[jIdx].positions, jobs[jIdx].filled + 1),
      updatedAt: nowIso(),
    };
    saveJobs(jobs);
  }

  appendAtsAudit({
    action: "mark_hired",
    detail: `${apps[idx].applicationCode} hired`,
    actor: actor(),
    entityId: applicationId,
  });
  return apps[idx];
}

export async function markApplicationBackedOut(
  applicationId: string,
  reason: string,
): Promise<PipelineApplication | null> {
  const apps = loadAppsNormalized();
  const idx = apps.findIndex((a) => a.id === applicationId);
  if (idx < 0) return null;
  const result = cfgMarkBackedOut({
    stage: apps[idx].stage,
    status: apps[idx].status,
    exitReason: reason,
  });

  try {
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRe.test(applicationId)) {
      await resourceService.action(
        "/recruitment/applications",
        applicationId,
        "mark-backed-out",
        { reason },
      );
    }
  } catch (err) {
    devWarn("ATS markApplicationBackedOut API failed; local cache kept");
  }

  apps[idx] = {
    ...apps[idx],
    status: result.status,
    exitedAtStage: result.exitedAtStage,
    exitReason: result.exitReason,
    exitedAt: nowIso(),
    updatedAt: nowIso(),
  };
  saveApps(apps);
  appendAtsAudit({
    action: "backed_out",
    detail: `${apps[idx].applicationCode} backed out: ${reason}`,
    actor: actor(),
    entityId: applicationId,
  });
  return apps[idx];
}

export async function scheduleInterview(
  input: Omit<
    AtsInterview,
    "id" | "interviewCode" | "createdAt" | "status" | "notes" | "feedback" | "rating" | "recommendation"
  > & {
    status?: AtsInterview["status"];
    notes?: string;
    feedback?: string;
    rating?: number;
    recommendation?: AtsInterview["recommendation"];
  },
): Promise<AtsInterview> {
  const round =
    input.round ||
    (input.interviewType === "hr"
      ? "hr"
      : input.interviewType === "round_2"
        ? "round_2"
        : "round_1");

  const row: AtsInterview = {
    ...input,
    round,
    interviewType: round,
    participantIds: input.participantIds ?? [],
    participantNames: input.participantNames ?? [],
    resumeLink: input.resumeLink ?? "",
    sectionContent: input.sectionContent ?? "",
    notes: input.notes ?? "",
    feedback: input.feedback ?? "",
    rating: input.rating ?? 0,
    recommendation: input.recommendation ?? "",
    id: crypto.randomUUID(),
    interviewCode: nextCode("int", "INT"),
    status: input.status ?? "scheduled",
    createdAt: nowIso(),
  };

  try {
    const ctx = readJson<{
      branchId?: string;
      interviewerEmployeeId?: string;
    }>("erp_ats_api_context_v1", {});
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const interviewerId = input.participantIds?.[0] || ctx.interviewerEmployeeId;
    if (
      ctx.branchId &&
      interviewerId &&
      uuidRe.test(input.candidateId) &&
      uuidRe.test(input.applicationId)
    ) {
      const scheduledAt = new Date(`${input.date}T${input.time || "10:00"}:00`).toISOString();
      const typeMap: Record<string, string> = {
        hr: "hr_round",
        round_1: "technical",
        round_2: "manager",
        technical: "technical",
        manager: "manager",
        final: "final",
      };
      const res = await resourceService.create<Record<string, unknown>>("/recruitment/interviews", {
        branch_id: ctx.branchId,
        application_id: input.applicationId,
        candidate_id: input.candidateId,
        interview_type: typeMap[round] || "other",
        scheduled_at: scheduledAt,
        duration_minutes: 60,
        interviewer_employee_id: interviewerId,
        location: input.location || null,
        meeting_url: input.meetingLink || null,
        status: "scheduled",
      });
      const apiId = String(res.data?.id ?? "");
      if (apiId) {
        row.id = apiId;
        row.interviewCode = String(res.data?.document_number ?? row.interviewCode);
      }
    }
  } catch (err) {
    devWarn("ATS scheduleInterview API failed; local cache kept");
  }

  // Advance application into the matching interview stage when still earlier
  if (input.applicationId) {
    const apps = loadAppsNormalized();
    const app = apps.find((a) => a.id === input.applicationId);
    if (app && app.status === "active") {
      const target: PipelineStage =
        round === "hr"
          ? "hr_discussion"
          : round === "round_2"
            ? "interview_round_2"
            : "interview_round_1";
      const order = PIPELINE_STAGES.map((s) => s.id);
      if (order.indexOf(app.stage) < order.indexOf(target)) {
        void moveApplicationStage(input.applicationId, target);
      }
    }
  }

  const all = loadInterviews();
  all.unshift(row);
  saveInterviews(all);
  appendAtsAudit({
    action: "schedule_interview",
    detail: `${row.interviewCode} (${row.round}) on ${row.date} ${row.time}`,
    actor: actor(),
    entityId: row.id,
  });
  return row;
}

export async function updateInterview(
  id: string,
  patch: Partial<AtsInterview>,
): Promise<AtsInterview | null> {
  const all = loadInterviews();
  const idx = all.findIndex((i) => i.id === id);
  if (idx < 0) return null;
  all[idx] = { ...all[idx], ...patch };
  const row = all[idx];

  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidRe.test(id)) {
    try {
      const body: Record<string, unknown> = {};
      if (patch.status) body.status = patch.status;
      if (patch.meetingLink !== undefined) body.meeting_url = patch.meetingLink;
      if (patch.location !== undefined) body.location = patch.location;
      if (patch.date || patch.time) {
        const d = patch.date || row.date;
        const t = patch.time || row.time || "10:00";
        body.scheduled_at = new Date(`${d}T${t}:00`).toISOString();
      }
      if (Object.keys(body).length) {
        await resourceService.update("/recruitment/interviews", id, body);
      }
    } catch (err) {
      devWarn("ATS updateInterview API failed; local cache kept");
    }
  }

  saveInterviews(all);
  appendAtsAudit({
    action: "update_interview",
    detail: `Updated ${row.interviewCode}`,
    actor: actor(),
    entityId: id,
  });
  return row;
}

/** Record post-interview outcome and advance / reject the application. */
export async function recordInterviewOutcome(input: {
  interviewId: string;
  recommendation: "selected" | "hold" | "rejected";
  feedback: string;
}): Promise<AtsInterview | null> {
  const all = loadInterviews();
  const idx = all.findIndex((i) => i.id === input.interviewId);
  if (idx < 0) return null;

  const interview = all[idx];
  all[idx] = {
    ...interview,
    recommendation: input.recommendation,
    feedback: input.feedback,
    status: "completed",
  };
  saveInterviews(all);

  if (interview.applicationId) {
    if (input.recommendation === "rejected") {
      await rejectApplication(
        interview.applicationId,
        input.feedback.trim() || "Rejected after interview",
      );
    } else if (input.recommendation === "selected") {
      const next: PipelineStage =
        interview.round === "round_1"
          ? "interview_round_2"
          : interview.round === "round_2"
            ? "hr_discussion"
            : interview.round === "hr"
              ? "background_check"
              : "hr_discussion";
      await moveApplicationStage(interview.applicationId, next);
    }
    // hold → stay on stage
  }

  appendAtsAudit({
    action: "interview_outcome",
    detail: `${interview.interviewCode} → ${input.recommendation}`,
    actor: actor(),
    entityId: interview.id,
  });
  return all[idx];
}

export async function generateOffer(
  input: Omit<AtsOffer, "id" | "offerCode" | "createdAt" | "updatedAt" | "status"> & {
    status?: AtsOffer["status"];
  },
): Promise<AtsOffer> {
  const row: AtsOffer = {
    ...input,
    templateFileName: input.templateFileName || input.offerLetterName || "offer-letter.pdf",
    mergedPreview: input.mergedPreview || "",
    offerLetterName: input.offerLetterName || input.templateFileName || "offer-letter.pdf",
    id: crypto.randomUUID(),
    offerCode: nextCode("offer", "OFF"),
    status: input.status ?? "draft",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  try {
    const ctx = readJson<{
      branchId?: string;
      departmentId?: string;
      jobRequisitionId?: string;
    }>("erp_ats_api_context_v1", {});
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (
      ctx.branchId &&
      ctx.departmentId &&
      ctx.jobRequisitionId &&
      uuidRe.test(input.candidateId) &&
      uuidRe.test(input.applicationId)
    ) {
      const res = await resourceService.create<Record<string, unknown>>("/recruitment/offers", {
        branch_id: ctx.branchId,
        application_id: input.applicationId,
        candidate_id: input.candidateId,
        job_requisition_id: ctx.jobRequisitionId,
        department_id: ctx.departmentId,
        offered_ctc: input.ctc,
        offered_gross: input.ctc,
        currency_code: "INR",
        joining_date: input.joiningDate,
        offer_valid_until: input.expiryDate || null,
        employment_type: "permanent",
        status: "draft",
      });
      const apiId = String(res.data?.id ?? "");
      if (apiId) {
        row.id = apiId;
        row.offerCode = String(res.data?.document_number ?? row.offerCode);
      }
    }
  } catch (err) {
    devWarn("ATS generateOffer API failed; local cache kept");
  }

  const all = loadOffers();
  all.unshift(row);
  saveOffers(all);

  if (row.applicationId && row.status === "sent") {
    const app = loadAppsNormalized().find((a) => a.id === row.applicationId);
    if (app?.status === "active") {
      try {
        await moveApplicationStage(row.applicationId, "offer_sent");
      } catch {
        /* ignore stage move failures for offer send */
      }
    }
  } else if (row.applicationId && row.status === "draft") {
    // Ensure candidate is at least past background check before offer draft
    const apps = loadAppsNormalized();
    const app = apps.find((a) => a.id === row.applicationId);
    if (app?.status === "active" && app.stage === "hr_discussion") {
      try {
        await moveApplicationStage(row.applicationId, "background_check");
      } catch {
        /* ignore */
      }
    }
  }

  appendAtsAudit({
    action: "generate_offer",
    detail: `${row.offerCode} CTC ${row.ctc} (${row.status})`,
    actor: actor(),
    entityId: row.id,
  });
  return row;
}

export async function updateOfferStatus(id: string, status: AtsOffer["status"]): Promise<AtsOffer | null> {
  const all = loadOffers();
  const idx = all.findIndex((o) => o.id === id);
  if (idx < 0) return null;

  try {
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRe.test(id)) {
      if (status === "sent") {
        // Advance draft → submitted → approved → sent when possible.
        for (const action of ["submit", "approve", "send"] as const) {
          try {
            await resourceService.action("/recruitment/offers", id, action);
          } catch {
            /* already past that step or local-only */
          }
        }
      } else if (status === "accepted") {
        await resourceService.action("/recruitment/offers", id, "accept");
      } else if (status === "rejected") {
        await resourceService.action("/recruitment/offers", id, "reject");
      }
    }
  } catch (err) {
    devWarn("ATS updateOfferStatus API failed; local cache kept");
  }

  all[idx] = { ...all[idx], status, updatedAt: nowIso() };
  saveOffers(all);
  if (status === "sent" && all[idx].applicationId) {
    const app = loadAppsNormalized().find((a) => a.id === all[idx].applicationId);
    if (app?.status === "active") {
      try {
        await moveApplicationStage(all[idx].applicationId, "offer_sent");
      } catch {
        /* ignore */
      }
    }
  }
  if (status === "accepted" && all[idx].applicationId) {
    const app = loadAppsNormalized().find((a) => a.id === all[idx].applicationId);
    if (app?.status === "active") {
      try {
        await moveApplicationStage(all[idx].applicationId, "offer_accepted");
      } catch {
        /* ignore */
      }
    }
  }
  if (status === "rejected" && all[idx].applicationId) {
    const apps = loadAppsNormalized();
    const aIdx = apps.findIndex((a) => a.id === all[idx].applicationId);
    if (aIdx >= 0) {
      const result = cfgMarkOfferDeclined({
        stage: apps[aIdx].stage,
        exitReason: "Offer declined by candidate",
      });
      apps[aIdx] = {
        ...apps[aIdx],
        status: result.status,
        exitedAtStage: result.exitedAtStage,
        exitReason: result.exitReason,
        exitedAt: nowIso(),
        updatedAt: nowIso(),
      };
      saveApps(apps);
    }
  }
  appendAtsAudit({
    action: "offer_status",
    detail: `${all[idx].offerCode} → ${status}`,
    actor: actor(),
    entityId: id,
  });
  return all[idx];
}

export function addDocument(candidateId: string, kind: AtsDocument["kind"], fileName: string): AtsDocument {
  const row: AtsDocument = {
    id: crypto.randomUUID(),
    candidateId,
    kind,
    fileName,
    uploadedAt: nowIso(),
    status: "pending",
  };
  const all = loadDocs();
  all.unshift(row);
  saveDocs(all);
  return row;
}

export function updateDocumentStatus(
  id: string,
  status: NonNullable<AtsDocument["status"]>,
): AtsDocument | null {
  const all = loadDocs();
  const idx = all.findIndex((d) => d.id === id);
  if (idx < 0) return null;
  all[idx] = { ...all[idx], status };
  saveDocs(all);
  return all[idx];
}

export function filterJobs(jobs: JobOpening[], filters: AtsFilters): JobOpening[] {
  const q = filters.query.trim().toLowerCase();
  return jobs.filter((j) => {
    if (filters.status === "filled") {
      if (!(j.positions > 0 && j.filled >= j.positions)) return false;
    } else if (filters.status !== "all" && j.status !== filters.status) {
      return false;
    }
    if (filters.department !== "all" && j.department !== filters.department) return false;
    if (filters.location !== "all" && j.location !== filters.location) return false;
    if (filters.employmentType !== "all" && j.employmentType !== filters.employmentType) return false;
    if (filters.priority !== "all" && j.priority !== filters.priority) return false;
    if (!q) return true;
    return [j.jobCode, j.title, j.department, j.designation, j.location].join(" ").toLowerCase().includes(q);
  });
}

export function filterCandidates(cands: AtsCandidate[], filters: AtsFilters): AtsCandidate[] {
  const q = filters.query.trim().toLowerCase();
  return cands.filter((c) => {
    if (filters.source !== "all" && c.source !== filters.source) return false;
    if (!q) return true;
    return [c.candidateCode, c.fullName, c.email, c.phone, c.currentCompany].join(" ").toLowerCase().includes(q);
  });
}

export function filterApplications(
  apps: PipelineApplication[],
  filters: AtsFilters,
  candidates: AtsCandidate[],
  jobs: JobOpening[],
): PipelineApplication[] {
  const q = filters.query.trim().toLowerCase();
  const candMap = new Map(candidates.map((c) => [c.id, c]));
  const jobMap = new Map(jobs.map((j) => [j.id, j]));
  return apps.filter((a) => {
    if (filters.stage !== "all" && a.stage !== filters.stage) return false;
    if (!q) return true;
    const c = candMap.get(a.candidateId);
    const j = jobMap.get(a.jobId);
    return [a.applicationCode, c?.fullName, c?.email, j?.title, j?.jobCode]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });
}

export function exportJobsCsv(jobs: JobOpening[]): string {
  const h = ["Job ID", "Title", "Department", "Status", "Positions", "Filled", "Priority", "Deadline"];
  const lines = jobs.map((j) =>
    [j.jobCode, j.title, j.department, j.status, j.positions, j.filled, j.priority, j.deadline]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [h.join(","), ...lines].join("\n");
}

export function exportCandidatesCsv(cands: AtsCandidate[]): string {
  const h = ["Candidate ID", "Name", "Email", "Phone", "Source", "Experience", "Expected Salary"];
  const lines = cands.map((c) =>
    [c.candidateCode, c.fullName, c.email, c.phone, c.source, c.experienceYears, c.expectedSalary]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [h.join(","), ...lines].join("\n");
}

export function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importCandidatesCsv(text: string): Promise<{ created: number; errors: string[] }> {
  const lines = text.trim().split(/\r?\n/).slice(1);
  let created = 0;
  const errors: string[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = line.split(",").map((c) => c.replace(/^"|"$/g, "").trim());
    const [name, email, phone, source] = cols;
    if (!name) {
      errors.push("Missing name");
      continue;
    }
    try {
      const cand = await createCandidate({
        fullName: name,
        email: email || `${name.replace(/\s+/g, ".").toLowerCase()}@example.com`,
        phone: phone || "9000000000",
        alternatePhone: "",
        gender: "",
        dob: "",
        currentCompany: "",
        currentDesignation: "",
        experienceYears: 0,
        expectedSalary: 0,
        noticePeriodDays: 0,
        location: "",
        address: "",
        state: "",
        pincode: "",
        resumeName: "",
        resumeUrl: "",
        portfolioUrl: "",
        linkedinUrl: "",
        source: (source as AtsCandidate["source"]) || "other",
        recruiter: actor(),
      });
      void cand;
      created += 1;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "import failed");
    }
  }
  return { created, errors };
}

export function sourcePerformance(dir: AtsDirectory) {
  const map = new Map<string, number>();
  for (const c of dir.candidates) {
    map.set(c.source, (map.get(c.source) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([source, count]) => ({ source, count }));
}

export function recruiterPerformance(dir: AtsDirectory) {
  const map = new Map<string, number>();
  for (const c of dir.candidates) {
    const r = c.recruiter || "Unassigned";
    map.set(r, (map.get(r) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([recruiter, count]) => ({ recruiter, count }));
}

export function departmentHiring(dir: AtsDirectory) {
  const map = new Map<string, number>();
  for (const j of dir.jobs) {
    map.set(j.department, (map.get(j.department) ?? 0) + j.filled);
  }
  return Array.from(map.entries()).map(([department, filled]) => ({ department, filled }));
}
