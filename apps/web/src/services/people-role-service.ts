/**
 * People roles API — manager / hiring manager / recruiter / HR assignment.
 */

import { resourceService } from "@/services/api-client";

export type PeopleRoleRow = {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  display_name: string;
  designation: string;
  status: string;
  reporting_manager_id: string | null;
  reporting_manager_name: string | null;
  reporting_manager_code?: string | null;
  reports_count: number;
  is_hiring_manager: boolean;
  is_manager: boolean;
  is_recruiter: boolean;
  is_hr: boolean;
  has_login: boolean;
  role_codes: string[];
  hr_note: string | null;
};

export type PeopleRolePatch = {
  is_hiring_manager?: boolean;
  is_manager?: boolean;
  is_recruiter?: boolean;
  is_hr?: boolean;
  reporting_manager_id?: string | null;
  clear_reporting_manager?: boolean;
};

const API = "/hrms/people-roles";

export async function listPeopleRoles(): Promise<PeopleRoleRow[]> {
  const res = await resourceService.list(API, { page_size: 500 });
  const rows = (Array.isArray(res.data) ? res.data : []) as PeopleRoleRow[];
  return hydrateMissingReportingManagers(rows);
}

/**
 * HQ leaders (e.g. CEO on another company) can be referenced as reporting_manager_id
 * but omitted from the company-scoped people-roles list — pull them in so org chart
 * and manager pickers still show them.
 */
async function hydrateMissingReportingManagers(rows: PeopleRoleRow[]): Promise<PeopleRoleRow[]> {
  const byId = new Map(rows.map((r) => [String(r.id), r]));
  const missing = [
    ...new Set(
      rows
        .map((r) => (r.reporting_manager_id ? String(r.reporting_manager_id) : ""))
        .filter((id) => Boolean(id) && !byId.has(id)),
    ),
  ];
  if (missing.length === 0) return rows;

  const extras: PeopleRoleRow[] = [];
  await Promise.all(
    missing.map(async (id) => {
      try {
        const res = await resourceService.get<Record<string, unknown>>("/employees", id);
        const e = (res.data ?? {}) as Record<string, unknown>;
        if (!e.id || e.is_deleted) return;
        const first = String(e.first_name ?? "");
        const last = String(e.last_name ?? "");
        const code = String(e.employee_code ?? "");
        const display = `${first} ${last}`.trim() || String(e.display_name ?? code);
        const reportsPointingHere = rows.filter((r) => String(r.reporting_manager_id ?? "") === id).length;
        extras.push({
          id: String(e.id),
          employee_code: code,
          first_name: first,
          last_name: last,
          display_name: display,
          designation: String(e.designation ?? ""),
          status: String(e.status ?? "active"),
          reporting_manager_id: e.reporting_manager_id ? String(e.reporting_manager_id) : null,
          reporting_manager_name: null,
          reporting_manager_code: null,
          reports_count: Math.max(Number(e.reports_count ?? 0), reportsPointingHere),
          is_hiring_manager: e.is_hiring_manager === true,
          is_manager: e.is_manager === true,
          is_recruiter: e.is_recruiter === true,
          is_hr: e.is_hr === true,
          has_login: Boolean(e.user_id),
          role_codes: [],
          hr_note: null,
        });
      } catch {
        /* out of scope / soft-deleted */
      }
    }),
  );

  if (extras.length === 0) return rows;
  return [...rows, ...extras];
}

export async function updatePeopleRole(id: string, body: PeopleRolePatch): Promise<PeopleRoleRow> {
  const res = await resourceService.update<PeopleRoleRow>(API, id, body);
  return res.data as PeopleRoleRow;
}
