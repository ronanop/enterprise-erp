/**
 * HRMS executive dashboard — real API data only (no mock / localStorage metrics).
 * Joins the live Employee directory with HR attendance, leave, and recruitment APIs.
 * Payroll is intentionally excluded from this surface.
 */

import { isAuthenticated } from "@/lib/auth";
import {
  asNumber,
  asStatus,
  countByStatus,
  employeeDisplayName,
  loadHrOverview,
  type HrOverview,
  type HrRow,
} from "@/services/hr-service";
import { ApiClientError } from "@/services/api-client";
import { loadRecruitmentOverview } from "@/services/recruitment-service";
import { loadEmployeeDirectory } from "@/services/employee-management-service";
import type { EmployeeRecord } from "@/types/employee-management";
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
import { parseHolidaysJson } from "@/types/holiday-calendar";

const ROLE_KEY = "erp_hr_dashboard_role_v1";

/** Map free-text work locations to clean city labels for charts. */
function normalizeLocationCity(raw: string | null | undefined): string {
  const text = String(raw ?? "").trim();
  if (!text) return "Unassigned";

  const lower = text.toLowerCase();
  const rules: Array<{ test: RegExp; city: string }> = [
    { test: /\b(new\s*delhi|delhi|sultanpur|greater\s*kailash|noida|gurgaon|gurugram)\b/, city: "Delhi" },
    { test: /\b(mumbai|bombay)\b/, city: "Mumbai" },
    { test: /\b(bengaluru|bangalore)\b/, city: "Bengaluru" },
    { test: /\b(hyderabad)\b/, city: "Hyderabad" },
    { test: /\b(chennai|madras)\b/, city: "Chennai" },
    { test: /\b(pune)\b/, city: "Pune" },
    { test: /\b(kolkata|calcutta)\b/, city: "Kolkata" },
    { test: /\b(ahmedabad)\b/, city: "Ahmedabad" },
    { test: /\b(jaipur)\b/, city: "Jaipur" },
    { test: /\b(chandigarh)\b/, city: "Chandigarh" },
  ];
  for (const rule of rules) {
    if (rule.test.test(lower)) return rule.city;
  }

  // Prefer the first comma-separated segment when it looks like a place name.
  const first = text.split(",")[0]?.trim() ?? text;
  if (first.length <= 24) return first;
  return first.slice(0, 22) + "…";
}

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
  const ymd = value.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Parse YYYY-MM-DD as a local calendar date (avoids UTC-midnight shift). */
