import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import {
  isOperationalStatus,
  OPERATIONAL_STATUS_LABELS,
  type OperationalStatusValue,
} from "./asset-status";

export type StatusBadgeKind = "operational" | "lifecycle";

const OPERATIONAL_BADGE_CLASS: Record<OperationalStatusValue, string> = {
  READY_TO_MOVE:
    "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-200",
  ASSIGNED:
    "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-200",
  RETIRED:
    "border-slate-200 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
  PENDING_DISPOSAL:
    "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  DISPOSED:
    "border-border bg-muted text-muted-foreground dark:bg-muted/40",
};

const LIFECYCLE_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "success" | "warning" | "destructive"
> = {
  active: "success",
  draft: "secondary",
  submitted: "outline",
  approved: "outline",
  in_maintenance: "warning",
  transferred: "outline",
  disposed: "destructive",
  written_off: "destructive",
  cancelled: "secondary",
};

function formatLifecycleLabel(status: string): string {
  return status
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

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
        className={cn("font-medium", OPERATIONAL_BADGE_CLASS[status], className)}
      >
        {OPERATIONAL_STATUS_LABELS[status]}
      </Badge>
    );
  }

  if (kind === "operational") {
    return (
      <Badge variant="outline" className={cn("font-medium", className)}>
        {status}
      </Badge>
    );
  }

  const variant = LIFECYCLE_VARIANT[status] ?? "outline";
  return (
    <Badge variant={variant} className={cn("font-medium capitalize", className)}>
      {formatLifecycleLabel(status)}
    </Badge>
  );
}
