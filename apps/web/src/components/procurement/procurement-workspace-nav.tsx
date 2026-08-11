"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { cn } from "@/lib/utils";
import { prefetchProcurementTab } from "@/services/procurement-service";
import { useDeliveryReminderSweep } from "@/hooks/use-delivery-reminder-sweep";

const PROCUREMENT_NAV = [
  { title: "Dashboard", href: "/procurement" },
  { title: "SCM Queue", href: "/procurement/scm" },
  { title: "Purchase Orders", href: "/procurement/orders" },
  { title: "GRNs", href: "/procurement/grns" },
  { title: "Delivery Challan", href: "/procurement/delivery-challan" },
  { title: "Delivery Status", href: "/procurement/delivery-status" },
  { title: "Vendors", href: "/procurement/vendors" },
  { title: "Inventory", href: "/procurement/inventory" },
] as const;

function prefetchAllProcurementTabs(router: ReturnType<typeof useRouter>): void {
  for (const item of PROCUREMENT_NAV) {
    router.prefetch(item.href);
    prefetchProcurementTab(item.href);
  }
}

export function ProcurementWorkspaceNav() {
  const pathname = usePathname();
  const router = useRouter();
  useDeliveryReminderSweep();

  useEffect(() => {
    const active =
      PROCUREMENT_NAV.find((item) =>
        item.href === "/procurement"
          ? pathname === "/procurement"
          : pathname === item.href || pathname.startsWith(`${item.href}/`),
      ) ?? PROCUREMENT_NAV[0];
    router.prefetch(active.href);
    prefetchProcurementTab(active.href);
    prefetchAllProcurementTabs(router);
  }, [pathname, router]);

  return (
    <nav
      aria-label="Procurement workspace"
      className="erp-scroll sticky top-14 z-[9] -mx-1 overflow-x-auto border-b border-border/60 bg-background"
    >
      <ul className="flex min-w-max items-center gap-1 px-0.5">
        {PROCUREMENT_NAV.map((item) => {
          const active =
            item.href === "/procurement"
              ? pathname === "/procurement"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                prefetch
                onMouseEnter={() => {
                  router.prefetch(item.href);
                  prefetchProcurementTab(item.href);
                }}
                onFocus={() => {
                  router.prefetch(item.href);
                  prefetchProcurementTab(item.href);
                }}
                className={cn(
                  "inline-flex h-9 cursor-pointer items-center border-b-2 px-3 text-xs font-medium transition-colors duration-200",
                  active
                    ? "border-[#0369A1] text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
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
