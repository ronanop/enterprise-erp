import {
  ApiClientError,
  apiGetBlob,
} from "@/services/api-client";
import {
  getDocumentHref,
  patchDocumentContent,
} from "@/services/recruitment-ats-service";
import type { AtsCandidate, AtsDocument } from "@/types/recruitment-ats";

function blobToDataUrl(blob: Blob): Promise<string> {
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

async function fetchResumeFileAsDocument(
  candidate: AtsCandidate,
  candidateIdForApi: string,
): Promise<AtsDocument> {
  let result;
  try {
    result = await apiGetBlob(
      `/recruitment/candidates/${encodeURIComponent(candidateIdForApi)}/resume-file`,
    );
  } catch (e) {
    if (e instanceof ApiClientError) {
      if (e.status === 404) {
        throw new Error(
          candidate.resumeName
            ? "Resume file is not available yet. Ask the candidate to re-apply with a resume, or upload one in HRMS."
            : "No resume uploaded for this candidate",
        );
      }
      throw new Error(e.message || "Could not load resume");
    }
    throw new Error(
      e instanceof Error ? e.message : "Could not load resume",
    );
  }

  if (result.kind === "legacy") {
    return {
      id: `resume-api-${candidateIdForApi}`,
      candidateId: candidate.id,
      kind: "resume",
      fileName: candidate.resumeName || "resume.pdf",
      uploadedAt: candidate.updatedAt || candidate.createdAt || new Date().toISOString(),
      status: "pending",
      url: result.externalUrl,
    };
  }

  const dataUrl = await blobToDataUrl(result.blob);
  const mimeType = result.contentType || result.blob.type || "application/pdf";
  return {
    id: `resume-api-${candidateIdForApi}`,
    candidateId: candidate.id,
    kind: "resume",
    fileName: candidate.resumeName || result.filename || "resume.pdf",
    uploadedAt: candidate.updatedAt || candidate.createdAt || new Date().toISOString(),
    status: "pending",
    contentDataUrl: dataUrl,
    url: dataUrl,
    mimeType,
  };
}

/**
 * Resolve a candidate resume into an AtsDocument suitable for the PDF preview modal.
 * Prefers local document content, then candidate data URL, then API resume-file.
 */
export async function resolveCandidateResumeDocument(
  candidate: AtsCandidate,
  documents: AtsDocument[] = [],
): Promise<AtsDocument> {
  const local = documents
    .filter(
      (d) =>
        (d.candidateId === candidate.id || d.candidateId === candidate.apiId) &&
        d.kind === "resume",
    )
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));

  for (const doc of local) {
    if (getDocumentHref(doc)) return doc;
  }

  const resumeUrl = (candidate.resumeUrl || "").trim();
  if (resumeUrl.startsWith("data:")) {
    return {
      id: `resume-inline-${candidate.id}`,
      candidateId: candidate.id,
      kind: "resume",
      fileName: candidate.resumeName || "resume.pdf",
      uploadedAt: candidate.updatedAt || candidate.createdAt || new Date().toISOString(),
      status: "pending",
      contentDataUrl: resumeUrl,
      url: resumeUrl,
      mimeType: resumeUrl.startsWith("data:application/pdf")
        ? "application/pdf"
        : undefined,
    };
  }

  // http(s) absolute links (rare) — open directly
  if (/^https?:\/\//i.test(resumeUrl)) {
    return {
      id: `resume-url-${candidate.id}`,
      candidateId: candidate.id,
      kind: "resume",
      fileName: candidate.resumeName || "resume.pdf",
      uploadedAt: candidate.updatedAt || candidate.createdAt || new Date().toISOString(),
      status: "pending",
      url: resumeUrl,
    };
  }

  const candidateId = resumeUrl.startsWith("recruitment-resume:")
    ? resumeUrl.slice("recruitment-resume:".length)
    : candidate.apiId || candidate.id;
  if (!candidateId) {
    throw new Error(
      candidate.resumeName
        ? "Resume file is not available yet. Ask the candidate to re-apply with a resume, or upload one in HRMS."
        : "No resume uploaded for this candidate",
    );
  }
  return fetchResumeFileAsDocument(candidate, candidateId);
}

/**
 * Ensure an ATS document row has browser-viewable content.
 * Resumes without local bytes are fetched from the API and cached on the row.
 */
export async function ensureAtsDocumentContent(
  doc: AtsDocument,
  candidates: AtsCandidate[],
  documents: AtsDocument[] = [],
): Promise<AtsDocument> {
  if (getDocumentHref(doc)) return doc;

  if (doc.kind !== "resume") {
    throw new Error("No file content available to view");
  }

  const candidate =
    candidates.find(
      (c) => c.id === doc.candidateId || c.apiId === doc.candidateId,
    ) ?? null;
  if (!candidate) {
    throw new Error("Candidate not found for this document");
  }

  const resolved = await resolveCandidateResumeDocument(candidate, documents);
  const href = getDocumentHref(resolved);
  if (!href) {
    throw new Error("No file content available to view");
  }

  const patched = patchDocumentContent(doc.id, {
    contentDataUrl: resolved.contentDataUrl,
    url: resolved.url || resolved.contentDataUrl,
    mimeType: resolved.mimeType,
    fileName: doc.fileName || resolved.fileName,
  });

  return patched
    ? patched
    : {
        ...doc,
        contentDataUrl: resolved.contentDataUrl,
        url: resolved.url || resolved.contentDataUrl,
        mimeType: resolved.mimeType || doc.mimeType,
      };
}
