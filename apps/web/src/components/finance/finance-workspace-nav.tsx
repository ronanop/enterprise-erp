"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/** Primary finance screens from FRD-04 screen inventory */
const FINANCE_NAV = [
  { title: "Overview", href: "/finance" },
  { title: "COA", href: "/finance/chart-of-accounts" },
  { title: "Journals", href: "/finance/journals" },
  { title: "GL", href: "/finance/gl" },
  { title: "AR", href: "/finance/ar" },
  { title: "AP", href: "/finance/ap" },
  { title: "Periods", href: "/finance/periods" },
  { title: "Tax", href: "/finance/tax-register" },
  { title: "Reports", href: "/finance/reports" },
] as const;

export function FinanceWorkspaceNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Finance workspace" className="erp-scroll -mx-1 overflow-x-auto px-1">
      <ul className="flex min-w-max items-center gap-0.5 border-b border-border/70 pb-px">
        {FINANCE_NAV.map((item) => {
          const active =
            item.href === "/finance"
              ? pathname === "/finance"
              : item.href === "/finance/ar"
                ? pathname === item.href ||
                  pathname.startsWith(`${item.href}/`) ||
                  pathname.startsWith("/finance/accounts-receivable")
                : item.href === "/finance/ap"
                  ? pathname === item.href ||
                    pathname.startsWith(`${item.href}/`) ||
                    pathname.startsWith("/finance/accounts-payable")
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
