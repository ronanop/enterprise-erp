import { PackageOpen, Search, Inbox } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type EmptyStateVariant = "no-assets" | "no-results" | "no-queue" | "no-activity" | "no-search";

const COPY: Record<
  EmptyStateVariant,
  { title: string; description: string; icon: LucideIcon }
> = {
  "no-assets": {
    title: "No Assets",
    description: "Register your first asset.",
    icon: PackageOpen,
  },
  "no-results": {
    title: "No results",
    description: "Try adjusting filters or search terms.",
    icon: Search,
  },
  "no-search": {
    title: "No Search Results",
    description: "Try another Asset Tag or Employee.",
    icon: Search,
  },
  "no-queue": {
    title: "Queue is empty",
    description: "Nothing to show in this queue right now.",
    icon: Inbox,
  },
  "no-activity": {
    title: "No Activity",
    description: "Activity will appear after operations begin.",
    icon: Inbox,
  },
};

export type EmptyStateProps = {
  variant?: EmptyStateVariant;
  title?: string;
  description?: string;
  compact?: boolean;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  variant = "no-results",
  title,
  description,
  compact,
  action,
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
      data-testid="empty-state"
    >
      <Icon className={cn("mb-2 text-muted-foreground/70", compact ? "size-8" : "size-10")} aria-hidden />
      <p className={cn("font-medium text-foreground", compact ? "text-sm" : "text-base")}>
        {title ?? preset.title}
      </p>
      <p className={cn("mt-1 max-w-sm", compact ? "text-xs" : "text-sm")}>
        {description ?? preset.description}
      </p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
