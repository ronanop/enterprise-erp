import { apiClient } from "@/services/api-client";

export type HrAdminRecord = {
  employee_id: string;
  employee_code: string;
  display_name: string;
  email: string;
  designation: string;
  user_id: string;
  login_created: boolean;
  temporary_password: string | null;
  email_sent?: boolean;
  company_ids: string[];
  nav_keys: string[];
  nav_unrestricted: boolean;
  /** MODULE_ROLE_ADMIN from Organization → Users */
  is_org_module_admin: boolean;
};

export type HrNavAccessRecord = {
  unrestricted: boolean;
  nav_keys: string[];
};

export type HrAdminEntityOption = {
  id: string;
  company_code: string;
  company_name: string;
  legal_name: string;
  status: string;
};

export type HrAdminPasswordResponse = {
  employee_id: string;
  display_name: string;
  email: string;
  temporary_password: string | null;
  email_sent: boolean;
};

export type HrActivityLogRecord = {
  id: string;
  occurred_at: string;
  kind: string;
  action: string;
  entity_name: string | null;
  actor_name: string | null;
  actor_email: string | null;
  summary: string;
};

function mapAdmin(row: HrAdminRecord): HrAdminRecord {
  return {
    ...row,
    company_ids: Array.isArray(row.company_ids) ? row.company_ids.map(String) : [],
    nav_keys: Array.isArray(row.nav_keys) ? row.nav_keys.map(String) : [],
    nav_unrestricted: Boolean(row.nav_unrestricted),
    is_org_module_admin: Boolean(row.is_org_module_admin),
  };
}

export async function listHrAdmins(): Promise<HrAdminRecord[]> {
  const res = await apiClient<HrAdminRecord[]>("/hr/superadmin/admins");
  return (res.data ?? []).map(mapAdmin);
}

/** HR module admins from Organization → Users (not grantable in this panel). */
export async function listOrgHrModuleAdmins(): Promise<HrAdminRecord[]> {
  const res = await apiClient<HrAdminRecord[]>("/hr/superadmin/org-module-admins");
  return (res.data ?? []).map(mapAdmin);
}

export async function listHrEntities(): Promise<HrAdminEntityOption[]> {
  const res = await apiClient<HrAdminEntityOption[]>("/hr/superadmin/entities");
  return res.data ?? [];
}

export async function assignHrAdmin(
  employeeId: string,
  companyIds: string[] = [],
): Promise<HrAdminRecord> {
  const res = await apiClient<HrAdminRecord>("/hr/superadmin/admins", {
    method: "POST",
    body: { employee_id: employeeId, company_ids: companyIds },
  });
  if (!res.data) throw new Error(res.message || "Assign failed");
  return mapAdmin(res.data);
}

export async function setHrAdminEntities(
  employeeId: string,
  companyIds: string[],
): Promise<HrAdminRecord> {
  const res = await apiClient<HrAdminRecord>(`/hr/superadmin/admins/${employeeId}/entities`, {
    method: "PATCH",
    body: { company_ids: companyIds },
  });
  if (!res.data) throw new Error(res.message || "Entity update failed");
  return mapAdmin(res.data);
}

export async function setHrAdminNav(employeeId: string, navKeys: string[]): Promise<HrAdminRecord> {
  const res = await apiClient<HrAdminRecord>(`/hr/superadmin/admins/${employeeId}/nav`, {
    method: "PATCH",
    body: { nav_keys: navKeys },
  });
  if (!res.data) throw new Error(res.message || "Menu update failed");
  return mapAdmin(res.data);
}

export async function getMyHrNavAccess(): Promise<HrNavAccessRecord> {
  const res = await apiClient<HrNavAccessRecord>("/hr/nav-access");
  return {
    unrestricted: Boolean(res.data?.unrestricted),
    nav_keys: Array.isArray(res.data?.nav_keys) ? res.data.nav_keys.map(String) : [],
  };
}

export async function revokeHrAdmin(employeeId: string): Promise<void> {
  await apiClient<null>(`/hr/superadmin/admins/${employeeId}`, { method: "DELETE" });
}

export async function resetHrAdminPassword(employeeId: string): Promise<HrAdminPasswordResponse> {
  const res = await apiClient<HrAdminPasswordResponse>(
    `/hr/superadmin/admins/${employeeId}/reset-password`,
    { method: "POST", body: {} },
  );
  if (!res.data) throw new Error(res.message || "Password reset failed");
  return res.data;
}

export async function listHrActivityLogs(limit = 200): Promise<HrActivityLogRecord[]> {
  const res = await apiClient<HrActivityLogRecord[]>("/hr/superadmin/activity-logs", {
    query: { limit },
  });
  return res.data ?? [];
}

export type HrIntegrationCatalogItem = {
  id: string;
  label: string;
  method?: string;
  path?: string;
  description?: string;
};

