/** Enterprise Leave Management — view models */

export type LeaveSession = "full_day" | "first_half" | "second_half";

export type LeaveApprovalStatus =
  | "draft"
  | "submitted"
  | "manager_review"
  | "hr_review"
  | "director_review"
  | "approved"
  | "rejected"
  | "cancelled"
  | "send_back"
  | "info_requested";

export type LeaveRequestExtension = {
  session: LeaveSession;
  contactDuringLeave: string;
  emergencyContact: string;
  delegateToEmployeeId: string;
  delegateToName: string;
  attachmentName: string;
  approvalStage: LeaveApprovalStatus;
  approvalHistory: LeaveApprovalEvent[];
  comments: string;
  color: string;
};

export type LeaveApprovalEvent = {
  id: string;
  stage: string;
  action: string;
  comment: string;
  actor: string;
  at: string;
};

export type LeaveRequestRecord = {
  id: string;
  documentNumber: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  departmentName: string;
  branchId: string;
  leaveTypeId: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  fromDate: string;
  toDate: string;
  totalDays: number;
  appliedOn: string;
  status: string;
  approverName: string;
  reason: string;
  version: number;
  extension: LeaveRequestExtension;
};

export type LeaveBalanceRecord = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  leaveTypeId: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  balanceYear: number;
  allocated: number;
  used: number;
  pending: number;
  available: number;
  carryForward: number;
  encashed: number;
  opening: number;
  accrued: number;
  closing: number;
};

export type LeaveTypeRecord = {
  id: string;
  code: string;
  name: string;
  isPaid: boolean;
  maxDays: number;
  /** Monthly leave credit (API: monthly_credit_days). */
  daysPerMonth: number;
  requiresAttachment: boolean;
  status: string;
  version: number;
  color: string;
  carryForwardAllowed: boolean;
  approvalRequired: boolean;
  genderRestriction: string;
  eligibility: string;
  maxCarryForwardDays?: number;
};

export type CompOffRecord = {
  id: string;
  employeeId: string;
  employeeName: string;
  earnedDate: string;
  days: number;
  expiryDate: string;
  status: "pending" | "approved" | "used" | "expired";
  reason: string;
};

export type EncashmentRecord = {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveTypeId: string;
  leaveTypeName: string;
  requestedDays: number;
  approvedDays: number;
  amount: number;
  status: "pending" | "approved" | "rejected" | "paid";
  createdAt: string;
};

export type CarryForwardRecord = {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveTypeName: string;
  unusedDays: number;
  carriedDays: number;
  maxAllowed: number;
  expiryDate: string;
  year: number;
};

export type LeaveAuditEntry = {
  id: string;
  requestId: string;
  action: string;
  detail: string;
  actor: string;
  at: string;
};

export type LeaveFilters = {
  branchId: string;
  departmentId: string;
  leaveTypeId: string;
  status: string;
  managerId: string;
  dateFrom: string;
  dateTo: string;
  employmentType: string;
};

export type ApplyLeavePayload = {
  branchId: string;
  employeeId: string;
  leaveTypeId: string;
  fromDate: string;
  toDate: string;
  session: LeaveSession;
  reason: string;
  contactDuringLeave: string;
  emergencyContact: string;
  delegateToEmployeeId: string;
  attachmentName: string;
};

export type LeaveValidationResult = {
  ok: boolean;
  messages: { tone: "error" | "warn" | "info"; text: string }[];
  netDays: number;
};

export const LEAVE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  manager_review: "Reporting manager review",
  manager_approved: "Reporting manager approved",
  hr_review: "HR review",
  director_review: "Director review",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
  send_back: "Sent back",
  info_requested: "Info requested",
};

export const DEFAULT_LEAVE_COLORS: Record<string, string> = {
  AL: "#059669",
  CL: "#0ea5e9",
  SL: "#f59e0b",
  CO: "#8b5cf6",
  ML: "#ec4899",
  PL: "#6366f1",
  MR: "#14b8a6",
  BL: "#64748b",
};

export function emptyLeaveFilters(): LeaveFilters {
  const today = new Date().toISOString().slice(0, 10);
  const start = new Date();
  start.setMonth(start.getMonth() - 1);
  return {
    branchId: "",
    departmentId: "",
    leaveTypeId: "",
    status: "",
    managerId: "",
    dateFrom: start.toISOString().slice(0, 10),
    dateTo: today,
    employmentType: "",
  };
}

export function defaultRequestExtension(): LeaveRequestExtension {
  return {
    session: "full_day",
    contactDuringLeave: "",
    emergencyContact: "",
    delegateToEmployeeId: "",
    delegateToName: "",
    attachmentName: "",
    approvalStage: "submitted",
    approvalHistory: [],
    comments: "",
    color: "#059669",
  };
}
