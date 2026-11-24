"use client";

import { Badge } from "@/components/ui/badge";
import {
  salesStageBadgeClassName,
  salesStageToneFromLabel,
  salesStageToneFromState,
  type SalesStageTone,
} from "@/lib/crm/sales-blueprint-stages";
import { cn } from "@/lib/utils";

type SalesStageBadgeProps = {
  label: string;
  /** Optional raw stage key when the label is a friendly display string. */
  state?: string | null;
  entityType?: string;
  className?: string;
  tone?: SalesStageTone;
};

/** Orange through Deal Won; green from Customer PO / OVF onward. */
export function SalesStageBadge({
  label,
  state,
  entityType,
  className,
  tone: toneOverride,
}: SalesStageBadgeProps) {
  const text = (label || "").trim() || "-";
  const tone =
    toneOverride ??
    (text !== "-"
      ? salesStageToneFromLabel(text)
      : salesStageToneFromState(state, entityType));

  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full px-3 py-0.5 text-xs font-semibold capitalize transition-colors duration-200",
        salesStageBadgeClassName(tone),
        className,
      )}
    >
      {text}
    </Badge>
  );
}
