"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Download,
  FileText,
  List,
  Plus,
  Scale,
  UserRound,
} from "lucide-react";

import {
  AttendanceCalendar,
} from "@/components/hr/attendance/attendance-calendar";
import {
  AttendanceCorrectionDrawer,
} from "@/components/hr/attendance/attendance-import-correction";
import { MarkAttendanceDrawer } from "@/components/hr/attendance/mark-attendance-drawer";
import { EmployeeAttendanceExplorer } from "@/components/hr/attendance/employee-attendance-explorer";
import { LeaveAdjustPanel } from "@/components/hr/attendance/leave-adjust-panel";
import {
  HrAuthBanner,
  HrEmptyState,
  HrStatusBadge,
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
import { useSearchParams } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  bulkUpdateAttendanceStatus,
  computeDashboardStats,
  exportAttendanceCsv,
  filterAttendanceRecords,
  loadAttendanceDirectory,
  todayIso,
  downloadTextFile,
  type AttendanceDirectory,
  type AttendanceStatBucket,
} from "@/services/attendance-management-service";
import type { AttendanceFilters, AttendanceRecord } from "@/types/attendance-management";
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

export function AttendanceManagementPage() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const employeeParam = searchParams.get("employeeId") || "";
  const [directory, setDirectory] = useState<AttendanceDirectory | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<AttendanceFilters>(() => emptyAttendanceFilters(todayIso()));
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [view, setView] = useState<ViewMode>(() =>
    tabParam === "leave-adjust" ? "leave-adjust" : "employee",
  );
  const [statsBucket, setStatsBucket] = useState<AttendanceStatBucket | null>(null);
  const [markOpen, setMarkOpen] = useState(false);
  const [correctionRecord, setCorrectionRecord] = useState<AttendanceRecord | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [dayDetail, setDayDetail] = useState<{ date: string; rows: AttendanceRecord[] } | null>(null);
  const [detailRecord, setDetailRecord] = useState<AttendanceRecord | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; message: string; action: () => Promise<void> } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDirectory(await loadAttendanceDirectory());
    } catch {
      toast("Failed to load attendance", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (tabParam === "leave-adjust") setView("leave-adjust");
  }, [tabParam]);

  const records = directory?.records ?? [];
  const today = todayIso();

  /** Card counts always reflect today within current org filters (ignore date/status/card). */
  const stats = useMemo(() => {
    const orgScoped = filterAttendanceRecords(
      records,
      "",
      {
        ...filters,
        status: "",
        dateFrom: "",
        dateTo: "",
      },
      null,
    );
    return computeDashboardStats(orgScoped, today);
  }, [records, filters, today]);

  const filtered = useMemo(
    () => filterAttendanceRecords(records, query, filters, statsBucket),
    [records, query, filters, statsBucket],
  );
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
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  useEffect(() => setPage(1), [query, filters, view, statsBucket]);

  useEffect(() => {
    if (view !== "table") return;
    setDetailRecord((cur) => {
      if (cur && pageRows.some((r) => r.id === cur.id)) return cur;
      return pageRows[0] ?? null;
    });
  }, [view, pageRows]);

  const selectedRows = useMemo(
    () => records.filter((r) => selected.has(r.id)),
    [records, selected],
  );

  const authBlocked = !isAuthenticated() && !loading && !records.length;

  function selectStatCard(bucket: AttendanceStatBucket) {
    const next = statsBucket === bucket ? null : bucket;
    setStatsBucket(next);
    setView("table");
    if (next) {
      setFilters((f) => ({
        ...f,
        status: "",
        dateFrom: today,
        dateTo: today,
      }));
    }
  }

  function formatTime(iso: string) {
    if (!iso) return "—";
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
            {view !== "leave-adjust" ? (
            <Button size="sm" className="cursor-pointer" onClick={() => setMarkOpen(true)}>
              <Plus className="size-3.5" />
              Mark Attendance
            </Button>
            ) : null}
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
                    onClick={() => setStatsBucket(null)}
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
            onChange={(id) => setView(id as typeof view)}
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
                    <SetupSelect
                      value={filters.employeeId}
                      onChange={(e) => setFilters((f) => ({ ...f, employeeId: e.target.value }))}
                    >
                      <option value="">All</option>
                      {directory?.options.employees.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.label} ({e.code})
                        </option>
                      ))}
                    </SetupSelect>
                  </SetupField>
                  <SetupField label="Status">
                    <SetupSelect
                      value={statsBucket ? "" : filters.status}
                      disabled={Boolean(statsBucket)}
                      onChange={(e) => {
                        setStatsBucket(null);
                        setFilters((f) => ({ ...f, status: e.target.value }));
                      }}
                    >
                      <option value="">All</option>
                      {Object.entries(ATTENDANCE_STATUS_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </SetupSelect>
                  </SetupField>
                  <SetupField label="Date">
                    <Input
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => {
                        const date = e.target.value;
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
                    description="Mark Attendance or import a CSV to populate the register."
                    action={
                      <Button size="sm" className="cursor-pointer" onClick={() => setMarkOpen(true)}>
                        Mark Attendance
                      </Button>
                    }
                  />
                ) : (
                  <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden lg:flex-row">
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
                      <div className="erp-scroll min-h-0 flex-1 overflow-auto">
                        <table className="w-full min-w-[1200px] text-left text-sm">
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
                                "Date",
                                "Employee",
                                "ID",
                                "Department",
                                "Shift",
                                "Check in",
                                "Check out",
                                "Hours",
                                "Break",
                                "OT",
                                "Status",
                                "Location",
                                "Device",
                                "Approval",
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
                            {pageRows.map((row) => (
                              <tr
                                key={row.id}
                                className={cn(
                                  "cursor-pointer border-b border-border/50 transition-colors duration-200 hover:bg-muted/30",
                                  detailRecord?.id === row.id && "bg-muted/40",
                                )}
                                onClick={() => setDetailRecord(row)}
                              >
                                <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    className="cursor-pointer"
                                    checked={selected.has(row.id)}
                                    onChange={() => {
                                      setSelected((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(row.id)) next.delete(row.id);
                                        else next.add(row.id);
                                        return next;
                                      });
                                    }}
                                  />
                                </td>
                                <td className="px-2 py-2 font-mono text-[10px] text-muted-foreground">
                                  {row.attendanceDate}
                                </td>
                                <td className="px-2 py-2 text-xs font-medium">{row.extension.employeeName}</td>
                                <td className="px-2 py-2 font-mono text-[10px] text-muted-foreground">
                                  {row.extension.employeeCode}
                                </td>
                                <td className="px-2 py-2 text-xs">{row.extension.departmentName}</td>
                                <td className="px-2 py-2 text-xs">{row.extension.shiftName}</td>
                                <td className="px-2 py-2 text-xs">{formatTime(row.checkIn)}</td>
                                <td className="px-2 py-2 text-xs">{formatTime(row.checkOut)}</td>
                                <td className="px-2 py-2 text-xs">{row.workingHours}</td>
                                <td className="px-2 py-2 text-xs">{row.breakTime}m</td>
                                <td className="px-2 py-2 text-xs">{row.overtimeHours}</td>
                                <td className="px-2 py-2">
                                  <HrStatusBadge status={row.status.replace(/_/g, " ")} />
                                </td>
                                <td className="px-2 py-2 text-xs">{row.location || "—"}</td>
                                <td className="px-2 py-2 text-xs capitalize">{row.device.replace(/_/g, " ")}</td>
                                <td className="px-2 py-2 text-[10px] capitalize">{row.approvalStatus.replace(/_/g, " ")}</td>
                                <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="cursor-pointer h-7 text-xs"
                                    onClick={() => setCorrectionRecord(row)}
                                  >
                                    Correct
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <EmsPagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
                    </div>
                    <aside className="flex w-full shrink-0 flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm lg:w-[22rem]">
                      <AttendanceRecordAside
                        record={detailRecord}
                        formatTime={formatTime}
                        onCorrect={() => detailRecord && setCorrectionRecord(detailRecord)}
                      />
                    </aside>
                  </div>
                )}
              </div>
            </div>
          ) : null}
          </div>
        </>
      )}

      <MarkAttendanceDrawer
        open={markOpen}
        directory={directory}
        onClose={() => setMarkOpen(false)}
        onSaved={() => void load()}
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

      <p className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
        <FileText className="size-3" />
        Role-based access enforced by API permissions (hr.attendance:*). Manual edits are audit-logged.
      </p>
    </div>
  );
}

