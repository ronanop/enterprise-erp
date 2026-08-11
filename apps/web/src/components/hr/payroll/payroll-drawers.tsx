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
  onSubmit: (month: string) => void;
}) {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [month, setMonth] = useState(defaultMonth);

  const options = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return { value: ym, label: monthLabel(ym) };
  });

  return (
    <SetupDrawer
      open={open}
      onClose={onClose}
      title="Run Payroll"
      description="Syncs attendance, leave, OT, bonuses, reimbursements, and loans for the month."
      footer={
        <Button
          type="button"
          className="cursor-pointer"
          onClick={() => {
            onSubmit(month);
            onClose();
          }}
        >
          Run Payroll
        </Button>
      }
    >
      <SetupField label="Payroll month">
        <SetupSelect value={month} onChange={(e) => setMonth(e.target.value)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </SetupSelect>
      </SetupField>
      <ul className="mt-3 space-y-1 text-[11px] text-muted-foreground">
        <li>· Attendance & late deductions</li>
        <li>· Leave & holidays</li>
        <li>· Overtime, bonuses, reimbursements</li>
        <li>· Loan / advance recovery</li>
      </ul>
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
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  structures: SalaryStructure[];
  employees: HrMasterOption[];
  onSubmit: (input: Omit<EmployeeSalary, "id">) => void;
}) {
  const [employeeKey, setEmployeeKey] = useState("");
  const [structureId, setStructureId] = useState(structures[0]?.id ?? "");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [monthlyCtc, setMonthlyCtc] = useState("50000");
  const [payrollGroup, setPayrollGroup] = useState("General");
  const [bankAccount, setBankAccount] = useState("");
  const [taxRegime, setTaxRegime] = useState<TaxRegime>("new");

  const structure = structures.find((s) => s.id === structureId);
  const employee = (employees ?? []).find((e) => e.id === employeeKey);

  useEffect(() => {
    if (!open) return;
    if (structures[0] && !structureId) setStructureId(structures[0].id);
  }, [open, structures, structureId]);

  useEffect(() => {
    if (!employee) return;
    if (employee.monthlyCtc) setMonthlyCtc(String(employee.monthlyCtc));
    if (employee.bankAccount) setBankAccount(employee.bankAccount);
  }, [employee]);

  return (
    <SetupDrawer
      open={open}
      onClose={onClose}
      wide
      title="Assign Employee Salary"
      description="Pick an employee from Workforce. Structure comes from Payroll masters."
      footer={
        <Button
          type="button"
          className="cursor-pointer"
          disabled={!employee || !structureId}
          onClick={() => {
            if (!employee) return;
            onSubmit({
              employeeId: employee.code || employee.id,
              employeeName: employee.label.split(" · ")[0],
              structureId,
              structureName: structure?.name ?? "",
              effectiveDate,
              monthlyCtc: Number(monthlyCtc) || 0,
              annualCtc: (Number(monthlyCtc) || 0) * 12,
              payrollGroup,
              bankAccount: bankAccount || employee.bankAccount || "",
              taxRegime,
              salaryStatus: "active",
              department: employee.department || "General",
            });
            onClose();
          }}
        >
          Assign
        </Button>
      }
    >
      <div className="space-y-3">
        <EmployeeSelect
          value={employeeKey}
          options={employees}
          required
          onChange={setEmployeeKey}
        />
        {employee ? (
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
