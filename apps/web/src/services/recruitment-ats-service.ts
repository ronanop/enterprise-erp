/**
 * Enterprise ATS service - API-first with local cache fallback.
 */

import { apiGetBlob, apiUpload, formatApiError, resourceService } from "@/services/api-client";
import {
  getBgPortalUrl,
  sendBgDocumentPortal,
  type BgPortalInviteResult,
} from "@/services/bg-check-portal-service";
import {
  sendEmailCompose,
  type EmailAttachmentPayload,
} from "@/services/email-notification-service";
import { loadAtsLookups } from "@/services/recruitment-ats-lookups";
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
  EmploymentType,
  JobOpening,
  PipelineApplication,
  PipelineStage,
  StageHistoryEntry,
} from "@/types/recruitment-ats";
import {
  INTERVIEW_ROUND_LABELS,
  PIPELINE_STAGES,
  normalizeCandidateSource,
} from "@/types/recruitment-ats";
import {
  computeBackoutRate,
  markBackedOut as cfgMarkBackedOut,
  markHired as cfgMarkHired,
  markOfferDeclined as cfgMarkOfferDeclined,
  markRejected as cfgMarkRejected,
  nextStage,
  normalizeStage,
  stageIndex,
} from "@/config/pipeline-config";
import { isAuthenticated } from "@/lib/auth";
import { devError, devWarn } from "@/lib/dev-log";
import { getStoredOrgContext } from "@/lib/org-context-storage";
import { dataUrlToBlobUrl } from "@/lib/recruitment/document-preview";
import { buildOfferLetterFileName } from "@/lib/recruitment/offer-letter-file-name";
import { buildOfferLetterPdfDataUrl } from "@/lib/recruitment/offer-letter-pdf";
import {
  isOversizedDocContent,
  saveDocumentContent,
} from "@/lib/recruitment/document-content-store";
import {
  isSubstantialPdfDataUrl,
  saveOfferLetterPdf,
} from "@/lib/recruitment/offer-letter-pdf-store";
import { resolveOfferLetterPdfDataUrl } from "@/lib/recruitment/resolve-offer-letter-pdf";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value?: string | null): value is string {
  return Boolean(value && UUID_RE.test(value));
}

function nameFromLookup(
  options: { id: string; name: string }[],
  id: string | undefined,
  raw: string | undefined,
): string {
  if (id) {
    const hit = options.find((o) => o.id === id);
    if (hit?.name?.trim()) return hit.name.trim();
  }
  const fallback = String(raw ?? "").trim();
  if (!fallback || fallback === "-" || isUuid(fallback)) return "—";
  return fallback;
}

function mapEmploymentType(value: EmploymentType): string {
  switch (value) {
    case "full_time":
      return "permanent";
    case "part_time":
      return "consultant";
    case "contract":
      return "contract";
    case "intern":
      return "intern";
    default: {
      const _exhaustive: never = value;
      void _exhaustive;
      return "permanent";
    }
  }
}

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
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    const name = err instanceof DOMException ? err.name : "";
    if (name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED") {
      throw err;
    }
    throw err;
  }
}

