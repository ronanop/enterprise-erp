"use client";

import Link from "next/link";

import {
  ANALYTICS_EXECUTIVE_ROLES,
  EXECUTIVE_ROLE_ORDER,
  type ExecutiveRole,
} from "@/config/analytics-executive-roles";
import { cn } from "@/lib/utils";

import { KpiTile } from "./KpiTile";

export function ExecutiveDashboardLayout({ role }: { role: ExecutiveRole }) {
  const config = ANALYTICS_EXECUTIVE_ROLES[role];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="text-[1.45rem] font-medium tracking-tight text-foreground">
            {config.label} executive dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Cross-module KPI tiles for {config.label}. Live values wire in Phase 3.
          </p>
        </div>
        <nav aria-label="Executive role" className="flex flex-wrap gap-1">
          {EXECUTIVE_ROLE_ORDER.map((item) => (
            <Link
              key={item}
              href={`/analytics/executive/${item}`}
              className={cn(
                "inline-flex h-8 cursor-pointer items-center rounded-lg px-3 text-xs font-medium transition-colors duration-200",
                item === role
                  ? "bg-primary text-primary-foreground"
                  : "border border-border/80 bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {ANALYTICS_EXECUTIVE_ROLES[item].label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {config.kpis.map((kpiKey) => (
          <KpiTile key={kpiKey} kpiKey={kpiKey} role={role} />
        ))}
      </div>
    </div>
  );
}
