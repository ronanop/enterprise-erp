import type {
  ApiResponse,
  EssAnnouncement,
  EssApprovalItem,
  EssAsset,
  EssAssetDetail,
  EssAttendance,
  EssAttendanceSummary,
  EssBank,
  EssDocument,
  EssEducationSkills,
  EssEmergencyContact,
  EssFaceStatus,
  EssHolidayCalendar,
  EssKyc,
  EssLeaveBalance,
  EssLeaveRequest,
  EssLeaveType,
  EssMe,
  EssMeetingBooking,
  EssMeetingRoom,
  EssMeetingRoomAvailability,
  EssNotification,
  EssPayslip,
  EssPolicyItem,
  EssPolicyWalkthrough,
  EssPunch,
  EssPunchPolicy,
  EssSeparationItem,
  EssSupportTicket,
  EssSupportTicketComment,
  EssSupportTicketDetail,
  EssTeamLeaveItem,
  EssTrainingItem,
  EssPerformanceItem,
  EssWfhRequest,
  TokenData,
  UserProfile,
} from "@/types/api";
import { hoursBetween, todayLocalDate } from "@/utils/datetime";

function ok<T>(data: T, message = "OK"): ApiResponse<T> {
  return { success: true, message, data };
}

function delay<T>(data: T, ms = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
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
  ess_role: "manager",
  is_manager: true,
  can_approve_team_leave: true,
  pending_approvals_count: 2,
  role_codes: ["HR_EMPLOYEE", "HR_MANAGER"],
};

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

let mockNotifications: EssNotification[] = [
  {
    id: "n1",
    title: "Leave approved",
    body: "Your casual leave on " + daysAgo(12) + " was approved.",
    kind: "leave",
    read: false,
    created_at: new Date().toISOString(),
    href: "/leave/lr-1",
  },
  {
    id: "n2",
    title: "Payslip ready",
    body: "Your latest payslip is available.",
    kind: "payslip",
    read: false,
    created_at: new Date(Date.now() - 3600_000).toISOString(),
    href: "/payslips",
  },
  {
    id: "n3",
    title: "Approval pending",
    body: "Amit needs leave approval for tomorrow.",
    kind: "approval",
    read: false,
    created_at: new Date(Date.now() - 7200_000).toISOString(),
    href: "/approvals",
  },
  {
    id: "n4",
    title: "Welcome",
    body: "Employee Portal mobile is ready for daily use.",
    kind: "system",
    read: true,
    created_at: new Date(Date.now() - 86_400_000).toISOString(),
  },
];

type OnDutyRow = {
  id: string;
  duty_date: string;
  end_date: string | null;
  portion: string;
  duty_location: string | null;
  purpose: string | null;
  reason: string | null;
  status: string;
};

type CompoffRow = {
  id: string;
  earned_date: string;
  extra_hours: number;
  requested_days: number;
  reason: string | null;
  status: string;
};

type CorrectionRow = {
  id: string;
  attendance_date: string;
  field_name: string;
  new_value: string;
  reason: string | null;
  status: string;
};

let mockWfh: EssWfhRequest[] = [
  {
    id: "wfh-1",
    wfh_date: daysAgo(2),
    end_date: null,
    portion: "full_day",
    reason: "Home internet install",
    status: "approved",
  },
];

let mockOnDuty: OnDutyRow[] = [];
let mockCompoff: CompoffRow[] = [];
let mockCorrections: CorrectionRow[] = [];

let mockApprovals: EssApprovalItem[] = [
  {
    category: "leave",
    id: "team-lr-1",
    employee_id: "emp-demo-002",
    employee_code: "EMP-1101",
    display_name: "Amit Patel",
    title: "Casual Leave",
    detail: `${daysFromNow(1)} → ${daysFromNow(1)} · 1 day(s)`,
    status: "submitted",
    occurred_at: new Date().toISOString(),
  },
  {
    category: "wfh",
    id: "team-wfh-1",
    employee_id: "emp-demo-003",
    employee_code: "EMP-1108",
    display_name: "Neha Gupta",
    title: "Work From Home",
    detail: `${daysFromNow(2)} · full day`,
    status: "submitted",
    occurred_at: new Date(Date.now() - 3600_000).toISOString(),
  },
  {
    category: "attendance_correction",
    id: "team-corr-1",
    employee_id: "emp-demo-002",
    employee_code: "EMP-1101",
    display_name: "Amit Patel",
    title: "Missed checkout",
    detail: `${daysAgo(1)} · check_out → 18:30`,
    status: "submitted",
    occurred_at: new Date(Date.now() - 7200_000).toISOString(),
  },
];

