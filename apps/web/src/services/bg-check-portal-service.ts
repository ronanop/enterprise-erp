/**
 * BG document portal — HR invite + public candidate upload + vendor attachments.
 */

import { apiClient } from "@/services/api-client";
import { sendEmailCompose } from "@/services/email-notification-service";

export type BgPortalInvite = {
  bgv_id: string;
  document_number: string;
  token: string;
  password: string;
  login_email: string;
  expires_at: string;
  candidate_name: string;
  candidate_email: string;
  application_id: string;
  portal_status: string;
  portal_url?: string;
  email_sent?: boolean;
  email_error?: string | null;
};

export type BgPortalDocument = {
  id: string;
  kind: string;
  fileName: string;
  mimeType?: string;
  uploadedAt?: string;
  fileDataUrl?: string;
  hasFile?: boolean;
};

export type BgPortalPayload = {
  token?: string;
  status?: string;
  expiresAt?: string;
  candidateName?: string;
  personal?: {
    fullName?: string;
    email?: string;
    phone?: string;
    address?: string;
    state?: string;
    pincode?: string;
    dob?: string;
  };
  governmentIds?: { aadhaar?: string; pan?: string };
  documents?: BgPortalDocument[];
  submittedAt?: string | null;
};

function shareableOrigin(): string {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

export function getBgPortalUrl(token: string): string {
  const origin = shareableOrigin();
  return origin ? `${origin}/bg-check/${token}` : `/bg-check/${token}`;
}

export function buildBgPortalEmailBody(invite: BgPortalInvite): string {
  const url = getBgPortalUrl(invite.token);
  const expires = invite.expires_at
    ? new Date(invite.expires_at).toLocaleDateString()
    : "the expiry date in this email";
  return [
    `Hello ${invite.candidate_name || "there"},`,
    "",
    "Please complete your background-check document portal. We need your personal details plus KYC documents (Aadhaar, PAN, marksheets, bank proof, and employment papers).",
    "",
    `Portal link: ${url}`,
    `Email: ${invite.login_email}`,
    `Access code: ${invite.password}`,
    "",
    `This link expires on ${expires}.`,
    "",
    "Log in with the email and access code above to upload your documents. After you submit, HR will share them with our verification partner.",
    "",
    "- HR Team",
  ].join("\n");
}

export type BgPortalInviteResult = BgPortalInvite & {
  emailSent: boolean;
  emailError?: string;
};

export async function sendBgDocumentPortal(
  applicationId: string,
  opts?: { expiryDays?: number; sendEmail?: boolean },
): Promise<BgPortalInviteResult> {
  const wantEmail = opts?.sendEmail !== false;
  const res = await apiClient<BgPortalInvite>(
    `/recruitment/applications/${encodeURIComponent(applicationId)}/send-bg-portal`,
    {
      method: "POST",
      query: {
        expiry_days: opts?.expiryDays ?? 7,
        send_email: wantEmail,
      },
    },
  );
  const data = res.data;
  if (!data?.token) {
    throw new Error("Could not create BG document portal");
  }

  // Prefer server-side mail from send-bg-portal (no notification:create on the client).
  // When wantEmail is false, credentials are for bundling into the offer email.
  let emailSent = Boolean(data.email_sent);
  let emailError = data.email_error ?? undefined;
  if (!emailSent && wantEmail && data.candidate_email) {
    const body = buildBgPortalEmailBody(data);
    const bodyHtml = `<div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;line-height:1.5;color:#111827">${body
      .split("\n")
      .map((l) => (l ? escapeHtml(l) : "<br/>"))
      .join("<br/>")}</div>`;
    try {
      await sendEmailCompose({
        to_address: data.candidate_email,
        subject: `Background check documents required — ${data.candidate_name}`,
        body_html: bodyHtml,
        event_type: "recruitment.bg_check.portal_invite",
        payload_json: {
          application_id: data.application_id,
          token: data.token,
        },
      });
      emailSent = true;
      emailError = undefined;
    } catch (e) {
      emailSent = false;
      emailError = e instanceof Error ? e.message : "Email send failed";
    }
  }

  return { ...data, emailSent, emailError };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type BgPortalMeta = {
  login_required?: boolean;
  candidate_name?: string | null;
  login_email_hint?: string | null;
  expires_at?: string | null;
  portal?: BgPortalPayload;
};

export type BgPortalLoginResult = {
  portal: BgPortalPayload;
  access_token: string;
  bgv_id?: string;
  document_number?: string;
  status?: string;
};

const accessKey = (token: string) => `bg_portal_access_${token}`;

export function getStoredBgPortalAccess(token: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(accessKey(token));
  } catch {
    return null;
  }
}

export function setStoredBgPortalAccess(token: string, accessToken: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(accessKey(token), accessToken);
  } catch {
    /* ignore */
  }
}

