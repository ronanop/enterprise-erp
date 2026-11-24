/** Enterprise HRMS executive dashboard types */

export type DashboardRole =
  | "hr"
  | "manager"
  | "employee"
  | "recruiter"
  | "finance"
  | "super_admin";

export const DASHBOARD_ROLE_LABELS: Record<DashboardRole, string> = {
  hr: "HR Manager",
  manager: "Reporting manager",
  employee: "Employee",
  recruiter: "Recruiter",
  finance: "Finance",
  super_admin: "Super Admin",
};

export type NamedCount = { label: string; value: number };

/** Brief row for department / location drill-down lists on the dashboard. */
export type DashboardEmployeeBrief = {
  id: string;
  name: string;
  code?: string;
  designation?: string;
};

export type StackedAttendancePoint = {
  label: string;
  present: number;
  absent: number;
  leave: number;
  halfDay: number;
  late: number;
};

/** Daily Present THIS month vs same day LAST month (Attendance Trend line chart). */
export type AttendanceComparePoint = {
  label: string;
  /** Present headcount (present + late + half day) — current month day; drives the line. */
  thisPresent: number;
  /** Present headcount — previous month same day-of-month. */
  lastPresent: number;
  /** Full-day present (present + late) for tooltip. */
  thisPresentFull: number;
  /** Absent headcount — current month day. */
  thisAbsent: number;
  /** Half-day headcount — current month day. */
  thisHalfDay: number;
};

export type LeaveTrendPoint = {
  label: string;
  casual: number;
  sick: number;
  earned: number;
  unpaid: number;
};

export type HrDashboardStats = {
  totalEmployees: number;
  activeEmployees: number;
  newJoiners: number;
  onLeave: number;
  presentToday: number;
  absentToday: number;
  onDutyToday: number;
  lateArrivals: number;
  openPositions: number;
  candidatesInPipeline: number;
  pendingApprovals: number;
  payrollProcessed: number;
  upcomingBirthdays: number;
  upcomingAnniversaries: number;
  onProbation: number;
  onNoticePeriod: number;
  /** Invitation links sent / active onboarding cases */
  onboardingInProcess: number;
};

export type HrDashboardCharts = {
  employeeGrowth: NamedCount[];
  departmentWise: NamedCount[];
  locationWise: NamedCount[];
  genderDiversity: NamedCount[];
  ageDistribution: NamedCount[];
  hiringFunnel: NamedCount[];
  attendanceTrend: NamedCount[];
  attendanceStacked: StackedAttendancePoint[];
  attendanceCompare: AttendanceComparePoint[];
  leaveTrend: NamedCount[];
  leaveTrendByType: LeaveTrendPoint[];
  onboardingProgress: NamedCount[];
  /** Attrition % by month (exits / headcount). */
  attritionTrend: NamedCount[];
  /** Employees who left the company — exit counts by month. */
  attritionByMonth: NamedCount[];
  /** Exit counts by department (same window as attritionByMonth). */
  attritionByDepartment: NamedCount[];
  /** Exit counts by resignation / exit reason. */
  attritionByReason: NamedCount[];
  performanceDistribution: NamedCount[];
  trainingCompletion: NamedCount[];
};

export type CalendarEventType =
  | "birthday"
  | "anniversary"
  | "interview"
  | "leave"
  | "holiday"
  | "meeting"
  | "joining"
  | "payroll";

export type CalendarEvent = {
  id: string;
  title: string;
  type: CalendarEventType;
  at: string;
  meta?: string;
  /** When set, event row can open the employee profile. */
  employeeId?: string;
};

export type ApprovalItem = {
  id: string;
  category:
    | "leave"
    | "attendance"
    | "onboarding"
    | "payroll"
    | "expense"
    | "asset"
    | "offer"
    | "compoff"
    | "on_duty"
    | "ot_allotment"
    | "attendance_correction";
  title: string;
  requester: string;
  status: string;
  href: string;
};

export type ActivityItem = {
  id: string;
  action: string;
  detail: string;
  actor: string;
  at: string;
};

export type NotificationItem = {
  id: string;
  kind:
    | "payroll_due"
    | "interview"
    | "leave"
    | "document"
    | "probation"
    | "offer"
    | "policy"
    | "birthday";
  title: string;
  body: string;
  at: string;
  unread: boolean;
  href?: string;
};

export type QuickReport = {
  id: string;
  title: string;
  description: string;
  href: string;
};

export type DashboardTrainingItem = {
  id: string;
  title: string;
  at: string;
  meta?: string;
};

export type HrExecutiveDashboard = {
  role: DashboardRole;
  displayName: string;
  stats: HrDashboardStats;
  charts: HrDashboardCharts;
  /** Employees keyed by department label (same labels as charts.departmentWise). */
  employeesByDepartment: Record<string, DashboardEmployeeBrief[]>;
  /** Employees keyed by location label (same labels as charts.locationWise). */
  employeesByLocation: Record<string, DashboardEmployeeBrief[]>;
  /** Employees keyed by gender label (Male / Female / Other). */
  employeesByGender: Record<string, DashboardEmployeeBrief[]>;
  calendar: CalendarEvent[];
  trainingItems: DashboardTrainingItem[];
  approvals: ApprovalItem[];
  activities: ActivityItem[];
  notifications: NotificationItem[];
  reports: QuickReport[];
  partial: boolean;
  authBlocked: boolean;
};
