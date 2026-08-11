"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { scmHoldCreatePoNotice, scmHoldDayCountDisplay, scmHoldSinceDisplay } from "@/utils/scm-ovf-hold";

type ScmCreatePoEntryProps = {
  ovfId: string;
  scmOnHold?: boolean;
  scmOnHoldAt?: string | null;
  className?: string;
  label?: string;
  icon?: ReactNode;
};

export function ScmCreatePoEntry({
  ovfId,
  scmOnHold,
  scmOnHoldAt,
  className,
  label = "Create PO",
  icon,
}: ScmCreatePoEntryProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const poHref = `/procurement/scm/ovf/${ovfId}/po`;
  const holdNotice = scmOnHold ? scmHoldCreatePoNotice(scmOnHoldAt) : null;
  const content = (
    <>
      {icon}
      {label}
    </>
  );

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
