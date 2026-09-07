/**
 * Enterprise Payroll Management service — local rich store + payroll API merge.
 */

import { formatInr, listAllPayrollRows, loadPayrollOverview } from "@/services/payroll-service";
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
  PayrollRunEmployeeLine,
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
  type PayrollEmployeeAttendance,
} from "@/types/payroll-management";
import {
  EXCEL_DEFAULTS,
  amountsFromSplit,
  computeCtcSplit,
} from "@/lib/salary-structure-excel";
import {
  buildPayrollCycle,
  isPfDeductionLabel,
  readPayrollCutoverDay,
  SALARY_DAY_BASIS,
} from "@/lib/payroll-cycle";
import { summarizePayrollAttendance } from "@/lib/payroll-attendance-cycle";
import type { PayrollCycle } from "@/lib/payroll-cycle";
import {
  getCachedPayrollPfPolicy,
  loadResolvedPayrollPfPolicy,
  pfDeductionRows,
  replacePfDeductions,
  type PayrollPfPolicy,
} from "@/lib/payroll-pf-policy";
import { loadHrMasterDirectory, type HrMasterOption } from "@/services/hr-master-connector";
import { devWarn } from "@/lib/dev-log";

const PAY_CTX_KEY = "erp_pay_api_context_v1";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PLACEHOLDER_NAME_RE = /^employee\s*\d+$/i;
const PLACEHOLDER_ID_RE = /^(emp-\d+|demo|emp-000001)$/i;

