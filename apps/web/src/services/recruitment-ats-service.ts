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
  CreateCandidateInput,
  CreateJobInput,
  JobOpening,
  PipelineApplication,
  PipelineStage,
} from "@/types/recruitment-ats";
import { PIPELINE_STAGES } from "@/types/recruitment-ats";

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
  return readJson<AtsCandidate[]>(CANDS_KEY, []);
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
  return readJson<AtsInterview[]>(INTS_KEY, []);
}
function saveInterviews(rows: AtsInterview[]) {
  writeJson(INTS_KEY, rows);
}
function loadOffers(): AtsOffer[] {
  return readJson<AtsOffer[]>(OFFERS_KEY, []);
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
  let applications = loadApps();
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
              : ("open" as const),
        createdAt: nowIso(),
        updatedAt: nowIso(),
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
        resumeName: "",
        portfolioUrl: "",
        linkedinUrl: String(c.linkedin_url ?? ""),
        source: "other" as const,
        recruiter: String(c.recruiter_name ?? ""),
        createdAt: nowIso(),
        updatedAt: nowIso(),
        apiId: String(c.id ?? ""),
      })),
        ...localOnly,
      ];
      saveCandidates(candidates);
    }

    if (overview.applications.length) {
      applications = overview.applications.map((a, i) => {
        const stageRaw = String(a.current_stage_code ?? a.status ?? "applied").toLowerCase();
        const stage =
          (PIPELINE_STAGES.find((s) => stageRaw.includes(s.id.replace(/_/g, "")) || stageRaw.includes(s.id))
            ?.id as PipelineStage) ||
          (stageRaw.includes("reject")
            ? "rejected"
            : stageRaw.includes("hire") || stageRaw.includes("offer")
              ? stageRaw.includes("hire")
                ? "hired"
                : "offer"
              : "applied");
        return {
          id: String(a.id ?? crypto.randomUUID()),
          applicationCode: String(a.document_number ?? `APP-${String(i + 1).padStart(6, "0")}`),
          candidateId: String(a.candidate_id ?? ""),
          jobId: String(a.job_requisition_id ?? ""),
          stage,
          appliedAt: String(a.applied_at ?? nowIso()).slice(0, 10),
          notes: "",
          updatedAt: nowIso(),
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
          status,
          createdAt: nowIso(),
          updatedAt: nowIso(),
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
  const shortlisted = dir.applications.filter((a) =>
    ["hr_screening", "technical_interview", "manager_interview", "final_interview"].includes(a.stage),
  );
  const interviewScheduled = dir.interviews.filter((i) => i.status === "scheduled");
  const offersSent = dir.offers.filter((o) => o.status === "sent");
  const offersAccepted = dir.offers.filter((o) => o.status === "accepted");
  const hired = dir.applications.filter((a) => a.stage === "hired");
  const filled = dir.jobs.reduce((s, j) => s + j.filled, 0);

  // Avg time to hire (days) from applied → hired when timestamps allow
  let avgDays = 0;
  const hiredApps = dir.applications.filter((a) => a.stage === "hired" && a.appliedAt);
  if (hiredApps.length) {
    const sum = hiredApps.reduce((acc, a) => {
      const start = new Date(a.appliedAt).getTime();
      const end = new Date(a.updatedAt).getTime();
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
    console.warn("ATS createJob API failed; keeping local cache", err);
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
      console.warn("ATS publishJob API failed; local status still updated", err);
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
    console.warn("ATS createCandidate API failed; keeping local cache", err);
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

export async function applyCandidateToJob(
  candidateId: string,
  jobId: string,
  stage: PipelineStage = "applied",
): Promise<PipelineApplication> {
  const apps = loadApps();
  const dup = apps.find((a) => a.candidateId === candidateId && a.jobId === jobId && a.stage !== "rejected");
  if (dup) return dup;

  const row: PipelineApplication = {
    id: crypto.randomUUID(),
    applicationCode: nextCode("app", "APP"),
    candidateId,
    jobId,
    stage,
    appliedAt: nowIso().slice(0, 10),
    notes: "",
    updatedAt: nowIso(),
  };

  try {
    const ctx = readJson<{ branchId?: string }>("erp_ats_api_context_v1", {});
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (ctx.branchId && uuidRe.test(candidateId) && uuidRe.test(jobId)) {
      const res = await resourceService.create<Record<string, unknown>>("/recruitment/applications", {
        branch_id: ctx.branchId,
        candidate_id: candidateId,
        job_requisition_id: jobId,
        status: "applied",
        current_stage_code: "applied",
      });
      const apiId = String(res.data?.id ?? "");
      if (apiId) {
        row.id = apiId;
        row.applicationCode = String(res.data?.document_number ?? row.applicationCode);
      }
    }
  } catch (err) {
    console.warn("ATS applyCandidateToJob API failed; local cache kept", err);
  }

  apps.unshift(row);
  saveApps(apps);
  appendAtsAudit({
    action: "apply",
    detail: `Application ${row.applicationCode} → ${stage}`,
    actor: actor(),
    entityId: row.id,
  });
  return row;
}

const ATS_TO_API_STAGE: Record<PipelineStage, string> = {
  applied: "applied",
  resume_screening: "screening",
  hr_screening: "screening",
  technical_interview: "interview",
  manager_interview: "interview",
  final_interview: "interview",
  offer: "offer",
  hired: "hired",
  rejected: "rejected",
};

export async function moveApplicationStage(
  applicationId: string,
  stage: PipelineStage,
): Promise<PipelineApplication | null> {
  const apps = loadApps();
  const idx = apps.findIndex((a) => a.id === applicationId);
  if (idx < 0) return null;

  try {
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRe.test(applicationId)) {
      if (stage === "rejected") {
        await resourceService.action("/recruitment/applications", applicationId, "reject", {
          reason: "Rejected from ATS pipeline",
        });
      } else {
        await resourceService.action("/recruitment/applications", applicationId, "advance", {
          stage: ATS_TO_API_STAGE[stage] || stage,
        });
      }
    }
  } catch (err) {
    console.warn("ATS moveApplicationStage API failed; local cache kept", err);
  }

  apps[idx] = { ...apps[idx], stage, updatedAt: nowIso() };
  saveApps(apps);

  if (stage === "hired") {
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
  }

  appendAtsAudit({
    action: "pipeline_move",
    detail: `${apps[idx].applicationCode} → ${stage}`,
    actor: actor(),
    entityId: applicationId,
  });
  return apps[idx];
}

export async function scheduleInterview(
  input: Omit<AtsInterview, "id" | "interviewCode" | "createdAt" | "status"> & {
    status?: AtsInterview["status"];
  },
): Promise<AtsInterview> {
  const row: AtsInterview = {
    ...input,
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
    const interviewerId = ctx.interviewerEmployeeId;
    if (
      ctx.branchId &&
      interviewerId &&
      uuidRe.test(input.candidateId) &&
      uuidRe.test(input.applicationId)
    ) {
      const scheduledAt = new Date(`${input.date}T${input.time || "10:00"}:00`).toISOString();
      const typeMap: Record<string, string> = {
        hr: "hr_round",
        technical: "technical",
        manager: "manager",
        final: "final",
      };
      const res = await resourceService.create<Record<string, unknown>>("/recruitment/interviews", {
        branch_id: ctx.branchId,
        application_id: input.applicationId,
        candidate_id: input.candidateId,
        interview_type: typeMap[input.interviewType] || "other",
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
    console.warn("ATS scheduleInterview API failed; local cache kept", err);
  }

  const all = loadInterviews();
  all.unshift(row);
  saveInterviews(all);
  appendAtsAudit({
    action: "schedule_interview",
    detail: `${row.interviewCode} (${row.interviewType}) on ${row.date} ${row.time}`,
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
      console.warn("ATS updateInterview API failed; local cache kept", err);
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

export async function generateOffer(
  input: Omit<AtsOffer, "id" | "offerCode" | "createdAt" | "updatedAt" | "status"> & {
    status?: AtsOffer["status"];
  },
): Promise<AtsOffer> {
  const row: AtsOffer = {
    ...input,
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
    console.warn("ATS generateOffer API failed; local cache kept", err);
  }

  const all = loadOffers();
  all.unshift(row);
  saveOffers(all);

    if (row.applicationId) {
    void moveApplicationStage(row.applicationId, "offer");
  }

  appendAtsAudit({
    action: "generate_offer",
    detail: `${row.offerCode} CTC ${row.ctc}`,
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
    console.warn("ATS updateOfferStatus API failed; local cache kept", err);
  }

  all[idx] = { ...all[idx], status, updatedAt: nowIso() };
  saveOffers(all);
  if (status === "accepted" && all[idx].applicationId) {
    void moveApplicationStage(all[idx].applicationId, "hired");
  }
  if (status === "rejected" && all[idx].applicationId) {
    void moveApplicationStage(all[idx].applicationId, "rejected");
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
  };
  const all = loadDocs();
  all.unshift(row);
  saveDocs(all);
  return row;
}

export function filterJobs(jobs: JobOpening[], filters: AtsFilters): JobOpening[] {
  const q = filters.query.trim().toLowerCase();
  return jobs.filter((j) => {
    if (filters.status !== "all" && j.status !== filters.status) return false;
    if (filters.department !== "all" && j.department !== filters.department) return false;
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
        phone: phone || "",
        alternatePhone: "",
        gender: "",
        dob: "",
        currentCompany: "",
        currentDesignation: "",
        experienceYears: 0,
        expectedSalary: 0,
        noticePeriodDays: 0,
        location: "",
        resumeName: "",
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
