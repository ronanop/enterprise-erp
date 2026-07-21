"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/** Primary BI screens from FRD-18 screen inventory */
const ANALYTICS_NAV = [
  { title: "Overview", href: "/analytics" },
  { title: "Dashboards", href: "/analytics/dashboards" },
  { title: "Reports", href: "/analytics/reports" },
  { title: "KPIs", href: "/analytics/kpis" },
  { title: "Datasets", href: "/analytics/datasets" },
  { title: "Metrics", href: "/analytics/metrics" },
  { title: "Alerts", href: "/analytics/alert-rules" },
  { title: "Exports", href: "/analytics/data-exports" },
] as const;

export function AnalyticsWorkspaceNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Analytics workspace" className="erp-scroll -mx-1 overflow-x-auto px-1">
      <ul className="flex min-w-max items-center gap-0.5 border-b border-border/70 pb-px">
        {ANALYTICS_NAV.map((item) => {
          const active =
            item.href === "/analytics"
              ? pathname === "/analytics"
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