export function clearStoredBgPortalAccess(token: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(accessKey(token));
  } catch {
    /* ignore */
  }
}

/** Public meta only — does not unlock documents. */
export async function fetchBgPortalMeta(token: string): Promise<BgPortalMeta> {
  const res = await apiClient<BgPortalMeta>(
    `/public/bg-check/${encodeURIComponent(token)}`,
    { method: "GET", auth: false },
  );
  return (res.data ?? { login_required: true }) as BgPortalMeta;
}

export async function loginBgPortal(
  token: string,
  loginEmail: string,
  password: string,
): Promise<BgPortalLoginResult> {
  const res = await apiClient<BgPortalLoginResult>(
    `/public/bg-check/${encodeURIComponent(token)}/login`,
    {
      method: "POST",
      auth: false,
      body: { login_email: loginEmail, password },
    },
  );
  const data = res.data;
  if (!data?.access_token) {
    throw new Error("Login failed — no access token returned");
  }
  setStoredBgPortalAccess(token, data.access_token);
  return data;
}

/** @deprecated use fetchBgPortalMeta + loginBgPortal */
export async function fetchBgPortal(token: string): Promise<{ portal: BgPortalPayload }> {
  const meta = await fetchBgPortalMeta(token);
  return { portal: meta.portal ?? {} };
}

export async function saveBgPortal(
  token: string,
  portal: Partial<BgPortalPayload> & {
    personal?: BgPortalPayload["personal"];
    governmentIds?: BgPortalPayload["governmentIds"];
    documents?: BgPortalDocument[];
  },
): Promise<{ portal: BgPortalPayload }> {
  const access_token = getStoredBgPortalAccess(token);
  const res = await apiClient<{ portal: BgPortalPayload }>(
    `/public/bg-check/${encodeURIComponent(token)}/save`,
    { method: "POST", auth: false, body: { portal, access_token } },
  );
  return (res.data ?? { portal: {} }) as { portal: BgPortalPayload };
}

export async function submitBgPortal(
  token: string,
  portal: Partial<BgPortalPayload> & {
    personal?: BgPortalPayload["personal"];
    governmentIds?: BgPortalPayload["governmentIds"];
    documents?: BgPortalDocument[];
  },
): Promise<{ portal: BgPortalPayload }> {
  const access_token = getStoredBgPortalAccess(token);
  const res = await apiClient<{ portal: BgPortalPayload }>(
    `/public/bg-check/${encodeURIComponent(token)}/submit`,
    { method: "POST", auth: false, body: { portal, access_token } },
  );
  return (res.data ?? { portal: {} }) as { portal: BgPortalPayload };
}

export type BgVendorAttachment = {
  filename: string;
  content_base64: string;
  content_type: string;
  kind?: string;
};

export async function fetchBgPortalAttachments(
  applicationId: string,
): Promise<BgVendorAttachment[]> {
  const res = await apiClient<BgVendorAttachment[]>(
    `/recruitment/applications/${encodeURIComponent(applicationId)}/bg-portal-attachments`,
    { method: "GET" },
  );
  return Array.isArray(res.data) ? res.data : [];
}

export type BgPortalStatusDocument = {
  id?: string;
  kind?: string;
  fileName?: string;
  mimeType?: string;
  uploadedAt?: string;
  hasFile?: boolean;
};

export type BgPortalStatus = {
  bgv_id: string;
  status: string;
  submitted_at?: string | null;
  document_count: number;
  expires_at?: string | null;
  /** Portal exists — credentials are never returned to the UI. */
  has_portal?: boolean;
  candidate_name?: string | null;
  sent_at?: string | null;
  personal?: {
    fullName?: string;
    email?: string;
    phone?: string;
    address?: string;
    state?: string;
    pincode?: string;
    dob?: string;
  };
  government_ids?: { aadhaar?: string; pan?: string };
  documents?: BgPortalStatusDocument[];
};

export async function fetchBgPortalStatus(
  applicationId: string,
): Promise<BgPortalStatus | null> {
  const res = await apiClient<BgPortalStatus | null>(
    `/recruitment/applications/${encodeURIComponent(applicationId)}/bg-portal-status`,
    { method: "GET" },
  );
  return res.data ?? null;
}

/** Resolve ATS application id from offer / candidate linkage. */
export async function resolveBgApplicationId(input: {
  offerId?: string;
  offerCode?: string;
  candidateId?: string;
  applicationId?: string;
}): Promise<string> {
  const direct = (input.applicationId || "").trim();
  if (direct) return direct;
  try {
    const { loadRecruitmentOverview } = await import("@/services/recruitment-service");
    const overview = await loadRecruitmentOverview();
    const offerId = (input.offerId || "").trim();
    const offerCode = (input.offerCode || "").trim();
    const candidateId = (input.candidateId || "").trim();

    const offer = (overview.offers || []).find((o) => {
      const id = String(o.id ?? "");
      const code = String(o.document_number ?? o.offer_number ?? "");
      const cid = String(o.candidate_id ?? "");
      if (offerId && id === offerId) return true;
      if (offerCode && code && code === offerCode) return true;
      if (candidateId && cid === candidateId) return true;
      return false;
    });
    if (offer?.application_id != null) return String(offer.application_id);
    if (candidateId) {
      const app = (overview.applications || []).find(
        (a) => String(a.candidate_id ?? "") === candidateId,
      );
      if (app?.id != null) return String(app.id);
    }
  } catch {
    /* ignore */
  }
  return "";
}