/** Strip oversized data: URLs so localStorage metadata stays under quota. */
function docsForLocalStorage(rows: AtsDocument[]): AtsDocument[] {
  return rows.map((d) => {
    const content = (d.contentDataUrl || "").trim();
    const url = (d.url || "").trim();
    const next = { ...d };
    if (isOversizedDocContent(content)) {
      delete next.contentDataUrl;
    }
    if (isOversizedDocContent(url) || (url.startsWith("data:") && url === content)) {
      if (isOversizedDocContent(url)) delete next.url;
      else if (!next.url || isOversizedDocContent(next.url)) delete next.url;
    }
    return next;
  });
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
  return readJson<JobOpening[]>(JOBS_KEY, []).map((j) => ({
    ...j,
    postingAudience: j.postingAudience === "internal" ? "internal" : "external",
  }));
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

/** Pipeline stage that "owns" each interview round — past this means the round is done. */
const INTERVIEW_ROUND_STAGE: Record<string, PipelineStage> = {
  round_1: "interview_round_1",
  technical: "interview_round_1",
  round_2: "interview_round_2",
  manager: "interview_round_2",
  hr: "hr_discussion",
  final: "hr_discussion",
};

/**
 * Keep interview rows in sync with pipeline progress.
 * Candidates already past an interview round (or exited) must not stay "Scheduled".
 */
function reconcileInterviewStatuses(
  interviews: AtsInterview[],
  applications: PipelineApplication[],
): AtsInterview[] {
  if (!interviews.length) return interviews;
  const appById = new Map(applications.map((a) => [a.id, a]));
  let changed = false;
  const next = interviews.map((interview) => {
    if (interview.status !== "scheduled" && interview.status !== "rescheduled") {
      return interview;
    }
    const app = interview.applicationId
      ? appById.get(interview.applicationId)
      : applications.find(
          (a) =>
            a.candidateId === interview.candidateId &&
            a.jobId === interview.jobId &&
            a.status === "active",
        );

    if (!app) return interview;

    // Closed applications → cancel leftover open interviews
    if (app.status !== "active") {
      changed = true;
      return {
        ...interview,
        status: "cancelled" as const,
        feedback:
          interview.feedback?.trim() ||
          `Auto-closed: application ${app.status.replace(/_/g, " ")}`,
      };
    }

    const roundKey = String(interview.round || interview.interviewType || "round_1");
    const roundStage = INTERVIEW_ROUND_STAGE[roundKey] ?? "interview_round_1";
    // Application has moved beyond this interview round
    if (stageIndex(app.stage) > stageIndex(roundStage)) {
      changed = true;
      return {
        ...interview,
        status: "completed" as const,
        recommendation: interview.recommendation || "selected",
        feedback:
          interview.feedback?.trim() ||
          "Completed — candidate advanced past this interview stage",
      };
    }
    return interview;
  });

  if (changed) saveInterviews(next);
  return next;
}
/** Normalize any common date string to YYYY-MM-DD for `<input type="date">`. */
export function toDateInputValue(raw: string | null | undefined): string {
  if (!raw) return "";
  const s = String(raw).trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return "";
}

function loadOffers(): AtsOffer[] {
  return readJson<AtsOffer[]>(OFFERS_KEY, []).map((o) => ({
    ...o,
    templateFileName: o.templateFileName ?? o.offerLetterName ?? "",
    mergedPreview: o.mergedPreview ?? "",
    joiningDate: toDateInputValue(o.joiningDate) || o.joiningDate || "",
  }));
}
function saveOffers(rows: AtsOffer[]) {
  writeJson(
    OFFERS_KEY,
    rows.map((o) => ({
      ...o,
      joiningDate: toDateInputValue(o.joiningDate) || o.joiningDate || "",
    })),
  );
}
function loadDocs(): AtsDocument[] {
  const rows = readJson<AtsDocument[]>(DOCS_KEY, []);
  let needsPurge = false;
  const cleaned = rows.map((d) => {
    const content = (d.contentDataUrl || "").trim();
    const url = (d.url || "").trim();
    const contentOversized = isOversizedDocContent(content);
    const urlOversized = isOversizedDocContent(url);
    if (!contentOversized && !urlOversized) return d;
    needsPurge = true;
    const payload = contentOversized ? content : url;
    if (payload.startsWith("data:")) {
      void saveDocumentContent(d.id, payload).catch(() => {
        /* ignore */
      });
    }
    const next = { ...d };
    if (contentOversized) delete next.contentDataUrl;
    if (urlOversized || (url.startsWith("data:") && url === content)) {
      delete next.url;
    }
    return next;
  });
  if (needsPurge) {
    try {
      writeJson(DOCS_KEY, docsForLocalStorage(cleaned));
    } catch {
      try {
        writeJson(
          DOCS_KEY,
          cleaned.map((d) => {
            const next = { ...d };
            if ((next.contentDataUrl || "").startsWith("data:")) {
              delete next.contentDataUrl;
            }
            if ((next.url || "").startsWith("data:")) delete next.url;
            return next;
          }),
        );
      } catch {
        /* ignore — caller may still use in-memory cleaned rows */
      }
    }
  }
  return cleaned;
}
function saveDocs(rows: AtsDocument[]) {
  const slim = docsForLocalStorage(rows);
  // Offload any oversized payloads we still have in memory to IndexedDB.
  for (const d of rows) {
    const content = (d.contentDataUrl || d.url || "").trim();
    if (isOversizedDocContent(content)) {
      void saveDocumentContent(d.id, content).catch(() => {
        /* ignore */
      });
    }
  }
  try {
    writeJson(DOCS_KEY, slim);
  } catch (err) {
    const name = err instanceof DOMException ? err.name : "";
    if (name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED") {
      // Last resort: drop all remaining data: URLs and retry once.
      const bare = slim.map((d) => {
        const next = { ...d };
        if ((next.contentDataUrl || "").startsWith("data:")) delete next.contentDataUrl;
        if ((next.url || "").startsWith("data:")) delete next.url;
        return next;
      });
      try {
        writeJson(DOCS_KEY, bare);
        return;
      } catch {
        /* ignore */
      }
    }
    throw err;
  }
}

/**
 * Ensure every candidate has a Documents "folder" populated with resume /
 * offer-letter rows when content exists on the candidate or offer records.
 */
function syncCandidateDocumentFolders(
  candidates: AtsCandidate[],
  offers: AtsOffer[],
): AtsDocument[] {
  const docs = loadDocs();
  let changed = false;

  const candidateIds = new Set(
    candidates.flatMap((c) => [c.id, c.apiId].filter((id): id is string => Boolean(id))),
  );

  for (const c of candidates) {
    const aliases = new Set([c.id, c.apiId].filter((id): id is string => Boolean(id)));
    // Move docs pointing at any alias onto primary id
    for (let i = 0; i < docs.length; i++) {
      if (aliases.has(docs[i].candidateId) && docs[i].candidateId !== c.id) {
        docs[i] = { ...docs[i], candidateId: c.id };
        changed = true;
      }
    }

    const resumeName = (c.resumeName || "").trim();
    const resumeUrl = (c.resumeUrl || "").trim();
    if (resumeName || resumeUrl.startsWith("data:")) {
      const fileName = resumeName || "resume.pdf";
      let resumeDoc = docs.find(
        (d) => d.candidateId === c.id && d.kind === "resume" && d.fileName === fileName,
      );
      if (!resumeDoc) {
        resumeDoc = docs.find((d) => d.candidateId === c.id && d.kind === "resume");
      }
      if (!resumeDoc) {
        docs.unshift({
          id: crypto.randomUUID(),
          candidateId: c.id,
          kind: "resume",
          fileName,
          uploadedAt: c.updatedAt || c.createdAt || nowIso(),
          status: "pending",
          contentDataUrl: resumeUrl.startsWith("data:") ? resumeUrl : undefined,
          mimeType: resumeUrl.startsWith("data:application/pdf")
            ? "application/pdf"
            : undefined,
          url: resumeUrl || undefined,
        });
        changed = true;
      } else {
        const existingHref = (resumeDoc.contentDataUrl || resumeDoc.url || "").trim();
        const needsData =
          resumeUrl.startsWith("data:") && !existingHref.startsWith("data:");
        const needsApiMarker =
          resumeUrl.startsWith("recruitment-resume:") &&
          !existingHref.startsWith("data:") &&
          existingHref !== resumeUrl;
        const needsHttp =
          /^https?:\/\//i.test(resumeUrl) &&
          !existingHref.startsWith("data:") &&
          !/^https?:\/\//i.test(existingHref);
        if (needsData || needsApiMarker || needsHttp || !resumeDoc.fileName) {
          const idx = docs.findIndex((d) => d.id === resumeDoc!.id);
          if (idx >= 0) {
            docs[idx] = {
              ...docs[idx],
              fileName: docs[idx].fileName || fileName,
              ...(needsData
                ? {
                    contentDataUrl: resumeUrl,
                    url: resumeUrl,
                    mimeType: resumeUrl.startsWith("data:application/pdf")
                      ? "application/pdf"
                      : docs[idx].mimeType,
                  }
                : needsApiMarker || needsHttp
                  ? { url: resumeUrl }
                  : {}),
            };
            changed = true;
          }
        }
      }
    }
  }

  for (const offer of offers) {
    if (!offer.candidateId || !candidateIds.has(offer.candidateId)) {
      // try resolve via candidate list
      const match = candidates.find(
        (c) => c.id === offer.candidateId || c.apiId === offer.candidateId,
      );
      if (!match) continue;
    }
    const cand =
      candidates.find((c) => c.id === offer.candidateId || c.apiId === offer.candidateId) ??
      null;
    if (!cand) continue;

    const existing = docs.find(
      (d) =>
        d.candidateId === cand.id &&
        d.kind === "offer_letter" &&
        (d.offerId === offer.id ||
          d.fileName === offer.offerLetterName ||
          d.fileName === offer.templateFileName),
    );
    if (existing) {
      if (existing.offerId !== offer.id) {
        const idx = docs.findIndex((d) => d.id === existing.id);
        if (idx >= 0) {
          docs[idx] = { ...docs[idx], offerId: offer.id };
          changed = true;
        }
      }
      // Fill missing PDF content from offer letter text
      if (
        !(existing.contentDataUrl || existing.url || "").startsWith("data:") &&
        (offer.mergedPreview || "").trim()
      ) {
        try {
          const dataUrl = buildOfferLetterPdfDataUrl({
            title: "Offer Letter",
            offerCode: offer.offerCode,
            body: offer.mergedPreview,
          });
          const idx = docs.findIndex((d) => d.id === existing.id);
          if (idx >= 0) {
            docs[idx] = {
              ...docs[idx],
              contentDataUrl: dataUrl,
              url: dataUrl,
              mimeType: "application/pdf",
              status: docs[idx].status ?? "verified",
            };
            changed = true;
          }
        } catch {
          /* ignore pdf build failures */
        }
      }
      continue;
    }

    if (!(offer.mergedPreview || "").trim() && !offer.offerLetterName && !offer.templateFileName) {
      continue;
    }

    const safeName = (offer.offerLetterName || offer.templateFileName || `Offer-${offer.offerCode}.pdf`)
      .replace(/[^\w.\- ]+/g, "_")
      .trim();
    const fileName = /\.pdf$/i.test(safeName) ? safeName : `${safeName || `Offer-${offer.offerCode}`}.pdf`;
    let contentDataUrl: string | undefined;
    try {
      if ((offer.mergedPreview || "").trim()) {
        contentDataUrl = buildOfferLetterPdfDataUrl({
          title: "Offer Letter",
          offerCode: offer.offerCode,
          body: offer.mergedPreview,
        });
      }
    } catch {
      contentDataUrl = undefined;
    }
    docs.unshift({
      id: crypto.randomUUID(),
      candidateId: cand.id,
      kind: "offer_letter",
      fileName,
      uploadedAt: offer.updatedAt || offer.createdAt || nowIso(),
      status: "verified",
      contentDataUrl,
      mimeType: contentDataUrl ? "application/pdf" : undefined,
      url: contentDataUrl,
      offerId: offer.id,
    });
    changed = true;
  }

  if (changed) saveDocs(docs);
  return docs;
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

    // Prefer API as SoR for job list only when the requisitions endpoint succeeded.
    // (Do not wipe local jobs when a different recruitment endpoint fails.)
    if (overview.requisitionsLoaded) {
      jobs = [
        ...overview.requisitions.map((r, i) => {
          const empRaw = String(r.employment_type ?? "permanent").toLowerCase();
          const employmentType: JobOpening["employmentType"] =
            empRaw === "contract"
              ? "contract"
              : empRaw === "intern"
                ? "intern"
                : empRaw === "consultant"
                  ? "part_time"
                  : "full_time";
          const statusRaw = asStatus(r.status);
          const status: JobOpening["status"] = statusRaw.includes("hold")
            ? "on_hold"
            : statusRaw.includes("close") || statusRaw.includes("cancel") || statusRaw.includes("reject")
              ? "closed"
              : statusRaw.includes("filled")
                ? "closed"
                : statusRaw === "draft" || statusRaw === "submitted"
                  ? "draft"
                  : "open";
          return {
            id: String(r.id ?? crypto.randomUUID()),
            jobCode: String(r.document_number ?? `JOB-${String(i + 1).padStart(6, "0")}`),
            title: String(r.requisition_title ?? r.title ?? "Role"),
            department: String(r.department_name ?? ""),
            departmentId: isUuid(String(r.department_id ?? "")) ? String(r.department_id) : undefined,
            designation: String(r.designation_name ?? ""),
            designationId: isUuid(String(r.designation_id ?? "")) ? String(r.designation_id) : undefined,
            employmentType,
            branch: String(r.branch_name ?? ""),
            branchId: isUuid(String(r.branch_id ?? "")) ? String(r.branch_id) : undefined,
            location: String(r.location ?? r.city ?? ""),
            hiringManager: String(r.hiring_manager_name ?? ""),
            hiringManagerId: isUuid(String(r.hiring_manager_employee_id ?? ""))
              ? String(r.hiring_manager_employee_id)
              : undefined,
            recruiter: String(r.recruiter_name ?? ""),
            recruiterId: isUuid(String(r.recruiter_id ?? "")) ? String(r.recruiter_id) : undefined,
            positions: Number(r.openings_count ?? 1),
            filled: Number(r.filled_count ?? 0),
            salaryMin: Number(r.salary_band_min ?? 0),
            salaryMax: Number(r.salary_band_max ?? 0),
            experienceMin: Number(r.min_experience_years ?? 0),
            experienceMax: Number(r.max_experience_years ?? 0),
            skills: (() => {
              const desc = String(r.job_description ?? r.description ?? "");
              const m = desc.match(/Skills:\s*([^\n]+)/i);
              return m
                ? m[1]
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                : [];
            })(),
            description: String(r.job_description ?? r.description ?? "")
              .replace(/\n*\s*Skills:\s*[^\n]+/gi, "")
              .trim(),
            deadline: String(r.target_hire_date ?? ""),
            priority: (String(r.priority ?? "medium").toLowerCase() as JobOpening["priority"]) || "medium",
            status,
            postingAudience:
              String(r.posting_audience ?? "external").toLowerCase() === "internal"
                ? "internal"
                : "external",
            evidenceEmailFileName: String(r.evidence_email_file_name ?? "") || undefined,
            createdAt: String(r.created_at ?? r.posted_at ?? nowIso()),
            updatedAt: String(r.updated_at ?? r.created_at ?? nowIso()),
            apiId: String(r.id ?? ""),
          };
        }),
      ];
      // API returns FK ids only — resolve human labels from org lookups.
      try {
        const lookups = await loadAtsLookups();
        jobs = jobs.map((j) => {
          const department = nameFromLookup(lookups.departments, j.departmentId, j.department);
          const designation = nameFromLookup(lookups.designations, j.designationId, j.designation);
          const branch = nameFromLookup(lookups.branches, j.branchId, j.branch);
          const locationRaw = String(j.location ?? "").trim();
          const location =
            locationRaw && locationRaw !== "-" && !isUuid(locationRaw)
              ? locationRaw
              : branch !== "—"
                ? branch
                : "—";
          const hiringManager = nameFromLookup(
            lookups.hiringManagers,
            j.hiringManagerId,
            j.hiringManager,
          );
          const recruiter = nameFromLookup(lookups.recruiters, j.recruiterId, j.recruiter);
          return {
            ...j,
            department,
            designation,
            branch,
            location,
            hiringManager,
            recruiter,
          };
        });
      } catch {
        jobs = jobs.map((j) => ({
          ...j,
          department: nameFromLookup([], j.departmentId, j.department),
          designation: nameFromLookup([], j.designationId, j.designation),
          branch: nameFromLookup([], j.branchId, j.branch),
          location: isUuid(j.location) || !j.location ? "—" : j.location,
          hiringManager: nameFromLookup([], j.hiringManagerId, j.hiringManager),
          recruiter: nameFromLookup([], j.recruiterId, j.recruiter),
        }));
      }
      // Keep local skills if API description had none
      const prevJobs = loadJobs();
      jobs = jobs.map((j) => {
        const local = prevJobs.find((l) => l.id === j.id || l.apiId === j.apiId);
        if (!local) return j;
        const localLoc = String(local.location ?? "").trim();
        const apiLoc = String(j.location ?? "").trim();
        return {
          ...j,
          skills: j.skills?.length ? j.skills : local.skills ?? [],
          description: j.description || local.description,
          // Prefer a real saved location (local wins over branch fallback / empty API)
          location:
            localLoc && localLoc !== "—"
              ? localLoc
              : apiLoc && apiLoc !== "—"
                ? apiLoc
                : local.location || j.location,
          departmentId: j.departmentId || local.departmentId,
          designationId: j.designationId || local.designationId,
          department: j.department && j.department !== "—" ? j.department : local.department || j.department,
          designation:
            j.designation && j.designation !== "—" ? j.designation : local.designation || j.designation,
          branchId: j.branchId || local.branchId,
          hiringManagerId: j.hiringManagerId || local.hiringManagerId,
          recruiterId: j.recruiterId || local.recruiterId,
          recruiter: j.recruiter || local.recruiter,
          evidenceEmailFileName: j.evidenceEmailFileName || local.evidenceEmailFileName,
          postingAudience: j.postingAudience || local.postingAudience,
        };
      });
      saveJobs(jobs);
    }

    if (overview.candidatesLoaded) {
      const resumeByCandidate = new Map<string, Record<string, unknown>>();
      if (overview.resumesLoaded) {
        for (const r of overview.resumes) {
          const cid = String(r.candidate_id ?? "");
          if (!cid) continue;
          const prev = resumeByCandidate.get(cid);
          const isPrimary = Boolean(r.is_primary);
          if (!prev || isPrimary) resumeByCandidate.set(cid, r as Record<string, unknown>);
        }
      }

      const apiCandidates: AtsCandidate[] = overview.candidates.map((c, i) => {
        const id = String(c.id ?? crypto.randomUUID());
        const educationRaw = String(c.highest_education ?? "");
        const resume = resumeByCandidate.get(id);
        const profileFromCandidate =
          c.profile_json && typeof c.profile_json === "object"
            ? (c.profile_json as Record<string, unknown>)
            : {};
        const parsedFromResume =
          resume && resume.parsed_skills_json && typeof resume.parsed_skills_json === "object"
            ? (resume.parsed_skills_json as Record<string, unknown>)
            : {};
        // Prefer dedicated resume JSON, then enriched candidate profile from API list.
        const parsed = { ...profileFromCandidate, ...parsedFromResume };
        const skillsFromApi = Array.isArray(c.skills)
          ? c.skills.map((s) => String(s).trim()).filter(Boolean)
          : [];
        const skillsFromParsed = Array.isArray(parsed.skills)
          ? parsed.skills.map((s) => String(s).trim()).filter(Boolean)
          : [];
        const skillsMatch = educationRaw.match(/Skills:\s*([^|]+)/i);
        const skillsFromEdu = skillsMatch
          ? skillsMatch[1]
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [];
        const skills = skillsFromApi.length
          ? skillsFromApi
          : skillsFromParsed.length
            ? skillsFromParsed
            : skillsFromEdu;
        const resumeName =
          String(parsed.resume_file_name ?? "") ||
          String(c.resume_name ?? "") ||
          (resume ? String(resume.storage_uri ?? "").split(/[/\\]/).pop() || "" : "");
        const downloadUrl = resume
          ? `recruitment-resume:${id}`
          : String(c.resume_uri ?? c.resume_url ?? "");

        return {
          id,
          candidateCode: String(c.candidate_code ?? `CAN-${String(i + 1).padStart(6, "0")}`),
          fullName: candidateDisplayName(c),
          email: String(c.email ?? ""),
          phone: String(c.mobile ?? c.phone ?? ""),
          alternatePhone: String(
            parsed.alternate_phone ?? c.alternate_phone ?? c.alternate_mobile ?? "",
          ),
          gender: String(c.gender ?? parsed.gender ?? ""),
          dob: String(c.date_of_birth ?? parsed.dob ?? parsed.date_of_birth ?? ""),
          currentCompany:
            String(c.current_employer ?? "") || String(parsed.current_company ?? ""),
          currentDesignation: (() => {
            const title =
              String(c.current_title ?? "") || String(parsed.current_designation ?? "");
            // Careers apply used to stash "Resume: file.pdf" in title — don't treat as designation
            if (/^resume\s*:/i.test(title.trim()) || /\.(pdf|docx?|txt)$/i.test(title.trim())) {
              return "";
            }
            return title;
          })(),
          experienceYears: Number(
            c.total_experience_years ?? parsed.experience_years ?? 0,
          ),
          expectedSalary: Number(
            c.expected_ctc ?? parsed.expected_salary ?? parsed.expected_ctc ?? 0,
          ),
          noticePeriodDays: Number(
            c.notice_period_days ?? parsed.notice_period_days ?? 0,
          ),
          location: String(parsed.location ?? c.location ?? ""),
          address: String(c.address ?? parsed.address ?? parsed.location ?? c.location ?? ""),
          state: String(c.state ?? parsed.state ?? ""),
          pincode: String(c.pincode ?? c.pin_code ?? parsed.pincode ?? ""),
          resumeName:
            resumeName ||
            (() => {
              const title = String(c.current_title ?? "");
              const m = title.match(/^resume\s*:\s*(.+)$/i);
              return m?.[1]?.trim() || "";
            })(),
          resumeUrl: downloadUrl,
          portfolioUrl: String(parsed.portfolio_url ?? c.portfolio_url ?? ""),
          linkedinUrl: String(parsed.linkedin_url ?? c.linkedin_url ?? ""),
          source: normalizeCandidateSource(
            parsed.source ?? c.source_code ?? c.source ?? c.source_name ?? "other",
          ),
          recruiter: String(c.recruiter_name ?? ""),
          education:
            String(parsed.education ?? "").trim() ||
            educationRaw.split("|")[0]?.trim() ||
            educationRaw,
          skills,
          summary: String(parsed.summary ?? ""),
          educationDetails: Array.isArray(parsed.education_details)
            ? (parsed.education_details as AtsCandidate["educationDetails"])
            : [],
          experienceDetails: Array.isArray(parsed.experience_details)
            ? (parsed.experience_details as AtsCandidate["experienceDetails"])
            : [],
          createdAt: String(c.created_at ?? nowIso()),
          updatedAt: String(c.updated_at ?? c.created_at ?? nowIso()),
          apiId: String(c.id ?? ""),
        };
      });
      // Keep any local-only rows that are not yet visible from API (by email/id).
      const prevLocal = loadCandidates();
      const apiEmails = new Set(
        apiCandidates.map((c) => c.email.toLowerCase()).filter(Boolean),
      );
      const apiIds = new Set(apiCandidates.map((c) => c.id));
      const localOnly = prevLocal.filter(
        (c) =>
          !apiIds.has(c.id) &&
          !(c.apiId && apiIds.has(c.apiId)) &&
          !(c.email && apiEmails.has(c.email.toLowerCase())),
      );
      // Prefer API row but preserve richer local fields the API schema does not store.
      candidates = apiCandidates.map((api) => {
        const local = prevLocal.find(
          (l) =>
            l.id === api.id ||
            l.apiId === api.id ||
            (l.email &&
              api.email &&
              l.email.toLowerCase() === api.email.toLowerCase()),
        );
        if (!local) return api;
        return {
          ...api,
          skills: api.skills?.length ? api.skills : local.skills,
          resumeName: api.resumeName || local.resumeName,
          resumeUrl: api.resumeUrl || local.resumeUrl,
          education: api.education || local.education,
          educationDetails: api.educationDetails?.length
            ? api.educationDetails
            : local.educationDetails,
          experienceDetails: api.experienceDetails?.length
            ? api.experienceDetails
            : local.experienceDetails,
          summary: api.summary || local.summary,
          linkedinUrl: api.linkedinUrl || local.linkedinUrl,
          portfolioUrl: api.portfolioUrl || local.portfolioUrl,
          currentCompany: api.currentCompany || local.currentCompany,
          currentDesignation: api.currentDesignation || local.currentDesignation,
          experienceYears: api.experienceYears || local.experienceYears,
          alternatePhone: api.alternatePhone || local.alternatePhone,
          gender: api.gender || local.gender,
          dob: api.dob || local.dob,
          address: api.address || local.address,
          state: api.state || local.state,
          pincode: api.pincode || local.pincode,
          location: api.location || local.location,
          expectedSalary: api.expectedSalary || local.expectedSalary,
          noticePeriodDays: api.noticePeriodDays || local.noticePeriodDays,
          source: api.source !== "other" ? api.source : local.source || api.source,
          recruiter: api.recruiter || local.recruiter,
        };
      });
      candidates = [...candidates, ...localOnly];
      saveCandidates(candidates);

      // Sync resume docs into ATS documents panel (all candidates, incl. merged local)
      for (const c of candidates) {
        const resumeName = (c.resumeName || "").trim();
        if (!resumeName) continue;
        const existing = loadDocs().find(
          (d) =>
            (d.candidateId === c.id || d.candidateId === c.apiId) &&
            d.kind === "resume" &&
            d.fileName === resumeName,
        );
        if (!existing) addDocument(c.id, "resume", resumeName);
      }
    }

    if (overview.applicationsLoaded) {
      const prevApps = loadAppsNormalized();
      const apiApplications: PipelineApplication[] = overview.applications.map((a, i) => {
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

        const id = String(a.id ?? crypto.randomUUID());
        const local = prevApps.find((p) => p.id === id);
        const notes = local?.notes || "";
        return {
          id,
          applicationCode: String(a.document_number ?? `APP-${String(i + 1).padStart(6, "0")}`),
          candidateId: String(a.candidate_id ?? ""),
          jobId: String(a.job_requisition_id ?? ""),
          stage,
          status,
          appliedAt: String(a.applied_at ?? nowIso()).slice(0, 10),
          notes,
          negotiatedCtc:
            local?.negotiatedCtc || parseNegotiatedCtcFromNotes(notes) || undefined,
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
      const apiIds = new Set(apiApplications.map((a) => a.id));
      const apiPairs = new Set(
        apiApplications.map((a) => `${a.candidateId}::${a.jobId}`),
      );
      // Keep local applications not yet visible from API (failed sync or offline create).
      const localOnly = prevApps.filter((a) => {
        if (apiIds.has(a.id)) return false;
        if (a.candidateId && a.jobId && apiPairs.has(`${a.candidateId}::${a.jobId}`)) {
          return false;
        }
        return Boolean(a.candidateId && a.jobId);
      });
      applications = [...apiApplications, ...localOnly];
      saveApps(applications);
    }

    if (overview.offersLoaded) {
      const prevOffers = loadOffers();
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
        const id = String(o.id ?? crypto.randomUUID());
        const offerCode = String(o.document_number ?? `OFF-${String(i + 1).padStart(6, "0")}`);
        const local = prevOffers.find(
          (p) => p.id === id || p.offerCode === offerCode || p.applicationId === String(o.application_id ?? ""),
        );
        const apiJoin = toDateInputValue(String(o.joining_date ?? ""));
        return {
          id,
          offerCode,
          candidateId: String(o.candidate_id ?? ""),
          jobId: String(o.job_requisition_id ?? ""),
          applicationId: String(o.application_id ?? ""),
          department: String(o.department_name ?? o.department_id ?? "-"),
          joiningDate: apiJoin || toDateInputValue(local?.joiningDate) || "",
          ctc: Number(o.offered_ctc ?? o.ctc ?? 0) || local?.ctc || 0,
          expiryDate: toDateInputValue(String(o.offer_valid_until ?? "")) || local?.expiryDate || "",
          offerLetterName: String(o.offer_letter_uri ?? "") || local?.offerLetterName || "",
          templateFileName:
            String(o.template_file_name ?? o.offer_letter_uri ?? "") ||
            local?.templateFileName ||
            "",
          mergedPreview: String(o.merged_preview ?? "") || local?.mergedPreview || "",
          reportingManager: local?.reportingManager,
          employmentType: local?.employmentType,
          basicSalary: local?.basicSalary,
          variablePay: local?.variablePay,
          location: local?.location,
          notes: local?.notes,
          templateKind: local?.templateKind,
          status,
          createdAt: String(o.created_at ?? local?.createdAt ?? nowIso()),
          updatedAt: String(o.updated_at ?? o.created_at ?? local?.updatedAt ?? nowIso()),
        };
      });
      // Keep local-only offers not returned by API yet
      const apiIds = new Set(offers.map((o) => o.id));
      const apiCodes = new Set(offers.map((o) => o.offerCode));
      const localOnly = prevOffers.filter(
        (p) => !apiIds.has(p.id) && !apiCodes.has(p.offerCode),
      );
      offers = [...offers, ...localOnly];
      saveOffers(offers);
    }
  } catch {
    apiPartial = true;
  }

  const apiJobIds = new Set(
    jobs.flatMap((job) => [job.id, job.apiId].filter((id): id is string => Boolean(id))),
  );
  const apiCandidateIds = new Set(
    candidates.flatMap((candidate) =>
      [candidate.id, candidate.apiId].filter((id): id is string => Boolean(id)),
    ),
  );
  let scopedInterviews = interviews;
  if (!apiPartial) {
    scopedInterviews = interviews.filter(
      (row) => apiJobIds.has(row.jobId) || apiCandidateIds.has(row.candidateId),
    );
  }

  scopedInterviews = reconcileInterviewStatuses(scopedInterviews, applications);

  // Build / refresh per-candidate document folders (resume, offer letters, …)
  const syncedDocuments = syncCandidateDocumentFolders(candidates, offers);
  const scopedDocuments = syncedDocuments.filter((row) => {
    if (apiCandidateIds.size === 0) return true;
    return (
      apiCandidateIds.has(row.candidateId) ||
      candidates.some((c) => c.id === row.candidateId || c.apiId === row.candidateId)
    );
  });

  const departments = Array.from(
    new Set(
      jobs
        .map((j) => j.department)
        .filter((d) => d && d !== "-" && d !== "—" && !isUuid(d)),
    ),
  ).sort();

  return {
    jobs,
    candidates,
    applications,
    interviews: scopedInterviews,
    offers,
    documents: scopedDocuments,
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

async function resolveJobApiContext(input: CreateJobInput): Promise<{
  branchId: string;
  departmentId: string;
  hiringManagerEmployeeId: string;
  recruiterId?: string;
  companyId?: string;
}> {
  const cached = readJson<{
    branchId?: string;
    departmentId?: string;
    hiringManagerEmployeeId?: string;
    companyId?: string;
  }>("erp_ats_api_context_v1", {});

  let branchId = isUuid(input.branchId)
    ? input.branchId
    : isUuid(cached.branchId)
      ? cached.branchId
      : undefined;
  let departmentId = isUuid(input.departmentId)
    ? input.departmentId
    : isUuid(cached.departmentId)
      ? cached.departmentId
      : undefined;
  let hiringManagerEmployeeId = isUuid(input.hiringManagerId)
    ? input.hiringManagerId
    : isUuid(cached.hiringManagerEmployeeId)
      ? cached.hiringManagerEmployeeId
      : undefined;
  let recruiterId = isUuid(input.recruiterId) ? input.recruiterId : undefined;
  let companyId = isUuid(cached.companyId) ? cached.companyId : undefined;

  const lookups = await loadAtsLookups();
  if (!branchId) {
    branchId =
      lookups.branches.find((b) => b.name === input.branch && isUuid(b.id))?.id ??
      lookups.branches.find((b) => isUuid(b.id))?.id;
  }
  if (!departmentId) {
    departmentId =
      lookups.departments.find((d) => d.name === input.department && isUuid(d.id))?.id ??
      lookups.departments.find((d) => isUuid(d.id))?.id;
  }
  if (!hiringManagerEmployeeId) {
    hiringManagerEmployeeId =
      lookups.hiringManagers.find((e) => e.name === input.hiringManager && isUuid(e.id))?.id ??
      lookups.hiringManagers.find((e) => isUuid(e.id))?.id;
  }
  if (!recruiterId && input.recruiter) {
    recruiterId = lookups.recruiters.find((r) => r.name === input.recruiter && isUuid(r.id))?.id;
  }
  if (!companyId && branchId) {
    const branch = lookups.branches.find((b) => b.id === branchId);
    if (branch?.companyId && isUuid(branch.companyId)) {
      companyId = branch.companyId;
    }
  }

  if (!branchId || !departmentId || !hiringManagerEmployeeId) {
    throw new Error(
      "Select a live branch, department, and hiring manager before creating a job opening.",
    );
  }

  writeJson("erp_ats_api_context_v1", {
    branchId,
    departmentId,
    hiringManagerEmployeeId,
    companyId,
  });

  return { branchId, departmentId, hiringManagerEmployeeId, recruiterId, companyId };
}

export async function createJob(input: CreateJobInput): Promise<JobOpening> {
  const audience = input.postingAudience === "internal" ? "internal" : "external";
  const evidenceName = (input.evidenceEmailFileName || input.evidenceEmailFile?.name || "").trim();
  if (!evidenceName) {
    throw new Error("Upload the approval email copy as evidence (required).");
  }

  const { evidenceEmailFile, ...jobFields } = input;
  const row: JobOpening = {
    ...jobFields,
    postingAudience: audience,
    evidenceEmailFileName: evidenceName,
    id: crypto.randomUUID(),
    jobCode: nextCode("job", "JOB"),
    filled: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  const ctx = await resolveJobApiContext(input);
  row.branchId = ctx.branchId;
  row.departmentId = ctx.departmentId;
  row.hiringManagerId = ctx.hiringManagerEmployeeId;
  row.recruiterId = ctx.recruiterId;

  try {
    const res = await resourceService.create<Record<string, unknown>>("/recruitment/job-requisitions", {
      ...(ctx.companyId ? { company_id: ctx.companyId } : {}),
      branch_id: ctx.branchId,
      requisition_title: input.title,
      department_id: ctx.departmentId,
      designation_id: isUuid(input.designationId) ? input.designationId : null,
      employment_type: mapEmploymentType(input.employmentType),
      openings_count: input.positions || 1,
      hiring_manager_employee_id: ctx.hiringManagerEmployeeId,
      // recruiter_id must be rec_recruiter.id; form may hold employee id — omit unless known
      priority: input.priority || "medium",
      target_hire_date: input.deadline || null,
      min_experience_years: input.experienceMin,
      max_experience_years: input.experienceMax,
      salary_band_min: input.salaryMin || null,
      salary_band_max: input.salaryMax || null,
      currency_code: "INR",
      job_description: [
        input.description?.trim(),
        input.skills?.length ? `Skills: ${input.skills.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("\n\n") || null,
      posting_audience: audience,
      evidence_email_file_name: evidenceName,
      status: "draft",
    });
    row.designationId = isUuid(input.designationId) ? input.designationId : undefined;
    const apiId = String(res.data?.id ?? "");
    const doc = String(res.data?.document_number ?? row.jobCode);
    if (!apiId) {
      throw new Error("Job requisition API returned no id");
    }
    row.apiId = apiId;
    row.jobCode = doc;
    row.id = apiId;

    if (evidenceEmailFile) {
      try {
        const form = new FormData();
        form.append("file", evidenceEmailFile, evidenceName);
        await apiUpload(`/recruitment/job-requisitions/${encodeURIComponent(apiId)}/approval-evidence`, form);
      } catch (uploadErr) {
        devWarn(
          `ATS createJob evidence upload failed: ${formatApiError(uploadErr, "upload error")}`,
        );
      }
    }

    if (input.status === "open") {
      try {
        await resourceService.action("/recruitment/job-requisitions", apiId, "submit", {});
        await resourceService.action("/recruitment/job-requisitions", apiId, "approve", {});
        await resourceService.action("/recruitment/job-requisitions", apiId, "open", {});
        row.status = "open";
      } catch (publishErr) {
        // Requisition was created; keep it even if publish chain fails.
        row.status = "draft";
        devWarn(
          `ATS createJob saved as draft; publish failed: ${formatApiError(publishErr, "publish error")}`,
        );
      }
    } else {
      row.status = input.status;
    }
  } catch (err) {
    if (isAuthenticated()) {
      throw new Error(formatApiError(err, "Failed to create job opening"));
    }
    devWarn("ATS createJob API failed; keeping local cache");
  }

  const all = loadJobs();
  all.unshift(row);
  saveJobs(all);
  appendAtsAudit({
    action: "create_job",
    detail: `Created ${row.jobCode} - ${row.title} (${audience})${row.apiId ? " (API)" : " (local)"}`,
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
  const apiKey = row.apiId || (isUuid(row.id) ? row.id : undefined);

  // Persist field edits to API (Save was previously local-only, so reload wiped changes).
  if (apiKey && isAuthenticated()) {
    try {
      const skillsLine = row.skills?.length ? `Skills: ${row.skills.join(", ")}` : "";
      const description = [row.description?.trim(), skillsLine].filter(Boolean).join("\n\n") || null;
      await resourceService.update("/recruitment/job-requisitions", apiKey, {
        requisition_title: row.title,
        openings_count: row.positions || 1,
        priority: row.priority || "medium",
        target_hire_date: row.deadline || null,
        min_experience_years: row.experienceMin ?? null,
        max_experience_years: row.experienceMax ?? null,
        salary_band_min: row.salaryMin || null,
        salary_band_max: row.salaryMax || null,
        job_description: description,
        employment_type: mapEmploymentType(row.employmentType),
      });
      row.apiId = apiKey;
    } catch (err) {
      if (isAuthenticated()) {
        throw new Error(formatApiError(err, "Failed to save job opening"));
      }
      devWarn("ATS updateJob API failed; local cache kept");
    }
  }

  // Publish / open path: submit → approve requisition, then create+publish posting when apiId present
  if (apiKey && patch.status === "open" && prev.status !== "open") {
    try {
      const ctx = readJson<{ branchId?: string }>("erp_ats_api_context_v1", {});
      await resourceService.action("/recruitment/job-requisitions", apiKey, "submit", {});
      await resourceService.action("/recruitment/job-requisitions", apiKey, "approve", {});
      await resourceService.action("/recruitment/job-requisitions", apiKey, "open", {});
      if (ctx.branchId) {
        const posting = await resourceService.create<Record<string, unknown>>("/recruitment/job-postings", {
          branch_id: ctx.branchId,
          job_requisition_id: apiKey,
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

  const ctx = readJson<{ branchId?: string; companyId?: string }>("erp_ats_api_context_v1", {});
  let companyId = isUuid(ctx.companyId) ? ctx.companyId : undefined;
  let branchId = isUuid(ctx.branchId) ? ctx.branchId : undefined;
  if (!companyId || !branchId) {
    try {
      const lookups = await loadAtsLookups();
      if (!branchId) {
        branchId = lookups.branches.find((b) => isUuid(b.id))?.id;
      }
      if (!companyId && branchId) {
        companyId = lookups.branches.find((b) => b.id === branchId)?.companyId;
      }
      if (!companyId) {
        companyId = lookups.branches.find((b) => isUuid(b.companyId))?.companyId;
      }
      if (companyId || branchId) {
        writeJson("erp_ats_api_context_v1", {
          ...ctx,
          ...(companyId ? { companyId } : {}),
          ...(branchId ? { branchId } : {}),
        });
      }
    } catch {
      /* lookups optional */
    }
  }

  const educationBits = [
    input.education?.trim(),
    input.skills?.length ? `Skills: ${input.skills.join(", ")}` : "",
    input.summary?.trim(),
  ].filter(Boolean);

  try {
    const res = await resourceService.create<Record<string, unknown>>("/recruitment/candidates", {
      ...(companyId ? { company_id: companyId } : {}),
      ...(branchId ? { branch_id: branchId } : {}),
      first_name: firstName,
      last_name: lastName,
      full_name: input.fullName,
      email: input.email,
      mobile: input.phone || null,
      current_title: input.currentDesignation || null,
      current_employer: input.currentCompany || null,
      total_experience_years: input.experienceYears ?? null,
      highest_education: educationBits.join(" | ").slice(0, 255) || null,
      status: "prospect",
    });
    const apiId = String(res.data?.id ?? "");
    const code = String(res.data?.candidate_code ?? row.candidateCode);
    if (!apiId) {
      throw new Error("Candidate API returned no id");
    }
    row.apiId = apiId;
    row.id = apiId;
    row.candidateCode = code;
  } catch (err) {
    throw new Error(formatApiError(err, "Failed to save candidate to database"));
  }

  const all = loadCandidates();
  all.unshift(row);
  saveCandidates(all);
  if (row.skills?.length) {
    try {
      localStorage.setItem(
        `erp_ats_candidate_tags_${row.id}`,
        JSON.stringify(row.skills),
      );
    } catch {
      /* ignore */
    }
  }
  appendAtsAudit({
    action: "create_candidate",
    detail: `Added ${row.candidateCode} - ${row.fullName}${row.apiId ? " (API)" : " (local)"}`,
    actor: actor(),
    entityId: row.id,
  });
  return row;
}

export async function deleteCandidates(ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  const idSet = new Set(ids);
  let deleted = 0;

  for (const id of ids) {
    try {
      if (isUuid(id)) {
        await resourceService.delete("/recruitment/candidates", id);
      }
      deleted += 1;
    } catch (err) {
      if (isAuthenticated()) {
        throw new Error(formatApiError(err, `Failed to delete candidate ${id}`));
      }
      devWarn("ATS deleteCandidate API failed; removing from local cache");
      deleted += 1;
    }
  }

  saveCandidates(loadCandidates().filter((c) => !idSet.has(c.id) && !idSet.has(c.apiId ?? "")));
  const apps = loadApps().filter((a) => !idSet.has(a.candidateId));
  saveApps(apps);
  appendAtsAudit({
    action: "delete_candidates",
    detail: `Deleted ${deleted} candidate(s)`,
    actor: actor(),
  });
  return deleted;
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
  const apiKey = row.apiId || (isUuid(row.id) ? row.id : undefined);

  try {
    if (apiKey && isAuthenticated()) {
      const nameParts = (patch.fullName ?? row.fullName).trim().split(/\s+/);
      const educationBits = [
        row.education?.trim(),
        row.skills?.length ? `Skills: ${row.skills.join(", ")}` : "",
        row.summary?.trim(),
      ].filter(Boolean);
      await resourceService.update("/recruitment/candidates", apiKey, {
        first_name: nameParts[0] || row.fullName,
        last_name: nameParts.slice(1).join(" ") || "-",
        full_name: patch.fullName ?? row.fullName,
        email: patch.email ?? row.email,
        mobile: patch.phone ?? row.phone,
        current_title: patch.currentDesignation ?? row.currentDesignation,
        current_employer: patch.currentCompany ?? row.currentCompany,
        total_experience_years: patch.experienceYears ?? row.experienceYears,
        highest_education: educationBits.join(" | ").slice(0, 255) || null,
      });
      row.apiId = apiKey;
    }
  } catch (err) {
    if (isAuthenticated()) {
      throw new Error(formatApiError(err, "Failed to update candidate"));
    }
    devWarn("ATS updateCandidate API failed; local cache kept");
  }

  try {
    localStorage.setItem(
      `erp_ats_candidate_tags_${row.id}`,
      JSON.stringify(row.skills ?? []),
    );
  } catch {
    /* ignore */
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

const SALARY_DISCUSSED_RE = /\[salary_discussed\]\s*([0-9]+(?:\.[0-9]+)?)/i;

/** Read negotiated CTC from application notes stamp when field is missing. */
export function parseNegotiatedCtcFromNotes(notes?: string | null): number | undefined {
  if (!notes) return undefined;
  const m = notes.match(SALARY_DISCUSSED_RE);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * Save salary discussed in Negotiation Round. Prefills offer letter CTC.
 * Also stamps notes so the value survives API merges that clear local-only fields.
 */
export function updateApplicationNegotiatedCtc(
  applicationId: string,
  ctc: number,
): PipelineApplication | null {
  const apps = loadApps();
  const idx = apps.findIndex((a) => a.id === applicationId);
  if (idx < 0) return null;
  const amount = Math.round(Number(ctc) || 0);
  if (amount <= 0) return null;

  const prior = (apps[idx].notes || "").replace(SALARY_DISCUSSED_RE, "").trim();
  const stamp = `[salary_discussed] ${amount}`;
  apps[idx] = {
    ...apps[idx],
    negotiatedCtc: amount,
    notes: prior ? `${prior}\n\n${stamp}` : stamp,
    updatedAt: nowIso(),
  };
  saveApps(apps);
  appendAtsAudit({
    action: "salary_discussed",
    detail: `${apps[idx].applicationCode} CTC ${amount}`,
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
  // Default stage "sourced" = applied / awaiting HR accept on job detail.
  const apps = loadApps();
  const dup = apps.find(
    (a) => a.candidateId === candidateId && a.jobId === jobId && a.status === "active",
  );
  if (dup) return dup;

  const normalized = normalizeStage(stage);
  const row: PipelineApplication = {
    id: crypto.randomUUID(),
    applicationCode: nextCode("app", "APP"),
    candidateId,
    jobId,
    stage: normalized,
    status: "active",
    appliedAt: nowIso().slice(0, 10),
    notes: "",
    updatedAt: nowIso(),
    stageEnteredAt: nowIso(),
    stageHistory: [
      {
        stage: normalized,
        label:
          PIPELINE_STAGES.find((s) => s.id === normalized)?.label ??
          (normalized === "sourced" ? "Applied" : stage),
        enteredAt: nowIso().slice(0, 10),
      },
    ],
  };

  const ctx = readJson<{ branchId?: string; companyId?: string }>("erp_ats_api_context_v1", {});
  let branchId = isUuid(ctx.branchId) ? ctx.branchId : undefined;
  let companyId = isUuid(ctx.companyId) ? ctx.companyId : undefined;
  const job = loadJobs().find((j) => j.id === jobId || j.apiId === jobId);
  if (!branchId && job?.branchId && isUuid(job.branchId)) {
    branchId = job.branchId;
  }
  if (!branchId || !companyId) {
    try {
      const lookups = await loadAtsLookups();
      if (!branchId) {
        branchId = lookups.branches.find((b) => isUuid(b.id))?.id;
      }
      if (!companyId && branchId) {
        companyId = lookups.branches.find((b) => b.id === branchId)?.companyId;
      }
      if (!companyId) {
        companyId = lookups.branches.find((b) => isUuid(b.companyId))?.companyId;
      }
      if (companyId || branchId) {
        writeJson("erp_ats_api_context_v1", {
          ...ctx,
          ...(companyId ? { companyId } : {}),
          ...(branchId ? { branchId } : {}),
        });
      }
    } catch {
      /* lookups optional */
    }
  }

  if (isAuthenticated()) {
    if (!isUuid(candidateId) || !isUuid(jobId)) {
      throw new Error("Candidate or job is missing a database id — save them first, then apply.");
    }
    if (!branchId) {
      throw new Error("Branch context required to link candidate to job. Refresh and try again.");
    }
    try {
      const res = await resourceService.create<Record<string, unknown>>("/recruitment/applications", {
        ...(companyId ? { company_id: companyId } : {}),
        branch_id: branchId,
        candidate_id: candidateId,
        job_requisition_id: jobId,
        status: "active",
        current_stage_code: normalized,
      });
      const apiId = String(res.data?.id ?? "");
      if (!apiId) {
        throw new Error("Application API returned no id");
      }
      row.id = apiId;
      row.applicationCode = String(res.data?.document_number ?? row.applicationCode);
    } catch (err) {
      throw new Error(formatApiError(err, "Failed to apply candidate to job"));
    }
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

  // Close open interviews for rounds the candidate has now passed
  reconcileInterviewStatuses(loadInterviews(), apps);

  appendAtsAudit({
    action: "pipeline_move",
    detail: `${apps[idx].applicationCode} → ${target}`,
    actor: actor(),
    entityId: applicationId,
  });
  return apps[idx];
}

/** Stages that require review / feedback before Advance. */
export const INTERVIEW_REVIEW_STAGES: PipelineStage[] = [
  "interview_round_1",
  "interview_round_2",
  "hr_discussion",
];

const STAGE_TO_INTERVIEW_ROUND: Partial<
  Record<PipelineStage, "round_1" | "round_2" | "hr">
> = {
  interview_round_1: "round_1",
  interview_round_2: "round_2",
  hr_discussion: "hr",
};

export function stageNeedsAdvanceReview(stage: PipelineStage): boolean {
  return INTERVIEW_REVIEW_STAGES.includes(stage);
}

export async function advanceApplication(
  applicationId: string,
  feedback?: string,
): Promise<PipelineApplication | null> {
  const apps = loadAppsNormalized();
  const app = apps.find((a) => a.id === applicationId);
  if (!app) return null;
  const nxt = nextStage(app.stage);
  if (!nxt) throw new Error("Already at final stage");

  const trimmed = (feedback || "").trim();
  if (stageNeedsAdvanceReview(app.stage) && !trimmed) {
    throw new Error("Review / feedback is required to advance from this interview stage");
  }

  if (trimmed && stageNeedsAdvanceReview(app.stage)) {
    const round = STAGE_TO_INTERVIEW_ROUND[app.stage];
    const interviews = loadInterviews();
    const idx = interviews.findIndex(
      (i) =>
        i.applicationId === applicationId &&
        i.status !== "cancelled" &&
        (!round || i.round === round || i.interviewType === round),
    );
    if (idx >= 0) {
      interviews[idx] = {
        ...interviews[idx],
        feedback: trimmed,
        recommendation: interviews[idx].recommendation || "selected",
        status: "completed",
      };
      saveInterviews(interviews);
    }

    const appIdx = apps.findIndex((a) => a.id === applicationId);
    if (appIdx >= 0) {
      const prior = (apps[appIdx].notes || "").trim();
      const stamp = `[${app.stage} review] ${trimmed}`;
      apps[appIdx] = {
        ...apps[appIdx],
        notes: prior ? `${prior}\n\n${stamp}` : stamp,
        updatedAt: nowIso(),
      };
      saveApps(apps);
    }

    appendAtsAudit({
      action: "interview_advance_review",
      detail: `${app.applicationCode} ${app.stage} → ${nxt}: ${trimmed.slice(0, 160)}`,
      actor: actor(),
      entityId: applicationId,
    });
  }

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

export type ScheduleInterviewResult = {
  interview: AtsInterview;
  emailsSent: number;
  emailErrors: string[];
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function dataUrlToEmailAttachment(
  dataUrl: string,
  fileName: string,
  fallbackMime = "application/octet-stream",
): EmailAttachmentPayload | null {
  const trimmed = dataUrl.trim();
  if (!trimmed.startsWith("data:")) return null;
  const comma = trimmed.indexOf(",");
  if (comma < 0) return null;
  const header = trimmed.slice(5, comma);
  const payload = trimmed.slice(comma + 1);
  if (!payload) return null;
  const mime = (header.split(";")[0] || fallbackMime).trim() || fallbackMime;
  const isBase64 = /;base64/i.test(header);
  let content_base64 = payload;
  if (!isBase64) {
    try {
      content_base64 = utf8ToBase64(decodeURIComponent(payload));
    } catch {
      return null;
    }
  }
  return {
    filename: fileName || "attachment",
    content_base64,
    content_type: mime.toLowerCase().includes("pdf") ? "application/pdf" : mime,
  };
}

function buildInterviewInviteHtml(opts: {
  recipientName: string;
  candidateName: string;
  jobTitle: string;
  companyName: string;
  department: string;
  jobLocation: string;
  jobDescription: string;
  roundLabel: string;
  date: string;
  time: string;
  mode: string;
  location: string;
  meetingLink: string;
  participantNames: string[];
  sectionContent: string;
  resumeAttached: boolean;
  extraAttached: boolean;
}): string {
  const company = opts.companyName.trim() || "our organization";
  const role = opts.jobTitle.trim() || "the open role";
  const isOnline = opts.mode.toLowerCase() === "online";
  const joinGuidance = isOnline
    ? "Please join the meeting link below at least 5–10 minutes prior to the scheduled time, ensure a stable internet connection and a place with minimal distraction for a smooth discussion."
    : "Please arrive at the interview location below at least 5–10 minutes prior to the scheduled time for a smooth discussion.";
  const interviewers = opts.participantNames.length
    ? opts.participantNames
        .map(
          (name, i) =>
            `<p style="margin:6px 0 0"><strong>Interviewer ${i + 1}:</strong> ${escapeHtml(name)}</p>`,
        )
        .join("")
    : "";
  const meetingOrLocation = isOnline
    ? opts.meetingLink
      ? `<p style="margin:14px 0 0"><strong>Meeting link:</strong><br/><a href="${escapeHtml(opts.meetingLink)}">${escapeHtml(opts.meetingLink)}</a></p>`
      : ""
    : opts.location
      ? `<p style="margin:14px 0 0"><strong>Interview location:</strong> ${escapeHtml(opts.location)}</p>`
      : "";
  const contentBlock = opts.sectionContent.trim()
    ? `<p style="margin:14px 0 0"><strong>Agenda:</strong><br/>${escapeHtml(opts.sectionContent.trim()).replace(/\n/g, "<br/>")}</p>`
    : "";
  const jdBlock = opts.jobDescription.trim()
    ? `<p style="margin:14px 0 0"><strong>Job description:</strong><br/>${escapeHtml(opts.jobDescription.trim()).replace(/\n/g, "<br/>")}</p>`
    : "";
  const attachNotes = [
    opts.resumeAttached ? "candidate resume" : "",
    opts.extraAttached ? "additional document" : "",
  ]
    .filter(Boolean)
    .join(" and ");
  const resumeNote = attachNotes
    ? `<p style="margin:14px 0 0;color:#374151">Please find the ${escapeHtml(attachNotes)} attached to this email.</p>`
    : "";

  return `
<div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#111827;line-height:1.6">
  <p style="margin:0 0 12px">Dear ${escapeHtml(opts.recipientName)},</p>
  <p style="margin:0 0 12px">Greetings from ${escapeHtml(company)}</p>
  <p style="margin:0 0 12px">This is to invite you for a ${isOnline ? "virtual " : ""}interview for the position of <strong>${escapeHtml(role)}</strong> with our organization.</p>
  <p style="margin:0 0 12px">${escapeHtml(joinGuidance)}</p>
  <p style="margin:0 0 12px">We look forward to interacting with you.</p>
  <p style="margin:0 0 18px">Thanks</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 14px" />
  ${opts.companyName ? `<p style="margin:6px 0"><strong>Company:</strong> ${escapeHtml(opts.companyName)}</p>` : ""}
  <p style="margin:6px 0"><strong>Candidate:</strong> ${escapeHtml(opts.candidateName)}</p>
  <p style="margin:6px 0"><strong>Role:</strong> ${escapeHtml(opts.jobTitle || "—")}</p>
  ${opts.department ? `<p style="margin:6px 0"><strong>Department:</strong> ${escapeHtml(opts.department)}</p>` : ""}
  ${opts.jobLocation ? `<p style="margin:6px 0"><strong>Job location:</strong> ${escapeHtml(opts.jobLocation)}</p>` : ""}
  <p style="margin:6px 0"><strong>Round:</strong> ${escapeHtml(opts.roundLabel)}</p>
  <p style="margin:6px 0"><strong>Date &amp; time:</strong> ${escapeHtml(opts.date)} ${escapeHtml(opts.time || "")}</p>
  <p style="margin:6px 0"><strong>Mode:</strong> ${escapeHtml(opts.mode)}</p>
  ${interviewers}
  ${meetingOrLocation}
  ${contentBlock}
  ${jdBlock}
  ${resumeNote}
</div>`.trim();
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Could not read resume"));
    reader.onerror = () => reject(new Error("Could not read resume"));
    reader.readAsDataURL(blob);
  });
}

async function resolveInterviewResumeAttachment(
  candidate: AtsCandidate | undefined,
): Promise<EmailAttachmentPayload | null> {
  if (!candidate) return null;
  try {
    const docs = loadDocs()
      .filter(
        (d) =>
          (d.candidateId === candidate.id || d.candidateId === candidate.apiId) &&
          d.kind === "resume",
      )
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));

    for (const doc of docs) {
      const href = getDocumentHref(doc);
      if (href?.startsWith("data:")) {
        const safeName =
          (doc.fileName || candidate.resumeName || "resume.pdf")
            .replace(/[^\w.\- ()]+/g, "_")
            .trim() || "resume.pdf";
        return dataUrlToEmailAttachment(
          href,
          safeName,
          doc.mimeType || "application/pdf",
        );
      }
    }

    const resumeUrl = (candidate.resumeUrl || "").trim();
    if (resumeUrl.startsWith("data:")) {
      const safeName =
        (candidate.resumeName || "resume.pdf").replace(/[^\w.\- ()]+/g, "_").trim() ||
        "resume.pdf";
      return dataUrlToEmailAttachment(
        resumeUrl,
        safeName,
        resumeUrl.startsWith("data:application/pdf")
          ? "application/pdf"
          : "application/octet-stream",
      );
    }

    const candidateId = resumeUrl.startsWith("recruitment-resume:")
      ? resumeUrl.slice("recruitment-resume:".length)
      : candidate.apiId || candidate.id;
    if (!candidateId) return null;

    const result = await apiGetBlob(
      `/recruitment/candidates/${encodeURIComponent(candidateId)}/resume-file`,
    );
    if (result.kind === "legacy") return null;
    const dataUrl = await blobToDataUrl(result.blob);
    const safeName =
      (candidate.resumeName || result.filename || "resume.pdf")
        .replace(/[^\w.\- ()]+/g, "_")
        .trim() || "resume.pdf";
    return dataUrlToEmailAttachment(
      dataUrl,
      safeName,
      result.contentType || result.blob.type || "application/pdf",
    );
  } catch (err) {
    devWarn(
      `Interview invite: could not attach resume — ${err instanceof Error ? err.message : "unknown"}`,
    );
    return null;
  }
}

async function sendInterviewInviteEmails(
  row: AtsInterview,
  invitees: { name: string; email: string }[],
  extraAttachment?: EmailAttachmentPayload | null,
): Promise<{ emailsSent: number; emailErrors: string[] }> {
  const candidate = loadCandidates().find(
    (c) => c.id === row.candidateId || c.apiId === row.candidateId,
  );
  const job = loadJobs().find((j) => j.id === row.jobId || j.apiId === row.jobId);
  const candidateName = candidate?.fullName || "Candidate";
  const jobTitle = job?.title || "";
  const round =
    row.round ||
    (row.interviewType === "hr"
      ? "hr"
      : row.interviewType === "round_2"
        ? "round_2"
        : "round_1");
  const roundLabel =
    INTERVIEW_ROUND_LABELS[round as keyof typeof INTERVIEW_ROUND_LABELS] ||
    String(round || "Interview");
  const companyName = (getStoredOrgContext()?.companyName || "").trim();
  const department = (job?.department || "").trim();
  const jobLocation = (job?.location || job?.branch || "").trim();
  const jobDescription = (job?.description || "").trim();
  const attachResume = round === "round_1" || round === "round_2";
  const resumeAttachment = attachResume
    ? await resolveInterviewResumeAttachment(candidate)
    : null;
  const jdAttachment =
    attachResume && jobDescription
      ? {
          filename: `${(jobTitle || "job").replace(/[^\w.\- ]+/g, "_").trim() || "job"}-description.txt`,
          content_base64: utf8ToBase64(jobDescription),
          content_type: "text/plain; charset=utf-8",
        }
      : null;

  const recipients = new Map<string, string>();
  const candidateEmail = (candidate?.email || "").trim();
  if (candidateEmail) {
    recipients.set(candidateEmail.toLowerCase(), candidateName);
  }
  for (const invitee of invitees) {
    const email = invitee.email.trim();
    if (!email) continue;
    const key = email.toLowerCase();
    if (recipients.has(key)) continue;
    recipients.set(key, invitee.name.trim() || email);
  }

  let emailsSent = 0;
  const emailErrors: string[] = [];
  const companyPrefix = companyName ? `${companyName}: ` : "";
  const subject = `${companyPrefix}Interview scheduled: ${candidateName}${jobTitle ? ` — ${jobTitle}` : ""} (${roundLabel})`;
  const attachments = [resumeAttachment, jdAttachment, extraAttachment].filter(
    (a): a is EmailAttachmentPayload => Boolean(a),
  );

  for (const [email, recipientName] of recipients) {
    try {
      await sendEmailCompose({
        to_address: email,
        subject,
        body_html: buildInterviewInviteHtml({
          recipientName,
          candidateName,
          jobTitle,
          companyName,
          department,
          jobLocation,
          jobDescription,
          roundLabel,
          date: row.date,
          time: row.time,
          mode: row.mode,
          location: row.location || "",
          meetingLink: row.meetingLink || "",
          participantNames: row.participantNames || [],
          sectionContent: row.sectionContent || "",
          resumeAttached: Boolean(resumeAttachment),
          extraAttached: Boolean(extraAttachment),
        }),
        event_type: "recruitment.interview.scheduled",
        payload_json: {
          interview_id: row.id,
          interview_code: row.interviewCode,
          candidate_id: row.candidateId,
          job_id: row.jobId,
          meeting_link: row.meetingLink || null,
          date: row.date,
          time: row.time,
          company_name: companyName || null,
          resume_attached: Boolean(resumeAttachment),
        },
        ...(attachments.length ? { attachments } : {}),
      });
      emailsSent += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Send failed";
      emailErrors.push(`${email}: ${msg}`);
      devWarn(`Interview invite email failed for ${email}: ${msg}`);
    }
  }

  return { emailsSent, emailErrors };
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
    /** Optional participant emails for invite mail (connected SMTP) */
    participantEmails?: string[];
    participantInvitees?: { name: string; email: string }[];
    /** Optional extra file attached to the invite email */
    extraAttachment?: EmailAttachmentPayload | null;
  },
): Promise<ScheduleInterviewResult> {
  const round =
    input.round ||
    (input.interviewType === "hr"
      ? "hr"
      : input.interviewType === "round_2"
        ? "round_2"
        : "round_1");

  const { participantEmails, participantInvitees, extraAttachment, ...interviewFields } =
    input;
  const invitees =
    participantInvitees?.length
      ? participantInvitees
      : (participantEmails ?? []).map((email) => ({ name: email, email }));

  const row: AtsInterview = {
    ...interviewFields,
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
      // Move into the interview stage when still earlier (incl. sourced/screening).
      const stageRank = (s: string) => {
        const full = ["sourced", ...PIPELINE_STAGES.map((x) => x.id)];
        const i = full.indexOf(s);
        return i < 0 ? 0 : i;
      };
      if (stageRank(app.stage) < stageRank(target)) {
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

  const invite = await sendInterviewInviteEmails(row, invitees, extraAttachment ?? null);
  return {
    interview: row,
    emailsSent: invite.emailsSent,
    emailErrors: invite.emailErrors,
  };
}

/** Convert a browser File into an SMTP attachment payload. */
export async function fileToEmailAttachment(
  file: File,
): Promise<EmailAttachmentPayload | null> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Could not read file"));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
  const safeName =
    (file.name || "attachment").replace(/[^\w.\- ()]+/g, "_").trim() || "attachment";
  return dataUrlToEmailAttachment(
    dataUrl,
    safeName,
    file.type || "application/octet-stream",
  );
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

  const feedback = input.feedback.trim();
  if (!feedback) {
    throw new Error("Feedback / review is required");
  }

  const interview = all[idx];
  all[idx] = {
    ...interview,
    recommendation: input.recommendation,
    feedback,
    status: "completed",
  };
  saveInterviews(all);

  if (interview.applicationId) {
    if (input.recommendation === "rejected") {
      await rejectApplication(interview.applicationId, feedback);
    } else if (input.recommendation === "selected") {
      const next: PipelineStage =
        interview.round === "round_1"
          ? "interview_round_2"
          : interview.round === "round_2"
            ? "hr_discussion"
            : interview.round === "hr"
              ? "background_check"
              : "hr_discussion";
      const apps = loadAppsNormalized();
      const appIdx = apps.findIndex((a) => a.id === interview.applicationId);
      if (appIdx >= 0) {
        const prior = (apps[appIdx].notes || "").trim();
        const stamp = `[${interview.round} review] ${feedback}`;
        apps[appIdx] = {
          ...apps[appIdx],
          notes: prior ? `${prior}\n\n${stamp}` : stamp,
          updatedAt: nowIso(),
        };
        saveApps(apps);
      }
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

export type GenerateOfferResult = {
  offer: AtsOffer;
  email?: SendOfferLetterResult;
  portal?: BgPortalInviteResult;
};

export async function generateOffer(
  input: Omit<AtsOffer, "id" | "offerCode" | "createdAt" | "updatedAt" | "status"> & {
    status?: AtsOffer["status"];
    /** Optional uploaded letter shell PDF (data URL) saved into candidate Documents */
    documentContentDataUrl?: string;
    documentMimeType?: string;
  },
): Promise<GenerateOfferResult> {
  const { documentContentDataUrl, documentMimeType, ...offerInput } = input;
  const row: AtsOffer = {
    ...offerInput,
    joiningDate: toDateInputValue(offerInput.joiningDate) || offerInput.joiningDate || "",
    expiryDate: toDateInputValue(offerInput.expiryDate) || offerInput.expiryDate || "",
    templateFileName: offerInput.templateFileName || offerInput.offerLetterName || "offer-letter.pdf",
    mergedPreview: offerInput.mergedPreview || "",
    offerLetterName: offerInput.offerLetterName || offerInput.templateFileName || "offer-letter.pdf",
    id: crypto.randomUUID(),
    offerCode: nextCode("offer", "OFF"),
    status: offerInput.status ?? "draft",
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

  let email: SendOfferLetterResult | undefined;
  let portal: BgPortalInviteResult | undefined;
  if (row.applicationId && row.status === "sent") {
    try {
      const bundled = await sendOfferWithDocumentPortal(row.id);
      email = bundled.email;
      portal = bundled.portal;
    } catch {
      /* email / portal invite are best-effort; offer remains sent */
    }
    const app = loadAppsNormalized().find((a) => a.id === row.applicationId);
    // Offer + BG portal: keep/move to Background Check so HR can verify docs.
    // Offer-only send: advance to Offer Sent.
    if (app?.status === "active") {
      const targetStage = portal ? "background_check" : "offer_sent";
      if (app.stage !== targetStage) {
        try {
          await moveApplicationStage(row.applicationId, targetStage);
        } catch {
          /* ignore stage move failures for offer send */
        }
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

  // Persist composed offer letter PDF (letterhead + body) for preview / Documents
  try {
    const cand = loadCandidates().find(
      (c) => c.id === row.candidateId || c.apiId === row.candidateId,
    );
    const job = loadJobs().find((j) => j.id === row.jobId || j.apiId === row.jobId);
    const fileName = buildOfferLetterFileName({
      candidateName: cand?.fullName,
      role: job?.title,
      offerCode: row.offerCode,
    });
    row.offerLetterName = fileName;
    // Keep offer list in sync with the candidate-based file name
    {
      const offers = loadOffers();
      const oi = offers.findIndex((o) => o.id === row.id);
      if (oi >= 0) {
        offers[oi] = { ...offers[oi]!, offerLetterName: fileName };
        saveOffers(offers);
      }
    }
    let contentDataUrl = documentContentDataUrl?.startsWith("data:")
      ? documentContentDataUrl
      : "";
    let mimeType = documentMimeType || "application/pdf";
    if (!contentDataUrl) {
      contentDataUrl = buildOfferLetterPdfDataUrl({
        title: "Offer Letter",
        offerCode: row.offerCode,
        body: row.mergedPreview || `Offer ${row.offerCode}`,
      });
      mimeType = "application/pdf";
    }
    // Full PDF in IndexedDB only — never put letterhead blobs into localStorage docs.
    if (isSubstantialPdfDataUrl(contentDataUrl) || contentDataUrl.startsWith("data:")) {
      void saveOfferLetterPdf(row.id, contentDataUrl).catch(() => {
        /* ignore IDB failures */
      });
    }
    const docs = loadDocs();
    const existingIdx = docs.findIndex(
      (d) =>
        d.kind === "offer_letter" &&
        (d.offerId === row.id ||
          (d.candidateId === row.candidateId &&
            (d.fileName === fileName ||
              d.fileName === row.offerLetterName ||
              d.fileName === row.templateFileName))),
    );
    if (existingIdx >= 0) {
      const existingId = docs[existingIdx]!.id;
      docs[existingIdx] = {
        ...docs[existingIdx],
        fileName,
        mimeType,
        status: "verified",
        offerId: row.id,
        uploadedAt: nowIso(),
      };
      delete docs[existingIdx]!.contentDataUrl;
      delete docs[existingIdx]!.url;
      void saveDocumentContent(existingId, contentDataUrl).catch(() => {
        /* ignore */
      });
      try {
        saveDocs(docs);
      } catch {
        /* quota — IDB still has the PDF */
      }
    } else {
      try {
        const created = addDocument(row.candidateId, "offer_letter", fileName, {
          mimeType,
          status: "verified",
          offerId: row.id,
        });
        void saveDocumentContent(created.id, contentDataUrl).catch(() => {
          /* ignore */
        });
      } catch {
        /* quota — IDB still has the PDF */
      }
    }
  } catch (err) {
    devWarn("Failed to save offer letter into candidate documents");
  }

  appendAtsAudit({
    action: "generate_offer",
    detail: `${row.offerCode} CTC ${row.ctc} (${row.status})`,
    actor: actor(),
    entityId: row.id,
  });
  return { offer: row, email, portal };
}

function utf8ToBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function buildOfferLetterAttachmentHtml(opts: {
  candidateName: string;
  jobTitle: string;
  department: string;
  joiningDate: string;
  ctc: number;
  offerCode: string;
  letterBody: string;
}): string {
  const body = escapeHtml(opts.letterBody || "").replace(/\n/g, "<br/>");
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Offer Letter ${escapeHtml(opts.offerCode)}</title>
<style>
  body{font-family:Segoe UI,Arial,sans-serif;color:#111827;line-height:1.55;padding:32px;max-width:720px;margin:0 auto}
  h1{font-size:20px;margin:0 0 8px} .meta{color:#6b7280;font-size:13px;margin-bottom:24px}
  .letter{white-space:normal;font-size:14px}
</style></head><body>
  <h1>Offer Letter</h1>
  <p class="meta">${escapeHtml(opts.offerCode)} · ${escapeHtml(opts.candidateName)} · ${escapeHtml(opts.jobTitle || opts.department || "Role")}${opts.joiningDate ? ` · Join ${escapeHtml(opts.joiningDate)}` : ""}${opts.ctc ? ` · CTC ₹${opts.ctc.toLocaleString("en-IN")}` : ""}</p>
  <div class="letter">${body}</div>
</body></html>`;
}

export type SendOfferLetterResult = {
  sent: boolean;
  to?: string;
  error?: string;
  portalIncluded?: boolean;
};

export type OfferDocumentPortalCreds = {
  url: string;
  loginEmail: string;
  password: string;
  expiresAt?: string;
};

export type SendOfferWithPortalResult = {
  email: SendOfferLetterResult;
  portal?: BgPortalInviteResult;
};

/**
 * Create document-upload portal (no separate mail) and email offer + login
 * credentials together so both go out in one send.
 */
export async function sendOfferWithDocumentPortal(
  offerId: string,
): Promise<SendOfferWithPortalResult> {
  const offer = loadOffers().find((o) => o.id === offerId);
  if (!offer) return { email: { sent: false, error: "Offer not found" } };

  let portal: BgPortalInviteResult | undefined;
  if (offer.applicationId) {
    try {
      portal = await sendBgDocumentPortal(offer.applicationId, { sendEmail: false });
    } catch (err) {
      devWarn(
        `Document portal invite failed while sending offer: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  const documentPortal: OfferDocumentPortalCreds | undefined = portal
    ? {
        url: portal.portal_url || getBgPortalUrl(portal.token),
        loginEmail: portal.login_email || portal.candidate_email || "",
        password: portal.password,
        expiresAt: portal.expires_at,
      }
    : undefined;

  const email = await sendOfferLetterEmail(offerId, { documentPortal });
  return { email, portal };
}

/** Email the candidate the offer letter as an HTML attachment via connected SMTP. */
export async function sendOfferLetterEmail(
  offerId: string,
  opts?: { documentPortal?: OfferDocumentPortalCreds },
): Promise<SendOfferLetterResult> {
  const offer = loadOffers().find((o) => o.id === offerId);
  if (!offer) return { sent: false, error: "Offer not found" };

  const candidate = loadCandidates().find(
    (c) => c.id === offer.candidateId || c.apiId === offer.candidateId,
  );
  const job = loadJobs().find((j) => j.id === offer.jobId || j.apiId === offer.jobId);
  const to = (candidate?.email || "").trim();
  if (!to) {
    return { sent: false, error: "Candidate email is missing" };
  }

  const candidateName = candidate?.fullName || "Candidate";
  const jobTitle = job?.title || "";
  const letterBody =
    (offer.mergedPreview || "").trim() ||
    [
      `Dear ${candidateName},`,
      "",
      `We are pleased to offer you the position of ${jobTitle || "the role"}${offer.department ? ` in ${offer.department}` : ""}.`,
      offer.ctc ? `Your annual CTC will be ₹${offer.ctc.toLocaleString("en-IN")}.` : "",
      offer.joiningDate ? `Proposed joining date: ${offer.joiningDate}.` : "",
      "",
      "Please confirm acceptance of this offer.",
      "",
      "Regards,",
      "HR Team",
    ]
      .filter(Boolean)
      .join("\n");

  const filenameBase = (offer.offerLetterName || offer.templateFileName || `Offer-${offer.offerCode}`)
    .replace(/\.(pdf|docx?|html?)$/i, "")
    .replace(/[^\w.\- ]+/g, "_")
    .trim() || `Offer-${offer.offerCode}`;

  // PDF only — .html attachments are blocked by input validation middleware.
  const offerDoc = loadDocs().find(
    (d) =>
      d.kind === "offer_letter" &&
      (d.candidateId === offer.candidateId ||
        d.candidateId === candidate?.id ||
        d.candidateId === candidate?.apiId),
  );
  let pdfDataUrl: string | null = null;
  try {
    pdfDataUrl = await resolveOfferLetterPdfDataUrl(offer, offerDoc);
  } catch {
    pdfDataUrl = null;
  }
  if (!pdfDataUrl?.startsWith("data:")) {
    pdfDataUrl = buildOfferLetterPdfDataUrl({
      offerCode: offer.offerCode,
      body: letterBody,
    });
  }
  const pdfAttachment = dataUrlToEmailAttachment(
    pdfDataUrl,
    `${filenameBase}.pdf`,
    "application/pdf",
  );
  if (!pdfAttachment) {
    return { sent: false, to, error: "Could not build offer letter PDF attachment" };
  }

  const portal = opts?.documentPortal;
  const expiresLabel = portal?.expiresAt
    ? new Date(portal.expiresAt).toLocaleDateString()
    : "";
  const portalBlock = portal
    ? `
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0"/>
  <p><strong>Next step — upload your documents</strong></p>
  <p>Use the secure portal below to upload KYC documents (Aadhaar, PAN, marksheets, and more). Log in with the credentials provided.</p>
  <p style="margin:8px 0"><strong>Portal link:</strong> <a href="${escapeHtml(portal.url)}">${escapeHtml(portal.url)}</a></p>
  <p style="margin:8px 0"><strong>Login email:</strong> ${escapeHtml(portal.loginEmail || to)}</p>
  <p style="margin:8px 0"><strong>Access code:</strong> <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px">${escapeHtml(portal.password)}</code></p>
  ${expiresLabel ? `<p style="margin:8px 0;color:#6b7280">Link expires on ${escapeHtml(expiresLabel)}.</p>` : ""}
`
    : "";

  const bodyHtml = `
<div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#111827;line-height:1.5">
  <p>Hi ${escapeHtml(candidateName)},</p>
  <p>Please find your offer letter attached for the role of <strong>${escapeHtml(jobTitle || offer.department || "the position")}</strong>.</p>
  <p style="margin:8px 0"><strong>Offer:</strong> ${escapeHtml(offer.offerCode)}</p>
  ${offer.joiningDate ? `<p style="margin:8px 0"><strong>Joining date:</strong> ${escapeHtml(offer.joiningDate)}</p>` : ""}
  ${offer.ctc ? `<p style="margin:8px 0"><strong>CTC:</strong> ₹${escapeHtml(String(offer.ctc.toLocaleString("en-IN")))}</p>` : ""}
  <p>Review the attached letter and reply to confirm acceptance.</p>
  ${portalBlock}
  <p style="margin-top:20px;color:#6b7280">Sent via iConnect Plus connected mail.</p>
</div>`.trim();

  try {
    await sendEmailCompose({
      to_address: to,
      subject: portal
        ? `Offer letter & document upload: ${jobTitle || offer.offerCode} (${offer.offerCode})`
        : `Offer letter: ${jobTitle || offer.offerCode} (${offer.offerCode})`,
      body_html: bodyHtml,
      event_type: "recruitment.offer.sent",
      payload_json: {
        offer_id: offer.id,
        offer_code: offer.offerCode,
        candidate_id: offer.candidateId,
        job_id: offer.jobId,
        document_portal: Boolean(portal),
      },
      attachments: [pdfAttachment],
    });
    appendAtsAudit({
      action: "offer_letter_emailed",
      detail: portal
        ? `${offer.offerCode} + document portal → ${to}`
        : `${offer.offerCode} → ${to}`,
      actor: actor(),
      entityId: offer.id,
    });
    return { sent: true, to, portalIncluded: Boolean(portal) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to email offer letter";
    devWarn(`Offer letter email failed: ${msg}`);
    return { sent: false, to, error: msg, portalIncluded: Boolean(portal) };
  }
}

export type UpdateOfferStatusResult = {
  offer: AtsOffer | null;
  email?: SendOfferLetterResult;
  portal?: BgPortalInviteResult;
};

export async function updateOfferStatus(
  id: string,
  status: AtsOffer["status"],
): Promise<AtsOffer | null> {
  const result = await updateOfferStatusWithEmail(id, status);
  return result.offer;
}

export async function updateOfferStatusWithEmail(
  id: string,
  status: AtsOffer["status"],
): Promise<UpdateOfferStatusResult> {
  const all = loadOffers();
  const idx = all.findIndex((o) => o.id === id);
  if (idx < 0) return { offer: null };

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

  let email: SendOfferLetterResult | undefined;
  let portal: BgPortalInviteResult | undefined;
  if (status === "sent") {
    const bundled = await sendOfferWithDocumentPortal(id);
    email = bundled.email;
    portal = bundled.portal;
  }

  if (status === "sent" && all[idx].applicationId) {
    const app = loadAppsNormalized().find((a) => a.id === all[idx].applicationId);
    const targetStage = portal ? "background_check" : "offer_sent";
    if (app?.status === "active" && app.stage !== targetStage) {
      try {
        await moveApplicationStage(all[idx].applicationId, targetStage);
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
  return { offer: all[idx], email, portal };
}

export function addDocument(
  candidateId: string,
  kind: AtsDocument["kind"],
  fileName: string,
  extras?: {
    contentDataUrl?: string;
    mimeType?: string;
    url?: string;
    status?: AtsDocument["status"];
    expiryDate?: string;
    offerId?: string;
  },
): AtsDocument {
  const row: AtsDocument = {
    id: crypto.randomUUID(),
    candidateId,
    kind,
    fileName,
    uploadedAt: nowIso(),
    status: extras?.status ?? "pending",
    contentDataUrl: extras?.contentDataUrl,
    mimeType: extras?.mimeType,
    url: extras?.url ?? extras?.contentDataUrl,
    expiryDate: extras?.expiryDate,
    offerId: extras?.offerId,
  };
  const all = loadDocs();
  all.unshift(row);
  saveDocs(all);
  return row;
}

function normalizeStoredPdfDataUrl(dataUrl: string): string {
  const raw = dataUrl.trim();
  if (!raw.startsWith("data:") || !/application\/pdf/i.test(raw)) return raw;
  const comma = raw.indexOf(",");
  if (comma < 0) return raw;
  // Strip `;filename=…` / extra params so preview & download stay reliable
  return `data:application/pdf;base64,${raw.slice(comma + 1)}`;
}

/** True when href can be opened in the browser (not an API fetch marker). */
export function isBrowserDocumentHref(href: string | null | undefined): boolean {
  const h = (href || "").trim();
  if (!h) return false;
  if (h.startsWith("recruitment-resume:")) return false;
  return (
    h.startsWith("data:") ||
    h.startsWith("blob:") ||
    /^https?:\/\//i.test(h) ||
    h.startsWith("/")
  );
}

/** Resolve a viewable/downloadable href for an ATS document. */
export function getDocumentHref(doc: AtsDocument): string | null {
  let href = (doc.contentDataUrl || doc.url || "").trim();

  // Offer letters: do not overwrite with a plain body-only stub here.
  // Use resolveOfferLetterPdfDataUrl (async) for letterhead + body preview.
  if (
    doc.kind === "offer_letter" &&
    href.startsWith("data:") &&
    !isSubstantialPdfDataUrl(href) &&
    href.length < 64
  ) {
    href = "";
  }

  if (!isBrowserDocumentHref(href)) return null;
  if (href.startsWith("data:application/pdf") || /data:.*pdf/i.test(href)) {
    return normalizeStoredPdfDataUrl(href);
  }
  return href;
}

/** Persist fetched file bytes onto an existing ATS document row. */
export function patchDocumentContent(
  id: string,
  patch: {
    contentDataUrl?: string;
    url?: string;
    mimeType?: string;
    fileName?: string;
  },
): AtsDocument | null {
  const all = loadDocs();
  const idx = all.findIndex((d) => d.id === id);
  if (idx < 0) return null;
  const content = (patch.contentDataUrl || patch.url || "").trim();
  if (isOversizedDocContent(content)) {
    void saveDocumentContent(id, content).catch(() => {
      /* ignore */
    });
    all[idx] = {
      ...all[idx],
      mimeType: patch.mimeType ?? all[idx].mimeType,
      fileName: patch.fileName ?? all[idx].fileName,
    };
    delete all[idx].contentDataUrl;
    delete all[idx].url;
    try {
      saveDocs(all);
    } catch {
      /* quota */
    }
    return {
      ...all[idx],
      contentDataUrl: content,
      url: content,
      mimeType: patch.mimeType ?? all[idx].mimeType,
      fileName: patch.fileName ?? all[idx].fileName,
    };
  }
  all[idx] = {
    ...all[idx],
    ...patch,
    url: patch.url ?? patch.contentDataUrl ?? all[idx].url,
  };
  try {
    saveDocs(all);
  } catch {
    /* quota */
  }
  return all[idx];
}

/** Open document in a new tab when content is available. */
export function openAtsDocument(doc: AtsDocument): boolean {
  const href = getDocumentHref(doc);
  if (!href || typeof window === "undefined") return false;
  if (href.startsWith("data:")) {
    const blobUrl = dataUrlToBlobUrl(href);
    if (blobUrl) {
      window.open(blobUrl, "_blank", "noopener,noreferrer");
      return true;
    }
  }
  window.open(href, "_blank", "noopener,noreferrer");
  return true;
}

/** Trigger a browser download for a stored ATS document. */
export function downloadAtsDocument(doc: AtsDocument): boolean {
  const href = getDocumentHref(doc);
  if (!href || typeof document === "undefined") return false;
  let downloadHref = href;
  let revoke: (() => void) | undefined;
  if (href.startsWith("data:")) {
    const blobUrl = dataUrlToBlobUrl(href);
    if (blobUrl) {
      downloadHref = blobUrl;
      revoke = () => URL.revokeObjectURL(blobUrl);
    }
  }
  const a = document.createElement("a");
  a.href = downloadHref;
  a.download = doc.fileName || "document";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (revoke) window.setTimeout(revoke, 1500);
  return true;
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
        source: normalizeCandidateSource(source || "other"),
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