function asNum(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function excelSplitFromInput(input: Omit<SalaryStructure, "id" | "createdAt">) {
  return computeCtcSplit({
    grossCtc: asNum(input.grossCtc ?? input.ctcAmount ?? input.basic + input.hra + input.specialAllowance + input.pf),
    basicPercent: asNum(input.basicPercent, EXCEL_DEFAULTS.basicPercent),
    hraPercentOfBasic: asNum(input.hraPercentOfBasic, EXCEL_DEFAULTS.hraPercentOfBasic),
    telephoneAllowance: asNum(input.telephoneAllowance, 0),
    employerContribution: asNum(
      input.employerContribution ?? input.pf,
      EXCEL_DEFAULTS.employerContribution,
    ),
  });
}

function withExcelAmounts(
  input: Omit<SalaryStructure, "id" | "createdAt">,
): Omit<SalaryStructure, "id" | "createdAt"> {
  const split = excelSplitFromInput(input);
  return {
    ...input,
    ...amountsFromSplit(split),
    basicPercent: asNum(input.basicPercent, EXCEL_DEFAULTS.basicPercent),
    hraPercentOfBasic: asNum(input.hraPercentOfBasic, EXCEL_DEFAULTS.hraPercentOfBasic),
    pfPercent: asNum(input.pfPercent, EXCEL_DEFAULTS.pfPercent),
    pfWageCeiling: asNum(input.pfWageCeiling, EXCEL_DEFAULTS.pfWageCeiling),
    pfFixedCeiling: asNum(input.pfFixedCeiling, EXCEL_DEFAULTS.pfFixedCeiling),
    edliAdminAmount: asNum(input.edliAdminAmount, EXCEL_DEFAULTS.edliAdminAmount),
    esiPercent: asNum(input.esiPercent, EXCEL_DEFAULTS.esiPercent),
    esiMonthlyCeiling: asNum(input.esiMonthlyCeiling, EXCEL_DEFAULTS.esiMonthlyCeiling),
    status: input.status ?? "draft",
  };
}

function structureApiPayload(
  input: Omit<SalaryStructure, "id" | "createdAt">,
  extras: { structureCode?: string; effectiveFrom?: string } = {},
) {
  const row = withExcelAmounts(input);
  const ctx = readJson<{ branchId?: string }>(PAY_CTX_KEY, {});
  const code = extras.structureCode || row.code?.trim();
  return {
    branch_id: ctx.branchId || null,
    structure_name: row.name,
    ...(code ? { structure_code: code } : {}),
    effective_from: extras.effectiveFrom || row.effectiveFrom || nowIso().slice(0, 10),
    currency_code: "INR",
    status: row.status || "draft",
    gross_ctc: row.grossCtc,
    basic_percent: row.basicPercent,
    hra_percent_of_basic: row.hraPercentOfBasic,
    telephone_allowance: row.telephoneAllowance,
    employer_contribution: row.employerContribution,
    pf_percent: row.pfPercent,
    pf_wage_ceiling: row.pfWageCeiling,
    pf_fixed_ceiling: row.pfFixedCeiling,
    edli_admin_amount: row.edliAdminAmount,
    esi_percent: row.esiPercent,
    esi_monthly_ceiling: row.esiMonthlyCeiling,
  };
}

function employeeSalaryKey(employeeId: string): string {
  return String(employeeId ?? "")
    .trim()
    .toLowerCase();
}

function isPlaceholderSalary(row: { employeeId?: string; employeeName?: string }): boolean {
  const name = String(row.employeeName ?? "").trim();
  const id = String(row.employeeId ?? "").trim();
  return PLACEHOLDER_NAME_RE.test(name) || PLACEHOLDER_ID_RE.test(id);
}

function findHrEmployee(employees: HrMasterOption[], employeeId: string): HrMasterOption | undefined {
  const key = employeeSalaryKey(employeeId);
  if (!key) return undefined;
  return employees.find(
    (e) => e.id.toLowerCase() === key || (e.code && e.code.toLowerCase() === key),
  );
}

function hrDisplayName(emp: HrMasterOption): string {
  return emp.label.split(" · ")[0]?.trim() || emp.code || emp.id;
}

function mapApiEmployeeSalary(
  e: Record<string, unknown>,
  structures: SalaryStructure[],
): EmployeeSalary | null {
  const uuid = String(e.employee_id ?? "").trim();
  const code = String(e.employee_code ?? "").trim();
  const employeeId = UUID_RE.test(uuid) ? uuid : code;
  if (!employeeId) return null;
  const rawName = String(e.employee_name ?? e.full_name ?? "").trim();
  const employeeName = PLACEHOLDER_NAME_RE.test(rawName) ? "" : rawName;
  if (isPlaceholderSalary({ employeeId, employeeName: employeeName || "Employee 1" }) && !UUID_RE.test(employeeId)) {
    return null;
  }
  const monthly = Number(
    e.gross_amount ??
      e.monthly_ctc ??
      (e.ctc_amount != null ? Number(e.ctc_amount) / 12 : e.ctc) ??
      0,
  );
  const status = String(e.status ?? "active").toLowerCase();
  return {
    id: String(e.id ?? crypto.randomUUID()),
    employeeId,
    employeeName: employeeName || code || employeeId,
    structureId: String(e.salary_structure_id ?? structures[0]?.id ?? ""),
    structureName: String(e.structure_name ?? structures[0]?.name ?? "Default"),
    effectiveDate: String(e.effective_from ?? e.effective_date ?? "").slice(0, 10),
    monthlyCtc: Number.isFinite(monthly) ? monthly : 0,
    annualCtc: Number(e.annual_ctc ?? e.ctc_amount ?? (Number.isFinite(monthly) ? monthly * 12 : 0)),
    payrollGroup: String(e.payroll_group ?? "General"),
    bankAccount: String(e.bank_account ?? ""),
    bankName: String(e.bank_name ?? ""),
    taxRegime: String(e.tax_regime ?? "new").includes("old") ? ("old" as const) : ("new" as const),
    salaryStatus: status === "ended" || status === "cancelled" || status === "inactive" ? "inactive" : "active",
    department: String(e.department_name ?? "—"),
  };
}

function enrichSalaryWithHr(row: EmployeeSalary, hr: HrMasterOption[]): EmployeeSalary | null {
  const emp = findHrEmployee(hr, row.employeeId);
  if (!emp) {
    if (isPlaceholderSalary(row) || PLACEHOLDER_NAME_RE.test(row.employeeName || "")) return null;
    return row;
  }
  return {
    ...row,
    employeeId: emp.id,
    employeeName: hrDisplayName(emp) || row.employeeName,
    department: emp.department || row.department,
    bankAccount: emp.bankAccount || row.bankAccount,
    bankName: emp.bankName || row.bankName,
  };
}

function mergeSalaryLists(
  local: EmployeeSalary[],
  api: EmployeeSalary[],
  hr: HrMasterOption[],
): EmployeeSalary[] {
  const merged = new Map<string, EmployeeSalary>();
  const put = (row: EmployeeSalary) => {
    const enriched = enrichSalaryWithHr(row, hr);
    if (!enriched) return;
    const emp = findHrEmployee(hr, enriched.employeeId);
    merged.set((emp?.id || enriched.employeeId).toLowerCase(), {
      ...enriched,
      employeeId: emp?.id || enriched.employeeId,
    });
  };
  for (const row of local) put(row);
  for (const row of api) put(row);
  return [...merged.values()];
}

async function resolveEmployeeSalaries(hr?: HrMasterOption[]): Promise<EmployeeSalary[]> {
  const employees =
    hr ??
    (await loadHrMasterDirectory()
      .then((d) => d.employees ?? [])
      .catch(() => [] as HrMasterOption[]));
  const structures = load<SalaryStructure>(K.structures);
  let api: EmployeeSalary[] = [];
  try {
    const rows = await listAllPayrollRows("/payroll/employee-salaries");
    api = rows
      .map((e) => mapApiEmployeeSalary(e, structures))
      .filter((row): row is EmployeeSalary => Boolean(row));
  } catch {
    api = [];
  }
  const merged = mergeSalaryLists(load<EmployeeSalary>(K.salaries), api, employees);
  save(K.salaries, merged);
  return merged;
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
  structures: "erp_pay_structures_v2",
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
  runLines: "erp_pay_run_lines_v1",
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

function saveRunEmployeeLines(runId: string, lines: PayrollRunEmployeeLine[]): void {
  const map = readJson<Record<string, PayrollRunEmployeeLine[]>>(K.runLines, {});
  map[runId] = lines;
  writeJson(K.runLines, map);
}

function getSavedRunEmployeeLines(runId: string): PayrollRunEmployeeLine[] {
  const map = readJson<Record<string, PayrollRunEmployeeLine[]>>(K.runLines, {});
  return (map[runId] ?? []).map(withPolicyPf);
}

function scalePayAmount(label: string, amount: number, factor: number): number {
  if (isPfDeductionLabel(label)) return Math.round(amount);
  return Math.round(amount * factor);
}

/** Apply company payroll-policy PF (not salary-structure employer PF). */
function withPolicyPf(line: PayrollRunEmployeeLine): PayrollRunEmployeeLine {
  const factor = Number.isFinite(line.attendanceFactor) && line.attendanceFactor > 0 ? line.attendanceFactor : 1;
  const cycleBasic = line.earnings.find((e) => e.label.toLowerCase() === "basic")?.amount ?? 0;
  const monthlyBasic = factor > 0 ? cycleBasic / factor : cycleBasic;
  const deductionItems = replacePfDeductions(line.deductionItems, getCachedPayrollPfPolicy(), {
    monthlyBasic,
    cycleBasic,
    factor,
  });
  const deductionTotal = deductionItems.reduce((sum, d) => sum + d.amount, 0);
  return {
    ...line,
    deductionItems,
    deductionTotal,
    net: Math.max(0, Math.round(line.gross - deductionTotal)),
  };
}

function findAttendanceLine(
  lines: PayrollEmployeeAttendance[],
  employeeId: string,
): PayrollEmployeeAttendance | undefined {
  const key = employeeId.toLowerCase();
  return lines.find(
    (l) => l.employeeId.toLowerCase() === key || l.employeeCode.toLowerCase() === key,
  );
}

function activeSalaries(): EmployeeSalary[] {
  return load<EmployeeSalary>(K.salaries).filter((s) => s.salaryStatus === "active");
}

function buildEmployeePayLine(
  sal: EmployeeSalary,
  att: PayrollEmployeeAttendance | undefined,
  structures: SalaryStructure[],
  policy: PayrollPfPolicy = getCachedPayrollPfPolicy(),
): PayrollRunEmployeeLine {
  const lopDays = att?.lopDays ?? att?.absentDays ?? 0;
  const periodDays = SALARY_DAY_BASIS;
  const payableDays =
    att?.periodDays === SALARY_DAY_BASIS && att.payableDays != null
      ? att.payableDays
      : Math.max(0, Math.round((periodDays - lopDays) * 10) / 10);
  const factor = periodDays > 0 ? Math.min(1, Math.max(0, payableDays / periodDays)) : 1;
  const st = structures.find((s) => s.id === sal.structureId) ?? structures[0];
  const earnings = st
    ? [
        { label: "Basic", amount: st.basic },
        { label: "HRA", amount: st.hra },
        { label: "Special Allowance", amount: st.specialAllowance },
        { label: "Medical", amount: st.medicalAllowance },
        { label: "Travel", amount: st.travelAllowance },
        { label: "Food", amount: st.foodAllowance },
        { label: "Internet", amount: st.internetAllowance },
        { label: "Telephone", amount: st.telephoneAllowance ?? 0 },
        { label: "Bonus", amount: st.bonus },
        { label: "Incentives", amount: st.incentives },
        { label: "Overtime", amount: st.overtime },
        { label: "Arrears", amount: st.arrears },
        { label: "Reimbursement", amount: st.reimbursement },
        { label: "Other Earnings", amount: st.otherEarnings },
      ].filter((e) => e.amount > 0)
    : [{ label: "CTC / Gross", amount: sal.monthlyCtc }];
  const deductionItems = st
    ? [
        { label: "ESI", amount: st.esi },
        { label: "Professional Tax", amount: st.professionalTax },
        { label: "TDS", amount: st.tds },
        { label: "Loan Recovery", amount: st.loanRecovery },
        { label: "Advance Recovery", amount: st.advanceRecovery },
        { label: "Insurance", amount: st.insurance },
        { label: "Other Deductions", amount: st.otherDeductions },
      ].filter((d) => d.amount > 0)
    : [];
  const scaledEarnings = earnings.map((e) => ({ ...e, amount: Math.round(e.amount * factor) }));
  const monthlyBasic = earnings.find((e) => e.label.toLowerCase() === "basic")?.amount ?? 0;
  const cycleBasic = scaledEarnings.find((e) => e.label.toLowerCase() === "basic")?.amount ?? 0;
  const scaledOther = deductionItems.map((d) => ({
    ...d,
    amount: scalePayAmount(d.label, d.amount, factor),
  }));
  const scaledDeductions = [
    ...pfDeductionRows(policy, { monthlyBasic, cycleBasic, factor }),
    ...scaledOther,
  ];
  const gross = scaledEarnings.reduce((sum, e) => sum + e.amount, 0);
  const deductionTotal = scaledDeductions.reduce((sum, d) => sum + d.amount, 0);
  return {
    employeeId: sal.employeeId,
    employeeName: sal.employeeName,
    employeeCode: att?.employeeCode,
    department: sal.department,
    bankAccount: sal.bankAccount || "",
    bankName: sal.bankName,
    presentDays: att?.presentDays ?? 0,
    leaveDays: att?.leaveDays ?? 0,
    absentDays: att?.absentDays ?? 0,
    halfDays: att?.halfDays ?? 0,
    holidays: att?.holidays ?? 0,
    weeklyOff: att?.weeklyOff ?? 0,
    lopDays: att?.lopDays ?? att?.absentDays ?? 0,
    payableDays,
    workingDaysInCycle: periodDays,
    periodDays,
    attendanceFactor: factor,
    monthlyCtc: sal.monthlyCtc,
    earnings: scaledEarnings,
    deductionItems: scaledDeductions,
    gross,
    deductionTotal,
    net: Math.max(0, gross - deductionTotal),
  };
}

function mapApiRunLineToEmployeeLine(
  line: Record<string, unknown>,
  sal?: EmployeeSalary,
): PayrollRunEmployeeLine {
  const bd = (line.component_breakdown_json as Record<string, unknown> | null) ?? {};
  const summary = (line.day_summary_json as Record<string, unknown> | null) ?? {};
  const counts = (summary.counts as Record<string, unknown> | null) ?? {};
  const periodDays = Number(line.period_days ?? SALARY_DAY_BASIS) || SALARY_DAY_BASIS;
  const paidDays = Number(line.paid_days ?? periodDays);
  const lopDays = Number(line.lop_days ?? 0);
  const earnings = [
    { label: "Basic", amount: Number(bd.basic ?? 0) },
    { label: "HRA", amount: Number(bd.hra ?? 0) },
    { label: "Special Allowance", amount: Number(bd.special_allowance ?? 0) },
    { label: "Overtime", amount: Number(bd.overtime_pay ?? 0) },
    { label: "Bonus", amount: Number(bd.bonus ?? 0) },
  ].filter((e) => e.amount > 0);
  const deductionItems = [
    { label: "Employee PF", amount: Number(bd.pf_employee ?? 0) },
    { label: "ESI", amount: Number(bd.esi_employee ?? 0) },
    { label: "Professional Tax", amount: Number(bd.professional_tax ?? 0) },
  ].filter((d) => d.amount > 0);
  return withPolicyPf({
    employeeId: String(line.employee_id ?? sal?.employeeId ?? ""),
    employeeName: sal?.employeeName ?? String(line.employee_id ?? ""),
    employeeCode: sal?.employeeId,
    department: sal?.department ?? "—",
    bankAccount: sal?.bankAccount || "",
    bankName: sal?.bankName,
    presentDays: Number(counts.present ?? 0),
    leaveDays: Number(counts.paid_leave ?? line.leave_days ?? 0),
    absentDays: Number(counts.absent ?? 0),
    halfDays: Number(counts.half_day ?? 0),
    holidays: Number(counts.holiday ?? 0),
    weeklyOff: Number(counts.week_off ?? 0),
    lopDays,
    payableDays: paidDays,
    workingDaysInCycle: periodDays,
    periodDays,
    attendanceFactor: periodDays > 0 ? paidDays / periodDays : 1,
    monthlyCtc: sal?.monthlyCtc ?? Number(bd.gross ?? line.gross_earnings ?? 0),
    earnings: earnings.length ? earnings : [{ label: "Gross", amount: Number(line.gross_earnings ?? 0) }],
    deductionItems,
    gross: Number(line.gross_earnings ?? 0),
    deductionTotal: Number(line.total_deductions ?? 0),
    net: Number(line.net_pay ?? 0),
  });
}

async function fetchApiRunLines(runId: string): Promise<Record<string, unknown>[]> {
  const linesRes = await resourceService.list<Record<string, unknown>>("/payroll/payroll-run-lines", {
    page: 1,
    page_size: 200,
  });
  const lineRows = Array.isArray(linesRes.data) ? linesRes.data : [];
  return lineRows.filter((l) => String(l.payroll_run_id ?? "") === runId);
}

export function getPayrollRun(id: string): PayrollRun | null {
  const row = load<PayrollRun>(K.runs).find((r) => r.id === id);
  return row ? normalizePayrollRun(row) : null;
}

export function listPayrollRunEmployeeLines(runId: string): PayrollRunEmployeeLine[] {
  const saved = getSavedRunEmployeeLines(runId);
  if (saved.length) return saved;
  const salaries = activeSalaries();
  const structures = load<SalaryStructure>(K.structures);
  const att = getPayrollRunAttendance(runId);
  const slips = load<PayslipRecord>(K.payslips).filter((p) => p.runId === runId);
  return salaries.map((sal) => {
    const line = buildEmployeePayLine(sal, findAttendanceLine(att, sal.employeeId), structures);
    const slip = slips.find(
      (p) => p.employeeId.toLowerCase() === sal.employeeId.toLowerCase(),
    );
    if (!slip) return line;
    return {
      ...line,
      employeeName: slip.employeeName || line.employeeName,
      department: slip.department || line.department,
      bankAccount: slip.bankAccount || line.bankAccount,
      earnings: slip.earnings,
      deductionItems: slip.deductions,
      gross: slip.gross,
      deductionTotal: slip.totalDeductions,
      net: slip.net,
    };
  }).concat(
    att
      .filter((a) => {
        const key = a.employeeId.toLowerCase();
        const code = a.employeeCode.toLowerCase();
        return !salaries.some(
          (s) => s.employeeId.toLowerCase() === key || s.employeeId.toLowerCase() === code,
        );
      })
      .map((a) =>
        buildEmployeePayLine(
          {
            id: a.employeeId,
            employeeId: a.employeeId,
            employeeName: a.employeeName,
            structureId: "",
            structureName: "",
            effectiveDate: "",
            monthlyCtc: 0,
            annualCtc: 0,
            payrollGroup: "General",
            bankAccount: "",
            taxRegime: "new",
            salaryStatus: "active",
            department: a.department,
          },
          a,
          structures,
        ),
      ),
  );
}

export function getPayrollRunEmployeeLine(
  runId: string,
  employeeId: string,
): PayrollRunEmployeeLine | null {
  const key = employeeId.toLowerCase();
  return (
    listPayrollRunEmployeeLines(runId).find((l) => l.employeeId.toLowerCase() === key) ?? null
  );
}

export async function previewPayrollRunEmployees(
  month: string,
  cutoverDay?: number,
): Promise<{ cycle: import("@/lib/payroll-cycle").PayrollCycle; lines: PayrollRunEmployeeLine[] }> {
  const policy = await loadResolvedPayrollPfPolicy();
  const cycle = buildPayrollCycle(month, cutoverDay ?? readPayrollCutoverDay());
  const master = await loadHrMasterDirectory().catch(() => ({ employees: [] as HrMasterOption[] }));
  const hr = master.employees ?? [];
  const salaries = await resolveEmployeeSalaries(hr);
  const { lines: att } = await previewPayrollAttendanceForCycle(month, cutoverDay, hr);
  const structures = load<SalaryStructure>(K.structures);
  const salaryByKey = new Map<string, EmployeeSalary>();
  for (const sal of salaries.filter((s) => s.salaryStatus === "active")) {
    salaryByKey.set(sal.employeeId.toLowerCase(), sal);
    const emp = findHrEmployee(hr, sal.employeeId);
    if (emp?.code) salaryByKey.set(emp.code.toLowerCase(), sal);
  }

  const people = hr.length
    ? hr
    : salaries.map((s) => ({
        id: s.employeeId,
        label: s.employeeName,
        code: s.employeeId,
        department: s.department,
        bankAccount: s.bankAccount,
        bankName: s.bankName,
        monthlyCtc: s.monthlyCtc,
      }));

  const lines = people.map((emp) => {
    const sal =
      salaryByKey.get(emp.id.toLowerCase()) ||
      (emp.code ? salaryByKey.get(emp.code.toLowerCase()) : undefined);
    const stub: EmployeeSalary = sal ?? {
      id: emp.id,
      employeeId: emp.id,
      employeeName: hrDisplayName(emp),
      structureId: structures[0]?.id ?? "",
      structureName: structures[0]?.name ?? "",
      effectiveDate: "",
      monthlyCtc: emp.monthlyCtc ?? 0,
      annualCtc: (emp.monthlyCtc ?? 0) * 12,
      payrollGroup: "General",
      bankAccount: emp.bankAccount ?? "",
      bankName: emp.bankName,
      taxRegime: "new",
      salaryStatus: "inactive",
      department: emp.department ?? "—",
    };
    const line = buildEmployeePayLine(
      { ...stub, employeeId: emp.id, employeeName: hrDisplayName(emp), department: emp.department ?? stub.department },
      findAttendanceLine(att, emp.id) ?? findAttendanceLine(att, emp.code ?? ""),
      structures,
      policy,
    );
    return { ...line, employeeCode: emp.code || line.employeeCode };
  });

  return { cycle, lines };
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

function payrollRunGroupKey(run: Pick<PayrollRun, "month" | "cycleStart" | "cycleEnd">): string {
  if (run.cycleStart && run.cycleEnd) return `c:${run.cycleStart}|${run.cycleEnd}`;
  return `m:${(run.month || "").slice(0, 7)}`;
}

function findRunForCycle(runs: PayrollRun[], month: string, cycle: PayrollCycle): PayrollRun | undefined {
  const ym = month.slice(0, 7);
  return (
    runs.find((r) => r.month.slice(0, 7) === ym) ??
    runs.find((r) => r.cycleStart === cycle.start && r.cycleEnd === cycle.end)
  );
}

function replaceRunInStore(row: PayrollRun): PayrollRun[] {
  const all = uniqueRunsByMonth(
    load<PayrollRun>(K.runs).filter((r) => r.id !== row.id && payrollRunGroupKey(r) !== payrollRunGroupKey(row)),
  );
  all.unshift(row);
  save(K.runs, uniqueRunsByMonth(all));
  return all;
}

function uniquePayslips(rows: PayslipRecord[]): PayslipRecord[] {
  const byEmpMonth = new Map<string, PayslipRecord>();
  for (const p of rows) {
    const ym = (p.month || "").slice(0, 7);
    const who = (p.employeeId || p.employeeCode || p.employeeName || p.id).toLowerCase();
    const key = `${who}|${ym}`;
    const prev = byEmpMonth.get(key);
    if (!prev || (p.generatedAt || "") >= (prev.generatedAt || "")) {
      byEmpMonth.set(key, p);
    }
  }
  return [...byEmpMonth.values()];
}

function payslipsFromRunLines(run: PayrollRun, lines: PayrollRunEmployeeLine[]): PayslipRecord[] {
  const month = run.month.slice(0, 7);
  return lines.map((line) => ({
    id: crypto.randomUUID(),
    payslipCode: nextCode("slip", "PSL"),
    runId: run.id,
    employeeId: line.employeeId,
    employeeName: line.employeeName,
    employeeCode: line.employeeCode,
    month,
    monthLabel: monthLabel(month),
    department: line.department,
    bankAccount: line.bankAccount,
    presentDays: line.presentDays,
    leaveDays: line.leaveDays,
    payableDays: line.payableDays,
    periodDays: line.periodDays ?? line.workingDaysInCycle,
    lopDays: line.lopDays,
    weeklyOff: line.weeklyOff,
    holidays: line.holidays,
    earnings: line.earnings,
    deductions: line.deductionItems,
    gross: line.gross,
    totalDeductions: line.deductionTotal,
    net: line.net,
    taxRegime: "new" as const,
    generatedAt: nowIso(),
  }));
}

function persistPayslipsForRun(run: PayrollRun, slips: PayslipRecord[]): PayslipRecord[] {
  const monthKey = run.month.slice(0, 7);
  const merged = uniquePayslips([
    ...slips,
    ...load<PayslipRecord>(K.payslips).filter(
      (p) => p.runId !== run.id && p.month.slice(0, 7) !== monthKey,
    ),
  ]);
  save(K.payslips, merged);
  return merged;
}

function adoptOrphanedRunLines(before: PayrollRun[], kept: PayrollRun[]): void {
  const lineMap = readJson<Record<string, PayrollRunEmployeeLine[]>>(K.runLines, {});
  for (const run of kept) {
    if ((lineMap[run.id] ?? []).length) continue;
    const key = payrollRunGroupKey(run);
    const donor = before.find(
      (r) => r.id !== run.id && payrollRunGroupKey(r) === key && (lineMap[r.id] ?? []).length > 0,
    );
    if (!donor) continue;
    saveRunEmployeeLines(run.id, lineMap[donor.id]);
  }
}

export function findPayrollRunForMonth(runs: PayrollRun[], month: string): PayrollRun | undefined {
  const ym = month.slice(0, 7);
  const uniq = uniqueRunsByMonth(runs);
  return (
    uniq.find((r) => r.month.slice(0, 7) === ym) ??
    uniq.find((r) => (r.cycleStart || "").slice(0, 7) === ym)
  );
}

async function buildAttendanceLinesForCycle(
  cycle: PayrollCycle,
  hrEmployees?: HrMasterOption[],
): Promise<PayrollEmployeeAttendance[]> {
  const hr =
    hrEmployees ??
    (await loadHrMasterDirectory()
      .then((d) => d.employees ?? [])
      .catch(() => [] as HrMasterOption[]));
  const salaries = (hr.length ? [] : load<EmployeeSalary>(K.salaries)).filter(
    (s) => s.salaryStatus === "active",
  );
  const people: HrMasterOption[] = hr.length
    ? hr
    : salaries.map((s) => ({
        id: s.employeeId,
        label: s.employeeName,
        code: s.employeeId,
        department: s.department,
      }));
  if (!people.length) return [];

  const { loadAttendanceForEmployee } = await import("@/services/attendance-management-service");
  const { loadLeaveDirectory } = await import("@/services/leave-management-service");

  const records: Awaited<ReturnType<typeof loadAttendanceForEmployee>> = [];
  const chunkSize = 8;
  for (let i = 0; i < people.length; i += chunkSize) {
    const chunk = people.slice(i, i + chunkSize);
    const parts = await Promise.all(
      chunk.map((p) => loadAttendanceForEmployee(p.id).catch(() => [])),
    );
    for (const rows of parts) records.push(...rows);
  }

  const leaveDir = await loadLeaveDirectory().catch(() => null);
  const leaveRequests = leaveDir?.requests ?? [];

  const refs = people.map((p) => ({
    employeeId: p.id,
    employeeName: hrDisplayName(p),
    employeeCode: p.code ?? "",
    department: p.department ?? "",
    hrEmployeeId: p.id,
  }));

  return summarizePayrollAttendance(cycle, refs, records, leaveRequests);
}

export async function previewPayrollAttendanceForCycle(
  anchorMonth: string,
  cutoverDay?: number,
  hrEmployees?: HrMasterOption[],
): Promise<{ cycle: PayrollCycle; lines: PayrollEmployeeAttendance[] }> {
  const cycle = buildPayrollCycle(anchorMonth, cutoverDay ?? readPayrollCutoverDay());
  const lines = await buildAttendanceLinesForCycle(cycle, hrEmployees);
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

function mapApiStructure(
  s: Record<string, unknown>,
  i: number,
  previous?: SalaryStructure[],
): SalaryStructure {
  const id = String(s.id ?? crypto.randomUUID());
  const name = String(s.structure_name ?? s.name ?? `Structure ${i + 1}`);
  const code = String(s.structure_code ?? s.code ?? "");
  const prev = previous?.find((p) => p.id === id || p.name === name);
  const split = computeCtcSplit({
    grossCtc: asNum(s.gross_ctc ?? s.ctc_amount ?? prev?.grossCtc, 0),
    basicPercent: asNum(s.basic_percent ?? prev?.basicPercent, EXCEL_DEFAULTS.basicPercent),
    hraPercentOfBasic: asNum(
      s.hra_percent_of_basic ?? prev?.hraPercentOfBasic,
      EXCEL_DEFAULTS.hraPercentOfBasic,
    ),
    telephoneAllowance: asNum(s.telephone_allowance ?? prev?.telephoneAllowance, 0),
    employerContribution: asNum(
      s.employer_contribution ?? prev?.employerContribution ?? prev?.pf,
      EXCEL_DEFAULTS.employerContribution,
    ),
  });
  const basic = asNum(s.basic_amount ?? s.basic, split.basic);
  const hra = asNum(s.hra_amount ?? s.hra, split.hra);
  const special = asNum(s.special_allowance, split.specialAllowance);
  const employer = asNum(s.employer_contribution ?? s.pf, split.employerContribution);
  return {
    id,
    code,
    name,
    status: String(s.status ?? prev?.status ?? "draft"),
    grossCtc: asNum(s.gross_ctc, split.monthlyCtc),
    basicPercent: asNum(s.basic_percent, EXCEL_DEFAULTS.basicPercent),
    hraPercentOfBasic: asNum(s.hra_percent_of_basic, EXCEL_DEFAULTS.hraPercentOfBasic),
    telephoneAllowance: asNum(s.telephone_allowance, split.telephoneAllowance),
    employerContribution: employer,
    ctcAmount: asNum(s.ctc_amount, split.ctc),
    pfPercent: asNum(s.pf_percent, EXCEL_DEFAULTS.pfPercent),
    pfWageCeiling: asNum(s.pf_wage_ceiling, EXCEL_DEFAULTS.pfWageCeiling),
    pfFixedCeiling: asNum(s.pf_fixed_ceiling, EXCEL_DEFAULTS.pfFixedCeiling),
    edliAdminAmount: asNum(s.edli_admin_amount, EXCEL_DEFAULTS.edliAdminAmount),
    esiPercent: asNum(s.esi_percent, EXCEL_DEFAULTS.esiPercent),
    esiMonthlyCeiling: asNum(s.esi_monthly_ceiling, EXCEL_DEFAULTS.esiMonthlyCeiling),
    effectiveFrom: String(s.effective_from ?? prev?.effectiveFrom ?? "").slice(0, 10) || undefined,
    version: asNum(s.version, 1),
    basic,
    hra,
    specialAllowance: special,
    medicalAllowance: asNum(s.medical_allowance, 0),
    travelAllowance: asNum(s.travel_allowance, 0),
    foodAllowance: asNum(s.food_allowance, 0),
    internetAllowance: asNum(s.internet_allowance, 0),
    bonus: asNum(s.bonus, 0),
    incentives: asNum(s.incentives, 0),
    overtime: asNum(s.overtime, 0),
    arrears: asNum(s.arrears, 0),
    reimbursement: asNum(s.reimbursement, 0),
    otherEarnings: asNum(s.other_earnings, 0),
    pf: employer,
    esi: asNum(s.esi, 0),
    professionalTax: asNum(s.professional_tax, 0),
    tds: asNum(s.tds, 0),
    loanRecovery: asNum(s.loan_recovery, 0),
    advanceRecovery: asNum(s.advance_recovery, 0),
    insurance: asNum(s.insurance, 0),
    otherDeductions: asNum(s.other_deductions, 0),
    createdAt: prev?.createdAt ?? nowIso(),
  };
}

function normalizeStructures(rows: SalaryStructure[]): SalaryStructure[] {
  const byId = new Map<string, SalaryStructure>();
  for (const row of rows) {
    if (!byId.has(row.id)) byId.set(row.id, row);
  }
  return [...byId.values()];
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
    await loadResolvedPayrollPfPolicy().catch(() => null);
    const overview = await loadPayrollOverview();

    const previous = structures;
    const fromApi = overview.structures.map((s, i) =>
      mapApiStructure(s as Record<string, unknown>, i, previous),
    );
    const localOnly = previous.filter((s) => !UUID_RE.test(s.id));
    structures = normalizeStructures([...fromApi, ...localOnly]);
    save(K.structures, structures);

    const salaryRows = await listAllPayrollRows("/payroll/employee-salaries").catch(() => overview.employeeSalaries);
    const hr = await loadHrMasterDirectory()
      .then((d) => d.employees ?? [])
      .catch(() => [] as HrMasterOption[]);
    const fromSalaryApi = salaryRows
      .map((e) => mapApiEmployeeSalary(e as Record<string, unknown>, structures))
      .filter((row): row is EmployeeSalary => Boolean(row));
    salaries = mergeSalaryLists(salaries, fromSalaryApi, hr);
    save(K.salaries, salaries);

    if (overview.runs.length) {
      const fromApi = overview.runs.map((r, i) => {
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
          status: String(r.status ?? "approved").toLowerCase() as PayrollRunStatus,
          attendanceSynced: true,
          leaveSynced: true,
          otSynced: true,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        });
      });
      const byId = new Map<string, PayrollRun>();
      for (const row of fromApi) byId.set(row.id, row);
      for (const local of runs) {
        const api = byId.get(local.id);
        if (!api) {
          byId.set(local.id, local);
          continue;
        }
        byId.set(local.id, {
          ...api,
          month: local.month || api.month,
          monthLabel: local.monthLabel || api.monthLabel,
          cycleStart: local.cycleStart || api.cycleStart,
          cycleEnd: local.cycleEnd || api.cycleEnd,
          cycleCutoverDay: local.cycleCutoverDay || api.cycleCutoverDay,
          cycleLabel: local.cycleLabel || api.cycleLabel,
          employeeCount: api.employeeCount || local.employeeCount,
          grossTotal: api.grossTotal || local.grossTotal,
          deductionTotal: api.deductionTotal || local.deductionTotal,
          netTotal: api.netTotal || local.netTotal,
          status: local.status === "locked" ? "locked" : api.status || local.status,
        });
      }
      const mergedRuns = [...byId.values()];
      runs = uniqueRunsByMonth(mergedRuns);
      adoptOrphanedRunLines(mergedRuns, runs);
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
      const fromApi = overview.payslips.map((p, i) => ({
        id: String(p.id ?? crypto.randomUUID()),
        payslipCode: String(p.document_number ?? `PSL-${String(i + 1).padStart(6, "0")}`),
        runId: String(p.payroll_run_id ?? ""),
        employeeId: String(p.employee_id ?? ""),
        employeeName: String(p.employee_name ?? "Employee"),
        employeeCode: String(p.employee_code ?? ""),
        month: String(p.month ?? p.payroll_month ?? "").slice(0, 7) || "2026-07",
        monthLabel: monthLabel(String(p.month ?? p.payroll_month ?? "").slice(0, 7) || "2026-07"),
        department: "—",
        bankAccount: "XXXX",
        presentDays: 22,
        leaveDays: 0,
        earnings: [{ label: "Gross", amount: Number(p.gross_earnings ?? p.gross_salary ?? 0) }],
        deductions: [{ label: "Deductions", amount: Number(p.total_deductions ?? 0) }],
        gross: Number(p.gross_earnings ?? p.gross_salary ?? 0),
        totalDeductions: Number(p.total_deductions ?? 0),
        net: Number(p.net_pay ?? p.net_salary ?? 0),
        taxRegime: "new" as const,
        generatedAt: String(p.issued_at ?? p.created_at ?? p.updated_at ?? ""),
      }));
      payslips = uniquePayslips([...fromApi, ...payslips]);
      save(K.payslips, payslips);
    }
  } catch {
    /* offline */
  }

  // Keep API rows; do not invent local templates that overwrite saved CTC.
  if (structures.length) {
    structures = normalizeStructures(structures);
    save(K.structures, structures);
  }

  const beforeDedupe = salaries.length;
  salaries = dedupeEmployeeSalaries(salaries);
  if (salaries.length !== beforeDedupe) save(K.salaries, salaries);

  const normalizedRuns = runs.map(normalizePayrollRun);
  runs = uniqueRunsByMonth(normalizedRuns);
  adoptOrphanedRunLines(normalizedRuns, runs);
  save(K.runs, runs);
  payslips = uniquePayslips(payslips);
  save(K.payslips, payslips);

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
  const prepared = withExcelAmounts(input);
  const payload = structureApiPayload(prepared);
  const res = await resourceService.create<Record<string, unknown>>(
    "/payroll/salary-structures",
    payload,
  );
  const mapped = mapApiStructure((res.data ?? {}) as Record<string, unknown>, 0);
  const row: SalaryStructure = {
    ...prepared,
    ...mapped,
    createdAt: nowIso(),
  };
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
  const prepared = withExcelAmounts({
    ...existing,
    ...input,
    name: input.name,
  });
  if (!UUID_RE.test(id)) {
    throw new Error("This structure is not saved on the server. Create it again from the form.");
  }
  const res = await resourceService.update<Record<string, unknown>>(
    "/payroll/salary-structures",
    id,
    structureApiPayload(prepared, {
      structureCode: existing?.code,
      effectiveFrom: existing?.effectiveFrom,
    }),
  );
  const mapped = mapApiStructure((res.data ?? {}) as Record<string, unknown>, 0, existing ? [existing] : undefined);
  const row: SalaryStructure = {
    ...prepared,
    ...mapped,
    id,
    createdAt: existing?.createdAt ?? nowIso(),
  };
  if (idx >= 0) all[idx] = row;
  else all.unshift(row);
  save(K.structures, all);
  appendPayrollAudit({ action: "structure_updated", detail: row.name, actor: actor() });
  return row;
}

export async function getSalaryStructure(id: string): Promise<SalaryStructure | null> {
  if (UUID_RE.test(id)) {
    try {
      const res = await resourceService.get<Record<string, unknown>>("/payroll/salary-structures", id);
      if (res.data) return mapApiStructure(res.data as Record<string, unknown>, 0);
    } catch (err) {
      devWarn("getSalaryStructure API failed; trying local cache");
    }
  }
  return load<SalaryStructure>(K.structures).find((s) => s.id === id) ?? null;
}

export function deleteStructureLocal(id: string): void {
  save(
    K.structures,
    load<SalaryStructure>(K.structures).filter((s) => s.id !== id),
  );
}

export async function deleteStructure(id: string): Promise<void> {
  if (UUID_RE.test(id)) {
    await resourceService.delete("/payroll/salary-structures", id);
  }
  const existing = load<SalaryStructure>(K.structures).find((s) => s.id === id);
  deleteStructureLocal(id);
  appendPayrollAudit({
    action: "structure_deleted",
    detail: existing?.name ?? id,
    actor: actor(),
  });
}

/** Create Cache Digitech named templates with Excel 60%/50% CTC split. */
export async function resetStructuresToCacheDigitech(): Promise<SalaryStructure[]> {
  const samples: { name: string; code: string; gross: number }[] = [
    { name: "Intern Structure", code: "SS-INTERN", gross: 18000 },
    { name: "Junior Structure", code: "SS-JUNIOR", gross: 36000 },
    { name: "Engineer Structure", code: "SS-ENG", gross: 60000 },
    { name: "Senior Engineer Structure", code: "SS-SENIOR", gross: 90000 },
    { name: "Lead Structure", code: "SS-LEAD", gross: 140000 },
    { name: "Manager Structure", code: "SS-MGR", gross: 200000 },
    { name: "Director Structure", code: "SS-DIR", gross: 300000 },
    { name: "Executive Structure", code: "SS-EXEC", gross: 450000 },
  ];
  const existing = (await loadPayrollDirectory()).structures;
  const created: SalaryStructure[] = [];
  for (const sample of samples) {
    const payload = {
      ...amountsFromSplit(
        computeCtcSplit({
          grossCtc: sample.gross,
          basicPercent: EXCEL_DEFAULTS.basicPercent,
          hraPercentOfBasic: EXCEL_DEFAULTS.hraPercentOfBasic,
          telephoneAllowance: EXCEL_DEFAULTS.telephoneAllowance,
          employerContribution: EXCEL_DEFAULTS.employerContribution,
        }),
      ),
      name: sample.name,
      code: sample.code,
      status: "active" as const,
      basicPercent: EXCEL_DEFAULTS.basicPercent,
      hraPercentOfBasic: EXCEL_DEFAULTS.hraPercentOfBasic,
      pfPercent: EXCEL_DEFAULTS.pfPercent,
      pfWageCeiling: EXCEL_DEFAULTS.pfWageCeiling,
      pfFixedCeiling: EXCEL_DEFAULTS.pfFixedCeiling,
      edliAdminAmount: EXCEL_DEFAULTS.edliAdminAmount,
      esiPercent: EXCEL_DEFAULTS.esiPercent,
      esiMonthlyCeiling: EXCEL_DEFAULTS.esiMonthlyCeiling,
    };
    const match = existing.find(
      (s) => s.code?.toUpperCase() === sample.code || s.name.toLowerCase() === sample.name.toLowerCase(),
    );
    if (match && UUID_RE.test(match.id)) {
      created.push(await updateStructure(match.id, payload));
    } else {
      created.push(await createStructure(payload));
    }
  }
  return created;
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

export async function deleteEmployeeSalary(id: string): Promise<void> {
  if (UUID_RE.test(id)) {
    await resourceService.delete("/payroll/employee-salaries", id);
  }
  const all = load<EmployeeSalary>(K.salaries);
  const existing = all.find((s) => s.id === id);
  save(
    K.salaries,
    all.filter((s) => s.id !== id),
  );
  appendPayrollAudit({
    action: "salary_deleted",
    detail: existing?.employeeName ?? id,
    actor: actor(),
  });
}

export async function runPayroll(month: string, cutoverDay?: number): Promise<PayrollRun> {
  if (isMonthLocked(month)) {
    throw new Error(`Payroll month ${monthLabel(month)} is locked and cannot be processed.`);
  }
  const cutover = cutoverDay ?? readPayrollCutoverDay();
  const cycle = buildPayrollCycle(month, cutover);
  const hr = await loadHrMasterDirectory()
    .then((d) => d.employees ?? [])
    .catch(() => [] as HrMasterOption[]);
  const salaries = (await resolveEmployeeSalaries(hr)).filter((s) => s.salaryStatus === "active");
  if (!salaries.length) {
    throw new Error("Assign salary before running payroll.");
  }
  const attendanceLines = await buildAttendanceLinesForCycle(cycle, hr);
  const factorByEmployee = new Map(
    attendanceLines.map((l) => [l.employeeId.toLowerCase(), l.attendanceFactor]),
  );

  const structures = load<SalaryStructure>(K.structures);
  const structureMap = new Map(structures.map((s) => [s.id, s]));

  let gross = 0;
  let ded = 0;
  const employees = salaries;

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

  const existingSameMonth = findRunForCycle(load<PayrollRun>(K.runs), month, cycle);
  if (existingSameMonth) {
    row.id = existingSameMonth.id;
    row.runCode = existingSameMonth.runCode;
    row.createdAt = existingSameMonth.createdAt;
  }

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
        const reuseId = existingSameMonth && UUID_RE.test(existingSameMonth.id) ? existingSameMonth.id : "";
        let createdDoc: Record<string, unknown> | undefined;
        let runId = reuseId;
        if (!runId) {
          const created = await resourceService.create<Record<string, unknown>>("/payroll/payroll-runs", {
            branch_id: ctx.branchId,
            payroll_period_id: periodId,
            run_date: `${month}-01`,
            run_type: "regular",
            currency_code: "INR",
            status: "draft",
          });
          createdDoc = created.data;
          runId = String(created.data?.id ?? "");
        }
        if (runId) {
          const calculated = await resourceService.action<Record<string, unknown>>(
            "/payroll/payroll-runs",
            runId,
            "calculate",
            {},
          );
          row.id = runId;
          row.runCode = String(calculated.data?.document_number ?? createdDoc?.document_number ?? row.runCode);
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
          try {
            const apiLines = await fetchApiRunLines(runId);
            if (apiLines.length) {
              const payLines = apiLines.map((line) => {
                const empId = String(line.employee_id ?? "");
                const sal = employees.find(
                  (s) => s.employeeId.toLowerCase() === empId.toLowerCase(),
                );
                return mapApiRunLineToEmployeeLine(line, sal);
              });
              row.employeeCount = payLines.length;
              row.grossTotal = payLines.reduce((s, l) => s + l.gross, 0);
              row.deductionTotal = payLines.reduce((s, l) => s + l.deductionTotal, 0);
              row.netTotal = payLines.reduce((s, l) => s + l.net, 0);
              replaceRunInStore(row);
              saveRunEmployeeLines(row.id, payLines);
              if (attendanceLines.length) saveRunAttendance(row.id, attendanceLines);
              appendPayrollAudit({
                action: "payroll_generated",
                detail: `${row.runCode} for ${row.cycleLabel} · net ${formatInr(row.netTotal)} · API 30-day basis`,
                actor: actor(),
              });
              return row;
            }
          } catch {
            devWarn("payroll-run-lines fetch failed; keeping API totals");
          }
        }
      }
    }
  } catch (err) {
    devWarn("runPayroll API failed; local cache kept");
  }

  const payLines = employees.map((sal) =>
    buildEmployeePayLine(sal, findAttendanceLine(attendanceLines, sal.employeeId), structures),
  );
  row.employeeCount = payLines.length;
  row.grossTotal = payLines.reduce((s, l) => s + l.gross, 0);
  row.deductionTotal = payLines.reduce((s, l) => s + l.deductionTotal, 0);
  row.netTotal = payLines.reduce((s, l) => s + l.net, 0);

  replaceRunInStore(row);
  saveRunEmployeeLines(row.id, payLines);
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
  const split = computeCtcSplit({
    grossCtc: 0,
    basicPercent: EXCEL_DEFAULTS.basicPercent,
    hraPercentOfBasic: EXCEL_DEFAULTS.hraPercentOfBasic,
    telephoneAllowance: 0,
    employerContribution: 0,
  });
  return {
    id: "",
    name: "",
    createdAt: "",
    status: "draft",
    ...amountsFromSplit(split),
    basicPercent: EXCEL_DEFAULTS.basicPercent,
    hraPercentOfBasic: EXCEL_DEFAULTS.hraPercentOfBasic,
    pfPercent: EXCEL_DEFAULTS.pfPercent,
    pfWageCeiling: EXCEL_DEFAULTS.pfWageCeiling,
    pfFixedCeiling: EXCEL_DEFAULTS.pfFixedCeiling,
    edliAdminAmount: EXCEL_DEFAULTS.edliAdminAmount,
    esiPercent: EXCEL_DEFAULTS.esiPercent,
    esiMonthlyCeiling: EXCEL_DEFAULTS.esiMonthlyCeiling,
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
    employeeCode: String(p.employee_code ?? emp.code ?? emp.employee_code ?? ""),
    month: run.month,
    monthLabel: run.monthLabel,
    department: "—",
    bankAccount: "—",
    presentDays: Number(att.present ?? att.paid_days ?? 0),
    leaveDays: Number(att.paid_leave ?? att.leave_days ?? 0),
    payableDays: Number(att.payable_days ?? att.paid_days ?? 0),
    periodDays: Number(att.period_days ?? SALARY_DAY_BASIS),
    lopDays: Number(att.lop_days ?? 0),
    weeklyOff: Number(att.week_off ?? 0),
    holidays: Number(att.holiday ?? 0),
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

  const localLines = listPayrollRunEmployeeLines(runId);
  if (localLines.length) {
    const slips = payslipsFromRunLines(run, localLines);
    persistPayslipsForRun(run, slips);
    appendPayrollAudit({
      action: "payslips_generated",
      detail: `${slips.length} payslips for ${monthLabel(run.month)}`,
      actor: actor(),
    });
    return slips;
  }

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
        persistPayslipsForRun(run, slips);
        appendPayrollAudit({
          action: "payslips_generated",
          detail: `${slips.length} payslips (API) for ${run.monthLabel}`,
          actor: actor(),
        });
        return slips;
      }
    } catch {
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
            employeeCode: String(created.data?.employee_code ?? ""),
            month: run.month.slice(0, 7),
            monthLabel: monthLabel(run.month),
            department: "—",
            bankAccount: "—",
            presentDays: Number(line.day_summary_json && (line.day_summary_json as Record<string, unknown>).counts
              ? ((line.day_summary_json as { counts?: { present?: number } }).counts?.present ?? 0)
              : 0),
            leaveDays: Number(line.leave_days ?? 0),
            payableDays: Number(line.paid_days ?? 0),
            periodDays: Number(line.period_days ?? SALARY_DAY_BASIS),
            lopDays: Number(line.lop_days ?? 0),
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
          persistPayslipsForRun(run, slips);
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

  const fromRun = listPayrollRunEmployeeLines(runId);
  let slips = fromRun.length ? payslipsFromRunLines(run, fromRun) : [];

  if (!slips.length) {
    const salaries = load<EmployeeSalary>(K.salaries);
    const structures = load<SalaryStructure>(K.structures);
    const structureMap = new Map(structures.map((s) => [s.id, s]));
    const employees = salaries.filter((s) => s.salaryStatus === "active");
    slips = employees.map((sal) => {
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
            { label: "ESI", amount: st.esi },
            { label: "Professional Tax", amount: st.professionalTax },
            { label: "TDS", amount: st.tds },
            { label: "Loan Recovery", amount: st.loanRecovery },
            { label: "Advance Recovery", amount: st.advanceRecovery },
            { label: "Insurance", amount: st.insurance },
            { label: "Other Deductions", amount: st.otherDeductions },
          ].filter((d) => d.amount > 0)
        : [];
      const gross = Math.round(earnings.reduce((s, e) => s + e.amount, 0) * factor);
      const scaledEarnings = earnings.map((e) => ({
        ...e,
        amount: Math.round(e.amount * factor),
      }));
      const monthlyBasic = earnings.find((e) => e.label.toLowerCase() === "basic")?.amount ?? 0;
      const cycleBasic = scaledEarnings.find((e) => e.label.toLowerCase() === "basic")?.amount ?? 0;
      const scaledDeductions = [
        ...pfDeductionRows(getCachedPayrollPfPolicy(), { monthlyBasic, cycleBasic, factor }),
        ...deductions.map((d) => ({
          ...d,
          amount: scalePayAmount(d.label, d.amount, factor),
        })),
      ];
      const totalDeductions = scaledDeductions.reduce((s, d) => s + d.amount, 0);
      return {
        id: crypto.randomUUID(),
        payslipCode: nextCode("slip", "PSL"),
        runId,
        employeeId: sal.employeeId,
        employeeName: sal.employeeName,
        month: run.month.slice(0, 7),
        monthLabel: monthLabel(run.month),
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
  }

  if (!slips.length) {
    throw new Error("No employees on this payroll run. Run payroll for the month first.");
  }

  persistPayslipsForRun(run, slips);
  appendPayrollAudit({
    action: "payslips_generated",
    detail: `${slips.length} payslips for ${monthLabel(run.month)}`,
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

export function uniqueRunsByMonth(runs: PayrollRun[]): PayrollRun[] {
  const rank = (status: string) => {
    const s = status.toLowerCase();
    if (s === "locked" || s === "paid" || s === "posted") return 5;
    if (s === "approved") return 4;
    if (s === "pending_hr" || s === "pending_finance" || s === "processing" || s === "calculated") return 3;
    if (s === "draft") return 1;
    return 2;
  };
  const byMonth = new Map<string, PayrollRun>();
  for (const run of runs) {
    const key = payrollRunGroupKey(run);
    const prev = byMonth.get(key);
    if (!prev) {
      byMonth.set(key, run);
      continue;
    }
    const betterStatus = rank(run.status) > rank(prev.status);
    const sameStatus = rank(run.status) === rank(prev.status);
    const newer = (run.updatedAt || run.createdAt || "") >= (prev.updatedAt || prev.createdAt || "");
    const apiPreferred = UUID_RE.test(run.id) && !UUID_RE.test(prev.id);
    if (betterStatus || (sameStatus && (apiPreferred || newer))) {
      byMonth.set(key, run);
    }
  }
  return [...byMonth.values()].sort((a, b) =>
    (b.cycleStart || b.month).localeCompare(a.cycleStart || a.month),
  );
}

export function filterRuns(runs: PayrollRun[], f: PayrollFilters) {
  const q = f.query.trim().toLowerCase();
  return uniqueRunsByMonth(
    runs.filter((r) => {
    const locked = isMonthLocked(r.month) || r.status === "locked";
    if (f.status === "locked" && !locked) return false;
    if (f.status === "unlocked" && locked) return false;
    if (f.status === "run" && locked) return false;
    if (f.month === "custom") {
      if (f.customMonth && r.month !== f.customMonth) return false;
    } else if (f.month === "range") {
      const from = f.dateFrom;
      const to = f.dateTo;
      if (from && (r.cycleEnd || r.month) < from) return false;
      if (to && (r.cycleStart || r.month) > to) return false;
    } else if (f.month !== "all" && r.month !== f.month) {
      return false;
    }
    if (!q) return true;
    return [r.runCode, r.monthLabel, r.cycleLabel, r.status].join(" ").toLowerCase().includes(q);
    }),
  );
}

export function importStructuresCsv(text: string): number {
  const lines = text.trim().split(/\r?\n/).slice(1);
  let n = 0;
  for (const line of lines) {
    const [name, gross] = line.split(",").map((c) => c.replace(/^"|"$/g, "").trim());
    if (!name) continue;
    const grossCtc = Number(gross) || 18000;
    void createStructure({
      ...amountsFromSplit(
        computeCtcSplit({
          grossCtc,
          basicPercent: EXCEL_DEFAULTS.basicPercent,
          hraPercentOfBasic: EXCEL_DEFAULTS.hraPercentOfBasic,
          telephoneAllowance: EXCEL_DEFAULTS.telephoneAllowance,
          employerContribution: EXCEL_DEFAULTS.employerContribution,
        }),
      ),
      name,
      status: "active",
      basicPercent: EXCEL_DEFAULTS.basicPercent,
      hraPercentOfBasic: EXCEL_DEFAULTS.hraPercentOfBasic,
      pfPercent: EXCEL_DEFAULTS.pfPercent,
      pfWageCeiling: EXCEL_DEFAULTS.pfWageCeiling,
      pfFixedCeiling: EXCEL_DEFAULTS.pfFixedCeiling,
      edliAdminAmount: EXCEL_DEFAULTS.edliAdminAmount,
      esiPercent: EXCEL_DEFAULTS.esiPercent,
      esiMonthlyCeiling: EXCEL_DEFAULTS.esiMonthlyCeiling,
    });
    n += 1;
  }
  return n;
}
