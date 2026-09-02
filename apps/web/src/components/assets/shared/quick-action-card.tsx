import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type QuickActionCardProps = {
  title: string;
  description?: string;
  icon: LucideIcon;
  onPress?: () => void;
  disabled?: boolean;
  /** Denser presentation for secondary action strips. */
  compact?: boolean;
  className?: string;
};

export function QuickActionCard({
  title,
  description,
  icon: Icon,
  onPress,
  disabled,
  compact = false,
  className,
}: QuickActionCardProps) {
  return (
    <Card
      className={cn(
        "border-border/70 bg-background/95 shadow-sm transition-all duration-200",
        !disabled && "cursor-pointer hover:border-[#0369A1]/40 hover:shadow-md",
        disabled && "opacity-50",
        className,
      )}
    >
      <button
        type="button"
        disabled={disabled}
        className="flex w-full cursor-pointer flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed"
        onClick={onPress}
      >
        <CardHeader
          className={cn(
            "flex flex-row items-center gap-2.5 space-y-0",
            compact ? "px-3 py-2.5" : "pb-2",
          )}
        >
          <span
            className={cn(
              "flex shrink-0 items-center justify-center rounded-lg bg-[rgba(3,105,161,0.1)] text-[#0369A1]",
              compact ? "size-7" : "size-9",
            )}
          >
            <Icon className={cn(compact ? "size-3.5" : "size-4")} aria-hidden />
          </span>
          <CardTitle className={cn("font-semibold", compact ? "text-xs" : "text-sm")}>
            {title}
          </CardTitle>
        </CardHeader>
        {description && !compact ? (
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">{description}</p>
          </CardContent>
        ) : null}
      </button>
    </Card>
  );
}
