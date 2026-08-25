"use client";

import { useEffect, useState } from "react";

import { EmployeeSelect } from "@/components/hr/shared/employee-select";
import {
  SetupDrawer,
  SetupField,
  SetupInput,
  SetupSelect,
  SetupTextarea,
} from "@/components/hr/setup/setup-drawer";
import { Button } from "@/components/ui/button";
import type { HrMasterOption } from "@/services/hr-master-connector";
import type {
  BonusType,
  EmployeeSalary,
  ReimbType,
  RevisionReason,
  SalaryStructure,
  TaxRegime,
} from "@/types/payroll-management";
import { monthLabel } from "@/types/payroll-management";

export function StructureDrawer({
  open,
  onClose,
  onSubmit,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: Omit<SalaryStructure, "id" | "createdAt">) => void;
  initial?: SalaryStructure | null;
}) {
  const [name, setName] = useState("Engineer Structure");
  const [basic, setBasic] = useState("35000");
  const [hra, setHra] = useState("14000");
  const [special, setSpecial] = useState("10000");
  const [medical, setMedical] = useState("1250");
  const [travel, setTravel] = useState("2400");
  const [food, setFood] = useState("0");
  const [internet, setInternet] = useState("1000");
  const [pf, setPf] = useState("1800");
  const [esi, setEsi] = useState("0");
  const [pt, setPt] = useState("200");
  const [tds, setTds] = useState("3500");
  const [loan, setLoan] = useState("0");
  const [advance, setAdvance] = useState("0");
  const [insurance, setInsurance] = useState("300");

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setName(initial.name);
      setBasic(String(initial.basic));
      setHra(String(initial.hra));
      setSpecial(String(initial.specialAllowance));
      setMedical(String(initial.medicalAllowance));
      setTravel(String(initial.travelAllowance));
      setFood(String(initial.foodAllowance));
      setInternet(String(initial.internetAllowance));
      setPf(String(initial.pf));
      setEsi(String(initial.esi));
      setPt(String(initial.professionalTax));
      setTds(String(initial.tds));
      setLoan(String(initial.loanRecovery));
      setAdvance(String(initial.advanceRecovery));
      setInsurance(String(initial.insurance));
    } else {
      setName("Engineer Structure");
      setBasic("35000");
      setHra("14000");
      setSpecial("10000");
      setMedical("1250");
      setTravel("2400");
      setFood("0");
      setInternet("1000");
      setPf("1800");
      setEsi("0");
      setPt("200");
      setTds("3500");
      setLoan("0");
      setAdvance("0");
      setInsurance("300");
    }
  }, [open, initial]);

  function num(v: string) {
    return Number(v) || 0;
  }

  return (
    <SetupDrawer
      open={open}
      onClose={onClose}
      wide
      title={initial ? "Edit Salary Structure" : "Create Salary Structure"}
      description="Earnings and statutory deductions template."
      footer={
        <Button
          type="button"
          className="cursor-pointer"
          disabled={!name.trim()}
          onClick={() => {
            onSubmit({
              code: initial?.code,
              name: name.trim(),
              basic: num(basic),
              hra: num(hra),
              specialAllowance: num(special),
              medicalAllowance: num(medical),
              travelAllowance: num(travel),
              foodAllowance: num(food),
              internetAllowance: num(internet),
              bonus: initial?.bonus ?? 0,
              incentives: initial?.incentives ?? 0,
              overtime: initial?.overtime ?? 0,
              arrears: initial?.arrears ?? 0,
              reimbursement: initial?.reimbursement ?? 0,
              otherEarnings: initial?.otherEarnings ?? 0,
              pf: num(pf),
              esi: num(esi),
              professionalTax: num(pt),
              tds: num(tds),
              loanRecovery: num(loan),
              advanceRecovery: num(advance),
              insurance: num(insurance),
              otherDeductions: initial?.otherDeductions ?? 0,
            });
            onClose();
          }}
        >
          {initial ? "Save Changes" : "Save Structure"}
        </Button>
      }
    >
      <div className="space-y-3">
        <SetupField label="Structure name" required>
          <SetupInput value={name} onChange={(e) => setName(e.target.value)} />
        </SetupField>
        <p className="text-[10px] font-semibold uppercase text-muted-foreground">Earnings</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["Basic", basic, setBasic],
              ["HRA", hra, setHra],
              ["Special Allowance", special, setSpecial],
              ["Medical", medical, setMedical],
              ["Travel", travel, setTravel],
              ["Food", food, setFood],
              ["Internet", internet, setInternet],
            ] as const
          ).map(([label, val, set]) => (
            <SetupField key={label} label={label}>
              <SetupInput type="number" value={val} onChange={(e) => set(e.target.value)} />
            </SetupField>
          ))}
        </div>
        <p className="text-[10px] font-semibold uppercase text-muted-foreground">Deductions</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["PF", pf, setPf],
              ["ESI", esi, setEsi],
              ["Professional Tax", pt, setPt],
              ["TDS", tds, setTds],
              ["Loan Recovery", loan, setLoan],
              ["Advance Recovery", advance, setAdvance],
              ["Insurance", insurance, setInsurance],
            ] as const
          ).map(([label, val, set]) => (
            <SetupField key={label} label={label}>
              <SetupInput type="number" value={val} onChange={(e) => set(e.target.value)} />
            </SetupField>
          ))}
        </div>
      </div>
    </SetupDrawer>
  );
}

