"use client";

import Link from "next/link";
import { Info, Lock } from "lucide-react";

/** Strong alert shown when a record is locked pending a My Jobs approval. */
export function ApprovalBanner({
  locked,
  approvalStatus,
  label = "This record",
}: {
  locked?: boolean;
  approvalStatus?: string | null;
  label?: string;
}) {
  if (!locked) return null;

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive shadow-sm">
      <span className="flex items-center gap-2 font-medium">
        <Lock className="size-4" />
        {label} is locked{approvalStatus ? ` · approval ${approvalStatus.replaceAll("_", " ")}` : ""} —
        pending a decision in My Jobs.
      </span>
      <Link
        href="/crm/my-jobs"
        className="inline-flex h-7 shrink-0 cursor-pointer items-center rounded-lg bg-destructive px-2.5 text-xs font-medium text-white transition-opacity duration-200 hover:opacity-90"
      >
        Go to My Jobs
      </Link>
    </div>
  );
}

/** Informational banner indicating a record's fields were synced/prefilled from a parent entity. */
export function SyncedBanner({
  from,
  href,
  className,
}: {
  from: string;
  href?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs text-blue-900 ${className ?? ""}`}
    >
      <span className="flex items-center gap-2">
        <Info className="size-3.5" /> Synced from {from} — some fields are read-only here.
      </span>
      {href ? (
        <Link href={href} className="cursor-pointer font-medium underline underline-offset-2">
          View {from}
        </Link>
      ) : null}
    </div>
  );
}
