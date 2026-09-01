/**
 * Enterprise Payroll Management service — local rich store + payroll API merge.
 */

import { formatInr, loadPayrollOverview } from "@/services/payroll-service";
import { apiClient, resourceService } from "@/services/api-client";
import type {
  BonusRecord,
  EmployeeSalary,
  LoanRecord,
  MonthLock,
  PayrollAdjustmentRecord,
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
  CACHE_DIGITECH_STRUCTURES,
  monthLabel,
  structureDeductions,
  structureGross,
  type PayrollEmployeeAttendance,
  type SalaryStructureTemplate,
} from "@/types/payroll-management";
import { buildPayrollCycle, readPayrollCutoverDay } from "@/lib/payroll-cycle";
import { summarizePayrollAttendance } from "@/lib/payroll-attendance-cycle";
import type { PayrollCycle } from "@/lib/payroll-cycle";
import { devError, devWarn } from "@/lib/dev-log";

const PAY_CTX_KEY = "erp_pay_api_context_v1";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function employeeSalaryKey(employeeId: string): string {
  return String(employeeId ?? "")
    .trim()
    .toLowerCase();
}

/** Keep one salary row per employee (last occurrence wins). */
export function dedupeEmployeeSalaries(rows: EmployeeSalary[]): EmployeeSalary[] {
  const seen = new Map<string, EmployeeSalary>();
  for (const row of rows) {
    const key = employeeSalaryKey(row.employeeId);
    if (!key) continue;
    seen.set(key, row);
  }
  return [...seen.values()];
}

