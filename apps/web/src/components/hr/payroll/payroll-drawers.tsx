"use client";

import { useEffect, useState } from "react";

import { EmployeeSelect } from "@/components/hr/shared/employee-select";
import {
  SetupDrawer,
  SetupField,
  SetupInput,
  SetupSelect,
} from "@/components/hr/setup/setup-drawer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { HrMasterOption } from "@/services/hr-master-connector";
import { formatInr } from "@/services/payroll-service";
import type {
  BonusType,
  EmployeeSalary,
  ReimbType,
  RevisionReason,
  SalaryStructure,
} from "@/types/payroll-management";
import {
  splitSalaryFromGrossCtc,
  structureCtc,
} from "@/types/payroll-management";

function monthlyFromStructure(s?: SalaryStructure | null): number {
  if (!s) return 0;
  if ((s.grossCtc ?? 0) > 0) return s.grossCtc ?? 0;
  return structureCtc(s);
}

function bankOptionLabel(emp: HrMasterOption): string {
  const last4 = String(emp.accountNumber || emp.bankAccount || "").replace(/\D/g, "").slice(-4);
  return [emp.bankName, last4 ? `****${last4}` : null, emp.bankIfsc].filter(Boolean).join(" · ");
}

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
  const [name, setName] = useState("India Standard");
  const [grossCtc, setGrossCtc] = useState("18000");
  const [basic, setBasic] = useState("9000");
  const [hra, setHra] = useState("4500");
  const [special, setSpecial] = useState("2700");
  const [medical, setMedical] = useState("0");
  const [travel, setTravel] = useState("0");
  const [pf, setPf] = useState("1800");

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setName(initial.name);
      const unusedEarnings =
        initial.foodAllowance +
        initial.internetAllowance +
        initial.bonus +
        initial.incentives +
        initial.overtime +
        initial.arrears +
        initial.reimbursement +
        initial.otherEarnings;
      setGrossCtc(String(structureCtc(initial) || 18000));
      setBasic(String(initial.basic));
      setHra(String(initial.hra));
      setSpecial(String(initial.specialAllowance + unusedEarnings));
      setMedical(String(initial.medicalAllowance));
      setTravel(String(initial.travelAllowance));
      setPf(String(initial.pf));
      return;
    }
    const split = splitSalaryFromGrossCtc(18000);
    setName("India Standard");
    setGrossCtc("18000");
    setBasic(String(split.basic));
    setHra(String(split.hra));
    setSpecial(String(split.specialAllowance));
    setMedical("0");
    setTravel("0");
    setPf(String(split.pf));
  }, [open, initial]);

  function num(v: string) {
    return Number(v) || 0;
  }

  function onGrossChange(value: string) {
    setGrossCtc(value);
    const split = splitSalaryFromGrossCtc(num(value));
    setBasic(String(split.basic));
    setHra(String(split.hra));
    setSpecial(String(split.specialAllowance));
    setMedical("0");
    setTravel("0");
    setPf(String(split.pf));
  }

  function onBasicChange(value: string) {
    setBasic(value);
    const split = splitSalaryFromGrossCtc(num(grossCtc), {
      basic: num(value),
      medical: num(medical),
      travel: num(travel),
    });
    setHra(String(split.hra));
    setPf(String(split.pf));
    setSpecial(String(split.specialAllowance));
  }

  function rebalanceSpecial(next: {
    hra?: number;
    medical?: number;
    travel?: number;
    pf?: number;
  }) {
    const split = splitSalaryFromGrossCtc(num(grossCtc), {
      basic: num(basic),
      hra: next.hra ?? num(hra),
      medical: next.medical ?? num(medical),
      travel: next.travel ?? num(travel),
      pf: next.pf ?? num(pf),
    });
    setSpecial(String(split.specialAllowance));
  }

  const target = num(grossCtc);
  const calculated =
    num(basic) + num(hra) + num(special) + num(medical) + num(travel) + num(pf);
  const diff = calculated - target;
  const balanced = diff === 0;

  return (
    <SetupDrawer
      open={open}
      onClose={onClose}
      wide
      title={initial ? "Edit Salary Structure" : "Create Salary Structure"}
      description="Enter Gross CTC — components fill automatically and stay editable."
      footer={
        <Button
          type="button"
          className="cursor-pointer"
          disabled={!name.trim() || target <= 0}
          onClick={() => {
            onSubmit({
              code: initial?.code,
              name: name.trim(),
              basic: num(basic),
              hra: num(hra),
              specialAllowance: num(special),
              medicalAllowance: num(medical),
              travelAllowance: num(travel),
              foodAllowance: 0,
              internetAllowance: 0,
              bonus: 0,
              incentives: 0,
              overtime: 0,
              arrears: 0,
              reimbursement: 0,
              otherEarnings: 0,
              pf: num(pf),
              esi: 0,
              professionalTax: 0,
              tds: 0,
              loanRecovery: 0,
              advanceRecovery: 0,
              insurance: 0,
              otherDeductions: 0,
            });
            onClose();
          }}
        >
          {initial ? "Save Changes" : "Save Structure"}
        </Button>
      }
    >
      <div className="space-y-4">
        <SetupField label="Structure name" required>
          <SetupInput value={name} onChange={(e) => setName(e.target.value)} />
        </SetupField>
        <SetupField
          label="Gross CTC"
          required
          hint="Basic 50% of CTC · HRA 50% of Basic · Employer PF 12% (max ₹1,800) · Special = remainder"
        >
          <SetupInput
            type="number"
            min={0}
            step={100}
            value={grossCtc}
            onChange={(e) => onGrossChange(e.target.value)}
            className="font-semibold tabular-nums"
          />
        </SetupField>

        <div
          className={cn(
            "rounded-xl border px-3 py-2.5 text-xs transition-colors duration-200",
            balanced
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-amber-200 bg-amber-50 text-amber-950",
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium">{balanced ? "CTC balanced" : "CTC mismatch"}</span>
            <span className="tabular-nums">
              Target {formatInr(target)} · Calculated {formatInr(calculated)}
              {!balanced ? ` · Diff ${formatInr(diff)}` : ""}
            </span>
          </div>
        </div>

        <p className="text-[10px] font-semibold uppercase text-muted-foreground">Earnings</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <SetupField label="Basic" hint="AUTO · 50% of Gross CTC">
            <SetupInput type="number" min={0} value={basic} onChange={(e) => onBasicChange(e.target.value)} />
          </SetupField>
          <SetupField label="HRA" hint="AUTO · 50% of Basic">
            <SetupInput
              type="number"
              min={0}
              value={hra}
              onChange={(e) => {
                setHra(e.target.value);
                rebalanceSpecial({ hra: num(e.target.value) });
              }}
            />
          </SetupField>
          <SetupField label="Special allowance" hint="Balance / residual">
            <SetupInput type="number" min={0} value={special} onChange={(e) => setSpecial(e.target.value)} />
          </SetupField>
          <SetupField label="Medical">
            <SetupInput
              type="number"
              min={0}
              value={medical}
              onChange={(e) => {
                setMedical(e.target.value);
                rebalanceSpecial({ medical: num(e.target.value) });
              }}
            />
          </SetupField>
          <SetupField label="Conveyance">
            <SetupInput
              type="number"
              min={0}
              value={travel}
              onChange={(e) => {
                setTravel(e.target.value);
                rebalanceSpecial({ travel: num(e.target.value) });
              }}
            />
          </SetupField>
        </div>

        <p className="text-[10px] font-semibold uppercase text-muted-foreground">Employer contribution</p>
        <SetupField label="Employer PF" hint="AUTO · 12% of Basic, ceiling ₹1,800">
          <SetupInput
            type="number"
            min={0}
            value={pf}
            onChange={(e) => {
              setPf(e.target.value);
              rebalanceSpecial({ pf: num(e.target.value) });
            }}
          />
        </SetupField>
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
  const [monthlyCtc, setMonthlyCtc] = useState("");
  const [bankAccount, setBankAccount] = useState("");

  const editing = Boolean(initial);
  const structure = structures.find((s) => s.id === structureId);
  const employee = (employees ?? []).find(
    (e) => e.id === employeeKey || e.code === employeeKey || e.code === initial?.employeeId,
  );
  const bankValue = employee?.accountNumber || employee?.bankAccount || "";

  useEffect(() => {
    if (!open) return;
    const defaultStructure =
      (initial?.structureId ? structures.find((s) => s.id === initial.structureId) : undefined) ||
      structures[0];
    const nextStructureId = defaultStructure?.id ?? "";
    if (initial) {
      const match =
        (employees ?? []).find(
          (e) =>
            e.code === initial.employeeId ||
            e.id === initial.employeeId ||
            e.label.toLowerCase().includes(initial.employeeName.toLowerCase()),
        ) ?? null;
      setEmployeeKey(match?.id ?? initial.employeeId);
      setStructureId(nextStructureId);
      setEffectiveDate(initial.effectiveDate || "");
      setMonthlyCtc(String(monthlyFromStructure(defaultStructure) || initial.monthlyCtc || 0));
      setBankAccount(match?.accountNumber || match?.bankAccount || initial.bankAccount || "");
      return;
    }
    setEmployeeKey("");
    setStructureId(nextStructureId);
    setEffectiveDate("");
    setMonthlyCtc(String(monthlyFromStructure(defaultStructure) || ""));
    setBankAccount("");
  }, [open, initial, structures, employees]);

  function applyStructure(id: string) {
    setStructureId(id);
    const next = structures.find((s) => s.id === id);
    const ctc = monthlyFromStructure(next);
    if (ctc > 0) setMonthlyCtc(String(ctc));
  }

  function applyEmployee(id: string) {
    setEmployeeKey(id);
    const next = (employees ?? []).find((e) => e.id === id || e.code === id);
    setBankAccount(next?.accountNumber || next?.bankAccount || "");
  }

  return (
    <SetupDrawer
      open={open}
      onClose={onClose}
      wide
      title={editing ? "Edit assigned salary" : "Assign salary"}
      description={
        editing
          ? "Update structure, CTC, and bank for this employee."
          : "Pick an employee and salary structure. Monthly CTC fills from the structure."
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
                bankName: initial?.bankName,
              } as HrMasterOption);
            const ctc = Number(monthlyCtc) || monthlyFromStructure(structure) || 0;
            onSubmit({
              id: initial?.id,
              employeeId: emp.code || initial?.employeeId || emp.id,
              employeeName: (emp.label?.split(" · ")[0] || initial?.employeeName || emp.id).trim(),
              structureId,
              structureName: structure?.name ?? initial?.structureName ?? "",
              effectiveDate,
              monthlyCtc: ctc,
              annualCtc: ctc * 12,
              payrollGroup: initial?.payrollGroup || "General",
              bankAccount: bankAccount || emp.accountNumber || emp.bankAccount || "",
              bankName: emp.bankName || initial?.bankName || "",
              taxRegime: initial?.taxRegime || "new",
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
              value={`${employee?.label.split(" · ")[0] || initial?.employeeName || ""} (${initial?.employeeId || ""})`}
              readOnly
              disabled
            />
          </SetupField>
        ) : (
          <EmployeeSelect
            value={employeeKey}
            options={employees}
            required
            onChange={applyEmployee}
          />
        )}
        {!editing && employee ? (
          <p className="text-[11px] text-muted-foreground">
            ID {employee.code || employee.id}
            {employee.department ? ` · ${employee.department}` : ""}
            {employee.shiftName ? ` · Shift ${employee.shiftName}` : ""}
          </p>
        ) : null}
        <SetupField label="Salary structure" required>
          <SetupSelect value={structureId} onChange={(e) => applyStructure(e.target.value)}>
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
          <SetupField label="Monthly CTC" hint="Filled from the selected salary structure">
            <SetupInput type="number" value={monthlyCtc} readOnly className="tabular-nums bg-muted/40" />
          </SetupField>
        </div>
        <SetupField label="Bank account">
          {bankValue ? (
            <SetupSelect value={bankAccount || bankValue} onChange={(e) => setBankAccount(e.target.value)}>
              <option value={bankValue}>{employee ? bankOptionLabel(employee) : bankValue}</option>
            </SetupSelect>
          ) : (
            <SetupSelect value="" disabled>
              <option value="">
                {employeeKey ? "No bank account on employee profile" : "Select an employee first"}
              </option>
            </SetupSelect>
          )}
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
      title="Add Incentive"
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
          Save Incentive
        </Button>
      }
    >
      <div className="space-y-3">
        <EmployeeSelect value={employeeKey} options={employees} required onChange={setEmployeeKey} />
        <SetupField label="Incentive type">
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
