/**
 * Payroll CTC + statutory formulas (mapped from Payroll Calculator.xlsx, corrected).
 *
 * H = G (monthly CTC)
 * I = H × basic%
 * J = I × hra%
 * K = H − I − J − M − L   (Special; must stay ≥ 0)
 * N = SUM(I:M)
 * R/S/U = component × Q/O
 * T = K × Q/O             (NOT (N×Q/O)−R−S−U−M — that breaks under LOP)
 * W = R+S+T+U+V
 * X = R+T
 * Y = MIN(X, pfCeiling) × pf%
 * Z = EDLI/admin — employer cost only (never in employee AC)
 * AA = employee ESI 0.75% when annualised gross < ceiling
 * AE = N×12; AG = annual tax on AE; AH = ROUNDUP(AG/12) (Excel sheet)
 * AC = Y + AA + AB (+ PT/other EE only)
 * AD = W − AC
 */

export type CtcSplitInput = {
  grossCtc: number;
  basicPercent: number;
  hraPercentOfBasic: number;
  telephoneAllowance: number;
  employerContribution: number;
};

export type CtcSplit = {
  monthlyCtc: number;
  basic: number;
  hra: number;
  specialAllowance: number;
  telephoneAllowance: number;
  employerContribution: number;
  /** Employee earnings at full month (excludes employer contribution). */
  employeeGross: number;
  ctc: number;
  difference: number;
  /** False when Special would be negative. */
  valid: boolean;
};

export type StatutoryInput = {
  pfPercent: number;
  /** PF wage ceiling (Excel used 25000; EPFO default often 15000). */
  pfWageCeiling: number;
  /** @deprecated Ignored — PF = MIN(wage, ceiling) × rate. Kept for API compat. */
  pfFixedCeiling?: number;
  edliAdminAmount: number;
  esiPercent: number;
  esiEmployerPercent?: number;
  esiMonthlyCeiling: number;
  totalDays: number;
  payableDays: number;
  advanceArrear: number;
  /** TDS already deducted this FY (Excel AF). */
  tdsAlreadyDeducted?: number;
  /** Remaining payroll months including current (default 12). */
  remainingMonths?: number;
};

export const EXCEL_DEFAULTS = {
  basicPercent: 0.6,
  hraPercentOfBasic: 0.5,
  telephoneAllowance: 0,
  employerContribution: 1800,
  pfPercent: 0.12,
  /** Matches sheet Y: IF(X<25000, X*12%, 3000) ≡ MIN(X,25000)*12%. */
  pfWageCeiling: 25000,
  pfFixedCeiling: 3000,
  edliAdminAmount: 0,
  esiPercent: 0.0075,
  esiEmployerPercent: 0.0325,
  esiMonthlyCeiling: 21000,
  totalDays: 30,
  payableDays: 30,
  advanceArrear: 0,
} as const;

export function rupee(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

export function roundUpRupee(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.ceil(n));
}

/** Y = MIN(PF wage, ceiling) × rate */
export function employeePfFromWage(
  pfWage: number,
  percent: number = EXCEL_DEFAULTS.pfPercent,
  ceiling: number = EXCEL_DEFAULTS.pfWageCeiling,
): number {
  const base = Math.max(0, pfWage);
  const cap = ceiling > 0 ? Math.min(base, ceiling) : base;
  return rupee(cap * percent);
}

/** Excel H–N */
export function computeCtcSplit(input: CtcSplitInput): CtcSplit {
  const monthlyCtc = rupee(input.grossCtc);
  const basic = rupee(monthlyCtc * input.basicPercent);
  const hra = rupee(basic * input.hraPercentOfBasic);
  const telephoneAllowance = rupee(input.telephoneAllowance);
  const employerContribution = rupee(input.employerContribution);
  const specialRaw = monthlyCtc - basic - hra - employerContribution - telephoneAllowance;
  const specialAllowance = rupee(specialRaw);
  const employeeGross = rupee(basic + hra + specialAllowance + telephoneAllowance);
  const ctc = rupee(employeeGross + employerContribution);
  return {
    monthlyCtc,
    basic,
    hra,
    specialAllowance,
    telephoneAllowance,
    employerContribution,
    employeeGross,
    ctc,
    difference: rupee(ctc - monthlyCtc),
    valid: specialRaw >= -0.5,
  };
}

/** Excel AG2 — new regime (standard deduction ₹75,000 inside). */
export function tdsForTheYear(annualSalary: number): number {
  const ni = Math.max(0, annualSalary - 75000);
  const baseTax =
    Math.max(0, ni - 400000) * 0.05 +
    Math.max(0, ni - 800000) * 0.05 +
    Math.max(0, ni - 1200000) * 0.05 +
    Math.max(0, ni - 1600000) * 0.05 +
    Math.max(0, ni - 2000000) * 0.05 +
    Math.max(0, ni - 2400000) * 0.05;
  const taxAfterRebate = ni <= 1200000 ? 0 : Math.min(baseTax, ni - 1200000);
  let totalBeforeCess = taxAfterRebate;
  if (ni > 10000000) {
    totalBeforeCess = Math.min(taxAfterRebate * 1.15, 2838000 + (ni - 10000000));
  } else if (ni > 5000000) {
    totalBeforeCess = Math.min(taxAfterRebate * 1.1, 1080000 + (ni - 5000000));
  }
  return rupee(totalBeforeCess * 1.04);
}

