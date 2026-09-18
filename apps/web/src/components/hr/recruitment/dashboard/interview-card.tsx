"use client";

import { Video } from "lucide-react";

import { VerticalKebab } from "@/components/hr/recruitment/dashboard/data-table";
import type { UpcomingInterviewRow } from "@/components/hr/recruitment/dashboard/dashboard-model";

export function InterviewCard({
  row,
  onOpen,
  onMenu,
}: {
  row: UpcomingInterviewRow;
  onOpen: () => void;
  onMenu: { label: string; onClick: () => void }[];
}) {
  return (
    <article className="flex items-center gap-3 rounded-[12px] border border-[#F3F4F6] bg-white px-3 py-2.5 transition-colors duration-150 hover:border-primary/20 hover:bg-[#FAFAFC]">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
      >
        <span className="flex w-11 shrink-0 flex-col items-center leading-none">
          <span className="text-[20px] font-semibold tracking-tight text-[#7C3AED]">{row.day}</span>
          <span className="mt-1 text-[10px] font-medium tracking-[0.08em] text-[#9CA3AF]">{row.month}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-[#111827]">{row.title}</span>
          <span className="mt-0.5 block truncate text-[12px] text-[#6B7280]">{row.candidateName}</span>
          <span className="mt-0.5 block text-[11px] text-[#9CA3AF]">{row.timeLabel}</span>
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          title="Join meeting"
          className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-[#9B5BB8] transition-colors duration-150 hover:bg-[#F4EDFB]"
          onClick={onOpen}
        >
          <Video className="size-4" strokeWidth={1.75} />
        </button>
        <VerticalKebab items={onMenu} />
      </div>
    </article>
  );
}
