"use client";

import { Briefcase, Calendar, FileText, UserPlus } from "lucide-react";

import { QuickActionCard } from "@/components/hr/recruitment/dashboard/quick-action-card";
import { cn } from "@/lib/utils";

export function DashboardChrome({
  onCreateJob,
  onAddCandidate,
  onScheduleInterview,
  onGenerateOffer,
}: {
  onCreateJob: () => void;
  onAddCandidate: () => void;
  onScheduleInterview: () => void;
  onGenerateOffer: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-[28px] leading-8 font-semibold tracking-tight text-[#111827]">Recruitment</h1>
      </div>

      <div className="grid w-full grid-cols-2 gap-2.5 xl:max-w-[640px] xl:grid-cols-4">
        <QuickActionCard
          label="Create Job Opening"
          icon={Briefcase}
          tone="lavender"
          compact
          onClick={onCreateJob}
        />
        <QuickActionCard
          label="Add Candidate"
          icon={UserPlus}
          tone="mint"
          compact
          onClick={onAddCandidate}
        />
        <QuickActionCard
          label="Schedule Interview"
          icon={Calendar}
          tone="peach"
          compact
          onClick={onScheduleInterview}
        />
        <QuickActionCard
          label="Generate Offer"
          icon={FileText}
          tone="pink"
          compact
          onClick={onGenerateOffer}
        />
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
        "cursor-pointer text-[12px] font-medium text-[#7C3AED] transition-opacity duration-150 hover:opacity-80",
      )}
    >
      {label}
    </button>
  );
}
