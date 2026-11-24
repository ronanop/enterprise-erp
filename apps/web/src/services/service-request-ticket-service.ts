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
  asset_confirmed_by?: string | null;
  asset_confirmed_by_name?: string | null;
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
  /** Human-readable status from API (preferred over raw status when present). */
  status_label?: string | null;
  issue_reported_code?: string | null;
  resolution_comment_code?: string | null;
  other_remarks?: string | null;
  /** Present Type (extracted from email, editable). */
  present_type?: string | null;
  /** Flags for extracted fields manually edited by a user, e.g. { ckt_id: true }. */
  field_manual_overrides?: Record<string, boolean> | null;
  sla_target_minutes?: number | null;
  sla_elapsed_minutes?: number | null;
  sla_remaining_minutes?: number | null;
  sla_breached?: boolean | null;
  sla_paused_at?: string | null;
  sla_paused_total_minutes?: number | null;
  sla_is_paused?: boolean | null;
  sla_pauses?: TicketSlaPauseItem[];
  sla_policy_snapshot?: Record<string, unknown> | null;
  reopen_request?: TicketReopenRequest | null;
  pending_reopen_request?: TicketReopenRequest | null;
};

export type TicketSlaPauseItem = {
  id: string;
  request_id: string;
  paused_at: string;
  resumed_at?: string | null;
  reason: string;
  resume_reason?: string | null;
  paused_by?: string | null;
  resumed_by?: string | null;
  duration_minutes?: number | null;
  is_active?: boolean;
};

export type TicketReopenRequest = {
  id: string;
  request_id?: string;
  status: "pending" | "approved" | "rejected" | string;
  reason?: string | null;
  requested_by?: string | null;
  requested_by_name?: string | null;
  requested_at?: string | null;
  decided_by?: string | null;
  decided_at?: string | null;
  decision_reason?: string | null;
};

export type CircuitHistoryItem = {
  id: string;
  document_number: string;
  created_at: string | null;
  issue_reported?: string | null;
  issue_reported_code?: string | null;
  resolution_comment?: string | null;
  resolution_comment_code?: string | null;
  status: string;
  status_label?: string | null;
  subject?: string | null;
};

export type CircuitHistory = {
  count: number;
  last_ticket_at: string | null;
  items: CircuitHistoryItem[];
  ckt_id?: string | null;
};

export type AssignmentHistoryItem = {
  id: string;
  request_id?: string;
  change_type?: string;
  old_owner_employee_id?: string | null;
  new_owner_employee_id?: string | null;
  old_owner_name?: string | null;
  new_owner_name?: string | null;
  reason?: string | null;
  changed_by?: string | null;
  changed_at: string;
  /** Legacy aliases (older API builds). */
  from_employee_name?: string | null;
  to_employee_name?: string | null;
  assigned_at?: string;
};

export type CustomerPrioritySla = {
  id: string;
  company_id?: string;
  customer_id: string;
  customer_name?: string | null;
  priority: string;
  duration_minutes: number;
  calendar_type?: string;
  effective_from?: string | null;
  effective_to?: string | null;
  escalation_json?: Record<string, unknown> | unknown[] | null;
  sla_id?: string | null;
  is_active: boolean;
  version?: number;
  created_at?: string;
};

export type CustomerPrioritySlaPayload = {
  customer_id: string;
  priority: string;
  duration_minutes: number;
  calendar_type?: string;
  effective_from?: string | null;
  effective_to?: string | null;
  sla_id?: string | null;
  is_active?: boolean;
};

export type DashboardCountItem = { key: string; label: string; count: number };

export type ServiceDashboardSummary = {
  total_tickets: number;
  open_tickets: number;
  unassigned_tickets: number;
  pending_reopen_requests: number;
  by_status: DashboardCountItem[];
  by_priority: DashboardCountItem[];
  by_customer: {
    customer_id: string;
    customer_name?: string | null;
    total: number;
    open: number;
  }[];
  engineer_workload: {
    owner_employee_id: string;
    owner_name?: string | null;
    open_tickets: number;
    breached_tickets: number;
  }[];
  repeated_circuits: {
    ckt_id: string;
    customer_id?: string | null;
    customer_name?: string | null;
    ticket_count: number;
    last_ticket_at?: string | null;
  }[];
  trend: { period_start: string; created: number; resolved: number; closed: number }[];
  trend_granularity?: string;
  sla: SlaComplianceSummary;
  date_from?: string | null;
  date_to?: string | null;
};

