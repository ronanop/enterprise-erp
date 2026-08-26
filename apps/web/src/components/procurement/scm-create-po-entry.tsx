"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PoApprovalStatus } from "@/lib/procurement-approvals";
import { scmHoldCreatePoNotice, scmHoldDayCountDisplay, scmHoldSinceDisplay } from "@/utils/scm-ovf-hold";

type ScmCreatePoEntryProps = {
  ovfId: string;
  href?: string;
  scmOnHold?: boolean;
  scmOnHoldAt?: string | null;
  className?: string;
  label?: string;
  icon?: ReactNode;
  /** When true, Create PO needs admin approval (all lines IN STOCK). */
  requiresInStockApproval?: boolean;
  /** Latest create-PO approval status for this OVF (user path). */
  createPoApprovalStatus?: PoApprovalStatus | null;
  /** Admin / already-approved users skip the request step. */
  canCreateWithoutApproval?: boolean;
  onRequestCreatePoApproval?: () => void;
  requestBusy?: boolean;
};

export function ScmCreatePoEntry({
  ovfId,
  href,
  scmOnHold,
  scmOnHoldAt,
  className,
  label = "Create PO",
  icon,
  requiresInStockApproval = false,
  createPoApprovalStatus = null,
  canCreateWithoutApproval = false,
  onRequestCreatePoApproval,
  requestBusy = false,
}: ScmCreatePoEntryProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const poHref = href || `/procurement/scm/ovf/${ovfId}/po`;
  const holdNotice = scmOnHold ? scmHoldCreatePoNotice(scmOnHoldAt) : null;
  const content = (
    <>
      {icon}
      {label}
    </>
  );

  const needsApprovalGate =
    requiresInStockApproval && !canCreateWithoutApproval && createPoApprovalStatus !== "accepted";

  if (needsApprovalGate) {
    if (createPoApprovalStatus === "pending") {
      return (
        <Link
          href="/procurement/approvals"
          className={cn(
            buttonVariants({ size: "sm", variant: "outline" }),
            "cursor-pointer border-amber-300 bg-amber-50 text-amber-900 transition-colors duration-200 hover:bg-amber-100",
            className,
          )}
          title="Waiting for admin to approve Create PO for this IN STOCK OVF"
        >
          Awaiting Create PO approval
        </Link>
      );
    }

    return (
      <button
        type="button"
        className={cn(buttonVariants({ size: "sm", variant: "outline" }), className)}
        disabled={requestBusy || !onRequestCreatePoApproval}
        onClick={() => onRequestCreatePoApproval?.()}
        title="IN STOCK lines normally use inventory. Request admin approval to create a PO instead."
      >
        {requestBusy
          ? "Requesting…"
          : createPoApprovalStatus === "rejected"
            ? "Re-request Create PO"
            : "Request Create PO"}
      </button>
    );
  }

  if (!scmOnHold) {
    return (
      <Link href={poHref} className={cn(buttonVariants({ size: "sm" }), className)}>
        {content}
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        className={cn(buttonVariants({ size: "sm" }), className)}
        onClick={() => setDialogOpen(true)}
      >
        {content}
      </button>
      <ConfirmDialog
        open={dialogOpen}
        title="Unhold OVF and create PO?"
        description={
          holdNotice
            ? `${holdNotice} Continue to the purchase order form?`
            : "This OVF is on hold. Creating a purchase order will unhold it. Continue to the PO form?"
        }
        confirmLabel="Unhold & create PO"
        onConfirm={() => {
          setDialogOpen(false);
          router.push(poHref);
        }}
        onCancel={() => setDialogOpen(false)}
      >
        <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
          <p className="font-medium">You are changing this OVF from hold to unhold.</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-900/90">
            OVF status will move from{" "}
            <span className="font-semibold">Hold</span> to{" "}
            <span className="font-semibold">Open</span> when you save or finalize the vendor PO.
            {scmHoldDayCountDisplay(scmOnHoldAt) !== "—"
              ? ` Currently on hold for ${scmHoldDayCountDisplay(scmOnHoldAt)}`
              : ""}
            {scmHoldSinceDisplay(scmOnHoldAt) !== "—"
              ? ` (since ${scmHoldSinceDisplay(scmOnHoldAt)}).`
              : "."}
          </p>
        </div>
      </ConfirmDialog>
    </>
  );
}
