"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, FileText, Loader2, Lock, RefreshCw, Unlock } from "lucide-react";

import { LeaveAdjustPanel } from "@/components/hr/attendance/leave-adjust-panel";
import { HrFormDialog } from "@/components/hr/hr-form-dialog";
import { HrEmptyState, HrStatusBadge } from "@/components/hr/hr-primitives";
import { SetupConfirmDialog } from "@/components/hr/setup/setup-confirm";
import { SetupField, SetupSelect } from "@/components/hr/setup/setup-drawer";
import { toast } from "@/components/hr/setup/setup-toast";
import { EmsPagination } from "@/components/hr/workforce/ems-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { splitPresentAndHalf } from "@/lib/payroll-attendance-cycle";
import {
  buildPayrollCycle,
  isPfDeductionLabel,
  readPayrollCutoverDay,
  writePayrollCutoverDay,
} from "@/lib/payroll-cycle";
import {
  loadAttendanceDirectory,
  type AttendanceDirectory,
} from "@/services/attendance-management-service";
import type { HrMasterOption } from "@/services/hr-master-connector";
import { formatInr } from "@/services/payroll-service";
import {
  getPayrollRun,
  getPayrollRunAttendance,
  getPayrollRunEmployeeLine,
  isMonthLocked,
  listPayrollRunEmployeeLines,
  lockPayrollMonth,
  previewPayrollRunEmployees,
  runPayroll,
  uniqueRunsByMonth,
  unlockPayrollMonth,
  type PayrollDirectory,
} from "@/services/payroll-management-service";
import {
  monthLabel,
  RUN_STATUS_LABELS,
  type EmployeeSalary,
  type PayrollRun,
  type PayrollRunEmployeeLine,
} from "@/types/payroll-management";

const PAGE = 10;

function monthOptions(count = 12) {
  const now = new Date();
  return Array.from({ length: count }).map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return { value: ym, label: monthLabel(ym) };
  });
}

type GenerateEmployeeRow = {
  employeeId: string;
  name: string;
  code: string;
  department: string;
  monthlyCtc: number;
  presentDays?: number;
  leaveDays?: number;
  weeklyOff?: number;
  lopDays?: number;
  payableDays?: number;
  periodDays?: number;
  net?: number;
};

