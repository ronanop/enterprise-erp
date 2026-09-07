"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Lock, Scale, Unlock, Users } from "lucide-react";

import { LeaveAdjustPanel } from "@/components/hr/attendance/leave-adjust-panel";
import { HrEmptyState, HrStatusBadge, HrUnderlineTabs, type HrTabItem } from "@/components/hr/hr-primitives";
import { SetupConfirmDialog } from "@/components/hr/setup/setup-confirm";
import { SetupToastHost, toast } from "@/components/hr/setup/setup-toast";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { formatInr } from "@/services/payroll-service";
import { splitPresentAndHalf } from "@/lib/payroll-attendance-cycle";
import {
  getPayrollRun,
  isMonthLocked,
  listPayrollRunEmployeeLines,
  loadPayrollDirectory,
  lockPayrollMonth,
  unlockPayrollMonth,
} from "@/services/payroll-management-service";
import {
  loadAttendanceDirectory,
  type AttendanceDirectory,
} from "@/services/attendance-management-service";
import { loadHrMasterDirectory, type HrMasterOption } from "@/services/hr-master-connector";
import {
  RUN_STATUS_LABELS,
  type PayrollRun,
  type PayrollRunEmployeeLine,
} from "@/types/payroll-management";

const LIST_HREF = "/hr/payroll?section=run-payroll";

function employeeLabel(line: PayrollRunEmployeeLine, employees: HrMasterOption[]) {
  const emp = employees.find((e) => e.id === line.employeeId || e.code === line.employeeId);
  return emp?.label.split(" · ")[0] || line.employeeName;
}

function resolveEmployeeId(
  line: PayrollRunEmployeeLine,
  directory: AttendanceDirectory | null,
  employees: HrMasterOption[],
): string {
  const fromAtt = directory?.options.employees.find(
    (e) => e.id === line.employeeId || e.code === line.employeeCode || e.code === line.employeeId,
  );
  if (fromAtt?.id) return fromAtt.id;
  const fromMaster = employees.find(
    (e) => e.id === line.employeeId || e.code === line.employeeId || e.code === line.employeeCode,
  );
  return fromMaster?.id || line.employeeId;
}

