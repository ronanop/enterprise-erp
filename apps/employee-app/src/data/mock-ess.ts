import type {
  ApiResponse,
  EssAttendance,
  EssLeaveBalance,
  EssLeaveRequest,
  EssLeaveType,
  EssMe,
  EssPayslip,
  EssPunch,
  TokenData,
  UserProfile,
} from "@/types/api";
import { hoursBetween, todayLocalDate } from "@/utils/datetime";

function ok<T>(data: T, message = "OK"): ApiResponse<T> {
  return { success: true, message, data };
}

function padDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return padDate(d);
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return padDate(d);
}

function isoTodayAt(hour: number, minute = 0): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

const LEAVE_CASUAL = "lt-casual-001";
const LEAVE_SICK = "lt-sick-002";
const LEAVE_EARNED = "lt-earned-003";

export const MOCK_DEMO_EMAIL = "demo@company.com";
export const MOCK_DEMO_PASSWORD = "demo123";

export const mockMe: EssMe = {
  employee_id: "emp-demo-001",
  company_id: "co-demo-001",
  branch_id: "br-demo-001",
  department_id: "dept-demo-001",
  employee_code: "EMP-1042",
  first_name: "Riya",
  last_name: "Sharma",
  email: MOCK_DEMO_EMAIL,
  mobile: "+91 98765 43210",
  designation: "Software Engineer",
  date_of_joining: "2023-04-10",
  status: "active",
  display_name: "Riya Sharma",
};

export const mockLeaveTypes: EssLeaveType[] = [
  {
    id: LEAVE_CASUAL,
    leave_type_code: "CL",
    leave_type_name: "Casual Leave",
    is_paid: true,
    max_days_per_year: 12,
    monthly_credit_days: 1,
    status: "active",
  },
  {
    id: LEAVE_SICK,
    leave_type_code: "SL",
    leave_type_name: "Sick Leave",
    is_paid: true,
    max_days_per_year: 10,
    monthly_credit_days: 1,
    status: "active",
  },
  {
    id: LEAVE_EARNED,
    leave_type_code: "EL",
    leave_type_name: "Earned Leave",
    is_paid: true,
    max_days_per_year: 18,
    monthly_credit_days: 1.5,
    status: "active",
  },
];

export const mockLeaveBalances: EssLeaveBalance[] = [
  {
    id: "lb-1",
    leave_type_id: LEAVE_CASUAL,
    balance_year: new Date().getFullYear(),
    opening_balance: 12,
    accrued: 0,
    used: 3,
    closing_balance: 9,
    status: "active",
  },
  {
    id: "lb-2",
    leave_type_id: LEAVE_SICK,
    balance_year: new Date().getFullYear(),
    opening_balance: 10,
    accrued: 0,
    used: 1,
    closing_balance: 9,
    status: "active",
  },
  {
    id: "lb-3",
    leave_type_id: LEAVE_EARNED,
    balance_year: new Date().getFullYear(),
    opening_balance: 15,
    accrued: 1.5,
    used: 2,
    closing_balance: 14.5,
    status: "active",
  },
];

function initialLeaveRequests(): EssLeaveRequest[] {
  return [
    {
      id: "lr-1",
      document_number: "LVE-2026-014",
      leave_type_id: LEAVE_CASUAL,
      start_date: daysAgo(12),
      end_date: daysAgo(12),
      days_count: 1,
      reason: "Personal work",
      status: "approved",
    },
    {
      id: "lr-2",
      document_number: "LVE-2026-021",
      leave_type_id: LEAVE_SICK,
      start_date: daysAgo(5),
      end_date: daysAgo(4),
      days_count: 2,
      reason: "Fever",
      status: "approved",
    },
    {
      id: "lr-3",
      document_number: "LVE-2026-028",
      leave_type_id: LEAVE_CASUAL,
      start_date: daysFromNow(3),
      end_date: daysFromNow(3),
      days_count: 1,
      reason: "Family function",
      status: "submitted",
    },
    {
      id: "lr-4",
      document_number: "LVE-2026-009",
      leave_type_id: LEAVE_EARNED,
      start_date: daysAgo(28),
      end_date: daysAgo(26),
      days_count: 3,
      reason: "Travel plans conflicted with sprint",
      status: "rejected",
    },
  ];
}

