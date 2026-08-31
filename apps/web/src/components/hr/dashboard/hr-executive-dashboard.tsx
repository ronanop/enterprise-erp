"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Bell,
  Briefcase,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  FileStack,
  Fingerprint,
  GraduationCap,
  LayoutGrid,
  RefreshCw,
  Search,
  UserCheck,
  UserMinus,
  UserPlus,
  UserX,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { HrAuthBanner } from "@/components/hr/hr-primitives";
import {
  ChartHeightContext,
  PremiumBarChart,
  PremiumDonutChart,
  PremiumMultiLineChart,
  PremiumStackedBarChart,
} from "@/components/hr/dashboard/hr-analytics-charts";
import { toast, SetupToastHost } from "@/components/hr/setup/setup-toast";
import { EmsSkeleton } from "@/components/hr/workforce/ems-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  greetingForHour,
  loadHrExecutiveDashboard,
} from "@/services/hr-executive-dashboard-service";
import type {
  CalendarEvent,
  DashboardRole,
  HrExecutiveDashboard,
  LeaveTrendPoint,
  NamedCount,
  StackedAttendancePoint,
} from "@/types/hr-executive-dashboard";
import { DASHBOARD_ROLE_LABELS } from "@/types/hr-executive-dashboard";

const QUICK_ACTIONS = [
  { label: "Employees", href: "/hr/workforce", icon: Users },
  { label: "Attendance", href: "/hr/time", icon: ClipboardCheck },
  { label: "Onboarding", href: "/hr/onboarding", icon: UserPlus },
  { label: "Performance", href: "/hr/talent", icon: BadgeCheck },
  { label: "EDoc", href: "/hr/edoc", icon: FileStack },
  { label: "Employee Request", href: "/hr/ess", icon: Bell },
  { label: "Biometric Devices", href: "/hr/time/biometric-devices", icon: Fingerprint },
  { label: "Offboarding", href: "/hr/separation", icon: UserMinus },
  { label: "Payroll", href: "/hr/payroll", icon: Wallet },
  { label: "Training", href: "/hr/learning", icon: GraduationCap },
] as const;

const EVENT_PILLS: Record<string, { label: string; className: string }> = {
  birthday: { label: "Birthday", className: "bg-[#F4EDFB] text-[#9B5BB8]" },
  anniversary: { label: "Work Anniversary", className: "bg-[#FFF4E5] text-[#FF8904]" },
};

type AnalyticsPeriod = "this_month" | "last_3" | "last_6";

function sliceNamed(rows: NamedCount[], period: AnalyticsPeriod): NamedCount[] {
  const n = period === "this_month" ? 1 : period === "last_3" ? 3 : 6;
  return rows.slice(-n);
}

function sliceStacked(
  rows: StackedAttendancePoint[],
  period: AnalyticsPeriod,
): StackedAttendancePoint[] {
  const n = period === "this_month" ? 1 : period === "last_3" ? 3 : 6;
  return rows.slice(-n);
}

function sliceLeave(rows: LeaveTrendPoint[], period: AnalyticsPeriod): LeaveTrendPoint[] {
  const n = period === "this_month" ? 1 : period === "last_3" ? 3 : 6;
  return rows.slice(-n);
}

function relativeDayLabel(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((day.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return `${parts[0]!.slice(0, 1)}${parts[parts.length - 1]!.slice(0, 1)}`.toUpperCase();
}

function DashboardClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
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
  );
}

