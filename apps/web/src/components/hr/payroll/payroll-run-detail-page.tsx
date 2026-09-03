"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Lock, Unlock } from "lucide-react";

import { HrEmptyState, HrStatusBadge } from "@/components/hr/hr-primitives";
import { SetupConfirmDialog } from "@/components/hr/setup/setup-confirm";
import { SetupToastHost, toast } from "@/components/hr/setup/setup-toast";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { formatInr } from "@/services/payroll-service";
import { splitPresentAndHalf } from "@/lib/payroll-attendance-cycle";
import {
  generatePayslips,
  getPayrollRun,
  isMonthLocked,
  listPayrollRunEmployeeLines,
  loadPayrollDirectory,
  lockPayrollMonth,
  unlockPayrollMonth,
} from "@/services/payroll-management-service";
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

export function PayrollRunDetailPage({ runId }: { runId: string }) {
  const router = useRouter();
  const [run, setRun] = useState<PayrollRun | null>(null);
  const [lines, setLines] = useState<PayrollRunEmployeeLine[]>([]);
  const [employees, setEmployees] = useState<HrMasterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [lockAction, setLockAction] = useState<"lock" | "unlock" | null>(null);
  const [locking, setLocking] = useState(false);

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

  const locked = run ? isMonthLocked(run.month) || run.status === "locked" : false;

  return (
    <div className="space-y-5">
      <SetupToastHost />
      <PageHeader
        title={run?.cycleLabel || run?.monthLabel || "Payroll run"}
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
                onClick={() => {
                  void generatePayslips(run.id)
                    .then((slips) => {
                      toast(`${slips.length} payslips generated`);
                      void refresh();
                    })
                    .catch((e) => toast(e instanceof Error ? e.message : "Failed", "error"));
                }}
              >
                <FileText className="size-3.5" />
                Payslips
              </Button>
            </div>
          ) : null
        }
      />
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading employees…</p>
      ) : !run ? (
        <HrEmptyState title="Payroll run not found" />
      ) : lines.length === 0 ? (
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
