import { ApiClientError, apiClient, resourceService } from "@/services/api-client";

const API = "/service/service-request-tickets";

export type TicketAttachment = {
  id: string;
  request_id: string;
  file_name: string;
  content_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  uploaded_at: string;
  field_engineer_id?: string | null;
};

export type TicketFieldEngineer = {
  id: string;
  request_id: string;
  engineer_name: string;
  engineer_contact: string | null;
  engineer_email: string;
  assigned_date: string | null;
  solution_summary: string | null;
  status: string;
  solved_at: string | null;
  work_brief?: string | null;
  show_issue?: boolean;
  show_customer?: boolean;
  show_site?: boolean;
  show_asset?: boolean;
  show_circuit?: boolean;
  attachments?: TicketAttachment[];
  login_email?: string | null;
  temporary_password?: string | null;
  account_created?: boolean;
  credentials_email_sent?: boolean;
  credentials_note?: string | null;
};

export type FieldEngineerTicketItem = {
  id: string;
  document_number: string;
  subject: string;
  status: string;
  priority: string;
  asset_status: string | null;
  serial_number: string | null;
  field_engineer_id: string;
  field_engineer_status: string;
  assigned_date: string | null;
  solution_summary: string | null;
  created_at: string;
  work_brief?: string | null;
  show_issue?: boolean;
  show_customer?: boolean;
  show_site?: boolean;
  show_asset?: boolean;
  show_circuit?: boolean;
  issue_description?: string | null;
  end_customer_name?: string | null;
  coordinator_name?: string | null;
  coordinator_phone?: string | null;
  end_customer_street?: string | null;
  end_customer_city?: string | null;
  end_customer_state?: string | null;
  end_customer_postal_code?: string | null;
  site_availability?: string | null;
  site_instructions?: string | null;
  asset_name?: string | null;
  reference_sr_number?: string | null;
  ckt_id?: string | null;
  link_type?: string | null;
  bandwidth?: string | null;
  ports_in_use?: string | null;
  ip_details?: string | null;
  previous_fe_notes?: string | null;
};

export type ServiceRequestTicket = {
  id: string;
  document_number: string;
  subject: string;
  contact_name: string | null;
  customer_id: string;
  priority: string;
  status: string;
  owner_employee_id: string | null;
  mode_of_action: string | null;
  created_at: string;
  due_at: string | null;
  ticket_category: string | null;
  channel: string | null;
  company_id: string;
  branch_id: string;
  version: number;
  category_id?: string;
  service_type?: string;
  email?: string | null;
  alternate_email?: string | null;
  mobile?: string | null;
  product_id?: string | null;
  contact_id?: string | null;
  master_asset_id?: string | null;
  software_version?: string | null;
  issue_description?: string | null;
  description?: string | null;
  sla_id?: string | null;
  sla_status?: string | null;
  reference_sr_number?: string | null;
  customer_reference?: string | null;
  lsi?: string | null;
  ckt_id?: string | null;
  end_customer_name?: string | null;
  end_customer_email?: string | null;
  coordinator_name?: string | null;
  coordinator_phone?: string | null;
  end_customer_street?: string | null;
  end_customer_state?: string | null;
  end_customer_city?: string | null;
  end_customer_city_type?: string | null;
  end_customer_other_city?: string | null;
  end_customer_gst?: string | null;
  end_customer_postal_code?: string | null;
  start_work_date?: string | null;
  classification?: string | null;
  escalation_reason?: string | null;
  next_plan?: string | null;
  additional_description?: string | null;
  oem_support_enabled?: boolean;
  asset_name?: string | null;
  serial_number?: string | null;
  warranty_start_date?: string | null;
  warranty_end_date?: string | null;
  amc_end_date?: string | null;
  asset_status?: string | null;
  asset_confirmed_at?: string | null;
  amc_mail_sent?: boolean;
  remote_engineer_name?: string | null;
  remote_engineer_contact?: string | null;
  remote_engineer_date?: string | null;
  follow_up_at?: string | null;
  follow_up_note?: string | null;
  site_availability?: string | null;
  site_instructions?: string | null;
  link_type?: string | null;
  bandwidth?: string | null;
  ports_in_use?: string | null;
  previous_fe_notes?: string | null;
  ip_details?: string | null;
  mail_extra_info?: string | null;
  company_name_from_mail?: string | null;
  ticket_start_at?: string | null;
  ticket_end_at?: string | null;
  field_engineers?: TicketFieldEngineer[];
  field_engineer?: FieldEngineerVisit | null;
  oem_support?: OemSupport | null;
  solution_summary?: string | null;
  solution_type?: string | null;
  resolved_at?: string | null;
  closed_at?: string | null;
  reopened_at?: string | null;
  ownership_locked?: boolean;
  opened_at?: string | null;
  opened_by?: string | null;
  sla_started_at?: string | null;
  co_owners?: TicketCoOwner[];
  stakeholders?: TicketStakeholder[];
  access?: TicketAccessInfo | null;
};

