"use client";

import { ArrowRight, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function QuickActionCard({
  label,
  icon: Icon,
  onClick,
  tone,
  compact = false,
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  tone: "lavender" | "mint" | "peach" | "pink";
  compact?: boolean;
}) {
  const surface =
    tone === "lavender"
      ? "bg-[#F4EDFB] hover:bg-[#EDE0F8]"
      : tone === "mint"
        ? "bg-[#ECFDF5] hover:bg-[#DDF8EC]"
        : tone === "peach"
          ? "bg-[#FFF4E5] hover:bg-[#FFE9CC]"
          : "bg-[#FFF1F2] hover:bg-[#FFE4E6]";
  const iconColor =
    tone === "lavender"
      ? "text-[#9B5BB8]"
      : tone === "mint"
        ? "text-[#00A866]"
        : tone === "peach"
          ? "text-[#FF8904]"
          : "text-[#F43F5E]";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-[12px] text-left transition-[background-color,transform] duration-200 hover:-translate-y-px",
        compact ? "min-h-[56px] px-3 py-2" : "min-h-[72px] gap-3 px-3.5 py-3",
        surface,
      )}
    >
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-[10px] bg-white shadow-sm",
          compact ? "size-8" : "size-9",
          iconColor,
        )}
      >
        <Icon className={compact ? "size-3.5" : "size-4"} strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1 text-[12px] leading-4 font-medium text-[#111827] sm:text-[13px]">
        {label}
      </span>
      <ArrowRight className={cn("size-3.5 shrink-0", iconColor)} strokeWidth={1.75} />
    </button>
  );
}
