/**
 * BG vendor download portal — HR creates pack; partner logs in and downloads docs.
 */

import { apiClient } from "@/services/api-client";

export type BgVendorPack = {
  bgv_id: string;
  application_id: string;
  token: string;
  password: string;
  login_email: string;
  expires_at: string;
  candidate_name: string;
  candidate_email?: string;
  portal_url: string;
  document_count: number;
};

export type BgVendorMeta = {
  login_required?: boolean;
  candidate_name?: string | null;
  login_email_hint?: string | null;
  expires_at?: string | null;
  document_count?: number;
};

export type BgVendorDocumentMeta = {
  id: string;
  filename: string;
  content_type?: string;
  kind?: string | null;
  uploaded_at?: string | null;
};

export type BgVendorLoginResult = {
  bgv_id?: string;
  access_token: string;
  candidate_name?: string | null;
  expires_at?: string | null;
  documents?: BgVendorDocumentMeta[];
};

const accessKey = (token: string) => `bg_vendor_access_${token}`;

export function getBgVendorUrl(token: string): string {
  if (typeof window === "undefined") return `/bg-vendor/${token}`;
  return `${window.location.origin}/bg-vendor/${token}`;
}

export function getStoredBgVendorAccess(token: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(accessKey(token));
  } catch {
    return null;
  }
}

export function setStoredBgVendorAccess(token: string, accessToken: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(accessKey(token), accessToken);
  } catch {
    /* ignore */
  }
}

export function clearStoredBgVendorAccess(token: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(accessKey(token));
  } catch {
    /* ignore */
  }
}

export async function createBgVendorPack(
  applicationId: string,
  partnerEmail: string,
  opts?: { expiryHours?: number },
): Promise<BgVendorPack> {
  const res = await apiClient<BgVendorPack>(
    `/recruitment/applications/${encodeURIComponent(applicationId)}/send-bg-vendor`,
    {
      method: "POST",
      body: {
        partner_email: partnerEmail.trim(),
        expiry_hours: opts?.expiryHours ?? 24,
      },
    },
  );
  if (!res.data?.token) {
    throw new Error("Could not create BG vendor download pack");
  }
  return res.data;
}

export function buildBgVendorEmailBlock(pack: BgVendorPack): string {
  const url =
    typeof window !== "undefined" ? getBgVendorUrl(pack.token) : pack.portal_url;
  const expires = pack.expires_at
    ? new Date(pack.expires_at).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "24 hours from send time";
  return [
    "",
    "--- Document download portal ---",
    `Portal link: ${url}`,
    `Login email: ${pack.login_email}`,
    `Access code: ${pack.password}`,
    `Link expires: ${expires} (valid for 24 hours)`,
    `Documents available: ${pack.document_count}`,
    "",
    "Log in with the email and access code above to download the candidate documents.",
    "This download link expires 24 hours after it was sent.",
  ].join("\n");
}

export async function fetchBgVendorMeta(token: string): Promise<BgVendorMeta> {
  const res = await apiClient<BgVendorMeta>(
    `/public/bg-vendor/${encodeURIComponent(token)}`,
    { method: "GET", auth: false },
  );
  return (res.data ?? { login_required: true }) as BgVendorMeta;
}

export async function loginBgVendor(
  token: string,
  loginEmail: string,
  password: string,
): Promise<BgVendorLoginResult> {
  const res = await apiClient<BgVendorLoginResult>(
    `/public/bg-vendor/${encodeURIComponent(token)}/login`,
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
  setStoredBgVendorAccess(token, data.access_token);
  return data;
}

export async function listBgVendorDocuments(
  token: string,
): Promise<BgVendorDocumentMeta[]> {
  const access = getStoredBgVendorAccess(token);
  const res = await apiClient<BgVendorDocumentMeta[]>(
    `/public/bg-vendor/${encodeURIComponent(token)}/documents`,
    {
      method: "GET",
      auth: false,
      headers: access ? { "X-Bg-Vendor-Access": access } : {},
    },
  );
  return Array.isArray(res.data) ? res.data : [];
}

export async function downloadBgVendorDocument(
  token: string,
  docId: string,
): Promise<{ filename: string; content_base64: string; content_type: string }> {
  const access = getStoredBgVendorAccess(token);
  const res = await apiClient<{
    id: string;
    filename: string;
    content_base64: string;
    content_type: string;
  }>(`/public/bg-vendor/${encodeURIComponent(token)}/documents/${encodeURIComponent(docId)}`, {
    method: "GET",
    auth: false,
    headers: access ? { "X-Bg-Vendor-Access": access } : {},
  });
  if (!res.data?.content_base64) {
    throw new Error("Document content not available");
  }
  return {
    filename: res.data.filename || "document.bin",
    content_base64: res.data.content_base64,
    content_type: res.data.content_type || "application/octet-stream",
  };
}

export function triggerBase64Download(
  filename: string,
  contentBase64: string,
  contentType: string,
): void {
  if (typeof document === "undefined") return;
  const binary = atob(contentBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: contentType || "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "document.bin";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
