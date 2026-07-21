import { ApiClientError, resourceService } from "@/services/api-client";

export type PayrollRow = Record<string, unknown>;

export type PayrollOverview = {
  periods: PayrollRow[];
  structures: PayrollRow[];
  components: PayrollRow[];
  employeeSalaries: PayrollRow[];
  earningTypes: PayrollRow[];
  deductionTypes: PayrollRow[];
  taxConfigs: PayrollRow[];
  statutory: PayrollRow[];
  runs: PayrollRow[];
  payslips: PayrollRow[];
  bonuses: PayrollRow[];
  reimbursements: PayrollRow[];
  loans: PayrollRow[];
  adjustments: PayrollRow[];
  summaries: PayrollRow[];
  errors: string[];
  statusCodes: number[];
  partial: boolean;
};

function normalizeRows(data: unknown): PayrollRow[] {
  if (Array.isArray(data)) {
    return data.filter((row): row is PayrollRow => !!row && typeof row === "object");
  }
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.rows)) return normalizeRows(obj.rows);
    for (const key of ["items", "results", "records", "data", "lines"]) {
      if (Array.isArray(obj[key])) return normalizeRows(obj[key]);
    }
    return [obj];
  }
  return [];
}

async function safeList(
  apiPath: string,
): Promise<{ rows: PayrollRow[]; error?: string; status?: number }> {
  try {
    const response = await resourceService.list(apiPath);
    return { rows: normalizeRows(response.data) };
  } catch (err) {
    if (err instanceof ApiClientError) {
      return { rows: [], error: err.message, status: err.status };
    }
    return { rows: [], error: `Failed to load ${apiPath}`, status: 500 };
  }
}

export function formatInr(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function asStatus(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : "";
}

export function sumField(rows: PayrollRow[], field: string): number {
  return rows.reduce((sum, row) => sum + asNumber(row[field]), 0);
}

export function countByStatus(rows: PayrollRow[], statuses: string[]): number {
  const set = new Set(statuses.map((s) => s.toLowerCase()));
  return rows.filter((row) => set.has(asStatus(row.status))).length;
}

export function countByPaymentStatus(rows: PayrollRow[], statuses: string[]): number {
  const set = new Set(statuses.map((s) => s.toLowerCase()));
  return rows.filter((row) => set.has(asStatus(row.payment_status))).length;
}

export function countOpenDocs(rows: PayrollRow[], closedStatuses: string[]): number {
  const closed = new Set(closedStatuses.map((s) => s.toLowerCase()));
  return rows.filter((row) => {
    const status = asStatus(row.status);
    if (!status) return true;
    return !closed.has(status);
  }).length;
}

export async function loadPayrollOverview(): Promise<PayrollOverview> {
  const [
    periods,
    structures,
    components,
    employeeSalaries,
    earningTypes,
    deductionTypes,
    taxConfigs,
    statutory,
    runs,
    payslips,
    bonuses,
    reimbursements,
    loans,
    adjustments,
    summaries,
  ] = await Promise.all([
    safeList("/payroll/payroll-periods"),
    safeList("/payroll/salary-structures"),
    safeList("/payroll/salary-components"),
    safeList("/payroll/employee-salaries"),
    safeList("/payroll/earning-types"),
    safeList("/payroll/deduction-types"),
    safeList("/payroll/tax-configurations"),
    safeList("/payroll/statutory-contributions"),
    safeList("/payroll/payroll-runs"),
    safeList("/payroll/payslips"),
    safeList("/payroll/bonuses"),
    safeList("/payroll/reimbursements"),
    safeList("/payroll/loans"),
    safeList("/payroll/payroll-adjustments"),
    safeList("/payroll/payroll-summaries"),
  ]);

  const results = [
    periods,
    structures,
    components,
    employeeSalaries,
    earningTypes,
    deductionTypes,
    taxConfigs,
    statutory,
    runs,
    payslips,
    bonuses,
    reimbursements,
    loans,
    adjustments,
    summaries,
  ];
  const errors = results.map((r) => r.error).filter((e): e is string => Boolean(e));
  const statusCodes = results
    .map((r) => r.status)
    .filter((s): s is number => typeof s === "number");

  return {
    periods: periods.rows,
    structures: structures.rows,
    components: components.rows,
    employeeSalaries: employeeSalaries.rows,
    earningTypes: earningTypes.rows,
    deductionTypes: deductionTypes.rows,
    taxConfigs: taxConfigs.rows,
    statutory: statutory.rows,
    runs: runs.rows,
    payslips: payslips.rows,
    bonuses: bonuses.rows,
    reimbursements: reimbursements.rows,
    loans: loans.rows,
    adjustments: adjustments.rows,
    summaries: summaries.rows,
    errors,
    statusCodes,
    partial: errors.length > 0,
  };
}
