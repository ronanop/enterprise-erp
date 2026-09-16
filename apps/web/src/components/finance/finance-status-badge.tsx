import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const SUCCESS = new Set([
  "posted",
  "approved",
  "open",
  "active",
  "paid",
  "closed",
  "completed",
  "accepted",
  "confirmed",
  "delivered",
  "shipped",
  "received",
  "converted",
  "converted_to_rfq",
  "published",
  "awarded",
  "available",
  "good",
  "released",
  "running",
  "relieved",
  "verified",
  "conditional",
  "done",
  "qualified",
  "won",
  "new",
  "assigned",
  "contacted",
  "scheduled",
  "interested",
  "present",
  "work_from_home",
  "probation",
  "recorded",
  "attended",
  "achieved",
  "manager_approved",
  "hr_approved",
  "calculated",
  "generated",
  "issued",
  "emailed",
  "viewed",
  "recovered",
  "applied",
  "finalized",
  "finance_approved",
  "hired",
  "selected",
  "filled",
  "cleared",
  "offered",
  "resolved",
  "implemented",
  "identified",
  "returned",
  "transferred",
  "checked_in",
  "captured",
  "reviewed",
  "succeeded",
  "visible",
]);
const WARNING = new Set([
  "draft",
  "pending",
  "in_review",
  "submitted",
  "partial",
  "sent",
  "processing",
  "screening",
  "interview",
  "offer",
  "prospect",
  "paused",
  "mitigating",
  "delayed",
  "in_maintenance",
  "partially_delivered",
  "partially delivered",
  "expired",
  "partially_received",
  "open_rfq",
  "reserved",
  "in_transit",
  "quarantine",
  "hold",
  "in_progress",
  "idle",
  "maintenance",
  "obsolete",
  "investigating",
  "planned",
  "rework_required",
  "ncr_raised",
  "capa_linked",
  "linked_to_ncr",
  "major",
  "minor",
  "need_follow_up",
  "invited",
  "responded",
  "acknowledged",
  "half_day",
  "adjusted",
  "registered",
  "holiday",
  "unpaid",
  "archived",
  "waived",
  "requested",
]);
const DANGER = new Set([
  "rejected",
  "overdue",
  "void",
  "cancelled",
  "canceled",
  "error",
  "failed",
  "credit_hold",
  "on_hold",
  "blocked",
  "damaged",
  "scrapped",
  "breakdown",
  "critical",
  "lost",
  "unqualified",
  "missed",
  "no_show",
  "unsubscribed",
  "absent",
  "ended",
  "reversed",
  "withdrawn",
  "blacklisted",
  "disposed",
  "written_off",
]);

export function FinanceStatusBadge({ status }: { status: string | null | undefined }) {
  const value = (status ?? "-").toString();
  const key = value.toLowerCase();
  const variant = SUCCESS.has(key)
    ? "success"
    : WARNING.has(key)
      ? "warning"
      : DANGER.has(key)
        ? "destructive"
        : "outline";

  const dotColor = variant === "success"
    ? "bg-emerald-500"
    : variant === "warning"
      ? "bg-amber-500"
      : variant === "destructive"
        ? "bg-destructive"
        : "bg-muted-foreground/60";

  return (
    <Badge variant={variant} className="font-medium capitalize gap-1.5">
      <span className={cn("size-1.5 rounded-full shrink-0", dotColor)} aria-hidden />
      {value.replaceAll("_", " ") || "-"}
    </Badge>
  );
}
