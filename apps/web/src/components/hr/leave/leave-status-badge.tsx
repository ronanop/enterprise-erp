"use client";

import { leaveStatusDisplay, type LeaveStatusDisplay } from "@/types/leave-management";
import { cn } from "@/lib/utils";

const RIBBON_STYLES: Record<LeaveStatusDisplay, string> = {
  Pending: "border-l-hrms-warning bg-hrms-peach text-hrms-warning",
  Approved: "border-l-hrms-success bg-hrms-mint text-hrms-success",
  Rejected: "border-l-hrms-danger bg-hrms-pink text-hrms-danger",
  Cancelled: "border-l-border bg-muted text-muted-foreground",
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
