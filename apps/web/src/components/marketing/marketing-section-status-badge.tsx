"use client";

import {
  sectionStatusLabel,
  type SectionAggregateStatus,
} from "@/lib/marketing-verification";
import { cn } from "@/lib/utils";

export function SectionApprovalStatusBadge({ status }: { status: SectionAggregateStatus }) {
  const label = sectionStatusLabel(status);
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium",
        status === "approved" && "bg-emerald-500/15 text-emerald-700",
        status === "submitted" && "bg-amber-500/15 text-amber-800",
        status === "changes_requested" && "bg-amber-500/15 text-amber-900",
        status === "rejected" && "bg-destructive/15 text-destructive",
        (status === "pending" || status === "missing") && "bg-muted text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

export function SectionHeadRemarks({ remarks, status }: { remarks: string | null; status: SectionAggregateStatus }) {
  if (!remarks) return null;
  if (status === "approved") {
    return (
      <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
        <p className="text-xs font-medium uppercase text-muted-foreground">Marketing head note</p>
        <p className="mt-1 whitespace-pre-wrap">{remarks}</p>
      </div>
    );
  }
  if (status !== "rejected" && status !== "changes_requested") return null;
  return (
    <div
      className={cn(
        "rounded-md border p-3 text-sm",
        status === "rejected" ? "border-destructive/40 bg-destructive/5" : "border-amber-500/40 bg-amber-500/10",
      )}
    >
      <p className="text-xs font-medium uppercase text-muted-foreground">Marketing head remarks</p>
      <p className="mt-1 whitespace-pre-wrap">{remarks}</p>
    </div>
  );
}
