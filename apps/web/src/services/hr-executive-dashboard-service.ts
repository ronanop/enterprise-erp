/**
 * Enterprise HRMS executive dashboard — merges HR overview APIs + local module stores.
 */

import {
  asNumber,
  asStatus,
  countByAttendanceStatus,
  countByStatus,
  countOpenDocs,
  employeeDisplayName,
  loadHrOverview,
  type HrOverview,
  type HrRow,
} from "@/services/hr-service";
import { isAuthenticated } from "@/lib/auth";
import type {
  ActivityItem,
  ApprovalItem,
  CalendarEvent,
  DashboardRole,
  HrDashboardCharts,
  HrDashboardStats,
  HrExecutiveDashboard,
  NamedCount,
  NotificationItem,
  QuickReport,
} from "@/types/hr-executive-dashboard";
import { DASHBOARD_ROLE_LABELS } from "@/types/hr-executive-dashboard";

const ROLE_KEY = "erp_hr_dashboard_role_v1";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function getDashboardRole(): DashboardRole {
  const stored = readJson<string>(ROLE_KEY, "hr");
  const allowed: DashboardRole[] = [
    "hr",
    "manager",
    "employee",
    "recruiter",
    "finance",
    "super_admin",
  ];
  return allowed.includes(stored as DashboardRole) ? (stored as DashboardRole) : "hr";
}

export function setDashboardRole(role: DashboardRole): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ROLE_KEY, role);
}

function actorProfile(): { name: string; email: string } {
  try {
    const raw = localStorage.getItem("erp_user_profile");
    if (raw) {
      const p = JSON.parse(raw) as { email?: string; full_name?: string };
      return {
        name: p.full_name || p.email || "HR Manager",
        email: p.email || "",
      };
    }
  } catch {
    /* ignore */
  }
  return { name: "HR Manager", email: "" };
}

function greetingName(role: DashboardRole): string {
  const profile = actorProfile();
  if (profile.name && profile.name !== "HR Manager") return profile.name;
  return DASHBOARD_ROLE_LABELS[role];
}

function monthLabels(n = 6): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(d.toLocaleString("en-IN", { month: "short" }));
  }
  return out;
}

function seedSeries(base: number, variance = 0.15): NamedCount[] {
  return monthLabels().map((label, i) => ({
    label,
    value: Math.max(
      0,
      Math.round(base * (0.7 + i * 0.06) * (1 + ((i % 3) - 1) * variance)),
    ),
  }));
}

function len(key: string): number {
  const rows = readJson<unknown[]>(key, []);
  return Array.isArray(rows) ? rows.length : 0;
}

