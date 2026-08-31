import { ApiClientError, resourceService } from "@/services/api-client";

export type HrRow = Record<string, unknown>;

export type HrOption = { id: string; label: string };

function asArray(data: unknown): HrRow[] {
  return normalizeRows(data);
}

export type HrOverview = {
  designations: HrRow[];
  profiles: HrRow[];
  employment: HrRow[];
  shifts: HrRow[];
  shiftAssignments: HrRow[];
  holidayCalendars: HrRow[];
  leaveTypes: HrRow[];
  leaveBalances: HrRow[];
  leaveRequests: HrRow[];
  attendance: HrRow[];
  documents: HrRow[];
  reviews: HrRow[];
  goals: HrRow[];
  appraisals: HrRow[];
  training: HrRow[];
  trainingAttendance: HrRow[];
  separation: HrRow[];
  errors: string[];
  statusCodes: number[];
  partial: boolean;
};

function normalizeRows(data: unknown): HrRow[] {
  if (Array.isArray(data)) {
    return data.filter((row): row is HrRow => !!row && typeof row === "object");
  }
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.rows)) return normalizeRows(obj.rows);
    for (const key of ["items", "results", "records", "data", "lines"]) {
      if (Array.isArray(obj[key])) return normalizeRows(obj[key]);
    }
    return [obj];
  }
  return [];
}

async function safeList(
  apiPath: string,
  query?: Record<string, string | number | boolean | null | undefined>,
): Promise<{ rows: HrRow[]; error?: string; status?: number }> {
  try {
    const response = await resourceService.list(apiPath, { page_size: 200, page: 1, ...query });
    return { rows: normalizeRows(response.data) };
  } catch (err) {
    if (err instanceof ApiClientError) {
      return { rows: [], error: err.message, status: err.status };
    }
    return { rows: [], error: `Failed to load ${apiPath}`, status: 500 };
  }
}

async function safeListAll(apiPath: string): Promise<{ rows: HrRow[]; error?: string; status?: number }> {
  const all: HrRow[] = [];
  let page = 1;
  let lastStatus: number | undefined;
  while (page <= 20) {
    const chunk = await safeList(apiPath, { page, page_size: 200 });
    if (chunk.error && chunk.rows.length === 0) {
      return { rows: all, error: chunk.error, status: chunk.status };
    }
    lastStatus = chunk.status;
    all.push(...chunk.rows);
    if (chunk.rows.length < 200) break;
    page += 1;
  }
  return { rows: all, status: lastStatus };
}

export function formatQty(value: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value);
}

export function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function asStatus(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : "";
}

export function sumField(rows: HrRow[], field: string): number {
  return rows.reduce((sum, row) => sum + asNumber(row[field]), 0);
}

export function countByStatus(rows: HrRow[], statuses: string[]): number {
  const set = new Set(statuses.map((s) => s.toLowerCase()));
  return rows.filter((row) => set.has(asStatus(row.status))).length;
}

export function countByAttendanceStatus(rows: HrRow[], statuses: string[]): number {
  const set = new Set(statuses.map((s) => s.toLowerCase()));
  return rows.filter((row) => set.has(asStatus(row.attendance_status))).length;
}

export function countOpenDocs(rows: HrRow[], closedStatuses: string[]): number {
  const closed = new Set(closedStatuses.map((s) => s.toLowerCase()));
  return rows.filter((row) => {
    const status = asStatus(row.status);
    if (!status) return true;
    return !closed.has(status);
  }).length;
}

export function employeeDisplayName(row: HrRow): string {
  if (typeof row.employee_name === "string" && row.employee_name.trim()) {
    return row.employee_name;
  }
  const first = typeof row.first_name === "string" ? row.first_name : "";
  const last = typeof row.last_name === "string" ? row.last_name : "";
  const name = `${first} ${last}`.trim();
  return name || String(row.employee_code ?? row.document_number ?? "—");
}

