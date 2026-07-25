/** Enterprise Shift & Roster — view models */

export type ShiftTypeCode =
  | "general"
  | "morning"
  | "evening"
  | "night"
  | "flexible"
  | "split"
  | "rotational";

export type AssignmentType = "permanent" | "temporary" | "rotation";

export type RotationCycle = "weekly" | "bi_weekly" | "monthly";

export type WeeklyOffRule =
  | "sunday"
  | "alternate_saturday"
  | "second_saturday"
  | "rotating"
  | "custom";

export type ShiftExtension = {
  description: string;
  breakStart: string;
  breakEnd: string;
  graceOutMinutes: number;
  minWorkingHours: number;
  maxWorkingHours: number;
  lateAfterMinutes: number;
  earlyExitBeforeMinutes: number;
  overtimeAllowed: boolean;
  autoAttendance: boolean;
  color: string;
  weeklyOffRule: WeeklyOffRule;
};

export type ShiftRecord = {
  id: string;
  shiftCode: string;
  shiftName: string;
  shiftType: ShiftTypeCode;
  startTime: string;
  endTime: string;
  graceMinutes: number;
  breakMinutes: number;
  isOvernight: boolean;
  status: string;
  version: number;
  branchId: string;
  extension: ShiftExtension;
};

export type ShiftAssignmentRecord = {
  id: string;
  documentNumber: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  departmentName: string;
  branchId: string;
  branchName: string;
  shiftId: string;
  shiftName: string;
  shiftColor: string;
  effectiveFrom: string;
  effectiveTo: string;
  assignmentType: AssignmentType;
  notes: string;
  status: string;
  version: number;
};

export type ShiftRotation = {
  id: string;
  name: string;
  code: string;
  cycle: RotationCycle;
  sequence: string[];
  employeeIds: string[];
  effectiveFrom: string;
  status: string;
};

export type ShiftSwapRequest = {
  id: string;
  employeeId: string;
  employeeName: string;
  currentShiftId: string;
  requestedShiftId: string;
  swapWithEmployeeId: string;
  reason: string;
  workflowStage: "pending" | "manager" | "approved" | "rejected";
  createdAt: string;
};

export type RosterCell = {
  date: string;
  employeeId: string;
  shiftId: string;
  shiftName: string;
  color: string;
  isWeeklyOff: boolean;
  isHoliday: boolean;
};

export type ShiftAuditEntry = {
  id: string;
  action: string;
  detail: string;
  actor: string;
  at: string;
};

export type ShiftFilters = {
  branchId: string;
  departmentId: string;
  shiftType: string;
  status: string;
  assignmentType: string;
};

export type CreateShiftPayload = {
  shiftCode: string;
  shiftName: string;
  shiftType: ShiftTypeCode;
  startTime: string;
  endTime: string;
  graceMinutes: number;
  breakMinutes: number;
  isOvernight: boolean;
  extension: ShiftExtension;
  branchId?: string;
};

export type AssignShiftPayload = {
  branchId: string;
  employeeId: string;
  shiftId: string;
  effectiveFrom: string;
  effectiveTo: string;
  assignmentType: AssignmentType;
  notes: string;
};

export const SHIFT_TYPE_LABELS: Record<ShiftTypeCode, string> = {
  general: "General",
  morning: "Morning",
  evening: "Evening",
  night: "Night",
  flexible: "Flexible",
  split: "Split",
  rotational: "Rotational",
};

export const DEFAULT_SHIFT_EXTENSION: ShiftExtension = {
  description: "",
  breakStart: "",
  breakEnd: "",
  graceOutMinutes: 0,
  minWorkingHours: 8,
  maxWorkingHours: 12,
  lateAfterMinutes: 15,
  earlyExitBeforeMinutes: 15,
  overtimeAllowed: true,
  autoAttendance: false,
  color: "#059669",
  weeklyOffRule: "sunday",
};

export function emptyShiftFilters(): ShiftFilters {
  return {
    branchId: "",
    departmentId: "",
    shiftType: "",
    status: "",
    assignmentType: "",
  };
}
