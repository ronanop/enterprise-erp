import { describe, expect, it } from "vitest";

import { summarizePayrollAttendance } from "@/lib/payroll-attendance-cycle";
import type { AttendanceRecord } from "@/types/attendance-management";
import type { PayrollCycle } from "@/lib/payroll-cycle";

const cycle: PayrollCycle = {
  anchorMonth: "2026-06",
  start: "2026-06-20",
  end: "2026-06-26",
  cutoverDay: 20,
  label: "20 Jun 2026 – 26 Jun 2026",
  workingDays: 30,
};

const emp = {
  employeeId: "e1",
  employeeName: "Anil Kumar",
  employeeCode: "CT5354",
  department: "Technical",
};

function punch(date: string, status: AttendanceRecord["status"]): AttendanceRecord {
  return {
    id: date,
    employeeId: "e1",
    branchId: "",
    shiftId: "",
    attendanceDate: date,
    checkIn: "",
    checkOut: "",
    workingHours: 0,
    breakTime: 0,
    overtimeHours: 0,
    status,
    apiStatus: status,
    location: "",
    device: "",
    source: "",
    approvalStatus: "approved",
    recordStatus: "active",
    version: 1,
    notes: "",
    extension: {
      employeeName: "Anil Kumar",
      employeeCode: "CT5354",
      departmentName: "Technical",
      departmentId: "",
      designationName: "",
      managerName: "",
    },
  } as AttendanceRecord;
}

describe("summarizePayrollAttendance", () => {
  it("counts Sunday-only weekly off and unmarked weekdays as LOP through as-of date", () => {
    const [row] = summarizePayrollAttendance(
      cycle,
      [emp],
      [punch("2026-06-22", "present")],
      [],
      {
        weeklyOffRules: ["sunday"],
        holidayDates: ["2026-06-24"],
        asOfDate: "2026-06-26",
      },
    );
    expect(row.presentDays).toBe(1);
    expect(row.holidays).toBe(1);
    expect(row.weeklyOff).toBe(1);
    expect(row.absentDays).toBe(4);
    expect(row.lopDays).toBe(4);
    expect(row.payableDays).toBe(26);
    expect(row.periodDays).toBe(30);
  });

  it("does not treat unmarked working days after as-of as loss of pay", () => {
    const [row] = summarizePayrollAttendance(
      cycle,
      [emp],
      [punch("2026-06-22", "present")],
      [],
      {
        weeklyOffRules: ["sunday"],
        asOfDate: "2026-06-22",
      },
    );
    expect(row.presentDays).toBe(1);
    expect(row.absentDays).toBe(1);
    expect(row.weeklyOff).toBe(1);
    expect(row.lopDays).toBe(1);
    expect(row.payableDays).toBe(29);
  });
});