export type TicketCoOwner = {
  id: string;
  request_id: string;
  employee_id: string;
  added_by: string | null;
  added_at: string;
};

export type TicketStakeholder = {
  id: string;
  request_id: string;
  name: string;
  email: string;
  added_by: string | null;
  added_at: string;
};

export type TicketAccessInfo = {
  level: "full" | "assign_preview" | "stakeholder" | "denied";
  is_owner: boolean;
  is_co_owner: boolean;
  is_manager: boolean;
  is_stakeholder: boolean;
  can_assign: boolean;
  can_work: boolean;
  can_manage_collaborators: boolean;
  can_reopen: boolean;
  can_open: boolean;
  is_opened: boolean;
  can_end?: boolean;
  can_resume?: boolean;
  employee_id: string | null;
};

export type TicketStakeholderView = {
  id: string;
  document_number: string;
  subject: string;
  status: string;
  is_resolved: boolean;
  is_closed: boolean;
  resolved_at: string | null;
  closed_at: string | null;
  owner_employee_id: string | null;
  solution_type?: string | null;
  solution_summary?: string | null;
  field_engineer_work?: {
    engineer_name: string;
    engineer_email?: string | null;
    status: string;
    solution_summary?: string | null;
    solved_at?: string | null;
    work_brief?: string | null;
  }[];
};

export type FieldEngineerVisit = {
  engineer_name?: string | null;
  engineer_contact?: string | null;
  distance?: string | null;
  visits_count?: number | null;
  carrying_spares?: boolean;
  visit_date?: string | null;
  hw_replacement?: string | null;
  transport_mode?: string | null;
  movement_charges?: number | null;
  visit_charges?: number | null;
  total_charges?: number | null;
  remarks?: string | null;
  payment_approval?: string | null;
};

export type OemSupport = {
  oem_name?: string | null;
  oem_ticket_number?: string | null;
  customer_reference?: string | null;
  ticket_type?: string | null;
  oem_engineer_contact?: string | null;
  tac_response_summary?: string | null;
  tac_resolution?: string | null;
  oem_status?: string | null;
  last_checked_at?: string | null;
};

export type TicketComment = {
  id: string;
  request_id: string;
  author_user_id: string | null;
  body: string;
  is_internal: boolean;
  commented_at: string;
};

export type TimelineItem = {
  event_type: string;
  title: string;
  description?: string | null;
  actor_id?: string | null;
  occurred_at: string;
};

export type TicketListQuery = {
  q?: string;
  priority?: string;
  status?: string;
  owner_id?: string;
  mode?: string;
  category?: string;
  customer_id?: string;
  mine?: boolean;
  page?: number;
  page_size?: number;
};

export type SlaTrackerItem = {
  id: string;
  document_number: string;
  subject: string;
  priority: string;
  status: string;
  sla_status: string | null;
  sla_started_at: string;
  due_at: string | null;
  owner_employee_id: string | null;
  owner_name: string | null;
  elapsed_minutes: number;
  remaining_minutes: number | null;
  is_breached: boolean;
};

