/** Payroll Calculator.xlsx formulas (Gross CTC → CTC split + sample month preview). */

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
  ctc: number;
  difference: number;
};

export type StatutoryInput = {
  pfPercent: number;
  pfWageCeiling: number;
  pfFixedCeiling: number;
  edliAdminAmount: number;
  esiPercent: number;
  esiMonthlyCeiling: number;
  totalDays: number;
  payableDays: number;
  advanceArrear: number;
};

export const EXCEL_DEFAULTS = {
  basicPercent: 0.6,
  hraPercentOfBasic: 0.5,
  telephoneAllowance: 0,
  employerContribution: 1800,
  pfPercent: 0.12,
  pfWageCeiling: 15000,
  pfFixedCeiling: 1800,
  edliAdminAmount: 100,
  esiPercent: 0.0075,
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

/** Excel H–N */
export function computeCtcSplit(input: CtcSplitInput): CtcSplit {
  const monthlyCtc = rupee(input.grossCtc);
  const basic = rupee(monthlyCtc * input.basicPercent);
  const hra = rupee(basic * input.hraPercentOfBasic);
  const telephoneAllowance = rupee(input.telephoneAllowance);
  const employerContribution = rupee(input.employerContribution);
  const specialAllowance = rupee(
    monthlyCtc - basic - hra - employerContribution - telephoneAllowance,
  );
  const ctc = rupee(basic + hra + specialAllowance + telephoneAllowance + employerContribution);
  return {
    monthlyCtc,
    basic,
    hra,
    specialAllowance,
    telephoneAllowance,
    employerContribution,
    ctc,
    difference: rupee(ctc - monthlyCtc),
  };
}

/** Excel AG2 */
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

/** Excel AH2 */
export function tdsForTheMonth(annualSalary: number): number {
  return roundUpRupee(tdsForTheYear(annualSalary) / 12);
}

/** Excel O–AD sample month (does not run payroll). */
export function computePayablePreview(split: CtcSplit, statutory: StatutoryInput) {
  const o = statutory.totalDays || 30;
  const q = statutory.payableDays;
  const factor = q / o;
  const payableBasic = rupee(split.basic * factor);
  const payableHra = rupee(split.hra * factor);
  const payableTelephone = rupee(split.telephoneAllowance * factor);
  const payableSpecial = rupee(split.specialAllowance * factor);
  const advance = rupee(statutory.advanceArrear);
  const gross = rupee(payableBasic + payableHra + payableSpecial + payableTelephone + advance);
  const pfWage = rupee(payableBasic + payableSpecial);
  const pf =
    pfWage < statutory.pfWageCeiling
      ? rupee(pfWage * statutory.pfPercent)
      : rupee(statutory.pfFixedCeiling);
  const edli = rupee(statutory.edliAdminAmount);
  const annualised = rupee(((gross - advance) * o) / (q || 1));
  const esi =
    annualised < statutory.esiMonthlyCeiling ? rupee((gross - advance) * statutory.esiPercent) : 0;
  const annualSalary = rupee(split.ctc * 12);
  const tdsYear = tdsForTheYear(annualSalary);
  const tdsMonth = tdsForTheMonth(annualSalary);
  const totalDed = rupee(pf + edli + esi + tdsMonth);
  const net = rupee(gross - totalDed);
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
    tdsYear,
    tdsMonth,
    totalDed,
    net,
    annualSalary,
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
  return {
    grossCtc: split.monthlyCtc,
    telephoneAllowance: split.telephoneAllowance,
    employerContribution: split.employerContribution,
    ctcAmount: split.ctc,
    basic: split.basic,
    hra: split.hra,
    specialAllowance: split.specialAllowance,
    pf: split.employerContribution,
    ...blankRunComponents(),
  };
}
