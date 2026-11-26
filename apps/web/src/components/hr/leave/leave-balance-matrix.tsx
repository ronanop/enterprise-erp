"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Wand2 } from "lucide-react";

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
import { DEFAULT_LEAVE_COLORS, isCompOffLeaveType } from "@/types/leave-management";
import { formatApiError } from "@/services/api-client";

type EmployeeRow = {
  id: string;
  name: string;
  code: string;
  branchId: string;
  companyName: string;
  lifecycleStatus?: string;
};

/** Leave balances: activated employees only. */
function isLeaveBalanceEligible(status: string | undefined): boolean {
  return String(status || "").trim().toLowerCase() === "active";
}

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Leave FY starts 1 Mar (matches API leave_financial_year). */
function currentLeaveBalanceYear(d = new Date()): number {
  return d.getMonth() >= 2 ? d.getFullYear() : d.getFullYear() - 1;
}

function isActiveLeaveType(t: LeaveTypeRecord): boolean {
  return String(t.status || "active").trim().toLowerCase() === "active";
}

type PolicyCredit = {
  mode: "monthly" | "yearly" | "none";
  days: number;
  label: string;
};

/** Prefer monthly credit from leave type policy; else yearly entitlement. */
export function leaveTypePolicyCredit(t: LeaveTypeRecord): PolicyCredit {
  if (Number(t.daysPerMonth) > 0) {
    return {
      mode: "monthly",
      days: Number(t.daysPerMonth),
      label: `${Number(t.daysPerMonth)} day(s) / month`,
    };
  }
  if (Number(t.maxDays) > 0) {
    return {
      mode: "yearly",
      days: Number(t.maxDays),
      label: `${Number(t.maxDays)} day(s) / year`,
    };
  }
  return { mode: "none", days: 0, label: "No credit in leave policy" };
}