export function RunPayrollDrawer({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (month: string, cutoverDay: number) => void;
}) {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [month, setMonth] = useState(defaultMonth);
  const [cutoverDay, setCutoverDay] = useState(20);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [cycleLabel, setCycleLabel] = useState("");
  const [previewLines, setPreviewLines] = useState<
    import("@/types/payroll-management").PayrollEmployeeAttendance[]
  >([]);

  useEffect(() => {
    if (!open) return;
    import("@/lib/payroll-cycle").then(({ readPayrollCutoverDay, writePayrollCutoverDay }) => {
      const d = readPayrollCutoverDay();
      setCutoverDay(d);
      writePayrollCutoverDay(d);
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingPreview(true);
    import("@/services/payroll-management-service").then(({ previewPayrollAttendanceForCycle }) =>
      previewPayrollAttendanceForCycle(month, cutoverDay)
        .then(({ cycle, lines }) => {
          if (cancelled) return;
          setCycleLabel(cycle.label);
          setPreviewLines(lines);
        })
        .catch(() => {
          if (!cancelled) {
            setCycleLabel("");
            setPreviewLines([]);
          }
        })
        .finally(() => {
          if (!cancelled) setLoadingPreview(false);
        }),
    );
    return () => {
      cancelled = true;
    };
  }, [open, month, cutoverDay]);

  const options = Array.from({ length: 8 }).map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return { value: ym, label: monthLabel(ym) };
  });

  function persistCutover(day: number) {
    setCutoverDay(day);
    void import("@/lib/payroll-cycle").then(({ writePayrollCutoverDay }) =>
      writePayrollCutoverDay(day),
    );
  }

  return (
    <SetupDrawer
      open={open}
      onClose={onClose}
      title="Run Payroll"
      description="Pulls attendance and approved leave for the pay cycle, then prorates salary by payable days."
      footer={
        <Button
          type="button"
          className="cursor-pointer transition-colors duration-200"
          disabled={loadingPreview}
          onClick={() => {
            onSubmit(month, cutoverDay);
            onClose();
          }}
        >
          {loadingPreview ? "Loading attendance…" : "Run Payroll"}
        </Button>
      }
    >
      <div className="space-y-3">
        <SetupField
          label="Pay cycle anchor month"
          hint="Cycle runs from the cutover day of this month through the day before the next cutover."
        >
          <SetupSelect value={month} onChange={(e) => setMonth(e.target.value)}>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SetupSelect>
        </SetupField>
        <SetupField label="Cycle cutover day" hint="Default 20 → 20th to 19th of next month">
          <SetupSelect
            value={String(cutoverDay)}
            onChange={(e) => persistCutover(Number(e.target.value))}
          >
            {Array.from({ length: 28 }).map((_, i) => {
              const day = i + 1;
              return (
                <option key={day} value={day}>
                  {day}
                  {day === 1 ? "st" : day === 2 ? "nd" : day === 3 ? "rd" : "th"} of month
                </option>
              );
            })}
          </SetupSelect>
        </SetupField>
        <div className="rounded-xl border border-hrms-mint bg-hrms-mint px-3 py-2 text-xs text-foreground">
          <p className="font-medium">Pay period</p>
          <p className="mt-0.5 tabular-nums">
            {loadingPreview ? "Calculating…" : cycleLabel || "—"}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-medium text-foreground">Attendance preview</p>
          <p className="text-[10px] text-muted-foreground">
            Present, leave, and absent from HR attendance + approved leave in this cycle.
          </p>
          <div className="mt-2 max-h-48 overflow-auto rounded-lg border border-border/70">
            <table className="w-full min-w-[420px] text-left text-[11px]">
              <thead className="sticky top-0 border-b bg-muted/60 text-[10px] uppercase text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 font-medium">Employee</th>
                  <th className="px-2 py-1.5 font-medium">Present</th>
                  <th className="px-2 py-1.5 font-medium">Leave</th>
                  <th className="px-2 py-1.5 font-medium">Absent</th>
                  <th className="px-2 py-1.5 font-medium">Payable</th>
                </tr>
              </thead>
              <tbody>
                {previewLines.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-2 py-3 text-muted-foreground">
                      {loadingPreview ? "Loading…" : "No attendance in cycle — full month salary used."}
                    </td>
                  </tr>
                ) : (
                  previewLines.map((l) => (
                    <tr key={l.employeeId} className="border-b border-border/40">
                      <td className="px-2 py-1.5 font-medium">{l.employeeName}</td>
                      <td className="px-2 py-1.5 tabular-nums">{l.presentDays}</td>
                      <td className="px-2 py-1.5 tabular-nums">{l.leaveDays}</td>
                      <td className="px-2 py-1.5 tabular-nums">{l.absentDays}</td>
                      <td className="px-2 py-1.5 tabular-nums">
                        {l.payableDays}/{l.workingDaysInCycle}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </SetupDrawer>
  );
}

export function RevisionDrawer({
  open,
  onClose,
  salaries,
  employees,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  salaries: EmployeeSalary[];
  employees?: HrMasterOption[];
  onSubmit: (input: {
    employeeId: string;
    employeeName: string;
    oldSalary: number;
    newSalary: number;
    effectiveDate: string;
    reason: RevisionReason;
  }) => void;
}) {
  const [employeeId, setEmployeeId] = useState("");
  const [newSalary, setNewSalary] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [reason, setReason] = useState<RevisionReason>("increment");

  const fromSalary = salaries.find((s) => s.id === employeeId || s.employeeId === employeeId);
  const fromMaster = employees?.find((e) => e.id === employeeId);
  const selected = fromSalary
    ? {
        employeeId: fromSalary.employeeId,
        employeeName: fromSalary.employeeName,
        monthlyCtc: fromSalary.monthlyCtc,
      }
    : fromMaster
      ? {
          employeeId: fromMaster.code || fromMaster.id,
          employeeName: fromMaster.label.split(" · ")[0],
          monthlyCtc: fromMaster.monthlyCtc ?? 0,
        }
      : null;

  const salaryOptions: HrMasterOption[] =
    salaries.length > 0
      ? salaries.map((s) => ({
          id: s.id,
          label: `${s.employeeName} · ${s.employeeId}`,
          code: s.employeeId,
          department: s.department,
          monthlyCtc: s.monthlyCtc,
        }))
      : (employees ?? []);

  return (
    <SetupDrawer
      open={open}
      onClose={onClose}
      title="Salary Revision"
      footer={
        <Button
          type="button"
          className="cursor-pointer"
          disabled={!selected || !newSalary || !effectiveDate}
          onClick={() => {
            if (!selected) return;
            onSubmit({
              employeeId: selected.employeeId,
              employeeName: selected.employeeName,
              oldSalary: selected.monthlyCtc,
              newSalary: Number(newSalary) || 0,
              effectiveDate,
              reason,
            });
            onClose();
          }}
        >
          Save Revision
        </Button>
      }
    >
      <div className="space-y-3">
        <EmployeeSelect
          value={employeeId}
          options={salaryOptions}
          required
          onChange={setEmployeeId}
        />
        {selected ? (
          <p className="text-xs text-muted-foreground">
            Current CTC: ₹{selected.monthlyCtc.toLocaleString("en-IN")} / month
          </p>
        ) : null}
        <SetupField label="New monthly salary">
          <SetupInput type="number" value={newSalary} onChange={(e) => setNewSalary(e.target.value)} />
        </SetupField>
        <SetupField label="Effective date">
          <SetupInput type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
        </SetupField>
        <SetupField label="Reason">
          <SetupSelect value={reason} onChange={(e) => setReason(e.target.value as RevisionReason)}>
            <option value="promotion">Promotion</option>
            <option value="increment">Increment</option>
            <option value="correction">Correction</option>
          </SetupSelect>
        </SetupField>
      </div>
    </SetupDrawer>
  );
}

export function LockMonthDrawer({
  open,
  onClose,
  mode,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  mode: "lock" | "unlock";
  onSubmit: (month: string, reason: string) => void;
}) {
  const now = new Date();
  const [month, setMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
  );
  const [reason, setReason] = useState("");

  return (
    <SetupDrawer
      open={open}
      onClose={onClose}
      title={mode === "lock" ? "Lock Payroll Month" : "Unlock Payroll Month"}
      description={
        mode === "lock"
          ? "Locked months cannot edit attendance, leave, or salary. Only Super Admin unlocks."
          : "Reason is mandatory. Unlock is audited."
      }
      footer={
        <Button
          type="button"
          className="cursor-pointer"
          disabled={!reason.trim()}
          onClick={() => {
            onSubmit(month, reason.trim());
            onClose();
            setReason("");
          }}
        >
          {mode === "lock" ? "Lock Month" : "Unlock Month"}
        </Button>
      }
    >
      <div className="space-y-3">
        <SetupField label="Month">
          <SetupInput type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </SetupField>
        <SetupField label="Reason" required>
          <SetupTextarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
        </SetupField>
      </div>
    </SetupDrawer>
  );
}

export function AssignSalaryDrawer({
  open,
  onClose,
  structures,
  employees,
  initial,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  structures: SalaryStructure[];
  employees: HrMasterOption[];
  initial?: EmployeeSalary | null;
  onSubmit: (input: Omit<EmployeeSalary, "id"> & { id?: string }) => void;
}) {
  const [employeeKey, setEmployeeKey] = useState("");
  const [structureId, setStructureId] = useState(structures[0]?.id ?? "");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [monthlyCtc, setMonthlyCtc] = useState("50000");
  const [payrollGroup, setPayrollGroup] = useState("General");
  const [bankAccount, setBankAccount] = useState("");
  const [taxRegime, setTaxRegime] = useState<TaxRegime>("new");

  const editing = Boolean(initial);
  const structure = structures.find((s) => s.id === structureId);
  const employee = (employees ?? []).find(
    (e) => e.id === employeeKey || e.code === employeeKey || e.code === initial?.employeeId,
  );

  useEffect(() => {
    if (!open) return;
    if (initial) {
      const match =
        (employees ?? []).find(
          (e) =>
            e.code === initial.employeeId ||
            e.id === initial.employeeId ||
            e.label.toLowerCase().includes(initial.employeeName.toLowerCase()),
        ) ?? null;
      setEmployeeKey(match?.id ?? initial.employeeId);
      setStructureId(initial.structureId || structures[0]?.id || "");
      setEffectiveDate(initial.effectiveDate || "");
      setMonthlyCtc(String(initial.monthlyCtc || 0));
      setPayrollGroup(initial.payrollGroup || "General");
      setBankAccount(initial.bankAccount || "");
      setTaxRegime(initial.taxRegime || "new");
      return;
    }
    setEmployeeKey("");
    setStructureId(structures[0]?.id ?? "");
    setEffectiveDate("");
    setMonthlyCtc("50000");
    setPayrollGroup("General");
    setBankAccount("");
    setTaxRegime("new");
  }, [open, initial, structures, employees]);

  useEffect(() => {
    if (!open || editing || !employee) return;
    if (employee.monthlyCtc) setMonthlyCtc(String(employee.monthlyCtc));
    if (employee.bankAccount) setBankAccount(employee.bankAccount);
  }, [employee, open, editing]);

  return (
    <SetupDrawer
      open={open}
      onClose={onClose}
      wide
      title={editing ? "Edit Employee Salary" : "Assign Employee Salary"}
      description={
        editing
          ? "Update CTC, structure, and bank details for this employee."
          : "Pick an employee from Workforce. Re-assigning the same person updates their existing salary."
      }
      footer={
        <Button
          type="button"
          className="cursor-pointer"
          disabled={!employeeKey || !structureId}
          onClick={() => {
            const emp =
              employee ??
              ({
                id: employeeKey,
                code: initial?.employeeId ?? employeeKey,
                label: initial?.employeeName ?? employeeKey,
                department: initial?.department,
                bankAccount,
              } as HrMasterOption);
            onSubmit({
              id: initial?.id,
              employeeId: emp.code || initial?.employeeId || emp.id,
              employeeName: (emp.label?.split(" · ")[0] || initial?.employeeName || emp.id).trim(),
              structureId,
              structureName: structure?.name ?? initial?.structureName ?? "",
              effectiveDate,
              monthlyCtc: Number(monthlyCtc) || 0,
              annualCtc: (Number(monthlyCtc) || 0) * 12,
              payrollGroup,
              bankAccount: bankAccount || emp.bankAccount || "",
              taxRegime,
              salaryStatus: "active",
              department: emp.department || initial?.department || "General",
            });
            onClose();
          }}
        >
          {editing ? "Save changes" : "Assign"}
        </Button>
      }
    >
      <div className="space-y-3">
        {editing ? (
          <SetupField label="Employee">
            <SetupInput
              value={`${initial?.employeeName ?? ""} (${initial?.employeeId ?? ""})`}
              readOnly
              disabled
            />
          </SetupField>
        ) : (
          <EmployeeSelect
            value={employeeKey}
            options={employees}
            required
            onChange={setEmployeeKey}
          />
        )}
        {!editing && employee ? (
          <p className="text-[11px] text-muted-foreground">
            ID {employee.code || employee.id}
            {employee.department ? ` · ${employee.department}` : ""}
            {employee.shiftName ? ` · Shift ${employee.shiftName}` : ""}
          </p>
        ) : null}
        <SetupField label="Salary structure">
          <SetupSelect value={structureId} onChange={(e) => setStructureId(e.target.value)}>
            {structures.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </SetupSelect>
        </SetupField>
        <div className="grid gap-3 sm:grid-cols-2">
          <SetupField label="Effective date">
            <SetupInput type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
          </SetupField>
          <SetupField label="Monthly CTC">
            <SetupInput type="number" value={monthlyCtc} onChange={(e) => setMonthlyCtc(e.target.value)} />
          </SetupField>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <SetupField label="Payroll group">
            <SetupInput value={payrollGroup} onChange={(e) => setPayrollGroup(e.target.value)} />
          </SetupField>
          <SetupField label="Tax regime">
            <SetupSelect value={taxRegime} onChange={(e) => setTaxRegime(e.target.value as TaxRegime)}>
              <option value="new">New</option>
              <option value="old">Old</option>
            </SetupSelect>
          </SetupField>
        </div>
        <SetupField label="Bank account">
          <SetupInput value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} />
        </SetupField>
      </div>
    </SetupDrawer>
  );
}

export function BonusDrawer({
  open,
  onClose,
  employees,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  employees: HrMasterOption[];
  onSubmit: (input: {
    employeeId?: string;
    employeeName: string;
    bonusType: BonusType;
    amount: number;
    month: string;
  }) => void;
}) {
  const [employeeKey, setEmployeeKey] = useState("");
  const [bonusType, setBonusType] = useState<BonusType>("festival");
  const [amount, setAmount] = useState("");
  const [month, setMonth] = useState("");
  const employee = (employees ?? []).find((e) => e.id === employeeKey);

  return (
    <SetupDrawer
      open={open}
      onClose={onClose}
      title="Add Bonus"
      footer={
        <Button
          type="button"
          className="cursor-pointer"
          disabled={!employee || !amount}
          onClick={() => {
            if (!employee) return;
            onSubmit({
              employeeId: employee.id,
              employeeName: employee.label.split(" · ")[0],
              bonusType,
              amount: Number(amount) || 0,
              month: month || new Date().toISOString().slice(0, 7),
            });
            onClose();
          }}
        >
          Save Bonus
        </Button>
      }
    >
      <div className="space-y-3">
        <EmployeeSelect value={employeeKey} options={employees} required onChange={setEmployeeKey} />
        <SetupField label="Bonus type">
          <SetupSelect value={bonusType} onChange={(e) => setBonusType(e.target.value as BonusType)}>
            <option value="festival">Festival</option>
            <option value="performance">Performance</option>
            <option value="retention">Retention</option>
            <option value="referral">Referral</option>
          </SetupSelect>
        </SetupField>
        <SetupField label="Amount">
          <SetupInput type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </SetupField>
        <SetupField label="Month">
          <SetupInput type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </SetupField>
      </div>
    </SetupDrawer>
  );
}

export function AdjustmentDrawer({
  open,
  onClose,
  employees,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  employees: HrMasterOption[];
  onSubmit: (input: {
    employeeId: string;
    employeeName: string;
    kind: "arrears" | "incentive" | "other";
    amount: number;
    month: string;
  }) => void;
}) {
  const [employeeKey, setEmployeeKey] = useState("");
  const [kind, setKind] = useState<"arrears" | "incentive" | "other">("arrears");
  const [amount, setAmount] = useState("");
  const [month, setMonth] = useState("");
  const employee = (employees ?? []).find((e) => e.id === employeeKey);

  return (
    <SetupDrawer
      open={open}
      onClose={onClose}
      title="Add Arrears / Incentive"
      footer={
        <Button
          type="button"
          className="cursor-pointer"
          disabled={!employee || !amount}
          onClick={() => {
            if (!employee) return;
            onSubmit({
              employeeId: employee.id,
              employeeName: employee.label.split(" · ")[0],
              kind,
              amount: Number(amount) || 0,
              month: month || new Date().toISOString().slice(0, 7),
            });
            onClose();
          }}
        >
          Save Adjustment
        </Button>
      }
    >
      <div className="space-y-3">
        <EmployeeSelect value={employeeKey} options={employees} required onChange={setEmployeeKey} />
        <SetupField label="Kind">
          <SetupSelect
            value={kind}
            onChange={(e) => setKind(e.target.value as "arrears" | "incentive" | "other")}
          >
            <option value="arrears">Arrears</option>
            <option value="incentive">Incentive</option>
            <option value="other">Other earning</option>
          </SetupSelect>
        </SetupField>
        <SetupField label="Amount">
          <SetupInput type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </SetupField>
        <SetupField label="Month">
          <SetupInput type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </SetupField>
      </div>
    </SetupDrawer>
  );
}

export function ReimbDrawer({
  open,
  onClose,
  employees,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  employees: HrMasterOption[];
  onSubmit: (input: {
    employeeId?: string;
    employeeName: string;
    reimbType: ReimbType;
    amount: number;
  }) => void;
}) {
  const [employeeKey, setEmployeeKey] = useState("");
  const [reimbType, setReimbType] = useState<ReimbType>("travel");
  const [amount, setAmount] = useState("");
  const employee = (employees ?? []).find((e) => e.id === employeeKey);

  return (
    <SetupDrawer
      open={open}
      onClose={onClose}
      title="Add Reimbursement"
      footer={
        <Button
          type="button"
          className="cursor-pointer"
          disabled={!employee || !amount}
          onClick={() => {
            if (!employee) return;
            onSubmit({
              employeeId: employee.code || employee.id,
              employeeName: employee.label.split(" · ")[0],
              reimbType,
              amount: Number(amount) || 0,
            });
            onClose();
          }}
        >
          Submit
        </Button>
      }
    >
      <div className="space-y-3">
        <EmployeeSelect value={employeeKey} options={employees} required onChange={setEmployeeKey} />
        <SetupField label="Type">
          <SetupSelect value={reimbType} onChange={(e) => setReimbType(e.target.value as ReimbType)}>
            <option value="travel">Travel</option>
            <option value="fuel">Fuel</option>
            <option value="internet">Internet</option>
            <option value="food">Food</option>
            <option value="medical">Medical</option>
            <option value="other">Other</option>
          </SetupSelect>
        </SetupField>
        <SetupField label="Amount">
          <SetupInput type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </SetupField>
      </div>
    </SetupDrawer>
  );
}

export function LoanDrawer({
  open,
  onClose,
  employees,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  employees: HrMasterOption[];
  onSubmit: (input: {
    employeeId?: string;
    employeeName: string;
    loanAmount: number;
    installments: number;
    remainingBalance: number;
    recoveryPerMonth: number;
  }) => void;
}) {
  const [employeeKey, setEmployeeKey] = useState("");
  const [loanAmount, setLoanAmount] = useState("");
  const [installments, setInstallments] = useState("12");
  const employee = (employees ?? []).find((e) => e.id === employeeKey);

  const amount = Number(loanAmount) || 0;
  const inst = Number(installments) || 1;
  const emi = Math.round(amount / inst);

  return (
    <SetupDrawer
      open={open}
      onClose={onClose}
      title="Add Loan / Advance"
      footer={
        <Button
          type="button"
          className="cursor-pointer"
          disabled={!employee || !amount}
          onClick={() => {
            if (!employee) return;
            onSubmit({
              employeeId: employee.code || employee.id,
              employeeName: employee.label.split(" · ")[0],
              loanAmount: amount,
              installments: inst,
              remainingBalance: amount,
              recoveryPerMonth: emi,
            });
            onClose();
          }}
        >
          Save Loan
        </Button>
      }
    >
      <div className="space-y-3">
        <EmployeeSelect value={employeeKey} options={employees} required onChange={setEmployeeKey} />
        <SetupField label="Loan amount">
          <SetupInput type="number" value={loanAmount} onChange={(e) => setLoanAmount(e.target.value)} />
        </SetupField>
        <SetupField label="Installments">
          <SetupInput type="number" value={installments} onChange={(e) => setInstallments(e.target.value)} />
        </SetupField>
        <p className="text-xs text-muted-foreground">Recovery / month: ₹{emi.toLocaleString("en-IN")}</p>
      </div>
    </SetupDrawer>
  );
}