export type SlaComplianceSummary = {
  active_breached: number;
  closed_within_sla: number;
  closed_after_breach: number;
};

export type ResolvedTicketItem = {
  id: string;
  document_number: string;
  subject: string;
  priority: string;
  status: string;
  solution_type: string | null;
  solution_summary: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  due_at?: string | null;
  closed_within_sla?: boolean | null;
  owner_employee_id: string | null;
  owner_name: string | null;
};

export type ServiceNotification = {
  id: string;
  request_id: string | null;
  notification_type: string;
  recipient_user_id: string | null;
  payload_json: { message?: string; document_number?: string; ticket_id?: string; for_service_head?: boolean } | null;
  sent_at: string | null;
  delivery_status: string;
  status: string;
};

function unwrap<T>(data: unknown): T {
  return data as T;
}

export async function listServiceRequestTickets(query?: TicketListQuery): Promise<ServiceRequestTicket[]> {
  const res = await resourceService.list<ServiceRequestTicket>(API, query);
  const data = res.data;
  return Array.isArray(data) ? data : [];
}

export async function listSlaTracker(opts?: { page_size?: number; mine?: boolean }): Promise<SlaTrackerItem[]> {
  const res = await apiClient<SlaTrackerItem[]>(`${API}/sla-tracker`, {
    query: { page_size: opts?.page_size ?? 200, mine: opts?.mine ? true : undefined },
  });
  return Array.isArray(res.data) ? res.data : [];
}

export async function getSlaComplianceSummary(opts?: { mine?: boolean }): Promise<SlaComplianceSummary> {
  const res = await apiClient<SlaComplianceSummary>(`${API}/sla-compliance-summary`, {
    query: { mine: opts?.mine ? true : undefined },
  });
  const summary = (res.data ?? {
    active_breached: 0,
    closed_within_sla: 0,
    closed_after_breach: 0,
  }) as SlaComplianceSummary;

  if (typeof summary.active_breached === "number") {
    return summary;
  }

  // Older API builds only return closed-ticket counts — derive active breaches from SLA tracker.
  const tracker = await listSlaTracker({ mine: opts?.mine });
  return {
    ...summary,
    active_breached: tracker.filter((row) => row.is_breached).length,
  };
}

export async function listResolvedTickets(query?: {
  q?: string;
  page_size?: number;
  sla_outcome?: "within" | "breach";
  mine?: boolean;
}): Promise<ResolvedTicketItem[]> {
  const res = await apiClient<ResolvedTicketItem[]>(`${API}/resolved-tickets`, { query });
  return Array.isArray(res.data) ? res.data : [];
}

export async function listServiceHeadNotifications(page_size = 15): Promise<ServiceNotification[]> {
  const res = await apiClient<ServiceNotification[]>("/service/service-notifications", {
    query: { page_size, mine: true },
  });
  const rows = Array.isArray(res.data) ? res.data : [];
  return rows.filter((n) =>
    ["ticket_opened", "ticket_resolved", "ticket_assigned"].includes(n.notification_type),
  );
}

