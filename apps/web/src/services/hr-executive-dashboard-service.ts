/**
 * HRMS executive dashboard — real API data only (no mock / localStorage metrics).
 * Joins Master Employee + Org Department + HR + Recruitment + Payroll list APIs.
 */

import { isAuthenticated } from "@/lib/auth";
import {
  asNumber,
  asStatus,
  countByAttendanceStatus,
  countByStatus,
  employeeDisplayName,
  loadHrOverview,
  type HrOverview,
  type HrRow,
} from "@/services/hr-service";
import { ApiClientError, resourceService } from "@/services/api-client";
import { loadPayrollOverview } from "@/services/payroll-service";
import { loadRecruitmentOverview } from "@/services/recruitment-service";
import {
  inboxItemHref,
  loadHrEssInbox,
  type HrEssInboxItem,
} from "@/services/hr-ess-inbox-service";
import type {
  ActivityItem,
  ApprovalItem,
  CalendarEvent,
  DashboardRole,
  DashboardTrainingItem,
  HrDashboardCharts,
  HrDashboardStats,
  HrExecutiveDashboard,
  NamedCount,
  NotificationItem,
  QuickReport,
} from "@/types/hr-executive-dashboard";
import { DASHBOARD_ROLE_LABELS } from "@/types/hr-executive-dashboard";

const ROLE_KEY = "erp_hr_dashboard_role_v1";

type MasterEmployee = HrRow & {
  id?: string;
  department_id?: string;
  first_name?: string;
  last_name?: string;
  employee_code?: string;
  date_of_joining?: string;
  designation?: string;
  status?: string;
};

type Department = HrRow & {
  id?: string;
  department_name?: string;
  department_code?: string;
};

function readRole(): string {
  if (typeof window === "undefined") return "hr";
  try {
    return localStorage.getItem(ROLE_KEY) || "hr";
  } catch {
    return "hr";
  }
}

