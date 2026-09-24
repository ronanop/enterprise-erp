/**
 * People roles API — hiring manager / recruiter / HR assignment.
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
  is_recruiter: boolean;
  is_hr: boolean;
  has_login: boolean;
  role_codes: string[];
  hr_note: string | null;
};

export type PeopleRolePatch = {
  is_hiring_manager?: boolean;
  is_recruiter?: boolean;
  is_hr?: boolean;
  reporting_manager_id?: string | null;
  clear_reporting_manager?: boolean;
};

const API = "/hrms/people-roles";

export async function listPeopleRoles(): Promise<PeopleRoleRow[]> {
  const res = await resourceService.list(API, { page_size: 500 });
  return (Array.isArray(res.data) ? res.data : []) as PeopleRoleRow[];
}

export async function updatePeopleRole(id: string, body: PeopleRolePatch): Promise<PeopleRoleRow> {
  const res = await resourceService.update<PeopleRoleRow>(API, id, body);
  return res.data as PeopleRoleRow;
}
