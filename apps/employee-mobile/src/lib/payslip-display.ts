import type { EssPayslip } from "@/types/api";

export type MoneyLine = { label: string; amount: number };

export function formatInr(value: number | string, hidden = false, prefix = "₹") {
  if (hidden) return "••••";
  const n = Number(value) || 0;
  return `${prefix}${n.toLocaleString("en-IN")}`;
}

export function humanizeKey(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function toMoneyLines(source: unknown): MoneyLine[] {
  if (Array.isArray(source)) {
    return source
      .map((row) => {
        const item = row as { label?: string; code?: string; amount?: number };
        const amount = Number(item.amount) || 0;
        const label =
          (item.label && String(item.label).trim()) ||
          (item.code ? humanizeKey(String(item.code)) : "Item");
        return { label, amount };
      })
      .filter((row) => row.amount !== 0 || /basic/i.test(row.label));
  }
  if (source && typeof source === "object") {
    return Object.entries(source as Record<string, unknown>)
      .map(([key, value]) => ({
        label: humanizeKey(key),
        amount: Number(value) || 0,
      }))
      .filter((row) => row.amount !== 0);
  }
  return [];
}

export function periodLabel(
  slip: Pick<
    EssPayslip,
    "period_name" | "period_start" | "period_end" | "issued_at" | "document_number"
  >,
) {
  if (slip.period_name) return slip.period_name;
  if (slip.issued_at) {
    return new Date(slip.issued_at).toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    });
  }
  if (slip.period_start) {
    return new Date(slip.period_start).toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    });
  }
  return slip.document_number;
}

function linesFromBreakdown(bd: Record<string, unknown>): {
  earnings: MoneyLine[];
  deductions: MoneyLine[];
} {
  const earningKeys: Array<[string, string[]]> = [
    ["Basic Salary", ["basic", "basic_salary", "basic_pay"]],
    ["House Rent Allowance (HRA)", ["hra", "house_rent_allowance"]],
    ["Special Allowance", ["special", "special_allowance"]],
    ["Medical", ["medical"]],
    ["Conveyance", ["conveyance"]],
    ["LTA", ["lta"]],
    ["Overtime", ["ot", "overtime", "overtime_pay"]],
    ["Performance Bonus", ["bonus"]],
    ["Arrears", ["arrears"]],
    ["Performance Incentive", ["incentive", "incentives"]],
  ];
  const deductionKeys: Array<[string, string[]]> = [
    ["Provident Fund (EPF)", ["pf_employee", "pf", "employee_pf", "ee_pf"]],
    ["ESI", ["esi", "esi_employee"]],
    ["Professional Tax (PT)", ["pt", "professional_tax"]],
    ["Income Tax (TDS)", ["tds", "tax", "income_tax", "itax"]],
    ["Other Deductions", ["adj", "deduction_adjustments", "other_deductions"]],
  ];
  const skip = new Set([
    "pf_employer",
    "employer_pf",
    "empr_pf",
    "pf_total",
    "gross",
    "net",
    "net_pay",
  ]);

  const lowered: Record<string, number> = {};
  for (const [key, value] of Object.entries(bd)) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount === 0) continue;
    lowered[key.toLowerCase()] = amount;
  }

  const used = new Set<string>();
  const earnings: MoneyLine[] = [];
  for (const [label, aliases] of earningKeys) {
    for (const alias of aliases) {
      if (alias in lowered) {
        earnings.push({ label, amount: lowered[alias]! });
        used.add(alias);
        break;
      }
    }
  }
  const deductions: MoneyLine[] = [];
  for (const [label, aliases] of deductionKeys) {
    for (const alias of aliases) {
      if (alias in lowered) {
        deductions.push({ label, amount: lowered[alias]! });
        used.add(alias);
        break;
      }
    }
  }

  if (!earnings.length && !deductions.length) {
    for (const [key, amount] of Object.entries(lowered)) {
      if (skip.has(key) || used.has(key)) continue;
      earnings.push({ label: humanizeKey(key), amount });
    }
  }

  return { earnings, deductions };
}

export function parsePayslipLines(slip: EssPayslip) {
  const pj = (slip.payslip_json ?? {}) as Record<string, unknown>;
  let earnings = toMoneyLines(slip.earnings ?? pj.earnings);
  let deductions = toMoneyLines(slip.deductions ?? pj.deductions);

  if (!earnings.length || !deductions.length) {
    const bd =
      (pj.component_breakdown as Record<string, unknown> | undefined) ||
      (typeof pj.components === "object" && pj.components
        ? (pj.components as Record<string, unknown>)
        : undefined);
    if (bd && typeof bd === "object") {
      const built = linesFromBreakdown(bd);
      if (!earnings.length) earnings = built.earnings;
      if (!deductions.length) deductions = built.deductions;
    }
  }

  const grossFromLines = earnings.reduce((s, r) => s + r.amount, 0);
  const dedFromLines = deductions.reduce((s, r) => s + r.amount, 0);
  const gross = Number(slip.gross_salary) || grossFromLines;
  const deductionsTotal = Number(slip.total_deductions) || dedFromLines;
  const net = Number(slip.net_salary) || Math.max(0, gross - deductionsTotal);

  return {
    net,
    gross,
    deductionsTotal,
    earnings:
      earnings.length > 0
        ? earnings
        : gross
          ? [{ label: "Gross earnings", amount: gross }]
          : [],
    deductions:
      deductions.length > 0
        ? deductions
        : deductionsTotal
          ? [{ label: "Total deductions", amount: deductionsTotal }]
          : [],
    attendance:
      slip.attendance_summary ??
      (pj.attendance as Record<string, unknown> | undefined) ??
      {},
  };
}