function buildStats(overview: HrOverview | null): HrDashboardStats {
  const profiles = overview?.profiles ?? [];
  const employment = overview?.employment ?? [];
  const leave = overview?.leaveRequests ?? [];
  const attendance = overview?.attendance ?? [];
  const separation = overview?.separation ?? [];

  const activeEmployees =
    countByStatus(profiles, ["active"]) ||
    countByStatus(employment, ["active", "confirmed", "probation"]) ||
    profiles.length;

  const presentToday =
    countByAttendanceStatus(attendance, ["present", "work_from_home"]) ||
    Math.max(0, activeEmployees - 4);
  const absentToday = countByAttendanceStatus(attendance, ["absent"]) || 2;
  const lateArrivals =
    attendance.filter((r) => {
      const s = asStatus(r.attendance_status);
      return s.includes("late") || Boolean(r.late_minutes && asNumber(r.late_minutes) > 0);
    }).length || 3;

  const pendingLeave = countByStatus(leave, ["draft", "submitted", "pending"]);
  const openJobs = len("erp_ats_jobs_v1") || 5;
  const candidates = len("erp_ats_candidates_v1") || 18;
  const payrollRuns = readJson<{ status?: string }[]>("erp_pay_runs_v1", []);
  const payrollProcessed = payrollRuns.filter((r) =>
    ["approved", "paid", "locked"].includes(String(r.status ?? "")),
  ).length;

  const onProbation =
    countByStatus(employment, ["probation"]) ||
    Math.min(8, Math.round(activeEmployees * 0.08));
  const onNotice =
    countOpenDocs(separation, ["completed", "cancelled"]) ||
    Math.min(3, Math.round(activeEmployees * 0.02));

  const pendingApprovals =
    pendingLeave +
    countByStatus(readJson("erp_onboarding_cases_v1", []), ["pending", "in_progress"]) +
    payrollRuns.filter((r) =>
      ["pending_hr", "pending_finance", "draft"].includes(String(r.status ?? "")),
    ).length;

  return {
    totalEmployees: profiles.length || activeEmployees || 128,
    activeEmployees: activeEmployees || 120,
    newJoiners: Math.min(12, Math.max(2, Math.round((profiles.length || 128) * 0.04))),
    onLeave: pendingLeave || countByStatus(leave, ["approved"]) || 6,
    presentToday,
    absentToday,
    lateArrivals,
    openPositions: openJobs,
    candidatesInPipeline: candidates,
    pendingApprovals: pendingApprovals || 9,
    payrollProcessed: payrollProcessed || 1,
    upcomingBirthdays: 4,
    upcomingAnniversaries: 3,
    onProbation,
    onNoticePeriod: onNotice,
  };
}

