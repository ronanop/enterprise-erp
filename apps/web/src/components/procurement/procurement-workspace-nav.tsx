"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/** Primary procurement screens — SCM workflow first, then P2P */
const PROCUREMENT_NAV = [
  { title: "Overview", href: "/procurement" },
  { title: "SCM Queue", href: "/procurement/scm" },
  { title: "Vendors & PO", href: "/procurement/vendor-po" },
  { title: "Orders", href: "/procurement/orders" },
  { title: "GRNs", href: "/procurement/grns" },
  { title: "Requisitions", href: "/procurement/requisitions" },
  { title: "RFQs", href: "/procurement/rfqs" },
  { title: "Invoices", href: "/procurement/invoices" },
  { title: "Contracts", href: "/procurement/contracts" },
  { title: "Performance", href: "/procurement/performance" },
] as const;

export function ProcurementWorkspaceNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Procurement workspace" className="erp-scroll -mx-1 overflow-x-auto px-1">
      <ul className="flex min-w-max items-center gap-0.5 border-b border-border/70 pb-px">
        {PROCUREMENT_NAV.map((item) => {
          const active =
            item.href === "/procurement"
              ? pathname === "/procurement"
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
