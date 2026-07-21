/**
 * Payroll workspace config — aligned with FRD-10 screen inventory
 * and apps/api payroll routers (Period → Run → Payslip → Finance).
 */

import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  CalendarRange,
  FileSpreadsheet,
  HandCoins,
  Receipt,
  Scale,
  Wallet,
  Landmark,
} from "lucide-react";

import { getModule, type ModuleResource } from "@/config/modules";

export type PayrollWorkspaceGroup = {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  resourceKeys: string[];
};

export type PayrollPipelineStage = {
  key: string;
  title: string;
  href: string;
  resource:
    | "payroll-periods"
    | "payroll-runs"
    | "payslips"
    | "bonuses"
    | "loans";
};

export const PAYROLL_MODULE_KEY = "payroll";

export const payrollWorkspaceGroups: PayrollWorkspaceGroup[] = [
  {
    key: "setup",
    title: "Pay Setup",
    description: "Periods, structures, components, tax, and statutory",
    icon: Scale,
    resourceKeys: [
      "payroll-periods",
      "salary-structures",
      "salary-components",
      "earning-types",
      "deduction-types",
      "tax-configurations",
      "statutory-contributions",
    ],
  },
  {
    key: "processing",
    title: "Payroll Processing",
    description: "Employee salaries, runs, payslips, adjustments, summaries",
    icon: FileSpreadsheet,
    resourceKeys: [
      "employee-salaries",
      "payroll-runs",
      "payslips",
      "payroll-adjustments",
      "payroll-summaries",
    ],
  },
  {
    key: "benefits",
    title: "Benefits & Advances",
    description: "Bonuses, reimbursements, and employee loans",
    icon: HandCoins,
    resourceKeys: ["bonuses", "reimbursements", "loans"],
  },
];

/** FRD-10 payroll lifecycle (core operational stages) */
export const payrollPipelineStages: PayrollPipelineStage[] = [
  {
    key: "period",
    title: "Period",
    href: "/payroll/payroll-periods",
    resource: "payroll-periods",
  },
  {
    key: "run",
    title: "Payroll Run",
    href: "/payroll/payroll-runs",
    resource: "payroll-runs",
  },
  { key: "payslip", title: "Payslip", href: "/payroll/payslips", resource: "payslips" },
  { key: "bonus", title: "Bonus", href: "/payroll/bonuses", resource: "bonuses" },
  { key: "loan", title: "Loan", href: "/payroll/loans", resource: "loans" },
];

export function getPayrollResources(): ModuleResource[] {
  return getModule(PAYROLL_MODULE_KEY)?.resources ?? [];
}

export function resolvePayrollGroupResources(
  group: PayrollWorkspaceGroup,
): ModuleResource[] {
  const all = getPayrollResources();
  return group.resourceKeys
    .map((key) => all.find((r) => r.key === key))
    .filter((r): r is ModuleResource => Boolean(r));
}

export const payrollQuickLinks = [
  {
    title: "Periods",
    href: "/payroll/payroll-periods",
    description: "Pay cycles",
    icon: CalendarRange,
  },
  {
    title: "Runs",
    href: "/payroll/payroll-runs",
    description: "Payroll processing",
    icon: Landmark,
  },
  {
    title: "Payslips",
    href: "/payroll/payslips",
    description: "Employee payslips",
    icon: Receipt,
  },
  {
    title: "Loans",
    href: "/payroll/loans",
    description: "Salary advances",
    icon: Wallet,
  },
] as const;

export const payrollIcons = {
  Banknote,
} as const;
