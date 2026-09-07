"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Search } from "lucide-react";

import { HrEmptyState, HrStatusBadge } from "@/components/hr/hr-primitives";
import { SetupField, SetupInput, SetupSelect } from "@/components/hr/setup/setup-drawer";
import { SetupConfirmDialog } from "@/components/hr/setup/setup-confirm";
import { toast } from "@/components/hr/setup/setup-toast";
import { Button } from "@/components/ui/button";
import { EmsPagination } from "@/components/hr/workforce/ems-primitives";
import { cn } from "@/lib/utils";
import { listPayrollCycleOptions } from "@/lib/payroll-cycle";
import {
  applyLeaveAdjustDay,
  listLeaveAdjustHistory,
  payrollRunIdForApi,
  poolRemaining,
  previewLeaveAdjust,
  revertLeaveAdjust,
  type LeaveAdjustDay,
  type LeaveAdjustHistoryRow,
  type LeaveAdjustPreview,
} from "@/services/leave-adjust-service";
import { formatApiError } from "@/services/api-client";
import type { AttendanceDirectory } from "@/services/attendance-management-service";

type PeriodMode = "month" | "custom" | "cycle";

const PAGE_SIZE = 15;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function todayYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function monthBounds(ym: string): { start: string; end: string } | null {
  const m = ym.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  const last = new Date(year, month, 0).getDate();
  return { start: `${m[1]}-${m[2]}-01`, end: `${m[1]}-${m[2]}-${pad2(last)}` };
}

const PRESENT_PUNCH = new Set(["present", "late", "work_from_home", "on_duty", "miss_punch"]);

function presenceOf(punch: string, kind: string): { label: string; present: boolean | null } {
  const status = (punch || "").toLowerCase();
  if (kind === "off" || status === "week_off" || status === "holiday") {
    return { label: status === "holiday" ? "Holiday" : "Week off", present: null };
  }
  if (status === "half_day") return { label: "Half day", present: true };
  if (PRESENT_PUNCH.has(status)) return { label: "Present", present: true };
  if (kind === "already_adjusted" || status === "leave") return { label: "On leave", present: null };
  return { label: "Not present", present: false };
}

function canMarkLeave(d: LeaveAdjustDay): boolean {
  if (d.can_mark_leave) return true;
  const presence = presenceOf(d.punch_status, d.kind);
  if (d.proposed_result === "adjusted" && d.proposed_type_code) return false;
  if (presence.label === "On leave" && !d.proposed_type_code) return true;
  return presence.present === false;
}

function employeeLine(e: { label: string; code: string }): string {
  return e.code ? `${e.label} · ${e.code}` : e.label;
}

