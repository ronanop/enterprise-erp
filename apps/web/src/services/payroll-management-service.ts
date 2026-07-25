/**
 * Enterprise Payroll Management service — local rich store + payroll API merge.
 */

import { formatInr, loadPayrollOverview } from "@/services/payroll-service";
import type {
  BonusRecord,
  EmployeeSalary,
  LoanRecord,
  MonthLock,
  PayrollAudit,
  PayrollFilters,
  PayrollRun,
  PayrollRunStatus,
  PayslipRecord,
  ReimbursementRecord,
  SalaryRevision,
  SalaryStructure,
} from "@/types/payroll-management";
import {
  monthLabel,
  structureDeductions,
  structureGross,
} from "@/types/payroll-management";

const K = {
  structures: "erp_pay_structures_v1",
  salaries: "erp_pay_salaries_v1",
  runs: "erp_pay_runs_v1",
  locks: "erp_pay_locks_v1",
  revisions: "erp_pay_revisions_v1",
  bonuses: "erp_pay_bonuses_v1",
  reimbursements: "erp_pay_reimb_v1",
  loans: "erp_pay_loans_v1",
  payslips: "erp_pay_payslips_v1",
  audit: "erp_pay_audit_v1",
  seq: "erp_pay_seq_v1",
} as const;

type Seq = { run: number; slip: number };

function actor(): string {
  if (typeof window === "undefined") return "Payroll Executive";
  try {
    const raw = localStorage.getItem("erp_user_profile");
    if (raw) {
      const p = JSON.parse(raw) as { email?: string; full_name?: string };
      return p.full_name || p.email || "Payroll Executive";
    }
  } catch {
    /* ignore */
  }
  return "Payroll Executive";
}