export function getDashboardRole(): DashboardRole {
  const stored = readRole();
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

export function greetingForHour(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

function isoDate(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function ageYears(dob: unknown, today = new Date()): number | null {
  const d = parseDate(dob);
  if (!d) return null;
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-IN", { month: "short" });
}

function lastNMonthKeys(n = 6): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(monthKey(d));
  }
  return out;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

async function safeRows(apiPath: string): Promise<HrRow[]> {
  try {
    const res = await resourceService.list(apiPath, { page_size: 200, page: 1 });
    const data = res.data;
    return Array.isArray(data) ? (data as HrRow[]) : [];
  } catch {
    return [];
  }
}

function employeeNameFromMaster(
  emp: MasterEmployee | undefined,
  fallbackRow?: HrRow,
): string {
  if (emp) {
    const name = `${emp.first_name ?? ""} ${emp.last_name ?? ""}`.trim();
    if (name) return name;
    if (emp.employee_code) return String(emp.employee_code);
  }
  return fallbackRow ? employeeDisplayName(fallbackRow) : "Employee";
}

function buildJoinedPeople(
  overview: HrOverview,
  employees: MasterEmployee[],
  departments: Department[],
) {
  const empById = new Map(employees.map((e) => [String(e.id), e]));
  const deptById = new Map(departments.map((d) => [String(d.id), d]));
  const profileByEmp = new Map(
    overview.profiles.map((p) => [String(p.employee_id ?? p.id), p]),
  );

  const people = employees.map((emp) => {
    const profile = profileByEmp.get(String(emp.id));
    const dept = deptById.get(String(emp.department_id ?? ""));
    return {
      emp,
      profile,
      departmentName: String(
        dept?.department_name ?? dept?.department_code ?? emp.designation ?? "Unassigned",
      ),
      gender: String(profile?.gender ?? "unspecified").toLowerCase(),
      dob: profile?.date_of_birth,
      doj: emp.date_of_joining,
      status: String(emp.status ?? profile?.status ?? "active").toLowerCase(),
    };
  });

  // Include HR profiles not yet mirrored in master list (edge case).
  for (const profile of overview.profiles) {
    const eid = String(profile.employee_id ?? "");
    if (eid && !empById.has(eid)) {
      people.push({
        emp: { id: eid },
        profile,
        departmentName: "Unassigned",
        gender: String(profile.gender ?? "unspecified").toLowerCase(),
        dob: profile.date_of_birth,
        doj: undefined,
        status: String(profile.status ?? "active").toLowerCase(),
      });
    }
  }

  return { people, empById, deptById };
}

function buildStats(
  overview: HrOverview,
  people: ReturnType<typeof buildJoinedPeople>["people"],
  recruitment: Awaited<ReturnType<typeof loadRecruitmentOverview>> | null,
  payroll: Awaited<ReturnType<typeof loadPayrollOverview>> | null,
): HrDashboardStats {
  const today = todayIso();
  const activeEmployees = people.filter((p) =>
    ["active", "confirmed", "probation"].includes(p.status),
  ).length;

  const todayAttendance = overview.attendance.filter(
    (r) => isoDate(r.attendance_date) === today,
  );
  const presentToday = countByAttendanceStatus(todayAttendance, [
    "present",
    "work_from_home",
    "half_day",
  ]);
  const absentToday = countByAttendanceStatus(todayAttendance, ["absent"]);
  const onDutyToday = countByAttendanceStatus(todayAttendance, ["on_duty"]);
  const lateArrivals = todayAttendance.filter((r) => {
    const checkIn = parseDate(r.check_in_at);
    if (!checkIn) return false;
    return checkIn.getUTCHours() > 9 || (checkIn.getUTCHours() === 9 && checkIn.getUTCMinutes() > 15);
  }).length;

  const onLeave = overview.leaveRequests.filter((r) => {
    if (asStatus(r.status) !== "approved") return false;
    const start = isoDate(r.start_date);
    const end = isoDate(r.end_date);
    if (!start || !end) return false;
    return start <= today && today <= end;
  }).length;

  const pendingLeave = countByStatus(overview.leaveRequests, [
    "draft",
    "submitted",
    "pending",
  ]);
  const openPositions = (recruitment?.requisitions ?? []).filter((r) =>
    ["approved", "open", "submitted"].includes(asStatus(r.status)),
  ).length;
  const candidatesInPipeline = (recruitment?.applications ?? []).filter((r) =>
    !["hired", "rejected", "withdrawn"].includes(asStatus(r.status)),
  ).length;

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const newJoiners = people.filter((p) => {
    const doj = parseDate(p.doj);
    return doj != null && doj >= ninetyDaysAgo;
  }).length;

  const onProbation = countByStatus(overview.employment, ["probation"]);
  const onNoticePeriod = overview.separation.filter((r) =>
    ["submitted", "approved", "in_progress"].includes(asStatus(r.status)),
  ).length;

  const upcomingBirthdays = people.filter((p) => {
    const dob = parseDate(p.dob);
    if (!dob) return false;
    const now = new Date();
    const next = new Date(now.getFullYear(), dob.getMonth(), dob.getDate());
    if (next < now) next.setFullYear(now.getFullYear() + 1);
    const diff = (next.getTime() - now.getTime()) / 86_400_000;
    return diff >= 0 && diff <= 30;
  }).length;

  const upcomingAnniversaries = people.filter((p) => {
    const doj = parseDate(p.doj);
    if (!doj) return false;
    const now = new Date();
    const next = new Date(now.getFullYear(), doj.getMonth(), doj.getDate());
    if (next < now) next.setFullYear(now.getFullYear() + 1);
    const diff = (next.getTime() - now.getTime()) / 86_400_000;
    return diff >= 0 && diff <= 30;
  }).length;

  const payrollProcessed = (payroll?.runs ?? []).filter((r) =>
    ["approved", "paid", "locked", "posted"].includes(asStatus(r.status)),
  ).length;

  return {
    totalEmployees: people.length,
    activeEmployees: activeEmployees || people.length,
    newJoiners,
    onLeave,
    presentToday,
    absentToday,
    onDutyToday,
    lateArrivals,
    openPositions,
    candidatesInPipeline,
    pendingApprovals: pendingLeave,
    payrollProcessed,
    upcomingBirthdays,
    upcomingAnniversaries,
    onProbation,
    onNoticePeriod,
  };
}

function buildCharts(
  overview: HrOverview,
  people: ReturnType<typeof buildJoinedPeople>["people"],
  recruitment: Awaited<ReturnType<typeof loadRecruitmentOverview>> | null,
): HrDashboardCharts {
  const months = lastNMonthKeys(6);

  const employeeGrowth: NamedCount[] = months.map((key) => {
    const [y, m] = key.split("-").map(Number);
    const cutoff = new Date(y, m, 0); // end of month
    const value = people.filter((p) => {
      const doj = parseDate(p.doj);
      return !doj || doj <= cutoff;
    }).length;
    return { label: monthLabel(key), value };
  });

  const deptMap = new Map<string, number>();
  for (const p of people) {
    deptMap.set(p.departmentName, (deptMap.get(p.departmentName) ?? 0) + 1);
  }
  const departmentWise = [...deptMap.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  const genderMap = new Map<string, number>();
  for (const p of people) {
    let label = "Other";
    if (p.gender === "male") label = "Male";
    else if (p.gender === "female") label = "Female";
    genderMap.set(label, (genderMap.get(label) ?? 0) + 1);
  }
  const genderDiversity = ["Male", "Female", "Other"].map((label) => ({
    label,
    value: genderMap.get(label) ?? 0,
  }));

  const ageBuckets = [
    { label: "18–24", min: 18, max: 24 },
    { label: "25–34", min: 25, max: 34 },
    { label: "35–44", min: 35, max: 44 },
    { label: "45–54", min: 45, max: 54 },
    { label: "55+", min: 55, max: 200 },
  ];
  const ageDistribution = ageBuckets.map((b) => ({
    label: b.label,
    value: people.filter((p) => {
      const age = ageYears(p.dob);
      return age != null && age >= b.min && age <= b.max;
    }).length,
  }));

  const apps = recruitment?.applications ?? [];
  const stageOf = (row: HrRow) =>
    asStatus(row.status) || asStatus(row.current_stage_code);
  const hiringFunnel: NamedCount[] = [
    {
      label: "Applied",
      value: apps.filter((a) =>
        ["applied", "screening", "interview", "selected", "offer", "hired"].includes(stageOf(a)),
      ).length,
    },
    {
      label: "Screen",
      value: apps.filter((a) =>
        ["screening", "interview", "selected", "offer", "hired"].includes(stageOf(a)),
      ).length,
    },
    {
      label: "Interview",
      value: apps.filter((a) =>
        ["interview", "selected", "offer", "hired"].includes(stageOf(a)),
      ).length,
    },
    {
      label: "Offer",
      value: apps.filter((a) => ["offer", "hired"].includes(stageOf(a))).length,
    },
    {
      label: "Hired",
      value: apps.filter((a) => stageOf(a) === "hired").length,
    },
  ];

  const attendanceTrend: NamedCount[] = months.map((key) => {
    const rows = overview.attendance.filter((r) => {
      const d = parseDate(r.attendance_date);
      return d != null && monthKey(d) === key;
    });
    const present = rows.filter((r) =>
      ["present", "work_from_home", "half_day"].includes(asStatus(r.attendance_status)),
    ).length;
    return { label: monthLabel(key), value: present };
  });

  const leaveTrend: NamedCount[] = months.map((key) => {
    const value = overview.leaveRequests.filter((r) => {
      if (!["approved", "submitted"].includes(asStatus(r.status))) return false;
      const d = parseDate(r.start_date);
      return d != null && monthKey(d) === key;
    }).length;
    return { label: monthLabel(key), value };
  });

  const payrollCostTrend: NamedCount[] = months.map((key) => {
    const [y, m] = key.split("-").map(Number);
    const cutoff = new Date(y, m, 0);
    const monthlyCtc = overview.employment
      .filter((e) => ["active", "confirmed", "probation"].includes(asStatus(e.status)))
      .filter((e) => {
        const doj = parseDate(e.date_of_joining);
        return !doj || doj <= cutoff;
      })
      .reduce((sum, e) => sum + asNumber(e.ctc_amount) / 12, 0);
    return { label: monthLabel(key), value: Math.round(monthlyCtc) };
  });

  const separations = overview.separation.filter((r) =>
    ["completed", "approved"].includes(asStatus(r.status)),
  );
  const attritionTrend: NamedCount[] = months.map((key) => {
    const headcount =
      employeeGrowth.find((g) => g.label === monthLabel(key))?.value || people.length || 1;
    const exits = separations.filter((r) => {
      const d = parseDate(r.last_working_date ?? r.updated_at ?? r.created_at);
      return d != null && monthKey(d) === key;
    }).length;
    const pct = Number(((exits / Math.max(1, headcount)) * 100).toFixed(1));
    return { label: monthLabel(key), value: pct };
  });

  const ratingBucket = (rating: number) => {
    if (rating >= 5) return "Exceeds";
    if (rating >= 4) return "Meets";
    if (rating >= 3) return "Develop";
    return "PIP";
  };
  const perfMap = new Map<string, number>([
    ["Exceeds", 0],
    ["Meets", 0],
    ["Develop", 0],
    ["PIP", 0],
  ]);
  for (const r of overview.reviews) {
    const rating = asNumber(r.overall_rating);
    if (!rating) continue;
    const label = ratingBucket(rating);
    perfMap.set(label, (perfMap.get(label) ?? 0) + 1);
  }
  const performanceDistribution = [...perfMap.entries()].map(([label, value]) => ({
    label,
    value,
  }));

  const trainAtt = overview.trainingAttendance ?? [];
  const trainingCompletion: NamedCount[] = [
    {
      label: "Completed",
      value: trainAtt.filter((r) => asStatus(r.attendance_status) === "completed").length,
    },
    {
      label: "In progress",
      value: trainAtt.filter((r) => asStatus(r.attendance_status) === "attended").length,
    },
    {
      label: "Not started",
      value: trainAtt.filter((r) => asStatus(r.attendance_status) === "registered").length,
    },
  ];

  return {
    employeeGrowth,
    departmentWise,
    genderDiversity,
    ageDistribution,
    hiringFunnel,
    attendanceTrend,
    leaveTrend,
    payrollCostTrend,
    attritionTrend,
    performanceDistribution,
    trainingCompletion,
  };
}

function buildCalendar(
  overview: HrOverview,
  people: ReturnType<typeof buildJoinedPeople>["people"],
  empById: Map<string, MasterEmployee>,
  recruitment: Awaited<ReturnType<typeof loadRecruitmentOverview>> | null,
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const now = new Date();

  for (const p of people) {
    const dob = parseDate(p.dob);
    if (dob) {
      const next = new Date(now.getFullYear(), dob.getMonth(), dob.getDate());
      if (next < now) next.setFullYear(now.getFullYear() + 1);
      const diff = (next.getTime() - now.getTime()) / 86_400_000;
      if (diff >= 0 && diff <= 14) {
        events.push({
          id: `bday-${String(p.emp.id)}`,
          title: `${employeeNameFromMaster(p.emp)} — Birthday`,
          type: "birthday",
          at: next.toISOString(),
          meta: p.departmentName,
        });
      }
    }
    const doj = parseDate(p.doj);
    if (doj) {
      const next = new Date(now.getFullYear(), doj.getMonth(), doj.getDate());
      if (next < now) next.setFullYear(now.getFullYear() + 1);
      const years = now.getFullYear() - doj.getFullYear();
      const diff = (next.getTime() - now.getTime()) / 86_400_000;
      if (years > 0 && diff >= 0 && diff <= 14) {
        events.push({
          id: `ann-${String(p.emp.id)}`,
          title: `${employeeNameFromMaster(p.emp)} — ${years} Year Anniversary`,
          type: "anniversary",
          at: next.toISOString(),
          meta: p.departmentName,
        });
      }
    }
  }

  for (const row of overview.leaveRequests) {
    if (!["approved", "submitted"].includes(asStatus(row.status))) continue;
    const start = parseDate(row.start_date);
    if (!start) continue;
    const emp = empById.get(String(row.employee_id));
    events.push({
      id: `leave-${String(row.id)}`,
      title: `Leave — ${employeeNameFromMaster(emp, row)}`,
      type: "leave",
      at: start.toISOString(),
      meta: `${asNumber(row.days_count) || 1} day(s) · ${String(row.status)}`,
    });
  }

  for (const cal of overview.holidayCalendars) {
    const holidays = Array.isArray(cal.holidays_json) ? cal.holidays_json : [];
    for (const h of holidays as { date?: string; name?: string }[]) {
      if (!h?.date) continue;
      events.push({
        id: `hol-${h.date}-${h.name ?? "h"}`,
        title: h.name || "Holiday",
        type: "holiday",
        at: new Date(h.date).toISOString(),
        meta: String(cal.calendar_name ?? "Holiday calendar"),
      });
    }
  }

  for (const interview of recruitment?.interviews ?? []) {
    const when = parseDate(interview.scheduled_at);
    if (!when) continue;
    events.push({
      id: `int-${String(interview.id)}`,
      title: `Interview — ${String(interview.interview_type ?? "Panel")}`,
      type: "interview",
      at: when.toISOString(),
      meta: String(interview.status ?? ""),
    });
  }

  return events
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
    .slice(0, 16);
}

function buildTrainingItems(overview: HrOverview): DashboardTrainingItem[] {
  const now = new Date();
  const items: DashboardTrainingItem[] = [];

  for (const row of overview.training) {
    const start = parseDate(row.start_date);
    if (!start) continue;
    const diffDays = (start.getTime() - now.getTime()) / 86_400_000;
    if (diffDays < -14 || diffDays > 90) continue;
    const status = asStatus(row.status);
    if (status === "cancelled" || status === "archived") continue;
    items.push({
      id: String(row.id),
      title: String(row.training_name ?? row.program_name ?? row.document_number ?? "Training session"),
      at: start.toISOString(),
      meta: [row.training_mode ?? row.mode, row.status]
        .filter((v) => v != null && String(v).trim() !== "")
        .join(" · "),
    });
  }

  return items
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
    .slice(0, 8);
}

function buildApprovals(
  overview: HrOverview,
  empById: Map<string, MasterEmployee>,
  recruitment: Awaited<ReturnType<typeof loadRecruitmentOverview>> | null,
): ApprovalItem[] {
  const items: ApprovalItem[] = [];

  for (const row of overview.leaveRequests) {
    if (!["draft", "submitted", "pending"].includes(asStatus(row.status))) continue;
    const emp = empById.get(String(row.employee_id));
    items.push({
      id: String(row.id),
      category: "leave",
      title: `Leave ${String(row.document_number ?? "")}`.trim(),
      requester: employeeNameFromMaster(emp, row),
      status: String(row.status ?? "pending"),
      href: "/hr/leave",
    });
  }

  for (const row of overview.shiftAssignments) {
    if (!["draft", "submitted"].includes(asStatus(row.status))) continue;
    const emp = empById.get(String(row.employee_id));
    items.push({
      id: String(row.id),
      category: "attendance",
      title: `Shift assignment ${String(row.document_number ?? "")}`.trim(),
      requester: employeeNameFromMaster(emp, row),
      status: String(row.status ?? "pending"),
      href: "/hr/roster",
    });
  }

  for (const row of recruitment?.offers ?? []) {
    if (!["draft", "submitted"].includes(asStatus(row.status))) continue;
    items.push({
      id: String(row.id),
      category: "offer",
      title: `Offer ${String(row.document_number ?? "")}`.trim(),
      requester: "Recruitment",
      status: String(row.status ?? "pending"),
      href: "/hr/recruitment",
    });
  }

  for (const row of recruitment?.onboarding ?? []) {
    if (!["draft", "submitted", "in_progress"].includes(asStatus(row.status))) continue;
    items.push({
      id: String(row.id),
      category: "onboarding",
      title: `Onboarding ${String(row.document_number ?? "")}`.trim(),
      requester: "HR Onboarding",
      status: String(row.status ?? "pending"),
      href: "/hr/onboarding",
    });
  }

  return items.slice(0, 12);
}

function buildRequestsFromInbox(items: HrEssInboxItem[]): ApprovalItem[] {
  return items
    .filter((item) => item.pending)
    .map((item) => ({
      id: `inbox-${item.id}`,
      category: item.category,
      title: item.title,
      requester: item.employee_name,
      status: item.status,
      href: inboxItemHref(item),
    }));
}

function buildActivities(
  overview: HrOverview,
  empById: Map<string, MasterEmployee>,
): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const row of overview.leaveRequests) {
    if (!["approved", "submitted"].includes(asStatus(row.status))) continue;
    const emp = empById.get(String(row.employee_id));
    items.push({
      id: `act-leave-${String(row.id)}`,
      action: asStatus(row.status) === "approved" ? "Leave Approved" : "Leave Submitted",
      detail: `${employeeNameFromMaster(emp, row)} · ${String(row.document_number ?? "")} · ${asNumber(row.days_count)} day(s)`,
      actor: "HR",
      at: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
    });
  }

  for (const row of [...overview.attendance]
    .sort(
      (a, b) =>
        new Date(String(b.attendance_date ?? 0)).getTime() -
        new Date(String(a.attendance_date ?? 0)).getTime(),
    )
    .slice(0, 8)) {
    const emp = empById.get(String(row.employee_id));
    items.push({
      id: `act-att-${String(row.id)}`,
      action: "Attendance Marked",
      detail: `${employeeNameFromMaster(emp, row)} · ${String(row.attendance_status)} · ${String(row.attendance_date ?? "").slice(0, 10)}`,
      actor: "System",
      at: String(row.updated_at ?? row.attendance_date ?? new Date().toISOString()),
    });
  }

  for (const row of overview.reviews.slice(0, 5)) {
    const emp = empById.get(String(row.employee_id));
    items.push({
      id: `act-prf-${String(row.id)}`,
      action: "Performance Review",
      detail: `${employeeNameFromMaster(emp, row)} · rating ${asNumber(row.overall_rating) || "—"} · ${String(row.status)}`,
      actor: "Reporting manager",
      at: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
    });
  }

  for (const row of overview.employment.slice(0, 5)) {
    const emp = empById.get(String(row.employee_id));
    items.push({
      id: `act-emp-${String(row.id)}`,
      action: "Employment Record",
      detail: `${employeeNameFromMaster(emp, row)} · ${String(row.employment_type)} · ${String(row.status)}`,
      actor: "HR Ops",
      at: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
    });
  }

  return items
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 20);
}

