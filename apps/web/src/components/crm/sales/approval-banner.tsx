"use client";

import Link from "next/link";
import { Lock } from "lucide-react";

/** Human-readable lock reasons for sales-blueprint approval states. */
export function resolveApprovalLockReason(
  approvalStatus?: string | null,
  options?: {
    /** Opportunity flags used to disambiguate legacy shared `boq_approval` state. */
    boqAttached?: boolean;
    boqApproved?: boolean;
    sowAttached?: boolean;
    sowApproved?: boolean;
  },
): string | null {
  const status = (approvalStatus ?? "").trim().toLowerCase();
  if (!status) return null;

  if (status === "sow_approval") {
    return "SOW has been sent for approval and is waiting for a decision in My Jobs.";
  }
  if (status === "boq_approval") {
    const looksLikeSow =
      Boolean(options?.sowAttached) &&
      !options?.sowApproved &&
      (!options?.boqAttached || Boolean(options?.boqApproved));
    if (looksLikeSow) {
      return "SOW has been sent for approval and is waiting for a decision in My Jobs.";
    }
    return "BOQ has been sent for approval and is waiting for a decision in My Jobs.";
  }
  if (status === "po_approval") {
    return "Customer PO has been sent for approval and is waiting for a decision in My Jobs.";
  }
  if (status === "cloud_discount_approval") {
    return "Cloud discount has been sent for approval and is waiting for a decision in My Jobs.";
  }
  if (status === "internal_approval") {
    return "Quote has been sent for management approval and is waiting for a decision in My Jobs.";
  }
  if (status === "approval") {
    return "OVF has been sent for approval and is waiting for a decision in My Jobs.";
  }
  if (status === "pending") {
    return "This record has been sent for approval and is waiting for a decision in My Jobs.";
  }

  const label = status.replaceAll("_", " ");
  return `Blocked while “${label}” is pending a decision in My Jobs.`;
}

/** Strong alert shown when a record is locked pending a My Jobs approval. */
export function ApprovalBanner({
  locked,
  approvalStatus,
  label = "This record",
  reason,
  boqAttached,
  boqApproved,
  sowAttached,
  sowApproved,
}: {
  locked?: boolean;
  approvalStatus?: string | null;
  label?: string;
  /** Exact lock reason — overrides status-based message when provided. */
  reason?: string | null;
  boqAttached?: boolean;
  boqApproved?: boolean;
  sowAttached?: boolean;
  sowApproved?: boolean;
}) {
  if (!locked) return null;

  const resolved =
    reason?.trim() ||
    resolveApprovalLockReason(approvalStatus, {
      boqAttached,
      boqApproved,
      sowAttached,
      sowApproved,
    }) ||
    `${label} is locked — pending a decision in My Jobs.`;

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive shadow-sm">
      <span className="flex min-w-0 items-start gap-2 font-medium">
        <Lock className="mt-0.5 size-4 shrink-0" />
        <span className="min-w-0">
          {label} is locked — {resolved.replace(/^This record is locked — /i, "")}
        </span>
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
