"use client";

import {
  Briefcase,
  Calendar,
  CheckCircle2,
  FileText,
  Users,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import type { DashboardKpi, KpiKey } from "@/components/hr/recruitment/dashboard/dashboard-model";
import { cn } from "@/lib/utils";

type KpiTone = {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
};

const KPI_TONES: Record<KpiKey, KpiTone> = {
  openPositions: {
    icon: Briefcase,
    iconBg: "bg-[#F4EDFB]",
    iconColor: "text-[#9B5BB8]",
  },
  shortlisted: {
    icon: Users,
    iconBg: "bg-[#ECFDF5]",
    iconColor: "text-[#00A866]",
  },
  interviewScheduled: {
    icon: Calendar,
    iconBg: "bg-[#FFF4E5]",
    iconColor: "text-[#FF8904]",
  },
  offersSent: {
    icon: FileText,
    iconBg: "bg-[#FFF1F2]",
    iconColor: "text-[#F43F5E]",
  },
  offersAccepted: {
    icon: CheckCircle2,
    iconBg: "bg-[#ECFDF5]",
    iconColor: "text-[#00A866]",
  },
  backedOut: {
    icon: XCircle,
    iconBg: "bg-[#FFF1F2]",
    iconColor: "text-[#F43F5E]",
  },
};

export function KpiCard({
  kpi,
  onClick,
}: {
  kpi: DashboardKpi;
  onClick?: () => void;
}) {
  const tone = KPI_TONES[kpi.key];
  const Icon = tone.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-[68px] w-full cursor-pointer items-center gap-3 rounded-[12px] border border-[#EEEFF3] bg-white px-3.5 py-2.5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        "transition-[box-shadow,border-color,transform] duration-200 hover:-translate-y-px hover:border-primary/20 hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transform-none",
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-[10px]",
          tone.iconBg,
          tone.iconColor,
        )}
      >
        <Icon className="size-4" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] leading-4 text-[#6B7280]">{kpi.title}</span>
        <span className="mt-1 block text-[22px] leading-7 font-semibold tracking-tight text-[#111827]">
          {kpi.value}
        </span>
      </span>
    </button>
  );
}