function nowIso(): string {
  return new Date().toISOString();
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

function nextCode(kind: keyof Seq, prefix: string): string {
  const seq = readJson<Seq>(K.seq, { run: 0, slip: 0 });
  seq[kind] += 1;
  writeJson(K.seq, seq);
  return `${prefix}-${String(seq[kind]).padStart(6, "0")}`;
}

export function appendPayrollAudit(entry: Omit<PayrollAudit, "id" | "at">): void {
  const all = readJson<PayrollAudit[]>(K.audit, []);
  all.unshift({ ...entry, id: crypto.randomUUID(), at: nowIso() });
  writeJson(K.audit, all.slice(0, 5000));
}

export function listPayrollAudit(): PayrollAudit[] {
  return readJson<PayrollAudit[]>(K.audit, []);
}

function load<T>(key: string): T[] {
  return readJson<T[]>(key, []);
}
function save<T>(key: string, rows: T[]) {
  writeJson(key, rows);
}

export { formatInr };

export type PayrollDirectory = {
  structures: SalaryStructure[];
  salaries: EmployeeSalary[];
  runs: PayrollRun[];
  locks: MonthLock[];
  revisions: SalaryRevision[];
  bonuses: BonusRecord[];
  reimbursements: ReimbursementRecord[];
  loans: LoanRecord[];
  payslips: PayslipRecord[];
};

export function isMonthLocked(month: string): boolean {
  return load<MonthLock>(K.locks).some((l) => l.month === month && l.status === "locked");
}

export async function loadPayrollDirectory(): Promise<PayrollDirectory> {
  let structures = load<SalaryStructure>(K.structures);
  let salaries = load<EmployeeSalary>(K.salaries);
  let runs = load<PayrollRun>(K.runs);
  let payslips = load<PayslipRecord>(K.payslips);
  let bonuses = load<BonusRecord>(K.bonuses);
  let reimbursements = load<ReimbursementRecord>(K.reimbursements);
  let loans = load<LoanRecord>(K.loans);

  try {
    const overview = await loadPayrollOverview();

    if (structures.length === 0 && overview.structures.length) {
      structures = overview.structures.map((s, i) => ({
        id: String(s.id ?? crypto.randomUUID()),
        name: String(s.structure_name ?? s.name ?? `Structure ${i + 1}`),
        basic: Number(s.basic ?? 30000),
        hra: Number(s.hra ?? 12000),
        specialAllowance: Number(s.special_allowance ?? 5000),
        medicalAllowance: Number(s.medical_allowance ?? 1250),
        travelAllowance: Number(s.travel_allowance ?? 1600),
        foodAllowance: Number(s.food_allowance ?? 0),
        internetAllowance: Number(s.internet_allowance ?? 0),
        bonus: Number(s.bonus ?? 0),
        incentives: Number(s.incentives ?? 0),
        overtime: Number(s.overtime ?? 0),
        arrears: Number(s.arrears ?? 0),
        reimbursement: Number(s.reimbursement ?? 0),
        otherEarnings: Number(s.other_earnings ?? 0),
        pf: Number(s.pf ?? 1800),
        esi: Number(s.esi ?? 0),
        professionalTax: Number(s.professional_tax ?? 200),
        tds: Number(s.tds ?? 0),
        loanRecovery: Number(s.loan_recovery ?? 0),
        advanceRecovery: Number(s.advance_recovery ?? 0),
        insurance: Number(s.insurance ?? 0),
        otherDeductions: Number(s.other_deductions ?? 0),
        createdAt: nowIso(),
      }));
      save(K.structures, structures);
    }

    if (salaries.length === 0 && overview.employeeSalaries.length) {
      salaries = overview.employeeSalaries.map((e, i) => ({
        id: String(e.id ?? crypto.randomUUID()),
        employeeId: String(e.employee_code ?? e.employee_id ?? `EMP-${i + 1}`),
        employeeName: String(e.employee_name ?? e.full_name ?? `Employee ${i + 1}`),
        structureId: String(e.salary_structure_id ?? structures[0]?.id ?? ""),
        structureName: String(e.structure_name ?? structures[0]?.name ?? "Default"),
        effectiveDate: String(e.effective_from ?? e.effective_date ?? "").slice(0, 10),
        monthlyCtc: Number(e.monthly_ctc ?? e.ctc ?? 50000),
        annualCtc: Number(e.annual_ctc ?? (Number(e.monthly_ctc ?? 50000) * 12)),
        payrollGroup: String(e.payroll_group ?? "General"),
        bankAccount: String(e.bank_account ?? "XXXX1234"),
        taxRegime: String(e.tax_regime ?? "new").includes("old") ? "old" : "new",
        salaryStatus: "active",
        department: String(e.department_name ?? "—"),
      }));
      save(K.salaries, salaries);
    }

    // Seed salaries from Workforce master when payroll salary list is still empty
    if (salaries.length === 0) {
      try {
        const { loadHrMasterDirectory } = await import("@/services/hr-master-connector");
        const master = await loadHrMasterDirectory();
        if (master.employees.length && structures[0]) {
          salaries = master.employees.slice(0, 50).map((e) => ({
            id: crypto.randomUUID(),
            employeeId: e.code || e.id,
            employeeName: e.label.split(" · ")[0],
            structureId: structures[0].id,
            structureName: structures[0].name,
            effectiveDate: nowIso().slice(0, 10),
            monthlyCtc: e.monthlyCtc || structureGross(structures[0]),
            annualCtc: (e.monthlyCtc || structureGross(structures[0])) * 12,
            payrollGroup: "General",
            bankAccount: e.bankAccount || "XXXX",
            taxRegime: "new" as const,
            salaryStatus: "active" as const,
            department: e.department || "General",
          }));
          save(K.salaries, salaries);
        }
      } catch {
        /* ignore */
      }
    }

    if (runs.length === 0 && overview.runs.length) {
      runs = overview.runs.map((r, i) => {
        const month = String(r.period_code ?? r.payroll_month ?? `2026-${String((i % 12) + 1).padStart(2, "0")}`);
        return {
          id: String(r.id ?? crypto.randomUUID()),
          runCode: String(r.document_number ?? `PAY-${String(i + 1).padStart(6, "0")}`),
          month: month.slice(0, 7),
          monthLabel: monthLabel(month.slice(0, 7)),
          employeeCount: Number(r.employee_count ?? 0),
          grossTotal: Number(r.gross_amount ?? r.gross_total ?? 0),
          deductionTotal: Number(r.deduction_amount ?? 0),
          netTotal: Number(r.net_amount ?? r.net_total ?? 0),
          status: "approved" as PayrollRunStatus,
          attendanceSynced: true,
          leaveSynced: true,
          otSynced: true,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
      });
      save(K.runs, runs);
    }

    if (bonuses.length === 0 && overview.bonuses.length) {
      bonuses = overview.bonuses.map((b) => ({
        id: String(b.id ?? crypto.randomUUID()),
        employeeName: String(b.employee_name ?? "Employee"),
        bonusType: "performance",
        amount: Number(b.amount ?? 0),
        month: String(b.month ?? "").slice(0, 7) || "2026-07",
        createdAt: nowIso(),
      }));
      save(K.bonuses, bonuses);
    }

    if (reimbursements.length === 0 && overview.reimbursements.length) {
      reimbursements = overview.reimbursements.map((r) => ({
        id: String(r.id ?? crypto.randomUUID()),
        employeeName: String(r.employee_name ?? "Employee"),
        reimbType: "travel",
        amount: Number(r.amount ?? 0),
        status: "pending",
        createdAt: nowIso(),
      }));
      save(K.reimbursements, reimbursements);
    }

    if (loans.length === 0 && overview.loans.length) {
      loans = overview.loans.map((l) => ({
        id: String(l.id ?? crypto.randomUUID()),
        employeeName: String(l.employee_name ?? "Employee"),
        loanAmount: Number(l.loan_amount ?? l.amount ?? 0),
        installments: Number(l.installments ?? 12),
        remainingBalance: Number(l.remaining_balance ?? l.loan_amount ?? 0),
        recoveryPerMonth: Number(l.emi ?? 0),
        createdAt: nowIso(),
      }));
      save(K.loans, loans);
    }

    if (payslips.length === 0 && overview.payslips.length) {
      payslips = overview.payslips.map((p, i) => ({
        id: String(p.id ?? crypto.randomUUID()),
        payslipCode: String(p.document_number ?? `PSL-${String(i + 1).padStart(6, "0")}`),
        runId: String(p.payroll_run_id ?? ""),
        employeeId: String(p.employee_id ?? ""),
        employeeName: String(p.employee_name ?? "Employee"),
        month: String(p.month ?? "2026-07").slice(0, 7),
        monthLabel: monthLabel(String(p.month ?? "2026-07").slice(0, 7)),
        department: "—",
        bankAccount: "XXXX",
        presentDays: 22,
        leaveDays: 0,
        earnings: [{ label: "Gross", amount: Number(p.gross_earnings ?? 0) }],
        deductions: [{ label: "Deductions", amount: Number(p.total_deductions ?? 0) }],
        gross: Number(p.gross_earnings ?? 0),
        totalDeductions: Number(p.total_deductions ?? 0),
        net: Number(p.net_pay ?? 0),
        taxRegime: "new",
        generatedAt: nowIso(),
      }));
      save(K.payslips, payslips);
    }
  } catch {
    /* offline */
  }

  // Seed a default structure if still empty
  if (load<SalaryStructure>(K.structures).length === 0) {
    const def: SalaryStructure = {
      id: crypto.randomUUID(),
      name: "Standard CTC",
      basic: 30000,
      hra: 12000,
      specialAllowance: 8000,
      medicalAllowance: 1250,
      travelAllowance: 1600,
      foodAllowance: 0,
      internetAllowance: 500,
      bonus: 0,
      incentives: 0,
      overtime: 0,
      arrears: 0,
      reimbursement: 0,
      otherEarnings: 0,
      pf: 1800,
      esi: 0,
      professionalTax: 200,
      tds: 2500,
      loanRecovery: 0,
      advanceRecovery: 0,
      insurance: 300,
      otherDeductions: 0,
      createdAt: nowIso(),
    };
    save(K.structures, [def]);
  }

  return {
    structures: load(K.structures),
    salaries: load(K.salaries),
    runs: load(K.runs),
    locks: load(K.locks),
    revisions: load(K.revisions),
    bonuses: load(K.bonuses),
    reimbursements: load(K.reimbursements),
    loans: load(K.loans),
    payslips: load(K.payslips),
  };
}

export function computePayrollStats(dir: PayrollDirectory) {
  const locked = dir.locks.filter((l) => l.status === "locked").length;
  const pending = dir.runs.filter((r) =>
    ["draft", "processing", "pending_hr", "pending_finance"].includes(r.status),
  ).length;
  const processed = dir.runs.filter((r) =>
    ["approved", "paid", "locked"].includes(r.status),
  ).length;
  const netPaid = dir.runs
    .filter((r) => ["approved", "paid", "locked"].includes(r.status))
    .reduce((s, r) => s + r.netTotal, 0);
  const pendingApprovals = dir.runs.filter((r) =>
    ["pending_hr", "pending_finance"].includes(r.status),
  ).length;
  const upcomingRev = dir.revisions.filter((r) => r.effectiveDate >= nowIso().slice(0, 10)).length;

  return {
    totalEmployees: dir.salaries.filter((s) => s.salaryStatus === "active").length || dir.salaries.length,
    payrollProcessed: processed,
    pendingPayroll: pending,
    lockedMonths: locked,
    netSalaryPaid: netPaid,
    pendingApprovals,
    upcomingRevisions: upcomingRev,
  };
}

export function createStructure(
  input: Omit<SalaryStructure, "id" | "createdAt">,
): SalaryStructure {
  const row: SalaryStructure = { ...input, id: crypto.randomUUID(), createdAt: nowIso() };
  const all = load<SalaryStructure>(K.structures);
  all.unshift(row);
  save(K.structures, all);
  appendPayrollAudit({ action: "structure_created", detail: row.name, actor: actor() });
  return row;
}

export function assignEmployeeSalary(
  input: Omit<EmployeeSalary, "id">,
): EmployeeSalary {
  const row: EmployeeSalary = { ...input, id: crypto.randomUUID() };
  const all = load<EmployeeSalary>(K.salaries);
  all.unshift(row);
  save(K.salaries, all);
  appendPayrollAudit({
    action: "salary_assigned",
    detail: `${row.employeeName} → ${row.structureName}`,
    actor: actor(),
  });
  return row;
}

export function runPayroll(month: string): PayrollRun {
  if (isMonthLocked(month)) {
    throw new Error(`Payroll month ${monthLabel(month)} is locked and cannot be processed.`);
  }
  const salaries = load<EmployeeSalary>(K.salaries).filter((s) => s.salaryStatus === "active");
  const structures = load<SalaryStructure>(K.structures);
  const structureMap = new Map(structures.map((s) => [s.id, s]));

  let gross = 0;
  let ded = 0;
  const employees = salaries.length ? salaries : [
    {
      id: "demo",
      employeeId: "EMP-000001",
      employeeName: "Demo Employee",
      structureId: structures[0]?.id ?? "",
      structureName: structures[0]?.name ?? "Standard",
      monthlyCtc: structureGross(structures[0] ?? emptyStructure()),
      annualCtc: 0,
      payrollGroup: "General",
      bankAccount: "XXXX1234",
      taxRegime: "new" as const,
      salaryStatus: "active" as const,
      department: "General",
      effectiveDate: nowIso().slice(0, 10),
    },
  ];

  for (const sal of employees) {
    const st = structureMap.get(sal.structureId) ?? structures[0];
    if (st) {
      gross += structureGross(st);
      ded += structureDeductions(st);
    } else {
      gross += sal.monthlyCtc;
      ded += Math.round(sal.monthlyCtc * 0.12);
    }
  }

  const row: PayrollRun = {
    id: crypto.randomUUID(),
    runCode: nextCode("run", "PAY"),
    month,
    monthLabel: monthLabel(month),
    employeeCount: employees.length,
    grossTotal: gross,
    deductionTotal: ded,
    netTotal: Math.max(0, gross - ded),
    status: "pending_hr",
    attendanceSynced: Boolean(
      readJson<unknown[]>("erp_attendance_audit_v1", []).length ||
        readJson<unknown[]>("erp_shift_roster_assignments_cache_v1", []).length,
    ),
    leaveSynced: Boolean(readJson<unknown[]>("erp_leave_audit_v1", []).length),
    otSynced: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  const all = load<PayrollRun>(K.runs);
  all.unshift(row);
  save(K.runs, all);
  appendPayrollAudit({
    action: "payroll_generated",
    detail: `${row.runCode} for ${row.monthLabel} · net ${formatInr(row.netTotal)}`,
    actor: actor(),
  });
  return row;
}

function emptyStructure(): SalaryStructure {
  return {
    id: "",
    name: "",
    basic: 0,
    hra: 0,
    specialAllowance: 0,
    medicalAllowance: 0,
    travelAllowance: 0,
    foodAllowance: 0,
    internetAllowance: 0,
    bonus: 0,
    incentives: 0,
    overtime: 0,
    arrears: 0,
    reimbursement: 0,
    otherEarnings: 0,
    pf: 0,
    esi: 0,
    professionalTax: 0,
    tds: 0,
    loanRecovery: 0,
    advanceRecovery: 0,
    insurance: 0,
    otherDeductions: 0,
    createdAt: "",
  };
}

export function advancePayrollApproval(runId: string): PayrollRun | null {
  const flow: PayrollRunStatus[] = ["pending_hr", "pending_finance", "approved", "paid"];
  const all = load<PayrollRun>(K.runs);
  const idx = all.findIndex((r) => r.id === runId);
  if (idx < 0) return null;
  if (isMonthLocked(all[idx].month) && all[idx].status !== "locked") {
    throw new Error("Month is locked");
  }
  const cur = all[idx].status;
  const i = flow.indexOf(cur);
  if (i < 0) {
    if (cur === "draft" || cur === "processing") {
      all[idx] = { ...all[idx], status: "pending_hr", updatedAt: nowIso() };
    } else return all[idx];
  } else if (i < flow.length - 1) {
    all[idx] = {
      ...all[idx],
      status: flow[i + 1],
      updatedAt: nowIso(),
      approvedBy: actor(),
    };
  }
  save(K.runs, all);
  appendPayrollAudit({
    action: "payroll_approval",
    detail: `${all[idx].runCode} → ${all[idx].status}`,
    actor: actor(),
  });
  return all[idx];
}

export function lockPayrollMonth(month: string, reason: string): MonthLock {
  const existing = load<MonthLock>(K.locks).find((l) => l.month === month && l.status === "locked");
  if (existing) return existing;
  const row: MonthLock = {
    id: crypto.randomUUID(),
    month,
    monthLabel: monthLabel(month),
    reason,
    approvedBy: actor(),
    lockedAt: nowIso(),
    status: "locked",
  };
  const all = load<MonthLock>(K.locks);
  all.unshift(row);
  save(K.locks, all);

  // Mark runs as locked
  const runs = load<PayrollRun>(K.runs).map((r) =>
    r.month === month ? { ...r, status: "locked" as const, updatedAt: nowIso() } : r,
  );
  save(K.runs, runs);

  appendPayrollAudit({
    action: "month_locked",
    detail: `${row.monthLabel}: ${reason}`,
    actor: actor(),
  });
  return row;
}

export function unlockPayrollMonth(month: string, reason: string): MonthLock | null {
  if (!reason.trim()) throw new Error("Unlock reason is mandatory");
  const all = load<MonthLock>(K.locks);
  const idx = all.findIndex((l) => l.month === month && l.status === "locked");
  if (idx < 0) return null;
  all[idx] = {
    ...all[idx],
    status: "unlocked",
    unlockReason: reason,
    unlockedAt: nowIso(),
    unlockedBy: actor(),
  };
  save(K.locks, all);
  appendPayrollAudit({
    action: "month_unlocked",
    detail: `${monthLabel(month)}: ${reason}`,
    actor: actor(),
  });
  return all[idx];
}

export function createRevision(
  input: Omit<SalaryRevision, "id" | "createdAt">,
): SalaryRevision {
  const month = input.effectiveDate.slice(0, 7);
  if (isMonthLocked(month)) {
    throw new Error("Cannot revise salary for a locked payroll month");
  }
  const row: SalaryRevision = { ...input, id: crypto.randomUUID(), createdAt: nowIso() };
  const all = load<SalaryRevision>(K.revisions);
  all.unshift(row);
  save(K.revisions, all);

  const salaries = load<EmployeeSalary>(K.salaries);
  const sIdx = salaries.findIndex(
    (s) => s.employeeId === input.employeeId || s.employeeName === input.employeeName,
  );
  if (sIdx >= 0) {
    salaries[sIdx] = {
      ...salaries[sIdx],
      monthlyCtc: input.newSalary,
      annualCtc: input.newSalary * 12,
      effectiveDate: input.effectiveDate,
    };
    save(K.salaries, salaries);
  }

  appendPayrollAudit({
    action: "salary_revised",
    detail: `${input.employeeName}: ${formatInr(input.oldSalary)} → ${formatInr(input.newSalary)} (${input.reason})`,
    actor: actor(),
  });
  return row;
}

export function addBonus(input: Omit<BonusRecord, "id" | "createdAt">): BonusRecord {
  const row: BonusRecord = { ...input, id: crypto.randomUUID(), createdAt: nowIso() };
  const all = load<BonusRecord>(K.bonuses);
  all.unshift(row);
  save(K.bonuses, all);
  return row;
}

export function addReimbursement(
  input: Omit<ReimbursementRecord, "id" | "createdAt">,
): ReimbursementRecord {
  const row: ReimbursementRecord = { ...input, id: crypto.randomUUID(), createdAt: nowIso() };
  const all = load<ReimbursementRecord>(K.reimbursements);
  all.unshift(row);
  save(K.reimbursements, all);
  return row;
}

export function approveReimbursement(id: string, status: ReimbursementRecord["status"]) {
  const all = load<ReimbursementRecord>(K.reimbursements);
  const idx = all.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  all[idx] = { ...all[idx], status };
  save(K.reimbursements, all);
  return all[idx];
}

export function addLoan(input: Omit<LoanRecord, "id" | "createdAt">): LoanRecord {
  const row: LoanRecord = { ...input, id: crypto.randomUUID(), createdAt: nowIso() };
  const all = load<LoanRecord>(K.loans);
  all.unshift(row);
  save(K.loans, all);
  return row;
}

export function generatePayslips(runId: string): PayslipRecord[] {
  const runs = load<PayrollRun>(K.runs);
  const run = runs.find((r) => r.id === runId);
  if (!run) throw new Error("Payroll run not found");

  const salaries = load<EmployeeSalary>(K.salaries);
  const structures = load<SalaryStructure>(K.structures);
  const structureMap = new Map(structures.map((s) => [s.id, s]));
  const employees = salaries.length
    ? salaries.filter((s) => s.salaryStatus === "active")
    : [
        {
          id: "demo",
          employeeId: "EMP-000001",
          employeeName: "Demo Employee",
          structureId: structures[0]?.id ?? "",
          structureName: structures[0]?.name ?? "Standard",
          monthlyCtc: 50000,
          annualCtc: 600000,
          payrollGroup: "General",
          bankAccount: "XXXX1234",
          taxRegime: "new" as const,
          salaryStatus: "active" as const,
          department: "General",
          effectiveDate: nowIso().slice(0, 10),
        },
      ];

  const slips: PayslipRecord[] = employees.map((sal) => {
    const st = structureMap.get(sal.structureId) ?? structures[0];
    const earnings = st
      ? [
          { label: "Basic", amount: st.basic },
          { label: "HRA", amount: st.hra },
          { label: "Special Allowance", amount: st.specialAllowance },
          { label: "Medical", amount: st.medicalAllowance },
          { label: "Travel", amount: st.travelAllowance },
          { label: "Internet", amount: st.internetAllowance },
          { label: "Other Earnings", amount: st.otherEarnings + st.bonus + st.incentives + st.overtime + st.arrears + st.reimbursement + st.foodAllowance },
        ].filter((e) => e.amount > 0)
      : [{ label: "CTC / Gross", amount: sal.monthlyCtc }];
    const deductions = st
      ? [
          { label: "PF", amount: st.pf },
          { label: "ESI", amount: st.esi },
          { label: "Professional Tax", amount: st.professionalTax },
          { label: "TDS", amount: st.tds },
          { label: "Loan Recovery", amount: st.loanRecovery },
          { label: "Advance Recovery", amount: st.advanceRecovery },
          { label: "Insurance", amount: st.insurance },
          { label: "Other Deductions", amount: st.otherDeductions },
        ].filter((d) => d.amount > 0)
      : [{ label: "Statutory", amount: Math.round(sal.monthlyCtc * 0.12) }];
    const gross = earnings.reduce((s, e) => s + e.amount, 0);
    const totalDeductions = deductions.reduce((s, d) => s + d.amount, 0);
    return {
      id: crypto.randomUUID(),
      payslipCode: nextCode("slip", "PSL"),
      runId,
      employeeId: sal.employeeId,
      employeeName: sal.employeeName,
      month: run.month,
      monthLabel: run.monthLabel,
      department: sal.department,
      bankAccount: sal.bankAccount,
      presentDays: 22,
      leaveDays: 1,
      earnings,
      deductions,
      gross,
      totalDeductions,
      net: Math.max(0, gross - totalDeductions),
      taxRegime: sal.taxRegime,
      generatedAt: nowIso(),
    };
  });

  const all = load<PayslipRecord>(K.payslips);
  save(K.payslips, [...slips, ...all]);
  appendPayrollAudit({
    action: "payslips_generated",
    detail: `${slips.length} payslips for ${run.monthLabel}`,
    actor: actor(),
  });
  return slips;
}

export function exportPayslipText(slip: PayslipRecord): string {
  const lines = [
    "========================================",
    "           EMPLOYEE PAYSLIP",
    "========================================",
    `Payslip: ${slip.payslipCode}`,
    `Period:  ${slip.monthLabel}`,
    `Employee: ${slip.employeeName} (${slip.employeeId})`,
    `Department: ${slip.department}`,
    `Bank: ${slip.bankAccount}`,
    `Attendance: Present ${slip.presentDays} · Leave ${slip.leaveDays}`,
    `Tax Regime: ${slip.taxRegime}`,
    "----------------------------------------",
    "EARNINGS",
    ...slip.earnings.map((e) => `  ${e.label.padEnd(24)} ${formatInr(e.amount)}`),
    `  ${"Gross".padEnd(24)} ${formatInr(slip.gross)}`,
    "----------------------------------------",
    "DEDUCTIONS",
    ...slip.deductions.map((d) => `  ${d.label.padEnd(24)} ${formatInr(d.amount)}`),
    `  ${"Total Deductions".padEnd(24)} ${formatInr(slip.totalDeductions)}`,
    "----------------------------------------",
    `NET SALARY                ${formatInr(slip.net)}`,
    "----------------------------------------",
    "Digital Signature: ________________",
    `Generated: ${new Date(slip.generatedAt).toLocaleString()}`,
    "========================================",
  ];
  return lines.join("\n");
}

export function downloadTextFile(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  appendPayrollAudit({
    action: "payslip_downloaded",
    detail: filename,
    actor: actor(),
  });
}

export function exportRunsCsv(runs: PayrollRun[]): string {
  const h = ["Run", "Month", "Employees", "Gross", "Deductions", "Net", "Status"];
  const lines = runs.map((r) =>
    [r.runCode, r.monthLabel, r.employeeCount, r.grossTotal, r.deductionTotal, r.netTotal, r.status]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [h.join(","), ...lines].join("\n");
}

export function filterRuns(runs: PayrollRun[], f: PayrollFilters) {
  const q = f.query.trim().toLowerCase();
  return runs.filter((r) => {
    if (f.status !== "all" && r.status !== f.status) return false;
    if (f.month !== "all" && r.month !== f.month) return false;
    if (!q) return true;
    return [r.runCode, r.monthLabel, r.status].join(" ").toLowerCase().includes(q);
  });
}

export function importStructuresCsv(text: string): number {
  const lines = text.trim().split(/\r?\n/).slice(1);
  let n = 0;
  for (const line of lines) {
    const [name, basic] = line.split(",").map((c) => c.replace(/^"|"$/g, "").trim());
    if (!name) continue;
    createStructure({
      name,
      basic: Number(basic) || 30000,
      hra: Math.round((Number(basic) || 30000) * 0.4),
      specialAllowance: 5000,
      medicalAllowance: 1250,
      travelAllowance: 1600,
      foodAllowance: 0,
      internetAllowance: 500,
      bonus: 0,
      incentives: 0,
      overtime: 0,
      arrears: 0,
      reimbursement: 0,
      otherEarnings: 0,
      pf: 1800,
      esi: 0,
      professionalTax: 200,
      tds: 0,
      loanRecovery: 0,
      advanceRecovery: 0,
      insurance: 0,
      otherDeductions: 0,
    });
    n += 1;
  }
  return n;
}
