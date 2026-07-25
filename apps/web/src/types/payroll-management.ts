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
  employeeName: string;
  bonusType: BonusType;
  amount: number;
  month: string;
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