let mockTeamLeave: EssTeamLeaveItem[] = [
  {
    id: "team-lr-1",
    employee_id: "emp-demo-002",
    employee_code: "EMP-1101",
    display_name: "Amit Patel",
    document_number: "LVE-TEAM-001",
    start_date: daysFromNow(1),
    end_date: daysFromNow(1),
    days_count: 1,
    status: "submitted",
  },
  {
    id: "team-lr-2",
    employee_id: "emp-demo-003",
    employee_code: "EMP-1108",
    display_name: "Neha Gupta",
    document_number: "LVE-TEAM-002",
    start_date: daysFromNow(5),
    end_date: daysFromNow(6),
    days_count: 2,
    status: "approved",
  },
];

let mockDocuments: EssDocument[] = [
  {
    id: "d1",
    document_number: "DOC-001",
    document_type: "contract",
    document_name: "Offer Letter 2024",
    storage_uri: "/documents/d1",
    issued_on: "2024-03-02",
    expires_on: null,
    verification_status: "verified",
    status: "active",
  },
  {
    id: "d2",
    document_number: "DOC-002",
    document_type: "id_proof",
    document_name: "Aadhaar Card",
    storage_uri: "/documents/d2",
    issued_on: null,
    expires_on: null,
    verification_status: "verified",
    status: "active",
  },
  {
    id: "d3",
    document_number: "DOC-003",
    document_type: "other",
    document_name: "Form 16 FY24",
    storage_uri: "/documents/d3",
    issued_on: "2024-06-15",
    expires_on: null,
    verification_status: "verified",
    status: "active",
  },
];

const mockAnnouncements: EssAnnouncement[] = [
  {
    id: "an1",
    title: "Office closed Friday afternoon",
    body: "Facilities maintenance from 2 PM. Work from home is allowed.",
    tag: "facilities",
    pinned: true,
    published_on: daysAgo(1),
  },
  {
    id: "an2",
    title: "Health checkup camp",
    body: "Book your slot with HR for the annual health camp next week.",
    tag: "wellness",
    pinned: false,
    published_on: daysAgo(3),
  },
];

const mockAssets: EssAssetDetail[] = [
  {
    id: "a1",
    asset_code: "MBP-2024-X42",
    asset_name: 'MacBook Pro 16"',
    asset_type: "laptop",
    serial_number: "NX.V15AA.001.2429",
    status: "assigned",
    assignment_status: "in_use",
    qr_code: "MBP-2024-X42",
    barcode: "MBP-2024-X42",
  },
  {
    id: "a2",
    asset_code: "MON-2024-D12",
    asset_name: 'Dell UltraSharp 32"',
    asset_type: "monitor",
    serial_number: "CN-0H7K8-742",
    status: "assigned",
    assignment_status: "in_use",
    qr_code: "MON-2024-D12",
    barcode: "MON-2024-D12",
  },
  {
    id: "a3",
    asset_code: "PHN-2024-I09",
    asset_name: "iPhone 15 Pro",
    asset_type: "phone",
    serial_number: "F2LX9QH6N72",
    status: "assigned",
    assignment_status: "in_use",
    qr_code: "PHN-2024-I09",
    barcode: "PHN-2024-I09",
  },
];

const mockRooms: EssMeetingRoom[] = [
  {
    id: "r1",
    room_code: "R1",
    room_name: "Orion",
    capacity: 8,
    equipment_json: ["TV", "Whiteboard"],
    notes: "Floor 3",
    status: "active",
  },
  {
    id: "r2",
    room_code: "R2",
    room_name: "Nebula",
    capacity: 12,
    equipment_json: ["Projector", "VC"],
    notes: "Floor 2",
    status: "active",
  },
];