function buildNotifications(
  stats: HrDashboardStats,
  approvals: ApprovalItem[],
): NotificationItem[] {
  const now = Date.now();
  const items: NotificationItem[] = [];

  if (approvals.length > 0) {
    const leaveCount = approvals.filter((a) => a.category === "leave").length;
    if (leaveCount > 0) {
      items.push({
        id: "n-leave",
        kind: "leave",
        title: "Leave Pending",
        body: `${leaveCount} leave request(s) need attention.`,
        at: new Date(now).toISOString(),
        unread: true,
        href: "/hr/ess-inbox",
      });
    }
    const other = approvals.length - leaveCount;
    if (other > 0 && leaveCount === 0) {
      items.push({
        id: "n-approvals",
        kind: "leave",
        title: "Pending Approvals",
        body: `${approvals.length} approval(s) need attention.`,
        at: new Date(now).toISOString(),
        unread: true,
        href: "/hr/ess-inbox",
      });
    }
  }
  if (stats.upcomingBirthdays > 0) {
    items.push({
      id: "n-bday",
      kind: "birthday",
      title: "Upcoming Birthdays",
      body: `${stats.upcomingBirthdays} birthday(s) in the next 30 days.`,
      at: new Date(now - 3600_000).toISOString(),
      unread: true,
      href: "/hr",
    });
  }
  if (stats.onProbation > 0) {
    items.push({
      id: "n-prob",
      kind: "probation",
      title: "Probation Tracking",
      body: `${stats.onProbation} employee(s) currently on probation.`,
      at: new Date(now - 7200_000).toISOString(),
      unread: false,
    });
  }
  if (stats.openPositions > 0) {
    items.push({
      id: "n-hire",
      kind: "interview",
      title: "Open Requisitions",
      body: `${stats.openPositions} open requisition(s) · ${stats.candidatesInPipeline} in pipeline.`,
      at: new Date(now - 10_800_000).toISOString(),
      unread: false,
    });
  }
  if (stats.absentToday > 0) {
    items.push({
      id: "n-abs",
      kind: "leave",
      title: "Absent Today",
      body: `${stats.absentToday} employee(s) marked absent today.`,
      at: new Date(now - 1800_000).toISOString(),
      unread: true,
    });
  }

  return items;
}