const K = {
  structures: "erp_pay_structures_v1",
  salaries: "erp_pay_salaries_v1",
  runs: "erp_pay_runs_v1",
  locks: "erp_pay_locks_v1",
  revisions: "erp_pay_revisions_v1",
  bonuses: "erp_pay_bonuses_v1",
  adjustments: "erp_pay_adjustments_v1",
  reimbursements: "erp_pay_reimb_v1",
  loans: "erp_pay_loans_v1",
  payslips: "erp_pay_payslips_v1",
  audit: "erp_pay_audit_v1",
  seq: "erp_pay_seq_v1",
  runAttendance: "erp_pay_run_attendance_v1",
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

function saveRunAttendance(runId: string, lines: PayrollEmployeeAttendance[]): void {
  const map = readJson<Record<string, PayrollEmployeeAttendance[]>>(K.runAttendance, {});
  map[runId] = lines;
  writeJson(K.runAttendance, map);
}

export function getPayrollRunAttendance(runId: string): PayrollEmployeeAttendance[] {
  const map = readJson<Record<string, PayrollEmployeeAttendance[]>>(K.runAttendance, {});
  return map[runId] ?? [];
}

function normalizePayrollRun(row: PayrollRun): PayrollRun {
  if (row.cycleStart && row.cycleEnd && row.cycleLabel) return row;
  const cycle = buildPayrollCycle(row.month, row.cycleCutoverDay ?? readPayrollCutoverDay());
  return {
    ...row,
    cycleStart: cycle.start,
    cycleEnd: cycle.end,
    cycleCutoverDay: cycle.cutoverDay,
    cycleLabel: cycle.label,
  };
}

async function buildAttendanceLinesForCycle(
  cycle: PayrollCycle,
): Promise<PayrollEmployeeAttendance[]> {
  const salaries = load<EmployeeSalary>(K.salaries).filter((s) => s.salaryStatus === "active");
  if (!salaries.length) return [];

  const [{ loadAttendanceDirectory }, { loadLeaveDirectory }, master] = await Promise.all([
    import("@/services/attendance-management-service"),
    import("@/services/leave-management-service"),
    import("@/services/hr-master-connector").then((m) =>
      m.loadHrMasterDirectory().catch(() => null),
    ),
  ]);

  const [attDir, leaveDir] = await Promise.all([
    loadAttendanceDirectory().catch(() => ({ records: [], options: { employees: [] } })),
    loadLeaveDirectory().catch(() => ({ requests: [] })),
  ]);

  const hrIdByCode = new Map<string, string>();
  for (const e of master?.employees ?? []) {
    if (e.code) hrIdByCode.set(e.code.toLowerCase(), e.id);
    hrIdByCode.set(e.id.toLowerCase(), e.id);
  }

  const refs = salaries.map((sal) => ({
    employeeId: sal.employeeId,
    employeeName: sal.employeeName,
    employeeCode: sal.employeeId,
    department: sal.department,
    hrEmployeeId:
      hrIdByCode.get(sal.employeeId.toLowerCase()) ??
      (UUID_RE.test(sal.employeeId) ? sal.employeeId : undefined),
  }));

  return summarizePayrollAttendance(
    cycle,
    refs,
    attDir.records,
    leaveDir.requests ?? [],
  );
}

export async function previewPayrollAttendanceForCycle(
  anchorMonth: string,
  cutoverDay?: number,
): Promise<{ cycle: PayrollCycle; lines: PayrollEmployeeAttendance[] }> {
  const cycle = buildPayrollCycle(anchorMonth, cutoverDay ?? readPayrollCutoverDay());
  const lines = await buildAttendanceLinesForCycle(cycle);
  return { cycle, lines };
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
  adjustments: PayrollAdjustmentRecord[];
  reimbursements: ReimbursementRecord[];
  loans: LoanRecord[];
  payslips: PayslipRecord[];
};

export function isMonthLocked(month: string): boolean {
  return load<MonthLock>(K.locks).some((l) => l.month === month && l.status === "locked");
}

function buildDefaultStructures(): SalaryStructure[] {
  const ts = nowIso();
  return CACHE_DIGITECH_STRUCTURES.map((t) => ({
    ...t,
    id: crypto.randomUUID(),
    createdAt: ts,
  }));
}

function templateFor(name: string, code?: string, index = 0): SalaryStructureTemplate {
  const byCode = code
    ? CACHE_DIGITECH_STRUCTURES.find((t) => t.code?.toLowerCase() === code.toLowerCase())
    : undefined;
  if (byCode) return byCode;
  const byName = CACHE_DIGITECH_STRUCTURES.find(
    (t) => t.name.toLowerCase() === name.toLowerCase(),
  );
  if (byName) return byName;
  // Legacy "Standard CTC" / unknown → Engineer band (middle)
  if (/standard/i.test(name)) {
    return CACHE_DIGITECH_STRUCTURES[2];
  }
  return CACHE_DIGITECH_STRUCTURES[Math.min(index, CACHE_DIGITECH_STRUCTURES.length - 1)];
}

function mapApiStructure(
  s: Record<string, unknown>,
  i: number,
  previous?: SalaryStructure[],
): SalaryStructure {
  const id = String(s.id ?? crypto.randomUUID());
  const name = String(s.structure_name ?? s.name ?? `Structure ${i + 1}`);
  const code = String(s.structure_code ?? s.code ?? "");
  const prev = previous?.find((p) => p.id === id || p.name === name);
  const tpl = templateFor(name, code || undefined, i);
  const base = prev ?? tpl;
  const hasApiAmounts =
    s.basic != null || s.hra != null || s.special_allowance != null || s.pf != null;
  return {
    id,
    code: code || base.code || tpl.code,
    name,
    basic: Number(hasApiAmounts ? (s.basic ?? base.basic) : base.basic),
    hra: Number(hasApiAmounts ? (s.hra ?? base.hra) : base.hra),
    specialAllowance: Number(
      hasApiAmounts ? (s.special_allowance ?? base.specialAllowance) : base.specialAllowance,
    ),
    medicalAllowance: Number(
      hasApiAmounts ? (s.medical_allowance ?? base.medicalAllowance) : base.medicalAllowance,
    ),
    travelAllowance: Number(
      hasApiAmounts ? (s.travel_allowance ?? base.travelAllowance) : base.travelAllowance,
    ),
    foodAllowance: Number(
      hasApiAmounts ? (s.food_allowance ?? base.foodAllowance) : base.foodAllowance,
    ),
    internetAllowance: Number(
      hasApiAmounts ? (s.internet_allowance ?? base.internetAllowance) : base.internetAllowance,
    ),
    bonus: Number(s.bonus ?? base.bonus),
    incentives: Number(s.incentives ?? base.incentives),
    overtime: Number(s.overtime ?? base.overtime),
    arrears: Number(s.arrears ?? base.arrears),
    reimbursement: Number(s.reimbursement ?? base.reimbursement),
    otherEarnings: Number(s.other_earnings ?? base.otherEarnings),
    pf: Number(hasApiAmounts ? (s.pf ?? base.pf) : base.pf),
    esi: Number(hasApiAmounts ? (s.esi ?? base.esi) : base.esi),
    professionalTax: Number(
      hasApiAmounts ? (s.professional_tax ?? base.professionalTax) : base.professionalTax,
    ),
    tds: Number(hasApiAmounts ? (s.tds ?? base.tds) : base.tds),
    loanRecovery: Number(s.loan_recovery ?? base.loanRecovery),
    advanceRecovery: Number(s.advance_recovery ?? base.advanceRecovery),
    insurance: Number(hasApiAmounts ? (s.insurance ?? base.insurance) : base.insurance),
    otherDeductions: Number(s.other_deductions ?? base.otherDeductions),
    createdAt: prev?.createdAt ?? nowIso(),
  };
}

/** Drop duplicate Standard CTC / identical-amount clones; keep graded catalog. */
function normalizeStructures(rows: SalaryStructure[]): SalaryStructure[] {
  const byName = new Map<string, SalaryStructure>();
  for (const row of rows) {
    const key = row.name.trim().toLowerCase();
    if (!byName.has(key)) byName.set(key, row);
  }
  let unique = [...byName.values()];

  const allIdenticalStandard =
    unique.length > 0 &&
    unique.every(
      (s) =>
        /standard/i.test(s.name) &&
        s.basic === 30000 &&
        s.hra === 12000,
    );

  if (allIdenticalStandard || unique.length === 0) {
    return buildDefaultStructures();
  }

  // Upgrade legacy single Standard CTC into full Cache Digitech set
  if (unique.length === 1 && /standard/i.test(unique[0].name)) {
    return buildDefaultStructures();
  }

  return unique;
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

    if (overview.structures.length) {
      const previous = structures;
      structures = overview.structures.map((s, i) =>
        mapApiStructure(s as Record<string, unknown>, i, previous),
      );
      structures = normalizeStructures(structures);
      // If API only had legacy Standard / SS-STD rows, prefer full catalog
      if (
        structures.length <= 2 &&
        structures.every((s) => /standard|ss-std/i.test(`${s.name} ${s.code ?? ""}`))
      ) {
        structures = buildDefaultStructures();
      }
      save(K.structures, structures);
    }

    if (overview.employeeSalaries.length) {
      salaries = dedupeEmployeeSalaries(
        overview.employeeSalaries.map((e, i) => {
          const monthly = Number(
            e.gross_amount ?? e.monthly_ctc ?? (e.ctc_amount != null ? Number(e.ctc_amount) / 12 : e.ctc) ?? 50000,
          );
          return {
            id: String(e.id ?? crypto.randomUUID()),
            employeeId: String(e.employee_code ?? e.employee_id ?? `EMP-${i + 1}`),
            employeeName: String(e.employee_name ?? e.full_name ?? `Employee ${i + 1}`),
            structureId: String(e.salary_structure_id ?? structures[0]?.id ?? ""),
            structureName: String(e.structure_name ?? structures[0]?.name ?? "Default"),
            effectiveDate: String(e.effective_from ?? e.effective_date ?? "").slice(0, 10),
            monthlyCtc: monthly,
            annualCtc: Number(e.annual_ctc ?? e.ctc_amount ?? monthly * 12),
            payrollGroup: String(e.payroll_group ?? "General"),
            bankAccount: String(e.bank_account ?? "XXXX1234"),
            taxRegime: String(e.tax_regime ?? "new").includes("old") ? ("old" as const) : ("new" as const),
            salaryStatus: "active" as const,
            department: String(e.department_name ?? "—"),
          };
        }),
      );
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

    if (overview.runs.length) {
      runs = overview.runs.map((r, i) => {
        const month = String(r.period_code ?? r.payroll_month ?? `2026-${String((i % 12) + 1).padStart(2, "0")}`);
        const ym = month.slice(0, 7);
        const start = String(r.start_date ?? "").slice(0, 10);
        const end = String(r.end_date ?? "").slice(0, 10);
        const cycle =
          start && end
            ? {
                start,
                end,
                label: `${start} – ${end}`,
                cutoverDay: readPayrollCutoverDay(),
              }
            : buildPayrollCycle(ym, readPayrollCutoverDay());
        return normalizePayrollRun({
          id: String(r.id ?? crypto.randomUUID()),
          runCode: String(r.document_number ?? `PAY-${String(i + 1).padStart(6, "0")}`),
          month: ym,
          monthLabel: `${cycle.label}`,
          cycleStart: cycle.start,
          cycleEnd: cycle.end,
          cycleCutoverDay: cycle.cutoverDay,
          cycleLabel: cycle.label,
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
        });
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

    if (overview.payslips.length) {
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

  // Seed Cache Digitech graded structures when still empty after API
  if (structures.length === 0) {
    structures = buildDefaultStructures();
    save(K.structures, structures);
  } else {
    structures = normalizeStructures(structures);
    save(K.structures, structures);
  }

  const beforeDedupe = salaries.length;
  salaries = dedupeEmployeeSalaries(salaries);
  if (salaries.length !== beforeDedupe) save(K.salaries, salaries);

  runs = runs.map(normalizePayrollRun);

  return {
    structures,
    salaries,
    runs,
    locks: load<MonthLock>(K.locks),
    revisions: load<SalaryRevision>(K.revisions),
    bonuses,
    adjustments: load<PayrollAdjustmentRecord>(K.adjustments),
    reimbursements,
    loans,
    payslips,
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

export async function createStructure(
  input: Omit<SalaryStructure, "id" | "createdAt">,
): Promise<SalaryStructure> {
  const row: SalaryStructure = { ...input, id: crypto.randomUUID(), createdAt: nowIso() };
  try {
    const ctx = readJson<{ branchId?: string }>(PAY_CTX_KEY, {});
    const code =
      input.code?.trim() ||
      `SS-${input.name.replace(/[^A-Za-z0-9]+/g, "-").toUpperCase().slice(0, 20)}`;
    const res = await resourceService.create<Record<string, unknown>>("/payroll/salary-structures", {
      branch_id: ctx.branchId || null,
      structure_name: input.name,
      structure_code: code,
      effective_from: nowIso().slice(0, 10),
      currency_code: "INR",
      status: "active",
    });
    const apiId = String(res.data?.id ?? "");
    if (apiId) {
      row.id = apiId;
      row.name = String(res.data?.structure_name ?? row.name);
      row.code = String(res.data?.structure_code ?? code);
    }
  } catch (err) {
    devWarn("createStructure API failed; local cache kept");
  }
  const all = load<SalaryStructure>(K.structures);
  all.unshift(row);
  save(K.structures, all);
  appendPayrollAudit({ action: "structure_created", detail: row.name, actor: actor() });
  return row;
}

export async function updateStructure(
  id: string,
  input: Omit<SalaryStructure, "id" | "createdAt">,
): Promise<SalaryStructure> {
  const all = load<SalaryStructure>(K.structures);
  const idx = all.findIndex((s) => s.id === id);
  const existing = idx >= 0 ? all[idx] : undefined;
  const row: SalaryStructure = {
    ...input,
    id,
    createdAt: existing?.createdAt ?? nowIso(),
  };

  if (UUID_RE.test(id)) {
    try {
      await resourceService.update("/payroll/salary-structures", id, {
        structure_name: input.name,
        status: "active",
      });
    } catch (err) {
      devWarn("updateStructure API failed; local cache kept");
    }
  }

  if (idx >= 0) all[idx] = row;
  else all.unshift(row);
  save(K.structures, all);
  appendPayrollAudit({ action: "structure_updated", detail: row.name, actor: actor() });
  return row;
}

export function deleteStructureLocal(id: string): void {
  save(
    K.structures,
    load<SalaryStructure>(K.structures).filter((s) => s.id !== id),
  );
}

/** Reset local structures to the Cache Digitech graded catalog. */
export function resetStructuresToCacheDigitech(): SalaryStructure[] {
  const rows = buildDefaultStructures();
  save(K.structures, rows);
  return rows;
}

export async function assignEmployeeSalary(
  input: Omit<EmployeeSalary, "id"> & { id?: string },
): Promise<EmployeeSalary> {
  const all = load<EmployeeSalary>(K.salaries);
  const key = employeeSalaryKey(input.employeeId);
  const existingIdx = all.findIndex((s) => employeeSalaryKey(s.employeeId) === key);
  const existing = existingIdx >= 0 ? all[existingIdx] : undefined;
  const id = input.id || existing?.id || crypto.randomUUID();
  const row: EmployeeSalary = {
    ...input,
    id,
    annualCtc: input.annualCtc || (Number(input.monthlyCtc) || 0) * 12,
  };

  try {
    const ctx = readJson<{
      branchId?: string;
      employmentId?: string;
      departmentId?: string;
    }>(PAY_CTX_KEY, {});
    const structureIsUuid = UUID_RE.test(input.structureId);
    const employeeIsUuid = UUID_RE.test(input.employeeId);
    const employmentId = ctx.employmentId;
    const payload = {
      salary_structure_id: structureIsUuid ? input.structureId : undefined,
      effective_from: input.effectiveDate || nowIso().slice(0, 10),
      ctc_amount: input.monthlyCtc * 12,
      gross_amount: input.monthlyCtc,
      currency_code: "INR",
      status: "active",
    };

    if (UUID_RE.test(id) && existing) {
      await resourceService.update("/payroll/employee-salaries", id, payload);
    } else if (ctx.branchId && structureIsUuid && employeeIsUuid && employmentId && UUID_RE.test(employmentId)) {
      const res = await resourceService.create<Record<string, unknown>>("/payroll/employee-salaries", {
        branch_id: ctx.branchId,
        employee_id: input.employeeId,
        salary_structure_id: input.structureId,
        employment_id: employmentId,
        department_id: ctx.departmentId || null,
        ...payload,
      });
      const apiId = String(res.data?.id ?? "");
      if (apiId) row.id = apiId;
    }
  } catch (err) {
    devWarn("assignEmployeeSalary API failed; local cache kept");
  }

  if (existingIdx >= 0) {
    const without = all.filter((s) => employeeSalaryKey(s.employeeId) !== key);
    without.unshift(row);
    save(K.salaries, without);
  } else {
    all.unshift(row);
    save(K.salaries, dedupeEmployeeSalaries(all));
  }
  appendPayrollAudit({
    action: existing ? "salary_updated" : "salary_assigned",
    detail: `${row.employeeName} → ${row.structureName} (${formatInr(row.monthlyCtc)}/mo)`,
    actor: actor(),
  });
  return row;
}

export async function runPayroll(month: string, cutoverDay?: number): Promise<PayrollRun> {
  if (isMonthLocked(month)) {
    throw new Error(`Payroll month ${monthLabel(month)} is locked and cannot be processed.`);
  }
  const cutover = cutoverDay ?? readPayrollCutoverDay();
  const cycle = buildPayrollCycle(month, cutover);
  const attendanceLines = await buildAttendanceLinesForCycle(cycle);
  const factorByEmployee = new Map(
    attendanceLines.map((l) => [l.employeeId.toLowerCase(), l.attendanceFactor]),
  );

  const salaries = load<EmployeeSalary>(K.salaries).filter((s) => s.salaryStatus === "active");
  const structures = load<SalaryStructure>(K.structures);
  const structureMap = new Map(structures.map((s) => [s.id, s]));

  let gross = 0;
  let ded = 0;
  const employees = salaries.length
    ? salaries
    : [
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
    const factor =
      factorByEmployee.get(sal.employeeId.toLowerCase()) ??
      (attendanceLines.length ? 1 : 1);
    const st = structureMap.get(sal.structureId) ?? structures[0];
    if (st) {
      gross += structureGross(st) * factor;
      ded += structureDeductions(st) * factor;
    } else {
      gross += sal.monthlyCtc * factor;
      ded += Math.round(sal.monthlyCtc * 0.12 * factor);
    }
  }

  const row: PayrollRun = {
    id: crypto.randomUUID(),
    runCode: nextCode("run", "PAY"),
    month,
    monthLabel: cycle.label,
    cycleStart: cycle.start,
    cycleEnd: cycle.end,
    cycleCutoverDay: cycle.cutoverDay,
    cycleLabel: cycle.label,
    employeeCount: employees.length,
    grossTotal: Math.round(gross),
    deductionTotal: Math.round(ded),
    netTotal: Math.max(0, Math.round(gross - ded)),
    status: "pending_hr",
    attendanceSynced: attendanceLines.length > 0,
    leaveSynced: attendanceLines.some((l) => l.leaveDays > 0) || Boolean(
      readJson<unknown[]>("erp_leave_audit_v1", []).length,
    ),
    otSynced: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  try {
    const ctx = readJson<{ branchId?: string }>(PAY_CTX_KEY, {});
    if (ctx.branchId) {
      const periods = await resourceService.list<Record<string, unknown>>("/payroll/payroll-periods");
      const periodRows = Array.isArray(periods.data) ? periods.data : [];
      const open = periodRows.find((p) =>
        ["open", "processing"].includes(String(p.status ?? "").toLowerCase()),
      );
      const periodId = String(open?.id ?? "");
      if (periodId) {
        const created = await resourceService.create<Record<string, unknown>>("/payroll/payroll-runs", {
          branch_id: ctx.branchId,
          payroll_period_id: periodId,
          run_date: `${month}-01`,
          run_type: "regular",
          currency_code: "INR",
          status: "draft",
        });
        const runId = String(created.data?.id ?? "");
        if (runId) {
          const calculated = await resourceService.action<Record<string, unknown>>(
            "/payroll/payroll-runs",
            runId,
            "calculate",
            {},
          );
          row.id = runId;
          row.runCode = String(calculated.data?.document_number ?? created.data?.document_number ?? row.runCode);
          row.grossTotal = Number(calculated.data?.total_gross ?? row.grossTotal);
          row.deductionTotal = Number(calculated.data?.total_deduction ?? row.deductionTotal);
          row.netTotal = Number(calculated.data?.total_net ?? row.netTotal);
          row.employeeCount = Number(calculated.data?.employee_count ?? row.employeeCount);
          row.status = "processing";
          try {
            await resourceService.action("/payroll/payroll-runs", runId, "submit", {});
            await resourceService.action("/payroll/payroll-runs", runId, "approve", {});
            row.status = "approved";
          } catch {
            /* submit/approve may fail — keep processing */
          }
        }
      }
    }
  } catch (err) {
    devWarn("runPayroll API failed; local cache kept");
  }

  const all = load<PayrollRun>(K.runs);
  all.unshift(row);
  save(K.runs, all);
  if (attendanceLines.length) {
    saveRunAttendance(row.id, attendanceLines);
  }
  appendPayrollAudit({
    action: "payroll_generated",
    detail: `${row.runCode} for ${row.cycleLabel} · net ${formatInr(row.netTotal)} · attendance-based`,
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

export async function addBonus(input: Omit<BonusRecord, "id" | "createdAt">): Promise<BonusRecord> {
  const row: BonusRecord = { ...input, id: crypto.randomUUID(), createdAt: nowIso() };
  try {
    const ctx = readJson<{ branchId?: string }>(PAY_CTX_KEY, {});
    const employeeId = input.employeeId && UUID_RE.test(input.employeeId) ? input.employeeId : undefined;
    if (ctx.branchId && employeeId) {
      const periods = await resourceService.list<Record<string, unknown>>("/payroll/payroll-periods", {
        page: 1,
        page_size: 200,
      });
      const periodRows = Array.isArray(periods.data) ? periods.data : [];
      const month = input.month || nowIso().slice(0, 7);
      const matched =
        periodRows.find((p) => String(p.period_code ?? p.period_name ?? "").includes(month)) ||
        periodRows.find((p) => ["open", "processing"].includes(String(p.status ?? "").toLowerCase()));
      const periodId = String(matched?.id ?? "");
      const apiType = input.bonusType === "referral" ? "other" : input.bonusType;
      const created = await resourceService.create<Record<string, unknown>>("/payroll/bonuses", {
        branch_id: ctx.branchId,
        employee_id: employeeId,
        payroll_period_id: periodId || null,
        bonus_type: apiType,
        amount: input.amount,
        status: "draft",
      });
      const bonusId = String(created.data?.id ?? "");
      if (bonusId) {
        try {
          await resourceService.action("/payroll/bonuses", bonusId, "submit");
          await resourceService.action("/payroll/bonuses", bonusId, "approve");
        } catch {
          /* leave draft/submitted */
        }
        row.id = bonusId;
      }
    }
  } catch (err) {
    devWarn("addBonus API failed; local cache kept");
  }
  const all = load<BonusRecord>(K.bonuses);
  all.unshift(row);
  save(K.bonuses, all);
  return row;
}

export async function addPayrollAdjustment(
  input: Omit<PayrollAdjustmentRecord, "id" | "createdAt" | "status"> & {
    status?: PayrollAdjustmentRecord["status"];
  },
): Promise<PayrollAdjustmentRecord> {
  const row: PayrollAdjustmentRecord = {
    ...input,
    id: crypto.randomUUID(),
    status: input.status ?? "draft",
    createdAt: nowIso(),
  };
  try {
    const ctx = readJson<{ branchId?: string }>(PAY_CTX_KEY, {});
    if (ctx.branchId && UUID_RE.test(input.employeeId)) {
      const periods = await resourceService.list<Record<string, unknown>>("/payroll/payroll-periods", {
        page: 1,
        page_size: 200,
      });
      const periodRows = Array.isArray(periods.data) ? periods.data : [];
      const month = input.month || nowIso().slice(0, 7);
      const matched =
        periodRows.find((p) => String(p.period_code ?? p.period_name ?? "").includes(month)) ||
        periodRows.find((p) => ["open", "processing"].includes(String(p.status ?? "").toLowerCase()));
      const periodId = String(matched?.id ?? "");
      if (periodId) {
        const created = await resourceService.create<Record<string, unknown>>(
          "/payroll/payroll-adjustments",
          {
            branch_id: ctx.branchId,
            employee_id: input.employeeId,
            payroll_period_id: periodId,
            adjustment_type: "earning",
            amount: input.amount,
            reason: input.kind,
            status: "draft",
          },
        );
        const adjId = String(created.data?.id ?? "");
        if (adjId) {
          try {
            await resourceService.action("/payroll/payroll-adjustments", adjId, "apply");
            row.status = "applied";
          } catch {
            row.status = "draft";
          }
          row.id = adjId;
        }
      }
    }
  } catch (err) {
    devWarn("addPayrollAdjustment API failed; local cache kept");
  }
  const all = load<PayrollAdjustmentRecord>(K.adjustments);
  all.unshift(row);
  save(K.adjustments, all);
  return row;
}

export async function addReimbursement(
  input: Omit<ReimbursementRecord, "id" | "createdAt"> & { employeeId?: string },
): Promise<ReimbursementRecord> {
  const row: ReimbursementRecord = { ...input, id: crypto.randomUUID(), createdAt: nowIso() };
  const ctx = readJson<{ branchId?: string }>(PAY_CTX_KEY, {});
  const employeeId = (input as { employeeId?: string }).employeeId;
  if (ctx.branchId && employeeId && UUID_RE.test(employeeId)) {
    try {
      const typeMap: Record<string, string> = {
        Travel: "travel",
        Internet: "internet",
        Medical: "medical",
        Training: "training",
        Mobile: "mobile",
      };
      const created = await resourceService.create<Record<string, unknown>>("/payroll/reimbursements", {
        branch_id: ctx.branchId,
        employee_id: employeeId,
        reimbursement_type: typeMap[input.reimbType] || "other",
        claim_amount: input.amount,
        status: "draft",
      });
      const id = String(created.data?.id ?? "");
      if (id) {
        await resourceService.action("/payroll/reimbursements", id, "submit").catch(() => undefined);
        row.id = id;
      }
    } catch (err) {
      devWarn("addReimbursement API failed; local cache kept");
    }
  }
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
  if (UUID_RE.test(id) && status === "approved") {
    void resourceService.action("/payroll/reimbursements", id, "approve").catch(() => undefined);
  }
  return all[idx];
}

export async function addLoan(
  input: Omit<LoanRecord, "id" | "createdAt"> & { employeeId?: string },
): Promise<LoanRecord> {
  const row: LoanRecord = { ...input, id: crypto.randomUUID(), createdAt: nowIso() };
  const ctx = readJson<{ branchId?: string }>(PAY_CTX_KEY, {});
  const employeeId = (input as { employeeId?: string }).employeeId;
  if (ctx.branchId && employeeId && UUID_RE.test(employeeId)) {
    try {
      const created = await resourceService.create<Record<string, unknown>>("/payroll/loans", {
        branch_id: ctx.branchId,
        employee_id: employeeId,
        loan_type: "personal",
        principal_amount: input.loanAmount,
        emi_amount: input.recoveryPerMonth,
        interest_rate: 0,
        installment_count: input.installments,
        start_date: new Date().toISOString().slice(0, 10),
        outstanding_amount: input.remainingBalance || input.loanAmount,
        status: "draft",
      });
      const id = String(created.data?.id ?? "");
      if (id) {
        await resourceService.action("/payroll/loans", id, "submit").catch(() => undefined);
        row.id = id;
      }
    } catch (err) {
      devWarn("addLoan API failed; local cache kept");
    }
  }
  const all = load<LoanRecord>(K.loans);
  all.unshift(row);
  save(K.loans, all);
  return row;
}

function mapApiPayslipToRecord(p: Record<string, unknown>, run: PayrollRun): PayslipRecord {
  const json = (p.payslip_json as Record<string, unknown> | null) ?? {};
  const att = (json.attendance as Record<string, unknown> | null) ?? {};
  const emp = (json.employee as Record<string, unknown> | null) ?? {};
  const earningsRaw = Array.isArray(json.earnings) ? json.earnings : [];
  const deductionsRaw = Array.isArray(json.deductions) ? json.deductions : [];
  const gross = Number(p.gross_salary ?? (json.summary as Record<string, unknown>)?.gross ?? 0);
  const totalDeductions = Number(p.total_deductions ?? (json.summary as Record<string, unknown>)?.total_deductions ?? 0);
  const net = Number(p.net_salary ?? (json.summary as Record<string, unknown>)?.net_pay ?? 0);
  return {
    id: String(p.id ?? crypto.randomUUID()),
    payslipCode: String(p.document_number ?? nextCode("slip", "PSL")),
    runId: String(p.payroll_run_id ?? run.id),
    employeeId: String(p.employee_id ?? emp.id ?? ""),
    employeeName: String(p.employee_name ?? emp.name ?? p.employee_id ?? ""),
    month: run.month,
    monthLabel: run.monthLabel,
    department: "—",
    bankAccount: "—",
    presentDays: Number(att.paid_days ?? 0),
    leaveDays: Number(att.leave_days ?? 0),
    earnings: earningsRaw.map((e) => ({
      label: String((e as Record<string, unknown>).label ?? "Earning"),
      amount: Number((e as Record<string, unknown>).amount ?? 0),
    })),
    deductions: deductionsRaw
      .filter((d) => (d as Record<string, unknown>).code !== "pf_total")
      .map((d) => ({
        label: String((d as Record<string, unknown>).label ?? "Deduction"),
        amount: Number((d as Record<string, unknown>).amount ?? 0),
      })),
    gross,
    totalDeductions,
    net,
    taxRegime: "new",
    generatedAt: nowIso(),
    exportText: typeof json.export_text === "string" ? json.export_text : undefined,
  };
}

export async function generatePayslips(runId: string): Promise<PayslipRecord[]> {
  const runs = load<PayrollRun>(K.runs);
  const run = runs.find((r) => r.id === runId);
  if (!run) throw new Error("Payroll run not found");

  if (UUID_RE.test(runId)) {
    try {
      const gen = await resourceService.action<Record<string, unknown>[]>(
        "/payroll/payroll-runs",
        runId,
        "generate-payslips",
        { issue: true },
      );
      const rows = Array.isArray(gen.data) ? gen.data : [];
      if (rows.length) {
        const slips = rows.map((p) => mapApiPayslipToRecord(p, run));
        const all = load<PayslipRecord>(K.payslips);
        save(K.payslips, [...slips, ...all.filter((p) => p.runId !== runId || !UUID_RE.test(p.id))]);
        appendPayrollAudit({
          action: "payslips_generated",
          detail: `${slips.length} payslips (API) for ${run.monthLabel}`,
          actor: actor(),
        });
        return slips;
      }
    } catch (err) {
      devWarn("generate-payslips API failed; falling back");
    }

    try {
      const ctx = readJson<{ branchId?: string }>(PAY_CTX_KEY, {});
      if (ctx.branchId && UUID_RE.test(ctx.branchId)) {
        const runRes = await resourceService.get<Record<string, unknown>>("/payroll/payroll-runs", runId);
        const periodId = String(runRes.data?.payroll_period_id ?? "");
        const linesRes = await resourceService.list<Record<string, unknown>>("/payroll/payroll-run-lines", {
          page: 1,
          page_size: 200,
        });
        const lineRows = Array.isArray(linesRes.data) ? linesRes.data : [];
        const lines = lineRows.filter((l) => String(l.payroll_run_id ?? "") === runId);
        const slips: PayslipRecord[] = [];
        for (const line of lines) {
          const lineId = String(line.id ?? "");
          const employeeId = String(line.employee_id ?? "");
          const gross = Number(line.gross_earnings ?? 0);
          const deductions = Number(line.total_deductions ?? 0);
          const net = Number(line.net_pay ?? Math.max(0, gross - deductions));
          if (!lineId || !employeeId || !periodId) continue;
          const breakdown = (line.component_breakdown_json as Record<string, unknown> | null) ?? {};
          const created = await resourceService.create<Record<string, unknown>>("/payroll/payslips", {
            branch_id: ctx.branchId,
            payroll_run_id: runId,
            payroll_run_line_id: lineId,
            employee_id: employeeId,
            payroll_period_id: periodId,
            gross_salary: gross,
            total_deductions: deductions,
            net_salary: net,
            payslip_json: breakdown,
            status: "generated",
          });
          const slipId = String(created.data?.id ?? "");
          if (slipId) {
            try {
              await resourceService.action("/payroll/payslips", slipId, "issue");
            } catch {
              /* issue optional */
            }
          }
          slips.push({
            id: slipId || crypto.randomUUID(),
            payslipCode: String(created.data?.document_number ?? nextCode("slip", "PSL")),
            runId,
            employeeId,
            employeeName: String(created.data?.employee_name ?? employeeId),
            month: run.month,
            monthLabel: run.monthLabel,
            department: "—",
            bankAccount: "—",
            presentDays: Number(line.paid_days ?? 0),
            leaveDays: Number(line.leave_days ?? 0),
            earnings: [{ label: "Gross", amount: gross }],
            deductions: [{ label: "Deductions", amount: deductions }],
            gross,
            totalDeductions: deductions,
            net,
            taxRegime: "new",
            generatedAt: nowIso(),
          });
        }
        if (slips.length) {
          const all = load<PayslipRecord>(K.payslips);
          save(K.payslips, [...slips, ...all.filter((p) => p.runId !== runId || !UUID_RE.test(p.id))]);
          appendPayrollAudit({
            action: "payslips_generated",
            detail: `${slips.length} payslips (API) for ${run.monthLabel}`,
            actor: actor(),
          });
          return slips;
        }
      }
    } catch (err) {
      devWarn("generatePayslips API failed; using local generation");
    }
  }

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
    const att =
      getPayrollRunAttendance(runId).find(
        (l) => l.employeeId.toLowerCase() === sal.employeeId.toLowerCase(),
      ) ?? null;
    const factor = att?.attendanceFactor ?? 1;
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
    const gross = Math.round(earnings.reduce((s, e) => s + e.amount, 0) * factor);
    const totalDeductions = Math.round(deductions.reduce((s, d) => s + d.amount, 0) * factor);
    const scaledEarnings = earnings.map((e) => ({
      ...e,
      amount: Math.round(e.amount * factor),
    }));
    const scaledDeductions = deductions.map((d) => ({
      ...d,
      amount: Math.round(d.amount * factor),
    }));
    return {
      id: crypto.randomUUID(),
      payslipCode: nextCode("slip", "PSL"),
      runId,
      employeeId: sal.employeeId,
      employeeName: sal.employeeName,
      month: run.month,
      monthLabel: run.cycleLabel || run.monthLabel,
      department: sal.department,
      bankAccount: sal.bankAccount,
      presentDays: att?.presentDays ?? 0,
      leaveDays: att?.leaveDays ?? 0,
      earnings: scaledEarnings,
      deductions: scaledDeductions,
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
  if (slip.exportText?.trim()) {
    return slip.exportText;
  }
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

export async function fetchPayrollRunBankExportCsv(runId: string): Promise<string> {
  if (!UUID_RE.test(runId)) {
    throw new Error("Payroll run id must be a UUID to export bank file from API");
  }
  const res = await apiClient<{ csv: string }>(`/payroll/payroll-runs/${runId}/bank-export`, {
    method: "GET",
  });
  const csv = res.data?.csv;
  if (!csv) {
    throw new Error("Bank export returned no CSV data");
  }
  return csv;
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