function GreetingTitle({ role, displayName }: { role: DashboardRole; displayName?: string }) {
  const [hour, setHour] = useState(() => new Date().getHours());
  useEffect(() => {
    const id = window.setInterval(() => setHour(new Date().getHours()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
      {greetingForHour(new Date(2000, 0, 1, hour))}, {displayName ?? DASHBOARD_ROLE_LABELS[role]}
    </h1>
  );
}

export function HrExecutiveDashboardPage() {
  const [data, setData] = useState<HrExecutiveDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<DashboardRole>("hr");
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState<AnalyticsPeriod>("last_6");

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      setRole("hr");
      setData(await loadHrExecutiveDashboard("hr"));
    } catch {
      if (!opts?.silent) toast("Failed to load HR dashboard", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => void load({ silent: true }), 60_000);
    return () => window.clearInterval(id);
  }, [load]);

  const filteredCalendar = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = data?.calendar ?? [];
    if (!q) return rows;
    return rows.filter((e) =>
      [e.title, e.type, e.meta ?? ""].join(" ").toLowerCase().includes(q),
    );
  }, [data, query]);

  const upcomingEvents = useMemo(
    () =>
      filteredCalendar
        .filter((e) => e.type === "birthday" || e.type === "anniversary")
        .sort((a, b) => a.at.localeCompare(b.at)),
    [filteredCalendar],
  );

  const upcomingHolidays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return filteredCalendar
      .filter((e) => e.type === "holiday" && new Date(e.at).getTime() >= today.getTime())
      .sort((a, b) => a.at.localeCompare(b.at));
  }, [filteredCalendar]);

  const stats = data?.stats;
  const charts = data?.charts;

  const kpiCards: {
    label: string;
    value: number | undefined;
    icon: typeof Users;
    href?: string;
    tint: string;
    iconBg: string;
    iconColor: string;
  }[] = [
    {
      label: "Headcount",
      value: stats?.totalEmployees,
      icon: Users,
      href: "/hr/workforce",
      tint: "bg-[#F4EDFB]",
      iconBg: "bg-[#9B5BB8]/15",
      iconColor: "text-[#9B5BB8]",
    },
    {
      label: "On leave today",
      value: stats?.onLeave,
      icon: CalendarDays,
      href: "/hr/leave?view=on-leave-today",
      tint: "bg-hrms-mint",
      iconBg: "bg-[#01BD7E]/15",
      iconColor: "text-[#01BD7E]",
    },
    {
      label: "Open roles",
      value: stats?.openPositions,
      icon: Briefcase,
      href: "/hr/recruitment",
      tint: "bg-hrms-peach",
      iconBg: "bg-[#FF8904]/15",
      iconColor: "text-[#FF8904]",
    },
    {
      label: "Onboarding in process",
      value: stats?.onboardingInProcess,
      icon: UserPlus,
      href: "/hr/onboarding",
      tint: "bg-hrms-blue",
      iconBg: "bg-[#155DFD]/15",
      iconColor: "text-[#155DFD]",
    },
  ];

  const departmentWise = charts?.departmentWise ?? [];
  const locationWise = charts?.locationWise ?? [];
  const employeeGrowth = sliceNamed(charts?.employeeGrowth ?? [], period);
  const attendanceStacked = sliceStacked(charts?.attendanceStacked ?? [], period);
  const leaveTrendByType = sliceLeave(charts?.leaveTrendByType ?? [], period);

  return (
    <div className="space-y-7 pb-6">
      <SetupToastHost />

      <div className="relative overflow-hidden rounded-2xl border border-border bg-card px-6 py-6 shadow-[var(--hrms-card-shadow)] sm:px-8 sm:py-7">
        <div
          className="pointer-events-none absolute -top-20 -right-8 size-56 rounded-full bg-[#9B5BB8]/15 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-24 left-16 size-48 rounded-full bg-[#C4A5E0]/20 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.16em] text-primary uppercase">
              HRMS Executive Dashboard
            </p>
            <GreetingTitle role={role} displayName={data?.displayName} />
            <DashboardClock />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search events…"
                className="h-10 rounded-xl pl-9"
              />
            </div>

            <div className="flex h-10 items-center gap-2.5 rounded-xl border border-border/70 bg-muted/30 px-3 text-sm">
              <span className="flex size-7 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                {(data?.displayName ?? "HR").slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden font-medium sm:inline">
                {data?.displayName ?? DASHBOARD_ROLE_LABELS[role]}
              </span>
            </div>

            <Button
              size="sm"
              variant="outline"
              className="h-10 cursor-pointer rounded-xl px-4"
              disabled={loading}
              onClick={() => void load()}
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
          <section className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DashboardListBox
              title="Upcoming Events"
              subtitle="Birthdays and work anniversaries"
              headerHref="/hr/workforce"
              headerLabel="View all"
            >
              {upcomingEvents.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No upcoming events</p>
              ) : (
                <ul className="divide-y divide-border/70">
                  {upcomingEvents.slice(0, 4).map((e) => (
                    <EventRow key={e.id} event={e} />
                  ))}
                </ul>
              )}
            </DashboardListBox>

            <DashboardListBox
              title="Quick Actions"
              subtitle="Common HR actions"
              icon={LayoutGrid}
            >
              <div className="grid grid-cols-2 content-stretch gap-2">
                {QUICK_ACTIONS.map((a) => {
                  const Icon = a.icon;
                  return (
                    <Link
                      key={a.href + a.label}
                      href={a.href}
                      className="flex min-h-[2.75rem] cursor-pointer items-center gap-2 rounded-xl bg-hrms-lavender px-3 py-2 transition-colors duration-150 hover:bg-[#E8D5F5]"
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white text-primary shadow-sm">
                        <Icon className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1 text-left text-xs font-medium leading-snug text-foreground">
                        {a.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </DashboardListBox>

            <DashboardListBox
              title="Holiday Calendar"
              subtitle="Upcoming holidays"
              headerHref="/hr/setup?section=leave"
              headerLabel="View all"
            >
              {upcomingHolidays.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No upcoming holidays</p>
              ) : (
                <ul className="divide-y divide-border/70">
                  {upcomingHolidays.slice(0, 4).map((e) => (
                    <HolidayRow key={e.id} event={e} />
                  ))}
                </ul>
              )}
            </DashboardListBox>

            <DashboardListBox
              title="Today's Attendance"
              subtitle={new Date().toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "short",
              })}
              icon={CalendarDays}
              footerHref="/hr/time"
              footerLabel="View attendance details"
            >
              <div className="flex h-full flex-col justify-between gap-2">
                <AttendanceBar
                  label="Present"
                  value={stats?.presentToday ?? 0}
                  icon={UserCheck}
                  tone="bg-hrms-mint text-hrms-success"
                />
                <AttendanceBar
                  label="Absent"
                  value={stats?.absentToday ?? 0}
                  icon={UserX}
                  tone="bg-hrms-pink text-hrms-danger"
                />
                <AttendanceBar
                  label="On Leave"
                  value={stats?.onLeave ?? 0}
                  icon={CalendarDays}
                  tone="bg-hrms-blue text-hrms-info"
                />
              </div>
            </DashboardListBox>
          </section>

          <section>
            <div className="mb-3">
              <h2 className="text-base font-semibold tracking-tight">Key Metrics</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {kpiCards.map((k) => {
                const Icon = k.icon;
                const card = (
                  <div
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border border-border px-4 py-3.5 shadow-[var(--hrms-card-shadow)] transition-all duration-200",
                      k.tint,
                      k.href && "hover:border-primary/30 hover:shadow-md",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-11 shrink-0 items-center justify-center rounded-xl",
                        k.iconBg,
                      )}
                    >
                      <Icon className={cn("size-5", k.iconColor)} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                        {k.label}
                      </p>
                      <p className="mt-0.5 text-2xl font-semibold tabular-nums leading-none text-foreground">
                        {loading ? "—" : (k.value ?? 0).toLocaleString("en-IN")}
                      </p>
                    </div>
                  </div>
                );
                return k.href ? (
                  <Link key={k.label} href={k.href} className="block cursor-pointer">
                    {card}
                  </Link>
                ) : (
                  <div key={k.label}>{card}</div>
                );
              })}
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold tracking-tight">HR Analytics</h2>
              <label className="relative inline-flex h-9 items-center">
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as AnalyticsPeriod)}
                  className="h-9 cursor-pointer appearance-none rounded-xl border border-border bg-card py-1.5 pr-8 pl-3 text-xs font-medium shadow-sm outline-none hover:border-primary/40 focus:ring-2 focus:ring-primary/20"
                >
                  <option value="this_month">This Month</option>
                  <option value="last_3">Last 3 months</option>
                  <option value="last_6">Last 6 months</option>
                </select>
                <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              </label>
            </div>

            <ChartHeightContext.Provider value={268}>
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                <ChartFrame>
                  <PremiumBarChart
                    title="Department-wise Employees"
                    data={departmentWise}
                    layout="horizontal"
                    showValues
                  />
                </ChartFrame>
                <ChartFrame>
                  <PremiumBarChart
                    title="Location-wise Employees"
                    data={locationWise}
                    layout="horizontal"
                    showValues
                  />
                </ChartFrame>
                <ChartFrame>
                  <PremiumDonutChart
                    title="Gender Diversity"
                    data={charts?.genderDiversity ?? []}
                  />
                </ChartFrame>
                <ChartFrame>
                  <PremiumBarChart
                    title="Headcount Trend"
                    data={employeeGrowth}
                    showValues
                  />
                </ChartFrame>
                <ChartFrame>
                  <PremiumStackedBarChart
                    title="Attendance Trend"
                    data={attendanceStacked}
                  />
                </ChartFrame>
                <ChartFrame>
                  <PremiumMultiLineChart
                    title="Leave Trend"
                    data={leaveTrendByType}
                  />
                </ChartFrame>
              </div>
            </ChartHeightContext.Provider>
          </section>
        </>
      )}
    </div>
  );
}

