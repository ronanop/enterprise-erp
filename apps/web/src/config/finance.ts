/**
 * Finance workspace config — aligned with FRD-04 screen inventory
 * and apps/api finance routers.
 */

import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BookOpen,
  CalendarRange,
  FileSpreadsheet,
  Landmark,
  PieChart,
  Receipt,
  Scale,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { getModule, type ModuleResource } from "@/config/modules";

export type FinanceWorkspaceGroup = {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  resourceKeys: string[];
};

export type FinanceReportTab = {
  key: string;
  title: string;
  description: string;
  apiPath: string;
  href: string;
};

export const FINANCE_MODULE_KEY = "finance";

export const financeWorkspaceGroups: FinanceWorkspaceGroup[] = [
  {
    key: "ledger",
    title: "General Ledger",
    description: "Chart of accounts, journals, and posted GL entries",
    icon: BookOpen,
    resourceKeys: ["account-groups", "chart-of-accounts", "journals", "gl"],
  },
  {
    key: "subledgers",
    title: "Accounts Receivable & Payable",
    description: "Customer dues, vendor liabilities, and collections",
    icon: Receipt,
    resourceKeys: ["ar", "ap"],
  },
  {
    key: "calendar",
    title: "Fiscal Calendar",
    description: "Fiscal years, periods, and closing checklist",
    icon: CalendarRange,
    resourceKeys: ["fiscal-years", "periods"],
  },
  {
    key: "compliance",
    title: "Tax, FX & Asset Postings",
    description: "Tax register, currency rates, and asset accounting",
    icon: Scale,
    resourceKeys: ["tax-register", "currency-rates", "asset-transactions"],
  },
  {
    key: "reports",
    title: "Financial Reports",
    description: "Statements, ledger registers, aging, and compliance summaries",
    icon: FileSpreadsheet,
    resourceKeys: ["reports"],
  },
];

export const financeReportTabs: FinanceReportTab[] = [
  {
    key: "trial-balance",
    title: "Trial Balance",
    description: "Opening, debit, credit, and closing by account",
    apiPath: "/finance/reports/trial-balance",
    href: "/finance/reports/trial-balance",
  },
  {
    key: "balance-sheet",
    title: "Balance Sheet",
    description: "Assets, liabilities, and equity with comparison",
    apiPath: "/finance/reports/balance-sheet",
    href: "/finance/reports/balance-sheet",
  },
  {
    key: "profit-loss",
    title: "Profit & Loss",
    description: "Revenue, COGS, expenses, and net profit",
    apiPath: "/finance/reports/profit-loss",
    href: "/finance/reports/profit-loss",
  },
  {
    key: "cash-flow",
    title: "Cash Flow",
    description: "Operating, investing, and financing cash movements",
    apiPath: "/finance/reports/cash-flow",
    href: "/finance/reports/cash-flow",
  },
  {
    key: "general-ledger",
    title: "General Ledger Report",
    description: "Printable GL with account and date filters",
    apiPath: "/finance/reports/general-ledger",
    href: "/finance/reports/general-ledger",
  },
  {
    key: "journal-register",
    title: "Journal Register",
    description: "Journal listing with voucher and workflow status",
    apiPath: "/finance/reports/journal-register",
    href: "/finance/reports/journal-register",
  },
  {
    key: "ar-aging",
    title: "AR Aging",
    description: "Customer outstanding by aging bucket",
    apiPath: "/finance/reports/ar-aging",
    href: "/finance/reports/ar-aging",
  },
  {
    key: "ap-aging",
    title: "AP Aging",
    description: "Vendor outstanding by aging bucket",
    apiPath: "/finance/reports/ap-aging",
    href: "/finance/reports/ap-aging",
  },
  {
    key: "tax-summary",
    title: "Tax Summary",
    description: "Taxable and tax amounts by type",
    apiPath: "/finance/reports/tax-summary",
    href: "/finance/reports/tax-summary",
  },
  {
    key: "cost-center",
    title: "Cost Center Summary",
    description: "Debit/credit totals by cost center",
    apiPath: "/finance/reports/cost-center",
    href: "/finance/reports/cost-center",
  },
];

export const AGING_BUCKETS = ["0-30", "31-60", "61-90", "90+"] as const;

export function getFinanceResources(): ModuleResource[] {
  return getModule(FINANCE_MODULE_KEY)?.resources ?? [];
}

export function resolveFinanceGroupResources(group: FinanceWorkspaceGroup): ModuleResource[] {
  const all = getFinanceResources();
  return group.resourceKeys
    .map((key) => all.find((r) => r.key === key))
    .filter((r): r is ModuleResource => Boolean(r));
}

export const financeQuickLinks = [
  {
    title: "Journal Entry",
    href: "/finance/journals",
    description: "Manual and system journals",
    icon: BookOpen,
  },
  {
    title: "Chart of Accounts",
    href: "/finance/chart-of-accounts",
    description: "Account structure",
    icon: Landmark,
  },
  {
    title: "AR Ledger",
    href: "/finance/ar",
    description: "Customer receivables",
    icon: Receipt,
  },
  {
    title: "Trial Balance",
    href: "/finance/reports/trial-balance",
    description: "Period balances",
    icon: FileSpreadsheet,
  },
  {
    title: "Balance Sheet",
    href: "/finance/reports/balance-sheet",
    description: "Assets, liabilities, equity",
    icon: Scale,
  },
  {
    title: "Profit & Loss",
    href: "/finance/reports/profit-loss",
    description: "Income statement",
    icon: TrendingUp,
  },
  {
    title: "Cash Flow",
    href: "/finance/reports/cash-flow",
    description: "Cash movements",
    icon: Wallet,
  },
  {
    title: "Tax Summary",
    href: "/finance/reports/tax-summary",
    description: "Tax compliance view",
    icon: PieChart,
  },
  {
    title: "Cost Centers",
    href: "/finance/reports/cost-center",
    description: "Cost center analytics",
    icon: BarChart3,
  },
] as const;
