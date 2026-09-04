import { PackageOpen, Search, Inbox } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type EmptyStateVariant = "no-assets" | "no-results" | "no-queue";

const COPY: Record<
  EmptyStateVariant,
  { title: string; description: string; icon: LucideIcon }
> = {
  "no-assets": {
    title: "No assets yet",
    description: "Register your first asset to start tracking inventory.",
    icon: PackageOpen,
  },
  "no-results": {
    title: "No results",
    description: "Try adjusting filters or search terms.",
    icon: Search,
  },
  "no-queue": {
    title: "Queue is empty",
    description: "Nothing to show in this queue right now.",
    icon: Inbox,
  },
};

export type EmptyStateProps = {
  variant?: EmptyStateVariant;
  title?: string;
  description?: string;
  compact?: boolean;
  className?: string;
};

export function EmptyState({
  variant = "no-results",
  title,
  description,
  compact,
  className,
}: EmptyStateProps) {
  const preset = COPY[variant];
  const Icon = preset.icon;
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center text-muted-foreground",
        compact ? "py-6" : "py-12",
        className,
      )}
      role="status"
    >
      <Icon className={cn("mb-2 text-muted-foreground/70", compact ? "size-8" : "size-10")} aria-hidden />
      <p className={cn("font-medium text-foreground", compact ? "text-sm" : "text-base")}>
        {title ?? preset.title}
      </p>
      <p className={cn("mt-1 max-w-sm", compact ? "text-xs" : "text-sm")}>
        {description ?? preset.description}
      </p>
    </div>
  );
}