/** Completed calendar months in leave FY up to (not including) current month. */
function completedMonthsInLeaveFy(fyStartYear: number, ref = new Date()): number {
  const fyStart = new Date(fyStartYear, 2, 1);
  const lastCompleted = new Date(ref.getFullYear(), ref.getMonth(), 0);
  if (lastCompleted < fyStart) return 0;
  let count = 0;
  let y = fyStartYear;
  let m = 2;
  for (let i = 0; i < 12; i += 1) {
    const monthEnd = new Date(y, m + 1, 0);
    if (monthEnd > lastCompleted) break;
    if (y === fyStartYear + 1 && m > 1) break;
    count += 1;
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return count;
}

function defaultAssignAmounts(
  t: LeaveTypeRecord,
  fyYear: number,
): { openingBalance: number; accruedDays: number; hint: string } {
  const policy = leaveTypePolicyCredit(t);
  if (policy.mode === "monthly") {
    const months = completedMonthsInLeaveFy(fyYear);
    const accrued = Number((policy.days * months).toFixed(2));
    return {
      openingBalance: 0,
      accruedDays: accrued,
      hint: `Policy ${policy.label} × ${months} completed month(s) = ${accrued}`,
    };
  }
  if (policy.mode === "yearly") {
    return {
      openingBalance: policy.days,
      accruedDays: 0,
      hint: `Policy yearly credit ${policy.days} day(s)`,
    };
  }
  return { openingBalance: 0, accruedDays: 0, hint: "No policy credit — set days manually" };
}

export function LeaveBalancePanel({
  directory,
  onSaved,
}: {
  directory: LeaveDirectory;
  onSaved?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<EmployeeRow | null>(null);

  /** One column per leave code (multi-company setups can have 4× "Comp Off"). */
  const leaveTypes = useMemo(() => {
    const active = directory.leaveTypes.filter((t) => isActiveLeaveType(t));
    const byKey = new Map<string, LeaveTypeRecord>();
    for (const t of active) {
      const key = isCompOffLeaveType(t.code, t.name)
        ? "CO"
        : String(t.code || t.name || t.id).trim().toUpperCase();
      if (!key) continue;
      if (!byKey.has(key)) byKey.set(key, t);
    }
    if (![...byKey.keys()].some((k) => k === "CO")) {
      byKey.set("CO", {
        id: "__comp_off__",
        code: "CO",
        name: "Comp Off",
        isPaid: true,
        maxDays: 0,
        daysPerMonth: 0,
        requiresAttachment: false,
        status: "active",
        version: 1,
        color: DEFAULT_LEAVE_COLORS.CO ?? "#8b5cf6",
        carryForwardAllowed: false,
        approvalRequired: true,
        genderRestriction: "",
        eligibility: "Earned via OT / holiday / weekly-off work",
      });
    }
    return [...byKey.values()].sort((a, b) => {
      const aCo = isCompOffLeaveType(a.code, a.name) ? 1 : 0;
      const bCo = isCompOffLeaveType(b.code, b.name) ? 1 : 0;
      if (aCo !== bCo) return aCo - bCo;
      return a.name.localeCompare(b.name);
    });
  }, [directory.leaveTypes]);

  /** All leave-type ids that map to a display column (e.g. every company CO → one Comp Off). */
  const typeIdsByColumn = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const t of directory.leaveTypes) {
      if (!isActiveLeaveType(t)) continue;
      const key = isCompOffLeaveType(t.code, t.name)
        ? "CO"
        : String(t.code || t.name || t.id).trim().toUpperCase();
      const list = map.get(key) ?? [];
      list.push(t.id);
      map.set(key, list);
    }
    return map;
  }, [directory.leaveTypes]);

  const balanceYear = currentLeaveBalanceYear();
  const balanceByEmpType = useMemo(() => {
    const map = new Map<string, LeaveBalanceRecord>();
    for (const b of directory.balances) {
      // Prefer FY year; also accept same calendar year rows from older creates
      if (b.balanceYear !== balanceYear && b.balanceYear !== new Date().getFullYear()) continue;
      const key = `${b.employeeId}:${b.leaveTypeId}`;
      const prev = map.get(key);
      if (!prev || b.balanceYear === balanceYear) map.set(key, b);
    }
    return map;
  }, [directory.balances, balanceYear]);

  function balanceFor(empId: string, t: LeaveTypeRecord): LeaveBalanceRecord | undefined {
    const colKey = isCompOffLeaveType(t.code, t.name)
      ? "CO"
      : String(t.code || t.name || t.id).trim().toUpperCase();
    const ids = typeIdsByColumn.get(colKey) ?? [t.id];
    const rows = ids
      .map((id) => balanceByEmpType.get(`${empId}:${id}`))
      .filter((b): b is LeaveBalanceRecord => Boolean(b));
    if (!rows.length) return undefined;
    if (rows.length === 1) return rows[0];
    // Sum Comp Off (or duplicate codes) across company-scoped type ids.
    return {
      ...rows[0]!,
      available: rows.reduce((s, r) => s + r.available, 0),
      used: rows.reduce((s, r) => s + r.used, 0),
      pending: rows.reduce((s, r) => s + r.pending, 0),
      accrued: rows.reduce((s, r) => s + r.accrued, 0),
      allocated: rows.reduce((s, r) => s + r.allocated, 0),
      closing: rows.reduce((s, r) => s + r.closing, 0),
    };
  }

  const employees = useMemo(() => {
    // Unique by employee id, then by emp code (avoid directory/balance double-add)
    const byId = new Map<string, EmployeeRow>();
    for (const e of directory.options.employees) {
      if (!isLeaveBalanceEligible(e.lifecycleStatus)) continue;
      const name = (e.label.split(" · ")[0] || e.label || "").trim();
      const code = String(e.code || "").trim();
      // Skip blank identity rows (bad master data / orphan balance ghosts)
      if (!name && !code) continue;
      const entity = String(e.companyName || "").trim();
      byId.set(e.id, {
        id: e.id,
        name: name || code,
        code,
        branchId: e.branchId,
        companyName: !entity || entity === "-" || entity === "—" ? "" : entity,
        lifecycleStatus: e.lifecycleStatus,
      });
    }
    // Do NOT invent grid rows from orphan leave_balance employee_ids —
    // those create empty name/code/entity cells when the employee was deleted
    // or never synced into the directory.
    // Collapse same emp code (legacy EMP- vs CDPL/CT re-imports) — keep preferred code
    const byCode = new Map<string, EmployeeRow>();
    const ranked = [...byId.values()].sort((a, b) => {
      const score = (r: EmployeeRow) => {
        const c = r.code.toUpperCase();
        if (c.startsWith("CDPL") || c.startsWith("CT") || c.startsWith("VPL")) return 0;
        if (c.startsWith("EMP-") || c.startsWith("EMP")) return 2;
        return 1;
      };
      return score(a) - score(b) || a.name.localeCompare(b.name);
    });
    for (const row of ranked) {
      const key = row.code.trim().toUpperCase();
      if (!key) {
        byCode.set(row.id, row);
        continue;
      }
      if (!byCode.has(key)) byCode.set(key, row);
    }
    return [...byCode.values()].sort((a, b) => a.name.localeCompare(b.name) || a.code.localeCompare(b.code));
  }, [directory]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) =>
      `${e.name} ${e.code} ${e.companyName}`.toLowerCase().includes(q),
    );
  }, [employees, query]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search employee name or code…"
          className="h-8 max-w-sm"
        />
        {query ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="cursor-pointer h-8"
            onClick={() => setQuery("")}
          >
            Clear
          </Button>
        ) : null}
        <p className="text-[11px] text-muted-foreground">
          Leave FY {balanceYear}–{String(balanceYear + 1).slice(2)}
          {leaveTypes.length ? ` · ${leaveTypes.length} leave type(s)` : " · no leave types in setup"}
          {` · ${filtered.length} employee(s)`}
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/70 bg-card shadow-sm">
        <table className="w-full min-w-[720px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-border/70 bg-muted/40">
              <th className="sticky left-0 z-10 bg-muted/95 px-3 py-2 font-medium">Employee</th>
              <th className="px-2 py-2 font-medium">Code</th>
              <th className="px-2 py-2 font-medium">Entity</th>
              {leaveTypes.map((t) => (
                <th key={t.id} className="px-2 py-2 font-medium whitespace-nowrap">
                  <span
                    className="inline-flex items-center gap-1"
                    title={`${t.name} (${t.code}) · ${leaveTypePolicyCredit(t).label}`}
                  >
                    <span className="size-2 rounded-full" style={{ backgroundColor: t.color }} />
                    {t.name || t.code}
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
                <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium">{emp.name || "—"}</td>
                <td className="px-2 py-2 font-mono text-muted-foreground">{emp.code || "—"}</td>
                <td className="px-2 py-2 text-muted-foreground">{emp.companyName || "—"}</td>
                {leaveTypes.map((t) => {
                  const bal = balanceFor(emp.id, t);
                  const isCo = isCompOffLeaveType(t.code, t.name);
                  return (
                    <td key={t.id} className="px-2 py-2 text-center tabular-nums">
                      {bal ? (
                        <span title={`Avail ${bal.available} · Used ${bal.used} · Pending ${bal.pending}`}>
                          {bal.available}
                        </span>
                      ) : isCo ? (
                        <span className="text-muted-foreground" title="No Comp Off credited yet (auto from OT / holiday work)">
                          0
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length ? (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">No employees match search.</p>
        ) : null}
        {filtered.length && !leaveTypes.length ? (
          <p className="px-4 py-4 text-center text-xs text-amber-800">
            Leave types are missing. Open <strong>Org Setup → Leave Types</strong> and create SL / CL / etc. with
            monthly or yearly credit.
          </p>
        ) : null}
      </div>

      <EmployeeLeaveBalanceDrawer
        open={!!selected}
        employee={selected}
        directory={directory}
        leaveTypes={leaveTypes}
        balances={selected ? directory.balances.filter((b) => b.employeeId === selected.id) : []}
        balanceYear={balanceYear}
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
  balanceYear,
  onClose,
  onSaved,
}: {
  open: boolean;
  employee: EmployeeRow | null;
  directory: LeaveDirectory;
  leaveTypes: LeaveTypeRecord[];
  balances: LeaveBalanceRecord[];
  balanceYear: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const year = balanceYear;
  /** Prefer FY year, then calendar year, then any year — so existing DB rows surface in the UI. */
  const balanceByType = useMemo(() => {
    const map = new Map<string, LeaveBalanceRecord>();
    const byCode = new Map<string, LeaveBalanceRecord>();
    const rank = (b: LeaveBalanceRecord) => {
      if (b.balanceYear === year) return 0;
      if (b.balanceYear === new Date().getFullYear()) return 1;
      return 2;
    };
    const sorted = [...balances].sort((a, b) => rank(a) - rank(b));
    for (const b of sorted) {
      if (!map.has(b.leaveTypeId)) map.set(b.leaveTypeId, b);
      const code = String(b.leaveTypeCode || "").toUpperCase();
      if (code && !byCode.has(code)) byCode.set(code, b);
    }
    // Attach code aliases so policy leave types match even if ids differ across companies
    for (const t of leaveTypes) {
      if (map.has(t.id)) continue;
      const hit = byCode.get(String(t.code || "").toUpperCase());
      if (hit) map.set(t.id, hit);
    }
    return map;
  }, [balances, year, leaveTypes]);

  const yearBalances = useMemo(() => {
    const seen = new Set<string>();
    const out: LeaveBalanceRecord[] = [];
    for (const t of leaveTypes) {
      const b = balanceByType.get(t.id);
      if (b && !seen.has(b.id)) {
        seen.add(b.id);
        out.push(b);
      }
    }
    for (const b of balances) {
      if (!seen.has(b.id) && (b.balanceYear === year || b.balanceYear === new Date().getFullYear())) {
        seen.add(b.id);
        out.push(b);
      }
    }
    return out;
  }, [balanceByType, leaveTypes, balances, year]);

  const [adjustTypeId, setAdjustTypeId] = useState("");
  const [adjustMonth, setAdjustMonth] = useState(currentYearMonth());
  /** Editable "leaves left" — seeded from balance when type is selected. */
  const [adjustDays, setAdjustDays] = useState("");
  const [adjustBaselineLeft, setAdjustBaselineLeft] = useState<number | null>(null);
  const [adjustReason, setAdjustReason] = useState("");
  const [busy, setBusy] = useState(false);

  const adjustBalance = adjustTypeId ? balanceByType.get(adjustTypeId) ?? null : null;

  function selectAdjustType(typeId: string) {
    setAdjustTypeId(typeId);
    if (!typeId) {
      setAdjustDays("");
      setAdjustBaselineLeft(null);
      return;
    }
    const bal = balanceByType.get(typeId);
    if (!bal) {
      setAdjustDays("");
      setAdjustBaselineLeft(null);
      return;
    }
    const left = Number(bal.available);
    setAdjustBaselineLeft(left);
    setAdjustDays(String(left));
  }

  useEffect(() => {
    if (!open) return;
    setAdjustTypeId("");
    setAdjustDays("");
    setAdjustBaselineLeft(null);
    setAdjustReason("");
    setAdjustMonth(currentYearMonth());
  }, [open, employee?.id]);

  // After save / balance reload, reseed only when server "left" changed.
  const serverLeft = adjustBalance != null ? Number(adjustBalance.available) : null;
  useEffect(() => {
    if (!open || !adjustTypeId || serverLeft == null || !Number.isFinite(serverLeft)) return;
    if (adjustBaselineLeft === serverLeft) return;
    setAdjustBaselineLeft(serverLeft);
    setAdjustDays(String(serverLeft));
  }, [open, adjustTypeId, serverLeft, adjustBaselineLeft]);

  const unassignedTypes = leaveTypes.filter((t) => !balanceByType.has(t.id));

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
      toast(formatApiError(e, "Couldn't complete that action. Try again."), "error");
    } finally {
      setBusy(false);
    }
  }

  async function assignType(t: LeaveTypeRecord) {
    if (!employee || !branchId) {
      toast("Employee branch is missing — set branch on the employee first", "error");
      return;
    }
    const amounts = defaultAssignAmounts(t, year);
    await createEmployeeLeaveBalance({
      branchId,
      employeeId: employee.id,
      leaveTypeId: t.id,
      balanceYear: year,
      openingBalance: amounts.openingBalance,
      accruedDays: amounts.accruedDays,
    });
  }

  async function assignAllFromPolicy() {
    if (!unassignedTypes.length) {
      toast("All leave types already assigned", "error");
      return;
    }
    for (const t of unassignedTypes) {
      await assignType(t);
    }
  }

  return (
    <SetupDrawer
      open={open}
      onClose={onClose}
      wide
      title={employee ? `Leave balances - ${employee.name}` : "Leave balances"}
      description="All leave types from Leave Setup, with monthly or yearly credit from policy. Same balances as ESS."
      footer={
        <Button type="button" variant="outline" className="cursor-pointer" onClick={onClose}>
          Close
        </Button>
      }
    >
      {!employee ? null : (
        <div className="space-y-6">
          <section className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Leave types ({year}–{String(year + 1).slice(2)})
              </h3>
              {unassignedTypes.length ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="cursor-pointer h-7 text-[11px]"
                  disabled={busy || !branchId}
                  onClick={() =>
                    void run(assignAllFromPolicy, `Assigned ${unassignedTypes.length} leave type(s) from policy`)
                  }
                >
                  <Wand2 className="size-3.5" />
                  Assign all from policy
                </Button>
              ) : null}
            </div>

            {!leaveTypes.length ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                No leave types loaded. Create them under <strong>Org Setup → Leave Types</strong> (set monthly credit
                or max days / year), then refresh.
              </p>
            ) : (
              <ul className="space-y-2">
                {leaveTypes.map((t) => {
                  const bal = balanceByType.get(t.id);
                  const policy = leaveTypePolicyCredit(t);
                  const amounts = defaultAssignAmounts(t, year);
                  return (
                    <li
                      key={t.id}
                      className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border/60 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 text-sm font-medium">
                          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: t.color }} />
                          {t.name}
                          <span className="font-mono text-[10px] text-muted-foreground">({t.code})</span>
                        </p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          Policy: {policy.label}
                          {policy.mode === "monthly" ? ` · credited to date ≈ ${amounts.accruedDays}` : null}
                        </p>
                        {bal ? (
                          <p className="mt-1 text-[11px] tabular-nums text-foreground">
                            Opening {bal.opening} · Accrued {bal.accrued} · Used {bal.used} ·{" "}
                            <span className="font-semibold">Left {bal.available}</span>
                            {bal.pending ? ` · Pending ${bal.pending}` : ""}
                          </p>
                        ) : (
                          <p className="mt-1 text-[11px] text-muted-foreground">Not assigned for this employee yet</p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        {!bal ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="cursor-pointer h-7 text-[11px]"
                            disabled={busy || !branchId}
                            title={amounts.hint}
                            onClick={() =>
                              void run(() => assignType(t), `${t.code} assigned (${amounts.hint})`)
                            }
                          >
                            <Plus className="size-3.5" />
                            Assign
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="cursor-pointer h-7 text-destructive hover:text-destructive"
                            disabled={busy || bal.used > 0}
                            title={bal.used > 0 ? "Cannot remove while used > 0" : "Remove leave type"}
                            onClick={() => {
                              if (!window.confirm(`Remove ${t.name} from this employee?`)) return;
                              void run(() => removeEmployeeLeaveBalance(bal.id), "Leave type removed");
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Monthly adjustment
            </h3>
            <p className="text-[10px] text-muted-foreground">
              Select a leave type to load current left / used. Edit leaves left, then apply for the month.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <SetupField label="Leave type" required>
                <SetupSelect
                  value={adjustTypeId}
                  onChange={(e) => selectAdjustType(e.target.value)}
                >
                  <option value="">Select…</option>
                  {yearBalances.map((b) => (
                    <option key={b.leaveTypeId} value={b.leaveTypeId}>
                      {b.leaveTypeName} ({b.leaveTypeCode})
                    </option>
                  ))}
                </SetupSelect>
              </SetupField>
              <SetupField label="Month" required>
                <SetupInput type="month" value={adjustMonth} onChange={(e) => setAdjustMonth(e.target.value)} />
              </SetupField>
              <SetupField
                label="Leaves left"
                required
                hint={
                  adjustBalance
                    ? `Loaded: left ${adjustBalance.available} · used ${adjustBalance.used} · accrued ${adjustBalance.accrued}`
                    : "Pick a leave type to auto-fill"
                }
              >
                <SetupInput
                  inputMode="decimal"
                  placeholder="Select leave type first"
                  value={adjustDays}
                  onChange={(e) => setAdjustDays(e.target.value)}
                  disabled={!adjustTypeId}
                />
              </SetupField>
              <SetupField label="Reason">
                <SetupTextarea rows={2} value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} />
              </SetupField>
            </div>
            {adjustBalance ? (
              <p className="text-[11px] tabular-nums text-muted-foreground">
                Now: <span className="font-medium text-foreground">Left {adjustBalance.available}</span>
                {" · "}Used {adjustBalance.used}
                {" · "}Opening {adjustBalance.opening}
                {" · "}Accrued {adjustBalance.accrued}
                {adjustBaselineLeft != null && adjustDays !== "" && Number.isFinite(Number(adjustDays)) ? (
                  <>
                    {" · "}Change{" "}
                    <span className="font-medium text-foreground">
                      {Number(adjustDays) - adjustBaselineLeft >= 0 ? "+" : ""}
                      {(Number(adjustDays) - adjustBaselineLeft).toFixed(2)}
                    </span>
                  </>
                ) : null}
              </p>
            ) : null}
            <Button
              type="button"
              size="sm"
              className="cursor-pointer"
              disabled={
                busy ||
                !adjustTypeId ||
                adjustDays === "" ||
                !branchId ||
                !yearBalances.length ||
                adjustBaselineLeft == null
              }
              onClick={() => {
                const newLeft = Number(adjustDays);
                if (!Number.isFinite(newLeft) || newLeft < 0) {
                  toast("Enter a valid leaves-left value (0 or more)", "error");
                  return;
                }
                if (adjustBaselineLeft == null) {
                  toast("Select a leave type first", "error");
                  return;
                }
                const daysDelta = Number((newLeft - adjustBaselineLeft).toFixed(2));
                if (daysDelta === 0) {
                  toast("No change from current leaves left", "error");
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
                      reason:
                        adjustReason.trim() ||
                        `Set leaves left to ${newLeft} (was ${adjustBaselineLeft})`,
                    }),
                  `Leaves left updated to ${newLeft}`,
                );
              }}
            >
              Apply adjustment
            </Button>
            {!yearBalances.length ? (
              <p className="text-[10px] text-muted-foreground">
                Assign at least one leave type above before adjusting.
              </p>
            ) : null}
          </section>
        </div>
      )}
    </SetupDrawer>
  );
}