export type PendingReopenQueueItem = TicketReopenRequest & {
  request_id: string;
  document_number?: string | null;
  subject?: string | null;
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
  can_resume?: boolean;
  can_pause_sla?: boolean;
  can_resume_sla?: boolean;
  is_on_duty?: boolean;
  roster_visibility_enabled?: boolean;
  can_close?: boolean;
  can_request_reopen?: boolean;
  can_approve_reopen?: boolean;
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
  hardware_repair?: boolean | string | null;
  hardware_replacement?: boolean | null;
  hardware_replacement_yn?: string | null;
  new_device_serial?: string | null;
  other_charges?: number | null;
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
  from_status?: string | null;
  to_status?: string | null;
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
  is_paused?: boolean;
  created_at?: string | null;
};

export type SlaComplianceSummary = {
  active_breached: number;
  active_paused?: number;
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
  status_label?: string | null;
  reopen_request_status?: string | null;
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

export async function listSlaTracker(opts?: { mine?: boolean }): Promise<SlaTrackerItem[]> {
  const res = await apiClient<SlaTrackerItem[]>(`${API}/sla-tracker`, {
    query: { mine: opts?.mine ? true : undefined },
  });
  const rows = Array.isArray(res.data) ? res.data : [];
  // Newest first (API already orders this way; keep a stable client sort).
  return [...rows].sort((a, b) => {
    const aTs = Date.parse(a.created_at || a.sla_started_at || "") || 0;
    const bTs = Date.parse(b.created_at || b.sla_started_at || "") || 0;
    if (bTs !== aTs) return bTs - aTs;
    return (b.document_number || "").localeCompare(a.document_number || "", undefined, { numeric: true });
  });
}

export async function getSlaComplianceSummary(opts?: { mine?: boolean }): Promise<SlaComplianceSummary> {
  const res = await apiClient<SlaComplianceSummary>(`${API}/sla-compliance-summary`, {
    query: { mine: opts?.mine ? true : undefined },
  });
  const summary = (res.data ?? {
    active_breached: 0,
    active_paused: 0,
    closed_within_sla: 0,
    closed_after_breach: 0,
  }) as SlaComplianceSummary;

  if (typeof summary.active_breached === "number") {
    if (typeof summary.active_paused === "number") return summary;
    const tracker = await listSlaTracker({ mine: opts?.mine });
    return {
      ...summary,
      active_paused: tracker.filter((row) => row.is_paused).length,
    };
  }

  // Older API builds only return closed-ticket counts — derive active counts from SLA tracker.
  const tracker = await listSlaTracker({ mine: opts?.mine });
  return {
    ...summary,
    active_breached: tracker.filter((row) => row.is_breached).length,
    active_paused: tracker.filter((row) => row.is_paused).length,
  };
}

export async function listResolvedTickets(query?: {
  q?: string;
  sla_outcome?: "within" | "breach";
  mine?: boolean;
}): Promise<ResolvedTicketItem[]> {
  const res = await apiClient<ResolvedTicketItem[]>(`${API}/resolved-tickets`, { query });
  const rows = Array.isArray(res.data) ? res.data : [];
  // Newest first by ticket number / resolve-close timestamps.
  return [...rows].sort((a, b) => {
    const docCmp = (b.document_number || "").localeCompare(a.document_number || "", undefined, { numeric: true });
    if (docCmp !== 0) return docCmp;
    const aTs = Date.parse(a.resolved_at || a.closed_at || "") || 0;
    const bTs = Date.parse(b.resolved_at || b.closed_at || "") || 0;
    return bTs - aTs;
  });
}

export async function listServiceHeadNotifications(page_size = 15): Promise<ServiceNotification[]> {
  const res = await apiClient<ServiceNotification[]>("/service/service-notifications", {
    query: { page_size, mine: true },
  });
  const rows = Array.isArray(res.data) ? res.data : [];
  return rows.filter((n) =>
    [
      "ticket_opened",
      "ticket_resolved",
      "ticket_assigned",
      "roster_open_reminder",
      "email_ticket_created",
    ].includes(n.notification_type),
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

export type ResolveTicketPayload = {
  solution_type?: string;
  solution_summary?: string;
  reason?: string;
  mode_of_action?: string;
  ticket_category?: string;
  issue_reported_code?: string;
  resolution_comment_code?: string;
  other_remarks?: string | null;
};

export async function resolveTicket(id: string, payload: ResolveTicketPayload): Promise<ServiceRequestTicket> {
  const res = await resourceService.action<ServiceRequestTicket>(API, id, "resolve", payload);
  return unwrap(res.data);
}

/** Close a resolved ticket (validated by the API). */
export async function closeTicket(id: string, payload?: { reason?: string }): Promise<ServiceRequestTicket> {
  const res = await resourceService.action<ServiceRequestTicket>(API, id, "close", payload ?? {});
  return unwrap(res.data);
}

/** Confirm asset details (POST .../confirm-asset). */
export async function confirmAssetDetails(id: string): Promise<ServiceRequestTicket> {
  const res = await resourceService.action<ServiceRequestTicket>(API, id, "confirm-asset", {});
  return unwrap(res.data);
}

export async function getCircuitHistory(id: string): Promise<CircuitHistory> {
  const res = await apiClient<CircuitHistory | CircuitHistoryItem[]>(`${API}/${id}/circuit-history`);
  const data = res.data;
  if (Array.isArray(data)) {
    return { count: data.length, last_ticket_at: data[0]?.created_at ?? null, items: data, ckt_id: null };
  }
  const items = Array.isArray(data?.items) ? data.items : [];
  return {
    count: typeof data?.count === "number" ? data.count : items.length,
    last_ticket_at: data?.last_ticket_at ?? null,
    items,
    ckt_id: data?.ckt_id ?? null,
  };
}

export async function getAssignmentHistory(id: string): Promise<AssignmentHistoryItem[]> {
  const res = await apiClient<AssignmentHistoryItem[]>(`${API}/${id}/assignment-history`);
  return Array.isArray(res.data) ? res.data : [];
}

export async function requestReopen(id: string, reason: string): Promise<TicketReopenRequest> {
  const res = await resourceService.action<TicketReopenRequest>(API, id, "reopen-request", { reason });
  return unwrap(res.data);
}

export async function approveReopenRequest(requestId: string): Promise<ServiceRequestTicket> {
  const res = await apiClient<ServiceRequestTicket>(`${API}/reopen-requests/${requestId}/approve`, {
    method: "POST",
    body: {},
  });
  return unwrap(res.data);
}

export async function rejectReopenRequest(requestId: string, reason?: string): Promise<ServiceRequestTicket> {
  const res = await apiClient<ServiceRequestTicket>(`${API}/reopen-requests/${requestId}/reject`, {
    method: "POST",
    body: reason ? { rejection_reason: reason } : {},
  });
  return unwrap(res.data);
}

export async function listPendingReopenRequests(): Promise<PendingReopenQueueItem[]> {
  const res = await apiClient<PendingReopenQueueItem[]>(`${API}/reopen-requests/pending`);
  return Array.isArray(res.data) ? res.data : [];
}

export async function getServiceDashboardSummary(opts?: { mine?: boolean }): Promise<ServiceDashboardSummary> {
  const res = await apiClient<ServiceDashboardSummary>(`${API}/dashboard-summary`, {
    query: { mine: opts?.mine ? true : undefined },
  });
  const data = (res.data ?? {}) as Partial<ServiceDashboardSummary>;
  return {
    total_tickets: data.total_tickets ?? 0,
    open_tickets: data.open_tickets ?? 0,
    unassigned_tickets: data.unassigned_tickets ?? 0,
    pending_reopen_requests: data.pending_reopen_requests ?? 0,
    by_status: data.by_status ?? [],
    by_priority: data.by_priority ?? [],
    by_customer: data.by_customer ?? [],
    engineer_workload: data.engineer_workload ?? [],
    repeated_circuits: data.repeated_circuits ?? [],
    trend: data.trend ?? [],
    trend_granularity: data.trend_granularity,
    sla: data.sla ?? { active_breached: 0, active_paused: 0, closed_within_sla: 0, closed_after_breach: 0 },
    date_from: data.date_from,
    date_to: data.date_to,
  };
}

const CUSTOMER_PRIORITY_SLA_API = "/service/customer-priority-slas";

export async function listCustomerPrioritySlas(): Promise<CustomerPrioritySla[]> {
  const res = await resourceService.list<CustomerPrioritySla>(CUSTOMER_PRIORITY_SLA_API, { page_size: 200 });
  return Array.isArray(res.data) ? res.data : [];
}

export async function createCustomerPrioritySla(payload: CustomerPrioritySlaPayload): Promise<CustomerPrioritySla> {
  const res = await resourceService.create<CustomerPrioritySla>(CUSTOMER_PRIORITY_SLA_API, payload);
  return unwrap(res.data);
}

export async function updateCustomerPrioritySla(
  id: string,
  payload: Partial<CustomerPrioritySlaPayload> & { version?: number },
): Promise<CustomerPrioritySla> {
  const res = await resourceService.update<CustomerPrioritySla>(CUSTOMER_PRIORITY_SLA_API, id, payload);
  return unwrap(res.data);
}

export async function deleteCustomerPrioritySla(id: string): Promise<void> {
  await resourceService.delete(CUSTOMER_PRIORITY_SLA_API, id);
}

/** Display label for ticket status: prefer API status_label. */
export function ticketStatusLabel(ticket: { status: string; status_label?: string | null }): string {
  return ticket.status_label?.trim() || formatStatus(ticket.status);
}

export function formatInr(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);
}

export async function resumeTicket(id: string, reason?: string): Promise<ServiceRequestTicket> {
  const res = await resourceService.action<ServiceRequestTicket>(API, id, "resume", reason ? { reason } : {});
  return unwrap(res.data);
}

/** Pause the SLA clock on a ticket. Reason is mandatory. */
export async function pauseTicketSla(id: string, reason: string): Promise<ServiceRequestTicket> {
  const res = await resourceService.action<ServiceRequestTicket>(API, id, "sla/pause", { reason });
  return unwrap(res.data);
}

/** Resume a paused SLA clock. */
export async function resumeTicketSla(id: string, reason?: string): Promise<ServiceRequestTicket> {
  const res = await resourceService.action<ServiceRequestTicket>(
    API,
    id,
    "sla/resume",
    reason ? { reason } : {},
  );
  return unwrap(res.data);
}

export async function listTicketSlaPauses(id: string): Promise<TicketSlaPauseItem[]> {
  const res = await apiClient<TicketSlaPauseItem[]>(`${API}/${id}/sla-pauses`);
  return Array.isArray(res.data) ? res.data : [];
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
    engineer_email?: string;
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

export type TicketOptionType = "mode" | "category" | "issue_reported" | "resolution_comment";

/** Ticket categories allowed in the UI (Hardware / Software / Network only). */
export const ALLOWED_TICKET_CATEGORIES = ["hardware", "software", "network"] as const;

export async function listTicketOptions(option_type?: TicketOptionType): Promise<LookupOption[]> {
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

/** Open attachment content with Bearer auth (plain href has no token → 401 JSON). */
export async function openTicketAttachment(ticketId: string, attachmentId: string): Promise<void> {
  const { getAccessToken } = await import("@/lib/auth");
  const { env } = await import("@/utils/env");
  const token = getAccessToken();
  if (!token) {
    throw new ApiClientError("Missing authentication token", 401);
  }
  const res = await fetch(`${env.apiUrl}${API}/${ticketId}/attachments/${attachmentId}/content`, {
    headers: {
      Accept: "*/*",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new ApiClientError(`Failed to open attachment (${res.status})`, res.status);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
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
  mailapi_configured?: boolean;
  mailbox?: string | null;
  webhook_path: string;
  recent_ingests: number;
  subject_patterns?: string[];
  auto_ticket_enabled?: boolean;
  accept_all?: boolean;
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
  offline_warning?: string | null;
  poll_summary?: string | null;
};

export async function listMailboxMessages(
  top = 50,
  opts?: { poll?: boolean },
): Promise<MailboxMessagesResult> {
  const poll = opts?.poll ? "&poll=true" : "";
  const res = await apiClient<MailboxMessagesResult>(
    `/service/email-inbound/mailbox-messages?top=${top}${poll}`,
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
  issueReportedOptions: LookupOption[];
  resolutionCommentOptions: LookupOption[];
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
    { key: "issueReported", call: () => listTicketOptions("issue_reported") },
    { key: "resolutionComment", call: () => listTicketOptions("resolution_comment") },
  ] as const;

  const settled = await Promise.allSettled(requests.map((r) => r.call()));
  const errors: string[] = [];
  const dataByKey: Record<string, unknown> = {};

  settled.forEach((result, i) => {
    const key = requests[i].key;
    if (result.status === "fulfilled") {
      dataByKey[key] = ["modes", "ticketCategories", "issueReported", "resolutionComment"].includes(key)
        ? result.value
        : (result.value as { data?: unknown }).data;
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
  const allowedCategories = new Set<string>(ALLOWED_TICKET_CATEGORIES);
  const ticketCategories = (
    Array.isArray(dataByKey.ticketCategories) ? (dataByKey.ticketCategories as LookupOption[]) : []
  ).filter((c) => allowedCategories.has(String(c.value).toLowerCase()));
  const issueReportedOptions = Array.isArray(dataByKey.issueReported)
    ? (dataByKey.issueReported as LookupOption[])
    : [];
  const resolutionCommentOptions = Array.isArray(dataByKey.resolutionComment)
    ? (dataByKey.resolutionComment as LookupOption[])
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
    issueReportedOptions,
    resolutionCommentOptions,
    errors,
  };
}
