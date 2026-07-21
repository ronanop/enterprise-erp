"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/** Primary payroll screens from FRD-10 screen inventory */
const PAYROLL_NAV = [
  { title: "Overview", href: "/payroll" },
  { title: "Periods", href: "/payroll/payroll-periods" },
  { title: "Salaries", href: "/payroll/employee-salaries" },
  { title: "Runs", href: "/payroll/payroll-runs" },
  { title: "Payslips", href: "/payroll/payslips" },
  { title: "Bonuses", href: "/payroll/bonuses" },
  { title: "Loans", href: "/payroll/loans" },
  { title: "Summaries", href: "/payroll/payroll-summaries" },
] as const;

export function PayrollWorkspaceNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Payroll workspace" className="erp-scroll -mx-1 overflow-x-auto px-1">
      <ul className="flex min-w-max items-center gap-0.5 border-b border-border/70 pb-px">
        {PAYROLL_NAV.map((item) => {
          const active =
            item.href === "/payroll"
              ? pathname === "/payroll"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "inline-flex h-8 cursor-pointer items-center rounded-t-md px-2.5 text-xs font-medium transition-colors duration-200",
                  active
                    ? "border-b-2 border-primary text-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                {item.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