export function PayrollRunDetailPage({ runId }: { runId: string }) {
  const router = useRouter();
  const [run, setRun] = useState<PayrollRun | null>(null);
  const [lines, setLines] = useState<PayrollRunEmployeeLine[]>([]);
  const [employees, setEmployees] = useState<HrMasterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [lockAction, setLockAction] = useState<"lock" | "unlock" | null>(null);
  const [locking, setLocking] = useState(false);
  const [view, setView] = useState<"employees" | "leave-adjust">("employees");
  const [directory, setDirectory] = useState<AttendanceDirectory | null>(null);
  const [adjustEmployeeId, setAdjustEmployeeId] = useState("");

  const refresh = useCallback(async () => {
    const local = getPayrollRun(runId);
    if (local) {
      setRun(local);
      setLines(listPayrollRunEmployeeLines(local.id));
      setLoading(false);
    } else {
      setLoading(true);
    }
    try {
      await loadPayrollDirectory();
      const next = getPayrollRun(runId) ?? local;
      setRun(next);
      setLines(next ? listPayrollRunEmployeeLines(next.id) : []);
      const master = await loadHrMasterDirectory().catch(() => null);
      setEmployees(master?.employees ?? []);
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void loadAttendanceDirectory()
      .then(setDirectory)
      .catch(() => setDirectory(null));
  }, []);

  const locked = run ? isMonthLocked(run.month) || run.status === "locked" : false;
  const lopLines = useMemo(
    () => lines.filter((l) => (l.lopDays ?? l.absentDays ?? 0) > 0),
    [lines],
  );

  return (
    <div className="space-y-5">
      <SetupToastHost />
      <PageHeader
        title={run ? monthLabel(run.month) : "Payroll run"}
        description={run?.cycleLabel && run.cycleLabel !== monthLabel(run.month) ? run.cycleLabel : undefined}
        backHref={LIST_HREF}
        backLabel="payroll runs"
        actions={
          run ? (
            <div className="flex flex-wrap items-center gap-2">
              <HrStatusBadge status={RUN_STATUS_LABELS[run.status] ?? run.status} />
              <Button
                size="sm"
                variant="outline"
                className="cursor-pointer transition-colors duration-200"
                onClick={() => setLockAction(locked ? "unlock" : "lock")}
              >
                {locked ? <Unlock className="size-3.5" /> : <Lock className="size-3.5" />}
                {locked ? "Unlock" : "Lock"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="cursor-pointer transition-colors duration-200"
                onClick={() =>
                  router.push(
                    `/hr/payroll?section=payslip&generate=1&month=${encodeURIComponent(run.month.slice(0, 7))}`,
                  )
                }
              >
                <FileText className="size-3.5" />
                Generate slip
              </Button>
            </div>
          ) : null
        }
      />
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading employees…</p>
      ) : !run ? (
        <HrEmptyState title="Payroll run not found" />
      ) : (
        <>
          <HrUnderlineTabs
            tabs={
              [
                { id: "employees", label: "Employees", icon: Users },
                { id: "leave-adjust", label: "Leave adjust", icon: Scale },
              ] satisfies HrTabItem[]
            }
            value={view}
            onChange={(id) => setView(id as typeof view)}
          />
          {view === "employees" ? (
            lines.length === 0 ? (
              <HrEmptyState title="No employees on this run" />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border/70">
                <table className="w-full min-w-[860px] text-left text-sm">
                  <thead className="border-b bg-muted/40 text-[11px] uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Name</th>
                      <th className="px-3 py-2 font-medium">Present</th>
                      <th className="px-3 py-2 font-medium">Leave</th>
                      <th className="px-3 py-2 font-medium">WO</th>
                      <th className="px-3 py-2 font-medium">LOP</th>
                      <th className="px-3 py-2 font-medium">Payable</th>
                      <th className="px-3 py-2 font-medium">Gross</th>
                      <th className="px-3 py-2 font-medium">Deductions</th>
                      <th className="px-3 py-2 font-medium">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => {
                      const name = employeeLabel(l, employees);
                      const att = splitPresentAndHalf(l.presentDays, l.halfDays);
                      return (
                        <tr
                          key={l.employeeId}
                          className="cursor-pointer border-b border-border/50 transition-colors duration-200 hover:bg-muted/30"
                          onClick={() =>
                            router.push(
                              `/hr/payroll/runs/${run.id}/employees/${encodeURIComponent(l.employeeId)}`,
                            )
                          }
                        >
                          <td className="px-3 py-2 font-medium">{name}</td>
                          <td className="px-3 py-2 tabular-nums">{att.present}</td>
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
            )
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                {lopLines.length} employee{lopLines.length === 1 ? "" : "s"} with LOP. Leave is taken when the
                employee applies. Auto-adjust is off.
              </p>
              {lopLines.length === 0 ? (
                <HrEmptyState title="No unadjusted LOP" description="No employees on this run have LOP days." />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border/70">
                  <table className="w-full min-w-[480px] text-left text-sm">
                    <thead className="border-b bg-muted/40 text-[11px] uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Name</th>
                        <th className="px-3 py-2 font-medium">LOP</th>
                        <th className="px-3 py-2 font-medium">Leave</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lopLines.map((l) => {
                        const empId = resolveEmployeeId(l, directory, employees);
                        const active = adjustEmployeeId === empId;
                        return (
                          <tr
                            key={l.employeeId}
                            className={`cursor-pointer border-b border-border/50 transition-colors duration-200 hover:bg-muted/30 ${active ? "bg-muted/40" : ""}`}
                            onClick={() => setAdjustEmployeeId(empId)}
                          >
                            <td className="px-3 py-2 font-medium">{employeeLabel(l, employees)}</td>
                            <td className="px-3 py-2 tabular-nums">{l.lopDays ?? l.absentDays}</td>
                            <td className="px-3 py-2 tabular-nums">{l.leaveDays}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {adjustEmployeeId ? (
                <LeaveAdjustPanel
                  directory={directory}
                  initialEmployeeId={adjustEmployeeId}
                  payrollRunId={run.id}
                  source="payroll_run"
                  locked={locked}
                  periodStart={run.cycleStart}
                  periodEnd={run.cycleEnd}
                />
              ) : (
                <p className="text-xs text-muted-foreground">Select an employee to review present vs not present.</p>
              )}
            </div>
          )}
        </>
      )}
      <SetupConfirmDialog
        open={Boolean(lockAction)}
        title={lockAction === "unlock" ? "Unlock month" : "Lock month"}
        message={
          run
            ? lockAction === "unlock"
              ? `Unlock ${run.monthLabel}?`
              : `Lock ${run.monthLabel}?`
            : ""
        }
        confirmLabel={lockAction === "unlock" ? "Unlock" : "Lock"}
        loading={locking}
        onCancel={() => setLockAction(null)}
        onConfirm={() => {
          if (!run || !lockAction) return;
          setLocking(true);
          try {
            if (lockAction === "lock") {
              lockPayrollMonth(run.month, "Locked from payroll run");
              toast("Month locked");
            } else {
              unlockPayrollMonth(run.month, "Unlocked from payroll run");
              toast("Month unlocked");
            }
            setLockAction(null);
            void refresh();
          } catch (e) {
            toast(e instanceof Error ? e.message : "Failed", "error");
          } finally {
            setLocking(false);
          }
        }}
      />
    </div>
  );
}
