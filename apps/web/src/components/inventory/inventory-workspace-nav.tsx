"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/** Primary inventory screens from FRD-08 screen inventory */
const INVENTORY_NAV = [
  { title: "Overview", href: "/inventory" },
  { title: "Stock", href: "/inventory/stock" },
  { title: "Bins", href: "/inventory/bins" },
  { title: "Batches", href: "/inventory/batches" },
  { title: "Transfers", href: "/inventory/transfers" },
  { title: "Adjustments", href: "/inventory/adjustments" },
  { title: "Valuation", href: "/inventory/valuation" },
  { title: "Reports", href: "/inventory/reports" },
] as const;

export function InventoryWorkspaceNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Inventory workspace" className="erp-scroll -mx-1 overflow-x-auto px-1">
      <ul className="flex min-w-max items-center gap-0.5 border-b border-border/70 pb-px">
        {INVENTORY_NAV.map((item) => {
          const active =
            item.href === "/inventory"
              ? pathname === "/inventory"
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
