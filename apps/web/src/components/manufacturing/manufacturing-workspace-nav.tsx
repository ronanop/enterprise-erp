"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/** Primary manufacturing screens from FRD-13 screen inventory */
const MFG_NAV = [
  { title: "Overview", href: "/manufacturing" },
  { title: "BOMs", href: "/manufacturing/boms" },
  { title: "Orders", href: "/manufacturing/production-orders" },
  { title: "Issues", href: "/manufacturing/material-issues" },
  { title: "Receipts", href: "/manufacturing/production-receipts" },
  { title: "WIP", href: "/manufacturing/wip" },
  { title: "Scrap", href: "/manufacturing/scrap" },
  { title: "Machines", href: "/manufacturing/machines" },
] as const;

export function ManufacturingWorkspaceNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Manufacturing workspace" className="erp-scroll -mx-1 overflow-x-auto px-1">
      <ul className="flex min-w-max items-center gap-0.5 border-b border-border/70 pb-px">
        {MFG_NAV.map((item) => {
          const active =
            item.href === "/manufacturing"
              ? pathname === "/manufacturing"
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