export function formatDurationMinutes(minutes: number): string {
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export async function getServiceRequestTicket(id: string): Promise<ServiceRequestTicket> {
  const res = await resourceService.get<ServiceRequestTicket>(API, id);
  return unwrap(res.data);
}

export async function createServiceRequestTicket(body: Record<string, unknown>): Promise<ServiceRequestTicket> {
  const res = await resourceService.create<ServiceRequestTicket>(API, body);
  return unwrap(res.data);
}

export async function updateServiceRequestTicket(id: string, body: Record<string, unknown>): Promise<ServiceRequestTicket> {
  const res = await resourceService.update<ServiceRequestTicket>(API, id, body);
  return unwrap(res.data);
}

export async function deleteServiceRequestTicket(id: string): Promise<void> {
  await resourceService.delete(API, id);
}

export async function changeTicketStatus(id: string, status: string, reason?: string): Promise<ServiceRequestTicket> {
  const res = await resourceService.action<ServiceRequestTicket>(API, id, "status", { status, reason });
  return unwrap(res.data);
}

export async function listAssignableEmployees(): Promise<LookupOption[]> {
  const res = await apiClient<{ id: string; employee_code: string; display_name: string; designation?: string | null }[]>(
    `${API}/assignable-employees`,
  );
  const rows = Array.isArray(res.data) ? res.data : [];
  return rows.map((r) => ({
    value: r.id,
    label: r.display_name,
  }));
}

export async function openTicket(id: string): Promise<ServiceRequestTicket> {
  const res = await resourceService.action<ServiceRequestTicket>(API, id, "open", {});
  return unwrap(res.data);
}

export async function assignTicketOwner(id: string, ownerEmployeeId: string): Promise<ServiceRequestTicket> {
  const res = await resourceService.action<ServiceRequestTicket>(API, id, "assign", {
    owner_employee_id: ownerEmployeeId,
  });
  return unwrap(res.data);
}

export async function resolveTicket(
  id: string,
  payload: { solution_type: string; solution_summary: string; reason?: string },
): Promise<ServiceRequestTicket> {
  const res = await resourceService.action<ServiceRequestTicket>(API, id, "resolve", payload);
  return unwrap(res.data);
}

export async function closeTicket(id: string, reason?: string): Promise<ServiceRequestTicket> {
  const res = await resourceService.action<ServiceRequestTicket>(API, id, "close", reason ? { reason } : {});
  return unwrap(res.data);
}

export async function resumeTicket(id: string, reason?: string): Promise<ServiceRequestTicket> {
  const res = await resourceService.action<ServiceRequestTicket>(API, id, "resume", reason ? { reason } : {});
  return unwrap(res.data);
}

export async function markAwaitingAssignment(id: string, reason?: string): Promise<ServiceRequestTicket> {
  const res = await resourceService.action<ServiceRequestTicket>(
    API,
    id,
    "awaiting-assignment",
    reason ? { reason } : {},
  );
  return unwrap(res.data);
}

export async function reopenTicket(id: string, reason?: string): Promise<ServiceRequestTicket> {
  const res = await resourceService.action<ServiceRequestTicket>(API, id, "reopen", reason ? { reason } : {});
  return unwrap(res.data);
}

export async function exportTicketsXlsx(): Promise<void> {
  const { getAccessToken } = await import("@/lib/auth");
  const { env } = await import("@/utils/env");
  const token = getAccessToken();
  const res = await fetch(`${env.apiUrl}${API}/export.xlsx`, {
    headers: {
      Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
  });
  if (!res.ok) throw new ApiClientError("Excel export failed", res.status);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `service-request-tickets-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportTicketTimelineXlsx(ticketId: string): Promise<void> {
  const { getAccessToken } = await import("@/lib/auth");
  const { env } = await import("@/utils/env");
  const token = getAccessToken();
  const res = await fetch(`${env.apiUrl}${API}/${ticketId}/timeline.xlsx`, {
    headers: {
      Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
  });
  if (!res.ok) throw new ApiClientError("Timeline Excel export failed", res.status);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ticket-timeline-${ticketId.slice(0, 8)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function listMyFieldEngineerTickets(): Promise<FieldEngineerTicketItem[]> {
  const res = await apiClient<FieldEngineerTicketItem[]>(`${API}/field-engineer/my-tickets`);
  return Array.isArray(res.data) ? res.data : [];
}

export type FieldEngineerUpsertPayload = {
  engineer_name?: string;
  engineer_email?: string;
  engineer_contact?: string;
  assigned_date?: string;
  work_brief?: string;
  show_issue?: boolean;
  show_customer?: boolean;
  show_site?: boolean;
  show_asset?: boolean;
  show_circuit?: boolean;
};

export async function addTicketFieldEngineer(
  ticketId: string,
  payload: {
    engineer_name: string;
    engineer_email: string;
    engineer_contact?: string;
    assigned_date?: string;
    work_brief?: string;
    show_issue?: boolean;
    show_customer?: boolean;
    show_site?: boolean;
    show_asset?: boolean;
    show_circuit?: boolean;
  },
): Promise<TicketFieldEngineer> {
  const res = await resourceService.action<TicketFieldEngineer>(API, ticketId, "field-engineers", payload);
  return unwrap(res.data);
}

export async function updateTicketFieldEngineer(
  ticketId: string,
  fieldEngineerId: string,
  payload: FieldEngineerUpsertPayload,
): Promise<TicketFieldEngineer> {
  const res = await apiClient<TicketFieldEngineer>(`${API}/${ticketId}/field-engineers/${fieldEngineerId}`, {
    method: "PATCH",
    body: payload,
  });
  return unwrap(res.data);
}

export async function issueTicketFieldEngineerCredentials(
  ticketId: string,
  fieldEngineerId: string,
): Promise<TicketFieldEngineer> {
  const res = await apiClient<TicketFieldEngineer>(
    `${API}/${ticketId}/field-engineers/${fieldEngineerId}/credentials`,
    { method: "POST", body: {} },
  );
  return unwrap(res.data);
}

export async function removeTicketFieldEngineer(ticketId: string, fieldEngineerId: string): Promise<void> {
  await apiClient(`${API}/${ticketId}/field-engineers/${fieldEngineerId}`, { method: "DELETE" });
}

export async function markFieldEngineerSolved(
  ticketId: string,
  fieldEngineerId: string,
  solution_summary: string,
  files: File[] = [],
): Promise<TicketFieldEngineer> {
  const attachments = await Promise.all(
    files.map(async (file) => ({
      file_name: file.name,
      content_type: file.type || "application/octet-stream",
      content_base64: await fileToBase64(file),
    })),
  );
  const res = await apiClient<TicketFieldEngineer>(
    `${API}/${ticketId}/field-engineers/${fieldEngineerId}/solve`,
    { method: "POST", body: { solution_summary, attachments } },
  );
  return unwrap(res.data);
}

export type TicketOption = {
  id: string;
  option_type: string;
  option_code: string;
  option_label: string;
  sort_order: number;
  status: string;
};

export async function listTicketOptions(option_type?: "mode" | "category"): Promise<LookupOption[]> {
  const res = await apiClient<TicketOption[]>("/service/ticket-options", {
    query: option_type ? { option_type, active_only: true } : { active_only: true },
  });
  const rows = Array.isArray(res.data) ? res.data : [];
  return rows.map((r) => ({ value: r.option_code, label: r.option_label }));
}

export async function getTicketStakeholderView(id: string): Promise<TicketStakeholderView> {
  const res = await apiClient<TicketStakeholderView>(`${API}/${id}/stakeholder-view`);
  return unwrap(res.data);
}

export async function addTicketCoOwner(id: string, employeeId: string): Promise<TicketCoOwner> {
  const res = await apiClient<TicketCoOwner>(`${API}/${id}/co-owners`, {
    method: "POST",
    body: { employee_id: employeeId },
  });
  return unwrap(res.data);
}

export async function removeTicketCoOwner(id: string, employeeId: string): Promise<void> {
  await apiClient(`${API}/${id}/co-owners/${employeeId}`, { method: "DELETE" });
}

export async function addTicketStakeholder(
  id: string,
  payload: { name: string; email: string },
): Promise<TicketStakeholder> {
  const res = await apiClient<TicketStakeholder>(`${API}/${id}/stakeholders`, {
    method: "POST",
    body: payload,
  });
  return unwrap(res.data);
}

export async function removeTicketStakeholder(id: string, stakeholderId: string): Promise<void> {
  await apiClient(`${API}/${id}/stakeholders/${stakeholderId}`, { method: "DELETE" });
}

export const SOLUTION_TYPES = [
  { value: "installation", label: "Installation" },
  { value: "corrective", label: "Corrective / Repair" },
  { value: "software", label: "Software" },
  { value: "hardware", label: "Hardware" },
  { value: "network", label: "Network" },
  { value: "inspection", label: "Inspection" },
  { value: "other", label: "Other" },
] as const;

export async function listTicketComments(id: string): Promise<TicketComment[]> {
  const res = await apiClient<TicketComment[]>(`${API}/${id}/comments`);
  return Array.isArray(res.data) ? res.data : [];
}

export async function addTicketComment(id: string, body: string, isInternal = true): Promise<TicketComment> {
  const res = await apiClient<TicketComment>(`${API}/${id}/comments`, {
    method: "POST",
    body: { body, is_internal: isInternal },
  });
  return unwrap(res.data);
}

export async function listTicketAttachments(id: string): Promise<TicketAttachment[]> {
  const res = await apiClient<TicketAttachment[]>(`${API}/${id}/attachments`);
  return Array.isArray(res.data) ? res.data : [];
}

export async function uploadTicketAttachment(
  id: string,
  file: File,
): Promise<TicketAttachment> {
  const base64 = await fileToBase64(file);
  const res = await apiClient<TicketAttachment>(`${API}/${id}/attachments`, {
    method: "POST",
    body: {
      file_name: file.name,
      content_type: file.type || "application/octet-stream",
      content_base64: base64,
    },
  });
  return unwrap(res.data);
}

export async function deleteTicketAttachment(ticketId: string, attachmentId: string): Promise<void> {
  await apiClient(`${API}/${ticketId}/attachments/${attachmentId}`, { method: "DELETE" });
}

export function attachmentDownloadUrl(ticketId: string, attachmentId: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api/v1";
  return `${base}${API}/${ticketId}/attachments/${attachmentId}/content`;
}

export async function getTicketTimeline(id: string): Promise<TimelineItem[]> {
  const res = await apiClient<TimelineItem[]>(`${API}/${id}/timeline`);
  return Array.isArray(res.data) ? res.data : [];
}

export function formatStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function exportTicketsCsv(tickets: ServiceRequestTicket[]): void {
  const headers = [
    "Ticket Number", "Subject", "Contact", "Priority", "Status", "Mode", "Created", "Due Date",
  ];
  const rows = tickets.map((t) => [
    t.document_number,
    t.subject,
    t.contact_name ?? "",
    t.priority,
    t.status,
    t.mode_of_action ?? "",
    t.created_at,
    t.due_at ?? "",
  ]);
  const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `service-request-tickets-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] ?? "";
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export { ApiClientError };

export type EmailAutomationStatus = {
  enabled: boolean;
  smtp_configured: boolean;
  imap_configured: boolean;
  graph_configured?: boolean;
  mailbox?: string | null;
  webhook_path: string;
  recent_ingests: number;
  subject_patterns?: string[];
  auto_ticket_enabled?: boolean;
};

export async function getEmailAutomationStatus(): Promise<EmailAutomationStatus> {
  const res = await apiClient<EmailAutomationStatus>("/service/email-inbound/status");
  return res.data as EmailAutomationStatus;
}

export async function pollSupportMailbox(): Promise<Record<string, unknown>> {
  const res = await apiClient<Record<string, unknown>>("/service/email-inbound/poll-mailbox", {
    method: "POST",
  });
  return (res.data as Record<string, unknown>) ?? {};
}

export type MailboxMessageItem = {
  graph_id: string;
  message_id: string;
  internet_message_id?: string | null;
  from_address: string;
  from_name?: string | null;
  subject: string;
  body_preview: string;
  received_at?: string | null;
  is_read: boolean;
  classification: "likely_ticket" | "not_ticket" | "review" | string;
  ingest_status?: string | null;
  ticket_id?: string | null;
  document_number?: string | null;
  ticket_status?: string | null;
  opened_at?: string | null;
  resolved_at?: string | null;
  closed_at?: string | null;
};

export type MailboxMessageDetail = MailboxMessageItem & {
  body_text?: string | null;
  body_html?: string | null;
};

export type MailboxMessagesResult = {
  mailbox: string;
  total: number;
  subject_patterns: string[];
  messages: MailboxMessageItem[];
};

export async function listMailboxMessages(top = 50): Promise<MailboxMessagesResult> {
  const res = await apiClient<MailboxMessagesResult>(
    `/service/email-inbound/mailbox-messages?top=${top}`,
  );
  return res.data as MailboxMessagesResult;
}

export async function getMailboxMessage(graphId: string): Promise<MailboxMessageDetail> {
  const res = await apiClient<MailboxMessageDetail>(
    `/service/email-inbound/mailbox-messages/${encodeURIComponent(graphId)}`,
  );
  return res.data as MailboxMessageDetail;
}

export type LookupOption = { value: string; label: string };

function asRows(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data.filter((r): r is Record<string, unknown> => !!r && typeof r === "object");
  }
  return [];
}

function toOptions(
  data: unknown,
  labelFn: (row: Record<string, unknown>) => string,
  valueKey = "id",
): LookupOption[] {
  return asRows(data).map((r) => ({
    value: String(r[valueKey]),
    label: labelFn(r),
  }));
}

export async function loadTicketFormLookups(): Promise<{
  categories: LookupOption[];
  customers: LookupOption[];
  branches: LookupOption[];
  employees: LookupOption[];
  products: LookupOption[];
  modes: LookupOption[];
  ticketCategories: LookupOption[];
  errors: string[];
}> {
  const PAGE = 200; // API max page_size per PaginationParams
  const requests = [
    { key: "categories", call: () => resourceService.list("/service/service-categories") },
    { key: "customers", call: () => resourceService.list("/customers", { page_size: PAGE }) },
    { key: "branches", call: () => resourceService.list("/branches", { page_size: PAGE }) },
    { key: "employees", call: () => resourceService.list("/employees", { page_size: PAGE }) },
    { key: "products", call: () => resourceService.list("/products", { page_size: PAGE }) },
    { key: "modes", call: () => listTicketOptions("mode") },
    { key: "ticketCategories", call: () => listTicketOptions("category") },
  ] as const;

  const settled = await Promise.allSettled(requests.map((r) => r.call()));
  const errors: string[] = [];
  const dataByKey: Record<string, unknown> = {};

  settled.forEach((result, i) => {
    const key = requests[i].key;
    if (result.status === "fulfilled") {
      dataByKey[key] = key === "modes" || key === "ticketCategories" ? result.value : result.value.data;
    } else {
      const msg =
        result.reason instanceof ApiClientError
          ? result.reason.message
          : `Failed to load ${key}`;
      errors.push(msg);
      dataByKey[key] = [];
    }
  });

  const modes = Array.isArray(dataByKey.modes) ? (dataByKey.modes as LookupOption[]) : [];
  const ticketCategories = Array.isArray(dataByKey.ticketCategories)
    ? (dataByKey.ticketCategories as LookupOption[])
    : [];

  return {
    categories: toOptions(dataByKey.categories, (r) => String(r.category_name ?? r.name ?? r.id)),
    customers: toOptions(dataByKey.customers, (r) => String(r.customer_name ?? r.name ?? r.id)),
    branches: toOptions(dataByKey.branches, (r) => String(r.branch_name ?? r.name ?? r.id)),
    employees: toOptions(dataByKey.employees, (r) => {
      const name = [r.first_name, r.last_name].filter(Boolean).join(" ").trim();
      return name || String(r.employee_code ?? r.id);
    }),
    products: toOptions(dataByKey.products, (r) => String(r.product_name ?? r.name ?? r.sku ?? r.id)),
    modes: modes.length
      ? modes
      : [
          { value: "remote_support", label: "Remote Support" },
          { value: "onsite_support", label: "Onsite Support" },
          { value: "oem_support", label: "OEM Support" },
        ],
    ticketCategories: ticketCategories.length
      ? ticketCategories
      : [
          { value: "hardware", label: "Hardware" },
          { value: "software", label: "Software" },
          { value: "network", label: "Network" },
        ],
    errors,
  };
}