function ChartFrame({ children }: { children: ReactNode }) {
  return <div className="h-[340px] min-h-[300px]">{children}</div>;
}

function DashboardListBox({
  title,
  subtitle,
  icon: Icon,
  children,
  headerHref,
  headerLabel,
  footerHref,
  footerLabel,
  className,
}: {
  title: string;
  subtitle: string;
  icon?: LucideIcon;
  children: ReactNode;
  headerHref?: string;
  headerLabel?: string;
  footerHref?: string;
  footerLabel?: string;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex h-full min-h-0 flex-col rounded-2xl border border-border bg-card shadow-[var(--hrms-card-shadow)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2 px-4 pt-3.5 pb-1.5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
        {headerHref && headerLabel ? (
          <Link
            href={headerHref}
            className="shrink-0 rounded-full bg-hrms-lavender px-3 py-1 text-[11px] font-semibold text-primary transition-colors duration-150 hover:bg-[#E8D5F5]"
          >
            {headerLabel}
          </Link>
        ) : Icon ? (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Icon className="size-4" />
          </span>
        ) : null}
      </div>
      <div className="flex min-h-0 flex-1 flex-col px-3 pb-3">{children}</div>
      {footerHref && footerLabel ? (
        <div className="mt-auto px-4 pb-3">
          <Link
            href={footerHref}
            className="inline-flex cursor-pointer items-center gap-1 text-[12px] font-semibold text-primary transition-colors duration-150 hover:underline"
          >
            {footerLabel}
            <ChevronRight className="size-3.5" />
          </Link>
        </div>
      ) : null}
    </section>
  );
}

function AttendanceBar({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: string;
}) {
  return (
    <div className={cn("flex min-h-[2.75rem] flex-1 items-center gap-2 rounded-lg px-2.5 py-2", tone)}>
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-white/80">
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold tabular-nums leading-none">
          {value.toLocaleString("en-IN")}
        </p>
        <p className="mt-0.5 text-[10px] font-semibold tracking-wide uppercase opacity-80">
          {label}
        </p>
      </div>
    </div>
  );
}

function eventDisplayTitle(event: CalendarEvent): string {
  return event.title
    .replace(/\s+[—–-]\s*Birthday\s*$/i, "")
    .replace(/\s+[—–-]\s*\d+\s*Year(?:s)?\s*Anniversary\s*$/i, "")
    .replace(/\s+Anniversary\s*$/i, "")
    .trim();
}

function EventRow({ event }: { event: CalendarEvent }) {
  const name = eventDisplayTitle(event);
  const pill = EVENT_PILLS[event.type] ?? {
    label: event.type,
    className: "bg-muted text-muted-foreground",
  };
  return (
    <li className="flex items-center gap-2.5 py-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-hrms-lavender text-[11px] font-semibold text-primary">
        {initialsFromName(name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "inline-flex rounded-md px-1.5 py-0.5 text-[9px] font-semibold tracking-wide uppercase",
              pill.className,
            )}
          >
            {pill.label}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs font-medium text-foreground">{name}</p>
        <p className="truncate text-[10px] text-muted-foreground">
          {relativeDayLabel(event.at)}
          {event.meta ? ` · ${event.meta}` : ""}
        </p>
      </div>
    </li>
  );
}

function HolidayRow({ event }: { event: CalendarEvent }) {
  const d = new Date(event.at);
  const day = Number.isFinite(d.getTime())
    ? d.toLocaleDateString("en-IN", { day: "2-digit" })
    : "--";
  const month = Number.isFinite(d.getTime())
    ? d.toLocaleDateString("en-IN", { month: "short" }).toUpperCase()
    : "";
  const weekday = Number.isFinite(d.getTime())
    ? d.toLocaleDateString("en-IN", { weekday: "long" })
    : "";
  return (
    <li className="flex items-center gap-3 py-2.5">
      <div className="w-11 shrink-0 text-center">
        <p className="text-lg font-bold leading-none tabular-nums text-primary">{day}</p>
        <p className="mt-0.5 text-[10px] font-semibold tracking-wide text-primary">{month}</p>
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-foreground">{event.title}</p>
        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
          {weekday}
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
