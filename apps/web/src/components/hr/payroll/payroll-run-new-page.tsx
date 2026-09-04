"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";

import { HrEmptyState } from "@/components/hr/hr-primitives";
import { SetupField, SetupSelect } from "@/components/hr/setup/setup-drawer";
import { SetupToastHost, toast } from "@/components/hr/setup/setup-toast";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildPayrollCycle, readPayrollCutoverDay, writePayrollCutoverDay } from "@/lib/payroll-cycle";
import { splitPresentAndHalf } from "@/lib/payroll-attendance-cycle";
import { formatInr } from "@/services/payroll-service";
import {
  isMonthLocked,
  previewPayrollRunEmployees,
  runPayroll,
} from "@/services/payroll-management-service";
import { monthLabel, type PayrollRunEmployeeLine } from "@/types/payroll-management";

const LIST_HREF = "/hr/payroll?section=run-payroll";

function monthOptions(count = 12) {
  const now = new Date();
  return Array.from({ length: count }).map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return { value: ym, label: monthLabel(ym) };
  });
}

export function PayrollRunNewPage() {
  const router = useRouter();
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [month, setMonth] = useState(defaultMonth);
  const [cutoverDay, setCutoverDay] = useState(() => readPayrollCutoverDay());
  const [lines, setLines] = useState<PayrollRunEmployeeLine[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [locked, setLocked] = useState(false);
  const options = useMemo(() => monthOptions(), []);

  const cycle = useMemo(() => buildPayrollCycle(month, cutoverDay), [month, cutoverDay]);
  const payableCount = useMemo(() => lines.filter((l) => l.monthlyCtc > 0).length, [lines]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return lines;
    return lines.filter((l) =>
      [l.employeeName, l.employeeCode, l.employeeId, l.department].join(" ").toLowerCase().includes(q),
    );
  }, [lines, search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLocked(isMonthLocked(month));
    void previewPayrollRunEmployees(month, cutoverDay)
      .then(({ lines: next }) => {
        if (!cancelled) setLines(next);
      })
      .catch(() => {
        if (!cancelled) setLines([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [month, cutoverDay]);

  return (
    <div className="space-y-5">
      <SetupToastHost />
      <PageHeader
        title="Run payroll"
        backHref={LIST_HREF}
        backLabel="payroll runs"
        actions={
          <Button
            size="sm"
            className="cursor-pointer transition-colors duration-200"
            disabled={loading || running || locked || payableCount === 0}
            onClick={() => {
              setRunning(true);
              void runPayroll(month, cutoverDay)
                .then((run) => {
                  toast(`Payroll generated for ${cycle.label}`);
                  router.push(`/hr/payroll/runs/${run.id}`);
                })
                .catch((e) => toast(e instanceof Error ? e.message : "Failed", "error"))
                .finally(() => setRunning(false));
            }}
          >
            {running ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {running ? "Generating…" : locked ? "Month locked" : "Run payroll"}
          </Button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <SetupField label="Month">
          <SetupSelect value={month} onChange={(e) => setMonth(e.target.value)}>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SetupSelect>
        </SetupField>
        <SetupField label="Cutover day">
          <SetupSelect
            value={String(cutoverDay)}
            onChange={(e) => {
              const day = Number(e.target.value);
              setCutoverDay(day);
              writePayrollCutoverDay(day);
            }}
          >
            {Array.from({ length: 28 }).map((_, i) => {
              const day = i + 1;
              return (
                <option key={day} value={day}>
                  {day}
                </option>
              );
            })}
          </SetupSelect>
        </SetupField>
        <SetupField label="Pay cycle">
          <p className="flex h-8 items-center text-sm tabular-nums">{cycle.label}</p>
        </SetupField>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search employee name or code…"
          className="h-9 pl-8"
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading employees…</p>
      ) : lines.length === 0 ? (
        <HrEmptyState
          title="No employees"
          description="Add employees in Workforce. Assign salary before generating a payroll run."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/70">
          <div className="border-b border-border/60 px-3 py-2 text-xs text-muted-foreground">
            {visible.length} employee{visible.length === 1 ? "" : "s"}
            {payableCount ? ` · ${payableCount} with assigned salary` : " · assign salary to enable Run payroll"}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="border-b bg-muted/40 text-[11px] uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Present</th>
                  <th className="px-3 py-2 font-medium">Leave</th>
                  <th className="px-3 py-2 font-medium">WO</th>
                  <th className="px-3 py-2 font-medium">LOP</th>
                  <th className="px-3 py-2 font-medium">Payable</th>
                  <th className="px-3 py-2 font-medium">Salary</th>
                  <th className="px-3 py-2 font-medium">Net</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((l) => {
                  const att = splitPresentAndHalf(l.presentDays, l.halfDays);
                  return (
                <tr key={l.employeeId} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <p className="font-medium">{l.employeeName}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {l.employeeCode || ""}
                        {l.department && l.department !== "—" ? `${l.employeeCode ? " · " : ""}${l.department}` : ""}
                      </p>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{att.present}</td>
                    <td className="px-3 py-2 tabular-nums">{l.leaveDays}</td>
                    <td className="px-3 py-2 tabular-nums">{l.weeklyOff ?? 0}</td>
                    <td className="px-3 py-2 tabular-nums">{l.lopDays ?? l.absentDays}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {l.payableDays}/{l.periodDays || l.workingDaysInCycle || 30}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {l.monthlyCtc > 0 ? formatInr(l.monthlyCtc) : "—"}
                    </td>
                    <td className="px-3 py-2 tabular-nums font-medium">
                      {l.monthlyCtc > 0 ? formatInr(l.net) : "—"}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
