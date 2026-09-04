/**
 * Typed client for the Project Management module (`/api/v1/projects/*`).
 *
 * Mirrors `sales-crm-service.ts`: one section per entity with an API path
 * constant, a row type, a form-input type, and list/get/create/update calls.
 */

import { ApiClientError, apiClient, resourceService } from "@/services/api-client";
import { getAccessToken } from "@/lib/auth";
import { env } from "@/utils/env";

function asArray<T>(data: T[] | T | null | undefined): T[] {
  if (Array.isArray(data)) return data;
  if (data == null) return [];
  return [data];
}

function unwrap<T>(res: { data: T | null }): T {
  if (res.data == null) {
    throw new ApiClientError("Empty response from server", 500);
  }
  return res.data;
}

// ---------------------------------------------------------------------------
// Customer trackers
// ---------------------------------------------------------------------------

export const CUSTOMER_TRACKERS_API = "/projects/trackers";

export type CustomerTracker = {
  id: string;
  project_id: string;
  version_no: number;
  file_name: string;
  content_type: string | null;
  file_size: number;
  content_hash: string;
  remarks: string | null;
  company_id: string;
  branch_id: string | null;
  created_at: string | null;
  created_by: string | null;
};

export async function listCustomerTrackers(): Promise<CustomerTracker[]> {
  return asArray((await apiClient<CustomerTracker[]>(CUSTOMER_TRACKERS_API)).data);
}

export async function createCustomerTracker(body: {
  project_id: string;
  file_name: string;
  content_base64: string;
  content_type?: string;
  remarks?: string;
}): Promise<CustomerTracker> {
  return unwrap(await apiClient<CustomerTracker>(CUSTOMER_TRACKERS_API, { method: "POST", body }));
}

export async function downloadCustomerTracker(tracker: CustomerTracker): Promise<void> {
  const response = await fetch(`${env.apiUrl}${CUSTOMER_TRACKERS_API}/${tracker.id}/file`, {
    headers: { Authorization: `Bearer ${getAccessToken()}` },
  });
  if (!response.ok) throw new ApiClientError("Unable to download tracker", response.status);
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = tracker.file_name;
  link.click();
  URL.revokeObjectURL(url);
}