export type HrIntegrationCatalog = {
  endpoints: HrIntegrationCatalogItem[];
  fields: HrIntegrationCatalogItem[];
};

/** Always available in UI even if catalog API is down / API not restarted. */
export const FALLBACK_INTEGRATION_CATALOG: HrIntegrationCatalog = {
  endpoints: [
    {
      id: "employees",
      label: "Employees",
      method: "GET",
      path: "/api/v1/hr/integration/employees",
      description: "List employees with the selected fields",
    },
  ],
  fields: [
    { id: "employee_code", label: "Employee ID" },
    { id: "name", label: "Name" },
    { id: "first_name", label: "First name" },
    { id: "last_name", label: "Last name" },
    { id: "email", label: "Official email" },
    { id: "mobile", label: "Mobile" },
    { id: "designation", label: "Designation" },
    { id: "department", label: "Department" },
    { id: "manager", label: "Reporting manager" },
    { id: "manager_code", label: "Reporting manager ID" },
    { id: "branch", label: "Branch" },
    { id: "company", label: "Entity / Company" },
    { id: "status", label: "Employment status" },
    { id: "date_of_joining", label: "Date of joining" },
    { id: "date_of_leaving", label: "Date of leaving" },
    { id: "gender", label: "Gender" },
    { id: "date_of_birth", label: "Date of birth" },
    { id: "employment_type", label: "Employment type" },
    { id: "work_location", label: "Work location" },
    { id: "is_manager", label: "Is manager" },
    { id: "leave_balances", label: "Leave balances (all types)" },
    { id: "leave_balance_total", label: "Leave balance total" },
    { id: "leave_used_total", label: "Leave used total" },
    { id: "salary", label: "Salary (CTC / gross / structure)" },
    { id: "payroll", label: "Payroll (latest run line)" },
    { id: "payslip", label: "Payslip (latest)" },
    { id: "shift", label: "Shift (current assignment)" },
  ],
};

export type HrIntegrationApiKeyRecord = {
  id: string;
  name: string;
  key_prefix: string;
  endpoints: string[];
  fields: string[];
  company_ids: string[];
  status: string;
  notes: string | null;
  created_at: string | null;
  last_used_at: string | null;
  expires_at: string | null;
  api_key?: string;
};

export async function getIntegrationApiKeyCatalog(): Promise<HrIntegrationCatalog> {
  try {
    const res = await apiClient<HrIntegrationCatalog>("/hr/superadmin/api-keys/catalog");
    const endpoints = res.data?.endpoints?.length
      ? res.data.endpoints
      : FALLBACK_INTEGRATION_CATALOG.endpoints;
    const fields = res.data?.fields?.length
      ? res.data.fields
      : FALLBACK_INTEGRATION_CATALOG.fields;
    return { endpoints, fields };
  } catch {
    return FALLBACK_INTEGRATION_CATALOG;
  }
}

export async function listIntegrationApiKeys(): Promise<HrIntegrationApiKeyRecord[]> {
  const res = await apiClient<HrIntegrationApiKeyRecord[]>("/hr/superadmin/api-keys");
  return (res.data ?? []).map((row) => ({
    ...row,
    id: String(row.id),
    endpoints: Array.isArray(row.endpoints) ? row.endpoints.map(String) : [],
    fields: Array.isArray(row.fields) ? row.fields.map(String) : [],
    company_ids: Array.isArray(row.company_ids) ? row.company_ids.map(String) : [],
  }));
}

export async function createIntegrationApiKey(input: {
  name: string;
  endpoints: string[];
  fields: string[];
  companyIds?: string[];
  notes?: string;
  expiresAt?: string | null;
  ttlDays?: number | null;
}): Promise<HrIntegrationApiKeyRecord> {
  const body: Record<string, unknown> = {
    name: input.name,
    endpoints: input.endpoints,
    fields: input.fields,
    company_ids: input.companyIds ?? [],
    notes: input.notes || null,
  };
  if (input.expiresAt) body.expires_at = input.expiresAt;
  else if (input.ttlDays != null && input.ttlDays > 0) body.ttl_days = input.ttlDays;

  const res = await apiClient<HrIntegrationApiKeyRecord>("/hr/superadmin/api-keys", {
    method: "POST",
    body,
  });
  if (!res.data) throw new Error(res.message || "Could not create API key");
  return {
    ...res.data,
    id: String(res.data.id),
    endpoints: Array.isArray(res.data.endpoints) ? res.data.endpoints.map(String) : [],
    fields: Array.isArray(res.data.fields) ? res.data.fields.map(String) : [],
    company_ids: Array.isArray(res.data.company_ids) ? res.data.company_ids.map(String) : [],
  };
}

export async function revokeIntegrationApiKey(keyId: string): Promise<void> {
  await apiClient<null>(`/hr/superadmin/api-keys/${keyId}`, { method: "DELETE" });
}