export function LeaveAdjustPanel({
  directory,
  initialEmployeeId,
  payrollRunId,
  source = "attendance_tab",
  locked = false,
  periodStart,
  periodEnd,
  hideEmployee = false,
  onChanged,
  belowList,
  selectedDate: selectedDateProp,
  onSelectedDateChange,
  attendanceSummary,
}: {
  directory: AttendanceDirectory | null;
  initialEmployeeId?: string;
  payrollRunId?: string;
  source?: "attendance_tab" | "payroll_run";
  locked?: boolean;
  periodStart?: string;
  periodEnd?: string;
  hideEmployee?: boolean;
  onChanged?: () => void;
  belowList?: ReactNode;
  selectedDate?: string | null;
  onSelectedDateChange?: (date: string | null) => void;
  attendanceSummary?: {
    present: number;
    halfDay: number;
    absent: number;
    weekOff: number;
    payable: number;
  };
}) {
  const periodLocked = Boolean(periodStart && periodEnd);
  const cycles = useMemo(() => listPayrollCycleOptions(10), []);
  const [periodMode, setPeriodMode] = useState<PeriodMode>("month");
  const [monthValue, setMonthValue] = useState(todayYearMonth);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [anchor, setAnchor] = useState(() => {
    if (periodStart) {
      const match = cycles.find((c) => c.cycle.start === periodStart);
      if (match) return match.value;
    }
    return cycles[0]?.value ?? "";
  });
  const cycleFromList = cycles.find((c) => c.value === anchor)?.cycle ?? cycles[0]?.cycle;
  const monthRange = monthBounds(monthValue);
  const customValid = Boolean(customStart && customEnd && customStart <= customEnd);
  const cycleStart = periodLocked
    ? periodStart
    : periodMode === "month"
      ? monthRange?.start
      : periodMode === "custom"
        ? customValid
          ? customStart
          : undefined
        : cycleFromList?.start;
  const cycleEnd = periodLocked
    ? periodEnd
    : periodMode === "month"
      ? monthRange?.end
      : periodMode === "custom"
        ? customValid
          ? customEnd
          : undefined
        : cycleFromList?.end;
  const cycleLabel =
    periodLocked && periodStart && periodEnd
      ? `${periodStart} – ${periodEnd}`
      : periodMode === "month" && monthRange
        ? `${monthRange.start} – ${monthRange.end}`
        : periodMode === "custom" && customValid
          ? `${customStart} – ${customEnd}`
          : cycleFromList?.label ?? "";
  const [employeeId, setEmployeeId] = useState(initialEmployeeId ?? "");
  const [preview, setPreview] = useState<LeaveAdjustPreview | null>(null);
  const [history, setHistory] = useState<LeaveAdjustHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(true);
  const [dayPage, setDayPage] = useState(1);
  const [internalSelected, setInternalSelected] = useState<string | null>(null);
  const selectedDate = selectedDateProp !== undefined ? selectedDateProp : internalSelected;
  function selectDate(date: string | null) {
    if (selectedDateProp === undefined) setInternalSelected(date);
    onSelectedDateChange?.(date);
  }
  const [confirmAction, setConfirmAction] = useState<"revert" | null>(null);
  const [markDate, setMarkDate] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initialEmployeeId) setEmployeeId(initialEmployeeId);
  }, [initialEmployeeId]);

  const load = useCallback(async () => {
    if (!employeeId || !cycleStart || !cycleEnd) {
      setPreview(null);
      setHistory([]);
      return;
    }
    setLoading(true);
    try {
      const [plan, hist] = await Promise.all([
        previewLeaveAdjust({
          employeeId,
          periodStart: cycleStart,
          periodEnd: cycleEnd,
        }),
        listLeaveAdjustHistory({
          employeeId,
          periodStart: cycleStart,
          periodEnd: cycleEnd,
        }).catch(() => [] as LeaveAdjustHistoryRow[]),
      ]);
      setPreview(plan);
      setHistory(hist);
    } catch (err) {
      toast(formatApiError(err, "Could not load leave adjust plan"), "error");
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, [employeeId, cycleStart, cycleEnd]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    const days = preview?.days ?? [];
    if (showAll) return days;
    return days.filter((d) => d.kind !== "off");
  }, [preview, showAll]);

  useEffect(() => {
    setDayPage(1);
  }, [employeeId, cycleStart, cycleEnd, showAll]);

  const dayPageRows = useMemo(() => {
    const start = (dayPage - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, dayPage]);

  useEffect(() => {
    const next =
      selectedDate && dayPageRows.some((d) => d.attendance_date === selectedDate)
        ? selectedDate
        : (dayPageRows[0]?.attendance_date ?? null);
    if (next !== selectedDate) selectDate(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only sync when page rows change
  }, [dayPageRows]);

  const clNow = poolRemaining(preview?.balances ?? [], "CL");
  const slNow = poolRemaining(preview?.balances ?? [], "SL");
  const attendanceKpi = useMemo(() => {
    const days = preview?.days ?? [];
    let present = 0;
    let halfDay = 0;
    let absent = 0;
    let weekOff = 0;
    let lop = 0;
    for (const d of days) {
      const punch = (d.punch_status || "").toLowerCase();
      const presence = presenceOf(d.punch_status, d.kind);
      if (presence.label === "Week off") weekOff += 1;
      else if (punch === "half_day") halfDay += 1;
      else if (presence.present === true) present += 1;
      else if (presence.present === false) absent += 1;
      if (d.proposed_result === "lop") lop += Number(d.days) || 0;
    }
    return {
      present,
      halfDay,
      absent,
      weekOff,
      payable: Math.max(0, 30 - lop),
    };
  }, [preview]);
  const kpi = attendanceSummary ?? attendanceKpi;
  const openHistory = history.filter((h) => !h.reverted_at).length;

  async function runMark(code: "CL" | "SL", date = markDate) {
    if (!employeeId || !cycleStart || !cycleEnd || !date) return;
    setBusy(true);
    try {
      await applyLeaveAdjustDay({
        employeeId,
        periodStart: cycleStart,
        periodEnd: cycleEnd,
        attendanceDate: date,
        leaveTypeCode: code,
        source,
        payrollRunId: payrollRunIdForApi(payrollRunId),
      });
      toast(code === "CL" ? "Marked as casual leave" : "Marked as sick leave");
      setMarkDate(null);
      await load();
      onChanged?.();
    } catch (err) {
      toast(formatApiError(err, "Could not mark leave"), "error");
    } finally {
      setBusy(false);
    }
  }

  async function runRevert() {
    if (!employeeId || !cycleStart || !cycleEnd) return;
    setBusy(true);
    try {
      const res = await revertLeaveAdjust({
        employeeId,
        periodStart: cycleStart,
        periodEnd: cycleEnd,
        payrollRunId: payrollRunIdForApi(payrollRunId),
      });
      toast(res.reverted ? `Reverted ${res.reverted} day(s)` : "Nothing to revert");
      await load();
      onChanged?.();
    } catch (err) {
      toast(formatApiError(err, "Could not revert leave adjust"), "error");
    } finally {
      setBusy(false);
      setConfirmAction(null);
    }
  }

  return (
    <div className="flex h-full min-h-[28rem] flex-1 flex-col gap-3 overflow-hidden">
      <div className="grid shrink-0 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {periodLocked ? (
          <SetupField label="Period">
            <p className="flex h-8 items-center text-sm tabular-nums">{cycleLabel}</p>
          </SetupField>
        ) : (
          <>
            <SetupField label="Period">
              <div className="flex rounded-lg border border-input p-0.5">
                {(
                  [
                    ["month", "Month"],
                    ["custom", "Custom"],
                    ["cycle", "Pay cycle"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={cn(
                      "h-7 flex-1 cursor-pointer rounded-md px-2 text-xs font-medium transition-colors duration-200",
                      periodMode === id
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                    onClick={() => setPeriodMode(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </SetupField>
            {periodMode === "month" ? (
              <SetupField label="Month">
                <SetupInput
                  type="month"
                  value={monthValue}
                  onChange={(e) => setMonthValue(e.target.value)}
                  className="cursor-pointer"
                />
              </SetupField>
            ) : null}
            {periodMode === "custom" ? (
              <>
                <SetupField label="From">
                  <SetupInput
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="cursor-pointer"
                  />
                </SetupField>
                <SetupField label="To">
                  <SetupInput
                    type="date"
                    value={customEnd}
                    min={customStart || undefined}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="cursor-pointer"
                  />
                </SetupField>
              </>
            ) : null}
            {periodMode === "cycle" ? (
              <SetupField label="Pay cycle">
                <SetupSelect value={anchor} onChange={(e) => setAnchor(e.target.value)}>
                  {cycles.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </SetupSelect>
              </SetupField>
            ) : null}
          </>
        )}
        {hideEmployee ? null : (
          <SetupField label="Employee" required>
            <EmployeeNameSearch
              employees={directory?.options.employees ?? []}
              value={employeeId}
              onChange={setEmployeeId}
            />
          </SetupField>
        )}
        <div className="flex items-end gap-2 sm:col-span-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="cursor-pointer transition-colors duration-200"
            disabled={!employeeId || !cycleStart || !cycleEnd || loading}
            onClick={() => void load()}
          >
            Preview
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="cursor-pointer transition-colors duration-200"
            disabled={locked || busy || loading || !employeeId || openHistory === 0}
            onClick={() => setConfirmAction("revert")}
          >
            Revert
          </Button>
        </div>
      </div>

      {locked ? (
        <p className="shrink-0 text-xs text-hrms-warning">This payroll run is locked. Leave adjust is read-only.</p>
      ) : null}

      <div className="flex min-h-0 w-full flex-1 flex-col gap-3">
        {preview ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <BalanceCard label="Present" value={kpi.present} />
            <BalanceCard label="Half day" value={kpi.halfDay} />
            <BalanceCard label="Absent" value={kpi.absent} />
            <BalanceCard label="WO" value={kpi.weekOff} />
            <BalanceCard label="Payable" value={`${kpi.payable}/30`} />
          </div>
        ) : null}
        <div className="flex min-h-0 w-full flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
          <label className="flex shrink-0 cursor-pointer items-center gap-2 border-b border-border/60 px-3 py-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              className="cursor-pointer"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
            />
            Show week-off / holiday days
          </label>
          {!employeeId ? (
            <div className="flex min-h-[12rem] items-center justify-center">
              <HrEmptyState
                title="Select an employee"
                description="Preview shows present vs not present for the period."
              />
            </div>
          ) : loading ? (
            <p className="p-3 text-sm text-muted-foreground">Loading days…</p>
          ) : rows.length === 0 ? (
            <div className="flex min-h-[12rem] items-center justify-center">
              <HrEmptyState title="No days in this period" />
            </div>
          ) : (
            <>
              <div className="erp-scroll max-h-[22rem] overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 z-10 border-b bg-muted/90 text-[11px] uppercase text-muted-foreground backdrop-blur-sm">
                    <tr>
                      <th className="px-3 py-2 font-medium">Date</th>
                      <th className="px-3 py-2 font-medium">Present</th>
                      <th className="px-3 py-2 font-medium">Punch</th>
                      <th className="px-3 py-2 font-medium">Leave</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayPageRows.map((d) => {
                      const presence = presenceOf(d.punch_status, d.kind);
                      const leaveLabel =
                        d.already_adjusted && d.proposed_result === "adjusted"
                          ? d.proposed_type_code || "Leave"
                          : "—";
                      const markable = !locked && canMarkLeave(d);
                      const openMark =
                        markable &&
                        (presence.label === "On leave" || presence.present === false);
                      return (
                        <tr
                          key={d.attendance_date}
                          tabIndex={0}
                          className={cn(
                            "cursor-pointer border-b border-border/50 transition-colors duration-200 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                            selectedDate === d.attendance_date && "bg-muted/40",
                          )}
                          onClick={() => {
                            selectDate(d.attendance_date);
                            if (openMark) setMarkDate(d.attendance_date);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              selectDate(d.attendance_date);
                              if (openMark) setMarkDate(d.attendance_date);
                            }
                          }}
                        >
                          <td className="px-3 py-2 tabular-nums">{d.attendance_date}</td>
                          <td className="px-3 py-2">
                            <HrStatusBadge status={presence.label} />
                          </td>
                          <td className="px-3 py-2">{d.punch_status.replaceAll("_", " ")}</td>
                          <td className="px-3 py-2">{leaveLabel}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <EmsPagination page={dayPage} pageSize={PAGE_SIZE} total={rows.length} onPageChange={setDayPage} />
            </>
          )}
        </div>

        {belowList}
      </div>
      {markDate ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 cursor-pointer bg-slate-950/40"
            aria-label="Cancel"
            onClick={() => setMarkDate(null)}
          />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-card p-4 shadow-lg">
            <h3 className="text-sm font-semibold tracking-tight">Mark leave</h3>
            <p className="mt-2 text-xs text-muted-foreground">{markDate}</p>
            <div className="mt-4 flex flex-col gap-2">
              <Button
                type="button"
                size="sm"
                className="cursor-pointer transition-colors duration-200"
                disabled={busy || clNow <= 0}
                onClick={() => void runMark("CL")}
              >
                Casual leave · {clNow} left
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="cursor-pointer transition-colors duration-200"
                disabled={busy || slNow <= 0}
                onClick={() => void runMark("SL")}
              >
                Sick leave · {slNow} left
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="cursor-pointer"
                onClick={() => setMarkDate(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      <SetupConfirmDialog
        open={confirmAction === "revert"}
        title="Revert leave adjust"
        message="Remove leave adjust for this employee and period and restore leave balances."
        confirmLabel="Revert"
        destructive
        loading={busy}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => void runRevert()}
      />
    </div>
  );
}

function EmployeeNameSearch({
  employees,
  value,
  onChange,
}: {
  employees: { id: string; label: string; code: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = employees.find((e) => e.id === value);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => e.label.toLowerCase().includes(q) || e.code.toLowerCase().includes(q));
  }, [employees, query]);

  useEffect(() => {
    function onDoc(ev: MouseEvent) {
      if (!wrapRef.current?.contains(ev.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        className={cn(
          "flex h-8 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 text-left text-sm outline-none transition-colors duration-200",
          "hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={cn("min-w-0 truncate", selected ? "text-foreground" : "text-muted-foreground")}>
          {selected ? employeeLine(selected) : "Select employee"}
        </span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
      </button>
      {open ? (
        <div className="absolute z-30 mt-1 w-full min-w-[16rem] overflow-hidden rounded-lg border border-border bg-card shadow-md">
          <div className="relative border-b border-border/70 p-1.5">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or code…"
              className="h-8 w-full rounded-md border border-input bg-transparent pr-2.5 pl-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
              }}
            />
          </div>
          <ul className="erp-scroll max-h-56 overflow-y-auto p-1" role="listbox">
            {matches.length === 0 ? (
              <li className="px-2 py-6 text-center text-xs text-muted-foreground">No names match</li>
            ) : (
              matches.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={e.id === value}
                    className={cn(
                      "flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors duration-150 hover:bg-muted/60",
                      e.id === value && "bg-muted/50",
                    )}
                    onClick={() => {
                      onChange(e.id);
                      setOpen(false);
                    }}
                  >
                    <span className="min-w-0 truncate">{e.label}</span>
                    {e.code ? (
                      <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{e.code}</span>
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function BalanceCard({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-card px-3 py-2 shadow-sm">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
      {hint ? <p className="text-[10px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
