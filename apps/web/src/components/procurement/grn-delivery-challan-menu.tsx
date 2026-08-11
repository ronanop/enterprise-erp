"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { FileDown, FilePlus2, Truck, X } from "lucide-react";

import { procurementUi } from "@/components/procurement/procurement-ui";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DeliveryChallanRecord } from "@/utils/delivery-challan-storage";
import { formatChallanGrnSummary } from "@/utils/delivery-challan-storage";
import { deliveryStatusUpdateHref } from "@/utils/delivery-status-routes";

type GrnDeliveryChallanMenuProps = {
  poLabel: string;
  challans: DeliveryChallanRecord[];
  createHref: string;
  pdfBusyId: string | null;
  onDownloadPdf: (challan: DeliveryChallanRecord) => void | Promise<void>;
};

export function GrnDeliveryChallanMenu({
  poLabel,
  challans,
  createHref,
  pdfBusyId,
  onDownloadPdf,
}: GrnDeliveryChallanMenuProps) {
  const [open, setOpen] = useState(false);
  const count = challans.length;

  function closePanel() {
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closePanel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={cn(
          procurementUi.actionBtn,
          "h-7 min-w-[5.5rem] cursor-pointer justify-center gap-1 px-2",
        )}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Delivery challans for ${poLabel}`}
        onClick={() => setOpen(true)}
      >
        Challans
        {count > 0 ? (
          <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded bg-muted px-1 text-[10px] font-semibold tabular-nums text-foreground">
            {count}
          </span>
        ) : null}
      </Button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 transition-opacity duration-200"
              role="presentation"
              onClick={closePanel}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="grn-challans-dialog-title"
                className="flex w-full max-w-sm flex-col overflow-hidden rounded-lg border border-border/80 bg-card shadow-lg"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3 border-b border-border/80 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p
                      id="grn-challans-dialog-title"
                      className="text-sm font-medium tracking-tight text-foreground"
                    >
                      Delivery challans
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{poLabel}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="size-8 shrink-0 cursor-pointer text-muted-foreground transition-colors duration-200 hover:text-foreground"
                    aria-label="Close delivery challans"
                    onClick={closePanel}
                  >
                    <X className="size-4" />
                  </Button>
                </div>

                <div className="max-h-[min(50vh,320px)] overflow-y-auto p-2">
                  {count === 0 ? (
                    <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                      No challans yet for this PO.
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {challans.map((challan) => (
                        <li
                          key={challan.id}
                          className="flex items-start justify-between gap-2 rounded-md px-2 py-2 transition-colors duration-150 hover:bg-muted/40"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium tabular-nums text-foreground">
                              {challan.challanNumber}
                            </p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {formatChallanGrnSummary(challan)}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-0.5">
                            <Link
                              href={deliveryStatusUpdateHref(challan.id)}
                              className={cn(
                                buttonVariants({ size: "sm", variant: "ghost" }),
                                "h-8 w-8 cursor-pointer p-0",
                              )}
                              title="Update delivery status"
                              onClick={() => closePanel()}
                            >
                              <Truck className="size-3.5" />
                            </Link>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 cursor-pointer p-0"
                              disabled={pdfBusyId === challan.id}
                              title="Download PDF"
                              aria-label={`Download PDF for ${challan.challanNumber}`}
                              onClick={() => void onDownloadPdf(challan)}
                            >
                              <FileDown className="size-3.5" />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="border-t border-border/80 p-3">
                  <Link
                    href={createHref}
                    className={cn(
                      buttonVariants({ size: "sm", variant: count > 0 ? "outline" : "default" }),
                      "h-9 w-full cursor-pointer justify-center gap-1.5 text-xs transition-colors duration-200",
                    )}
                    onClick={() => closePanel()}
                  >
                    <FilePlus2 className="size-3.5" />
                    {count > 0 ? "Add delivery challan" : "Create delivery challan"}
                  </Link>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