function AttendanceRecordAside({
  record,
  formatTime,
  onCorrect,
}: {
  record: AttendanceRecord | null;
  formatTime: (iso: string) => string;
  onCorrect: () => void;
}) {
  if (!record) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-4">
        <p className="text-center text-xs text-muted-foreground">Select a row to see details.</p>
      </div>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border/60 px-3 py-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Record</p>
        <p className="truncate text-sm font-medium">{record.extension.employeeName}</p>
        <p className="font-mono text-[11px] text-muted-foreground">{record.extension.employeeCode}</p>
      </div>
      <div className="erp-scroll min-h-0 flex-1 space-y-2 overflow-auto p-3 text-xs">
        <p><span className="text-muted-foreground">Date </span>{record.attendanceDate}</p>
        <p><span className="text-muted-foreground">Status </span>{record.status.replace(/_/g, " ")}</p>
        <p><span className="text-muted-foreground">Check in </span>{formatTime(record.checkIn)}</p>
        <p><span className="text-muted-foreground">Check out </span>{formatTime(record.checkOut)}</p>
        <p><span className="text-muted-foreground">Hours </span>{record.workingHours || "—"}</p>
        <p><span className="text-muted-foreground">Location </span>{record.location || "—"}</p>
        <p><span className="text-muted-foreground">Department </span>{record.extension.departmentName || "—"}</p>
        <Button type="button" size="sm" variant="outline" className="mt-2 h-7 w-full cursor-pointer text-xs" onClick={onCorrect}>
          Correct
        </Button>
      </div>
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
                  {formatTime(r.checkIn)} – {formatTime(r.checkOut)} · {r.workingHours}h
                </p>
                <p className="capitalize text-muted-foreground">{r.status.replace(/_/g, " ")}</p>
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