function parseLocalYmd(value: string): Date | null {
  const m = value.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return parseDate(value);
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
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthKeyOfValue(value: unknown): string | null {
  const ymd = isoDate(value);
  if (ymd) return ymd.slice(0, 7);
  const d = parseLocalYmd(String(value ?? ""));
  return d ? monthKey(d) : null;
}

/** Map an attendance row to the same buckets used on the Attendance register. */
function attendanceBucket(
  row: HrRow,
): "present" | "absent" | "leave" | "halfDay" | "late" | "other" {
  const st = asStatus(row.attendance_status);
  const notes = String(row.notes ?? "").toLowerCase();
  if (st === "half_day") return "halfDay";
  if (st === "late" || /late arrival/.test(notes)) return "late";
  if (
    ["on_leave", "leave", "paid_leave", "unpaid_leave", "pl", "sl", "cl"].includes(st) ||
    (st === "absent" && notes.includes("leave"))
  ) {
    return "leave";
  }
  if (st === "absent") return "absent";
  if (["present", "work_from_home", "wfh", "on_duty"].includes(st)) return "present";
  return "other";
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

type DashboardPerson = {
  emp: MasterEmployee;
  departmentName: string;
  locationName: string;
  gender: string;
  dob: unknown;
  doj: unknown;
  status: string;
};

/** Same employee universe as the Employees module — no demo/local seed rows. */
function peopleFromDirectory(records: EmployeeRecord[]): {
  people: DashboardPerson[];
  empById: Map<string, MasterEmployee>;
} {
  const people: DashboardPerson[] = records
    .filter((r) => !r.isDeleted)
    .map((r) => {
      const parts = r.displayName.trim().split(/\s+/).filter(Boolean);
      const emp: MasterEmployee = {
        id: r.id,
        first_name: parts[0] ?? "",
        last_name: parts.slice(1).join(" "),
        employee_code: r.employeeCode,
        date_of_joining: r.joiningDate,
        designation: r.designationName,
        status: r.lifecycleStatus,
        department_id: r.departmentId,
      };
      const locRaw =
        r.locationName ||
        r.extension?.employment?.location ||
        r.branchName ||
        "";
      return {
        emp,
        departmentName: (r.departmentName || r.extension?.employment?.departmentName || "").trim() || "Unassigned",
        locationName: normalizeLocationCity(locRaw) || "Unassigned",
        gender: String(r.gender || r.extension?.personal?.gender || "unspecified").toLowerCase(),
        dob: r.extension?.personal?.dateOfBirth || undefined,
        doj: r.joiningDate || r.extension?.employment?.joiningDate || undefined,
        status: String(r.lifecycleStatus || "active").toLowerCase(),
      };
    });
  const empById = new Map(people.map((p) => [String(p.emp.id), p.emp]));
  return { people, empById };
}

function buildStats(
  overview: HrOverview,
  people: DashboardPerson[],
  recruitment: Awaited<ReturnType<typeof loadRecruitmentOverview>> | null,
  onboardingInProcess = 0,
): HrDashboardStats {
  const today = todayIso();
  const activeEmployees = people.filter((p) =>
    ["active", "confirmed", "probation"].includes(p.status),
  ).length;

  const todayAttendance = overview.attendance.filter(
    (r) => isoDate(r.attendance_date) === today,
  );
  const bucketsToday = todayAttendance.map((r) => attendanceBucket(r));
  const presentToday = bucketsToday.filter((b) =>
    b === "present" || b === "late" || b === "halfDay",
  ).length;
  const absentToday = bucketsToday.filter((b) => b === "absent").length;
  const onDutyToday = todayAttendance.filter((r) => asStatus(r.attendance_status) === "on_duty").length;
  const lateArrivals = bucketsToday.filter((b) => b === "late").length;

  const onLeaveIds = new Set<string>();
  for (const r of overview.leaveRequests) {
    if (asStatus(r.status) !== "approved") continue;
    const start = isoDate(r.start_date);
    const end = isoDate(r.end_date) ?? start;
    if (!start || !end) continue;
    if (start <= today && today <= end) onLeaveIds.add(String(r.employee_id ?? ""));
  }
  for (const r of todayAttendance) {
    if (attendanceBucket(r) === "leave") onLeaveIds.add(String(r.employee_id ?? ""));
  }
  onLeaveIds.delete("");
  const onLeave = onLeaveIds.size;

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
    payrollProcessed: 0,
    upcomingBirthdays,
    upcomingAnniversaries,
    onProbation,
    onNoticePeriod,
    onboardingInProcess,
  };
}

function classifyLeaveBucket(code: string, name: string): "casual" | "sick" | "earned" | "unpaid" {
  const blob = `${code} ${name}`.toLowerCase();
  if (blob.includes("sick") || /\bsl\b/.test(blob)) return "sick";
  if (blob.includes("unpaid") || blob.includes("lwp") || blob.includes("without pay")) return "unpaid";
  if (
    blob.includes("earned") ||
    blob.includes("privilege") ||
    blob.includes("annual") ||
    /\b(el|pl)\b/.test(blob)
  ) {
    return "earned";
  }
  return "casual";
}

function buildCharts(
  overview: HrOverview,
  people: DashboardPerson[],
  recruitment: Awaited<ReturnType<typeof loadRecruitmentOverview>> | null,
  onboardingCases: Array<{ status?: string; candidateName?: string; progressPct?: number }> = [],
): HrDashboardCharts {
  const months = lastNMonthKeys(6);

  const employeeGrowth: NamedCount[] = months.map((key) => {
    const [y, m] = key.split("-").map(Number);
    const cutoff = new Date(y, m, 0); // end of month
    const currentKey = monthKey(new Date());
    const value = people.filter((p) => {
      const doj = typeof p.doj === "string" ? parseLocalYmd(p.doj) : parseDate(p.doj);
      if (!doj) return key === currentKey;
      return doj <= cutoff;
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

  const locationMap = new Map<string, number>();
  for (const p of people) {
    const label = p.locationName || "Unassigned";
    locationMap.set(label, (locationMap.get(label) ?? 0) + 1);
  }
  const locationWise = [...locationMap.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

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
  const stageRank = (row: HrRow): number => {
    const raw = `${asStatus(row.current_stage_code)} ${asStatus(row.status)} ${asStatus(row.stage)}`;
    if (raw.includes("reject") || raw.includes("withdraw")) return -1;
    if (raw.includes("hire")) return 5;
    if (raw.includes("offer") || raw.includes("select")) return 4;
    if (raw.includes("interview")) return 3;
    if (raw.includes("screen")) return 2;
    if (raw.includes("applied") || raw.includes("apply") || raw.includes("new")) return 1;
    return 1;
  };
  const hiringFunnel: NamedCount[] = [
    { label: "Applied", value: apps.filter((a) => stageRank(a) >= 1).length },
    { label: "Screening", value: apps.filter((a) => stageRank(a) >= 2).length },
    { label: "Interview", value: apps.filter((a) => stageRank(a) >= 3).length },
    { label: "Offer", value: apps.filter((a) => stageRank(a) >= 4).length },
    { label: "Hired", value: apps.filter((a) => stageRank(a) >= 5).length },
  ];

  const attendanceStacked = months.map((key) => {
    const rows = overview.attendance.filter((r) => monthKeyOfValue(r.attendance_date) === key);
    let present = 0;
    let absent = 0;
    let halfDay = 0;
    let late = 0;
    let leaveFromAtt = 0;
    for (const r of rows) {
      const b = attendanceBucket(r);
      if (b === "present") present += 1;
      else if (b === "absent") absent += 1;
      else if (b === "halfDay") halfDay += 1;
      else if (b === "late") late += 1;
      else if (b === "leave") leaveFromAtt += 1;
    }
    const leaveFromRequests = overview.leaveRequests.filter((r) => {
      if (asStatus(r.status) !== "approved") return false;
      return monthKeyOfValue(r.start_date) === key;
    }).length;
    return {
      label: monthLabel(key),
      present,
      absent,
      leave: rows.length > 0 ? leaveFromAtt : leaveFromRequests,
      halfDay,
      late,
    };
  });

  const attendanceTrend: NamedCount[] = attendanceStacked.map((row) => ({
    label: row.label,
    value: row.present,
  }));

  const leaveTypeById = new Map(
    overview.leaveTypes.map((t) => [
      String(t.id),
      {
        code: String(t.leave_type_code ?? t.code ?? ""),
        name: String(t.leave_type_name ?? t.name ?? ""),
      },
    ]),
  );

  const leaveTrendByType = months.map((key) => {
    const point = {
      label: monthLabel(key),
      casual: 0,
      sick: 0,
      earned: 0,
      unpaid: 0,
    };
    for (const r of overview.leaveRequests) {
      if (!["approved", "submitted"].includes(asStatus(r.status))) continue;
      const d = monthKeyOfValue(r.start_date);
      if (d !== key) continue;
      const lt = leaveTypeById.get(String(r.leave_type_id ?? ""));
      const bucket = classifyLeaveBucket(lt?.code ?? "", lt?.name ?? "");
      point[bucket] += 1;
    }
    return point;
  });

  const leaveTrend: NamedCount[] = leaveTrendByType.map((row) => ({
    label: row.label,
    value: row.casual + row.sick + row.earned + row.unpaid,
  }));

  const onboardingStatusOrder: { status: string; label: string }[] = [
    { status: "ready_to_join", label: "Ready to Join" },
    { status: "joined", label: "Joined" },
    { status: "pending_join", label: "Pending Join" },
  ];
  const onboardingByStatus = new Map<string, number>();
  for (const row of onboardingCases) {
    const st = String(row.status ?? "").toLowerCase();
    if (!st || st === "cancelled") continue;
    const bucket =
      st === "joined" ? "joined" : st === "ready_to_join" ? "ready_to_join" : "pending_join";
    onboardingByStatus.set(bucket, (onboardingByStatus.get(bucket) ?? 0) + 1);
  }
  const onboardingProgress: NamedCount[] = onboardingStatusOrder.map((s) => ({
    label: s.label,
    value: onboardingByStatus.get(s.status) ?? 0,
  }));

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
    locationWise,
    genderDiversity,
    ageDistribution,
    hiringFunnel,
    attendanceTrend,
    attendanceStacked,
    leaveTrend,
    leaveTrendByType,
    onboardingProgress,
    attritionTrend,
    performanceDistribution,
    trainingCompletion,
  };
}

function buildCalendar(
  overview: HrOverview,
  people: DashboardPerson[],
  empById: Map<string, MasterEmployee>,
  recruitment: Awaited<ReturnType<typeof loadRecruitmentOverview>> | null,
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const now = new Date();

  for (const p of people) {
    const dob = parseDate(p.dob);
    if (dob) {
      const next = new Date(now.getFullYear(), dob.getMonth(), dob.getDate());
      if (next < startOfDay(now)) next.setFullYear(now.getFullYear() + 1);
      const diff = (next.getTime() - startOfDay(now).getTime()) / 86_400_000;
      if (diff >= 0 && diff <= 14) {
        events.push({
          id: `bday-${String(p.emp.id)}`,
          title: employeeNameFromMaster(p.emp),
          type: "birthday",
          at: next.toISOString(),
          meta: p.departmentName,
        });
      }
    }
    const doj = parseDate(p.doj);
    if (doj) {
      const next = new Date(now.getFullYear(), doj.getMonth(), doj.getDate());
      if (next < startOfDay(now)) next.setFullYear(now.getFullYear() + 1);
      const years = next.getFullYear() - doj.getFullYear();
      const diff = (next.getTime() - startOfDay(now).getTime()) / 86_400_000;
      if (years > 0 && diff >= 0 && diff <= 14) {
        events.push({
          id: `ann-${String(p.emp.id)}`,
          title: employeeNameFromMaster(p.emp),
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

  const today = startOfDay(now);
  for (const cal of overview.holidayCalendars) {
    if (asStatus(cal.status) === "archived") continue;
    const holidays = parseHolidaysJson(cal.holidays_json);
    for (const h of holidays) {
      const base = parseLocalYmd(h.date);
      if (!base) continue;
      const yearly = h.repeat === "every_year" || h.frequency === "yearly";
      let at = startOfDay(base);
      if (yearly) {
        at = new Date(now.getFullYear(), base.getMonth(), base.getDate());
        if (at < today) at.setFullYear(now.getFullYear() + 1);
      } else if (at < today) {
        continue;
      }
      events.push({
        id: `hol-${h.id || h.date}-${cal.id ?? "cal"}`,
        title: h.title || h.name || "Holiday",
        type: "holiday",
        at: at.toISOString(),
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

  const sorted = events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  const holidays = sorted.filter((e) => e.type === "holiday");
  const others = sorted.filter((e) => e.type !== "holiday").slice(0, 24);
  return [...others, ...holidays];
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
      reports: data.reports.filter((r) => ["attendance", "leave"].includes(r.id)),
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
    approvals: data.approvals.filter((a) => a.category === "expense"),
    calendar: data.calendar.filter((c) => c.type === "holiday"),
    notifications: data.notifications.filter((n) => n.kind === "policy"),
    reports: data.reports.filter((r) => r.id === "employee"),
    activities: data.activities.filter((a) =>
      /employment/i.test(a.action + a.detail),
    ),
  };
}

export async function loadHrExecutiveDashboard(
  roleOverride?: DashboardRole,
): Promise<HrExecutiveDashboard> {
  const role = roleOverride ?? getDashboardRole();
  let overview: HrOverview | null = null;
  let directoryRecords: EmployeeRecord[] = [];
  let recruitment: Awaited<ReturnType<typeof loadRecruitmentOverview>> | null = null;
  let essInbox: HrEssInboxItem[] = [];
  let onboardingInProcess = 0;
  let onboardingCases: Array<{
    status?: string;
    candidateName?: string;
    progressPct?: number;
  }> = [];
  let partial = false;
  let authBlocked = false;

  try {
    const [ov, directory, rec, inbox, onboardingDir] = await Promise.all([
      loadHrOverview(),
      loadEmployeeDirectory().catch(() => ({ records: [] as EmployeeRecord[], errors: ["employees"] })),
      loadRecruitmentOverview().catch(() => null),
      loadHrEssInbox({ includeCompoff: true }).catch(() => [] as HrEssInboxItem[]),
      import("@/services/onboarding-management-service")
        .then((m) => m.loadOnboardingDirectory())
        .catch(() => null),
    ]);
    overview = ov;
    directoryRecords = directory.records ?? [];
    recruitment = rec;
    essInbox = inbox;
    if (onboardingDir?.cases) {
      onboardingCases = onboardingDir.cases.map((c) => ({
        status: c.status,
        candidateName: c.candidateName,
        progressPct: c.progressPct,
      }));
      onboardingInProcess = onboardingDir.cases.filter((c) => {
        const st = String(c.status ?? "").toLowerCase();
        if (["joined", "cancelled"].includes(st)) return false;
        return Boolean(c.invitation?.sentAt) || ["invitation_sent", "in_progress", "submitted", "hr_review"].includes(st);
      }).length;
    }
    partial = Boolean(overview.partial) || Boolean(directory.errors?.length);
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

  const { people, empById } = peopleFromDirectory(directoryRecords);
  const stats = buildStats(overview, people, recruitment, onboardingInProcess);
  const approvals = [
    ...buildApprovals(overview, empById, recruitment),
    ...buildRequestsFromInbox(essInbox),
  ].slice(0, 16);
  const base: HrExecutiveDashboard = {
    role,
    displayName: greetingName(role),
    stats,
    charts: buildCharts(overview, people, recruitment, onboardingCases),
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
