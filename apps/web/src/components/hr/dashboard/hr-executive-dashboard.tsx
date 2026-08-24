"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Briefcase,
  CalendarDays,
  ClipboardCheck,
  FileText,
  LayoutGrid,
  Search,
  UserPlus,
  Users,
  Wallet,
  ChevronRight,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";

import {
  HrAuthBanner,
} from "@/components/hr/hr-primitives";
import {
  PremiumAreaChart,
  PremiumBarChart,
  PremiumDonutChart,
} from "@/components/hr/dashboard/hr-analytics-charts";
import { CustomizableAnalyticsBoard } from "@/components/hr/dashboard/customizable-analytics-board";
import { toast, SetupToastHost } from "@/components/hr/setup/setup-toast";
import { EmsSkeleton } from "@/components/hr/workforce/ems-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  getDashboardRole,
  greetingForHour,
  loadHrExecutiveDashboard,
  setDashboardRole,
} from "@/services/hr-executive-dashboard-service";
import type {
  ApprovalItem,
  CalendarEvent,
  DashboardRole,
  HrExecutiveDashboard,
} from "@/types/hr-executive-dashboard";
import { DASHBOARD_ROLE_LABELS } from "@/types/hr-executive-dashboard";

const QUICK_ACTIONS = [
  { label: "Employee", href: "/hr/workforce", icon: Users },
  { label: "Payroll", href: "/hr/payroll", icon: Wallet },
  { label: "Leave", href: "/hr/leave", icon: CalendarDays },
  { label: "Onboarding", href: "/hr/onboarding", icon: UserPlus },
  { label: "Create Job", href: "/hr/recruitment", icon: Briefcase },
  { label: "Attendance", href: "/hr/time", icon: ClipboardCheck },
] as const;

function quickActionsForRole(role: DashboardRole): typeof QUICK_ACTIONS[number][] {
  if (role === "employee") {
    return QUICK_ACTIONS.filter((a) => ["Leave", "Attendance"].includes(a.label));
  }
  if (role === "recruiter") {
    return QUICK_ACTIONS.filter((a) =>
      ["Create Job", "Onboarding", "Employee"].includes(a.label),
    );
  }
  if (role === "finance") {
    return QUICK_ACTIONS.filter((a) => ["Payroll", "Employee"].includes(a.label));
  }
  if (role === "manager") {
    return QUICK_ACTIONS.filter((a) => !["Create Job", "Payroll"].includes(a.label));
  }
  return [...QUICK_ACTIONS];
}

const EVENT_LABELS: Record<string, string> = {
  birthday: "Birthday",
  anniversary: "Anniversary",
  holiday: "Holiday",
};