export function formatInr(value: number | string | null | undefined): string {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

export function formatInrPrecise(value: number | string | null | undefined): string {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

/** `2026-07-27` from an ISO timestamp or date string. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function formatHours(value: number | string | null | undefined): string {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(2)} h`;
}

/** Turns `in_progress` into `In progress` for display. */
export function humanizeStatus(value: string | null | undefined): string {
  if (!value) return "—";
  const spaced = value.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

type AuditFields = {
  id: string;
  company_id: string;
  status: string;
  created_at?: string | null;
  version: number;
};

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export const PROJECTS_API = "/projects/projects";

export type Project = AuditFields & {
  branch_id: string;
  project_code: string;
  project_name: string;
  project_type: string;
  customer_id: string | null;
  /** Resolved master customer name (from API enrichment). */
  customer_name?: string | null;
  department_id: string | null;
  project_manager_employee_id: string;
  sponsor_employee_id: string | null;
  planned_start_date: string;
  planned_end_date: string;
  actual_start_date: string | null;
  actual_end_date: string | null;
  budget_amount: string | null;
  currency_code: string;
  billing_type: string | null;
  crm_opportunity_id: string | null;
  crm_customer_id: string | null;
  proc_order_id: string | null;
  health_status: string | null;
  description: string | null;
  workflow_status: string | null;
  /** Current in-progress site workflow stage key (from API enrichment). */
  current_stage?: string | null;
  /** Human label for current_stage. */
  current_stage_label?: string | null;
  /** Assignee name for the current in-progress stage. */
  current_stage_owner_name?: string | null;
};

export type ProjectFormInput = {
  branch_id?: string;
  project_name?: string;
  project_type?: string;
  customer_id?: string | null;
  department_id?: string | null;
  project_manager_employee_id?: string;
  sponsor_employee_id?: string | null;
  planned_start_date?: string;
  planned_end_date?: string;
  actual_start_date?: string | null;
  actual_end_date?: string | null;
  budget_amount?: string | null;
  currency_code?: string;
  billing_type?: string | null;
  health_status?: string | null;
  description?: string | null;
  status?: string;
  proc_order_id?: string | null;
  site_installation?: SiteInstallationNestedInput | null;
};

export type SiteInstallationNestedInput = {
  delivery_type?: string;
  requestor_name?: string | null;
  circle?: string | null;
  cloud_name?: string | null;
  site_name?: string | null;
  power_requirements?: string | null;
  rfai_request_done?: boolean;
  rfai_number?: string | null;
  fabric_partner?: string | null;
  application?: string | null;
  remarks?: string | null;
  server_qty?: number | null;
  rack_qty?: number | null;
};

export async function listProjects(): Promise<Project[]> {
  const res = await resourceService.list<Project>(PROJECTS_API, { page_size: 200 });
  return asArray(res.data);
}

export async function getProject(id: string): Promise<Project> {
  return unwrap(await resourceService.get<Project>(PROJECTS_API, id));
}

export async function createProject(body: ProjectFormInput): Promise<Project> {
  return unwrap(await resourceService.create<Project>(PROJECTS_API, body));
}

export async function updateProject(
  id: string,
  body: Partial<ProjectFormInput>,
): Promise<Project> {
  return unwrap(await resourceService.update<Project>(PROJECTS_API, id, body));
}

export async function submitProject(id: string): Promise<Project> {
  return unwrap(await resourceService.action<Project>(PROJECTS_API, id, "submit"));
}

export async function approveProject(id: string): Promise<Project> {
  return unwrap(await resourceService.action<Project>(PROJECTS_API, id, "approve"));
}

export async function completeProject(id: string): Promise<Project> {
  return unwrap(await resourceService.action<Project>(PROJECTS_API, id, "complete"));
}

export async function closeProject(id: string): Promise<Project> {
  return unwrap(await resourceService.action<Project>(PROJECTS_API, id, "close"));
}

// ---------------------------------------------------------------------------
// PO queue (SCM → Project pipeline)
// ---------------------------------------------------------------------------

export const PROJECT_PO_QUEUE_API = "/projects/purchase-orders";

export type ProjectPoQueueItem = {
  order_id: string;
  company_po_number: string | null;
  document_number: string;
  document_date: string;
  customer_name: string | null;
  customer_po_number: string | null;
  vendor_id: string;
  total_amount: number;
  customer_total: number;
  status: string;
  ovf_id: string | null;
  branch_id: string;
  company_id: string;
  created_at: string | null;
  shared_at?: string | null;
};

export type ProjectPoQueueHandoff = {
  order_id: string;
  challan_id: string | null;
  shared_at: string;
  project_name: string | null;
  circle_name: string | null;
  site_name: string | null;
  contact_person: string | null;
  contact_number: string | null;
  rack_quantity: string | null;
  server_quantity: string | null;
  server_type: string | null;
  remarks: string | null;
  customer_name: string | null;
  customer_po_number: string | null;
  company_po_number: string | null;
};

export type ProjectPoQueueShareInput = {
  order_id: string;
  challan_id?: string | null;
  project_name: string;
  circle_name: string;
  site_name: string;
  contact_person: string;
  contact_number: string;
  rack_quantity: string;
  server_quantity: string;
  server_type: string;
  remarks?: string | null;
};

export type ProjectPoPrefill = {
  order_id: string;
  branch_id: string;
  company_id: string;
  company_po_number: string | null;
  customer_po_number: string | null;
  customer_name: string | null;
  customer_id: string | null;
  budget_amount: string | null;
  currency_code: string;
  site_name: string | null;
  description: string | null;
  ovf_id: string | null;
  crm_opportunity_id: string | null;
  circle_name: string | null;
  entity_state: string | null;
  /** CRM lead / opportunity project title (for Projects intake). */
  project_title?: string | null;
};

export async function listProjectPoQueue(): Promise<ProjectPoQueueItem[]> {
  const res = await apiClient<ProjectPoQueueItem[]>(`${PROJECT_PO_QUEUE_API}/queue`);
  return asArray(res.data);
}

export async function shareProjectPoQueue(
  input: ProjectPoQueueShareInput,
): Promise<ProjectPoQueueHandoff> {
  return unwrap(
    await apiClient<ProjectPoQueueHandoff>(`${PROJECT_PO_QUEUE_API}/queue/share`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
}

export async function getProjectPoHandoff(orderId: string): Promise<ProjectPoQueueHandoff | null> {
  const res = await apiClient<ProjectPoQueueHandoff | null>(
    `${PROJECT_PO_QUEUE_API}/${orderId}/handoff`,
  );
  return res.data ?? null;
}

export async function getProjectPoPrefill(
  orderId: string,
  options?: { installationHandoff?: boolean },
): Promise<ProjectPoPrefill> {
  const qs = options?.installationHandoff ? "?installation_handoff=true" : "";
  return unwrap(
    await apiClient<ProjectPoPrefill>(`${PROJECT_PO_QUEUE_API}/${orderId}/prefill${qs}`),
  );
}

// ---------------------------------------------------------------------------
// Site Installation workflow
// ---------------------------------------------------------------------------

export const SITE_INSTALLATIONS_API = "/projects/site-installations";

export type MaterialLine = {
  type: string;
  quantity: number;
  date?: string | null;
};

export type SiteInstallation = AuditFields & {
  branch_id: string | null;
  project_id: string;
  document_number: string;
  delivery_type: string;
  workflow_stage: string;
  requestor_name: string | null;
  circle: string | null;
  cloud_name: string | null;
  site_name: string | null;
  power_requirements: string | null;
  rfai_request_done: boolean;
  rfai_number: string | null;
  fabric_partner: string | null;
  application: string | null;
  cable_length: string | null;
  industrial_socket: boolean;
  lugs: boolean;
  cable_lines: MaterialLine[];
  lug_lines: MaterialLine[];
  industrial_socket_lines: MaterialLine[];
  power_on_material: boolean;
  power_on_material_date: string | null;
  tile_details: string | null;
  survey_completed: boolean;
  survey_completed_date: string | null;
  space_available: boolean;
  space_available_date: string | null;
  power_available: boolean;
  power_available_date: string | null;
  server_qty: number | null;
  rack_qty: number | null;
  server_wh_delivery_date: string | null;
  server_on_site_delivery_date: string | null;
  rack_wh_delivery_date: string | null;
  rack_on_site_delivery_date: string | null;
  pdu_wh_delivery_date: string | null;
  pdu_on_site_delivery_date: string | null;
  mo_request: boolean;
  mo_request_date: string | null;
  im_material: boolean;
  im_material_date: string | null;
  material_handover_done: boolean;
  material_handover_date: string | null;
  rack_server_stacking_done: boolean;
  rack_server_stacking_date: string | null;
  rack_server_power_on_done: boolean;
  rack_server_power_on_date: string | null;
  dac_ilo_cabling_done: boolean;
  dac_ilo_cabling_date: string | null;
  bios_configuration_done: boolean;
  bios_configuration_date: string | null;
  firmware_config_done: boolean;
  firmware_config_date: string | null;
  lld_done: boolean;
  lld_date: string | null;
  os_installation_done: boolean;
  os_installation_date: string | null;
  vm_installation_done: boolean;
  vm_installation_date: string | null;
  nw_config_done: boolean;
  nw_config_date: string | null;
  tools_integration_done: boolean;
  tools_integration_date: string | null;
  mbss_done: boolean;
  mbss_date: string | null;
  vascan_done: boolean;
  vascan_date: string | null;
  handover_to_cloud_done: boolean;
  handover_to_cloud_date: string | null;
  hwat_request_done: boolean;
  hwat_request_date: string | null;
  hwat_signoff_received: boolean;
  hwat_signoff_date: string | null;
  survey_assignee_employee_id: string | null;
  scm_assignee_employee_id: string | null;
  onsite_assignee_employee_id: string | null;
  onsite_delivery_assignee_employee_id: string | null;
  material_handover_assignee_employee_id: string | null;
  installation_assignee_employee_id: string | null;
  configuration_assignee_employee_id: string | null;
  acceptance_assignee_employee_id: string | null;
  survey_assigned_date: string | null;
  survey_finished_date: string | null;
  scm_assigned_date: string | null;
  scm_finished_date: string | null;
  onsite_assigned_date: string | null;
  onsite_finished_date: string | null;
  onsite_delivery_assigned_date: string | null;
  onsite_delivery_finished_date: string | null;
  material_handover_assigned_date: string | null;
  material_handover_finished_date: string | null;
  installation_assigned_date: string | null;
  installation_finished_date: string | null;
  acceptance_assigned_date: string | null;
  acceptance_finished_date: string | null;
  survey_attachment_name: string | null;
  scm_attachment_name: string | null;
  onsite_attachment_name: string | null;
  onsite_delivery_attachment_name: string | null;
  material_handover_attachment_name: string | null;
  installation_attachment_name: string | null;
  acceptance_attachment_name: string | null;
  material_handover_to_name: string | null;
  survey_progress_status: string | null;
  survey_remarks: string | null;
  scm_progress_status: string | null;
  scm_remarks: string | null;
  onsite_progress_status: string | null;
  onsite_remarks: string | null;
  onsite_delivery_progress_status: string | null;
  onsite_delivery_remarks: string | null;
  material_handover_progress_status: string | null;
  material_handover_remarks: string | null;
  installation_progress_status: string | null;
  installation_remarks: string | null;
  acceptance_progress_status: string | null;
  acceptance_remarks: string | null;
  remarks: string | null;
};

export type SiteInstallationFormInput = {
  delivery_type?: string;
  requestor_name?: string | null;
  circle?: string | null;
  cloud_name?: string | null;
  site_name?: string | null;
  power_requirements?: string | null;
  rfai_request_done?: boolean;
  rfai_number?: string | null;
  fabric_partner?: string | null;
  application?: string | null;
  cable_length?: string | null;
  industrial_socket?: boolean;
  lugs?: boolean;
  cable_lines?: MaterialLine[] | null;
  lug_lines?: MaterialLine[] | null;
  industrial_socket_lines?: MaterialLine[] | null;
  power_on_material?: boolean;
  power_on_material_date?: string | null;
  tile_details?: string | null;
  survey_completed?: boolean;
  survey_completed_date?: string | null;
  space_available?: boolean;
  space_available_date?: string | null;
  power_available?: boolean;
  power_available_date?: string | null;
  server_qty?: number | null;
  rack_qty?: number | null;
  server_wh_delivery_date?: string | null;
  server_on_site_delivery_date?: string | null;
  rack_wh_delivery_date?: string | null;
  rack_on_site_delivery_date?: string | null;
  pdu_wh_delivery_date?: string | null;
  pdu_on_site_delivery_date?: string | null;
  mo_request?: boolean;
  mo_request_date?: string | null;
  im_material?: boolean;
  im_material_date?: string | null;
  material_handover_done?: boolean;
  material_handover_date?: string | null;
  rack_server_stacking_done?: boolean;
  rack_server_stacking_date?: string | null;
  rack_server_power_on_done?: boolean;
  rack_server_power_on_date?: string | null;
  dac_ilo_cabling_done?: boolean;
  dac_ilo_cabling_date?: string | null;
  bios_configuration_done?: boolean;
  bios_configuration_date?: string | null;
  firmware_config_done?: boolean;
  firmware_config_date?: string | null;
  lld_done?: boolean;
  lld_date?: string | null;
  os_installation_done?: boolean;
  os_installation_date?: string | null;
  vm_installation_done?: boolean;
  vm_installation_date?: string | null;
  nw_config_done?: boolean;
  nw_config_date?: string | null;
  tools_integration_done?: boolean;
  tools_integration_date?: string | null;
  mbss_done?: boolean;
  mbss_date?: string | null;
  vascan_done?: boolean;
  vascan_date?: string | null;
  handover_to_cloud_done?: boolean;
  handover_to_cloud_date?: string | null;
  hwat_request_done?: boolean;
  hwat_request_date?: string | null;
  hwat_signoff_received?: boolean;
  hwat_signoff_date?: string | null;
  survey_assignee_employee_id?: string | null;
  scm_assignee_employee_id?: string | null;
  onsite_assignee_employee_id?: string | null;
  onsite_delivery_assignee_employee_id?: string | null;
  material_handover_assignee_employee_id?: string | null;
  installation_assignee_employee_id?: string | null;
  configuration_assignee_employee_id?: string | null;
  acceptance_assignee_employee_id?: string | null;
  survey_attachment_name?: string | null;
  scm_attachment_name?: string | null;
  onsite_attachment_name?: string | null;
  onsite_delivery_attachment_name?: string | null;
  material_handover_attachment_name?: string | null;
  installation_attachment_name?: string | null;
  acceptance_attachment_name?: string | null;
  material_handover_to_name?: string | null;
  survey_progress_status?: string | null;
  survey_remarks?: string | null;
  scm_progress_status?: string | null;
  scm_remarks?: string | null;
  onsite_progress_status?: string | null;
  onsite_remarks?: string | null;
  onsite_delivery_progress_status?: string | null;
  onsite_delivery_remarks?: string | null;
  material_handover_progress_status?: string | null;
  material_handover_remarks?: string | null;
  installation_progress_status?: string | null;
  installation_remarks?: string | null;
  acceptance_progress_status?: string | null;
  acceptance_remarks?: string | null;
  remarks?: string | null;
};

export type SiteStageAssignment = {
  stage: string;
  label: string;
  assignee_employee_id: string | null;
  work_status: "pending" | "in_progress" | "done" | "skipped" | string;
  progress_status?: string | null;
  remarks?: string | null;
  assigned_date?: string | null;
  completed_date?: string | null;
};

export type SiteInstallationBlueprint = {
  entity: string;
  state: string;
  delivery_type: string;
  allowed_actions: string[];
  action_labels: Record<string, string>;
  stages: Array<{ key: string; label: string }>;
  stage_assignments?: SiteStageAssignment[];
  terminal: boolean;
};

export async function getSiteInstallationByProject(
  projectId: string,
): Promise<SiteInstallation> {
  return unwrap(
    await apiClient<SiteInstallation>(
      `${SITE_INSTALLATIONS_API}/by-project/${projectId}`,
    ),
  );
}

export async function getSiteInstallationBlueprint(
  projectId: string,
): Promise<SiteInstallationBlueprint> {
  return unwrap(
    await apiClient<SiteInstallationBlueprint>(
      `${SITE_INSTALLATIONS_API}/by-project/${projectId}/blueprint`,
    ),
  );
}

export async function updateSiteInstallationByProject(
  projectId: string,
  body: SiteInstallationFormInput,
): Promise<SiteInstallation> {
  return unwrap(
    await apiClient<SiteInstallation>(
      `${SITE_INSTALLATIONS_API}/by-project/${projectId}`,
      { method: "PATCH", body },
    ),
  );
}

export async function advanceSiteInstallation(
  projectId: string,
  action: string,
): Promise<SiteInstallation> {
  return unwrap(
    await apiClient<SiteInstallation>(
      `${SITE_INSTALLATIONS_API}/by-project/${projectId}/advance`,
      { method: "POST", body: { action } },
    ),
  );
}

export async function notifySiteStageNoAnswers(
  projectId: string,
  body: { stage: string; items: Array<{ field: string; label: string }> },
): Promise<void> {
  await apiClient(
    `${SITE_INSTALLATIONS_API}/by-project/${projectId}/notify-no-answers`,
    { method: "POST", body },
  );
}

export type ProjectStageSaveAlert = {
  id: string;
  project_id: string;
  project_name: string;
  stage: string;
  stage_label: string;
  progress_status: string | null;
  progress_status_label: string;
  message: string;
  remarks: string | null;
  yes_answers: string[];
  no_answers: string[];
  site_name: string | null;
  document_number: string | null;
  form_path: string;
  actor_name: string;
  saved_at: string | null;
  delivery_status: string | null;
  unread: boolean;
  created_at: string | null;
  sent_at: string | null;
};

export async function listProjectStageSaveAlerts(
  limit = 50,
): Promise<ProjectStageSaveAlert[]> {
  return asArray(
    unwrap(
      await apiClient<ProjectStageSaveAlert[]>(
        `/projects/stage-alerts?limit=${limit}`,
      ),
    ),
  );
}

export async function markProjectStageSaveAlertRead(
  notificationId: string,
): Promise<ProjectStageSaveAlert> {
  return unwrap(
    await apiClient<ProjectStageSaveAlert>(
      `/projects/stage-alerts/${notificationId}/read`,
      { method: "POST" },
    ),
  );
}

export type SiteStageFollowUpResult = {
  stage: string;
  stage_label: string;
  recipient_employee_id: string;
  notification_id: string;
  message: string;
};

export type SiteStageFollowUpReply = {
  id: string;
  body: string;
  created_at: string;
  employee_id: string;
};

export type SiteStageFollowUp = {
  id: string;
  project_id?: string;
  project_name?: string;
  stage: string;
  stage_label: string;
  recipient_employee_id: string | null;
  message: string;
  note: string | null;
  site_name: string | null;
  document_number: string | null;
  delivery_status: string;
  status: string;
  created_at: string | null;
  sent_at: string | null;
  replies?: SiteStageFollowUpReply[];
  has_reply?: boolean;
  latest_reply?: string | null;
  latest_reply_at?: string | null;
};

export type ProjectPortfolioFollowUp = SiteStageFollowUp & {
  project_id: string;
  project_name: string;
};

export async function listPortfolioFollowUps(): Promise<ProjectPortfolioFollowUp[]> {
  return asArray(
    unwrap(await apiClient<ProjectPortfolioFollowUp[]>("/projects/follow-ups")),
  );
}

export async function replyToPortfolioFollowUp(
  notificationId: string,
  body: string,
): Promise<ProjectPortfolioFollowUp> {
  return unwrap(
    await apiClient<ProjectPortfolioFollowUp>(`/projects/follow-ups/${notificationId}/reply`, {
      method: "POST",
      body: { body },
    }),
  );
}

export async function followUpSiteStage(
  projectId: string,
  stage: string,
  note?: string | null,
): Promise<SiteStageFollowUpResult> {
  return unwrap(
    await apiClient<SiteStageFollowUpResult>(
      `${SITE_INSTALLATIONS_API}/by-project/${projectId}/follow-up`,
      { method: "POST", body: { stage, note: note || null } },
    ),
  );
}

export async function listSiteStageFollowUps(
  projectId: string,
): Promise<SiteStageFollowUp[]> {
  return asArray(
    unwrap(
      await apiClient<SiteStageFollowUp[]>(
        `${SITE_INSTALLATIONS_API}/by-project/${projectId}/follow-ups`,
      ),
    ),
  );
}

export type ProjectMyJob = {
  site_installation_id: string;
  project_id: string;
  project_name: string;
  document_number: string;
  site_name: string | null;
  assigned_stage: string;
  workflow_stage: string;
  stage_label: string;
  delivery_type: string;
  form_path: string;
  work_status: string;
  can_open_form?: boolean;
  created_at?: string | null;
};

export async function listProjectMyJobs(): Promise<ProjectMyJob[]> {
  const res = await resourceService.list<ProjectMyJob>("/projects/my-jobs");
  return asArray(res.data);
}

export async function listProjectCompletedJobs(): Promise<ProjectMyJob[]> {
  const res = await resourceService.list<ProjectMyJob>("/projects/my-jobs/completed");
  return asArray(res.data);
}

export async function listSiteInstallations(): Promise<SiteInstallation[]> {
  const res = await resourceService.list<SiteInstallation>(SITE_INSTALLATIONS_API, {
    page_size: 200,
  });
  return asArray(res.data);
}

// ---------------------------------------------------------------------------
// Project phases
// ---------------------------------------------------------------------------

export const PROJECT_PHASES_API = "/projects/project-phases";

export type ProjectPhase = AuditFields & {
  branch_id: string | null;
  project_id: string;
  phase_code: string;
  phase_name: string;
  sequence_no: number;
  planned_start_date: string;
  planned_end_date: string;
};

export type ProjectPhaseFormInput = {
  project_id: string;
  phase_name: string;
  sequence_no?: number;
  planned_start_date: string;
  planned_end_date: string;
  status?: string;
};

export async function listProjectPhases(): Promise<ProjectPhase[]> {
  const res = await resourceService.list<ProjectPhase>(PROJECT_PHASES_API, { page_size: 200 });
  return asArray(res.data);
}

export async function getProjectPhase(id: string): Promise<ProjectPhase> {
  return unwrap(await resourceService.get<ProjectPhase>(PROJECT_PHASES_API, id));
}

export async function createProjectPhase(body: ProjectPhaseFormInput): Promise<ProjectPhase> {
  return unwrap(await resourceService.create<ProjectPhase>(PROJECT_PHASES_API, body));
}

export async function updateProjectPhase(
  id: string,
  body: Partial<ProjectPhaseFormInput>,
): Promise<ProjectPhase> {
  return unwrap(await resourceService.update<ProjectPhase>(PROJECT_PHASES_API, id, body));
}

// ---------------------------------------------------------------------------
// Project milestones
// ---------------------------------------------------------------------------

export const PROJECT_MILESTONES_API = "/projects/project-milestones";

export type ProjectMilestone = AuditFields & {
  branch_id: string | null;
  project_id: string;
  phase_id: string | null;
  milestone_code: string;
  milestone_name: string;
  owner_employee_id: string | null;
  due_date: string;
  achieved_at: string | null;
};

export type ProjectMilestoneFormInput = {
  project_id: string;
  phase_id?: string | null;
  milestone_name: string;
  owner_employee_id?: string | null;
  due_date: string;
  status?: string;
};

export async function listProjectMilestones(): Promise<ProjectMilestone[]> {
  const res = await resourceService.list<ProjectMilestone>(PROJECT_MILESTONES_API, {
    page_size: 200,
  });
  return asArray(res.data);
}

export async function getProjectMilestone(id: string): Promise<ProjectMilestone> {
  return unwrap(await resourceService.get<ProjectMilestone>(PROJECT_MILESTONES_API, id));
}

export async function createProjectMilestone(
  body: ProjectMilestoneFormInput,
): Promise<ProjectMilestone> {
  return unwrap(await resourceService.create<ProjectMilestone>(PROJECT_MILESTONES_API, body));
}

export async function updateProjectMilestone(
  id: string,
  body: Partial<ProjectMilestoneFormInput>,
): Promise<ProjectMilestone> {
  return unwrap(await resourceService.update<ProjectMilestone>(PROJECT_MILESTONES_API, id, body));
}

// ---------------------------------------------------------------------------
// Project tasks
// ---------------------------------------------------------------------------

export const PROJECT_TASKS_API = "/projects/project-tasks";

export type ProjectTask = AuditFields & {
  branch_id: string;
  document_number: string | null;
  project_id: string;
  phase_id: string | null;
  milestone_id: string | null;
  parent_task_id: string | null;
  task_name: string;
  priority: string;
  planned_start_date: string | null;
  due_date: string | null;
  estimated_hours: string | null;
  actual_hours: string | null;
  percent_complete: string | null;
  workflow_status: string | null;
};

export type ProjectTaskFormInput = {
  branch_id?: string;
  project_id: string;
  phase_id?: string | null;
  milestone_id?: string | null;
  parent_task_id?: string | null;
  task_name: string;
  priority?: string;
  planned_start_date?: string | null;
  due_date?: string | null;
  estimated_hours?: string | null;
  actual_hours?: string | null;
  percent_complete?: string | null;
  status?: string;
};

export async function listProjectTasks(): Promise<ProjectTask[]> {
  const res = await resourceService.list<ProjectTask>(PROJECT_TASKS_API, { page_size: 200 });
  return asArray(res.data);
}

export async function getProjectTask(id: string): Promise<ProjectTask> {
  return unwrap(await resourceService.get<ProjectTask>(PROJECT_TASKS_API, id));
}

export async function createProjectTask(body: ProjectTaskFormInput): Promise<ProjectTask> {
  return unwrap(await resourceService.create<ProjectTask>(PROJECT_TASKS_API, body));
}

export async function updateProjectTask(
  id: string,
  body: Partial<ProjectTaskFormInput>,
): Promise<ProjectTask> {
  return unwrap(await resourceService.update<ProjectTask>(PROJECT_TASKS_API, id, body));
}

// ---------------------------------------------------------------------------
// Timesheets
// ---------------------------------------------------------------------------

export const TIMESHEETS_API = "/projects/timesheets";

export type Timesheet = AuditFields & {
  branch_id: string;
  document_number: string;
  employee_id: string;
  project_id: string | null;
  period_start: string;
  period_end: string;
  total_hours: string | null;
  workflow_status: string | null;
};

export type TimesheetFormInput = {
  branch_id?: string;
  employee_id: string;
  project_id?: string | null;
  period_start: string;
  period_end: string;
  total_hours?: string | null;
  status?: string;
};

export async function listTimesheets(): Promise<Timesheet[]> {
  const res = await resourceService.list<Timesheet>(TIMESHEETS_API, { page_size: 200 });
  return asArray(res.data);
}

export async function getTimesheet(id: string): Promise<Timesheet> {
  return unwrap(await resourceService.get<Timesheet>(TIMESHEETS_API, id));
}

export async function createTimesheet(body: TimesheetFormInput): Promise<Timesheet> {
  return unwrap(await resourceService.create<Timesheet>(TIMESHEETS_API, body));
}

export async function updateTimesheet(
  id: string,
  body: Partial<TimesheetFormInput>,
): Promise<Timesheet> {
  return unwrap(await resourceService.update<Timesheet>(TIMESHEETS_API, id, body));
}

export async function submitTimesheet(id: string): Promise<Timesheet> {
  return unwrap(await resourceService.action<Timesheet>(TIMESHEETS_API, id, "submit"));
}

export async function approveTimesheet(id: string): Promise<Timesheet> {
  return unwrap(await resourceService.action<Timesheet>(TIMESHEETS_API, id, "approve"));
}

// ---------------------------------------------------------------------------
// Timesheet entries
// ---------------------------------------------------------------------------

export const TIMESHEET_ENTRIES_API = "/projects/timesheet-entries";

export type TimesheetEntry = AuditFields & {
  branch_id: string;
  timesheet_id: string;
  project_id: string;
  task_id: string;
  employee_id: string;
  work_date: string;
  hours_worked: string;
  description: string | null;
};

export type TimesheetEntryFormInput = {
  branch_id?: string;
  timesheet_id: string;
  project_id: string;
  task_id: string;
  employee_id: string;
  work_date: string;
  hours_worked: string;
  description?: string | null;
  status?: string;
};

export async function listTimesheetEntries(): Promise<TimesheetEntry[]> {
  const res = await resourceService.list<TimesheetEntry>(TIMESHEET_ENTRIES_API, {
    page_size: 200,
  });
  return asArray(res.data);
}

export async function getTimesheetEntry(id: string): Promise<TimesheetEntry> {
  return unwrap(await resourceService.get<TimesheetEntry>(TIMESHEET_ENTRIES_API, id));
}

export async function createTimesheetEntry(
  body: TimesheetEntryFormInput,
): Promise<TimesheetEntry> {
  return unwrap(await resourceService.create<TimesheetEntry>(TIMESHEET_ENTRIES_API, body));
}

export async function updateTimesheetEntry(
  id: string,
  body: Partial<TimesheetEntryFormInput>,
): Promise<TimesheetEntry> {
  return unwrap(await resourceService.update<TimesheetEntry>(TIMESHEET_ENTRIES_API, id, body));
}

// ---------------------------------------------------------------------------
// Resource plans
// ---------------------------------------------------------------------------

export const RESOURCE_PLANS_API = "/projects/resource-plans";

export type ResourcePlan = AuditFields & {
  branch_id: string | null;
  document_number: string;
  project_id: string;
  plan_name: string;
  planned_from: string;
  planned_to: string;
};

export type ResourcePlanFormInput = {
  project_id: string;
  plan_name: string;
  planned_from: string;
  planned_to: string;
  status?: string;
};

export async function listResourcePlans(): Promise<ResourcePlan[]> {
  const res = await resourceService.list<ResourcePlan>(RESOURCE_PLANS_API, { page_size: 200 });
  return asArray(res.data);
}

export async function getResourcePlan(id: string): Promise<ResourcePlan> {
  return unwrap(await resourceService.get<ResourcePlan>(RESOURCE_PLANS_API, id));
}

export async function createResourcePlan(body: ResourcePlanFormInput): Promise<ResourcePlan> {
  return unwrap(await resourceService.create<ResourcePlan>(RESOURCE_PLANS_API, body));
}

export async function updateResourcePlan(
  id: string,
  body: Partial<ResourcePlanFormInput>,
): Promise<ResourcePlan> {
  return unwrap(await resourceService.update<ResourcePlan>(RESOURCE_PLANS_API, id, body));
}

// ---------------------------------------------------------------------------
// Resource allocations
// ---------------------------------------------------------------------------

export const RESOURCE_ALLOCATIONS_API = "/projects/resource-allocations";

export type ResourceAllocation = AuditFields & {
  branch_id: string | null;
  resource_plan_id: string;
  project_id: string;
  employee_id: string;
  resource_type: string;
  allocation_percent: string;
  start_date: string;
  end_date: string;
};

export type ResourceAllocationFormInput = {
  resource_plan_id: string;
  project_id: string;
  employee_id: string;
  resource_type?: string;
  allocation_percent: string;
  start_date: string;
  end_date: string;
  status?: string;
};

export async function listResourceAllocations(): Promise<ResourceAllocation[]> {
  const res = await resourceService.list<ResourceAllocation>(RESOURCE_ALLOCATIONS_API, {
    page_size: 200,
  });
  return asArray(res.data);
}

export async function getResourceAllocation(id: string): Promise<ResourceAllocation> {
  return unwrap(await resourceService.get<ResourceAllocation>(RESOURCE_ALLOCATIONS_API, id));
}

export async function createResourceAllocation(
  body: ResourceAllocationFormInput,
): Promise<ResourceAllocation> {
  return unwrap(await resourceService.create<ResourceAllocation>(RESOURCE_ALLOCATIONS_API, body));
}

export async function updateResourceAllocation(
  id: string,
  body: Partial<ResourceAllocationFormInput>,
): Promise<ResourceAllocation> {
  return unwrap(
    await resourceService.update<ResourceAllocation>(RESOURCE_ALLOCATIONS_API, id, body),
  );
}

// ---------------------------------------------------------------------------
// Project budgets
// ---------------------------------------------------------------------------

export const PROJECT_BUDGETS_API = "/projects/project-budgets";

export type ProjectBudget = AuditFields & {
  branch_id: string | null;
  document_number: string;
  project_id: string;
  budget_type: string;
  budget_amount: string;
  currency_code: string;
  fiscal_year_id: string | null;
  cost_center_code: string | null;
  finance_budget_id: string | null;
  workflow_status: string | null;
};

export type ProjectBudgetFormInput = {
  project_id: string;
  budget_type: string;
  budget_amount: string;
  currency_code?: string;
  cost_center_code?: string | null;
  status?: string;
};

export async function listProjectBudgets(): Promise<ProjectBudget[]> {
  const res = await resourceService.list<ProjectBudget>(PROJECT_BUDGETS_API, { page_size: 200 });
  return asArray(res.data);
}

export async function getProjectBudget(id: string): Promise<ProjectBudget> {
  return unwrap(await resourceService.get<ProjectBudget>(PROJECT_BUDGETS_API, id));
}

export async function createProjectBudget(body: ProjectBudgetFormInput): Promise<ProjectBudget> {
  return unwrap(await resourceService.create<ProjectBudget>(PROJECT_BUDGETS_API, body));
}

export async function updateProjectBudget(
  id: string,
  body: Partial<ProjectBudgetFormInput>,
): Promise<ProjectBudget> {
  return unwrap(await resourceService.update<ProjectBudget>(PROJECT_BUDGETS_API, id, body));
}

export async function submitProjectBudget(id: string): Promise<ProjectBudget> {
  return unwrap(await resourceService.action<ProjectBudget>(PROJECT_BUDGETS_API, id, "submit"));
}

export async function approveProjectBudget(id: string): Promise<ProjectBudget> {
  return unwrap(await resourceService.action<ProjectBudget>(PROJECT_BUDGETS_API, id, "approve"));
}

// ---------------------------------------------------------------------------
// Project costs
// ---------------------------------------------------------------------------

export const PROJECT_COSTS_API = "/projects/project-costs";

export type ProjectCost = AuditFields & {
  branch_id: string;
  document_number: string;
  project_id: string;
  cost_source: string;
  cost_amount: string;
  currency_code: string;
  cost_date: string;
  employee_id: string | null;
  product_id: string | null;
  timesheet_entry_id: string | null;
  finance_journal_id: string | null;
  idempotency_key: string;
};

export type ProjectCostFormInput = {
  branch_id?: string;
  project_id: string;
  cost_source: string;
  cost_amount: string;
  currency_code?: string;
  cost_date: string;
  employee_id?: string | null;
  status?: string;
};

export async function listProjectCosts(): Promise<ProjectCost[]> {
  const res = await resourceService.list<ProjectCost>(PROJECT_COSTS_API, { page_size: 200 });
  return asArray(res.data);
}

export async function getProjectCost(id: string): Promise<ProjectCost> {
  return unwrap(await resourceService.get<ProjectCost>(PROJECT_COSTS_API, id));
}

export async function createProjectCost(body: ProjectCostFormInput): Promise<ProjectCost> {
  return unwrap(await resourceService.create<ProjectCost>(PROJECT_COSTS_API, body));
}

export async function updateProjectCost(
  id: string,
  body: Partial<ProjectCostFormInput>,
): Promise<ProjectCost> {
  return unwrap(await resourceService.update<ProjectCost>(PROJECT_COSTS_API, id, body));
}

// ---------------------------------------------------------------------------
// Project issues
// ---------------------------------------------------------------------------

export const PROJECT_ISSUES_API = "/projects/project-issues";

export type ProjectIssue = AuditFields & {
  branch_id: string | null;
  document_number: string;
  project_id: string;
  task_id: string | null;
  issue_title: string;
  severity: string;
  owner_employee_id: string | null;
  opened_at: string | null;
  resolved_at: string | null;
};

export type ProjectIssueFormInput = {
  project_id: string;
  task_id?: string | null;
  issue_title: string;
  severity?: string;
  owner_employee_id?: string | null;
  status?: string;
};

export async function listProjectIssues(): Promise<ProjectIssue[]> {
  const res = await resourceService.list<ProjectIssue>(PROJECT_ISSUES_API, { page_size: 200 });
  return asArray(res.data);
}

export async function getProjectIssue(id: string): Promise<ProjectIssue> {
  return unwrap(await resourceService.get<ProjectIssue>(PROJECT_ISSUES_API, id));
}

export async function createProjectIssue(body: ProjectIssueFormInput): Promise<ProjectIssue> {
  return unwrap(await resourceService.create<ProjectIssue>(PROJECT_ISSUES_API, body));
}

export async function updateProjectIssue(
  id: string,
  body: Partial<ProjectIssueFormInput>,
): Promise<ProjectIssue> {
  return unwrap(await resourceService.update<ProjectIssue>(PROJECT_ISSUES_API, id, body));
}

// ---------------------------------------------------------------------------
// Project risks
// ---------------------------------------------------------------------------

export const PROJECT_RISKS_API = "/projects/project-risks";

export type ProjectRisk = AuditFields & {
  branch_id: string | null;
  document_number: string;
  project_id: string;
  risk_name: string;
  impact: string;
  probability: string;
  risk_level: string;
  owner_employee_id: string | null;
  mitigation_plan: string | null;
  review_date: string | null;
};

export type ProjectRiskFormInput = {
  project_id: string;
  risk_name: string;
  impact?: string;
  probability?: string;
  risk_level?: string;
  owner_employee_id?: string | null;
  mitigation_plan?: string | null;
  review_date?: string | null;
  status?: string;
};

export async function listProjectRisks(): Promise<ProjectRisk[]> {
  const res = await resourceService.list<ProjectRisk>(PROJECT_RISKS_API, { page_size: 200 });
  return asArray(res.data);
}

export async function getProjectRisk(id: string): Promise<ProjectRisk> {
  return unwrap(await resourceService.get<ProjectRisk>(PROJECT_RISKS_API, id));
}

export async function createProjectRisk(body: ProjectRiskFormInput): Promise<ProjectRisk> {
  return unwrap(await resourceService.create<ProjectRisk>(PROJECT_RISKS_API, body));
}

export async function updateProjectRisk(
  id: string,
  body: Partial<ProjectRiskFormInput>,
): Promise<ProjectRisk> {
  return unwrap(await resourceService.update<ProjectRisk>(PROJECT_RISKS_API, id, body));
}

// ---------------------------------------------------------------------------
// Change requests
// ---------------------------------------------------------------------------

export const CHANGE_REQUESTS_API = "/projects/change-requests";

export type ChangeRequest = AuditFields & {
  branch_id: string;
  document_number: string;
  project_id: string;
  change_title: string;
  change_type: string;
  requested_by_employee_id: string;
  impact_summary: string | null;
  budget_impact_amount: string | null;
  schedule_impact_days: number | null;
  workflow_status: string | null;
};

export type ChangeRequestFormInput = {
  branch_id?: string;
  project_id: string;
  change_title: string;
  change_type: string;
  requested_by_employee_id: string;
  impact_summary?: string | null;
  budget_impact_amount?: string | null;
  schedule_impact_days?: number | null;
  status?: string;
};

export async function listChangeRequests(): Promise<ChangeRequest[]> {
  const res = await resourceService.list<ChangeRequest>(CHANGE_REQUESTS_API, { page_size: 200 });
  return asArray(res.data);
}

export async function getChangeRequest(id: string): Promise<ChangeRequest> {
  return unwrap(await resourceService.get<ChangeRequest>(CHANGE_REQUESTS_API, id));
}

export async function createChangeRequest(body: ChangeRequestFormInput): Promise<ChangeRequest> {
  return unwrap(await resourceService.create<ChangeRequest>(CHANGE_REQUESTS_API, body));
}

export async function updateChangeRequest(
  id: string,
  body: Partial<ChangeRequestFormInput>,
): Promise<ChangeRequest> {
  return unwrap(await resourceService.update<ChangeRequest>(CHANGE_REQUESTS_API, id, body));
}

export async function submitChangeRequest(id: string): Promise<ChangeRequest> {
  return unwrap(await resourceService.action<ChangeRequest>(CHANGE_REQUESTS_API, id, "submit"));
}

export async function approveChangeRequest(id: string): Promise<ChangeRequest> {
  return unwrap(await resourceService.action<ChangeRequest>(CHANGE_REQUESTS_API, id, "approve"));
}

// ---------------------------------------------------------------------------
// Project documents
// ---------------------------------------------------------------------------

export const PROJECT_DOCUMENTS_API = "/projects/project-documents";

export type ProjectDocument = AuditFields & {
  branch_id: string | null;
  project_id: string;
  task_id: string | null;
  milestone_id: string | null;
  document_type: string;
  document_name: string;
  storage_uri: string | null;
  content_hash: string | null;
  uploaded_by_employee_id: string | null;
};

export type ProjectDocumentFormInput = {
  project_id: string;
  task_id?: string | null;
  milestone_id?: string | null;
  document_type?: string;
  document_name: string;
  storage_uri?: string | null;
  uploaded_by_employee_id?: string | null;
  status?: string;
};

export async function listProjectDocuments(): Promise<ProjectDocument[]> {
  const res = await resourceService.list<ProjectDocument>(PROJECT_DOCUMENTS_API, {
    page_size: 200,
  });
  return asArray(res.data);
}

export async function getProjectDocument(id: string): Promise<ProjectDocument> {
  return unwrap(await resourceService.get<ProjectDocument>(PROJECT_DOCUMENTS_API, id));
}

export async function createProjectDocument(
  body: ProjectDocumentFormInput,
): Promise<ProjectDocument> {
  return unwrap(await resourceService.create<ProjectDocument>(PROJECT_DOCUMENTS_API, body));
}

export async function updateProjectDocument(
  id: string,
  body: Partial<ProjectDocumentFormInput>,
): Promise<ProjectDocument> {
  return unwrap(await resourceService.update<ProjectDocument>(PROJECT_DOCUMENTS_API, id, body));
}

// ---------------------------------------------------------------------------
// Lookup options
// ---------------------------------------------------------------------------

export type Option = { id: string; label: string; meta?: Record<string, string> };

function toOptions(
  data: unknown,
  label: (row: Record<string, unknown>) => string,
): Option[] {
  const rows = asArray(data as Record<string, unknown>[] | Record<string, unknown> | null);
  return rows
    .filter((r) => r && typeof r === "object" && r.id)
    .map((r) => ({ id: String(r.id), label: label(r) }));
}

export async function listBranchOptions(): Promise<Option[]> {
  const res = await resourceService.list("/branches");
  return toOptions(res.data, (r) => String(r.branch_name ?? r.name ?? r.id));
}

function employeeOptionLabel(r: Record<string, unknown>): string {
  const name = [r.first_name, r.last_name].filter(Boolean).join(" ").trim();
  return name || String(r.id);
}

export async function listProjectMemberOptions(): Promise<Option[]> {
  const res = await resourceService.list("/projects/members");
  const rows = asArray(res.data as Record<string, unknown>[] | Record<string, unknown> | null);
  return rows.map((r) => ({
    id: String(r.id),
    label: String(r.label ?? r.id),
    email: r.email ? String(r.email) : undefined,
  }));
}

/** Users assigned to the Projects module (for PM assignee / owner pickers). */
export async function listEmployeeOptions(): Promise<Option[]> {
  return listProjectMemberOptions();
}

/** @deprecated Use listProjectMemberOptions — same module-assigned user list. */
export async function listProjectManagementTeamOptions(): Promise<Option[]> {
  return listProjectMemberOptions();
}

export async function listCustomerOptions(): Promise<Option[]> {
  const res = await resourceService.list("/customers", { page_size: 200 });
  return toOptions(res.data, (r) =>
    String(r.customer_name ?? r.name ?? r.customer_code ?? r.id),
  );
}

export type CustomerCreateInput = {
  branch_id: string;
  customer_name: string;
  customer_type?: string;
  billing_address_json?: {
    line1: string;
    city: string;
    country_code: string;
    state?: string | null;
    postal_code?: string | null;
  };
  email?: string | null;
  mobile?: string | null;
};

export type CustomerCreated = {
  id: string;
  customer_name: string;
  customer_code: string;
  status: string;
};

/** Create a master customer (same API as Master Data → Customers). */
export async function createCustomer(body: CustomerCreateInput): Promise<CustomerCreated> {
  return unwrap(
    await resourceService.create<CustomerCreated>("/customers", {
      branch_id: body.branch_id,
      customer_name: body.customer_name.trim(),
      customer_type: body.customer_type ?? "corporate",
      billing_address_json: body.billing_address_json ?? {
        line1: "TBD",
        city: "TBD",
        country_code: "IN",
      },
      email: body.email ?? null,
      mobile: body.mobile ?? null,
    }),
  );
}

export async function listDepartmentOptions(): Promise<Option[]> {
  const res = await resourceService.list("/departments", { page_size: 200 });
  return toOptions(res.data, (r) =>
    String(r.department_name ?? r.name ?? r.department_code ?? r.id),
  );
}

export async function listProjectOptions(): Promise<Option[]> {
  const rows = await listProjects();
  return rows.map((r) => ({ id: r.id, label: `${r.project_name} (${r.project_code})` }));
}

export async function listTaskOptions(): Promise<Option[]> {
  const rows = await listProjectTasks();
  return rows.map((r) => ({
    id: r.id,
    label: r.document_number ? `${r.task_name} (${r.document_number})` : r.task_name,
  }));
}

export async function listPhaseOptions(): Promise<Option[]> {
  const rows = await listProjectPhases();
  return rows.map((r) => ({ id: r.id, label: `${r.phase_name} (${r.phase_code})` }));
}

export async function listMilestoneOptions(): Promise<Option[]> {
  const rows = await listProjectMilestones();
  return rows.map((r) => ({ id: r.id, label: `${r.milestone_name} (${r.milestone_code})` }));
}

export async function listResourcePlanOptions(): Promise<Option[]> {
  const rows = await listResourcePlans();
  return rows.map((r) => ({ id: r.id, label: `${r.plan_name} (${r.document_number})` }));
}

export async function listTimesheetOptions(): Promise<Option[]> {
  const rows = await listTimesheets();
  return rows.map((r) => ({
    id: r.id,
    label: `${r.document_number} · ${r.period_start} → ${r.period_end}`,
  }));
}

// ---------------------------------------------------------------------------
// Portfolio overview
// ---------------------------------------------------------------------------

/** Numeric coercion for the `Numeric` columns the API serialises as strings. */
export function num(value: number | string | null | undefined): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function sumBy<T>(rows: T[], pick: (row: T) => number | string | null | undefined): number {
  return rows.reduce((total, row) => total + num(pick(row)), 0);
}

export function countIn<T extends { status: string }>(rows: T[], statuses: string[]): number {
  return rows.filter((r) => statuses.includes(r.status)).length;
}

export function countNotIn<T extends { status: string }>(rows: T[], statuses: string[]): number {
  return rows.filter((r) => !statuses.includes(r.status)).length;
}

export type ProjectsOverview = {
  projects: Project[];
  siteInstallations: SiteInstallation[];
  phases: ProjectPhase[];
  milestones: ProjectMilestone[];
  tasks: ProjectTask[];
  timesheets: Timesheet[];
  entries: TimesheetEntry[];
  allocations: ResourceAllocation[];
  budgets: ProjectBudget[];
  costs: ProjectCost[];
  issues: ProjectIssue[];
  risks: ProjectRisk[];
  changeRequests: ChangeRequest[];
  documents: ProjectDocument[];
  /** True when at least one endpoint failed — the rest is still usable. */
  partial: boolean;
  statusCodes: number[];
};

/**
 * Loads the whole portfolio in one pass. A failing endpoint degrades to an
 * empty list rather than blanking the dashboard, and its HTTP status is
 * reported so the caller can distinguish "signed out" from "server error".
 */
export async function loadProjectsOverview(): Promise<ProjectsOverview> {
  const statusCodes: number[] = [];

  async function safe<T>(load: () => Promise<T[]>): Promise<T[]> {
    try {
      return await load();
    } catch (err) {
      if (err instanceof ApiClientError) statusCodes.push(err.status);
      return [];
    }
  }

  const [
    projects,
    siteInstallations,
    phases,
    milestones,
    tasks,
    timesheets,
    entries,
    allocations,
    budgets,
    costs,
    issues,
    risks,
    changeRequests,
    documents,
  ] = await Promise.all([
    safe(listProjects),
    safe(listSiteInstallations),
    safe(listProjectPhases),
    safe(listProjectMilestones),
    safe(listProjectTasks),
    safe(listTimesheets),
    safe(listTimesheetEntries),
    safe(listResourceAllocations),
    safe(listProjectBudgets),
    safe(listProjectCosts),
    safe(listProjectIssues),
    safe(listProjectRisks),
    safe(listChangeRequests),
    safe(listProjectDocuments),
  ]);

  const projectIds = new Set(projects.map((p) => p.id));
  const byAssignedProject = <T extends { project_id?: string | null }>(rows: T[]): T[] =>
    rows.filter((row) => row.project_id != null && projectIds.has(row.project_id));

  return {
    projects,
    siteInstallations: siteInstallations.filter((s) => projectIds.has(s.project_id)),
    phases: byAssignedProject(phases),
    milestones: byAssignedProject(milestones),
    tasks: byAssignedProject(tasks),
    timesheets: byAssignedProject(timesheets),
    entries: byAssignedProject(entries),
    allocations: byAssignedProject(allocations),
    budgets: byAssignedProject(budgets),
    costs: byAssignedProject(costs),
    issues: byAssignedProject(issues),
    risks: byAssignedProject(risks),
    changeRequests: byAssignedProject(changeRequests),
    documents: byAssignedProject(documents),
    partial: statusCodes.length > 0,
    statusCodes,
  };
}
