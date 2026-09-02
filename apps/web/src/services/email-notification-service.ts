import { apiClient } from "@/services/api-client";

export type EmailProviderStatus = {
  provider: string;
  configured: boolean;
  from_email: string | null;
  delivery_mode: string;
  tenant_id_set: boolean;
  client_id_set: boolean;
  client_secret_set: boolean;
  diagnostics?: {
    configured: boolean;
    missing: string[];
    present: string[];
    from_email: string | null;
    tenant_id_preview: string | null;
    client_id_preview: string | null;
    env_files_found: string[];
    hint: string | null;
  };
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

export type EmailComposePayload = {
  to_address: string;
  subject: string;
  body_html: string;
  event_type?: string;
  template_id?: string | null;
  payload_json?: Record<string, unknown> | null;
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
    diagnostics?: {
      configured: boolean;
      missing: string[];
      present: string[];
      from_email: string | null;
      tenant_id_preview: string | null;
      client_id_preview: string | null;
      env_files_found: string[];
      hint: string | null;
    };
    details?: {
      step: string;
      hint: string | null;
      missing: string[];
      present: string[];
      env_files_found: string[];
      tenant_id_preview: string | null;
      client_id_preview: string | null;
    };
  }>("/notifications/email/test", { method: "POST" });
  return res.data;
}

export async function sendEmailCompose(body: EmailComposePayload) {
  const res = await apiClient<{ id: string; status: string; recipient_address: string; event_type: string }>(
    "/notifications/email/send",
    { method: "POST", body },
  );
  return res.data;
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
