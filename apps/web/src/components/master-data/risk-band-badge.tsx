import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const VARIANT_BY_BAND: Record<string, "success" | "warning" | "destructive"> = {
  low: "success",
  moderate: "warning",
  high: "warning",
  unacceptable: "destructive",
};

const DOT_BY_VARIANT = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  destructive: "bg-destructive",
} as const;

export function RiskBandBadge({ band }: { band: string | null | undefined }) {
  if (!band) {
    return <span className="text-xs text-muted-foreground">Not assessed</span>;
  }

  const variant = VARIANT_BY_BAND[band.toLowerCase()] ?? "warning";

  return (
    <Badge variant={variant} className="font-medium capitalize">
      <span className={cn("size-1.5 shrink-0 rounded-full", DOT_BY_VARIANT[variant])} aria-hidden />
      {band.replaceAll("_", " ")}
    </Badge>
  );
}
