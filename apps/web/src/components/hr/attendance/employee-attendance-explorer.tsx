"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Search,
  UserRound,
  UserX,
  X,
} from "lucide-react";

import { HrEmptyState, HrStatusBadge } from "@/components/hr/hr-primitives";
import { SetupField, SetupSelect } from "@/components/hr/setup/setup-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  loadAttendanceForEmployee,
  type AttendanceDirectory,
} from "@/services/attendance-management-service";
import type { AttendanceRecord } from "@/types/attendance-management";

type StatusFilter = "all" | "present" | "absent" | "half_day";

type EmpOption = AttendanceDirectory["options"]["employees"][number];

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

function recentMonths(count = 18): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
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

function isPresentStatus(row: AttendanceRecord): boolean {
  return (
    row.status === "present" ||
    row.status === "late" ||
    row.status === "work_from_home" ||
    row.apiStatus === "on_duty"
  );
}

function matchesStatus(row: AttendanceRecord, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "present") return isPresentStatus(row);
  if (filter === "absent") return row.status === "absent";
  return row.status === "half_day";
}

function inDateRange(row: AttendanceRecord, from: string, to: string): boolean {
  if (from && row.attendanceDate < from) return false;
  if (to && row.attendanceDate > to) return false;
  return true;
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
  const initialRange = monthBounds(currentMonthYm());

  const [employeeId, setEmployeeId] = useState("");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [month, setMonth] = useState(currentMonthYm);
  const [dateFrom, setDateFrom] = useState(initialRange.from);
  const [dateTo, setDateTo] = useState(initialRange.to);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [rows, setRows] = useState<AttendanceRecord[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);

  const searchWrapRef = useRef<HTMLDivElement>(null);
  const autoMonthRef = useRef("");

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!searchWrapRef.current?.contains(e.target as Node)) setSearchOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  useEffect(() => {
    if (!employeeId) {
      setRows([]);
      setRowsLoading(false);
      return;
    }
    let cancelled = false;
    setRowsLoading(true);
    void loadAttendanceForEmployee(employeeId, directory)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setRowsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [employeeId, directory]);

  useEffect(() => {
    if (!employeeId || !rows.length) return;
    if (autoMonthRef.current === employeeId) return;
    autoMonthRef.current = employeeId;
    const monthsWithData = new Set(rows.map((r) => r.attendanceDate.slice(0, 7)).filter(Boolean));
    if (monthsWithData.has(month)) return;
    const latest = Array.from(monthsWithData).sort().reverse()[0];
    if (!latest) return;
    const bounds = monthBounds(latest);
    setMonth(latest);
    setDateFrom(bounds.from);
    setDateTo(bounds.to);
  }, [employeeId, rows, month]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 1) return [];
    return employees
      .filter(
        (e) =>
          e.label.toLowerCase().includes(q) ||
          e.code.toLowerCase().includes(q) ||
          e.designation.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [employees, search]);

  const employeeMeta = employees.find((e) => e.id === employeeId);

  function selectEmployee(emp: EmpOption) {
    setEmployeeId(emp.id);
    setSearch("");
    setSearchOpen(false);
    setStatusFilter("all");
  }

  function clearEmployee() {
    autoMonthRef.current = "";
    setEmployeeId("");
    setSearch("");
    setRows([]);
    setStatusFilter("all");
  }

  function applyMonth(ym: string) {
    setMonth(ym);
    const bounds = monthBounds(ym);
    setDateFrom(bounds.from);
    setDateTo(bounds.to);
  }

  const rangedRows = useMemo(
    () => rows.filter((r) => inDateRange(r, dateFrom, dateTo)),
    [rows, dateFrom, dateTo],
  );

  const summary = useMemo(
    () => ({
      present: rangedRows.filter(isPresentStatus).length,
      absent: rangedRows.filter((r) => r.status === "absent").length,
      half: rangedRows.filter((r) => r.status === "half_day").length,
    }),
    [rangedRows],
  );

  const listRows = useMemo(
    () =>
      rangedRows
        .filter((r) => matchesStatus(r, statusFilter))
        .sort((a, b) => b.attendanceDate.localeCompare(a.attendanceDate)),
    [rangedRows, statusFilter],
  );

  const monthOptions = useMemo(() => {
    const set = new Set(recentMonths());
    for (const r of rows) {
      if (r.attendanceDate.length >= 7) set.add(r.attendanceDate.slice(0, 7));
    }
    if (dateFrom.length >= 7) set.add(dateFrom.slice(0, 7));
    return Array.from(set).sort().reverse();
  }, [rows, dateFrom]);

  const busy = loading || rowsLoading;

  if (!employees.length && !loading) {
    return (
      <HrEmptyState
        title="No employees"
        description="Add employees in Workforce to browse attendance by person."
      />
    );
  }

  const cards: {
    key: StatusFilter;
    label: string;
    value: number;
    icon: typeof CheckCircle2;
    tone: string;
  }[] = [
    {
      key: "present",
      label: "Present",
      value: summary.present,
      icon: CheckCircle2,
      tone: "bg-hrms-mint text-hrms-success",
    },
    {
      key: "absent",
      label: "Absent",
      value: summary.absent,
      icon: UserX,
      tone: "bg-hrms-pink text-hrms-danger",
    },
    {
      key: "half_day",
      label: "Half day",
      value: summary.half,
      icon: Clock3,
      tone: "bg-hrms-peach text-hrms-warning",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
        <div ref={searchWrapRef} className="relative max-w-xl">
          <label htmlFor="attendance-employee-search" className="sr-only">
            Search employee
          </label>
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="attendance-employee-search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            placeholder="Search employee by name or code…"
            autoComplete="off"
            className="h-9 pl-8 pr-8"
          />
          {search ? (
            <button
              type="button"
              aria-label="Clear search"
              className="absolute top-1/2 right-2 cursor-pointer rounded-sm p-0.5 text-muted-foreground transition-colors duration-200 hover:text-foreground"
              onClick={() => setSearch("")}
            >
              <X className="size-3.5" />
            </button>
          ) : null}

          {searchOpen && search.trim() ? (
            <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-md">
              {matches.length ? (
                <ul className="erp-scroll max-h-64 overflow-auto py-1">
                  {matches.map((emp) => (
                    <li key={emp.id}>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors duration-200",
                          "hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none",
                          emp.id === employeeId && "bg-muted/40",
                        )}
                        onClick={() => selectEmployee(emp)}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{emp.label}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {emp.code}
                            {emp.designation ? ` · ${emp.designation}` : ""}
                          </span>
                        </span>
                        <UserRound className="size-3.5 shrink-0 text-muted-foreground" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-3 py-3 text-xs text-muted-foreground">
                  No employee matches “{search.trim()}”. Try name or code.
                </p>
              )}
            </div>
          ) : null}
        </div>

        {employeeMeta ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{employeeMeta.label}</p>
              <p className="truncate text-xs text-muted-foreground">
                {employeeMeta.code}
                {employeeMeta.designation ? ` · ${employeeMeta.designation}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/hr/workforce/${employeeId}?tab=attendance`}>
                <Button size="sm" variant="outline" className="h-7 cursor-pointer text-xs">
                  <ExternalLink className="size-3.5" />
                  Profile
                </Button>
              </Link>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 cursor-pointer text-xs"
                onClick={clearEmployee}
              >
                Clear
              </Button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SetupField label="Month">
            <SetupSelect value={month} onChange={(e) => applyMonth(e.target.value)}>
              {monthOptions.map((ym) => (
                <option key={ym} value={ym}>
                  {monthLabel(ym)}
                </option>
              ))}
            </SetupSelect>
          </SetupField>
          <SetupField label="From">
            <Input
              type="date"
              className="h-8"
              value={dateFrom}
              onChange={(e) => {
                const value = e.target.value;
                setDateFrom(value);
                if (value.length >= 7) setMonth(value.slice(0, 7));
              }}
            />
          </SetupField>
          <SetupField label="To">
            <Input
              type="date"
              className="h-8"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </SetupField>
          <SetupField label="Status">
            <SetupSelect
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="all">All</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="half_day">Half day</option>
            </SetupSelect>
          </SetupField>
        </div>
      </div>

      {!employeeId ? (
        <HrEmptyState
          title="Search an employee"
          description="Type a name or employee code, then pick a person to see present, absent, and half-day for the selected dates."
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {cards.map((card) => {
              const active = statusFilter === card.key;
              const Icon = card.icon;
              return (
                <button
                  key={card.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setStatusFilter(active ? "all" : card.key)}
                  className={cn(
                    "cursor-pointer rounded-xl border px-3 py-2.5 text-left shadow-sm transition-all duration-200",
                    "hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    active ? "border-primary/50 ring-1 ring-primary/20" : "border-border/70 bg-card",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {card.label}
                    </p>
                    <span className={cn("rounded-md p-1", card.tone)}>
                      <Icon className="size-3.5" />
                    </span>
                  </div>
                  <p className="mt-0.5 text-xl font-semibold tabular-nums">{card.value}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {dateFrom && dateTo ? `${dateFrom} → ${dateTo}` : "Selected dates"}
                  </p>
                </button>
              );
            })}
          </div>

          {busy ? (
            <p className="text-sm text-muted-foreground">Loading attendance…</p>
          ) : !listRows.length ? (
            <HrEmptyState
              title="No attendance for this filter"
              description="Try another month, custom date range, or status. Mark attendance if this period is empty."
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
              <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-2 text-xs text-muted-foreground">
                <CalendarDays className="size-3.5" />
                <span>
                  {listRows.length} day{listRows.length === 1 ? "" : "s"}
                  {statusFilter !== "all" ? ` · ${statusFilter.replace("_", " ")}` : ""}
                </span>
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
                    {listRows.map((row) => (
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
                        <td
                          className="max-w-[200px] truncate px-3 py-2 text-xs text-muted-foreground"
                          title={row.notes}
                        >
                          {row.notes || "—"}
                        </td>
                        <td className="px-3 py-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 cursor-pointer text-xs"
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
        </>
      )}
    </div>
  );
}
