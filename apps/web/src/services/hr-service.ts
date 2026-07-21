import { ApiClientError, resourceService } from "@/services/api-client";

export type HrRow = Record<string, unknown>;

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
): Promise<{ rows: HrRow[]; error?: string; status?: number }> {
  try {
    const response = await resourceService.list(apiPath);
    return { rows: normalizeRows(response.data) };
  } catch (err) {
    if (err instanceof ApiClientError) {
      return { rows: [], error: err.message, status: err.status };
    }
    return { rows: [], error: `Failed to load ${apiPath}`, status: 500 };
  }
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
    safeList("/hr/leave-requests"),
    safeList("/hr/attendance"),
    safeList("/hr/employee-documents"),
    safeList("/hr/performance-reviews"),
    safeList("/hr/goals"),
    safeList("/hr/appraisals"),
    safeList("/hr/training"),
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
    separation: separation.rows,
    errors,
    statusCodes,
    partial: errors.length > 0,
  };
}
