"use client";

import type { JobStatus, PipelineStage } from "@/types/recruitment-ats";
import { cn } from "@/lib/utils";

export function StatusBadge({
  kind,
  value,
}: {
  kind: "job" | "stage";
  value: JobStatus | PipelineStage | string;
}) {
  switch (kind) {
    case "job":
      return <JobStatusBadge status={value as JobStatus} />;
    case "stage":
      return <StageBadge stage={value as PipelineStage} />;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export function JobStatusBadge({
  status,
  filled,
  positions,
}: {
  status: JobStatus;
  filled?: number;
  positions?: number;
}) {
  const isFilled =
    typeof filled === "number" &&
    typeof positions === "number" &&
    positions > 0 &&
    filled >= positions;

  if (isFilled) {
    return (
      <span className="inline-flex rounded-full bg-[#F5F3FF] px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-[#7C3AED] uppercase">
        Filled
      </span>
    );
  }

  let label = "Closed";
  let tone = "bg-[#FFF1F2] text-[#F43F5E]";
  switch (status) {
    case "open":
      label = "Open";
      tone = "bg-[#ECFDF5] text-[#00A866]";
      break;
    case "draft":
      label = "Draft";
      tone = "bg-[#F3F4F6] text-[#6B7280]";
      break;
    case "on_hold":
      label = "On Hold";
      tone = "bg-[#FFF4E5] text-[#FF8904]";
      break;
    case "closed":
      label = "Closed";
      tone = "bg-[#FFF1F2] text-[#F43F5E]";
      break;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase", tone)}>
      {label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const key = priority.toLowerCase();
  let tone = "bg-[#F5F3FF] text-[#7C3AED]";
  let label = priority;
  switch (key) {
    case "high":
    case "critical":
      tone = "bg-[#FFF1F2] text-[#F43F5E]";
      label = key === "critical" ? "Critical" : "High";
      break;
    case "medium":
      tone = "bg-[#FFF4E5] text-[#FF8904]";
      label = "Medium";
      break;
    case "low":
      tone = "bg-[#F5F3FF] text-[#7C3AED]";
      label = "Low";
      break;
    default:
      label = priority || "—";
  }
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold", tone)}>
      {label}
    </span>
  );
}

export function StageBadge({
  stage,
  label,
}: {
  stage: PipelineStage;
  label?: string;
}) {
  let tone = "bg-[#F5F3FF] text-[#7C3AED]";
  let text = label ?? stage;
  switch (stage) {
    case "sourced":
      tone = "bg-[#F5F3FF] text-[#7C3AED]";
      text = label ?? "Applied";
      break;
    case "screening":
      tone = "bg-[#F4EDFB] text-[#7C3AED]";
      text = label ?? "Screening";
      break;
    case "interview_round_1":
      tone = "bg-[#F5F3FF] text-[#7C3AED]";
      text = label ?? "Interview";
      break;
    case "interview_round_2":
      tone = "bg-[#F5F3FF] text-[#7C3AED]";
      text = label ?? "Interview";
      break;
    case "hr_discussion":
      tone = "bg-[#F5F3FF] text-[#7C3AED]";
      text = label ?? "Interview";
      break;
    case "background_check":
      tone = "bg-[#FFF4E5] text-[#FF8904]";
      text = label ?? "On Hold";
      break;
    case "offer_sent":
      tone = "bg-[#FCE7F3] text-[#DB2777]";
      text = label ?? "Offer Sent";
      break;
    case "offer_accepted":
      tone = "bg-[#ECFDF5] text-[#00A866]";
      text = label ?? "Offer Accepted";
      break;
    default: {
      const _exhaustive: never = stage;
      return _exhaustive;
    }
  }
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap", tone)}>
      {text}
    </span>
  );
}

const AVATAR_TONES = [
  "bg-[#F4EDFB] text-[#9B5BB8]",
  "bg-[#FCE7F3] text-[#DB2777]",
  "bg-[#EEF6FF] text-[#155DFD]",
  "bg-[#FFF4E5] text-[#C2410C]",
  "bg-[#ECFDF5] text-[#00A866]",
] as const;

export function InitialsAvatar({
  name,
  toneIndex,
  size = "md",
}: {
  name: string;
  toneIndex?: number;
  size?: "sm" | "md";
}) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials =
    parts.length === 0
      ? "?"
      : parts.length === 1
        ? parts[0]!.slice(0, 2).toUpperCase()
        : `${parts[0]!.slice(0, 1)}${parts[parts.length - 1]!.slice(0, 1)}`.toUpperCase();
  const idx = toneIndex ?? Math.abs(hashString(name));
  const tone = AVATAR_TONES[idx % AVATAR_TONES.length]!;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        size === "sm" ? "size-6 text-[9px]" : "size-7 text-[10px]",
        tone,
      )}
    >
      {initials}
    </span>
  );
}

function hashString(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) | 0;
  return h;
}
