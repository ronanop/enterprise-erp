/** Enterprise Attendance Management — view models */

export type AttendanceStatusCode =
  | "present"
  | "absent"
  | "half_day"
  | "leave"
  | "work_from_home"
  | "holiday"
  | "weekend"
  | "late"
  | "early_exit"
  | "missed_punch";

export type AttendanceSource =
  | "manual"
  | "biometric"
  | "mobile"
  | "web"
  | "qr"
  | "face_recognition"
  | "device";

export type ApprovalStatus = "none" | "pending" | "manager_approved" | "hr_approved" | "approved" | "rejected";

export type AttendanceExtension = {
  displayStatus: AttendanceStatusCode;
  breakStart: string;
  breakEnd: string;
  breakMinutes: number;
  location: string;
  device: string;
  gpsCoordinates: string;
  sourceDetail: AttendanceSource;
  approvalStatus: ApprovalStatus;
  overtimeNormal: number;
  overtimeDouble: number;
  isLate: boolean;
  isEarlyExit: boolean;
  missedPunch: boolean;
  departmentName: string;
  departmentId: string;
  designationName: string;
  employeeCode: string;
  employeeName: string;
  shiftName: string;
  managerName: string;
};

export type AttendanceRecord = {
  id: string;
  employeeId: string;
  branchId: string;
  shiftId: string;
  attendanceDate: string;
  checkIn: string;
  checkOut: string;
  workingHours: number;
  breakTime: number;
  overtimeHours: number;
  status: AttendanceStatusCode;
  apiStatus: string;
  location: string;
  device: string;
  source: string;
  approvalStatus: ApprovalStatus;
  recordStatus: string;
  version: number;
  notes: string;
  extension: AttendanceExtension;
};

export type AttendanceFilters = {
  branchId: string;
  departmentId: string;
  designation: string;
  shiftId: string;
  status: string;
  dateFrom: string;
  dateTo: string;
  managerId: string;
  employeeId: string;
  location: string;
};

export type AttendanceCorrection = {
  id: string;
  attendanceId: string;
  employeeId: string;
  date: string;
  field: "check_in" | "check_out";
  oldTime: string;
  newTime: string;
  reason: string;
  attachmentName: string;
  workflowStage: "employee" | "manager" | "hr" | "approved" | "rejected";
  createdBy: string;
  createdAt: string;
};

export type AttendanceAuditEntry = {
  id: string;
  attendanceId: string;
  action: string;
  detail: string;
  actor: string;
  at: string;
};

export type MarkAttendancePayload = {
  branchId: string;
  employeeId: string;
  attendanceDate: string;
  shiftId: string;
  checkIn: string;
  checkOut: string;
  breakStart: string;
  breakEnd: string;
  status: AttendanceStatusCode;
  location: string;
  source: AttendanceSource;
  gpsCoordinates: string;
  notes: string;
};

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatusCode, string> = {
  present: "Present",
  absent: "Absent",
  half_day: "Half day",
  leave: "Leave",
  work_from_home: "Work from home",
  holiday: "Holiday",
  weekend: "Week off",
  late: "Late",
  early_exit: "Early exit",
  missed_punch: "Missed punch",
};

export const CALENDAR_CODES: Record<AttendanceStatusCode, string> = {
  present: "P",
  absent: "A",
  half_day: "H",
  leave: "L",
  work_from_home: "WFH",
  holiday: "HOL",
  weekend: "WO",
  late: "Late",
  early_exit: "EE",
  missed_punch: "MP",
};

export function emptyAttendanceFilters(today: string): AttendanceFilters {
  return {
    branchId: "",
    departmentId: "",
    designation: "",
    shiftId: "",
    status: "",
    dateFrom: today,
    dateTo: today,
    managerId: "",
    employeeId: "",
    location: "",
  };
}
