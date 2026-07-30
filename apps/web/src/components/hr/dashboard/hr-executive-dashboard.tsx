"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Briefcase,
  CalendarDays,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  FileText,
  Search,
  UserPlus,
  Users,
  Wallet,
  Clock,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

import {
  HrAuthBanner,
  HrEmptyState,
  HrStatusBadge,
} from "@/components/hr/hr-primitives";
import {
  PremiumAreaChart,
  PremiumBarChart,
  PremiumDonutChart,
  PremiumFunnelChart,
} from "@/components/hr/dashboard/hr-analytics-charts";
import { toast, SetupToastHost } from "@/components/hr/setup/setup-toast";
import { EmsSkeleton } from "@/components/hr/workforce/ems-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  downloadBlob,
  exportDashboardCsv,
  getDashboardRole,
  greetingForHour,
  loadHrExecutiveDashboard,
  setDashboardRole,
} from "@/services/hr-executive-dashboard-service";
import type {
  DashboardRole,
  HrExecutiveDashboard,
} from "@/types/hr-executive-dashboard";
import { DASHBOARD_ROLE_LABELS } from "@/types/hr-executive-dashboard";

const QUICK_ACTIONS = [
  { label: "Hire via onboarding", href: "/hr/onboarding", icon: UserPlus },
  { label: "Create Job", href: "/hr/recruitment", icon: Briefcase },
  { label: "Run Payroll", href: "/hr/payroll", icon: Wallet },
  { label: "Mark Attendance", href: "/hr/time", icon: ClipboardCheck },
  { label: "Apply Leave", href: "/hr/leave", icon: CalendarDays },
  { label: "Assign Shift", href: "/hr/roster", icon: Clock },
  { label: "Start Onboarding", href: "/hr/onboarding", icon: Users },
  { label: "Generate Report", href: "/hr/reports", icon: FileText },
] as const;

const EVENT_LABELS: Record<string, string> = {
  birthday: "Birthday",
  anniversary: "Anniversary",
  interview: "Interview",
  leave: "Leave",
  holiday: "Holiday",
  meeting: "Meeting",
  payroll: "Payroll",
};

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