function rowIdentityKeys(row: Pick<GenerateEmployeeRow, "employeeId" | "code">): string[] {
  return [row.employeeId, row.code]
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

function dedupeGenerateRows(rows: GenerateEmployeeRow[]): GenerateEmployeeRow[] {
  const seen = new Set<string>();
  const out: GenerateEmployeeRow[] = [];
  for (const row of rows) {
    const keys = rowIdentityKeys(row);
    if (keys.some((k) => seen.has(k))) continue;
    for (const k of keys) seen.add(k);
    out.push(row);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

function employeesWithAssignedSalary(
  salaries: EmployeeSalary[],
  employees: HrMasterOption[],
): GenerateEmployeeRow[] {
  const rows: GenerateEmployeeRow[] = [];
  for (const s of salaries) {
    if (s.salaryStatus !== "active" || !(s.monthlyCtc > 0)) continue;
    const emp = employees.find((e) => e.id === s.employeeId || e.code === s.employeeId);
    rows.push({
      employeeId: emp?.id || s.employeeId,
      name: emp?.label.split(" · ")[0] || s.employeeName,
      code: emp?.code || s.employeeId,
      department: emp?.department || s.department || "—",
      monthlyCtc: s.monthlyCtc,
    });
  }
  for (const emp of employees) {
    const ctc = emp.monthlyCtc ?? 0;
    if (!(ctc > 0)) continue;
    rows.push({
      employeeId: emp.id,
      name: emp.label.split(" · ")[0] || emp.code || emp.id,
      code: emp.code || emp.id,
      department: emp.department || "—",
      monthlyCtc: ctc,
    });
  }
  return dedupeGenerateRows(rows);
}

function employeeName(line: PayrollRunEmployeeLine, employees: HrMasterOption[]) {
  const emp = employees.find(
    (e) => e.id === line.employeeId || e.code === line.employeeId || e.code === line.employeeCode,
  );
  return emp?.label.split(" · ")[0] || line.employeeName;
}

function PayTable({
  title,
  rows,
  totalLabel,
  total,
  factor,
}: {
  title: string;
  rows: { label: string; amount: number }[];
  totalLabel: string;
  total: number;
  factor: number;
}) {
  const display = rows.map((r) => {
    const fixed = isPfDeductionLabel(r.label);
    const monthly = fixed || !(factor > 0) ? r.amount : Math.round(r.amount / factor);
    return { ...r, monthly, cycle: r.amount };
  });
  const monthlyTotal = display.reduce((s, r) => s + r.monthly, 0);
  const cycleTotal = display.length ? display.reduce((s, r) => s + r.cycle, 0) : total;
  return (
    <div className="overflow-hidden rounded-xl border border-border/70">
      <table className="w-full text-left text-sm">
        <thead className="border-b bg-muted/40 text-[11px] uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">{title}</th>
            <th className="px-3 py-2 text-right font-medium">Monthly</th>
            <th className="px-3 py-2 text-right font-medium">This cycle</th>
          </tr>
        </thead>
        <tbody>
          {display.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-3 py-3 text-muted-foreground">
                None
              </td>
            </tr>
          ) : (
            display.map((r) => (
              <tr key={r.label} className="border-b border-border/50">
                <td className="px-3 py-2">{r.label}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatInr(r.monthly)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatInr(r.cycle)}</td>
              </tr>
            ))
          )}
          <tr className="bg-muted/30">
            <td className="px-3 py-2 font-medium">{totalLabel}</td>
            <td className="px-3 py-2 text-right font-medium tabular-nums">{formatInr(monthlyTotal)}</td>
            <td className="px-3 py-2 text-right font-medium tabular-nums">{formatInr(cycleTotal)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function PayrollRunWorkspace({
  dir,
  employees,
  onRefresh,
}: {
  dir: PayrollDirectory | null;
  employees: HrMasterOption[];
  onRefresh: () => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const runs = useMemo(() => uniqueRunsByMonth(dir?.runs ?? []), [dir]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [openRunId, setOpenRunId] = useState("");
  const [openEmployeeId, setOpenEmployeeId] = useState("");
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateMonth, setGenerateMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [cutoverDay, setCutoverDay] = useState(() => readPayrollCutoverDay());
  const [previewRows, setPreviewRows] = useState<GenerateEmployeeRow[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [listTick, setListTick] = useState(0);
  const [running, setRunning] = useState(false);
  const [confirmLock, setConfirmLock] = useState<{ run: PayrollRun; mode: "lock" | "unlock" } | null>(
    null,
  );
  const [locking, setLocking] = useState(false);
  const [directory, setDirectory] = useState<AttendanceDirectory | null>(null);
  const [payReload, setPayReload] = useState(0);

  const openRun = openRunId ? getPayrollRun(openRunId) ?? runs.find((r) => r.id === openRunId) ?? null : null;
  const lines = openRun ? listPayrollRunEmployeeLines(openRun.id) : [];
  const payLine =
    openRun && openEmployeeId
      ? getPayrollRunEmployeeLine(openRun.id, openEmployeeId) ??
        listPayrollRunEmployeeLines(openRun.id).find(
          (l) => l.employeeCode === openEmployeeId || l.employeeName === openEmployeeId,
        ) ??
        null
      : null;

  const filteredRuns = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return runs;
    return runs.filter((r) =>
      [r.month, monthLabel(r.month), r.cycleLabel, r.status].join(" ").toLowerCase().includes(q),
    );
  }, [query, runs]);

  const pageRuns = useMemo(() => {
    const s = (page - 1) * PAGE;
    return filteredRuns.slice(s, s + PAGE);
  }, [filteredRuns, page]);

  const cycle = useMemo(
    () => buildPayrollCycle(generateMonth, cutoverDay),
    [generateMonth, cutoverDay],
  );

  useEffect(() => setPage(1), [query]);

  useEffect(() => {
    const generate = searchParams.get("generate") === "1";
    const runParam = searchParams.get("run") || "";
    const empParam = searchParams.get("employee") || "";
    if (generate) {
      setGenerateOpen(true);
      const m = searchParams.get("month");
      if (m) setGenerateMonth(m.slice(0, 7));
    }
    if (runParam) {
      setOpenRunId(runParam);
      setOpenEmployeeId(empParam);
    }
    if (generate || runParam) {
      router.replace("/hr/payroll?section=run-payroll");
    }
  }, [router, searchParams]);

  useEffect(() => {
    if (!generateOpen) return;
    setListTick((n) => n + 1);
  }, [generateOpen, generateMonth, cutoverDay]);

  const employeesRef = useRef(employees);
  employeesRef.current = employees;
  const salariesRef = useRef(dir?.salaries ?? []);
  salariesRef.current = dir?.salaries ?? [];
  const cycleRef = useRef({ generateMonth, cutoverDay });
  cycleRef.current = { generateMonth, cutoverDay };

  useEffect(() => {
    if (!generateOpen) {
      setPreviewRows([]);
      setPreviewing(false);
      return;
    }
    if (listTick === 0) return;
    let cancelled = false;
    const staff = employeesRef.current;
    const { generateMonth: month, cutoverDay: day } = cycleRef.current;
    const base = employeesWithAssignedSalary(salariesRef.current, staff);
    setPreviewRows(base);
    setPreviewing(true);
    void previewPayrollRunEmployees(month, day)
      .then((p) => {
        if (cancelled) return;
        const withPay = p.lines.filter((l) => l.monthlyCtc > 0);
        const merged = dedupeGenerateRows(
          (withPay.length ? withPay : p.lines).map((l) => ({
            employeeId: l.employeeId,
            name: employeeName(l, staff),
            code: l.employeeCode || l.employeeId,
            department: l.department || "—",
            monthlyCtc: l.monthlyCtc,
            presentDays: l.presentDays,
            leaveDays: l.leaveDays,
            weeklyOff: l.weeklyOff ?? 0,
            lopDays: l.lopDays ?? l.absentDays,
            payableDays: l.payableDays,
            periodDays: l.periodDays || l.workingDaysInCycle || 30,
            net: l.net,
          })),
        );
        const paid = merged.filter((r) => r.monthlyCtc > 0);
        setPreviewRows(paid.length ? paid : base);
      })
      .catch(() => {
        if (!cancelled) setPreviewRows(base);
      })
      .finally(() => {
        if (!cancelled) setPreviewing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [generateOpen, listTick]);

  const loadLeaveDir = useCallback(() => {
    void loadAttendanceDirectory()
      .then(setDirectory)
      .catch(() => setDirectory(null));
  }, []);

  useEffect(() => {
    if (openEmployeeId) loadLeaveDir();
  }, [openEmployeeId, loadLeaveDir]);

  function openMonth(run: PayrollRun) {
    setOpenRunId(run.id);
    setOpenEmployeeId("");
  }

  async function handleGenerate() {
    if (isMonthLocked(generateMonth)) {
      toast("This month is locked", "error");
      return;
    }
    setRunning(true);
    try {
      const run = await runPayroll(generateMonth, cutoverDay);
      toast(`Payroll updated for ${monthLabel(generateMonth)}`);
      setGenerateOpen(false);
      onRefresh();
      setOpenRunId(run.id);
      setOpenEmployeeId("");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setRunning(false);
    }
  }

  const locked = openRun ? isMonthLocked(openRun.month) || openRun.status === "locked" : false;
  const att = openRun && payLine
    ? getPayrollRunAttendance(openRun.id).find(
        (a) =>
          a.employeeId === payLine.employeeId ||
          a.employeeCode === payLine.employeeCode ||
          a.employeeId === openEmployeeId,
      )
    : undefined;
  const split = splitPresentAndHalf(
    att?.presentDays ?? payLine?.presentDays ?? 0,
    att?.halfDays ?? payLine?.halfDays ?? 0,
  );
  const payable = payLine?.payableDays ?? 0;
  const working = payLine?.periodDays || payLine?.workingDaysInCycle || 30;
  const factor = payLine?.attendanceFactor || (working ? payable / working : 1);
  const options = useMemo(() => monthOptions(), []);
  const generateLocked = isMonthLocked(generateMonth);
  const eligibleCount = previewRows.filter((r) => r.monthlyCtc > 0).length;

  if (openRun && openEmployeeId) {
    const name = payLine ? employeeName(payLine, employees) : openEmployeeId;
    return (
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="cursor-pointer"
            onClick={() => setOpenEmployeeId("")}
          >
            <ChevronLeft className="size-3.5" />
            Employees
          </Button>
          <p className="text-sm font-medium">{name}</p>
        </div>
        {!payLine ? (
          <HrEmptyState title="Employee not found on this payroll" />
        ) : (
          <>
            {openRun.cycleStart && openRun.cycleEnd ? (
              <div className="w-full rounded-xl border border-border/70 bg-card p-3">
                <LeaveAdjustPanel
                  directory={directory}
                  initialEmployeeId={payLine.employeeId}
                  payrollRunId={openRun.id}
                  source="payroll_run"
                  locked={locked}
                  periodStart={openRun.cycleStart}
                  periodEnd={openRun.cycleEnd}
                  hideEmployee
                  onChanged={() => {
                    setPayReload((n) => n + 1);
                    onRefresh();
                  }}
                  attendanceSummary={{
                    present: split.present,
                    halfDay: split.half,
                    absent: att?.absentDays ?? payLine.absentDays ?? 0,
                    weekOff: att?.weeklyOff ?? payLine.weeklyOff ?? 0,
                    payable,
                  }}
                />
              </div>
            ) : null}
            <div className="grid gap-4 lg:grid-cols-2" key={payReload}>
              <PayTable
                title="Earnings"
                rows={payLine.earnings}
                totalLabel="Gross"
                total={payLine.gross}
                factor={factor}
              />
              <PayTable
                title="Deductions"
                rows={payLine.deductionItems}
                totalLabel="Total deductions"
                total={payLine.deductionTotal}
                factor={factor}
              />
            </div>
            <div className="rounded-xl border border-border/70 bg-card px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Net pay
              </p>
              <p className="mt-1 text-lg font-medium tabular-nums">{formatInr(payLine.net)}</p>
            </div>
          </>
        )}
      </section>
    );
  }

  if (openRun) {
    return (
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="cursor-pointer"
            onClick={() => setOpenRunId("")}
          >
            <ChevronLeft className="size-3.5" />
            Months
          </Button>
          <p className="text-sm font-medium">{monthLabel(openRun.month)}</p>
          {openRun.cycleLabel ? (
            <p className="text-xs text-muted-foreground">{openRun.cycleLabel}</p>
          ) : null}
          <HrStatusBadge status={RUN_STATUS_LABELS[openRun.status] ?? openRun.status} />
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="cursor-pointer"
              onClick={() => setConfirmLock({ run: openRun, mode: locked ? "unlock" : "lock" })}
            >
              {locked ? <Unlock className="size-3.5" /> : <Lock className="size-3.5" />}
              {locked ? "Unlock" : "Lock"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="cursor-pointer"
              onClick={() =>
                router.push(
                  `/hr/payroll?section=payslip&generate=1&month=${encodeURIComponent(openRun.month.slice(0, 7))}`,
                )
              }
            >
              <FileText className="size-3.5" />
              Generate slip
            </Button>
          </div>
        </div>
        {lines.length === 0 ? (
          <HrEmptyState title="No employees on this payroll" />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/70">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b bg-muted/40 text-[11px] uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Present</th>
                  <th className="px-3 py-2 font-medium">Leave</th>
                  <th className="px-3 py-2 font-medium">Weekly off</th>
                  <th className="px-3 py-2 font-medium">Loss of pay</th>
                  <th className="px-3 py-2 font-medium">Payable</th>
                  <th className="px-3 py-2 font-medium">Gross</th>
                  <th className="px-3 py-2 font-medium">Deductions</th>
                  <th className="px-3 py-2 font-medium">Net</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const attRow = splitPresentAndHalf(l.presentDays, l.halfDays);
                  return (
                    <tr
                      key={l.employeeId}
                      className="cursor-pointer border-b border-border/50 transition-colors duration-200 hover:bg-muted/30"
                      onClick={() => setOpenEmployeeId(l.employeeId)}
                    >
                      <td className="px-3 py-2 font-medium">{employeeName(l, employees)}</td>
                      <td className="px-3 py-2 tabular-nums">{attRow.present}</td>
                      <td className="px-3 py-2 tabular-nums">{l.leaveDays}</td>
                      <td className="px-3 py-2 tabular-nums">{l.weeklyOff ?? 0}</td>
                      <td className="px-3 py-2 tabular-nums">{l.lopDays ?? l.absentDays}</td>
                      <td className="px-3 py-2 tabular-nums">
                        {l.payableDays}/{l.periodDays || l.workingDaysInCycle || 30}
                      </td>
                      <td className="px-3 py-2 tabular-nums">{formatInr(l.gross)}</td>
                      <td className="px-3 py-2 tabular-nums">{formatInr(l.deductionTotal)}</td>
                      <td className="px-3 py-2 tabular-nums font-medium">{formatInr(l.net)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <LockDialog
          confirmLock={confirmLock}
          locking={locking}
          onCancel={() => setConfirmLock(null)}
          onConfirm={() => {
            if (!confirmLock) return;
            setLocking(true);
            try {
              if (confirmLock.mode === "lock") {
                lockPayrollMonth(confirmLock.run.month, "Locked from payroll run");
                toast("Month locked");
              } else {
                unlockPayrollMonth(confirmLock.run.month, "Unlocked from payroll run");
                toast("Month unlocked");
              }
              setConfirmLock(null);
              onRefresh();
            } catch (e) {
              toast(e instanceof Error ? e.message : "Failed", "error");
            } finally {
              setLocking(false);
            }
          }}
        />
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[180px] flex-1">
          <Input
            placeholder="Search months…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9"
          />
        </div>
        <Button
          size="sm"
          className="cursor-pointer"
          onClick={() => setGenerateOpen(true)}
        >
          Generate payroll
        </Button>
      </div>
      {pageRuns.length === 0 ? (
        <HrEmptyState
          title="No payroll months"
          description="Generate payroll for a month to see it here."
          action={
            <Button size="sm" className="cursor-pointer" onClick={() => setGenerateOpen(true)}>
              Generate payroll
            </Button>
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-border/70">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b bg-muted/40 text-[11px] uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Month</th>
                  <th className="px-3 py-2 font-medium">Employees</th>
                  <th className="px-3 py-2 font-medium">Gross</th>
                  <th className="px-3 py-2 font-medium">Deductions</th>
                  <th className="px-3 py-2 font-medium">Net</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Lock</th>
                </tr>
              </thead>
              <tbody>
                {pageRuns.map((r) => {
                  const rowLocked = isMonthLocked(r.month) || r.status === "locked";
                  return (
                    <tr
                      key={r.id}
                      className="cursor-pointer border-b border-border/50 transition-colors duration-200 hover:bg-muted/30"
                      onClick={() => openMonth(r)}
                    >
                      <td className="px-3 py-2">
                        <span className="font-medium">{monthLabel(r.month)}</span>
                        {r.cycleLabel ? (
                          <p className="text-xs text-muted-foreground">{r.cycleLabel}</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 tabular-nums">{r.employeeCount}</td>
                      <td className="px-3 py-2 tabular-nums">{formatInr(r.grossTotal)}</td>
                      <td className="px-3 py-2 tabular-nums">{formatInr(r.deductionTotal)}</td>
                      <td className="px-3 py-2 tabular-nums font-medium">{formatInr(r.netTotal)}</td>
                      <td className="px-3 py-2">
                        <HrStatusBadge status={RUN_STATUS_LABELS[r.status] ?? r.status} />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            className="cursor-pointer text-muted-foreground transition-colors duration-200 hover:text-foreground"
                            aria-label={rowLocked ? `Unlock ${monthLabel(r.month)}` : `Lock ${monthLabel(r.month)}`}
                            title={rowLocked ? "Unlock" : "Lock"}
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmLock({ run: r, mode: rowLocked ? "unlock" : "lock" });
                            }}
                          >
                            {rowLocked ? <Unlock className="size-3.5" /> : <Lock className="size-3.5" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <EmsPagination page={page} pageSize={PAGE} total={filteredRuns.length} onPageChange={setPage} />
        </>
      )}

      <HrFormDialog
        open={generateOpen}
        wide
        className="sm:max-w-5xl"
        title="Generate payroll"
        description="Pick a month. The same month is updated if it already exists."
        onClose={() => setGenerateOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer"
              onClick={() => setGenerateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="cursor-pointer"
              disabled={running || generateLocked || eligibleCount === 0}
              onClick={() => void handleGenerate()}
            >
              {running ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {running ? "Generating…" : generateLocked ? "Month locked" : "Generate"}
            </Button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <SetupField label="Month" required>
            <SetupSelect value={generateMonth} onChange={(e) => setGenerateMonth(e.target.value)}>
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </SetupSelect>
          </SetupField>
          <SetupField label="Cycle start day">
            <SetupSelect
              value={String(cutoverDay)}
              onChange={(e) => {
                const day = Number(e.target.value);
                setCutoverDay(day);
                writePayrollCutoverDay(day);
              }}
            >
              {Array.from({ length: 28 }).map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </SetupSelect>
          </SetupField>
        </div>
        <p className="mt-3 text-sm tabular-nums">{cycle.label}</p>
        <div className="mt-3 overflow-hidden rounded-xl border border-border/70">
          <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Employees
            </p>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">
                {previewing ? "Updating attendance…" : `${eligibleCount} with assigned salary`}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="cursor-pointer text-muted-foreground transition-colors duration-200 hover:text-foreground"
                disabled={previewing}
                aria-label="Refresh employee list"
                title="Refresh"
                onClick={() => {
                  onRefresh();
                  setListTick((n) => n + 1);
                }}
              >
                <RefreshCw className={cn("size-3.5", previewing && "animate-spin")} />
              </Button>
            </div>
          </div>
          {eligibleCount === 0 && !previewing ? (
            <p className="px-3 py-6 text-sm text-muted-foreground">
              Assign salary before generating payroll.
            </p>
          ) : (
            <div className="erp-scroll max-h-[min(48vh,22rem)] overflow-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="sticky top-0 bg-card text-[11px] uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Code</th>
                    <th className="px-3 py-2 text-right font-medium">Present</th>
                    <th className="px-3 py-2 text-right font-medium">Leave</th>
                    <th className="px-3 py-2 text-right font-medium">Weekly off</th>
                    <th className="px-3 py-2 text-right font-medium">Loss of pay</th>
                    <th className="px-3 py-2 text-right font-medium">Payable</th>
                    <th className="px-3 py-2 text-right font-medium">CTC</th>
                    <th className="px-3 py-2 text-right font-medium">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row) => {
                    const daysReady = row.payableDays != null;
                    const present = splitPresentAndHalf(row.presentDays ?? 0, 0).present;
                    return (
                    <tr key={`${row.employeeId}:${row.code}`} className="border-t border-border/50">
                      <td className="px-3 py-2 font-medium">{row.name}</td>
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">{row.code}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {daysReady ? present : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {daysReady ? (row.leaveDays ?? 0) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {daysReady ? (row.weeklyOff ?? 0) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {daysReady ? (row.lopDays ?? 0) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {daysReady
                          ? `${row.payableDays}/${row.periodDays || 30}`
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatInr(row.monthlyCtc)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {row.net == null ? "—" : formatInr(row.net)}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </HrFormDialog>

      <LockDialog
        confirmLock={confirmLock}
        locking={locking}
        onCancel={() => setConfirmLock(null)}
        onConfirm={() => {
          if (!confirmLock) return;
          setLocking(true);
          try {
            if (confirmLock.mode === "lock") {
              lockPayrollMonth(confirmLock.run.month, "Locked from payroll run");
              toast("Month locked");
            } else {
              unlockPayrollMonth(confirmLock.run.month, "Unlocked from payroll run");
              toast("Month unlocked");
            }
            setConfirmLock(null);
            onRefresh();
          } catch (e) {
            toast(e instanceof Error ? e.message : "Failed", "error");
          } finally {
            setLocking(false);
          }
        }}
      />
    </section>
  );
}

function LockDialog({
  confirmLock,
  locking,
  onCancel,
  onConfirm,
}: {
  confirmLock: { run: PayrollRun; mode: "lock" | "unlock" } | null;
  locking: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <SetupConfirmDialog
      open={Boolean(confirmLock)}
      title={confirmLock?.mode === "unlock" ? "Unlock month" : "Lock month"}
      message={
        confirmLock
          ? confirmLock.mode === "unlock"
            ? `Unlock ${monthLabel(confirmLock.run.month)}?`
            : `Lock ${monthLabel(confirmLock.run.month)}?`
          : ""
      }
      confirmLabel={confirmLock?.mode === "unlock" ? "Unlock" : "Lock"}
      loading={locking}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
