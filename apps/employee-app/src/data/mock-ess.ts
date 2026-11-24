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
export const MOCK_DEMO_COMPANY = "CT";
export const MOCK_DEMO_EMPLOYEE_CODE = "CT5354";
export const MOCK_DEMO_PASSWORD = "CT535415102003";
export const MOCK_DEMO_MOBILE = "9876543210";

/** Live API one-click demos (seeded by scripts.seed_ess_cdpl_demo). */
export const LIVE_DEMO_COMPANY = "CDPL";
export const LIVE_DEMO_PASSWORD = "Secure1!";
export const LIVE_DEMO_EMPLOYEE = {
  mobile: "9000000002",
  employee_code: "ESSEMP01",
  password: LIVE_DEMO_PASSWORD,
  role: "employee" as const,
};
export const LIVE_DEMO_MANAGER = {
  mobile: "9000000001",
  employee_code: "ESSMGR01",
  password: LIVE_DEMO_PASSWORD,
  role: "manager" as const,
};

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
  department_name: "Product & Design",
  manager_name: "Team Lead",
  date_of_birth: "1994-06-12",
  gender: "female",
  nationality: "Indian",
  blood_group: "B+",
  marital_status: "single",
  current_address: "12 MG Road, Bengaluru, KA 560001",
  permanent_address: "12 MG Road, Bengaluru, KA 560001",
  ess_role: "employee",
  is_manager: false,
  can_approve_team_leave: false,
  pending_approvals_count: 0,
  role_codes: ["HR_EMPLOYEE"],
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
 * Today starts checked-in at 10:00 AM local - easy demo:
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

function mockPeriodIso(monthsAgo: number, day = 28) {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsAgo, day);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