let mockBookings: EssMeetingBooking[] = [];

let mockTickets: EssSupportTicketDetail[] = [
  {
    id: "tk-1",
    document_number: "HD-0001",
    subject: "VPN not connecting",
    status: "submitted",
    kind: "it",
    urgency: "medium",
    created_at: new Date(Date.now() - 86_400_000).toISOString(),
    asset_id: null,
    description: "Fails after office network change.",
    opened_at: new Date(Date.now() - 86_400_000).toISOString(),
    resolved_at: null,
  },
];

let mockComments: Array<{
  ticketId: string;
  id: string;
  body: string;
  commented_at: string;
  author_employee_id: string | null;
}> = [
  {
    ticketId: "tk-1",
    id: "c1",
    body: "IT is looking into this.",
    commented_at: new Date().toISOString(),
    author_employee_id: null,
  },
];

let mockPolicies: EssPolicyItem[] = [
  {
    id: "pol-1",
    policy_code: "CODE-OF-CONDUCT",
    title: "Code of Conduct",
    policy_version: 1,
    is_mandatory: true,
    acknowledged: false,
    step_count: 3,
  },
  {
    id: "pol-2",
    policy_code: "INFOSEC",
    title: "Information Security",
    policy_version: 2,
    is_mandatory: true,
    acknowledged: true,
    step_count: 3,
  },
];

const mockTraining: EssTrainingItem[] = [
  {
    id: "tr-1",
    training_id: "t-101",
    training_code: "SEC-101",
    training_name: "Information Security Awareness",
    training_type: "mandatory",
    start_date: daysFromNow(7),
    attendance_status: "registered",
    status: "scheduled",
  },
  {
    id: "tr-2",
    training_id: "t-088",
    training_code: "LEAD-220",
    training_name: "People Leadership Basics",
    training_type: "optional",
    start_date: daysAgo(20),
    attendance_status: "attended",
    status: "completed",
  },
];

const mockPerformance: EssPerformanceItem[] = [
  {
    id: "pf-1",
    document_number: "PRF-2025-H2",
    review_cycle: "H2 2025",
    period_start: "2025-07-01",
    period_end: "2025-12-31",
    overall_rating: 4,
    status: "completed",
  },
  {
    id: "pf-2",
    document_number: "PRF-2026-H1",
    review_cycle: "H1 2026",
    period_start: "2026-01-01",
    period_end: "2026-06-30",
    overall_rating: null,
    status: "in_progress",
  },
];

let mockSeparations: EssSeparationItem[] = [];

