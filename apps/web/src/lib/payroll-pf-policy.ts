import { resourceService } from "@/services/api-client";
import { isPfDeductionLabel } from "@/lib/payroll-cycle";

export type PayrollPfPolicy = {
  pf_mode: string;
  pf_employee_amount: number;
  pf_employer_amount: number;
  pf_employee_percent: number;
  pf_employer_percent: number;
  pf_wage_ceiling: number;
  pf_on_lop: string;
  net_pay_formula: string;
};

export const DEFAULT_PAYROLL_PF_POLICY: PayrollPfPolicy = {
  pf_mode: "fixed_split",
  pf_employee_amount: 1800,
  pf_employer_amount: 1900,
  pf_employee_percent: 0.12,
  pf_employer_percent: 0.12,
  pf_wage_ceiling: 15000,
  pf_on_lop: "fixed",
  net_pay_formula: "gross_minus_employee_pf_only",
};

const STORAGE_KEY = "erp.payroll.resolvedPolicy";

let memory: PayrollPfPolicy | null = null;

function asNum(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asRate(value: unknown, fallback: number): number {
  const n = asNum(value, fallback);
  return n > 1 ? n / 100 : n;
}

export function parsePayrollPfPolicy(row: Record<string, unknown> | null | undefined): PayrollPfPolicy {
  if (!row) return { ...DEFAULT_PAYROLL_PF_POLICY };
  return {
    pf_mode: String(row.pf_mode ?? DEFAULT_PAYROLL_PF_POLICY.pf_mode),
    pf_employee_amount: asNum(row.pf_employee_amount, DEFAULT_PAYROLL_PF_POLICY.pf_employee_amount),
    pf_employer_amount: asNum(row.pf_employer_amount, DEFAULT_PAYROLL_PF_POLICY.pf_employer_amount),
    pf_employee_percent: asRate(row.pf_employee_percent, DEFAULT_PAYROLL_PF_POLICY.pf_employee_percent),
    pf_employer_percent: asRate(row.pf_employer_percent, DEFAULT_PAYROLL_PF_POLICY.pf_employer_percent),
    pf_wage_ceiling: asNum(row.pf_wage_ceiling, DEFAULT_PAYROLL_PF_POLICY.pf_wage_ceiling),
    pf_on_lop: String(row.pf_on_lop ?? DEFAULT_PAYROLL_PF_POLICY.pf_on_lop),
    net_pay_formula: String(row.net_pay_formula ?? DEFAULT_PAYROLL_PF_POLICY.net_pay_formula),
  };
}

function readStored(): PayrollPfPolicy {
  if (typeof window === "undefined") return { ...DEFAULT_PAYROLL_PF_POLICY };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PAYROLL_PF_POLICY };
    return parsePayrollPfPolicy(JSON.parse(raw) as Record<string, unknown>);
  } catch {
    return { ...DEFAULT_PAYROLL_PF_POLICY };
  }
}

export function getCachedPayrollPfPolicy(): PayrollPfPolicy {
  if (memory) return memory;
  memory = readStored();
  return memory;
}

export async function loadResolvedPayrollPfPolicy(): Promise<PayrollPfPolicy> {
  try {
    await resourceService.create("/payroll/policies/ensure-default", {}).catch(() => null);
    const res = await resourceService.list<Record<string, unknown>>("/payroll/policies/resolved");
    const row = (res.data ?? {}) as Record<string, unknown>;
    memory = parsePayrollPfPolicy(row);
  } catch {
    memory = getCachedPayrollPfPolicy();
  }
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  }
  return memory;
}

function percentPf(rate: number, monthlyBasic: number, cycleBasic: number, policy: PayrollPfPolicy): number {
  const base = policy.pf_on_lop === "fixed" ? monthlyBasic : cycleBasic;
  const ceiling = policy.pf_wage_ceiling > 0 ? policy.pf_wage_ceiling : base;
  const wage = Math.min(Math.max(0, base), ceiling);
  return Math.round(wage * rate);
}

function fixedPf(amount: number, factor: number, policy: PayrollPfPolicy): number {
  const n = Math.max(0, amount);
  if (policy.pf_on_lop === "prorated" || policy.pf_on_lop === "percentage_of_pf_wage") {
    return Math.round(n * Math.min(1, Math.max(0, factor)));
  }
  return Math.round(n);
}

export function employeePfAmount(
  policy: PayrollPfPolicy,
  ctx: { monthlyBasic: number; cycleBasic: number; factor: number },
): number {
  const mode = policy.pf_mode;
  if (mode === "percentage" || mode === "statutory_percent") {
    return percentPf(policy.pf_employee_percent, ctx.monthlyBasic, ctx.cycleBasic, policy);
  }
  return fixedPf(policy.pf_employee_amount, ctx.factor, policy);
}

export function employerPfAmount(
  policy: PayrollPfPolicy,
  ctx: { monthlyBasic: number; cycleBasic: number; factor: number },
): number {
  const mode = policy.pf_mode;
  if (mode === "percentage" || mode === "statutory_percent") {
    return percentPf(policy.pf_employer_percent, ctx.monthlyBasic, ctx.cycleBasic, policy);
  }
  return fixedPf(policy.pf_employer_amount, ctx.factor, policy);
}

export function pfDeductionRows(
  policy: PayrollPfPolicy,
  ctx: { monthlyBasic: number; cycleBasic: number; factor: number },
): { label: string; amount: number }[] {
  const rows: { label: string; amount: number }[] = [];
  const ee = employeePfAmount(policy, ctx);
  if (ee > 0) rows.push({ label: "Employee PF", amount: ee });
  if (policy.net_pay_formula === "gross_minus_fixed_pf_total") {
    const er = employerPfAmount(policy, ctx);
    if (er > 0) rows.push({ label: "Employer PF", amount: er });
  }
  return rows;
}

export function replacePfDeductions(
  items: { label: string; amount: number }[],
  policy: PayrollPfPolicy,
  ctx: { monthlyBasic: number; cycleBasic: number; factor: number },
): { label: string; amount: number }[] {
  const rest = items.filter((d) => !isPfDeductionLabel(d.label));
  return [...pfDeductionRows(policy, ctx), ...rest].filter((d) => d.amount > 0);
}
