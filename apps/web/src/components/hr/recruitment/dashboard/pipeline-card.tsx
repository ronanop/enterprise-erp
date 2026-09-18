"use client";

import type { PipelineRow } from "@/components/hr/recruitment/dashboard/dashboard-model";
import type { PipelineStage } from "@/types/recruitment-ats";
import { cn } from "@/lib/utils";

const STAGE_COLORS: Record<PipelineStage, string> = {
  sourced: "#9B5BB8",
  screening: "#3B82F6",
  interview_round_1: "#22D3EE",
  interview_round_2: "#84CC16",
  hr_discussion: "#22C55E",
  background_check: "#F59E0B",
  offer_sent: "#F472B6",
  offer_accepted: "#E879F9",
};

export function PipelineCard({
  stages,
  onStageClick,
}: {
  stages: PipelineRow[];
  onStageClick?: (stage: PipelineStage) => void;
}) {
  return (
    <section className="flex h-full min-h-[280px] flex-col rounded-[12px] border border-[#EEEFF3] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <h2 className="text-[15px] font-semibold tracking-tight text-[#111827]">Recruitment Pipeline</h2>
      <p className="mt-0.5 text-[12px] text-[#9CA3AF]">Track candidates across different stages</p>
      <div className="mt-5 flex flex-1 flex-col justify-between gap-2.5">
        {stages.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => onStageClick?.(row.id)}
            className="flex cursor-pointer items-center gap-3 text-left transition-opacity duration-200 hover:opacity-80"
          >
            <span className="w-[132px] shrink-0 truncate text-[12px] text-[#6B7280]">{row.label}</span>
            <span className="relative h-[7px] min-w-0 flex-1 overflow-hidden rounded-full bg-[#F3F4F6]">
              <span
                className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300"
                style={{
                  width: `${row.count > 0 ? Math.max(row.pct, 8) : 0}%`,
                  background: STAGE_COLORS[row.id],
                }}
              />
            </span>
            <span
              className={cn(
                "w-5 shrink-0 text-right text-[12px] font-medium tabular-nums",
                row.count > 0 ? "text-[#111827]" : "text-[#9CA3AF]",
              )}
            >
              {row.count}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
