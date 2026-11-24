import type { AttendanceRecord } from "@/types/attendance-management";
import type { LeaveRequestRecord } from "@/types/leave-management";
import type { PayrollEmployeeAttendance } from "@/types/payroll-management";
import type { PayrollCycle } from "@/lib/payroll-cycle";
import { SALARY_DAY_BASIS } from "@/lib/payroll-cycle";
import { isWeeklyOffDay, type WeeklyOffRuleCode } from "@/lib/hr/weekly-off-rules";
import {
  DEFAULT_SANDWICH_POLICY,
  padDateRange,
  sandwichOffDates,
  type SandwichPolicy,
} from "@/lib/hr/sandwich-rules";

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
  /** HR UUID when known - used to match attendance rows */
  hrEmployeeId?: string;
};

export type PayrollAttendanceCalendar = {
  weeklyOffRules?: WeeklyOffRuleCode[] | null;
  alternateSaturdayStart?: string | null;
  holidayDates?: string[] | Set<string>;
  /** Unmarked working days after this date are not treated as loss of pay. */
  asOfDate?: string;
  /** Company sandwich policy (defaults ON / both / lop). */
  sandwich?: SandwichPolicy;
};

function todayIso(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

function leaveDatesInRange(req: LeaveRequestRecord, start: string, end: string): string[] {
  if (!["approved", "manager_approved", "hr_approved"].includes(req.status)) return [];
  const overlapStart = req.fromDate > start ? req.fromDate : start;
  const overlapEnd = req.toDate < end ? req.toDate : end;
  if (overlapStart > overlapEnd) return [];
  return eachDay(overlapStart, overlapEnd);
}

function leaveDatesInCycle(req: LeaveRequestRecord, cycle: PayrollCycle): string[] {
  return leaveDatesInRange(req, cycle.start, cycle.end);
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
    case "miss_punch":
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

function matchesEmployee(
  req: LeaveRequestRecord,
  hrId: string,
  emp: PayrollAttendanceEmployeeRef,
): boolean {
  return (
    req.employeeId === hrId ||
    req.employeeId === emp.employeeId ||
    req.employeeId === emp.employeeCode
  );
}

export function summarizePayrollAttendance(
  cycle: PayrollCycle,
  employees: PayrollAttendanceEmployeeRef[],
  attendance: AttendanceRecord[],
  leaveRequests: LeaveRequestRecord[],
  calendar: PayrollAttendanceCalendar = {},
): PayrollEmployeeAttendance[] {
  const sandwich = calendar.sandwich ?? DEFAULT_SANDWICH_POLICY;
  const pad = padDateRange(cycle.start, cycle.end, 10);

  const attByEmployee = new Map<string, AttendanceRecord[]>();
  for (const r of attendance) {
    const day = String(r.attendanceDate || "").slice(0, 10);
    if (!day || day < pad.start || day > pad.end) continue;
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

  const isNonWorking = (day: string) =>
    holidaySet.has(day) || isWeeklyOffDay(day, calendar.weeklyOffRules, woOpts);

  return employees.map((emp) => {
    const hrId = resolveHrId(emp);
    const rows =
      attByEmployee.get(hrId.toLowerCase()) ??
      attByEmployee.get(emp.employeeId.toLowerCase()) ??
      attByEmployee.get((emp.employeeCode || "").toLowerCase()) ??
      [];

    const statusByDate = new Map<string, string>();
    for (const r of rows) {
      const day = String(r.attendanceDate || "").slice(0, 10);
      if (!day) continue;
      statusByDate.set(day, String(r.status || "").toLowerCase());
    }

    const leaveDates = new Set<string>();
    const leaveDatesPadded = new Set<string>();
    for (const req of leaveRequests) {
      if (!matchesEmployee(req, hrId, emp)) continue;
      for (const day of leaveDatesInCycle(req, cycle)) leaveDates.add(day);
      for (const day of leaveDatesInRange(req, pad.start, pad.end)) leaveDatesPadded.add(day);
    }

    // Infer unmarked working days as absent (within cycle / as-of), and mark offs.
    for (const day of eachDay(pad.start, pad.end)) {
      if (statusByDate.has(day) || leaveDatesPadded.has(day)) continue;
      if (isNonWorking(day)) {
        statusByDate.set(day, holidaySet.has(day) ? "holiday" : "week_off");
        continue;
      }
      if (day >= cycle.start && day <= cycle.end && day <= asOf) {
        statusByDate.set(day, "absent");
      }
    }
    for (const day of leaveDatesPadded) {
      if (!statusByDate.has(day) || statusByDate.get(day) === "absent") {
        statusByDate.set(day, "leave");
      }
    }

    let presentDays = 0;
    let halfDays = 0;
    let absentDays = 0;
    let leaveFromAtt = 0;
    let holidays = 0;
    let weeklyOff = 0;

    for (const day of eachDay(cycle.start, cycle.end)) {
      const st = statusByDate.get(day) || "";
      const w = presentWeight(st);
      if (w >= 1) presentDays += 1;
      else if (w > 0) halfDays += 1;
      else if (st === "absent") absentDays += 1;
      else if (st === "leave") leaveFromAtt += 1;
      else if (st === "holiday") holidays += 1;
      else if (st === "weekend" || st === "week_off") weeklyOff += 1;
    }

    let sandwichLop = 0;
    if (sandwich.enabled) {
      const sandwiched = sandwichOffDates({
        start: pad.start,
        end: pad.end,
        isNonWorking,
        attendanceStatusByDate: statusByDate,
        approvedLeaveDates: leaveDatesPadded,
        asOf,
        trigger: sandwich.triggers,
      });
      for (const day of sandwiched) {
        if (day < cycle.start || day > cycle.end) continue;
        sandwichLop += 1;
        // Convert display: off → LOP bucket (still show original weeklyOff calendar count).
        const st = statusByDate.get(day);
        if (st === "week_off" || st === "weekend" || st === "holiday") {
          statusByDate.set(day, "absent");
        }
      }
      if (sandwich.offBecomes === "leave") {
        leaveFromAtt += sandwichLop;
        sandwichLop = 0;
      }
    }

    const leaveFromRequests =
      leaveByEmployee.get(hrId) ??
      leaveByEmployee.get(emp.employeeId) ??
      leaveByEmployee.get(emp.employeeCode) ??
      0;
    const leaveDays = Math.max(leaveFromAtt, leaveFromRequests);
    const periodDays = SALARY_DAY_BASIS;
    // Cycle can be 28–31 calendar days; salary basis is always 30. Cap LOP so
    // Payable = 30 − LOP never goes negative from a long sandwich month.
    const rawLop = Math.round((absentDays + halfDays * 0.5 + sandwichLop) * 10) / 10;
    const lopDays = Math.min(periodDays, rawLop);
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