function buildReports(): QuickReport[] {
  return [
    {
      id: "attendance",
      title: "Attendance Report",
      description: "Daily present / absent / WFH summary",
      href: "/hr/time",
    },
    {
      id: "leave",
      title: "Leave Report",
      description: "Balances, utilization, pending",
      href: "/hr/leave",
    },
    {
      id: "employee",
      title: "Employee Report",
      description: "Headcount by department & status",
      href: "/hr/workforce",
    },
    {
      id: "recruitment",
      title: "Recruitment Report",
      description: "Funnel and open roles",
      href: "/hr/recruitment",
    },
    {
      id: "payroll",
      title: "Payroll Report",
      description: "Structures, runs, payslips",
      href: "/hr/payroll",
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
        ["leave", "attendance"].includes(a.category),
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
        ["leave", "holiday", "birthday"].includes(c.type),
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
        onDutyToday: 0,
        lateArrivals: 0,
        onLeave: 0,
        payrollProcessed: 0,
        pendingApprovals: data.approvals.filter((a) => a.category === "offer").length,
      },
      approvals: data.approvals.filter((a) => ["offer", "onboarding"].includes(a.category)),
      calendar: data.calendar.filter((c) =>
        ["interview", "holiday"].includes(c.type),
      ),
      notifications: data.notifications.filter((n) =>
        ["interview", "offer"].includes(n.kind),
      ),
      reports: data.reports.filter((r) => ["recruitment", "employee"].includes(r.id)),
      activities: data.activities.filter((a) =>
        /hire|candidate|offer|interview|recruit|performance/i.test(a.action + a.detail),
      ),
    };
  }

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
    approvals: data.approvals.filter((a) => ["payroll", "expense"].includes(a.category)),
    calendar: data.calendar.filter((c) => ["payroll", "holiday"].includes(c.type)),
    notifications: data.notifications.filter((n) =>
      ["payroll_due", "policy"].includes(n.kind),
    ),
    reports: data.reports.filter((r) => ["payroll", "employee"].includes(r.id)),
    activities: data.activities.filter((a) =>
      /payroll|salary|employment/i.test(a.action + a.detail),
    ),
  };
}