export const mockPayslips: EssPayslip[] = [
  {
    id: "ps-2026-06",
    document_number: "PAY-2026-06-1042",
    employee_code: "EMP-1042",
    employee_name: "Riya Sharma",
    payroll_period_id: "pp-2026-06",
    period_name: "June 2026",
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
    earnings: [
      { code: "BASIC", label: "Basic", amount: 40000 },
      { code: "HRA", label: "HRA", amount: 16000 },
      { code: "SPECIAL", label: "Special", amount: 19000 },
    ],
    deductions: [
      { code: "PF", label: "PF", amount: 4800 },
      { code: "TAX", label: "Tax", amount: 6200 },
      { code: "OTHER", label: "Other", amount: 1500 },
    ],
  },
  {
    id: "ps-2026-05",
    document_number: "PAY-2026-05-1042",
    employee_code: "EMP-1042",
    employee_name: "Riya Sharma",
    payroll_period_id: "pp-2026-05",
    period_name: "May 2026",
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
  },
  {
    id: "ps-2026-04",
    document_number: "PAY-2026-04-1042",
    employee_code: "EMP-1042",
    employee_name: "Riya Sharma",
    payroll_period_id: "pp-2026-04",
    period_name: "April 2026",
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
  },
];

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

  faceStatus: () =>
    delay(
      ok<EssFaceStatus>({
        enrolled: false,
        enabled: false,
        verification_required: false,
      }),
    ),

  leaveTypes: () => delay(ok(mockLeaveTypes)),
  leaveBalances: () => delay(ok(mockLeaveBalances)),
  leaveRequests: () => delay(ok([...mockLeaveRequests])),

  leaveRequest(id: string) {
    const row = mockLeaveRequests.find((r) => r.id === id);
    if (!row) return Promise.reject(new Error("Leave request not found"));
    return delay(ok(row));
  },

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

  cancelLeaveRequest(id: string) {
    const row = mockLeaveRequests.find((r) => r.id === id);
    if (!row) return Promise.reject(new Error("Leave request not found"));
    const updated = { ...row, status: "cancelled" };
    mockLeaveRequests = mockLeaveRequests.map((r) =>
      r.id === id ? updated : r,
    );
    return delay(ok(updated, "Cancelled"));
  },

  attendance() {
    const today = todayLocalDate();
    if (!mockAttendance.some((r) => r.attendance_date === today)) {
      mockAttendance = [buildTodayAttendance(), ...mockAttendance];
    }
    return delay(ok([...mockAttendance]));
  },

  attendanceSummary(month: string) {
    const present = mockAttendance.filter(
      (r) =>
        r.attendance_date.startsWith(month) &&
        r.attendance_status === "present",
    ).length;
    return delay(
      ok<EssAttendanceSummary>({
        month,
        present_days: present,
        late_days: 1,
        total_overtime_minutes: 45,
        work_from_home_days: 0,
      }),
    );
  },

  punchPolicy: () =>
    delay(
      ok<EssPunchPolicy>({
        geofence_required: false,
        selfie_required: false,
        face_at_punch_required: false,
        face_enrolled: false,
      }),
    ),

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

  holidays: () =>
    delay(
      ok<EssHolidayCalendar[]>([
        {
          id: "mock-cal",
          calendar_code: "IN-NAT",
          calendar_name: "National Holidays",
          calendar_year: new Date().getFullYear(),
          holidays_json: [
            { date: `${new Date().getFullYear()}-01-26`, name: "Republic Day", kind: "national" },
            { date: `${new Date().getFullYear()}-08-15`, name: "Independence Day", kind: "national" },
            { date: `${new Date().getFullYear()}-10-02`, name: "Gandhi Jayanti", kind: "national" },
          ],
          status: "published",
          branch_id: null,
        },
      ]),
    ),

  notifications: () => delay(ok([...mockNotifications])),

  notificationUnreadCount: () =>
    delay(
      ok({
        unread_count: mockNotifications.filter((n) => !n.read).length,
      }),
    ),

  markNotificationRead(id: string) {
    mockNotifications = mockNotifications.map((n) =>
      n.id === id ? { ...n, read: true } : n,
    );
    return delay(ok({ marked: 1 }));
  },

  markAllNotificationsRead() {
    mockNotifications = mockNotifications.map((n) => ({ ...n, read: true }));
    return delay(ok({ marked: mockNotifications.length }));
  },

  registerDeviceToken: () =>
    delay(ok({ id: "mock-token", platform: "ios", is_active: true })),

  changePassword: () => delay(ok({ ok: true })),

  listWfh: () => delay(ok([...mockWfh])),

  createWfh(body: {
    wfh_date: string;
    end_date?: string;
    portion?: string;
    reason?: string;
  }) {
    const row: EssWfhRequest = {
      id: `wfh-${Date.now()}`,
      wfh_date: body.wfh_date,
      end_date: body.end_date ?? null,
      portion: body.portion ?? "full_day",
      reason: body.reason ?? null,
      status: "submitted",
    };
    mockWfh = [row, ...mockWfh];
    return delay(ok(row, "WFH submitted"));
  },

  listOnDuty: () => delay(ok([...mockOnDuty])),

  createOnDuty(body: {
    duty_date: string;
    end_date?: string;
    portion?: string;
    duty_location?: string;
    purpose?: string;
    reason?: string;
  }) {
    const row: OnDutyRow = {
      id: `od-${Date.now()}`,
      duty_date: body.duty_date,
      end_date: body.end_date ?? null,
      portion: body.portion ?? "full_day",
      duty_location: body.duty_location ?? null,
      purpose: body.purpose ?? null,
      reason: body.reason ?? null,
      status: "submitted",
    };
    mockOnDuty = [row, ...mockOnDuty];
    return delay(ok(row, "On Duty submitted"));
  },

  listCompoff: () => delay(ok([...mockCompoff])),

  createCompoff(body: {
    earned_date: string;
    extra_hours: number;
    requested_days?: number;
    reason?: string;
  }) {
    const row: CompoffRow = {
      id: `co-${Date.now()}`,
      earned_date: body.earned_date,
      extra_hours: body.extra_hours,
      requested_days: body.requested_days ?? 1,
      reason: body.reason ?? null,
      status: "submitted",
    };
    mockCompoff = [row, ...mockCompoff];
    return delay(ok(row, "Comp Off submitted"));
  },

  createAttendanceCorrection(body: {
    attendance_date: string;
    field_name: string;
    new_value: string;
    reason?: string;
    attendance_id?: string;
    old_value?: string;
  }) {
    const row: CorrectionRow = {
      id: `corr-${Date.now()}`,
      attendance_date: body.attendance_date,
      field_name: body.field_name,
      new_value: body.new_value,
      reason: body.reason ?? null,
      status: "submitted",
    };
    mockCorrections = [row, ...mockCorrections];
    return delay(ok(row, "Correction submitted"));
  },

  listCorrections: () => delay(ok([...mockCorrections])),

  approvals: () => delay(ok([...mockApprovals])),

  actOnApproval(
    category: EssApprovalItem["category"],
    id: string,
    action: "approve" | "reject",
  ) {
    mockApprovals = mockApprovals.filter(
      (a) => !(a.category === category && a.id === id),
    );
    if (category === "leave") {
      mockTeamLeave = mockTeamLeave.map((r) =>
        r.id === id
          ? { ...r, status: action === "approve" ? "approved" : "rejected" }
          : r,
      );
    }
    return delay(
      ok({ id, status: action === "approve" ? "approved" : "rejected" }),
    );
  },

  teamLeave: () => delay(ok([...mockTeamLeave])),

  managerApproveTeamLeave(id: string) {
    mockTeamLeave = mockTeamLeave.map((r) =>
      r.id === id ? { ...r, status: "approved" } : r,
    );
    mockApprovals = mockApprovals.filter(
      (a) => !(a.category === "leave" && a.id === id),
    );
    return delay(ok(null, "Approved"));
  },

  rejectTeamLeave(id: string) {
    mockTeamLeave = mockTeamLeave.map((r) =>
      r.id === id ? { ...r, status: "rejected" } : r,
    );
    mockApprovals = mockApprovals.filter(
      (a) => !(a.category === "leave" && a.id === id),
    );
    return delay(ok(null, "Rejected"));
  },

  // —— Phase 3 ——
  bank: () =>
    delay(
      ok<EssBank>({
        bank_account_number: "501002458942",
        bank_ifsc: "HDFC0001042",
        bank_name: "HDFC Bank",
        bank_account_holder: "Riya Sharma",
      }),
    ),

  updateBank(body: Partial<EssBank>) {
    return delay(
      ok<EssBank>({
        bank_account_number: body.bank_account_number ?? "501002458942",
        bank_ifsc: body.bank_ifsc ?? "HDFC0001042",
        bank_name: body.bank_name ?? "HDFC Bank",
        bank_account_holder: body.bank_account_holder ?? "Riya Sharma",
      }),
    );
  },

  kyc: () =>
    delay(
      ok<EssKyc>({
        aadhaar_number: "********1234",
        pan_number: "******1A",
        uan_number: "100200300400",
      }),
    ),

  emergency: () =>
    delay(
      ok<EssEmergencyContact>({
        name: "Julian Rivera",
        mobile: "+91 98765 00000",
        blood_group: "B+",
        relationship: "Spouse",
      }),
    ),

  updateEmergency(body: {
    emergency_contact_name?: string;
    emergency_contact_mobile?: string;
  }) {
    return delay(
      ok<EssEmergencyContact>({
        name: body.emergency_contact_name ?? "Julian Rivera",
        mobile: body.emergency_contact_mobile ?? "+91 98765 00000",
        blood_group: "B+",
        relationship: "Spouse",
      }),
    );
  },

  educationSkills: () =>
    delay(
      ok<EssEducationSkills>({
        education: [
          {
            degree: "B.Tech CSE",
            institution: "NIT",
            field_of_study: "Computer Science",
            end_year: 2022,
          },
        ],
        skills: [
          { name: "TypeScript", level: "advanced", years: 3 },
          { name: "React Native", level: "intermediate", years: 1 },
        ],
      }),
    ),

  updateEducationSkills: (body: EssEducationSkills) => delay(ok(body)),

  documents: () => delay(ok([...mockDocuments])),

  document(id: string) {
    const row = mockDocuments.find((d) => d.id === id);
    if (!row) return Promise.reject(new Error("Document not found"));
    return delay(ok(row));
  },

  uploadDocument(body: {
    document_type: string;
    document_name: string;
    file_name: string;
    content_base64: string;
    content_type?: string;
  }) {
    const row: EssDocument = {
      id: `doc-${Date.now()}`,
      document_number: `DOC-${mockDocuments.length + 1}`,
      document_type: body.document_type,
      document_name: body.document_name,
      storage_uri: `ess-doc:mock/${body.file_name}`,
      issued_on: null,
      expires_on: null,
      verification_status: "pending",
      status: "active",
    };
    mockDocuments = [row, ...mockDocuments];
    return delay(ok(row, "Uploaded"));
  },

  announcements: () => delay(ok([...mockAnnouncements])),

  assets: () => delay(ok(mockAssets.map(toAsset))),

  asset(id: string) {
    const row = mockAssets.find((a) => a.id === id);
    if (!row) return Promise.reject(new Error("Asset not found"));
    return delay(ok(row));
  },

  lookupAsset(code: string) {
    const q = code.trim().toLowerCase();
    const row = mockAssets.find(
      (a) =>
        a.asset_code.toLowerCase() === q ||
        (a.barcode ?? "").toLowerCase() === q ||
        (a.qr_code ?? "").toLowerCase() === q,
    );
    if (!row) return Promise.reject(new Error("Asset not found"));
    return delay(ok(row));
  },

  createAssetTicket(
    assetId: string,
    body: {
      subject?: string;
      description: string;
      problem_category?: string;
      urgency?: string;
    },
  ) {
    const ticket: EssSupportTicketDetail = {
      id: `tk-${Date.now()}`,
      document_number: `HD-${String(mockTickets.length + 1).padStart(4, "0")}`,
      subject: body.subject ?? "Asset issue",
      status: "submitted",
      kind: "asset",
      urgency: body.urgency ?? "medium",
      created_at: new Date().toISOString(),
      asset_id: assetId,
      description: body.description,
      opened_at: new Date().toISOString(),
      resolved_at: null,
    };
    mockTickets = [ticket, ...mockTickets];
    return delay(ok(ticket, "Ticket created"));
  },

  meetingRooms: () => delay(ok([...mockRooms])),

  meetingRoomAvailability(onDate: string) {
    void onDate;
    const data: EssMeetingRoomAvailability[] = mockRooms.map((room) => ({
      room,
      is_busy: room.room_code === "R2",
      bookings: [],
    }));
    return delay(ok(data));
  },

  createMeetingBooking(body: {
    room_id: string;
    title: string;
    request_date: string;
    start_time?: string;
    end_time?: string;
    agenda?: string;
  }) {
    const room = mockRooms.find((r) => r.id === body.room_id);
    const booking: EssMeetingBooking = {
      id: `bk-${Date.now()}`,
      room_id: body.room_id,
      room_name: room?.room_name ?? "Room",
      title: body.title,
      request_date: body.request_date,
      start_time: body.start_time ?? null,
      end_time: body.end_time ?? null,
      status: "approved",
      requested_by_employee_id: mockMe.employee_id,
    };
    mockBookings = [booking, ...mockBookings];
    return delay(ok(booking, "Booked"));
  },

  myMeetingBookings: () => delay(ok([...mockBookings])),

  supportTickets: () => delay(ok(mockTickets.map(toTicketList))),

  supportTicket(id: string) {
    const row = mockTickets.find((t) => t.id === id);
    if (!row) return Promise.reject(new Error("Ticket not found"));
    return delay(ok(row));
  },

  createSupportTicket(body: {
    kind: string;
    subject: string;
    description?: string;
    urgency?: string;
    asset_id?: string;
  }) {
    const ticket: EssSupportTicketDetail = {
      id: `tk-${Date.now()}`,
      document_number: `HD-${String(mockTickets.length + 1).padStart(4, "0")}`,
      subject: body.subject,
      status: "submitted",
      kind: body.kind,
      urgency: body.urgency ?? "medium",
      created_at: new Date().toISOString(),
      asset_id: body.asset_id ?? null,
      description: body.description ?? null,
      opened_at: new Date().toISOString(),
      resolved_at: null,
    };
    mockTickets = [ticket, ...mockTickets];
    return delay(ok(ticket, "Created"));
  },

  supportTicketComments(ticketId: string) {
    return delay(ok(mockComments.filter((c) => c.ticketId === ticketId).map(toComment)));
  },

  addSupportTicketComment(ticketId: string, body: { body: string }) {
    const c = {
      ticketId,
      id: `c-${Date.now()}`,
      body: body.body,
      commented_at: new Date().toISOString(),
      author_employee_id: mockMe.employee_id,
    };
    mockComments = [c, ...mockComments];
    return delay(ok(toComment(c)));
  },

  policies: () => delay(ok([...mockPolicies])),

  policyWalkthrough(id: string) {
    const row = mockPolicies.find((p) => p.id === id);
    if (!row) return Promise.reject(new Error("Policy not found"));
    const walk: EssPolicyWalkthrough = {
      ...row,
      steps: [
        {
          order: 1,
          title: "Overview",
          body: "Read this policy carefully before acknowledging.",
        },
        {
          order: 2,
          title: "Your responsibilities",
          body: "Follow company guidelines and escalate issues to HR.",
        },
        {
          order: 3,
          title: "Acknowledge",
          body: "Tap acknowledge to confirm you have read and understood.",
        },
      ],
    };
    return delay(ok(walk));
  },

  acknowledgePolicy(id: string) {
    mockPolicies = mockPolicies.map((p) =>
      p.id === id ? { ...p, acknowledged: true } : p,
    );
    return delay(
      ok({
        policy_id: id,
        policy_version: 1,
        acknowledged_at: new Date().toISOString(),
      }),
    );
  },

  // —— Phase 4 ——
  training: () => delay(ok([...mockTraining])),

  performance: () => delay(ok([...mockPerformance])),

  separation: () => delay(ok([...mockSeparations])),

  createSeparation(body: {
    separation_type?: string;
    requested_last_working_date: string;
    reason?: string;
  }) {
    const row: EssSeparationItem = {
      id: `sep-${Date.now()}`,
      document_number: `SEP-${String(mockSeparations.length + 1).padStart(3, "0")}`,
      separation_type: body.separation_type ?? "resignation",
      requested_last_working_date: body.requested_last_working_date,
      status: "draft",
      fnf_status: "pending",
      notice_status: "pending",
    };
    mockSeparations = [row, ...mockSeparations];
    return delay(ok(row, "Resignation request created"));
  },

  logout: () => delay(ok(null, "Signed out")),
};

function toAsset(a: EssAssetDetail): EssAsset {
  const { qr_code: _q, barcode: _b, ...rest } = a;
  return rest;
}

function toTicketList(t: EssSupportTicketDetail): EssSupportTicket {
  const {
    description: _d,
    opened_at: _o,
    resolved_at: _r,
    ...rest
  } = t;
  return rest;
}

function toComment(c: {
  id: string;
  body: string;
  commented_at: string;
  author_employee_id: string | null;
}): EssSupportTicketComment {
  return {
    id: c.id,
    body: c.body,
    commented_at: c.commented_at,
    author_employee_id: c.author_employee_id,
  };
}
