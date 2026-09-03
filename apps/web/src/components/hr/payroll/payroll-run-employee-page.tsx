"use client";

import { useEffect, useState } from "react";

import { HrEmptyState, HrStatusBadge } from "@/components/hr/hr-primitives";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";
import { splitPresentAndHalf } from "@/lib/payroll-attendance-cycle";
import { isPfDeductionLabel } from "@/lib/payroll-cycle";
import { formatInr } from "@/services/payroll-service";
import { loadAttendanceForEmployee } from "@/services/attendance-management-service";
import {
  getPayrollRun,
  getPayrollRunAttendance,
  getPayrollRunEmployeeLine,
  loadPayrollDirectory,
} from "@/services/payroll-management-service";
import { loadHrMasterDirectory } from "@/services/hr-master-connector";
import type { AttendanceRecord } from "@/types/attendance-management";
import type { PayrollRun, PayrollRunEmployeeLine } from "@/types/payroll-management";

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

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function PayrollRunEmployeePage({
  runId,
  employeeId,
}: {
  runId: string;
  employeeId: string;
}) {
  const [run, setRun] = useState<PayrollRun | null>(null);
  const [line, setLine] = useState<PayrollRunEmployeeLine | null>(null);
  const [name, setName] = useState("");
  const [days, setDays] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      await loadPayrollDirectory();
      const nextRun = getPayrollRun(runId);
      const decoded = decodeURIComponent(employeeId);
      const nextLine = getPayrollRunEmployeeLine(runId, decoded);
      const master = await loadHrMasterDirectory().catch(() => null);
      const emp = master?.employees.find((e) => e.id === decoded || e.code === decoded);
      const hrId = emp?.id || nextLine?.employeeId || decoded;
      const attRows = await loadAttendanceForEmployee(hrId).catch(() => []);
      const start = nextRun?.cycleStart ?? "";
      const end = nextRun?.cycleEnd ?? "";
      const inCycle = attRows
        .filter((r) => (!start || r.attendanceDate >= start) && (!end || r.attendanceDate <= end))
        .sort((a, b) => a.attendanceDate.localeCompare(b.attendanceDate));
      if (cancelled) return;
      setRun(nextRun);
      setLine(nextLine);
      setName(emp?.label.split(" · ")[0] || nextLine?.employeeName || decoded);
      setDays(inCycle);
    })().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [runId, employeeId]);

  const att = line
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
  const leaveDays = att?.leaveDays ?? line?.leaveDays ?? 0;
  const absentDays = att?.absentDays ?? line?.absentDays ?? 0;
  const holidays = att?.holidays ?? line?.holidays ?? 0;
  const weeklyOff = att?.weeklyOff ?? line?.weeklyOff ?? 0;
  const lopDays = att?.lopDays ?? line?.lopDays ?? absentDays + (split.half ? split.half * 0.5 : 0);
  const payable = line?.payableDays ?? 0;
  const working = line?.periodDays || line?.workingDaysInCycle || 30;
  const unmarked = Math.max(
    0,
    Math.round((working - split.present - split.half - leaveDays - absentDays - holidays - weeklyOff) * 10) / 10,
  );

  const factor = line?.attendanceFactor || (working ? payable / working : 1);

  return (
    <div className="space-y-5">
      <PageHeader
        title={name || "Employee payroll"}
        backHref={`/hr/payroll/runs/${runId}`}
        backLabel={run?.cycleLabel || "run"}
      />
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !line ? (
        <HrEmptyState title="Employee not found on this run" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            <Stat label="Present" value={String(split.present)} tone="bg-hrms-mint" />
            <Stat label="Half day" value={String(split.half)} tone="bg-hrms-peach" />
            <Stat label="Leave" value={String(leaveDays)} />
            <Stat label="Week off" value={String(weeklyOff)} />
            <Stat label="Holiday" value={String(holidays)} />
            <Stat label="Absent" value={String(absentDays)} tone="bg-hrms-pink" />
            <Stat label="LOP" value={String(lopDays)} tone="bg-hrms-pink" />
            <Stat label="Payable" value={`${payable}/${working || 30}`} />
          </div>

          <p className="text-xs text-muted-foreground">
            Payable days = 30 − LOP ({lopDays}) = {payable} / {working || 30}. Weekly offs and holidays are payable
            unless sandwich policy converts them. Present ({split.present}) is attendance, not the salary numerator.
            {unmarked > 0 ? ` ${unmarked} day(s) in the 20th–19th cycle have no attendance mark.` : ""}
          </p>

          <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
            <div className="border-b border-border/60 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Daily attendance · {run?.cycleLabel || "cycle"}
            </div>
            {days.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">No attendance rows in this cycle.</p>
            ) : (
              <div className="erp-scroll max-h-[22rem] overflow-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="sticky top-0 z-10 border-b border-border/70 bg-muted/90 backdrop-blur-sm">
                    <tr>
                      {["Date", "Status", "Check in", "Check out", "Hours", "Paid"].map((h) => (
                        <th
                          key={h}
                          className="px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {days.map((row) => {
                      const paid =
                        row.status === "half_day"
                          ? 0.5
                          : row.status === "absent"
                            ? 0
                            : 1;
                      return (
                        <tr key={row.id} className="border-b border-border/40 hover:bg-muted/25">
                          <td className="px-3 py-2 text-xs whitespace-nowrap">{formatDate(row.attendanceDate)}</td>
                          <td className="px-3 py-2">
                            <HrStatusBadge status={row.status.replace(/_/g, " ")} />
                          </td>
                          <td className="px-3 py-2 text-xs whitespace-nowrap">{formatTime12(row.checkIn)}</td>
                          <td className="px-3 py-2 text-xs whitespace-nowrap">{formatTime12(row.checkOut)}</td>
                          <td className="px-3 py-2 text-xs tabular-nums">{row.workingHours || "—"}</td>
                          <td className="px-3 py-2 text-xs tabular-nums">{paid}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

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

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-border/70 bg-card px-3 py-2", tone)}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium tabular-nums">{value}</p>
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
