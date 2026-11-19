"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ExternalLink, Search } from "lucide-react";

import { HrEmptyState, HrStatusBadge } from "@/components/hr/hr-primitives";
import { SetupField, SetupSelect } from "@/components/hr/setup/setup-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AttendanceDirectory } from "@/services/attendance-management-service";
import type { AttendanceRecord, AttendanceStatusCode } from "@/types/attendance-management";
import { ATTENDANCE_STATUS_LABELS } from "@/types/attendance-management";

type StatusFilter = "all" | AttendanceStatusCode;

function currentMonthYm(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthBounds(ym: string): { from: string; to: string } {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return { from: "", to: "" };
  const last = new Date(y, m, 0).getDate();
  return {
    from: `${ym}-01`,
    to: `${ym}-${String(last).padStart(2, "0")}`,
  };
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleString(undefined, { month: "long", year: "numeric" });
}

function formatTime12(iso: string): string {
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

function matchesStatus(row: AttendanceRecord, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "present") return row.status === "present" || row.status === "late";
  if (filter === "weekend") return row.status === "weekend" || row.apiStatus === "week_off";
  return row.status === filter;
}

export function EmployeeAttendanceExplorer({
  directory,
  loading,
  onCorrect,
}: {
  directory: AttendanceDirectory | null;
  loading: boolean;
  onCorrect: (row: AttendanceRecord) => void;
}) {
  const employees = directory?.options.employees ?? [];
  const records = directory?.records ?? [];

  const [employeeId, setEmployeeId] = useState("");
  const [month, setMonth] = useState(currentMonthYm);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");

  const effectiveEmployeeId = employeeId || employees[0]?.id || "";

  const employeeOptions = useMemo(() => {
    const q = employeeSearch.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.label.toLowerCase().includes(q) ||
        e.code.toLowerCase().includes(q) ||
        e.designation.toLowerCase().includes(q),
    );
  }, [employees, employeeSearch]);

  const range = useMemo(() => {
    if (useCustomRange && dateFrom && dateTo) return { from: dateFrom, to: dateTo };
    return monthBounds(month);
  }, [useCustomRange, dateFrom, dateTo, month]);

  const employeeRows = useMemo(() => {
    if (!effectiveEmployeeId) return [];
    return records
      .filter((r) => r.employeeId === effectiveEmployeeId)
      .filter((r) => {
        if (range.from && r.attendanceDate < range.from) return false;
        if (range.to && r.attendanceDate > range.to) return false;
        return matchesStatus(r, statusFilter);
      })
      .sort((a, b) => b.attendanceDate.localeCompare(a.attendanceDate));
  }, [records, effectiveEmployeeId, range, statusFilter]);

  const employeeMeta = employees.find((e) => e.id === effectiveEmployeeId);

  const summary = useMemo(() => {
    const base = records.filter((r) => {
      if (r.employeeId !== effectiveEmployeeId) return false;
      if (range.from && r.attendanceDate < range.from) return false;
      if (range.to && r.attendanceDate > range.to) return false;
      return true;
    });
    return {
      total: base.length,
      present: base.filter((r) => r.status === "present" || r.status === "late").length,
      absent: base.filter((r) => r.status === "absent").length,
      half: base.filter((r) => r.status === "half_day").length,
      hours: Math.round(base.reduce((s, r) => s + (r.workingHours || 0), 0) * 10) / 10,
    };
  }, [records, effectiveEmployeeId, range]);

  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    set.add(currentMonthYm());
    for (const r of records) {
      if (r.employeeId === effectiveEmployeeId) {
        set.add(r.attendanceDate.slice(0, 7));
      }
    }
    return Array.from(set).sort().reverse();
  }, [records, effectiveEmployeeId]);

  if (!employees.length && !loading) {
    return (
      <HrEmptyState
        title="No employees"
        description="Add employees in Workforce to browse attendance by person."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Employee attendance
            </p>
            <div className="relative max-w-md">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                placeholder="Search employee name or code…"
                className="h-9 pl-8"
              />
            </div>
            <SetupField label="Employee" required>
              <SetupSelect
                value={effectiveEmployeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
              >
                {employeeOptions.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.label} ({e.code})
                  </option>
                ))}
              </SetupSelect>
            </SetupField>
          </div>

          <div className="flex flex-wrap gap-3 lg:max-w-xl">
            <SetupField label="Month">
              <SetupSelect
                value={month}
                disabled={useCustomRange}
                onChange={(e) => setMonth(e.target.value)}
              >
                {monthOptions.map((ym) => (
                  <option key={ym} value={ym}>
                    {monthLabel(ym)}
                  </option>
                ))}
              </SetupSelect>
            </SetupField>
            <SetupField label="Status">
              <SetupSelect
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              >
                <option value="all">All</option>
                <option value="present">Present / late</option>
                {Object.entries(ATTENDANCE_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </SetupSelect>
            </SetupField>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border/60 pt-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              className="cursor-pointer"
              checked={useCustomRange}
              onChange={(e) => setUseCustomRange(e.target.checked)}
            />
            Custom date range
          </label>
          {useCustomRange ? (
            <>
              <SetupField label="From">
                <Input
                  type="date"
                  className="h-9 w-36"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </SetupField>
              <SetupField label="To">
                <Input
                  type="date"
                  className="h-9 w-36"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </SetupField>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">
              Showing {monthLabel(month)} ({range.from} → {range.to})
            </span>
          )}
        </div>
      </div>

      {employeeMeta ? (
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
          <div>
            <p className="text-sm font-semibold">{employeeMeta.label}</p>
            <p className="text-xs text-muted-foreground">
              {employeeMeta.code}
              {employeeMeta.designation ? ` · ${employeeMeta.designation}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/hr/workforce/${effectiveEmployeeId}?tab=attendance`}>
              <Button size="sm" variant="outline" className="cursor-pointer">
                <ExternalLink className="size-3.5" />
                Full profile
              </Button>
            </Link>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Records in range", value: summary.total },
          { label: "Present", value: summary.present },
          { label: "Absent", value: summary.absent },
          { label: "Half day", value: summary.half },
          { label: "Total hours", value: summary.hours },
        ].map((c) => (
          <div key={c.label} className="rounded-lg border border-border/70 bg-card px-3 py-2 shadow-sm">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {c.label}
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">{c.value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading attendance…</p>
      ) : !employeeRows.length ? (
        <HrEmptyState
          title="No attendance for this filter"
          description="Try another month, status, or mark attendance for this employee."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
          <div className="border-b border-border/60 px-4 py-2 text-xs text-muted-foreground">
            {employeeRows.length} day{employeeRows.length === 1 ? "" : "s"} · filtered list
          </div>
          <div className="erp-scroll max-h-[calc(100vh-22rem)] overflow-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-border/70 bg-muted/90 backdrop-blur-sm">
                <tr>
                  {[
                    "Date",
                    "Status",
                    "Check in",
                    "Check out",
                    "Hours",
                    "OT",
                    "Source",
                    "Location",
                    "Notes",
                    "",
                  ].map((h) => (
                    <th
                      key={h || "act"}
                      className="px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employeeRows.map((row) => (
                  <tr key={row.id} className="border-b border-border/40 hover:bg-muted/25">
                    <td className="px-3 py-2 font-mono text-xs">{row.attendanceDate}</td>
                    <td className="px-3 py-2">
                      <HrStatusBadge status={row.status.replace(/_/g, " ")} />
                    </td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">{formatTime12(row.checkIn)}</td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">{formatTime12(row.checkOut)}</td>
                    <td className="px-3 py-2 text-xs tabular-nums">{row.workingHours || "—"}</td>
                    <td className="px-3 py-2 text-xs tabular-nums">{row.overtimeHours || "—"}</td>
                    <td className="px-3 py-2 text-xs capitalize">{row.device.replace(/_/g, " ")}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{row.location || "—"}</td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-xs text-muted-foreground" title={row.notes}>
                      {row.notes || "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="cursor-pointer h-7 text-xs"
                        onClick={() => onCorrect(row)}
                      >
                        Correct
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