export async function loadHrExecutiveDashboard(
  roleOverride?: DashboardRole,
): Promise<HrExecutiveDashboard> {
  const role = roleOverride ?? getDashboardRole();
  let overview: HrOverview | null = null;
  let employees: MasterEmployee[] = [];
  let departments: Department[] = [];
  let recruitment: Awaited<ReturnType<typeof loadRecruitmentOverview>> | null = null;
  let payroll: Awaited<ReturnType<typeof loadPayrollOverview>> | null = null;
  let essInbox: HrEssInboxItem[] = [];
  let partial = false;
  let authBlocked = false;

  try {
    const [ov, empRows, deptRows, rec, pay, inbox] = await Promise.all([
      loadHrOverview(),
      safeRows("/employees"),
      safeRows("/departments"),
      loadRecruitmentOverview().catch(() => null),
      loadPayrollOverview().catch(() => null),
      loadHrEssInbox({ includeCompoff: true }).catch(() => [] as HrEssInboxItem[]),
    ]);
    overview = ov;
    employees = empRows as MasterEmployee[];
    departments = deptRows as Department[];
    recruitment = rec;
    payroll = pay;
    essInbox = inbox;
    partial = Boolean(overview.partial);
    authBlocked =
      overview.statusCodes.includes(401) ||
      (!isAuthenticated() && overview.errors.length > 0);
  } catch (err) {
    partial = true;
    authBlocked =
      !isAuthenticated() || (err instanceof ApiClientError && err.status === 401);
    overview = {
      designations: [],
      profiles: [],
      employment: [],
      shifts: [],
      shiftAssignments: [],
      holidayCalendars: [],
      leaveTypes: [],
      leaveBalances: [],
      leaveRequests: [],
      attendance: [],
      documents: [],
      reviews: [],
      goals: [],
      appraisals: [],
      training: [],
      trainingAttendance: [],
      separation: [],
      errors: ["Failed to load HR dashboard sources"],
      statusCodes: [],
      partial: true,
    };
  }

  const { people, empById } = buildJoinedPeople(overview, employees, departments);
  const stats = buildStats(overview, people, recruitment, payroll);
  const approvals = [
    ...buildApprovals(overview, empById, recruitment),
    ...buildRequestsFromInbox(essInbox),
  ].slice(0, 16);
  const base: HrExecutiveDashboard = {
    role,
    displayName: greetingName(role),
    stats,
    charts: buildCharts(overview, people, recruitment),
    calendar: buildCalendar(overview, people, empById, recruitment),
    trainingItems: buildTrainingItems(overview),
    approvals,
    activities: buildActivities(overview, empById),
    notifications: buildNotifications(stats, approvals),
    reports: buildReports(),
    partial,
    authBlocked,
  };

  return filterDashboardByRole(base, role);
}

export function exportDashboardCsv(data: HrExecutiveDashboard): string {
  const rows = Object.entries(data.stats).map(
    ([key, value]) => `${key},${value}`,
  );
  return ["metric,value", ...rows].join("\n");
}

export function downloadBlob(filename: string, content: string, type = "text/csv"): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
