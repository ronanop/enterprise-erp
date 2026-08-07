/** Enterprise Payroll Management — types */

export type PayrollRunStatus =
  | "draft"
  | "processing"
  | "pending_hr"
  | "pending_finance"
  | "approved"
  | "paid"
  | "locked"
  | "cancelled";

export type LockStatus = "locked" | "unlocked";
export type RevisionReason = "promotion" | "increment" | "correction";
export type TaxRegime = "old" | "new";
export type SalaryStatus = "active" | "hold" | "inactive";
export type BonusType = "festival" | "performance" | "retention" | "referral";
export type ReimbType = "travel" | "fuel" | "internet" | "food" | "medical" | "other";
export type ReimbStatus = "pending" | "approved" | "rejected" | "paid";

export type SalaryStructure = {
  id: string;
  name: string;
  code?: string;
  basic: number;
  hra: number;
  specialAllowance: number;
  medicalAllowance: number;
  travelAllowance: number;
  foodAllowance: number;
  internetAllowance: number;
  bonus: number;
  incentives: number;
  overtime: number;
  arrears: number;
  reimbursement: number;
  otherEarnings: number;
  pf: number;
  esi: number;
  professionalTax: number;
  tds: number;
  loanRecovery: number;
  advanceRecovery: number;
  insurance: number;
  otherDeductions: number;
  createdAt: string;
};

/** Cache Digitech monthly CTC templates (amounts in INR). */
export type SalaryStructureTemplate = Omit<SalaryStructure, "id" | "createdAt">;

export const CACHE_DIGITECH_STRUCTURES: SalaryStructureTemplate[] = [
  {
    code: "SS-INTERN",
    name: "Intern Structure",
    basic: 10000,
    hra: 4000,
    specialAllowance: 2500,
    medicalAllowance: 500,
    travelAllowance: 1000,
    foodAllowance: 0,
    internetAllowance: 500,
    bonus: 0,
    incentives: 0,
    overtime: 0,
    arrears: 0,
    reimbursement: 0,
    otherEarnings: 0,
    pf: 1200,
    esi: 0,
    professionalTax: 0,
    tds: 0,
    loanRecovery: 0,
    advanceRecovery: 0,
    insurance: 0,
    otherDeductions: 0,
  },
  {
    code: "SS-JUNIOR",
    name: "Junior Structure",
    basic: 18000,
    hra: 7200,
    specialAllowance: 4500,
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
    tds: 500,
    loanRecovery: 0,
    advanceRecovery: 0,
    insurance: 200,
    otherDeductions: 0,
  },
  {
    code: "SS-ENG",
    name: "Engineer Structure",
    basic: 35000,
    hra: 14000,
    specialAllowance: 10000,
    medicalAllowance: 1250,
    travelAllowance: 2400,
    foodAllowance: 0,
    internetAllowance: 1000,
    bonus: 0,
    incentives: 0,
    overtime: 0,
    arrears: 0,
    reimbursement: 0,
    otherEarnings: 0,
    pf: 1800,
    esi: 0,
    professionalTax: 200,
    tds: 3500,
    loanRecovery: 0,
    advanceRecovery: 0,
    insurance: 300,
    otherDeductions: 0,
  },
  {
    code: "SS-SENIOR",
    name: "Senior Engineer Structure",
    basic: 55000,
    hra: 22000,
    specialAllowance: 18000,
    medicalAllowance: 2500,
    travelAllowance: 3200,
    foodAllowance: 0,
    internetAllowance: 1500,
    bonus: 0,
    incentives: 0,
    overtime: 0,
    arrears: 0,
    reimbursement: 0,
    otherEarnings: 0,
    pf: 1800,
    esi: 0,
    professionalTax: 200,
    tds: 8000,
    loanRecovery: 0,
    advanceRecovery: 0,
    insurance: 500,
    otherDeductions: 0,
  },
  {
    code: "SS-LEAD",
    name: "Lead Structure",
    basic: 75000,
    hra: 30000,
    specialAllowance: 28000,
    medicalAllowance: 3000,
    travelAllowance: 4000,
    foodAllowance: 0,
    internetAllowance: 2000,
    bonus: 0,
    incentives: 0,
    overtime: 0,
    arrears: 0,
    reimbursement: 0,
    otherEarnings: 0,
    pf: 1800,
    esi: 0,
    professionalTax: 200,
    tds: 14000,
    loanRecovery: 0,
    advanceRecovery: 0,
    insurance: 800,
    otherDeductions: 0,
  },
  {
    code: "SS-MGR",
    name: "Manager Structure",
    basic: 100000,
    hra: 40000,
    specialAllowance: 40000,
    medicalAllowance: 4000,
    travelAllowance: 5000,
    foodAllowance: 0,
    internetAllowance: 2500,
    bonus: 0,
    incentives: 0,
    overtime: 0,
    arrears: 0,
    reimbursement: 0,
    otherEarnings: 0,
    pf: 1800,
    esi: 0,
    professionalTax: 200,
    tds: 22000,
    loanRecovery: 0,
    advanceRecovery: 0,
    insurance: 1000,
    otherDeductions: 0,
  },
  {
    code: "SS-DIR",
    name: "Director Structure",
    basic: 150000,
    hra: 60000,
    specialAllowance: 70000,
    medicalAllowance: 5000,
    travelAllowance: 8000,
    foodAllowance: 0,
    internetAllowance: 3000,
    bonus: 0,
    incentives: 0,
    overtime: 0,
    arrears: 0,
    reimbursement: 0,
    otherEarnings: 0,
    pf: 1800,
    esi: 0,
    professionalTax: 200,
    tds: 40000,
    loanRecovery: 0,
    advanceRecovery: 0,
    insurance: 1500,
    otherDeductions: 0,
  },
  {
    code: "SS-EXEC",
    name: "Executive Structure",
    basic: 220000,
    hra: 88000,
    specialAllowance: 120000,
    medicalAllowance: 8000,
    travelAllowance: 12000,
    foodAllowance: 0,
    internetAllowance: 5000,
    bonus: 0,
    incentives: 0,
    overtime: 0,
    arrears: 0,
    reimbursement: 0,
    otherEarnings: 0,
    pf: 1800,
    esi: 0,
    professionalTax: 200,
    tds: 70000,
    loanRecovery: 0,
    advanceRecovery: 0,
    insurance: 2500,
    otherDeductions: 0,
  },
];

