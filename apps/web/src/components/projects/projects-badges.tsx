import { Badge } from "@/components/ui/badge";

/** Shared low → critical scale used by task priority, issue severity, and risk level. */
const SCALE_VARIANT: Record<string, "outline" | "success" | "warning" | "destructive"> = {
  low: "outline",
  medium: "warning",
  high: "warning",
  critical: "destructive",
};

function ScaleBadge({ value }: { value: string | null | undefined }) {
  const key = (value ?? "").toLowerCase();
  if (!key) return <span className="text-muted-foreground">—</span>;
  return (
    <Badge variant={SCALE_VARIANT[key] ?? "outline"} className="font-medium capitalize">
      {key}
    </Badge>
  );
}

export function PriorityBadge({ value }: { value: string | null | undefined }) {
  return <ScaleBadge value={value} />;
}

export function SeverityBadge({ value }: { value: string | null | undefined }) {
  return <ScaleBadge value={value} />;
}

export function RiskLevelBadge({ value }: { value: string | null | undefined }) {
  return <ScaleBadge value={value} />;
}

/** RAG health indicator used on the portfolio register and project header. */
const HEALTH_TINT: Record<string, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
};

export function HealthDot({ health }: { health: string | null | undefined }) {
  if (!health) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 capitalize">
      <span
        className={`size-2 rounded-full ${HEALTH_TINT[health] ?? "bg-muted-foreground"}`}
        aria-hidden
      />
      {health}
    </span>
  );
}
