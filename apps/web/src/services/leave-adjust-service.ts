import { apiClient } from "@/services/api-client";

export type LeaveAdjustPool = {
  leave_type_id: string;
  code: string;
  name: string;
  remaining: string | number;
};

export type LeaveAdjustDay = {
  attendance_date: string;
  punch_status: string;
  kind: string;
  days: string | number;
  proposed_result: string;
  proposed_type_code: string | null;
  proposed_type_id: string | null;
  already_adjusted: boolean;
  can_mark_leave?: boolean;
};

export type LeaveAdjustPreview = {
  employee_id: string;
  period_start: string;
  period_end: string;
  financial_year?: number;
  financial_year_label?: string;
  balances: LeaveAdjustPool[];
  balances_after: LeaveAdjustPool[];
  days_to_use: string | number;
  lop_leftover: string | number;
  days: LeaveAdjustDay[];
  confirmed?: number;
};

export type LeaveAdjustHistoryRow = {
  id: string;
  employee_id: string;
  attendance_date: string;
  leave_type_code: string | null;
  leave_type_name: string | null;
  days: string | number;
  result: string;
  balance_before: string | number | null;
  balance_after: string | number | null;
  source: string;
  confirmed_at: string | null;
  reverted_at: string | null;
  reason: string | null;
};

export function payrollRunIdForApi(id: string | undefined | null): string | undefined {
  if (!id) return undefined;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ? id
    : undefined;
}

function num(v: string | number | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export { num as leaveAdjustNum };

export async function previewLeaveAdjust(input: {
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  companyId?: string;
}): Promise<LeaveAdjustPreview> {
  const res = await apiClient<LeaveAdjustPreview>("/hr/leave-adjust/preview", {
    query: {
      employee_id: input.employeeId,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      company_id: input.companyId || undefined,
    },
  });
  if (!res.data) throw new Error(res.message || "Preview failed");
  return res.data;
}

export async function confirmLeaveAdjust(input: {
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  companyId?: string;
  source?: "attendance_tab" | "payroll_run";
  payrollRunId?: string;
  reason?: string;
}): Promise<LeaveAdjustPreview> {
  const res = await apiClient<LeaveAdjustPreview>("/hr/leave-adjust/confirm", {
    method: "POST",
    body: {
      employee_id: input.employeeId,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      company_id: input.companyId || null,
      source: input.source ?? "attendance_tab",
      payroll_run_id: input.payrollRunId || null,
      reason: input.reason || null,
    },
  });
  if (!res.data) throw new Error(res.message || "Confirm failed");
  return res.data;
}

export async function applyLeaveAdjustDay(input: {
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  attendanceDate: string;
  leaveTypeCode: "CL" | "SL";
  companyId?: string;
  source?: "attendance_tab" | "payroll_run";
  payrollRunId?: string;
}): Promise<LeaveAdjustPreview> {
  const res = await apiClient<LeaveAdjustPreview>("/hr/leave-adjust/apply-day", {
    method: "POST",
    body: {
      employee_id: input.employeeId,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      attendance_date: input.attendanceDate,
      leave_type_code: input.leaveTypeCode,
      company_id: input.companyId || null,
      source: input.source ?? "attendance_tab",
      payroll_run_id: input.payrollRunId || null,
    },
  });
  if (!res.data) throw new Error(res.message || "Could not mark leave");
  return res.data;
}

export async function revertLeaveAdjust(input: {
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  companyId?: string;
  payrollRunId?: string;
}): Promise<{ reverted: number }> {
  const res = await apiClient<{ reverted: number }>("/hr/leave-adjust/revert", {
    method: "POST",
    body: {
      employee_id: input.employeeId,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      company_id: input.companyId || null,
      payroll_run_id: input.payrollRunId || null,
    },
  });
  if (!res.data) throw new Error(res.message || "Revert failed");
  return res.data;
}

export async function listLeaveAdjustHistory(input: {
  employeeId?: string;
  periodStart?: string;
  periodEnd?: string;
  payrollRunId?: string;
}): Promise<LeaveAdjustHistoryRow[]> {
  const res = await apiClient<LeaveAdjustHistoryRow[]>("/hr/leave-adjust/history", {
    query: {
      employee_id: input.employeeId,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      payroll_run_id: input.payrollRunId,
    },
  });
  return res.data ?? [];
}

export function poolRemaining(pools: LeaveAdjustPool[], code: string): number {
  const aliases =
    code.toUpperCase() === "CL"
      ? ["CL", "CASUAL", "CASUALLEAVE"]
      : code.toUpperCase() === "SL"
        ? ["SL", "SICK", "SICKLEAVE"]
        : ["EL", "EARNED", "EARNEDLEAVE", "PL", "PRIVILEGE", "PRIVILEGELEAVE"];
  const row = pools.find((p) => aliases.includes(p.code.toUpperCase().replace(/[\s_-]/g, "")));
  return row ? num(row.remaining) : 0;
}
