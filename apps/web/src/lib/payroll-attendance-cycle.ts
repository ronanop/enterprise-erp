import type { AttendanceRecord, AttendanceStatusCode } from "@/types/attendance-management";
import type { LeaveRequestRecord } from "@/types/leave-management";
import type { PayrollEmployeeAttendance } from "@/types/payroll-management";
import type { PayrollCycle } from "@/lib/payroll-cycle";

export type PayrollAttendanceEmployeeRef = {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  /** HR UUID when known — used to match attendance rows */
  hrEmployeeId?: string;
};

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

function leaveDaysInCycle(req: LeaveRequestRecord, cycle: PayrollCycle): number {
  if (!["approved", "manager_approved", "hr_approved"].includes(req.status)) return 0;
  const overlapStart = req.fromDate > cycle.start ? req.fromDate : cycle.start;
  const overlapEnd = req.toDate < cycle.end ? req.toDate : cycle.end;
  if (overlapStart > overlapEnd) return 0;
  return eachDay(overlapStart, overlapEnd).length;
}

function presentWeight(status: AttendanceStatusCode): number {
  switch (status) {
    case "present":
    case "late":
    case "work_from_home":
    case "early_exit":
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

export function summarizePayrollAttendance(
  cycle: PayrollCycle,
  employees: PayrollAttendanceEmployeeRef[],
  attendance: AttendanceRecord[],
  leaveRequests: LeaveRequestRecord[],
): PayrollEmployeeAttendance[] {
  const attByEmployee = new Map<string, AttendanceRecord[]>();
  for (const r of attendance) {
    if (!inCycle(r.attendanceDate, cycle)) continue;
    const list = attByEmployee.get(r.employeeId) ?? [];
    list.push(r);
    attByEmployee.set(r.employeeId, list);
  }

  const leaveByEmployee = new Map<string, number>();
  for (const req of leaveRequests) {
    const days = leaveDaysInCycle(req, cycle);
    if (days <= 0) continue;
    leaveByEmployee.set(req.employeeId, (leaveByEmployee.get(req.employeeId) ?? 0) + days);
  }

  return employees.map((emp) => {
    const hrId = resolveHrId(emp);
    const rows =
      attByEmployee.get(hrId) ??
      attByEmployee.get(emp.employeeId) ??
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
      else if (r.status === "weekend") weeklyOff += 1;
    }

    const leaveFromRequests =
      leaveByEmployee.get(hrId) ??
      leaveByEmployee.get(emp.employeeId) ??
      0;
    const leaveDays = Math.max(leaveFromAtt, leaveFromRequests);

    const presentWeighted = presentDays + halfDays * 0.5;
    const workingDaysInCycle = cycle.workingDays;
    const payableDays = Math.min(
      workingDaysInCycle,
      Math.round((presentWeighted + leaveDays) * 10) / 10,
    );
    const attendanceFactor =
      workingDaysInCycle > 0
        ? Math.min(1, Math.max(0, payableDays / workingDaysInCycle))
        : 1;

    return {
      employeeId: emp.employeeId,
      employeeCode: emp.employeeCode,
      employeeName: emp.employeeName,
      department: emp.department,
      presentDays: Math.round(presentWeighted * 10) / 10,
      leaveDays,
      absentDays,
      halfDays,
      holidays,
      weeklyOff,
      payableDays,
      workingDaysInCycle,
      attendanceFactor: Math.round(attendanceFactor * 1000) / 1000,
    };
  });
}