export async function loadHrOverview(): Promise<HrOverview> {
  const [
    designations,
    profiles,
    employment,
    shifts,
    shiftAssignments,
    holidayCalendars,
    leaveTypes,
    leaveBalances,
    leaveRequests,
    attendance,
    documents,
    reviews,
    goals,
    appraisals,
    training,
    trainingAttendance,
    separation,
  ] = await Promise.all([
    safeList("/hr/designations"),
    safeList("/hr/employee-profiles"),
    safeList("/hr/employment"),
    safeList("/hr/shifts"),
    safeList("/hr/shift-assignments"),
    safeList("/hr/holiday-calendars"),
    safeList("/hr/leave-types"),
    safeList("/hr/leave-balances"),
    safeListAll("/hr/leave-requests"),
    safeListAll("/hr/attendance"),
    safeList("/hr/employee-documents"),
    safeList("/hr/performance-reviews"),
    safeList("/hr/goals"),
    safeList("/hr/appraisals"),
    safeList("/hr/training"),
    safeListAll("/hr/training-attendance"),
    safeList("/hr/separation"),
  ]);

  const results = [
    designations,
    profiles,
    employment,
    shifts,
    shiftAssignments,
    holidayCalendars,
    leaveTypes,
    leaveBalances,
    leaveRequests,
    attendance,
    documents,
    reviews,
    goals,
    appraisals,
    training,
    trainingAttendance,
    separation,
  ];
  const errors = results.map((r) => r.error).filter((e): e is string => Boolean(e));
  const statusCodes = results
    .map((r) => r.status)
    .filter((s): s is number => typeof s === "number");

  return {
    designations: designations.rows,
    profiles: profiles.rows,
    employment: employment.rows,
    shifts: shifts.rows,
    shiftAssignments: shiftAssignments.rows,
    holidayCalendars: holidayCalendars.rows,
    leaveTypes: leaveTypes.rows,
    leaveBalances: leaveBalances.rows,
    leaveRequests: leaveRequests.rows,
    attendance: attendance.rows,
    documents: documents.rows,
    reviews: reviews.rows,
    goals: goals.rows,
    appraisals: appraisals.rows,
    training: training.rows,
    trainingAttendance: trainingAttendance.rows,
    separation: separation.rows,
    errors,
    statusCodes,
    partial: errors.length > 0,
  };
}

export async function listHrBranchOptions(): Promise<HrOption[]> {
  try {
    const res = await resourceService.list("/branches");
    return asArray(res.data).map((r) => ({
      id: String(r.id),
      label: String(r.branch_name ?? r.name ?? r.branch_code ?? r.id),
    }));
  } catch {
    return [];
  }
}

export async function listHrEmployeeOptions(): Promise<HrOption[]> {
  try {
    const res = await resourceService.list("/employees");
    return asArray(res.data).map((r) => ({
      id: String(r.id),
      label:
        `${[r.first_name, r.last_name].filter(Boolean).join(" ")}${
          r.employee_code ? ` (${r.employee_code})` : ""
        }`.trim() || String(r.id),
    }));
  } catch {
    return [];
  }
}

export async function listLeaveTypeOptions(): Promise<HrOption[]> {
  try {
    const res = await resourceService.list("/hr/leave-types");
    return asArray(res.data)
      .filter((r) => String(r.status ?? "active").toLowerCase() === "active")
      .map((r) => ({
        id: String(r.id),
        label: String(r.leave_type_name ?? r.leave_type_code ?? r.name ?? r.id),
      }));
  } catch {
    return [];
  }
}

export async function listShiftOptions(): Promise<HrOption[]> {
  try {
    const res = await resourceService.list("/hr/shifts");
    return asArray(res.data).map((r) => ({
      id: String(r.id),
      label: String(r.shift_name ?? r.shift_code ?? r.name ?? r.id),
    }));
  } catch {
    return [];
  }
}

export async function createLeaveRequest(body: {
  branch_id: string;
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  days_count: number;
  reason?: string;
}) {
  return resourceService.create("/hr/leave-requests", body);
}

export async function createAttendance(body: {
  branch_id: string;
  employee_id: string;
  attendance_date: string;
  attendance_status: string;
  source?: string;
  shift_id?: string | null;
  notes?: string;
  total_hours?: number | null;
}) {
  return resourceService.create("/hr/attendance", {
    ...body,
    source: body.source ?? "manual",
  });
}

export async function createDesignation(body: {
  branch_id?: string | null;
  designation_code: string;
  designation_name: string;
  job_level?: string;
  status?: string;
}) {
  return resourceService.create("/hr/designations", {
    ...body,
    status: body.status ?? "active",
  });
}
