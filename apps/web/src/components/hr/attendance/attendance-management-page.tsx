"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Download,
  FileText,
  List,
  Pencil,
  Scale,
  Upload,
  UserRound,
} from "lucide-react";

import {
  AttendanceCalendar,
} from "@/components/hr/attendance/attendance-calendar";
import {
  AttendanceCorrectionDrawer,
  AttendanceImportDrawer,
} from "@/components/hr/attendance/attendance-import-correction";
import { EmployeeAttendanceExplorer } from "@/components/hr/attendance/employee-attendance-explorer";
import { LeaveAdjustPanel } from "@/components/hr/attendance/leave-adjust-panel";
import {
  HrAuthBanner,
  HrEmptyState,
  HrToolbar,
  HrUnderlineTabs,
  type HrTabItem,
} from "@/components/hr/hr-primitives";
import { SetupConfirmDialog } from "@/components/hr/setup/setup-confirm";
import { SetupField, SetupSelect } from "@/components/hr/setup/setup-drawer";
import { toast, SetupToastHost } from "@/components/hr/setup/setup-toast";
import { EmsPagination, EmsSkeleton } from "@/components/hr/workforce/ems-primitives";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  bulkUpdateAttendanceStatus,
  computeDashboardStats,
  exportAttendanceCsv,
  filterAttendanceRecords,
  formatHoursMinutes,
  hoursFromFirstPunch,
  impliedAbsentRecords,
  loadAttendanceDirectory,
  todayIso,
  downloadTextFile,
  type AttendanceDirectory,
  type AttendanceStatBucket,
} from "@/services/attendance-management-service";
import type {
  AttendanceFilters,
  AttendancePunch,
  AttendanceRecord,
  AttendanceStatusCode,
} from "@/types/attendance-management";
import { ATTENDANCE_STATUS_LABELS, emptyAttendanceFilters } from "@/types/attendance-management";

const PAGE_SIZE = 15;

type ViewMode = "table" | "employee" | "calendar" | "leave-adjust";

const STAT_CARDS: { key: AttendanceStatBucket; label: string }[] = [
  { key: "present", label: "Today's Present" },
  { key: "absent", label: "Today's Absent" },
  { key: "missing", label: "Missing Punches" },
  { key: "late", label: "Late Arrivals" },
];

const STAT_LABELS: Record<AttendanceStatBucket, string> = {
  present: "Today's Present",
  absent: "Today's Absent",
  missing: "Missing Punches",
  late: "Late Arrivals",
};

function viewFromTab(tab: string | null): ViewMode {
  if (tab === "employee" || tab === "calendar" || tab === "leave-adjust") return tab;
  return "table";
}