export function HrExecutiveDashboardPage() {
  const [data, setData] = useState<HrExecutiveDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<DashboardRole>("hr");
  const [query, setQuery] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const now = useClock();

  const load = useCallback(async (r?: DashboardRole) => {
    setLoading(true);
    try {
      const nextRole = r ?? getDashboardRole();
      setRole(nextRole);
      setData(await loadHrExecutiveDashboard(nextRole));
    } catch {
      toast("Failed to load HR dashboard", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unread = useMemo(
    () => data?.notifications.filter((n) => n.unread).length ?? 0,
    [data],
  );

  const filteredCalendar = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = data?.calendar ?? [];
    if (!q) return rows;
    return rows.filter((e) =>
      [e.title, e.type, e.meta ?? ""].join(" ").toLowerCase().includes(q),
    );
  }, [data, query]);

  const filteredApprovals = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = data?.approvals ?? [];
    if (!q) return rows;
    return rows.filter((a) =>
      [a.title, a.requester, a.category].join(" ").toLowerCase().includes(q),
    );
  }, [data, query]);

  const stats = data?.stats;
  const charts = data?.charts;

  const kpiCards = [
    { label: "Headcount", value: stats?.totalEmployees, icon: Users, hint: "Active workforce" },
    { label: "Present Today", value: stats?.presentToday, icon: ClipboardCheck, hint: "Attendance" },
    { label: "On Leave", value: stats?.onLeave, icon: CalendarDays, hint: "Approved today" },
    { label: "Pending Approvals", value: stats?.pendingApprovals, icon: ClipboardCheck, hint: "Leave / shifts" },
    { label: "Open Roles", value: stats?.openPositions, icon: Briefcase, hint: "Requisitions" },
    { label: "Pipeline", value: stats?.candidatesInPipeline, icon: Users, hint: "Active applicants" },
  ];

  const showRecruiting = role === "hr" || role === "super_admin" || role === "recruiter";
  const showPayroll = role === "hr" || role === "super_admin" || role === "finance";
  const showPeopleAnalytics = role !== "employee" && role !== "recruiter";

  return (
    <div className="space-y-5">
      <SetupToastHost />

      {/* Top section */}
      <div className="rounded-xl border border-border/70 bg-card px-4 py-4 shadow-sm sm:px-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              HRMS Executive Dashboard
              {role === "super_admin" ? " · All companies" : null}
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {greetingForHour(now)}, {data?.displayName ?? DASHBOARD_ROLE_LABELS[role]}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>
                {now.toLocaleDateString("en-IN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <span className="hidden sm:inline">·</span>
              <span className="font-mono tabular-nums">
                {now.toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Quick search…"
                className="h-9 pl-8"
              />
            </div>

            <select
              className="h-9 cursor-pointer rounded-md border border-input bg-background px-2 text-xs"
              value={role}
              onChange={(e) => {
                const next = e.target.value as DashboardRole;
                setDashboardRole(next);
                void load(next);
              }}
              aria-label="Dashboard role"
            >
              {(Object.keys(DASHBOARD_ROLE_LABELS) as DashboardRole[]).map((r) => (
                <option key={r} value={r}>
                  {DASHBOARD_ROLE_LABELS[r]}
                </option>
              ))}
            </select>

            <div className="relative">
              <Button
                size="sm"
                variant="outline"
                className="cursor-pointer"
                onClick={() => setNotifOpen((v) => !v)}
              >
                <Bell className="size-3.5" />
                {unread > 0 ? (
                  <span className="ml-1 rounded-full bg-destructive px-1.5 text-[10px] text-white">
                    {unread}
                  </span>
                ) : null}
              </Button>
              {notifOpen ? (
                <div className="absolute right-0 z-20 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-border/80 bg-card p-2 shadow-lg">
                  <p className="px-2 py-1.5 text-xs font-semibold">Notifications</p>
                  <ul className="max-h-72 space-y-1 overflow-y-auto">
                    {(data?.notifications ?? []).map((n) => (
                      <li
                        key={n.id}
                        className={cn(
                          "rounded-lg px-2 py-2 text-xs transition-colors duration-150 hover:bg-muted/60",
                          n.unread && "bg-primary/5",
                        )}
                      >
                        <p className="font-medium">{n.title}</p>
                        <p className="mt-0.5 text-muted-foreground">{n.body}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            <Button
              size="sm"
              variant="outline"
              className="cursor-pointer"
              disabled={loading}
              onClick={() => void load(role)}
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
              Refresh
            </Button>

            <div className="flex h-9 items-center gap-2 rounded-md border border-border/70 bg-muted/40 px-2.5 text-xs">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                {(data?.displayName ?? "HR").slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden font-medium sm:inline">
                {DASHBOARD_ROLE_LABELS[role]}
              </span>
            </div>
          </div>
        </div>
      </div>

      {data?.authBlocked ? <HrAuthBanner /> : null}
      {data?.partial && !data.authBlocked ? (
        <div className="rounded-xl border border-border/80 bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
          Some HR endpoints returned partial data. Showing live + operational workspace metrics.
        </div>
      ) : null}

      {/* Quick actions */}
      <section>
        <h2 className="mb-2 text-sm font-semibold tracking-tight">Quick Actions</h2>
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-4 xl:grid-cols-8">
          {QUICK_ACTIONS.filter((a) => {
            if (role === "employee") {
              return ["Apply Leave", "Mark Attendance", "Generate Report"].includes(a.label);
            }
            if (role === "recruiter") {
              return ["Create Job", "Start Onboarding", "Generate Report"].includes(a.label);
            }
            if (role === "finance") {
              return ["Run Payroll", "Generate Report"].includes(a.label);
            }
            if (role === "manager") {
              return ![
                "Run Payroll",
                "Create Job",
              ].includes(a.label);
            }
            return true;
          }).map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.href + a.label}
                href={a.href}
                className="group flex cursor-pointer flex-col items-start gap-2 rounded-xl border border-border/70 bg-card px-3 py-3 shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-primary/30 hover:shadow-md"
              >
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-3.5" />
                </span>
                <span className="text-xs font-medium leading-snug">{a.label}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {loading && !data ? (
        <EmsSkeleton rows={8} />
      ) : (
        <>
          {/* Slim KPI strip */}
          <section>
            <div className="mb-2 flex items-end justify-between gap-2">
              <h2 className="text-sm font-semibold tracking-tight">Key metrics</h2>
              <p className="text-[11px] text-muted-foreground">
                Live from employees · attendance · leave · recruitment
              </p>
            </div>
            <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
              {kpiCards.map((k) => {
                const Icon = k.icon;
                return (
                  <div
                    key={k.label}
                    className="rounded-xl border border-border/70 bg-card px-3 py-3 shadow-sm transition-shadow duration-200 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase leading-tight">
                          {k.label}
                        </p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground/80">{k.hint}</p>
                      </div>
                      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                    </div>
                    <p className="mt-1.5 text-xl font-semibold tabular-nums text-foreground">
                      {loading ? "—" : (k.value ?? 0).toLocaleString("en-IN")}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Analytics — premium charts */}
          <section className="space-y-3">
            <div className="flex items-end justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold tracking-tight">HR Analytics</h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Pie · trends · funnel — live from related ERP tables
                </p>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {showPeopleAnalytics ? (
                <>
                  <PremiumAreaChart
                    title="Employee Growth"
                    subtitle="Cumulative headcount by joining date"
                    data={charts?.employeeGrowth ?? []}
                    color="#0F766E"
                  />
                  <PremiumBarChart
                    title="Department-wise Employees"
                    subtitle="master_employee → org_department"
                    data={charts?.departmentWise ?? []}
                    layout="horizontal"
                  />
                  <PremiumDonutChart
                    title="Gender Diversity"
                    subtitle="hr_employee_profile.gender"
                    data={charts?.genderDiversity ?? []}
                  />
                  <PremiumBarChart
                    title="Age Distribution"
                    subtitle="hr_employee_profile.date_of_birth"
                    data={charts?.ageDistribution ?? []}
                  />
                </>
              ) : null}

              {showRecruiting ? (
                <PremiumFunnelChart
                  title="Hiring Funnel"
                  subtitle="recruitment.rec_application stages"
                  data={charts?.hiringFunnel ?? []}
                />
              ) : null}

              {role !== "recruiter" && role !== "finance" ? (
                <>
                  <PremiumAreaChart
                    title="Attendance Trend"
                    subtitle="Present / WFH days by month"
                    data={charts?.attendanceTrend ?? []}
                    color="#0891B2"
                  />
                  <PremiumAreaChart
                    title="Leave Trend"
                    subtitle="Submitted + approved requests by month"
                    data={charts?.leaveTrend ?? []}
                    color="#D97706"
                  />
                </>
              ) : null}

              {showPayroll ? (
                <PremiumAreaChart
                  title="Payroll Cost Trend"
                  subtitle="Est. monthly CTC from hr_employment"
                  data={charts?.payrollCostTrend ?? []}
                  color="#2563EB"
                  formatValue={(n) =>
                    n >= 100000
                      ? `₹${(n / 100000).toFixed(1)}L`
                      : `₹${n.toLocaleString("en-IN")}`
                  }
                />
              ) : null}

              {showPeopleAnalytics ? (
                <>
                  <PremiumAreaChart
                    title="Attrition Trend"
                    subtitle="% exits / headcount"
                    data={charts?.attritionTrend ?? []}
                    color="#DC2626"
                    formatValue={(n) => `${n}%`}
                  />
                  <PremiumDonutChart
                    title="Performance Distribution"
                    subtitle="hr_performance_review.overall_rating"
                    data={charts?.performanceDistribution ?? []}
                  />
                  <PremiumDonutChart
                    title="Training Completion"
                    subtitle="hr_training_attendance"
                    data={charts?.trainingCompletion ?? []}
                  />
                </>
              ) : null}
            </div>
          </section>

          {/* Calendar / Approvals / Notifications */}
          <div className="grid gap-3 xl:grid-cols-3">
            <section className="rounded-xl border border-border/70 bg-card shadow-sm">
              <div className="border-b border-border/70 px-4 py-3">
                <h2 className="text-sm font-semibold">Today&apos;s Events & Calendar</h2>
                <p className="text-[11px] text-muted-foreground">
                  Birthdays, interviews, leaves, holidays, payroll
                </p>
              </div>
              <ul className="divide-y divide-border/60">
                {filteredCalendar.length === 0 ? (
                  <li className="p-6">
                    <HrEmptyState title="No events" description="Nothing scheduled nearby." />
                  </li>
                ) : (
                  filteredCalendar.map((e) => (
                    <li
                      key={e.id}
                      className="flex items-start gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-muted/40"
                    >
                      <span className="mt-0.5 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase">
                        {EVENT_LABELS[e.type] ?? e.type}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{e.title}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(e.at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}
                          {e.meta ? ` · ${e.meta}` : ""}
                        </p>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </section>

            <section className="rounded-xl border border-border/70 bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold">Pending Approvals</h2>
                  <p className="text-[11px] text-muted-foreground">
                    Leave, attendance, payroll, offers
                  </p>
                </div>
                <HrStatusBadge status={`${filteredApprovals.length} open`} />
              </div>
              <ul className="divide-y divide-border/60">
                {filteredApprovals.length === 0 ? (
                  <li className="p-6">
                    <HrEmptyState title="All clear" description="No pending approvals." />
                  </li>
                ) : (
                  filteredApprovals.slice(0, 8).map((a) => (
                    <li key={a.id}>
                      <Link
                        href={a.href}
                        className="flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-muted/40"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{a.title}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {a.requester} · {a.category}
                          </p>
                        </div>
                        <HrStatusBadge status={a.status} />
                        <ChevronRight className="size-3.5 text-muted-foreground" />
                      </Link>
                    </li>
                  ))
                )}
              </ul>
            </section>

            <section className="rounded-xl border border-border/70 bg-card shadow-sm">
              <div className="border-b border-border/70 px-4 py-3">
                <h2 className="text-sm font-semibold">Notification Center</h2>
                <p className="text-[11px] text-muted-foreground">
                  Payroll, interviews, documents, policy
                </p>
              </div>
              <ul className="divide-y divide-border/60">
                {(data?.notifications ?? []).length === 0 ? (
                  <li className="p-6">
                    <HrEmptyState title="No notifications" />
                  </li>
                ) : (
                  (data?.notifications ?? []).map((n) => (
                    <li
                      key={n.id}
                      className={cn(
                        "px-4 py-2.5 transition-colors duration-150 hover:bg-muted/40",
                        n.unread && "bg-primary/5",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">{n.title}</p>
                        {n.unread ? (
                          <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{n.body}</p>
                    </li>
                  ))
                )}
              </ul>
            </section>
          </div>

          {/* Activity + Reports */}
          <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
            <section className="rounded-xl border border-border/70 bg-card shadow-sm">
              <div className="border-b border-border/70 px-4 py-3">
                <h2 className="text-sm font-semibold">Recent Activities</h2>
                <p className="text-[11px] text-muted-foreground">Organization timeline</p>
              </div>
              <ul className="relative space-y-0 px-4 py-3">
                {(data?.activities ?? []).length === 0 ? (
                  <HrEmptyState title="No recent activity" />
                ) : (
                  (data?.activities ?? []).slice(0, 12).map((a, idx) => (
                    <li key={a.id} className="relative flex gap-3 pb-4 last:pb-0">
                      {idx < (data?.activities.length ?? 0) - 1 ? (
                        <span className="absolute top-3 left-[7px] h-[calc(100%-8px)] w-px bg-border" />
                      ) : null}
                      <span className="relative z-[1] mt-1 size-3.5 shrink-0 rounded-full border-2 border-primary bg-card" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{a.action}</p>
                        <p className="text-[11px] text-muted-foreground">{a.detail}</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {a.actor} · {new Date(a.at).toLocaleString("en-IN")}
                        </p>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </section>

            <section className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
              <h2 className="text-sm font-semibold">Quick Reports</h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Export Excel / CSV or open module reports
              </p>
              <div className="mt-3 space-y-2">
                {(data?.reports ?? []).map((r) => (
                  <Link
                    key={r.id}
                    href={r.href}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2.5 transition-colors duration-150 hover:bg-muted/50"
                  >
                    <div>
                      <p className="text-sm font-medium">{r.title}</p>
                      <p className="text-[11px] text-muted-foreground">{r.description}</p>
                    </div>
                    <ChevronRight className="size-3.5 text-muted-foreground" />
                  </Link>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="cursor-pointer"
                  disabled={!data}
                  onClick={() => {
                    if (!data) return;
                    downloadBlob(
                      `hr-dashboard-${new Date().toISOString().slice(0, 10)}.csv`,
                      exportDashboardCsv(data),
                    );
                    toast("Downloaded Excel/CSV");
                  }}
                >
                  <FileSpreadsheet className="size-3.5" />
                  Download Excel
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="cursor-pointer"
                  disabled={!data}
                  onClick={() => {
                    if (!data) return;
                    const text = [
                      "HRMS Executive Dashboard",
                      `Role: ${DASHBOARD_ROLE_LABELS[data.role]}`,
                      `Generated: ${new Date().toLocaleString()}`,
                      "",
                      ...Object.entries(data.stats).map(
                        ([k, v]) => `${k}: ${v}`,
                      ),
                    ].join("\n");
                    downloadBlob(
                      `hr-dashboard-${new Date().toISOString().slice(0, 10)}.txt`,
                      text,
                      "text/plain",
                    );
                    toast("Downloaded PDF-ready summary");
                  }}
                >
                  <Download className="size-3.5" />
                  Download PDF
                </Button>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

/** Back-compat export used by `/hr` page */
export function HrDashboard() {
  return <HrExecutiveDashboardPage />;
}
