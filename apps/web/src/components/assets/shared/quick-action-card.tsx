import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type QuickActionCardProps = {
  title: string;
  description?: string;
  icon: LucideIcon;
  onPress?: () => void;
  disabled?: boolean;
  className?: string;
};

export function QuickActionCard({
  title,
  description,
  icon: Icon,
  onPress,
  disabled,
  className,
}: QuickActionCardProps) {
  return (
    <Card
      className={cn(
        "border-border/80 shadow-sm transition-[border-color,box-shadow] duration-200",
        !disabled && "cursor-pointer hover:border-primary/25 hover:shadow-md",
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
        <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
          <span className="flex size-9 items-center justify-center rounded-md border border-border/60 bg-muted/50">
            <Icon className="size-4 text-foreground" aria-hidden />
          </span>
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </CardHeader>
        {description ? (
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">{description}</p>
          </CardContent>
        ) : null}
      </button>
    </Card>
  );
}