function toTitleCase(value: string): string {
  const raw = String(value || "")
    .replace(/[_-]+/g, " ")
    .trim();
  if (!raw) return "";
  return raw
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function AttendanceManagementPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const employeeParam = searchParams.get("employeeId") || "";
  const statsParam = searchParams.get("stats");
  const statusParam = searchParams.get("status");
  const [directory, setDirectory] = useState<AttendanceDirectory | null>(null);
  const [todayRecords, setTodayRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<AttendanceFilters>(() => emptyAttendanceFilters(todayIso()));
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importOpen, setImportOpen] = useState(false);
  const [view, setView] = useState<ViewMode>(() => viewFromTab(tabParam));
  const [statsBucket, setStatsBucket] = useState<AttendanceStatBucket | null>(() => {
    const allowed = new Set(["present", "absent", "missing", "late"]);
    return statsParam && allowed.has(statsParam)
      ? (statsParam as AttendanceStatBucket)
      : null;
  });
  const [correctionRecord, setCorrectionRecord] = useState<AttendanceRecord | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [dayDetail, setDayDetail] = useState<{ date: string; rows: AttendanceRecord[] } | null>(null);
  const [punchesPopup, setPunchesPopup] = useState<{
    name: string;
    code: string;
    punches: AttendancePunch[];
  } | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; message: string; action: () => Promise<void> } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  /** Refresh open-day hours (first punch → now) once a minute. */
  const [hoursTick, setHoursTick] = useState(0);
  const directoryRef = useRef<AttendanceDirectory | null>(null);
  directoryRef.current = directory;

  const loadRange = useCallback(async (dateFrom: string, dateTo: string, opts?: { silent?: boolean }) => {
    const from = (dateFrom || todayIso()).slice(0, 10);
    const to = (dateTo || from).slice(0, 10);
    if (!opts?.silent) setLoading(true);
    try {
      const next = await loadAttendanceDirectory(
        { dateFrom: from, dateTo: to },
        directoryRef.current,
      );
      setDirectory(next);
      const day = todayIso();
      if (from === day && to === day) {
        setTodayRecords(next.records);
      } else if (from <= day && to >= day) {
        setTodayRecords(next.records.filter((r) => r.attendanceDate === day));
      }
    } catch {
      toast("Failed to load attendance", "error");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    const from = filters.dateFrom || todayIso();
    const to = filters.dateTo || from;
    await loadRange(from, to);
  }, [filters.dateFrom, filters.dateTo, loadRange]);

  // List view: load only the selected day (defaults to today). Calendar loads its month below.
  useEffect(() => {
    if (view === "calendar") return;
    const from = (filters.dateFrom || todayIso()).slice(0, 10);
    const to = (filters.dateTo || from).slice(0, 10);
    if (directoryRef.current?.loadedFrom === from && directoryRef.current?.loadedTo === to) {
      return;
    }
    void loadRange(from, to, { silent: Boolean(directoryRef.current) });
  }, [filters.dateFrom, filters.dateTo, view, loadRange]);

  // Calendar: load the visible month when opened / month changes.
  useEffect(() => {
    if (view !== "calendar") return;
    const y = calendarMonth.getFullYear();
    const m = calendarMonth.getMonth();
    const from = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const last = new Date(y, m + 1, 0).getDate();
    const to = `${y}-${String(m + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
    if (directoryRef.current?.loadedFrom === from && directoryRef.current?.loadedTo === to) {
      return;
    }
    void loadRange(from, to, { silent: Boolean(directoryRef.current) });
  }, [view, calendarMonth, loadRange]);

  useEffect(() => {
    const id = window.setInterval(() => setHoursTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    setView(viewFromTab(tabParam));
  }, [tabParam]);

  useEffect(() => {
    const allowed = new Set(["present", "absent", "missing", "late"]);
    if (statsParam && allowed.has(statsParam)) {
      setStatsBucket(statsParam as AttendanceStatBucket);
      setFilters((f) => ({
        ...f,
        status: "",
        dateFrom: todayIso(),
        dateTo: todayIso(),
      }));
      setView("table");
      return;
    }
    if (statusParam) {
      setStatsBucket(null);
      setFilters((f) => ({
        ...f,
        status: statusParam,
        dateFrom: todayIso(),
        dateTo: todayIso(),
      }));
      setView("table");
    }
  }, [statsParam, statusParam]);

  function openView(next: ViewMode) {
    setView(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === "table") params.set("tab", "list");
    else params.set("tab", next);
    if (next !== "leave-adjust") params.delete("employeeId");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const records = directory?.records ?? [];
  const today = todayIso();
  /** Prefer dedicated today cache so KPI cards stay correct when browsing other dates. */
  const statsSource =
    todayRecords.length > 0
      ? todayRecords
      : records.filter((r) => r.attendanceDate === today);

  /** Card counts always reflect today within current org filters (ignore date/status/card). */
  const stats = useMemo(() => {
    const orgScoped = filterAttendanceRecords(
      statsSource,
      "",
      {
        ...filters,
        status: "",
        dateFrom: "",
        dateTo: "",
      },
      null,
    );
    return computeDashboardStats(
      orgScoped,
      today,
      directory?.options.employees ?? [],
      {
        departmentId: filters.departmentId,
        employeeId: filters.employeeId,
        designation: filters.designation,
      },
    );
  }, [statsSource, filters, today, directory?.options.employees]);

  /** Statuses actually present in the list for the current day / org filters. */
  const statusOptionsInList = useMemo(() => {
    const day = (filters.dateFrom || filters.dateTo || today).slice(0, 10);
    const scoped = filterAttendanceRecords(
      records,
      "",
      { ...filters, status: "", dateFrom: day, dateTo: day },
      null,
    );
    const present = new Set(scoped.map((r) => r.status));
    const implied = impliedAbsentRecords(
      records,
      day,
      directory?.options.employees ?? [],
      filters,
    );
    if (implied.some((r) => r.status === "absent")) present.add("absent");
    return (Object.keys(ATTENDANCE_STATUS_LABELS) as AttendanceStatusCode[]).filter((k) =>
      present.has(k),
    );
  }, [records, filters, today, directory?.options.employees]);

  useEffect(() => {
    if (!filters.status) return;
    if (statusOptionsInList.includes(filters.status as AttendanceStatusCode)) return;
    setFilters((f) => ({ ...f, status: "" }));
  }, [filters.status, statusOptionsInList]);

  const filtered = useMemo(() => {
    const wantAbsent =
      statsBucket === "absent" || (!statsBucket && filters.status === "absent");
    if (wantAbsent) {
      const day = (filters.dateFrom || filters.dateTo || today).slice(0, 10);
      let absents = impliedAbsentRecords(
        records,
        day,
        directory?.options.employees ?? [],
        filters,
      );
      if (filters.employeeId) {
        absents = absents.filter((r) => r.employeeId === filters.employeeId);
      }
      const q = query.trim().toLowerCase();
      if (!q) return absents;
      return absents.filter((r) => {
        const hay = [
          r.extension.employeeName,
          r.extension.employeeCode,
          r.extension.departmentName,
          r.status,
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    return filterAttendanceRecords(records, query, filters, statsBucket);
  }, [records, query, filters, statsBucket, today, directory?.options.employees]);
  const calendarFiltered = useMemo(
    () =>
      filterAttendanceRecords(
        records,
        query,
        {
          ...filters,
          dateFrom: "",
          dateTo: "",
        },
        null,
      ),
    [records, query, filters],
  );
  const pageRows = useMemo(() => {
    void hoursTick;
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE).map((row) => ({
      ...row,
      workingHours: hoursFromFirstPunch(
        row.punches ?? [],
        row.checkIn,
        row.checkOut,
        row.attendanceDate,
        row.breakTime,
      ),
    }));
  }, [filtered, page, hoursTick]);

  useEffect(() => setPage(1), [query, filters, view, statsBucket]);

  const selectedRows = useMemo(
    () => records.filter((r) => selected.has(r.id)),
    [records, selected],
  );

  const authBlocked = !isAuthenticated() && !loading && !records.length;

  function selectStatCard(bucket: AttendanceStatBucket) {
    const next = statsBucket === bucket ? null : bucket;
    setStatsBucket(next);
    openView("table");
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "list");
    if (next) {
      params.set("stats", next);
      setFilters((f) => ({
        ...f,
        status: "",
        dateFrom: today,
        dateTo: today,
      }));
    } else {
      params.delete("stats");
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function formatTime(iso: string) {
    if (!iso) return "-";
    try {
      return new Date(iso).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return iso;
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <SetupToastHost />
      <PageHeader
        title="Attendance Management"
        actions={
          <HrToolbar onRefresh={() => void load()} loading={loading}>
            <Button
              size="sm"
              variant="outline"
              className="cursor-pointer"
              onClick={() => setImportOpen(true)}
            >
              <Upload className="size-3.5" />
              Import
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="cursor-pointer"
              onClick={() => {
                downloadTextFile(
                  `attendance-${todayIso()}.csv`,
                  exportAttendanceCsv(filtered),
                  "text/csv",
                );
                toast("CSV exported", "success");
              }}
            >
              <Download className="size-3.5" />
              Export
            </Button>
          </HrToolbar>
        }
      />

      {authBlocked ? <HrAuthBanner /> : null}

      {loading && !directory ? (
        <EmsSkeleton cards={4} rows={10} />
      ) : (
        <>
          <div className="grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {STAT_CARDS.map((card) => {
                  const active = statsBucket === card.key;
                  return (
                    <button
                      key={card.key}
                      type="button"
                      onClick={() => selectStatCard(card.key)}
                      aria-pressed={active}
                      className={cn(
                        "cursor-pointer rounded-xl border bg-card px-3 py-2.5 text-left shadow-sm transition-all duration-200",
                        "hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                        active ? "border-primary/50 ring-1 ring-primary/20" : "border-border/70",
                      )}
                    >
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {card.label}
                      </p>
                      <p className="mt-0.5 text-xl font-semibold">{stats[card.key]}</p>
                    </button>
                  );
                })}
          </div>

              {statsBucket ? (
                <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>Filtered by card:</span>
                  <span className="font-medium text-foreground">{STAT_LABELS[statsBucket]}</span>
                  <span>
                    · {filtered.length} record{filtered.length === 1 ? "" : "s"} (today)
                  </span>
                  <button
                    type="button"
                    className="cursor-pointer font-medium text-primary transition-colors duration-200 hover:underline"
                    onClick={() => {
                      setStatsBucket(null);
                      const params = new URLSearchParams(searchParams.toString());
                      params.delete("stats");
                      params.delete("status");
                      const qs = params.toString();
                      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
                    }}
                  >
                    Clear
                  </button>
                </div>
              ) : null}

          <HrUnderlineTabs
            tabs={
              [
                { id: "table", label: "Attendance List", icon: List },
                { id: "employee", label: "By Employee", icon: UserRound },
                { id: "calendar", label: "Calendar", icon: CalendarDays },
                { id: "leave-adjust", label: "Leave adjust", icon: Scale },
              ] satisfies HrTabItem[]
            }
            value={view}
            onChange={(id) => openView(id as ViewMode)}
          />

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">

          {view === "employee" ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <EmployeeAttendanceExplorer
              directory={directory}
              loading={loading}
              onCorrect={(row) => setCorrectionRecord(row)}
            />
            </div>
          ) : null}

          {view === "leave-adjust" ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <LeaveAdjustPanel directory={directory} initialEmployeeId={employeeParam} />
            </div>
          ) : null}

          {view === "calendar" ? (
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden lg:flex-row">
              <div className="erp-scroll min-h-0 min-w-0 flex-1 overflow-auto">
                <AttendanceCalendar
                  records={calendarFiltered}
                  month={calendarMonth}
                  onMonthChange={setCalendarMonth}
                  onSelectDate={(date, rows) => setDayDetail({ date, rows })}
                />
              </div>
              <aside className="flex w-full shrink-0 flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm lg:w-[22rem]">
                <CalendarDayPanel
                  date={dayDetail?.date ?? ""}
                  records={dayDetail?.rows ?? []}
                  pageSize={PAGE_SIZE}
                  formatTime={formatTime}
                />
              </aside>
            </div>
          ) : null}

          {view === "table" ? (
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
              <div className="shrink-0 rounded-xl border border-border/70 bg-card p-3 shadow-sm">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-8">
                  <SetupField label="Branch">
                    <SetupSelect
                      value={filters.branchId}
                      onChange={(e) => setFilters((f) => ({ ...f, branchId: e.target.value }))}
                    >
                      <option value="">All</option>
                      {directory?.options.branches.map((b) => (
                        <option key={b.id} value={b.id}>{b.label}</option>
                      ))}
                    </SetupSelect>
                  </SetupField>
                  <SetupField label="Department">
                    <SetupSelect
                      value={filters.departmentId}
                      onChange={(e) => setFilters((f) => ({ ...f, departmentId: e.target.value }))}
                    >
                      <option value="">All</option>
                      {directory?.options.departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.label}</option>
                      ))}
                    </SetupSelect>
                  </SetupField>
                  <SetupField label="Shift">
                    <SetupSelect
                      value={filters.shiftId}
                      onChange={(e) => setFilters((f) => ({ ...f, shiftId: e.target.value }))}
                    >
                      <option value="">All</option>
                      {directory?.options.shifts.map((s) => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </SetupSelect>
                  </SetupField>
                  <SetupField label="Employee">
                    <SearchableSelect
                      value={filters.employeeId}
                      placeholder="All employees"
                      searchPlaceholder="Search name or Emp ID…"
                      allowCustomValue={false}
                      className="w-full"
                      options={[
                        { value: "", label: "All employees" },
                        ...(directory?.options.employees.map((e) => ({
                          value: e.id,
                          label: `${e.label} (${e.code})`,
                          description: e.designation || undefined,
                        })) ?? []),
                      ]}
                      onChange={(id) => setFilters((f) => ({ ...f, employeeId: id }))}
                    />
                  </SetupField>
                  <SetupField label="Status">
                    <SetupSelect
                      value={statsBucket ? "" : filters.status}
                      disabled={Boolean(statsBucket)}
                      onChange={(e) => {
                        const nextStatus = e.target.value;
                        setStatsBucket(null);
                        setFilters((f) => ({ ...f, status: nextStatus }));
                        const params = new URLSearchParams(searchParams.toString());
                        params.delete("stats");
                        if (nextStatus) params.set("status", nextStatus);
                        else params.delete("status");
                        const qs = params.toString();
                        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
                      }}
                    >
                      <option value="">All</option>
                      {statusOptionsInList.map((k) => (
                        <option key={k} value={k}>
                          {ATTENDANCE_STATUS_LABELS[k]}
                        </option>
                      ))}
                    </SetupSelect>
                  </SetupField>
                  <SetupField label="Date">
                    <Input
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => {
                        const date = e.target.value;
                        // KPI cards are "today" only — clear them when browsing another day
                        // so the list shows that date's attendance instead of 0 rows.
                        if (statsBucket && date !== today) {
                          setStatsBucket(null);
                          const params = new URLSearchParams(searchParams.toString());
                          params.delete("stats");
                          const qs = params.toString();
                          router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
                        }
                        setFilters((f) => ({ ...f, dateFrom: date, dateTo: date }));
                      }}
                    />
                  </SetupField>
                  <SetupField label="Location">
                    <Input value={filters.location} onChange={(e) => setFilters((f) => ({ ...f, location: e.target.value }))} placeholder="e.g. HQ" />
                  </SetupField>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
                <Input
                  className="max-w-md shrink-0"
                  placeholder="Search employee, ID, department…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />

                {selected.size > 0 ? (
                  <div className="flex flex-wrap gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
                    <span className="font-medium">{selected.size} selected</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="cursor-pointer h-7"
                      onClick={() =>
                        setConfirm({
                          title: "Mark Present",
                          message: "Update selected rows to present?",
                          action: async () => {
                            await bulkUpdateAttendanceStatus(selectedRows, "present");
                            toast("Updated", "success");
                            setSelected(new Set());
                            await load();
                          },
                        })
                      }
                    >
                      Mark Present
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="cursor-pointer h-7"
                      onClick={() =>
                        setConfirm({
                          title: "Mark Absent",
                          message: "Update selected rows to absent?",
                          action: async () => {
                            await bulkUpdateAttendanceStatus(selectedRows, "absent");
                            setSelected(new Set());
                            await load();
                          },
                        })
                      }
                    >
                      Mark Absent
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="cursor-pointer h-7"
                      onClick={() => {
                        downloadTextFile("attendance-selected.csv", exportAttendanceCsv(selectedRows), "text/csv");
                      }}
                    >
                      Export
                    </Button>
                  </div>
                ) : null}

                {!pageRows.length ? (
                  <HrEmptyState
                    title="No attendance records"
                    description="Import a CSV or wait for biometric punches to populate the register."
                  />
                ) : (
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
                      <div className="erp-scroll min-h-0 flex-1 overflow-auto">
                        <table className="w-full min-w-[960px] text-left text-sm">
                          <thead className="sticky top-0 z-10 border-b border-border/70 bg-muted/90 backdrop-blur-sm">
                            <tr>
                              <th className="w-8 px-2 py-2">
                                <input
                                  type="checkbox"
                                  className="cursor-pointer"
                                  checked={pageRows.every((r) => selected.has(r.id))}
                                  onChange={(e) => {
                                    if (e.target.checked) setSelected(new Set(pageRows.map((r) => r.id)));
                                    else setSelected(new Set());
                                  }}
                                />
                              </th>
                              {[
                                "Employee",
                                "ID",
                                "Department",
                                "Shift",
                                "First In",
                                "Last Out",
                                "Punches",
                                "Hours",
                                "Status",
                                "Location",
                                "Device",
                                "",
                              ].map((h) => (
                                <th
                                  key={h || "actions"}
                                  className="px-2 py-2 text-[10px] font-medium uppercase text-muted-foreground"
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {pageRows.map((row) => {
                              const punchTimes = row.punches ?? [];
                              const firstInIso =
                                punchTimes[0]?.punchedAt || row.checkIn || "";
                              const lastOutIso =
                                punchTimes.length > 1
                                  ? punchTimes[punchTimes.length - 1]?.punchedAt ||
                                    row.checkOut ||
                                    ""
                                  : row.checkOut || "";
                              return (
                              <tr
                                key={row.id}
                                className="border-b border-border/50 transition-colors duration-200 hover:bg-muted/30"
                              >
                                <td className="px-2 py-2">
                                  <input
                                    type="checkbox"
                                    className="cursor-pointer disabled:cursor-not-allowed"
                                    disabled={row.recordStatus === "implied"}
                                    title={
                                      row.recordStatus === "implied"
                                        ? "No punch recorded — mark attendance to create a row"
                                        : undefined
                                    }
                                    checked={selected.has(row.id)}
                                    onChange={() => {
                                      if (row.recordStatus === "implied") return;
                                      setSelected((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(row.id)) next.delete(row.id);
                                        else next.add(row.id);
                                        return next;
                                      });
                                    }}
                                  />
                                </td>
                                <td className="px-2 py-2 text-xs font-medium">
                                  {toTitleCase(row.extension.employeeName)}
                                </td>
                                <td className="px-2 py-2 font-mono text-[10px] text-muted-foreground">
                                  {row.extension.employeeCode}
                                </td>
                                <td className="px-2 py-2 text-xs">
                                  {toTitleCase(row.extension.departmentName) || "—"}
                                </td>
                                <td className="px-2 py-2 text-xs">
                                  {toTitleCase(row.extension.shiftName) || "—"}
                                </td>
                                <td className="px-2 py-2 font-mono text-[11px] tabular-nums">
                                  {firstInIso ? formatTime(firstInIso) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                                <td className="px-2 py-2 font-mono text-[11px] tabular-nums">
                                  {lastOutIso ? formatTime(lastOutIso) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                                <td className="max-w-[180px] px-2 py-2 text-xs">
                                  {!punchTimes.length ? (
                                    <span className="text-muted-foreground">—</span>
                                  ) : punchTimes.length === 1 ? (
                                    <span
                                      title={[
                                        punchTimes[0].deviceName || punchTimes[0].deviceCode,
                                        punchTimes[0].deviceLocation,
                                      ]
                                        .filter(Boolean)
                                        .join(" · ")}
                                      className="inline-flex rounded-md border border-border/70 bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-foreground"
                                    >
                                      {formatTime(punchTimes[0].punchedAt)}
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border border-border/70 bg-background px-2 text-[11px] font-medium text-primary transition-colors duration-200 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                                      onClick={() =>
                                        setPunchesPopup({
                                          name: toTitleCase(row.extension.employeeName),
                                          code: row.extension.employeeCode,
                                          punches: punchTimes,
                                        })
                                      }
                                    >
                                      View
                                      <span className="rounded bg-muted px-1 py-px text-[10px] tabular-nums text-muted-foreground">
                                        {punchTimes.length}
                                      </span>
                                    </button>
                                  )}
                                </td>
                                <td className="px-2 py-2 text-xs tabular-nums">
                                  {formatHoursMinutes(row.workingHours)}
                                </td>
                                <td className="px-2 py-2">
                                  <span
                                    className={cn(
                                      "inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-medium tracking-wide",
                                      row.status === "absent"
                                        ? "border-transparent bg-hrms-pink text-hrms-danger"
                                        : row.status === "late" ||
                                            row.status === "present" ||
                                            row.status === "work_from_home"
                                          ? "border-transparent bg-hrms-mint text-hrms-success"
                                          : row.status === "half_day"
                                            ? "border-transparent bg-hrms-peach text-hrms-warning"
                                            : "border-transparent bg-hrms-blue text-hrms-info",
                                    )}
                                  >
                                    {toTitleCase(row.status)}
                                  </span>
                                </td>
                                <td className="px-2 py-2 text-xs">
                                  {row.location ? toTitleCase(row.location) : "—"}
                                </td>
                                <td className="px-2 py-2 text-xs">{toTitleCase(row.device) || "—"}</td>
                                <td className="px-2 py-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="size-7 cursor-pointer transition-colors duration-150 hover:bg-muted"
                                    title="Correct attendance"
                                    aria-label={`Correct attendance for ${row.extension.employeeName || row.extension.employeeCode}`}
                                    onClick={() => setCorrectionRecord(row)}
                                  >
                                    <Pencil className="size-3.5" />
                                  </Button>
                                </td>
                              </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <EmsPagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
                  </div>
                )}
              </div>
            </div>
          ) : null}
          </div>
        </>
      )}

      <AttendanceImportDrawer
        open={importOpen}
        directory={directory}
        onClose={() => setImportOpen(false)}
        onImported={() => void load()}
      />

      <AttendanceCorrectionDrawer
        open={Boolean(correctionRecord)}
        record={correctionRecord}
        onClose={() => setCorrectionRecord(null)}
        onSaved={() => void load()}
      />

      <SetupConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title ?? ""}
        message={confirm?.message ?? ""}
        loading={confirmLoading}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (!confirm) return;
          setConfirmLoading(true);
          void confirm.action().finally(() => {
            setConfirmLoading(false);
            setConfirm(null);
          });
        }}
      />

      {punchesPopup ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 cursor-pointer bg-slate-950/40"
            aria-label="Close punches"
            onClick={() => setPunchesPopup(null)}
          />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-card p-4 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold tracking-tight">
                  {punchesPopup.name || "Employee"}
                </h3>
                <p className="font-mono text-[10px] text-muted-foreground">{punchesPopup.code}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {punchesPopup.punches.length} punch
                  {punchesPopup.punches.length === 1 ? "" : "es"}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 shrink-0 cursor-pointer transition-colors duration-200"
                onClick={() => setPunchesPopup(null)}
              >
                Close
              </Button>
            </div>
            <ul className="mt-3 max-h-64 space-y-1.5 overflow-y-auto">
              {punchesPopup.punches.map((p, index) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/30 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-xs tabular-nums text-foreground">
                      {formatTime(p.punchedAt)}
                    </p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {[p.deviceName || p.deviceCode, p.deviceLocation].filter(Boolean).join(" · ") ||
                        `Punch ${index + 1}`}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-md bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    #{index + 1}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <p className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
        <FileText className="size-3" />
        Role-based access enforced by API permissions (hr.attendance:*). Manual edits are audit-logged.
      </p>
    </div>
  );
}

function CalendarDayPanel({
  date,
  records,
  pageSize,
  formatTime,
}: {
  date: string;
  records: AttendanceRecord[];
  pageSize: number;
  formatTime: (iso: string) => string;
}) {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [date]);
  const pageRows = records.slice((page - 1) * pageSize, page * pageSize);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border/60 px-3 py-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Day detail</p>
        <p className="text-sm font-medium">{date || "Select a date"}</p>
      </div>
      <div className="erp-scroll min-h-0 flex-1 overflow-auto p-3">
        {!date ? (
          <p className="text-xs text-muted-foreground">Click a calendar day to see punches here.</p>
        ) : records.length === 0 ? (
          <p className="text-xs text-muted-foreground">No punches recorded for this date.</p>
        ) : (
          <ul className="space-y-2 text-xs">
            {pageRows.map((r) => (
              <li key={r.id} className="rounded-lg border border-border/60 px-3 py-2">
                <p className="font-medium">{r.extension.employeeName}</p>
                <p className="font-mono text-[10px] text-muted-foreground">{r.extension.employeeCode}</p>
                <p className="text-muted-foreground">
                  {formatTime(r.checkIn)} – {formatTime(r.checkOut)} ·{" "}
                  {formatHoursMinutes(r.workingHours)}
                </p>
                <p className="text-muted-foreground">{toTitleCase(r.status)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
      {records.length > 0 ? (
        <EmsPagination page={page} pageSize={pageSize} total={records.length} onPageChange={setPage} />
      ) : null}
    </div>
  );
}