function buildPastAttendance(): EssAttendance[] {
  const rows: EssAttendance[] = [];
  for (let i = 1; i <= 7; i++) {
    const date = daysAgo(i);
    if (i === 3) {
      rows.push({
        id: `att-past-${i}`,
        attendance_date: date,
        check_in_at: null,
        check_out_at: null,
        total_hours: null,
        attendance_status: "absent",
        source: "manual",
        status: "recorded",
      });
      continue;
    }
    const checkIn = new Date(`${date}T10:00:00`);
    const checkOut = new Date(`${date}T18:30:00`);
    rows.push({
      id: `att-past-${i}`,
      attendance_date: date,
      check_in_at: checkIn.toISOString(),
      check_out_at: checkOut.toISOString(),
      total_hours: 8.5,
      attendance_status: "present",
      source: i % 2 === 0 ? "mobile" : "biometric",
      status: "recorded",
    });
  }
  return rows;
}

/**
 * Today starts checked-in at 10:00 AM local — easy demo:
 * if now is 3:00 PM, total time shows 5:00 hours.
 */
function buildTodayAttendance(): EssAttendance {
  return {
    id: "att-today",
    attendance_date: todayLocalDate(),
    check_in_at: isoTodayAt(10, 0),
    check_out_at: null,
    total_hours: null,
    attendance_status: "present",
    source: "mobile",
    status: "recorded",
  };
}

let mockLeaveRequests = initialLeaveRequests();
let mockAttendance: EssAttendance[] = [
  buildTodayAttendance(),
  ...buildPastAttendance(),
];

export const mockPayslips: EssPayslip[] = [
  {
    id: "ps-2026-06",
    document_number: "PAY-2026-06-1042",
    employee_code: "EMP-1042",
    employee_name: "Riya Sharma",
    payroll_period_id: "pp-2026-06",
    gross_salary: 75000,
    total_deductions: 12500,
    net_salary: 62500,
    issued_at: new Date(
      new Date().getFullYear(),
      new Date().getMonth() - 1,
      28,
    ).toISOString(),
    delivery_status: "delivered",
    payment_status: "paid",
    status: "issued",
    payslip_json: {
      earnings: { basic: 40000, hra: 16000, special: 19000 },
      deductions: { pf: 4800, tax: 6200, other: 1500 },
    },
    company_id: "co-demo-001",
    branch_id: "br-demo-001",
  },
  {
    id: "ps-2026-05",
    document_number: "PAY-2026-05-1042",
    employee_code: "EMP-1042",
    employee_name: "Riya Sharma",
    payroll_period_id: "pp-2026-05",
    gross_salary: 75000,
    total_deductions: 11800,
    net_salary: 63200,
    issued_at: new Date(
      new Date().getFullYear(),
      new Date().getMonth() - 2,
      28,
    ).toISOString(),
    delivery_status: "delivered",
    payment_status: "paid",
    status: "issued",
    company_id: "co-demo-001",
    branch_id: "br-demo-001",
  },
  {
    id: "ps-2026-04",
    document_number: "PAY-2026-04-1042",
    employee_code: "EMP-1042",
    employee_name: "Riya Sharma",
    payroll_period_id: "pp-2026-04",
    gross_salary: 72000,
    total_deductions: 11000,
    net_salary: 61000,
    issued_at: new Date(
      new Date().getFullYear(),
      new Date().getMonth() - 3,
      28,
    ).toISOString(),
    delivery_status: "delivered",
    payment_status: "paid",
    status: "issued",
    company_id: "co-demo-001",
    branch_id: "br-demo-001",
  },
];