/** Resolve Aadhaar / PAN collected on the BG document portal for an ATS offer or candidate. */
export async function resolveBgGovernmentIds(input: {
  offerId?: string;
  offerCode?: string;
  candidateId?: string;
  applicationId?: string;
}): Promise<{ aadhaar: string; pan: string; applicationId?: string }> {
  const empty = { aadhaar: "", pan: "" };
  try {
    const applicationId = await resolveBgApplicationId(input);
    if (!applicationId) return empty;

    const status = await fetchBgPortalStatus(applicationId);
    const aadhaar = String(status?.government_ids?.aadhaar ?? "").replace(/\D/g, "");
    const pan = String(status?.government_ids?.pan ?? "")
      .trim()
      .toUpperCase();
    return { aadhaar, pan, applicationId };
  } catch {
    return empty;
  }
}

const BG_KIND_LABELS: Record<string, string> = {
  aadhaar_card: "Aadhaar card",
  pan_card: "PAN card",
  marksheet_10th: "10th Marksheet",
  marksheet_12th: "12th Marksheet",
  graduation: "Graduation",
  pg_diploma: "Post Graduate / Diploma",
  cancelled_cheque: "Cancelled Cheque / Passbook",
  resume: "Resume",
  appointment_letter: "Offer / Appointment Letter",
  relieving_letter: "Relieving Letter",
  salary_slips: "Salary Slip",
  other: "Certificate",
};

export function bgDocumentKindLabel(kind?: string | null): string {
  const key = String(kind || "").trim();
  if (!key) return "Document";
  return BG_KIND_LABELS[key] || key.replace(/_/g, " ");
}

export type BgDocumentDisplay = {
  id: string;
  kind: string;
  label: string;
  fileName: string;
  mimeType: string;
  fileDataUrl: string;
};

/** Downloadable BG portal files for an offer / candidate (HR auth). */
export async function fetchBgDocumentsForCandidate(input: {
  offerId?: string;
  offerCode?: string;
  candidateId?: string;
  applicationId?: string;
}): Promise<BgDocumentDisplay[]> {
  const applicationId = await resolveBgApplicationId(input);
  if (!applicationId) return [];
  const attachments = await fetchBgPortalAttachments(applicationId).catch(() => []);
  return attachments
    .filter((a) => Boolean(a.content_base64))
    .map((a, index) => {
      const mime = a.content_type || "application/octet-stream";
      const kind = String(a.kind || "other");
      return {
        id: `bg-${applicationId}-${index}-${a.filename}`,
        kind,
        label: bgDocumentKindLabel(kind),
        fileName: a.filename || `${kind}.bin`,
        mimeType: mime,
        fileDataUrl: `data:${mime};base64,${a.content_base64}`,
      };
    });
}

export type BgPortalReviewDecision = "verified" | "rejected";

/** HR marks BG portal documents verified (cleared) or rejected (failed). */
export async function reviewBgPortal(
  applicationId: string,
  decision: BgPortalReviewDecision,
): Promise<BgPortalStatus> {
  const res = await apiClient<BgPortalStatus>(
    `/recruitment/applications/${encodeURIComponent(applicationId)}/bg-portal-review`,
    {
      method: "POST",
      query: { decision },
    },
  );
  if (!res.data) throw new Error("Could not save BG review");
  return res.data;
}

export function bgPortalStatusLabel(status: string | null | undefined): string {
  const s = (status || "").toLowerCase();
  switch (s) {
    case "verified":
    case "cleared":
      return "Verified";
    case "rejected":
    case "failed":
      return "Rejected";
    case "docs_submitted":
    case "submitted":
      return "Docs submitted";
    case "docs_requested":
    case "draft":
    case "in_progress":
      return "Awaiting docs";
    default:
      return s ? s.replace(/_/g, " ") : "Pending";
  }
}

export function bgPortalStatusTone(status: string | null | undefined): string {
  const s = (status || "").toLowerCase();
  switch (s) {
    case "verified":
    case "cleared":
      return "bg-[#ECFDF5] text-[#00A866]";
    case "rejected":
    case "failed":
      return "bg-[#FFF1F2] text-[#F43F5E]";
    case "docs_submitted":
    case "submitted":
      return "bg-primary/10 text-primary";
    default:
      return "bg-[#FFF7ED] text-[#EA580C]";
  }
}
