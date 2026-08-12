"use client";

import { BarChart3, FileBarChart } from "lucide-react";

import { ProcurementPageHeader } from "@/components/procurement/procurement-page-header";
import { ProcurementPage } from "@/components/procurement/procurement-ui";

export function ProcurementReportsPage() {
  return (
    <ProcurementPage>
      <ProcurementPageHeader
        title="Reports"
        description="Procurement reports and exports"
      />
      <div className="flex min-h-[14rem] flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card px-6 py-10 text-center shadow-sm">
        <span className="mb-3 inline-flex size-10 items-center justify-center rounded-xl bg-muted text-foreground">
          <FileBarChart className="size-4" aria-hidden />
        </span>
        <p className="text-sm font-semibold text-foreground">Reports coming soon</p>
        <p className="mt-1 max-w-sm text-xs font-normal text-muted-foreground">
          Scheduled and on-demand procurement reports will appear here.
        </p>
      </div>
    </ProcurementPage>
  );
}

export function ProcurementAnalyticsPage() {
  return (
    <ProcurementPage>
      <ProcurementPageHeader
        title="Analytics"
        description="Procurement insights and trends"
      />
      <div className="flex min-h-[14rem] flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card px-6 py-10 text-center shadow-sm">
        <span className="mb-3 inline-flex size-10 items-center justify-center rounded-xl bg-muted text-foreground">
          <BarChart3 className="size-4" aria-hidden />
        </span>
        <p className="text-sm font-semibold text-foreground">Analytics coming soon</p>
        <p className="mt-1 max-w-sm text-xs font-normal text-muted-foreground">
          Deeper procurement analytics and KPI trends will appear here.
        </p>
      </div>
    </ProcurementPage>
  );
}