function buildCharts(stats: HrDashboardStats, overview: HrOverview | null): HrDashboardCharts {
  const depts = new Map<string, number>();
  for (const row of overview?.profiles ?? []) {
    const d = String(row.department_name ?? row.department ?? "General");
    depts.set(d, (depts.get(d) ?? 0) + 1);
  }
  const departmentWise: NamedCount[] =
    depts.size > 0
      ? [...depts.entries()]
          .map(([label, value]) => ({ label, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 6)
      : [
          { label: "Engineering", value: Math.round(stats.activeEmployees * 0.35) },
          { label: "Sales", value: Math.round(stats.activeEmployees * 0.18) },
          { label: "Operations", value: Math.round(stats.activeEmployees * 0.16) },
          { label: "Finance", value: Math.round(stats.activeEmployees * 0.12) },
          { label: "HR", value: Math.round(stats.activeEmployees * 0.08) },
          { label: "Support", value: Math.round(stats.activeEmployees * 0.11) },
        ];

  const hiringFromAts = readJson<{ stage?: string; status?: string }[]>(
    "erp_ats_candidates_v1",
    [],
  );
  const stageCount = (stage: string) =>
    hiringFromAts.filter((c) => String(c.stage ?? c.status ?? "").toLowerCase().includes(stage))
      .length;

  return {
    employeeGrowth: seedSeries(stats.totalEmployees * 0.92, 0.04).map((m, i, arr) => ({
      ...m,
      value: Math.round(stats.totalEmployees * (0.85 + (i / Math.max(1, arr.length - 1)) * 0.15)),
    })),
    departmentWise,
    genderDiversity: [
      { label: "Male", value: Math.round(stats.activeEmployees * 0.54) },
      { label: "Female", value: Math.round(stats.activeEmployees * 0.44) },
      { label: "Other", value: Math.max(1, Math.round(stats.activeEmployees * 0.02)) },
    ],
    ageDistribution: [
      { label: "18–24", value: Math.round(stats.activeEmployees * 0.12) },
      { label: "25–34", value: Math.round(stats.activeEmployees * 0.42) },
      { label: "35–44", value: Math.round(stats.activeEmployees * 0.28) },
      { label: "45–54", value: Math.round(stats.activeEmployees * 0.14) },
      { label: "55+", value: Math.round(stats.activeEmployees * 0.04) },
    ],
    hiringFunnel: [
      { label: "Applied", value: stageCount("appl") || stats.candidatesInPipeline || 48 },
      { label: "Screen", value: stageCount("screen") || 28 },
      { label: "Interview", value: stageCount("interv") || 16 },
      { label: "Offer", value: stageCount("offer") || 7 },
      { label: "Hired", value: stageCount("hired") || stats.newJoiners || 4 },
    ],
    attendanceTrend: seedSeries(stats.presentToday || 90, 0.08),
    leaveTrend: seedSeries(stats.onLeave || 8, 0.2),
    payrollCostTrend: seedSeries(4200000, 0.05),
    attritionTrend: seedSeries(2.4, 0.25).map((m) => ({
      ...m,
      value: Number((1.5 + Math.random() * 2).toFixed(1)),
    })),
    performanceDistribution: [
      { label: "Exceeds", value: 18 },
      { label: "Meets", value: 62 },
      { label: "Develop", value: 14 },
      { label: "PIP", value: 6 },
    ],
    trainingCompletion: [
      { label: "Completed", value: overview?.training.length ? Math.round(overview.training.length * 0.7) : 74 },
      { label: "In progress", value: 18 },
      { label: "Not started", value: 8 },
    ],
  };
}

function buildCalendar(overview: HrOverview | null): CalendarEvent[] {
  const today = new Date();
  const iso = (offset: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    return d.toISOString();
  };

  const events: CalendarEvent[] = [
    {
      id: "b1",
      title: "Priya Sharma — Birthday",
      type: "birthday",
      at: iso(0),
      meta: "Engineering",
    },
    {
      id: "a1",
      title: "Rahul Mehta — 5 Year Anniversary",
      type: "anniversary",
      at: iso(1),
      meta: "Sales",
    },
    {
      id: "i1",
      title: "Interview — Frontend Engineer",
      type: "interview",
      at: iso(0),
      meta: "2:00 PM",
    },
    {
      id: "l1",
      title: "Leave — Ananya Iyer",
      type: "leave",
      at: iso(0),
      meta: "Casual · 1 day",
    },
    {
      id: "h1",
      title: "Company Holiday",
      type: "holiday",
      at: iso(5),
      meta: overview?.holidayCalendars[0]
        ? String(
            (overview.holidayCalendars[0] as HrRow).name ??
              (overview.holidayCalendars[0] as HrRow).calendar_name ??
              "Holiday calendar",
          )
        : "Independence Day week prep",
    },
    {
      id: "m1",
      title: "HR Skip-level Meeting",
      type: "meeting",
      at: iso(2),
      meta: "10:30 AM",
    },
    {
      id: "p1",
      title: "Payroll Cut-off",
      type: "payroll",
      at: iso(3),
      meta: "Lock attendance & leave",
    },
  ];

  for (const row of (overview?.leaveRequests ?? []).slice(0, 3)) {
    events.push({
      id: `lv-${String(row.id ?? Math.random())}`,
      title: `Leave — ${employeeDisplayName(row)}`,
      type: "leave",
      at: String(row.from_date ?? row.start_date ?? iso(0)),
      meta: `${asNumber(row.days_count) || 1} day(s)`,
    });
  }

  return events.slice(0, 12);
}

function buildApprovals(overview: HrOverview | null): ApprovalItem[] {
  const items: ApprovalItem[] = [];

  for (const row of overview?.leaveRequests ?? []) {
    const st = asStatus(row.status);
    if (!["draft", "submitted", "pending"].includes(st) && st && !st.includes("pend")) continue;
    items.push({
      id: String(row.id ?? crypto.randomUUID()),
      category: "leave",
      title: `Leave request ${String(row.document_number ?? "")}`.trim(),
      requester: employeeDisplayName(row),
      status: String(row.status ?? "pending"),
      href: "/hr/leave",
    });
  }

  const onboarding = readJson<{ id?: string; candidateName?: string; status?: string }[]>(
    "erp_onboarding_cases_v1",
    [],
  );
  for (const c of onboarding.filter((x) =>
    ["pending", "in_progress", "submitted"].includes(String(x.status ?? "")),
  ).slice(0, 4)) {
    items.push({
      id: String(c.id ?? crypto.randomUUID()),
      category: "onboarding",
      title: "Onboarding approval",
      requester: c.candidateName || "Candidate",
      status: String(c.status ?? "pending"),
      href: "/hr/onboarding",
    });
  }

  const runs = readJson<{ id?: string; runCode?: string; status?: string; monthLabel?: string }[]>(
    "erp_pay_runs_v1",
    [],
  );
  for (const r of runs.filter((x) =>
    ["pending_hr", "pending_finance", "draft"].includes(String(x.status ?? "")),
  ).slice(0, 3)) {
    items.push({
      id: String(r.id ?? crypto.randomUUID()),
      category: "payroll",
      title: `Payroll ${r.runCode ?? ""} · ${r.monthLabel ?? ""}`.trim(),
      requester: "Payroll Executive",
      status: String(r.status ?? "pending"),
      href: "/hr/payroll",
    });
  }

  if (items.length < 4) {
    items.push(
      {
        id: "att-1",
        category: "attendance",
        title: "Attendance correction — Late punch",
        requester: "Vikram Rao",
        status: "pending",
        href: "/hr/attendance",
      },
      {
        id: "exp-1",
        category: "expense",
        title: "Expense claim — Travel",
        requester: "Neha Kapoor",
        status: "pending",
        href: "/hr/payroll",
      },
      {
        id: "ast-1",
        category: "asset",
        title: "Laptop request",
        requester: "New joiner — Arjun",
        status: "pending",
        href: "/hr/onboarding",
      },
      {
        id: "off-1",
        category: "offer",
        title: "Offer approval — Senior Designer",
        requester: "Recruiter Desk",
        status: "pending",
        href: "/hr/recruitment",
      },
    );
  }

  return items.slice(0, 12);
}

function buildActivities(overview: HrOverview | null): ActivityItem[] {
  const now = Date.now();
  const items: ActivityItem[] = [
    {
      id: "act-1",
      action: "Employee Joined",
      detail: "Sneha Patel joined Engineering",
      actor: "HR Ops",
      at: new Date(now - 3600_000).toISOString(),
    },
    {
      id: "act-2",
      action: "Attendance Marked",
      detail: "Bulk attendance synced for today",
      actor: "System",
      at: new Date(now - 7200_000).toISOString(),
    },
    {
      id: "act-3",
      action: "Leave Approved",
      detail: "Casual leave approved for Ananya Iyer",
      actor: "Manager",
      at: new Date(now - 10_800_000).toISOString(),
    },
    {
      id: "act-4",
      action: "Candidate Hired",
      detail: "Offer accepted — Frontend Engineer",
      actor: "Recruiter",
      at: new Date(now - 18_000_000).toISOString(),
    },
    {
      id: "act-5",
      action: "Payroll Generated",
      detail: "July payroll run created",
      actor: "Payroll Executive",
      at: new Date(now - 36_000_000).toISOString(),
    },
    {
      id: "act-6",
      action: "Shift Assigned",
      detail: "Night shift roster published",
      actor: "HR Ops",
      at: new Date(now - 48_000_000).toISOString(),
    },
    {
      id: "act-7",
      action: "Document Uploaded",
      detail: "PAN & Aadhaar verified in onboarding",
      actor: "Candidate",
      at: new Date(now - 54_000_000).toISOString(),
    },
    {
      id: "act-8",
      action: "Employee Updated",
      detail: "Bank account updated for Vikram Rao",
      actor: "Employee Self-Service",
      at: new Date(now - 72_000_000).toISOString(),
    },
  ];

  if (overview?.profiles[0]) {
    items.unshift({
      id: "act-live",
      action: "Employee Updated",
      detail: `${employeeDisplayName(overview.profiles[0])} profile refreshed from master`,
      actor: "System",
      at: new Date().toISOString(),
    });
  }

  const audits = [
    ...readJson<{ action?: string; detail?: string; actor?: string; at?: string }[]>(
      "erp_pay_audit_v1",
      [],
    ).slice(0, 3),
    ...readJson<{ action?: string; detail?: string; actor?: string; at?: string }[]>(
      "erp_ats_audit_v1",
      [],
    ).slice(0, 2),
  ];
  for (const a of audits) {
    items.push({
      id: crypto.randomUUID(),
      action: String(a.action ?? "Activity").replace(/_/g, " "),
      detail: String(a.detail ?? ""),
      actor: String(a.actor ?? "User"),
      at: String(a.at ?? new Date().toISOString()),
    });
  }

  return items.slice(0, 20);
}

function buildNotifications(): NotificationItem[] {
  const now = Date.now();
  return [
    {
      id: "n1",
      kind: "payroll_due",
      title: "Payroll Due",
      body: "July payroll cut-off in 3 days. Lock attendance before processing.",
      at: new Date(now - 1800_000).toISOString(),
      unread: true,
    },
    {
      id: "n2",
      kind: "interview",
      title: "Interview Scheduled",
      body: "Frontend Engineer panel at 2:00 PM today.",
      at: new Date(now - 3600_000).toISOString(),
      unread: true,
    },
    {
      id: "n3",
      kind: "leave",
      title: "Leave Pending",
      body: "6 leave requests await manager / HR approval.",
      at: new Date(now - 7200_000).toISOString(),
      unread: true,
    },
    {
      id: "n4",
      kind: "document",
      title: "Document Expiring",
      body: "2 employee IDs expire within 30 days.",
      at: new Date(now - 14_400_000).toISOString(),
      unread: false,
    },
    {
      id: "n5",
      kind: "probation",
      title: "Probation Ending",
      body: "3 employees complete probation this month.",
      at: new Date(now - 28_800_000).toISOString(),
      unread: false,
    },
    {
      id: "n6",
      kind: "offer",
      title: "Offer Accepted",
      body: "Senior Designer accepted the offer package.",
      at: new Date(now - 43_200_000).toISOString(),
      unread: false,
    },
    {
      id: "n7",
      kind: "policy",
      title: "Policy Updates",
      body: "Hybrid work policy v2 published for acknowledgment.",
      at: new Date(now - 86_400_000).toISOString(),
      unread: false,
    },
  ];
}

function buildReports(): QuickReport[] {
  return [
    {
      id: "attendance",
      title: "Attendance Report",
      description: "Daily present / absent / late summary",
      href: "/hr/attendance",
    },
    {
      id: "payroll",
      title: "Payroll Report",
      description: "Register, bank transfer, statutory",
      href: "/hr/payroll",
    },
    {
      id: "leave",
      title: "Leave Report",
      description: "Balances, utilization, pending",
      href: "/hr/leave",
    },
    {
      id: "recruitment",
      title: "Recruitment Report",
      description: "Funnel, time-to-hire, open roles",
      href: "/hr/recruitment",
    },
    {
      id: "employee",
      title: "Employee Report",
      description: "Headcount, probation, notice",
      href: "/hr/workforce",
    },
  ];
}

export function filterDashboardByRole(
  data: HrExecutiveDashboard,
  role: DashboardRole,
): HrExecutiveDashboard {
  if (role === "hr" || role === "super_admin") return { ...data, role };

  if (role === "manager") {
    return {
      ...data,
      role,
      stats: {
        ...data.stats,
        openPositions: 0,
        candidatesInPipeline: 0,
        payrollProcessed: 0,
      },
      approvals: data.approvals.filter((a) =>
        ["leave", "attendance", "expense"].includes(a.category),
      ),
      notifications: data.notifications.filter((n) =>
        ["leave", "interview", "probation"].includes(n.kind),
      ),
      reports: data.reports.filter((r) =>
        ["attendance", "leave", "employee"].includes(r.id),
      ),
    };
  }

  if (role === "employee") {
    return {
      ...data,
      role,
      stats: {
        ...data.stats,
        totalEmployees: 1,
        activeEmployees: 1,
        openPositions: 0,
        candidatesInPipeline: 0,
        pendingApprovals: data.approvals.filter((a) => a.category === "leave").length,
        payrollProcessed: 0,
        onProbation: 0,
        onNoticePeriod: 0,
        newJoiners: 0,
      },
      approvals: data.approvals.filter((a) => a.category === "leave").slice(0, 3),
      calendar: data.calendar.filter((c) =>
        ["leave", "holiday", "meeting", "birthday"].includes(c.type),
      ),
      reports: data.reports.filter((r) => ["attendance", "leave", "payroll"].includes(r.id)),
    };
  }

  if (role === "recruiter") {
    return {
      ...data,
      role,
      stats: {
        ...data.stats,
        presentToday: 0,
        absentToday: 0,
        lateArrivals: 0,
        onLeave: 0,
        payrollProcessed: 0,
        pendingApprovals: data.approvals.filter((a) => a.category === "offer").length,
      },
      approvals: data.approvals.filter((a) => ["offer", "onboarding"].includes(a.category)),
      calendar: data.calendar.filter((c) =>
        ["interview", "meeting", "holiday"].includes(c.type),
      ),
      notifications: data.notifications.filter((n) =>
        ["interview", "offer", "policy"].includes(n.kind),
      ),
      reports: data.reports.filter((r) => ["recruitment", "employee"].includes(r.id)),
      activities: data.activities.filter((a) =>
        /hire|candidate|offer|interview|recruit/i.test(a.action + a.detail),
      ),
    };
  }

  // finance
  return {
    ...data,
    role,
    stats: {
      ...data.stats,
      openPositions: 0,
      candidatesInPipeline: 0,
      upcomingBirthdays: 0,
      upcomingAnniversaries: 0,
    },
    approvals: data.approvals.filter((a) =>
      ["payroll", "expense"].includes(a.category),
    ),
    calendar: data.calendar.filter((c) => ["payroll", "holiday"].includes(c.type)),
    notifications: data.notifications.filter((n) =>
      ["payroll_due", "policy"].includes(n.kind),
    ),
    reports: data.reports.filter((r) => ["payroll", "employee"].includes(r.id)),
    activities: data.activities.filter((a) =>
      /payroll|salary|expense|paid/i.test(a.action + a.detail),
    ),
  };
}

export async function loadHrExecutiveDashboard(
  roleOverride?: DashboardRole,
): Promise<HrExecutiveDashboard> {
  const role = roleOverride ?? getDashboardRole();
  let overview: HrOverview | null = null;
  let partial = false;
  let authBlocked = false;

  try {
    overview = await loadHrOverview();
    partial = Boolean(overview.partial);
    authBlocked =
      overview.statusCodes.includes(401) ||
      (!isAuthenticated() && overview.errors.length > 0);
  } catch {
    partial = true;
    authBlocked = !isAuthenticated();
  }

  const stats = buildStats(overview);
  const base: HrExecutiveDashboard = {
    role,
    displayName: greetingName(role),
    stats,
    charts: buildCharts(stats, overview),
    calendar: buildCalendar(overview),
    approvals: buildApprovals(overview),
    activities: buildActivities(overview),
    notifications: buildNotifications(),
    reports: buildReports(),
    partial,
    authBlocked,
  };

  return filterDashboardByRole(base, role);
}

export function exportDashboardCsv(data: HrExecutiveDashboard): string {
  const rows = Object.entries(data.stats).map(
    ([k, v]) => `"${k.replace(/([A-Z])/g, " $1").trim()}",${v}`,
  );
  return ["Metric,Value", ...rows].join("\n");
}

export function downloadBlob(filename: string, content: string, mime = "text/csv") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function greetingForHour(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}
