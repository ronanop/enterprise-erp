"use client";

import { Check, Clock, Minus, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { PoValidation, PoValidationStage } from "@/services/sales-crm-service";

type StageStatus = PoValidationStage["status"];

const STAGE_ORDER: { key: keyof PoValidation; label: string; caption: string }[] = [
  { key: "finance", label: "Finance", caption: "Tax, GST & commercials" },
  { key: "legal", label: "Legal", caption: "Terms & conditions" },
  { key: "management", label: "Management", caption: "Final go-ahead" },
];

const STATUS_ICON: Record<StageStatus, LucideIcon> = {
  not_required: Minus,
  pending: Clock,
  approved: Check,
  rejected: X,
};

const STATUS_CLASS: Record<StageStatus, string> = {
  not_required: "border-border bg-muted/50 text-muted-foreground",
  pending: "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-200",
  approved:
    "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
  rejected: "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200",
};

const STATUS_LABEL: Record<StageStatus, string> = {
  not_required: "Not started",
  pending: "Awaiting decision",
  approved: "Approved",
  rejected: "Sent back",
};

/**
 * Customer PO validation chain. Finance checks the tax and commercials, Legal
 * checks the terms & conditions, then Management approves - Sales never owns
 * terms validation.
 */
export function PoValidationChain({ validation }: { validation: PoValidation }) {
  const started = STAGE_ORDER.some(({ key }) => validation[key].status !== "not_required");
  if (!started) return null;

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        Customer PO Validation
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {STAGE_ORDER.map(({ key, label, caption }, index) => {
          const stage = validation[key];
          const Icon = STATUS_ICON[stage.status];
          return (
            <div
              key={key}
              className={`rounded-lg border px-3 py-2.5 transition-colors duration-200 ${STATUS_CLASS[stage.status]}`}
            >
              <div className="flex items-center gap-2">
                <Icon className="size-3.5 shrink-0" aria-hidden />
                <span className="text-xs font-semibold">
                  {index + 1}. {label}
                </span>
              </div>
              <p className="mt-1 text-[11px] opacity-80">{caption}</p>
              <p className="mt-1.5 text-[11px] font-medium">{STATUS_LABEL[stage.status]}</p>
              {stage.remark ? (
                <p className="mt-1 text-[11px] opacity-80">{stage.remark}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
