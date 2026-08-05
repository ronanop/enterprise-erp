"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { SetupDrawer, SetupField, SetupInput, SetupSelect, SetupTextarea } from "@/components/hr/setup/setup-drawer";
import { toast } from "@/components/hr/setup/setup-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  applyLeaveMonthAdjustment,
  createEmployeeLeaveBalance,
  removeEmployeeLeaveBalance,
  type LeaveDirectory,
} from "@/services/leave-management-service";
import type { LeaveBalanceRecord, LeaveTypeRecord } from "@/types/leave-management";

type EmployeeRow = {
  id: string;
  name: string;
  code: string;
  branchId: string;
};

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function LeaveBalancePanel({
  directory,
  onSaved,
}: {
  directory: LeaveDirectory;
  onSaved?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [selected, setSelected] = useState<EmployeeRow | null>(null);

  const leaveTypes = useMemo(
    () =>
      directory.leaveTypes
        .filter((t) => t.status === "active")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [directory.leaveTypes],
  );

  const balanceByEmpType = useMemo(() => {
    const map = new Map<string, LeaveBalanceRecord>();
    const year = new Date().getFullYear();
    for (const b of directory.balances) {
      if (b.balanceYear !== year) continue;
      map.set(`${b.employeeId}:${b.leaveTypeId}`, b);
    }
    return map;
  }, [directory.balances]);

  const employees = useMemo(() => {
    const map = new Map<string, EmployeeRow>();
    for (const e of directory.options.employees) {
      map.set(e.id, {
        id: e.id,
        name: e.label.split(" · ")[0] || e.label,
        code: e.code,
        branchId: e.branchId,
      });
    }
    for (const b of directory.balances) {
      if (!map.has(b.employeeId)) {
        map.set(b.employeeId, {
          id: b.employeeId,
          name: b.employeeName,
          code: b.employeeCode,
          branchId: b.branchId,
        });
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [directory]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees.filter((e) => {
      if (employeeId && e.id !== employeeId) return false;
      if (!q) return true;
      return `${e.name} ${e.code}`.toLowerCase().includes(q);
    });
  }, [employees, employeeId, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border/70 bg-card p-3 shadow-sm">
        <div className="min-w-[12rem] flex-1 space-y-1">
          <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Employee
          </label>
          <SetupSelect value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="w-full">
            <option value="">All employees</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} ({e.code})
              </option>
            ))}
          </SetupSelect>
        </div>
        <div className="min-w-[14rem] flex-[2] space-y-1">
          <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Search
          </label>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, ID…"
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="cursor-pointer"
          onClick={() => {
            setEmployeeId("");
            setQuery("");
          }}
        >
          Clear
        </Button>
        <p className="w-full text-[11px] text-muted-foreground">
          Click a row to adjust monthly leave, add a leave type, or remove an assignment. Balances are for{" "}
          {new Date().getFullYear()}.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/70 bg-card shadow-sm">
        <table className="w-full min-w-[720px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-border/70 bg-muted/40">
              <th className="sticky left-0 z-10 bg-muted/95 px-3 py-2 font-medium">Employee</th>
              <th className="px-2 py-2 font-medium">Code</th>
              {leaveTypes.map((t) => (
                <th key={t.id} className="px-2 py-2 font-medium whitespace-nowrap">
                  <span className="inline-flex items-center gap-1">
                    <span className="size-2 rounded-full" style={{ backgroundColor: t.color }} />
                    {t.code}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((emp) => (
              <tr
                key={emp.id}
                className={cn(
                  "cursor-pointer border-b border-border/50 transition-colors duration-200 hover:bg-muted/30",
                  selected?.id === emp.id && "bg-primary/5",
                )}
                onClick={() => setSelected(emp)}
              >
                <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium">{emp.name}</td>
                <td className="px-2 py-2 font-mono text-muted-foreground">{emp.code}</td>
                {leaveTypes.map((t) => {
                  const bal = balanceByEmpType.get(`${emp.id}:${t.id}`);
                  return (
                    <td key={t.id} className="px-2 py-2 text-center tabular-nums">
                      {bal ? (
                        <span title={`Avail ${bal.available} · Used ${bal.used} · Pending ${bal.pending}`}>
                          {bal.available}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length ? (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">No employees match filters.</p>
        ) : null}
      </div>

      <EmployeeLeaveBalanceDrawer
        open={!!selected}
        employee={selected}
        directory={directory}
        leaveTypes={leaveTypes}
        balances={selected ? directory.balances.filter((b) => b.employeeId === selected.id) : []}
        onClose={() => setSelected(null)}
        onSaved={() => {
          onSaved?.();
        }}
      />
    </div>
  );
}

function EmployeeLeaveBalanceDrawer({
  open,
  employee,
  directory,
  leaveTypes,
  balances,
  onClose,
  onSaved,
}: {
  open: boolean;
  employee: EmployeeRow | null;
  directory: LeaveDirectory;
  leaveTypes: LeaveTypeRecord[];
  balances: LeaveBalanceRecord[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const year = new Date().getFullYear();
  const yearBalances = balances.filter((b) => b.balanceYear === year);

  const [adjustTypeId, setAdjustTypeId] = useState("");
  const [adjustMonth, setAdjustMonth] = useState(currentYearMonth());
  const [adjustDays, setAdjustDays] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [addTypeId, setAddTypeId] = useState("");
  const [addDays, setAddDays] = useState("");
  const [busy, setBusy] = useState(false);

  const assignedTypeIds = new Set(yearBalances.map((b) => b.leaveTypeId));
  const unassignedTypes = leaveTypes.filter((t) => !assignedTypeIds.has(t.id));

  const branchId =
    employee?.branchId ||
    yearBalances[0]?.branchId ||
    directory.options.employees.find((e) => e.id === employee?.id)?.branchId ||
    directory.options.branches[0]?.id ||
    "";

  async function run(action: () => Promise<void>, okMsg: string) {
    setBusy(true);
    try {
      await action();
      toast(okMsg, "success");
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Action failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SetupDrawer
      open={open}
      onClose={onClose}
      wide
      title={employee ? `Leave balances — ${employee.name}` : "Leave balances"}
      description="Adjust days by month, assign a new leave type, or remove an unused assignment."
      footer={
        <Button type="button" variant="outline" className="cursor-pointer" onClick={onClose}>
          Close
        </Button>
      }
    >
      {!employee ? null : (
        <div className="space-y-6">
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Assigned leave types ({year})
            </h3>
            {!yearBalances.length ? (
              <p className="text-xs text-muted-foreground">No leave types assigned for this year.</p>
            ) : (
              <ul className="space-y-2">
                {yearBalances.map((b) => (
                  <li
                    key={b.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{b.leaveTypeName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Alloc {b.allocated} · Used {b.used} · Pending {b.pending} · Avail {b.available}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="cursor-pointer text-destructive hover:text-destructive"
                      disabled={busy || b.used > 0}
                      title={b.used > 0 ? "Cannot remove while used balance &gt; 0" : "Remove leave type"}
                      onClick={() => {
                        if (!window.confirm(`Remove ${b.leaveTypeName} from this employee?`)) return;
                        void run(() => removeEmployeeLeaveBalance(b.id), "Leave type removed");
                      }}
                    >
                      <Trash2 className="size-3.5" />
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Monthly adjustment
            </h3>
            <p className="text-[10px] text-muted-foreground">
              Positive days credit the month; negative days debit. Cannot target a future month.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <SetupField label="Leave type" required>
                <SetupSelect value={adjustTypeId} onChange={(e) => setAdjustTypeId(e.target.value)}>
                  <option value="">Select…</option>
                  {yearBalances.map((b) => (
                    <option key={b.leaveTypeId} value={b.leaveTypeId}>
                      {b.leaveTypeName}
                    </option>
                  ))}
                </SetupSelect>
              </SetupField>
              <SetupField label="Month" required>
                <SetupInput type="month" value={adjustMonth} onChange={(e) => setAdjustMonth(e.target.value)} />
              </SetupField>
              <SetupField label="Days (+ / −)" required>
                <SetupInput
                  inputMode="decimal"
                  placeholder="e.g. 1.5 or -0.5"
                  value={adjustDays}
                  onChange={(e) => setAdjustDays(e.target.value)}
                />
              </SetupField>
              <SetupField label="Reason">
                <SetupTextarea rows={2} value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} />
              </SetupField>
            </div>
            <Button
              type="button"
              size="sm"
              className="cursor-pointer"
              disabled={busy || !adjustTypeId || !adjustDays || !branchId}
              onClick={() => {
                const daysDelta = Number(adjustDays);
                if (!Number.isFinite(daysDelta) || daysDelta === 0) {
                  toast("Enter a non-zero days value", "error");
                  return;
                }
                void run(
                  () =>
                    applyLeaveMonthAdjustment({
                      branchId,
                      employeeId: employee.id,
                      leaveTypeId: adjustTypeId,
                      month: adjustMonth,
                      daysDelta,
                      reason: adjustReason.trim() || undefined,
                    }),
                  "Monthly adjustment applied",
                );
              }}
            >
              Apply adjustment
            </Button>
          </section>

          <section className="space-y-3 rounded-lg border border-dashed border-border/70 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Add leave type
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <SetupField label="Leave type" required>
                <SetupSelect value={addTypeId} onChange={(e) => setAddTypeId(e.target.value)}>
                  <option value="">Select…</option>
                  {unassignedTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.code})
                    </option>
                  ))}
                </SetupSelect>
              </SetupField>
              <SetupField label={`Opening / credit days (${year})`}>
                <SetupInput
                  inputMode="decimal"
                  placeholder="e.g. monthly credit"
                  value={addDays}
                  onChange={(e) => setAddDays(e.target.value)}
                />
              </SetupField>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="cursor-pointer"
              disabled={busy || !addTypeId || !branchId}
              onClick={() => {
                const days = Number(addDays || 0);
                if (!Number.isFinite(days) || days < 0) {
                  toast("Enter valid days", "error");
                  return;
                }
                void run(
                  () =>
                    createEmployeeLeaveBalance({
                      branchId,
                      employeeId: employee.id,
                      leaveTypeId: addTypeId,
                      balanceYear: year,
                      accruedDays: days,
                    }),
                  "Leave type added",
                );
              }}
            >
              <Plus className="size-3.5" />
              Add for employee
            </Button>
            {!unassignedTypes.length ? (
              <p className="text-[10px] text-muted-foreground">All active leave types are already assigned.</p>
            ) : null}
          </section>
        </div>
      )}
    </SetupDrawer>
  );
}
