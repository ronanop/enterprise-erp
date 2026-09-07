"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Scale } from "lucide-react";

import { LeaveAdjustPanel } from "@/components/hr/attendance/leave-adjust-panel";
import { HrEmptyState } from "@/components/hr/hr-primitives";
import { PageHeader } from "@/components/layout/page-header";
import { splitPresentAndHalf } from "@/lib/payroll-attendance-cycle";
import { isPfDeductionLabel, readPayrollCutoverDay } from "@/lib/payroll-cycle";
import { formatInr } from "@/services/payroll-service";
import {
  loadAttendanceDirectory,
  type AttendanceDirectory,
} from "@/services/attendance-management-service";
import {
  getPayrollRun,
  getPayrollRunAttendance,
  getPayrollRunEmployeeLine,
  isMonthLocked,
  loadPayrollDirectory,
  previewPayrollRunEmployees,
} from "@/services/payroll-management-service";
import { loadHrMasterDirectory } from "@/services/hr-master-connector";
import type { PayrollRun, PayrollRunEmployeeLine } from "@/types/payroll-management";
import { monthLabel } from "@/types/payroll-management";

export function PayrollRunEmployeePage({
  runId,
  employeeId,
}: {
  runId: string;
  employeeId: string;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <PayrollRunEmployeeBody runId={runId} employeeId={employeeId} />
    </Suspense>
  );
}

function PayrollRunEmployeeBody({
  runId,
  employeeId,
}: {
  runId: string;
  employeeId: string;
}) {
  const searchParams = useSearchParams();
  const isPreview = runId === "new";
  const [run, setRun] = useState<PayrollRun | null>(null);
  const [line, setLine] = useState<PayrollRunEmployeeLine | null>(null);
  const [name, setName] = useState("");
  const [hrEmployeeId, setHrEmployeeId] = useState("");
  const [directory, setDirectory] = useState<AttendanceDirectory | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadAt, setReloadAt] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      await loadPayrollDirectory();
      const decoded = decodeURIComponent(employeeId);
      const master = await loadHrMasterDirectory().catch(() => null);
      const emp = master?.employees.find((e) => e.id === decoded || e.code === decoded);

      let nextRun = isPreview ? null : getPayrollRun(runId);
      let nextLine = isPreview ? null : getPayrollRunEmployeeLine(runId, decoded);

      if (isPreview) {
        const month =
          searchParams.get("month") ||
          `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
        const cutover = Number(searchParams.get("cutover") || readPayrollCutoverDay());
        const preview = await previewPayrollRunEmployees(month, cutover);
        nextLine =
          preview.lines.find((l) => l.employeeId === decoded || l.employeeCode === decoded) ?? null;
        nextRun = {
          id: "new",
          runCode: "",
          month,
          monthLabel: monthLabel(month),
          cycleStart: preview.cycle.start,
          cycleEnd: preview.cycle.end,
          cycleCutoverDay: cutover,
          cycleLabel: preview.cycle.label,
          employeeCount: preview.lines.length,
          grossTotal: 0,
          deductionTotal: 0,
          netTotal: 0,
          status: "draft",
          attendanceSynced: false,
          leaveSynced: false,
          otSynced: false,
          createdAt: "",
          updatedAt: "",
        };
      }

      const hrId = emp?.id || nextLine?.employeeId || decoded;
      const attDir = await loadAttendanceDirectory().catch(() => null);
      if (cancelled) return;
      setRun(nextRun);
      setLine(nextLine);
      setName(emp?.label.split(" · ")[0] || nextLine?.employeeName || decoded);
      setHrEmployeeId(hrId);
      setDirectory(attDir);
    })().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [runId, employeeId, isPreview, searchParams, reloadAt]);

  const att = !isPreview && line
    ? getPayrollRunAttendance(runId).find(
        (a) =>
          a.employeeId === line.employeeId ||
          a.employeeCode === line.employeeCode ||
          a.employeeId === decodeURIComponent(employeeId),
      )
    : undefined;

  const split = splitPresentAndHalf(
    att?.presentDays ?? line?.presentDays ?? 0,
    att?.halfDays ?? line?.halfDays ?? 0,
  );
  const absentDays = att?.absentDays ?? line?.absentDays ?? 0;
  const weeklyOff = att?.weeklyOff ?? line?.weeklyOff ?? 0;
  const payable = line?.payableDays ?? 0;
  const working = line?.periodDays || line?.workingDaysInCycle || 30;

  const factor = line?.attendanceFactor || (working ? payable / working : 1);
  const locked = run ? isMonthLocked(run.month) || run.status === "locked" : false;

  return (
    <div className="space-y-5">
      <PageHeader
        title={name || "Employee payroll"}
        backHref={
          isPreview
            ? `/hr/payroll/runs/new`
            : `/hr/payroll/runs/${runId}`
        }
        backLabel={run?.cycleLabel || (isPreview ? "run payroll" : "run")}
        actions={
          hrEmployeeId ? (
            <Link
              href={`/hr/time?tab=leave-adjust&employeeId=${encodeURIComponent(hrEmployeeId)}`}
              className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-[min(var(--radius-md),12px)] border border-border bg-background px-2.5 text-[0.8rem] font-medium transition-colors duration-200 hover:bg-muted"
            >
              <Scale className="size-3.5" />
              Leave adjust
            </Link>
          ) : null
        }
      />
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !line ? (
        <HrEmptyState title="Employee not found on this run" />
      ) : (
        <>
          {run?.cycleStart && run.cycleEnd && hrEmployeeId ? (
            <div className="w-full rounded-xl border border-border/70 bg-card p-3">
              <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Leave adjust
              </h3>
              <LeaveAdjustPanel
                directory={directory}
                initialEmployeeId={hrEmployeeId}
                payrollRunId={isPreview ? undefined : run.id}
                source={isPreview ? "attendance_tab" : "payroll_run"}
                locked={locked}
                periodStart={run.cycleStart}
                periodEnd={run.cycleEnd}
                hideEmployee
                onChanged={() => setReloadAt((n) => n + 1)}
                selectedDate={selectedDay}
                onSelectedDateChange={setSelectedDay}
                attendanceSummary={{
                  present: split.present,
                  halfDay: split.half,
                  absent: absentDays,
                  weekOff: weeklyOff,
                  payable,
                }}
              />
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <PayTable
              title="Earnings"
              rows={line.earnings}
              totalLabel="Gross"
              total={line.gross}
              factor={factor}
            />
            <PayTable
              title="Deductions"
              rows={line.deductionItems}
              totalLabel="Total deductions"
              total={line.deductionTotal}
              factor={factor}
            />
          </div>
          <div className="rounded-xl border border-border/70 bg-card px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Net pay
            </p>
            <p className="mt-1 text-lg font-medium tabular-nums">{formatInr(line.net)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Prorated at {payable}/{working || 30} payable days (fixed 30-day salary basis)
              {factor && factor !== 1 ? ` (${Math.round(factor * 1000) / 10}% of monthly CTC ${formatInr(line.monthlyCtc)})` : ""}.
            </p>
          </div>
        </>
      )}
    </div>
  );
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