function mockPeriodName(monthsAgo: number) {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsAgo, 1);
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export const mockPayslips: EssPayslip[] = [
  {
    id: "ps-2026-10",
    document_number: "PAY-2026-10-1042",
    employee_code: "EMP-1042",
    employee_name: "Riya Sharma",
    payroll_period_id: "pp-2026-10",
    period_name: mockPeriodName(0),
    period_start: mockPeriodIso(0, 1).slice(0, 10),
    period_end: mockPeriodIso(0, 28).slice(0, 10),
    gross_salary: 67500,
    total_deductions: 5050,
    net_salary: 72450,
    issued_at: mockPeriodIso(0, 28),
    delivery_status: "delivered",
    payment_status: "paid",
    status: "issued",
    earnings: [
      { code: "basic", label: "Basic Salary", amount: 35000 },
      { code: "hra", label: "HRA", amount: 17500 },
      { code: "special", label: "Special Allowance", amount: 10000 },
      { code: "other", label: "Other Allowance", amount: 5000 },
    ],
    deductions: [
      { code: "pf_employee", label: "Provident Fund", amount: 3000 },
      { code: "pt", label: "Professional Tax", amount: 200 },
      { code: "tds", label: "Income Tax", amount: 1850 },
    ],
    attendance_summary: {
      period_days: 30,
      leave_days: 1,
      paid_leave: 1,
      lop_days: 0,
    },
    export_text: [
      "PAYSLIP — October sample",
      "Employee: Riya Sharma (EMP-1042)",
      "Gross: 67500 | Deductions: 5050 | Net: 72450",
      "Earnings: Basic 35000, HRA 17500, Special 10000, Other 5000",
      "Deductions: PF 3000, PT 200, TDS 1850",
    ].join("\n"),
    payslip_json: {
      earnings: [
        { code: "basic", label: "Basic Salary", amount: 35000 },
        { code: "hra", label: "HRA", amount: 17500 },
        { code: "special", label: "Special Allowance", amount: 10000 },
        { code: "other", label: "Other Allowance", amount: 5000 },
      ],
      deductions: [
        { code: "pf_employee", label: "Provident Fund", amount: 3000 },
        { code: "pt", label: "Professional Tax", amount: 200 },
        { code: "tds", label: "Income Tax", amount: 1850 },
      ],
      attendance: { period_days: 30, leave_days: 1, paid_leave: 1, lop_days: 0 },
    },
    company_id: "co-demo-001",
    branch_id: "br-demo-001",
  },
  {
    id: "ps-2026-09",
    document_number: "PAY-2026-09-1042",
    employee_code: "EMP-1042",
    employee_name: "Riya Sharma",
    payroll_period_id: "pp-2026-09",
    period_name: mockPeriodName(1),
    gross_salary: 67500,
    total_deductions: 5050,
    net_salary: 72450,
    issued_at: mockPeriodIso(1, 28),
    delivery_status: "delivered",
    payment_status: "paid",
    status: "issued",
    earnings: [
      { code: "basic", label: "Basic Salary", amount: 35000 },
      { code: "hra", label: "HRA", amount: 17500 },
      { code: "special", label: "Special Allowance", amount: 10000 },
      { code: "other", label: "Other Allowance", amount: 5000 },
    ],
    deductions: [
      { code: "pf_employee", label: "Provident Fund", amount: 3000 },
      { code: "pt", label: "Professional Tax", amount: 200 },
      { code: "tds", label: "Income Tax", amount: 1850 },
    ],
    company_id: "co-demo-001",
    branch_id: "br-demo-001",
  },
  {
    id: "ps-2026-08",
    document_number: "PAY-2026-08-1042",
    employee_code: "EMP-1042",
    employee_name: "Riya Sharma",
    payroll_period_id: "pp-2026-08",
    period_name: mockPeriodName(2),
    gross_salary: 65500,
    total_deductions: 4880,
    net_salary: 70120,
    issued_at: mockPeriodIso(2, 28),
    delivery_status: "delivered",
    payment_status: "paid",
    status: "issued",
    earnings: [
      { code: "basic", label: "Basic Salary", amount: 34000 },
      { code: "hra", label: "HRA", amount: 17000 },
      { code: "special", label: "Special Allowance", amount: 9500 },
      { code: "other", label: "Other Allowance", amount: 5000 },
    ],
    deductions: [
      { code: "pf_employee", label: "Provident Fund", amount: 2880 },
      { code: "pt", label: "Professional Tax", amount: 200 },
      { code: "tds", label: "Income Tax", amount: 1800 },
    ],
    company_id: "co-demo-001",
    branch_id: "br-demo-001",
  },
  {
    id: "ps-2026-07",
    document_number: "PAY-2026-07-1042",
    employee_code: "EMP-1042",
    employee_name: "Riya Sharma",
    payroll_period_id: "pp-2026-07",
    period_name: mockPeriodName(3),
    gross_salary: 65500,
    total_deductions: 4880,
    net_salary: 70120,
    issued_at: mockPeriodIso(3, 28),
    delivery_status: "delivered",
    payment_status: "paid",
    status: "issued",
    earnings: [
      { code: "basic", label: "Basic Salary", amount: 34000 },
      { code: "hra", label: "HRA", amount: 17000 },
      { code: "special", label: "Special Allowance", amount: 9500 },
      { code: "other", label: "Other Allowance", amount: 5000 },
    ],
    deductions: [
      { code: "pf_employee", label: "Provident Fund", amount: 2880 },
      { code: "pt", label: "Professional Tax", amount: 200 },
      { code: "tds", label: "Income Tax", amount: 1800 },
    ],
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

  essCompanies() {
    return delay(
      ok([
        {
          company_code: "CDPL",
          company_name: "Cache Digitech Private Limited",
          legal_name: "Cache Digitech Pvt. Ltd.",
        },
        {
          company_code: "CT",
          company_name: "Cache Technologies & Infotech",
          legal_name: "Cache Technologies & Infotech",
        },
      ]),
    );
  },

  essCaptcha() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 5; i += 1) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return delay(
      ok({
        captcha_id: `mock-captcha-${Date.now()}`,
        question: "Please type the below code",
        code,
        enabled: true,
      }),
    );
  },

  lookupEssPhone(body: { company_code: string; mobile: string }) {
    if (!body.company_code.trim()) {
      return Promise.reject(new Error("Company code is required"));
    }
    const digits = body.mobile.replace(/\D/g, "").slice(-10);
    const expected = MOCK_DEMO_MOBILE.replace(/\D/g, "").slice(-10);
    if (digits !== expected) {
      return Promise.reject(new Error("Phone number not found for this company"));
    }
    const name =
      body.company_code.trim().toUpperCase() === "CT"
        ? "Cache Technologies & Infotech"
        : "Cache Digitech Private Limited";
    return delay(
      ok({
        identified: true,
        company_code: body.company_code.trim().toUpperCase(),
        company_name: name,
        mobile_masked: `******${digits.slice(-4)}`,
      }),
    );
  },

  verifyEssPhone(body: {
    company_code: string;
    mobile: string;
    captcha_id: string;
    captcha_answer: string;
  }) {
    if (!body.company_code.trim()) {
      return Promise.reject(new Error("Company code is required"));
    }
    if (!body.captcha_id.trim() || !body.captcha_answer.trim()) {
      return Promise.reject(new Error("CAPTCHA verification failed"));
    }
    const digits = body.mobile.replace(/\D/g, "").slice(-10);
    const expected = MOCK_DEMO_MOBILE.replace(/\D/g, "").slice(-10);
    if (digits !== expected) {
      return Promise.reject(new Error("Phone number not found for this company"));
    }
    const name =
      body.company_code.trim().toUpperCase() === "CT"
        ? "Cache Technologies & Infotech"
        : "Cache Digitech Private Limited";
    return delay(
      ok({
        verified: true,
        company_code: body.company_code.trim().toUpperCase(),
        company_name: name,
        mobile_masked: `******${digits.slice(-4)}`,
      }),
    );
  },

  essLogin(companyCode: string, employeeCode: string, password: string) {
    void password;
    if (!companyCode.trim()) {
      return Promise.reject(new Error("Company code is required"));
    }
    if (!employeeCode.trim()) {
      return Promise.reject(new Error("Employee code is required"));
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