/** Excel AH — remaining tax / remaining months (falls back to ÷12). */
export function tdsForTheMonth(
  annualSalary: number,
  opts?: { alreadyDeducted?: number; remainingMonths?: number },
): number {
  const yearly = tdsForTheYear(annualSalary);
  const remaining = Math.max(0, yearly - (opts?.alreadyDeducted ?? 0));
  const months = Math.max(1, Math.floor(opts?.remainingMonths ?? 12));
  return roundUpRupee(remaining / months);
}

/** Old-regime tax on already-reduced taxable income (slabs + §87A + 4% cess). */
export function oldRegimeTaxOnTaxable(taxableIncome: number): number {
  const ti = Math.max(0, taxableIncome);
  let tax =
    Math.max(0, Math.min(ti, 500000) - 250000) * 0.05 +
    Math.max(0, Math.min(ti, 1000000) - 500000) * 0.2 +
    Math.max(0, ti - 1000000) * 0.3;
  if (ti <= 500000) tax = Math.max(0, tax - 12500);
  let totalBeforeCess = tax;
  if (ti > 10000000) {
    totalBeforeCess = Math.min(tax * 1.15, tax + (ti - 10000000) * 0.37);
  } else if (ti > 5000000) {
    totalBeforeCess = Math.min(tax * 1.1, tax + (ti - 5000000) * 0.37);
  }
  return rupee(totalBeforeCess * 1.04);
}

export type PayablePreview = {
  payableBasic: number;
  payableHra: number;
  payableSpecial: number;
  payableTelephone: number;
  gross: number;
  pfWage: number;
  pf: number;
  /** Employer cost — not in totalDed. */
  edli: number;
  esi: number;
  employerEsi: number;
  tdsYear: number;
  tdsMonth: number;
  /** Employee deductions only (Y + AA + AB). */
  totalDed: number;
  net: number;
  /** Excel AE = N×12 (full CTC annual, matches sheet). */
  annualSalary: number;
  employerCost: number;
};

/** Excel O–AD sample month (does not post payroll). */
export function computePayablePreview(split: CtcSplit, statutory: StatutoryInput): PayablePreview {
  const o = statutory.totalDays || 30;
  const q = Math.max(0, statutory.payableDays);
  const factor = o > 0 ? q / o : 0;
  const payableBasic = rupee(split.basic * factor);
  const payableHra = rupee(split.hra * factor);
  const payableTelephone = rupee(split.telephoneAllowance * factor);
  // T = K × Q/O (corrected — do not subtract unprorated M from prorated N)
  const payableSpecial = rupee(Math.max(0, split.specialAllowance) * factor);
  const advance = rupee(statutory.advanceArrear);
  const gross = rupee(payableBasic + payableHra + payableSpecial + payableTelephone + advance);
  const pfWage = rupee(payableBasic + payableSpecial);
  const pf = employeePfFromWage(pfWage, statutory.pfPercent, statutory.pfWageCeiling);
  const edli = rupee(statutory.edliAdminAmount);
  const earned = Math.max(0, gross - advance);
  const annualised = q > 0 ? rupee((earned * o) / q) : rupee(split.employeeGross);
  const esiRate = statutory.esiPercent;
  const esiErRate = statutory.esiEmployerPercent ?? EXCEL_DEFAULTS.esiEmployerPercent;
  const esiApplies = annualised < statutory.esiMonthlyCeiling;
  const esi = esiApplies ? rupee(earned * esiRate) : 0;
  const employerEsi = esiApplies ? rupee(earned * esiErRate) : 0;
  // Excel AE = N×12; AH = ROUNDUP(AG/12) (or remaining tax ÷ remaining months when provided)
  const annualSalary = rupee(split.ctc * 12);
  const tdsYear = tdsForTheYear(annualSalary);
  const tdsMonth = tdsForTheMonth(annualSalary, {
    alreadyDeducted: statutory.tdsAlreadyDeducted,
    remainingMonths: statutory.remainingMonths ?? 12,
  });
  const totalDed = rupee(pf + esi + tdsMonth);
  const net = rupee(gross - totalDed);
  const employerCost = rupee(split.employerContribution + edli + employerEsi);
  return {
    payableBasic,
    payableHra,
    payableSpecial,
    payableTelephone,
    gross,
    pfWage,
    pf,
    edli,
    esi,
    employerEsi,
    tdsYear,
    tdsMonth,
    totalDed,
    net,
    annualSalary,
    employerCost,
  };
}

/** Zero payroll-run fields that are not part of the CTC template. */
export function blankRunComponents() {
  return {
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
    esi: 0,
    professionalTax: 0,
    tds: 0,
    loanRecovery: 0,
    advanceRecovery: 0,
    insurance: 0,
    otherDeductions: 0,
  };
}

export function amountsFromSplit(split: CtcSplit) {
  const employeePf = employeePfFromWage(
    split.basic + split.specialAllowance,
    EXCEL_DEFAULTS.pfPercent,
    EXCEL_DEFAULTS.pfWageCeiling,
  );
  return {
    grossCtc: split.monthlyCtc,
    telephoneAllowance: split.telephoneAllowance,
    employerContribution: split.employerContribution,
    ctcAmount: split.ctc,
    basic: split.basic,
    hra: split.hra,
    specialAllowance: Math.max(0, split.specialAllowance),
    /** Employee PF — never the employer contribution. */
    pf: employeePf,
    ...blankRunComponents(),
  };
}
