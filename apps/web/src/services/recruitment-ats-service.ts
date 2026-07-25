/**
 * Enterprise ATS service — rich local store + merge recruitment API overview.
 */

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

    // Seed local store from API when empty (one-way enrich)
    if (jobs.length === 0 && overview.requisitions.length) {
      jobs = overview.requisitions.map((r, i) => ({
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
        skills: [],
        description: String(r.description ?? ""),
        deadline: String(r.target_hire_date ?? ""),
        priority: (String(r.priority ?? "medium").toLowerCase() as JobOpening["priority"]) || "medium",
        status:
          asStatus(r.status).includes("hold")
            ? "on_hold"
            : asStatus(r.status).includes("close") || asStatus(r.status).includes("filled")
              ? "closed"
              : "open",
        createdAt: nowIso(),
        updatedAt: nowIso(),
        apiId: String(r.id ?? ""),
      }));
      saveJobs(jobs);
    }

    if (candidates.length === 0 && overview.candidates.length) {
      candidates = overview.candidates.map((c, i) => ({
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
        source: "other",
        recruiter: String(c.recruiter_name ?? ""),
        createdAt: nowIso(),
        updatedAt: nowIso(),
        apiId: String(c.id ?? ""),
      }));
      saveCandidates(candidates);
    }

    if (applications.length === 0 && overview.applications.length) {
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

    if (offers.length === 0 && overview.offers.length) {
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
    jobs: loadJobs().length ? loadJobs() : jobs,
    candidates: loadCandidates().length ? loadCandidates() : candidates,
    applications: loadApps().length ? loadApps() : applications,
    interviews,
    offers: loadOffers().length ? loadOffers() : offers,
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

export function createJob(input: CreateJobInput): JobOpening {
  const row: JobOpening = {
    ...input,
    id: crypto.randomUUID(),
    jobCode: nextCode("job", "JOB"),
    filled: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  const all = loadJobs();
  all.unshift(row);
  saveJobs(all);
  appendAtsAudit({
    action: "create_job",
    detail: `Created ${row.jobCode} — ${row.title}`,
    actor: actor(),
    entityId: row.id,
  });
  return row;
}

export function updateJob(id: string, patch: Partial<JobOpening>): JobOpening | null {
  const all = loadJobs();
  const idx = all.findIndex((j) => j.id === id);
  if (idx < 0) return null;
  all[idx] = { ...all[idx], ...patch, updatedAt: nowIso() };
  saveJobs(all);
  appendAtsAudit({
    action: "update_job",
    detail: `Updated ${all[idx].jobCode}`,
    actor: actor(),
    entityId: id,
  });
  return all[idx];
}

export function createCandidate(input: CreateCandidateInput): AtsCandidate {
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

  const row: AtsCandidate = {
    ...input,
    id: crypto.randomUUID(),
    candidateCode: nextCode("cand", "CAN"),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  const all = loadCandidates();
  all.unshift(row);
  saveCandidates(all);
  appendAtsAudit({
    action: "create_candidate",
    detail: `Added ${row.candidateCode} — ${row.fullName}`,
    actor: actor(),
    entityId: row.id,
  });
  return row;
}

export function applyCandidateToJob(
  candidateId: string,
  jobId: string,
  stage: PipelineStage = "applied",
): PipelineApplication {
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

export function moveApplicationStage(applicationId: string, stage: PipelineStage): PipelineApplication | null {
  const apps = loadApps();
  const idx = apps.findIndex((a) => a.id === applicationId);
  if (idx < 0) return null;
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

export function scheduleInterview(
  input: Omit<AtsInterview, "id" | "interviewCode" | "createdAt" | "status"> & {
    status?: AtsInterview["status"];
  },
): AtsInterview {
  const row: AtsInterview = {
    ...input,
    id: crypto.randomUUID(),
    interviewCode: nextCode("int", "INT"),
    status: input.status ?? "scheduled",
    createdAt: nowIso(),
  };
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

export function updateInterview(id: string, patch: Partial<AtsInterview>): AtsInterview | null {
  const all = loadInterviews();
  const idx = all.findIndex((i) => i.id === id);
  if (idx < 0) return null;
  all[idx] = { ...all[idx], ...patch };
  saveInterviews(all);
  appendAtsAudit({
    action: "update_interview",
    detail: `Updated ${all[idx].interviewCode}`,
    actor: actor(),
    entityId: id,
  });
  return all[idx];
}

export function generateOffer(
  input: Omit<AtsOffer, "id" | "offerCode" | "createdAt" | "updatedAt" | "status"> & {
    status?: AtsOffer["status"];
  },
): AtsOffer {
  const row: AtsOffer = {
    ...input,
    id: crypto.randomUUID(),
    offerCode: nextCode("offer", "OFF"),
    status: input.status ?? "draft",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  const all = loadOffers();
  all.unshift(row);
  saveOffers(all);

  // Move pipeline to offer if linked
  if (row.applicationId) {
    moveApplicationStage(row.applicationId, "offer");
  }

  appendAtsAudit({
    action: "generate_offer",
    detail: `${row.offerCode} CTC ${row.ctc}`,
    actor: actor(),
    entityId: row.id,
  });
  return row;
}

export function updateOfferStatus(id: string, status: AtsOffer["status"]): AtsOffer | null {
  const all = loadOffers();
  const idx = all.findIndex((o) => o.id === id);
  if (idx < 0) return null;
  all[idx] = { ...all[idx], status, updatedAt: nowIso() };
  saveOffers(all);
  if (status === "accepted" && all[idx].applicationId) {
    moveApplicationStage(all[idx].applicationId, "hired");
  }
  if (status === "rejected" && all[idx].applicationId) {
    moveApplicationStage(all[idx].applicationId, "rejected");
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

export function importCandidatesCsv(text: string): { created: number; errors: string[] } {
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
      const cand = createCandidate({
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
      created += 1;
      void cand;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "Import failed");
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