const REQUEST_LABELS: Record<string, string> = {
  leave: "Leave",
  attendance: "Attendance",
  onboarding: "Onboarding",
  payroll: "Payroll",
  expense: "Expense",
  asset: "Asset",
  offer: "Offer",
  compoff: "Compensatory",
  on_duty: "On Duty",
  ot_allotment: "OT / Overday",
  attendance_correction: "Attendance correction",
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

  const upcomingEvents = useMemo(
    () =>
      filteredCalendar.filter((e) => ["birthday", "anniversary", "holiday"].includes(e.type)),
    [filteredCalendar],
  );

  const requestItems = filteredApprovals;
  const roleQuickActions = quickActionsForRole(role);

  const stats = data?.stats;
  const charts = data?.charts;

  const kpiCards: {
    label: string;
    value: number | undefined;
    icon: typeof Users;
    href?: string;
  }[] = [
    {
      label: "Headcount",
      value: stats?.totalEmployees,
      icon: Users,
      href: "/hr/workforce",
    },
    {
      label: "On leave today",
      value: stats?.onLeave,
      icon: CalendarDays,
      href: "/hr/leave?view=on-leave-today",
    },
    {
      label: "Open roles",
      value: stats?.openPositions,
      icon: Briefcase,
      href: "/hr/recruitment",
    },
    {
      label: "Onboarding in process",
      value: stats?.onboardingInProcess,
      icon: UserPlus,
      href: "/hr/onboarding",
    },
  ];

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

            <div className="flex h-9 items-center gap-2 rounded-md border border-border/70 bg-muted/40 px-2.5 text-xs">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                {(data?.displayName ?? "HR").slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden font-medium sm:inline">
                {DASHBOARD_ROLE_LABELS[role]}
              </span>
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
          </div>
        </div>
      </div>

      {data?.authBlocked ? <HrAuthBanner /> : null}
      {data?.partial && !data.authBlocked ? (
        <div className="rounded-xl border border-border/80 bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
          Some HR endpoints returned partial data. Showing live + operational workspace metrics.
        </div>
      ) : null}

      {loading && !data ? (
        <EmsSkeleton rows={8} />
      ) : (
        <>
          {/* Top row — 4 portrait (3:4) boxes, then key metrics below */}
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <DashboardListBox
              title="Upcoming Events"
              subtitle="Holidays, birthdays, anniversaries"
              icon={CalendarDays}
              footerHref="/hr/setup?section=leave&tab=holiday-calendar"
              footerLabel="Holiday calendar"
              portrait
            >
              {upcomingEvents.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">No upcoming events</p>
              ) : (
                <ul className="space-y-2">
                  {upcomingEvents.slice(0, 6).map((e) => (
                    <EventRow key={e.id} event={e} />
                  ))}
                </ul>
              )}
            </DashboardListBox>

            <DashboardListBox
              title="Quick Actions"
              subtitle="Open HR modules"
              icon={LayoutGrid}
              portrait
            >
              <div className="grid grid-cols-2 gap-2">
                {roleQuickActions.map((a) => {
                  const Icon = a.icon;
                  return (
                    <Link
                      key={a.href + a.label}
                      href={a.href}
                      className="group flex cursor-pointer flex-col items-start gap-1.5 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-2.5 transition-[border-color,background-color] duration-200 hover:border-primary/35 hover:bg-primary/5"
                    >
                      <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Icon className="size-3.5" />
                      </span>
                      <span className="text-[11px] font-medium leading-tight text-foreground">
                        {a.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </DashboardListBox>

            <DashboardListBox
              title="Requests"
              subtitle="Leave, compensatory, on duty & more"
              icon={FileText}
              footerHref="/hr/ess"
              footerLabel="Employee Requests"
              portrait
            >
              {requestItems.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">No open requests</p>
              ) : (
                <ul className="space-y-2">
                  {requestItems.slice(0, 6).map((a) => (
                    <RequestRow key={a.id} item={a} />
                  ))}
                </ul>
              )}
            </DashboardListBox>

            <DashboardListBox
              title="Today's attendance"
              subtitle={now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
              icon={ClipboardCheck}
              footerHref="/hr/time"
              footerLabel="Attendance"
              portrait
            >
              <div className="flex flex-col gap-3">
                <AttendanceStat
                  label="Today's present"
                  value={stats?.presentToday ?? 0}
                  variant="present"
                  vertical
                />
                <AttendanceStat
                  label="Today's absent"
                  value={stats?.absentToday ?? 0}
                  variant="absent"
                  vertical
                />
                <AttendanceStat
                  label="On Duty"
                  value={stats?.onDutyToday ?? 0}
                  variant="onDuty"
                  vertical
                />
              </div>
            </DashboardListBox>
          </section>

          {/* Key metrics — titles only */}
          <section>
            <div className="mb-2">
              <h2 className="text-sm font-semibold tracking-tight">Key Metrics</h2>
            </div>
            <div className="grid auto-rows-fr gap-2.5 grid-cols-2 xl:grid-cols-4">
              {kpiCards.map((k) => {
                const Icon = k.icon;
                const card = (
                  <div
                    className={cn(
                      "flex h-full min-h-[5rem] flex-col justify-between rounded-xl border border-border/70 bg-card px-3 py-3 shadow-sm transition-shadow duration-200",
                      k.href && "hover:border-primary/40 hover:shadow-md",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                        {k.label}
                      </p>
                      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                    </div>
                    <p className="mt-1.5 text-xl font-semibold tabular-nums text-foreground">
                      {loading ? "—" : (k.value ?? 0).toLocaleString("en-IN")}
                    </p>
                  </div>
                );
                return k.href ? (
                  <Link key={k.label} href={k.href} className="block h-full cursor-pointer">
                    {card}
                  </Link>
                ) : (
                  <div key={k.label} className="h-full">
                    {card}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Analytics — department & location stacked; editable layout */}
          {showPeopleAnalytics ? (
            <CustomizableAnalyticsBoard
              items={[
                {
                  id: "department",
                  defaultColSpan: 12,
                  defaultHeight: Math.max(280, 48 + (charts?.departmentWise?.length ?? 8) * 36),
                  node: (
                    <PremiumBarChart
                      title="Department-wise Employees"
                      data={charts?.departmentWise ?? []}
                      layout="horizontal"
                      showValues
                    />
                  ),
                },
                {
                  id: "location",
                  defaultColSpan: 12,
                  defaultHeight: Math.max(280, 48 + (charts?.locationWise?.length ?? 8) * 36),
                  node: (
                    <PremiumBarChart
                      title="Location-wise Employees"
                      data={charts?.locationWise ?? []}
                      layout="horizontal"
                      showValues
                    />
                  ),
                },
                {
                  id: "headcount",
                  defaultColSpan: 6,
                  defaultHeight: 260,
                  node: (
                    <PremiumBarChart
                      title="Head Count"
                      data={charts?.employeeGrowth ?? []}
                      showValues
                    />
                  ),
                },
                {
                  id: "gender",
                  defaultColSpan: 6,
                  defaultHeight: 260,
                  node: (
                    <PremiumDonutChart
                      title="Gender Diversity"
                      data={charts?.genderDiversity ?? []}
                    />
                  ),
                },
                ...(role !== "recruiter" && role !== "finance"
                  ? [
                      {
                        id: "attendance",
                        defaultColSpan: 6,
                        defaultHeight: 260,
                        node: (
                          <PremiumAreaChart
                            title="Attendance Trend"
                            data={charts?.attendanceTrend ?? []}
                            color="#0891B2"
                          />
                        ),
                      },
                      {
                        id: "leave",
                        defaultColSpan: 6,
                        defaultHeight: 260,
                        node: (
                          <PremiumAreaChart
                            title="Leave Trend"
                            data={charts?.leaveTrend ?? []}
                            color="#D97706"
                          />
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

function DashboardListBox({
  title,
  subtitle,
  icon: Icon,
  children,
  footerHref,
  footerLabel,
  className,
  portrait = false,
}: {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  children: ReactNode;
  footerHref?: string;
  footerLabel?: string;
  className?: string;
  /** ~3:4 portrait tile on xl screens */
  portrait?: boolean;
}) {
  return (
    <section
      className={cn(
        "flex flex-col rounded-xl border border-border/70 bg-card shadow-sm",
        portrait
          ? "min-h-[300px] xl:aspect-[3/4] xl:min-h-0 xl:max-h-[440px]"
          : "min-h-[280px]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2 border-b border-border/70 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3">{children}</div>
      {footerHref && footerLabel ? (
        <div className="border-t border-border/70 px-4 py-2">
          <Link
            href={footerHref}
            className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-medium text-primary transition-colors duration-150 hover:text-primary/80"
          >
            {footerLabel}
            <ChevronRight className="size-3" />
          </Link>
        </div>
      ) : null}
    </section>
  );
}

function AttendanceStat({
  label,
  value,
  variant,
  vertical = false,
}: {
  label: string;
  value: number;
  variant: "present" | "absent" | "leave" | "onDuty";
  vertical?: boolean;
}) {
  const tones = {
    present: "border-emerald-200/80 bg-emerald-50 text-emerald-900",
    absent: "border-red-200/80 bg-red-50 text-red-900",
    leave: "border-amber-200/80 bg-amber-50 text-amber-950",
    onDuty: "border-sky-200/80 bg-sky-50 text-sky-950",
  };
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-3",
        tones[variant],
        vertical ? "text-left" : "text-center",
      )}
    >
      <p className={cn("font-semibold tabular-nums leading-none", vertical ? "text-2xl" : "text-lg")}>
        {value.toLocaleString("en-IN")}
      </p>
      <p className="mt-1.5 text-[10px] font-medium uppercase tracking-wide opacity-90">{label}</p>
    </div>
  );
}

function RequestRow({ item }: { item: ApprovalItem }) {
  return (
    <li>
      <Link
        href={item.href}
        className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/50 bg-muted/20 px-2.5 py-2 transition-colors hover:bg-muted/40"
      >
        <span className="mt-0.5 shrink-0 rounded border border-border bg-background px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
          {REQUEST_LABELS[item.category] ?? item.category}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-foreground">{item.title}</p>
          <p className="text-[10px] text-muted-foreground">
            {item.requester} · {item.status}
          </p>
        </div>
      </Link>
    </li>
  );
}

function EventRow({ event, compact = false }: { event: CalendarEvent; compact?: boolean }) {
  return (
    <li
      className={cn(
        "flex items-start gap-2 rounded-lg border border-border/50 bg-muted/20",
        compact ? "px-2 py-1.5" : "px-2.5 py-2",
      )}
    >
      <span className="mt-0.5 shrink-0 rounded border border-border bg-background px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
        {EVENT_LABELS[event.type] ?? event.type}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-foreground">{event.title}</p>
        <p className="text-[10px] text-muted-foreground">
          {new Date(event.at).toLocaleDateString("en-IN", {
            weekday: "short",
            day: "numeric",
            month: "short",
          })}
          {event.meta ? ` · ${event.meta}` : ""}
        </p>
      </div>
    </li>
  );
}

/** Back-compat export used by `/hr` page */
export function HrDashboard() {
  return <HrExecutiveDashboardPage />;
}
