"use client";

import { Briefcase, ExternalLink, RefreshCw } from "lucide-react";

import { QuickActionCard } from "@/components/hr/recruitment/dashboard/quick-action-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DashboardChrome({
  onCreateJob,
  onOpenCareers,
  onRefresh,
  refreshing,
}: {
  onCreateJob: () => void;
  onOpenCareers?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-[28px] leading-8 font-semibold tracking-tight text-[#111827]">
          Recruitment
        </h1>
      </div>

      <div className="flex w-full flex-col items-stretch gap-2.5 sm:items-end xl:max-w-[420px]">
        {onRefresh ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 cursor-pointer gap-1.5 self-end"
            disabled={refreshing}
            onClick={onRefresh}
            aria-label="Refresh recruitment data"
          >
            <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>
        ) : null}
        <div className="grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2">
          <QuickActionCard
            label="Create Job Opening"
            icon={Briefcase}
            tone="lavender"
            compact
            onClick={onCreateJob}
          />
          <QuickActionCard
            label="Careers page"
            icon={ExternalLink}
            tone="pink"
            compact
            onClick={onOpenCareers ?? (() => window.open("/careers", "_blank"))}
          />
        </div>
      </div>
    </div>
  );
}

export function ViewAllLink({
  onClick,
  label = "View All",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "cursor-pointer text-[12px] font-medium text-primary transition-opacity duration-150 hover:opacity-80",
      )}
    >
      {label}
    </button>
  );
}