export type EmployeeSalary = {
  id: string;
  employeeId: string;
  employeeName: string;
  structureId: string;
  structureName: string;
  effectiveDate: string;
  monthlyCtc: number;
  annualCtc: number;
  payrollGroup: string;
  bankAccount: string;
  taxRegime: TaxRegime;
  salaryStatus: SalaryStatus;
  department: string;
};

export type PayrollRun = {
  id: string;
  runCode: string;
  month: string; // YYYY-MM
  monthLabel: string;
  employeeCount: number;
  grossTotal: number;
  deductionTotal: number;
  netTotal: number;
  status: PayrollRunStatus;
  attendanceSynced: boolean;
  leaveSynced: boolean;
  otSynced: boolean;
  createdAt: string;
  updatedAt: string;
  approvedBy?: string;
};

export type MonthLock = {
  id: string;
  month: string;
  monthLabel: string;
  reason: string;
  approvedBy: string;
  lockedAt: string;
  status: LockStatus;
  unlockReason?: string;
  unlockedAt?: string;
  unlockedBy?: string;
};

export type SalaryRevision = {
  id: string;
  employeeId: string;
  employeeName: string;
  oldSalary: number;
  newSalary: number;
  effectiveDate: string;
  reason: RevisionReason;
  createdAt: string;
};

export type BonusRecord = {
  id: string;
  employeeId?: string;
  employeeName: string;
  bonusType: BonusType;
  amount: number;
  month: string;
  createdAt: string;
};

export type PayrollAdjustmentRecord = {
  id: string;
  employeeId: string;
  employeeName: string;
  kind: "arrears" | "incentive" | "other";
  amount: number;
  month: string;
  status: "draft" | "applied" | "cancelled";
  createdAt: string;
};

export type ReimbursementRecord = {
  id: string;
  employeeName: string;
  reimbType: ReimbType;
  amount: number;
  status: ReimbStatus;
  createdAt: string;
};

export type LoanRecord = {
  id: string;
  employeeName: string;
  loanAmount: number;
  installments: number;
  remainingBalance: number;
  recoveryPerMonth: number;
  createdAt: string;
};

export type PayslipRecord = {
  id: string;
  payslipCode: string;
  runId: string;
  employeeId: string;
  employeeName: string;
  month: string;
  monthLabel: string;
  department: string;
  bankAccount: string;
  presentDays: number;
  leaveDays: number;
  earnings: { label: string; amount: number }[];
  deductions: { label: string; amount: number }[];
  gross: number;
  totalDeductions: number;
  net: number;
  taxRegime: TaxRegime;
  generatedAt: string;
  /** Set when loaded from API payslip_json.export_text */
  exportText?: string;
};

export type PayrollAudit = {
  id: string;
  action: string;
  detail: string;
  actor: string;
  at: string;
};

export type PayrollFilters = {
  query: string;
  status: string;
  month: string;
};

export function emptyPayrollFilters(): PayrollFilters {
  return { query: "", status: "all", month: "all" };
}

export const RUN_STATUS_LABELS: Record<PayrollRunStatus, string> = {
  draft: "Draft",
  processing: "Processing",
  pending_hr: "Pending HR",
  pending_finance: "Pending Finance",
  approved: "Approved",
  paid: "Paid",
  locked: "Locked",
  cancelled: "Cancelled",
};

export function monthLabel(ym: string): string {
  if (!ym || ym.length < 7) return ym;
  const [y, m] = ym.split("-").map(Number);
  const names = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${names[(m || 1) - 1]} ${y}`;
}

export function structureGross(s: SalaryStructure): number {
  return (
    s.basic +
    s.hra +
    s.specialAllowance +
    s.medicalAllowance +
    s.travelAllowance +
    s.foodAllowance +
    s.internetAllowance +
    s.bonus +
    s.incentives +
    s.overtime +
    s.arrears +
    s.reimbursement +
    s.otherEarnings
  );
}

export function structureDeductions(s: SalaryStructure): number {
  return (
    s.pf +
    s.esi +
    s.professionalTax +
    s.tds +
    s.loanRecovery +
    s.advanceRecovery +
    s.insurance +
    s.otherDeductions
  );
}