export const mockAuthProfile: UserProfile = {
  user: {
    id: "user-demo-001",
    tenant_id: "tenant-demo-001",
    email: MOCK_DEMO_EMAIL,
    display_name: "Riya Sharma",
    user_type: "employee",
    status: "active",
    mfa_enabled: false,
    role_ids: ["role-employee"],
  },
  permissions: ["ess.read", "ess.punch", "ess.leave"],
};

function delay<T>(data: T, ms = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

export const mockApi = {
  login(email: string, password: string) {
    void password;
    if (!email.trim()) {
      return Promise.reject(new Error("Email is required"));
    }
    const token: TokenData = {
      access_token: "mock-access-token-demo",
      refresh_token: "mock-refresh-token-demo",
      token_type: "bearer",
      session_id: "mock-session-001",
      mfa_required: false,
      mfa_challenge_token: null,
    };
    return delay(ok(token, "Logged in (demo)"));
  },

  meProfile: () => delay(ok(mockAuthProfile)),
  me: () => delay(ok(mockMe)),
  leaveTypes: () => delay(ok(mockLeaveTypes)),
  leaveBalances: () => delay(ok(mockLeaveBalances)),
  leaveRequests: () => delay(ok([...mockLeaveRequests])),

  createLeaveRequest(body: {
    leave_type_id: string;
    start_date: string;
    end_date: string;
    days_count: string | number;
    reason?: string;
  }) {
    const row: EssLeaveRequest = {
      id: `lr-${Date.now()}`,
      document_number: `LVE-DEMO-${String(mockLeaveRequests.length + 1).padStart(3, "0")}`,
      leave_type_id: body.leave_type_id,
      start_date: body.start_date,
      end_date: body.end_date,
      days_count: body.days_count,
      reason: body.reason ?? null,
      status: "submitted",
    };
    mockLeaveRequests = [row, ...mockLeaveRequests];
    return delay(ok(row, "Leave request submitted"));
  },

  attendance() {
    const today = todayLocalDate();
    if (!mockAttendance.some((r) => r.attendance_date === today)) {
      mockAttendance = [buildTodayAttendance(), ...mockAttendance];
    }
    return delay(ok([...mockAttendance]));
  },

  punch() {
    const today = todayLocalDate();
    let row = mockAttendance.find((r) => r.attendance_date === today);
    if (!row) {
      row = {
        ...buildTodayAttendance(),
        check_in_at: null,
        check_out_at: null,
        total_hours: null,
      };
      mockAttendance = [row, ...mockAttendance];
    }

    if (!row.check_in_at) {
      row = {
        ...row,
        check_in_at: new Date().toISOString(),
        check_out_at: null,
        total_hours: null,
        attendance_status: "present",
        source: "mobile",
      };
      mockAttendance = mockAttendance.map((r) =>
        r.attendance_date === today ? row! : r,
      );
      return delay(ok<EssPunch>({ action: "check_in", attendance: row }));
    }

    if (row.check_out_at) {
      return Promise.reject(new Error("Already checked out for today"));
    }

    const now = new Date();
    const total = hoursBetween(row.check_in_at, now.getTime());
    row = {
      ...row,
      check_out_at: now.toISOString(),
      total_hours: total,
    };
    mockAttendance = mockAttendance.map((r) =>
      r.attendance_date === today ? row! : r,
    );
    return delay(ok<EssPunch>({ action: "check_out", attendance: row }));
  },

  payslips: () => delay(ok(mockPayslips)),

  payslip(id: string) {
    const row = mockPayslips.find((p) => p.id === id);
    if (!row) return Promise.reject(new Error("Payslip not found"));
    return delay(ok(row));
  },

  logout: () => delay(ok(null, "Signed out")),
};

export function resetMockStore() {
  mockLeaveRequests = initialLeaveRequests();
  mockAttendance = [buildTodayAttendance(), ...buildPastAttendance()];
}
