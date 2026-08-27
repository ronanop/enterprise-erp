import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import {
  DC_CHALLAN_STATUS_BADGE_CLASS,
  DC_CHALLAN_STATUS_LABELS,
  formatLifecycleStatusLabel,
  isDcChallanStatus,
  isOperationalStatus,
  LIFECYCLE_STATUS_BADGE_CLASS,
  OPERATIONAL_STATUS_BADGE_CLASS,
  OPERATIONAL_STATUS_LABELS,
} from "./asset-status";

export type StatusBadgeKind = "operational" | "lifecycle" | "dcChallan";

export type StatusBadgeProps = {
  kind: StatusBadgeKind;
  status: string;
  className?: string;
};

export function StatusBadge({ kind, status, className }: StatusBadgeProps) {
  if (kind === "operational" && isOperationalStatus(status)) {
    return (
      <Badge
        variant="outline"
        className={cn("shrink-0 font-medium", OPERATIONAL_STATUS_BADGE_CLASS[status], className)}
      >
        {OPERATIONAL_STATUS_LABELS[status]}
      </Badge>
    );
  }

  if (kind === "operational") {
    return (
      <Badge variant="outline" className={cn("shrink-0 font-medium", className)}>
        {status}
      </Badge>
    );
  }

  if (kind === "dcChallan") {
    if (isDcChallanStatus(status)) {
      return (
        <Badge
          variant="outline"
          className={cn("shrink-0 font-medium", DC_CHALLAN_STATUS_BADGE_CLASS[status], className)}
        >
          {DC_CHALLAN_STATUS_LABELS[status]}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className={cn("shrink-0 font-medium", className)}>
        {status}
      </Badge>
    );
  }

  const lifeKey = status.trim().toLowerCase();
  const lifeClass =
    lifeKey in LIFECYCLE_STATUS_BADGE_CLASS
      ? LIFECYCLE_STATUS_BADGE_CLASS[lifeKey as keyof typeof LIFECYCLE_STATUS_BADGE_CLASS]
      : undefined;

  return (
    <Badge
      variant="outline"
      className={cn("shrink-0 font-medium", lifeClass, className)}
    >
      {formatLifecycleStatusLabel(status)}
    </Badge>
  );
}
