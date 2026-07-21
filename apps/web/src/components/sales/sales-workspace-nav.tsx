"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/** Primary sales screens from FRD-06 screen inventory */
const SALES_NAV = [
  { title: "Overview", href: "/sales" },
  { title: "Quotes", href: "/sales/quotations" },
  { title: "Orders", href: "/sales/orders" },
  { title: "Deliveries", href: "/sales/deliveries" },
  { title: "Invoices", href: "/sales/invoices" },
  { title: "Returns", href: "/sales/returns" },
  { title: "Pricing", href: "/sales/price-lists" },
  { title: "Credit", href: "/sales/customer-credit" },
] as const;

export function SalesWorkspaceNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Sales workspace" className="erp-scroll -mx-1 overflow-x-auto px-1">
      <ul className="flex min-w-max items-center gap-0.5 border-b border-border/70 pb-px">
        {SALES_NAV.map((item) => {
          const active =
            item.href === "/sales"
              ? pathname === "/sales"
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
