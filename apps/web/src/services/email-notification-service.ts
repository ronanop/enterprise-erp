import { ApiClientError, apiClient, formatApiError } from "@/services/api-client";
import { downloadFailedEmailAsEml } from "@/lib/recruitment/download-failed-email";
import { env, getApiUrl, setApiUrl } from "@/utils/env";

/** Client-side spacing between compose calls (ms). Server also paces SMTP. */
const CLIENT_SEND_GAP_MS = 2_500;
let lastComposeAt = 0;
let composeChain: Promise<unknown> = Promise.resolve();

async function paceClientCompose(): Promise<void> {
  const now = Date.now();
  const wait = CLIENT_SEND_GAP_MS - (now - lastComposeAt);
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  lastComposeAt = Date.now();
}

/**
 * Large JSON email bodies (portal docs as base64) often fail through the Next.js
 * same-origin `/api/v1` rewrite. Prefer the direct API origin for compose.
 */
function withDirectApiBase<T>(fn: () => Promise<T>): Promise<T> {
  const previous = getApiUrl();
  const direct = env.apiUrlPrimary || env.apiUrlFallback;
  const shouldSwitch =
    Boolean(direct) &&
    previous !== direct &&
    /:3000\b|:3001\b/.test(previous) &&
    !/:3000\b|:3001\b/.test(direct);
  if (shouldSwitch) {
    setApiUrl(direct);
  }
  return fn().finally(() => {
    if (shouldSwitch) setApiUrl(previous);
  });
}

type SmtpDiagnostics = {
  configured: boolean;
  missing: string[];
  present: string[];
  from_email: string | null;
  env_files_found: string[];
  hint: string | null;
};

export type EmailProviderStatus = {
  provider: string;
  configured: boolean;
  from_email: string | null;
  delivery_mode: string;
  host?: string | null;
  port?: number | null;
  use_tls?: boolean;
  auth?: boolean;
  diagnostics?: SmtpDiagnostics;
};

export type EmailDeliveryRow = {
  id: string;
  event_id: string;
  channel: string;
  attempt_no: number;
  status: string;
  provider_response: string | null;
  delivered_at: string | null;
  event_type: string | null;
  recipient_address: string | null;
  event_status: string | null;
  created_at: string | null;
  subject: string | null;
};

export type EmailEventRow = {
  id: string;
  template_id: string;
  event_type: string;
  recipient_address: string | null;
  recipient_user_id: string | null;
  status: string;
  created_at: string | null;
  payload_json: Record<string, unknown> | null;
};

export type EmailTemplateRow = {
  id: string;
  tenant_id: string;
  template_code: string;
  template_name: string;
  channel: string;
  subject_template: string | null;
  body_template: string;
  locale: string;
  is_active: boolean;
};

export type EmailOverview = {
  provider: EmailProviderStatus;
  counts: {
    email_templates: number;
    events: number;
    deliveries: number;
    delivered: number;
    failed: number;
    queued: number;
  };
  recent_deliveries: EmailDeliveryRow[];
  recent_events: EmailEventRow[];
};

export type EmailAttachmentPayload = {
  filename: string;
  content_base64: string;
  content_type?: string;
};

export type EmailComposePayload = {
  to_address: string;
  subject: string;
  body_html: string;
  event_type?: string;
  template_id?: string | null;
  payload_json?: Record<string, unknown> | null;
  attachments?: EmailAttachmentPayload[];
};

export type EmailTemplateCreatePayload = {
  template_code: string;
  template_name: string;
  channel: string;
  body_template: string;
  subject_template?: string | null;
};

export async function loadEmailOverview() {
  const res = await apiClient<EmailOverview>("/notifications/email/overview", { method: "GET" });
  return res.data;
}

export async function loadEmailStatus() {
  const res = await apiClient<EmailProviderStatus>("/notifications/email/status", { method: "GET" });
  return res.data;
}

export async function testEmailConnection() {
  const res = await apiClient<{
    ok: boolean;
    message: string;
    status_code: number;
    from_email: string | null;
    provider_response?: string | null;
    diagnostics?: SmtpDiagnostics;
    details?: {
      step: string;
      hint: string | null;
      missing: string[];
      present: string[];
      env_files_found: string[];
    };
  }>("/notifications/email/test", { method: "POST" });
  return res.data;
}

export type EmailComposeResult = {
  id: string;
  status: string;
  recipient_address: string;
  event_type: string;
  error?: string | null;
  /** Set when SMTP failed and a .eml was downloaded for manual send */
  failedEmlDownloaded?: string | null;
};

/**
 * Send via API SMTP.
 * Only downloads a .eml when the API accepted the request but SMTP delivery failed.
 * Auth / permission / network errors surface as clear errors (no fake "download = sent").
 */
export async function sendEmailCompose(body: EmailComposePayload): Promise<EmailComposeResult> {
  const run = async (): Promise<EmailComposeResult> => {
    await paceClientCompose();
    try {
      // ATS / recruitment mails use a module endpoint so HR users do not need
      // foundation.notification:create (that permission is for the Email console).
      const eventType = String(body.event_type || "");
      const path = eventType.startsWith("recruitment.")
        ? "/recruitment/email/send"
        : "/notifications/email/send";
      const res = await withDirectApiBase(() =>
        apiClient<EmailComposeResult>(path, {
          method: "POST",
          body,
        }),
      );
      const data = res.data;
      if (!data) {
        throw new Error("Empty email send response");
      }
      if (data.status === "failed" || data.status === "error") {
        const file = downloadFailedEmailAsEml({
          to_address: body.to_address,
          subject: body.subject,
          body_html: body.body_html,
        });
        const err =
          data.error ||
          `SMTP delivery failed (${data.status}). Downloaded ${file} — open and send manually.`;
        const wrapped = new Error(err) as Error & { failedEmlDownloaded?: string };
        wrapped.failedEmlDownloaded = file;
        throw wrapped;
      }
      return data;
    } catch (err) {
      if (err && typeof err === "object" && "failedEmlDownloaded" in err) {
        throw err;
      }
      // Do not auto-download .eml for 401/403/network — that looked like "mail sent as file".
      const msg = formatApiError(err, "Email send failed");
      if (err instanceof ApiClientError && (err.status === 401 || err.status === 403)) {
        throw new Error(
          `${msg}. Your account needs recruitment email permission — ask an admin to grant recruitment access.`,
        );
      }
      throw err instanceof Error ? err : new Error(msg);
    }
  };

  // Serialize compose calls so delays stack correctly under parallel offer/BG sends
  const next = composeChain.then(run, run);
  composeChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

export async function listEmailTemplates() {
  const res = await apiClient<EmailTemplateRow[]>("/notifications/templates", {
    method: "GET",
    query: { channel: "email" },
  });
  return res.data ?? [];
}

export async function createEmailTemplate(body: EmailTemplateCreatePayload) {
  const res = await apiClient<EmailTemplateRow>("/notifications/templates", {
    method: "POST",
    body: { ...body, channel: "email" },
  });
  return res.data;
}

export async function listEmailDeliveries(limit = 100) {
  const res = await apiClient<EmailDeliveryRow[]>("/notifications/deliveries", {
    method: "GET",
    query: { limit },
  });
  return (res.data ?? []).filter((d) => d.channel === "email");
}

export async function listEmailEvents(limit = 100) {
  const res = await apiClient<EmailEventRow[]>("/notifications/events", {
    method: "GET",
    query: { limit },
  });
  return res.data ?? [];
}
