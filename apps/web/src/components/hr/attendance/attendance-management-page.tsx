"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Download,
  FileText,
  List,
  Plus,
  UserRound,
} from "lucide-react";

import {
  AttendanceCalendar,
  AttendanceDayDetailDrawer,
} from "@/components/hr/attendance/attendance-calendar";
import {
  AttendanceCorrectionDrawer,
} from "@/components/hr/attendance/attendance-import-correction";
import { MarkAttendanceDrawer } from "@/components/hr/attendance/mark-attendance-drawer";
import { EmployeeAttendanceExplorer } from "@/components/hr/attendance/employee-attendance-explorer";
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

type ViewMode = "table" | "employee" | "calendar";

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
  const [directory, setDirectory] = useState<AttendanceDirectory | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<AttendanceFilters>(() => emptyAttendanceFilters(todayIso()));
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [view, setView] = useState<ViewMode>("table");
  const [statsBucket, setStatsBucket] = useState<AttendanceStatBucket | null>(null);
  const [markOpen, setMarkOpen] = useState(false);
  const [correctionRecord, setCorrectionRecord] = useState<AttendanceRecord | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [dayDetail, setDayDetail] = useState<{ date: string; rows: AttendanceRecord[] } | null>(null);
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
    <div className="space-y-5">
      <SetupToastHost />
      <PageHeader
        title="Attendance Management"
        actions={
          <HrToolbar onRefresh={() => void load()} loading={loading}>
            <Button size="sm" className="cursor-pointer" onClick={() => setMarkOpen(true)}>
              <Plus className="size-3.5" />
              Mark Attendance
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
        <EmsSkeleton />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
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
              ] satisfies HrTabItem[]
            }
            value={view}
            onChange={(id) => setView(id as typeof view)}
          />

          {view === "employee" ? (
            <EmployeeAttendanceExplorer
              directory={directory}
              loading={loading}
              onCorrect={(row) => setCorrectionRecord(row)}
            />
          ) : null}

          {view === "calendar" ? (
            <AttendanceCalendar
              records={calendarFiltered}
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              onSelectDate={(date, rows) => setDayDetail({ date, rows })}
            />
          ) : null}

          {view === "table" ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-border/70 bg-card p-3 shadow-sm">
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
                  <SetupField label="From">
                    <Input type="date" value={filters.dateFrom} onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))} />
                  </SetupField>
                  <SetupField label="To">
                    <Input type="date" value={filters.dateTo} onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))} />
                  </SetupField>
                  <SetupField label="Location">
                    <Input value={filters.location} onChange={(e) => setFilters((f) => ({ ...f, location: e.target.value }))} placeholder="e.g. HQ" />
                  </SetupField>
                </div>
              </div>

              <div className="space-y-3">
                <Input
                  className="max-w-md"
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
                  <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
                    <div className="erp-scroll max-h-[calc(100vh-20rem)] overflow-auto">
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
                            <tr key={row.id} className="border-b border-border/50 hover:bg-muted/30">
                              <td className="px-2 py-2">
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
                              <td className="px-2 py-2">
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
                )}
              </div>
            </div>
          ) : null}
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
      <AttendanceDayDetailDrawer
        open={Boolean(dayDetail)}
        date={dayDetail?.date ?? ""}
        records={dayDetail?.rows ?? []}
        onClose={() => setDayDetail(null)}
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

      <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <FileText className="size-3" />
        Role-based access enforced by API permissions (hr.attendance:*). Manual edits are audit-logged.
      </p>
    </div>
  );
}
