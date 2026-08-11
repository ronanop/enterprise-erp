"use client";

import { leaveStatusDisplay, type LeaveStatusDisplay } from "@/types/leave-management";
import { cn } from "@/lib/utils";

const RIBBON_STYLES: Record<LeaveStatusDisplay, string> = {
  Pending:
    "border-l-amber-500 bg-amber-50 text-amber-950 ring-1 ring-amber-200/80 dark:bg-amber-950/30 dark:text-amber-100",
  Approved:
    "border-l-emerald-500 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-200/80 dark:bg-emerald-950/30 dark:text-emerald-100",
  Rejected:
    "border-l-red-500 bg-red-50 text-red-950 ring-1 ring-red-200/80 dark:bg-red-950/30 dark:text-red-100",
  Cancelled:
    "border-l-slate-400 bg-slate-50 text-slate-700 ring-1 ring-slate-200/80 dark:bg-slate-900/40 dark:text-slate-200",
};

/** Distinct leave ribbon badge — Pending / Approved / Rejected / Cancelled. */
export function LeaveStatusBadge({ status }: { status: string }) {
  const label = leaveStatusDisplay(status);
  return (
    <span
      className={cn(
        "inline-flex items-center border-l-[3px] rounded-r-md px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
        RIBBON_STYLES[label],
      )}
    >
      {label}
    </span>
  );
}
