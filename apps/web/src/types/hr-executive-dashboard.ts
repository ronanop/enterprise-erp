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
};

export type HrDashboardCharts = {
  employeeGrowth: NamedCount[];
  departmentWise: NamedCount[];
  genderDiversity: NamedCount[];
  ageDistribution: NamedCount[];
  hiringFunnel: NamedCount[];
  attendanceTrend: NamedCount[];
  leaveTrend: NamedCount[];
  payrollCostTrend: NamedCount[];
  attritionTrend: NamedCount[];
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
  | "payroll";

export type CalendarEvent = {
  id: string;
  title: string;
  type: CalendarEventType;
  at: string;
  meta?: string;
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
  calendar: CalendarEvent[];
  trainingItems: DashboardTrainingItem[];
  approvals: ApprovalItem[];
  activities: ActivityItem[];
  notifications: NotificationItem[];
  reports: QuickReport[];
  partial: boolean;
  authBlocked: boolean;
};
