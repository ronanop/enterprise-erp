import type { AttendanceRecord } from "@/types/attendance-management";
import type { LeaveRequestRecord } from "@/types/leave-management";
import type { PayrollEmployeeAttendance } from "@/types/payroll-management";
import type { PayrollCycle } from "@/lib/payroll-cycle";
import { SALARY_DAY_BASIS } from "@/lib/payroll-cycle";
import { isWeeklyOffDay, type WeeklyOffRuleCode } from "@/lib/hr/weekly-off-rules";

export function splitPresentAndHalf(presentDays: number, halfDays = 0): { present: number; half: number } {
  let half = halfDays;
  let present = presentDays;
  if (presentDays % 1 !== 0) {
    const frac = Math.round((presentDays - Math.floor(presentDays)) * 2) / 2;
    if (!half) half = Math.round(frac * 2);
    present = Math.round((presentDays - half * 0.5) * 10) / 10;
  }
  return { present, half };
}

export type PayrollAttendanceEmployeeRef = {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  /** HR UUID when known — used to match attendance rows */
  hrEmployeeId?: string;
};

export type PayrollAttendanceCalendar = {
  weeklyOffRules?: WeeklyOffRuleCode[] | null;
  alternateSaturdayStart?: string | null;
  holidayDates?: string[] | Set<string>;
  /** Unmarked working days after this date are not treated as loss of pay. */
  asOfDate?: string;
};

function todayIso(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function inCycle(date: string, cycle: PayrollCycle): boolean {
  return date >= cycle.start && date <= cycle.end;
}

function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  let cur = new Date(y1, m1 - 1, d1);
  const end = new Date(y2, m2 - 1, d2);
  while (cur <= end) {
    days.push(
      `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`,
    );
    cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
  }
  return days;
}

function leaveDatesInCycle(req: LeaveRequestRecord, cycle: PayrollCycle): string[] {
  if (!["approved", "manager_approved", "hr_approved"].includes(req.status)) return [];
  const overlapStart = req.fromDate > cycle.start ? req.fromDate : cycle.start;
  const overlapEnd = req.toDate < cycle.end ? req.toDate : cycle.end;
  if (overlapStart > overlapEnd) return [];
  return eachDay(overlapStart, overlapEnd);
}

function leaveDaysInCycle(req: LeaveRequestRecord, cycle: PayrollCycle): number {
  return leaveDatesInCycle(req, cycle).length;
}

function presentWeight(status: string): number {
  switch (status) {
    case "present":
    case "late":
    case "work_from_home":
    case "early_exit":
    case "on_duty":
      return 1;
    case "half_day":
      return 0.5;
    default:
      return 0;
  }
}

function resolveHrId(ref: PayrollAttendanceEmployeeRef): string {
  return ref.hrEmployeeId || ref.employeeId;
}

function pushAtt(map: Map<string, AttendanceRecord[]>, key: string | undefined, row: AttendanceRecord) {
  const k = (key || "").trim().toLowerCase();
  if (!k) return;
  const list = map.get(k) ?? [];
  list.push(row);
  map.set(k, list);
}

export function summarizePayrollAttendance(
  cycle: PayrollCycle,
  employees: PayrollAttendanceEmployeeRef[],
  attendance: AttendanceRecord[],
  leaveRequests: LeaveRequestRecord[],
  calendar: PayrollAttendanceCalendar = {},
): PayrollEmployeeAttendance[] {
  const attByEmployee = new Map<string, AttendanceRecord[]>();
  for (const r of attendance) {
    if (!inCycle(r.attendanceDate, cycle)) continue;
    pushAtt(attByEmployee, r.employeeId, r);
    pushAtt(attByEmployee, r.extension?.employeeCode, r);
  }

  const leaveByEmployee = new Map<string, number>();
  for (const req of leaveRequests) {
    const days = leaveDaysInCycle(req, cycle);
    if (days <= 0) continue;
    leaveByEmployee.set(req.employeeId, (leaveByEmployee.get(req.employeeId) ?? 0) + days);
  }

  const holidaySet = new Set(
    [...(calendar.holidayDates ?? [])].map((d) => String(d).slice(0, 10)).filter(Boolean),
  );
  const asOf = (calendar.asOfDate || todayIso()).slice(0, 10);
  const woOpts = { alternateSaturdayStart: calendar.alternateSaturdayStart ?? null };

  return employees.map((emp) => {
    const hrId = resolveHrId(emp);
    const rows =
      attByEmployee.get(hrId.toLowerCase()) ??
      attByEmployee.get(emp.employeeId.toLowerCase()) ??
      attByEmployee.get((emp.employeeCode || "").toLowerCase()) ??
      [];

    let presentDays = 0;
    let halfDays = 0;
    let absentDays = 0;
    let leaveFromAtt = 0;
    let holidays = 0;
    let weeklyOff = 0;

    for (const r of rows) {
      const w = presentWeight(r.status);
      if (w >= 1) presentDays += 1;
      else if (w > 0) halfDays += 1;
      else if (r.status === "absent") absentDays += 1;
      else if (r.status === "leave") leaveFromAtt += 1;
      else if (r.status === "holiday") holidays += 1;
      else if (r.status === "weekend" || r.status === "week_off") weeklyOff += 1;
    }

    const leaveDates = new Set<string>();
    for (const req of leaveRequests) {
      if (
        req.employeeId !== hrId &&
        req.employeeId !== emp.employeeId &&
        req.employeeId !== emp.employeeCode
      ) {
        continue;
      }
      for (const day of leaveDatesInCycle(req, cycle)) leaveDates.add(day);
    }

    const covered = new Set(rows.map((r) => r.attendanceDate));
    for (const day of eachDay(cycle.start, cycle.end)) {
      if (covered.has(day) || leaveDates.has(day)) continue;
      if (holidaySet.has(day)) {
        holidays += 1;
        continue;
      }
      if (isWeeklyOffDay(day, calendar.weeklyOffRules, woOpts)) {
        weeklyOff += 1;
        continue;
      }
      if (day > asOf) continue;
      absentDays += 1;
    }

    const leaveFromRequests =
      leaveByEmployee.get(hrId) ??
      leaveByEmployee.get(emp.employeeId) ??
      leaveByEmployee.get(emp.employeeCode) ??
      0;
    const leaveDays = Math.max(leaveFromAtt, leaveFromRequests);
    const lopDays = Math.round((absentDays + halfDays * 0.5) * 10) / 10;
    const periodDays = SALARY_DAY_BASIS;
    const payableDays = Math.max(0, Math.round((periodDays - lopDays) * 10) / 10);
    const attendanceFactor =
      periodDays > 0 ? Math.min(1, Math.max(0, payableDays / periodDays)) : 1;

    return {
      employeeId: emp.employeeId,
      employeeCode: emp.employeeCode,
      employeeName: emp.employeeName,
      department: emp.department,
      presentDays,
      leaveDays,
      absentDays,
      halfDays,
      holidays,
      weeklyOff,
      lopDays,
      payableDays,
      workingDaysInCycle: periodDays,
      periodDays,
      attendanceFactor: Math.round(attendanceFactor * 1000) / 1000,
    };
  });
}
