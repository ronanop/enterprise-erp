"use client";

import { AlertTriangle, ClipboardList, Package, Undo2, Wrench } from "lucide-react";

import type { QueueCardRow } from "@/components/assets/shared";
import { EmptyState } from "@/components/assets/shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PendingActionItem = {
  id: string;
  kind: "assignment" | "return" | "disposal" | "maintenance";
  title: string;
  detail: string;
  onNavigate?: () => void;
};

export type OperationsPendingActionsProps = {
  items?: PendingActionItem[];
  loading?: boolean;
  className?: string;
};

const KIND_ICON = {
  assignment: Package,
  return: Undo2,
  disposal: AlertTriangle,
  maintenance: Wrench,
} as const;

/** Builds up to 5 pending action rows from existing queue row data + navigation callbacks. */
export function buildPendingActionItems(input: {
  readyRows?: QueueCardRow[];
  disposalRows?: QueueCardRow[];
  assignedCount?: number;
  onAllocate?: (assetId?: string) => void;
  onReturn?: () => void;
  onDisposal?: (assetId?: string) => void;
  onMaintenance?: () => void;
  limit?: number;
}): PendingActionItem[] {
  const limit = input.limit ?? 5;
  const items: PendingActionItem[] = [];

  for (const row of input.readyRows ?? []) {
    if (items.length >= limit) break;
    const tag = String(row.cells[0] ?? "Asset");
    const assetId = row.id;
    items.push({
      id: `assign-${row.id}`,
      kind: "assignment",
      title: "Pending Assignment",
      detail: tag,
      onNavigate: input.onAllocate ? () => input.onAllocate?.(assetId) : undefined,
    });
  }

  if (items.length < limit && (input.assignedCount ?? 0) > 0) {
    items.push({
      id: "pending-returns",
      kind: "return",
      title: "Pending Returns",
      detail: `${input.assignedCount} assigned asset(s) may need return`,
      onNavigate: input.onReturn,
    });
  }

  for (const row of input.disposalRows ?? []) {
    if (items.length >= limit) break;
    const tag = String(row.cells[0] ?? "Asset");
    const assetId = row.id;
    items.push({
      id: `disposal-${row.id}`,
      kind: "disposal",
      title: "Pending Disposal",
      detail: tag,
      onNavigate: input.onDisposal ? () => input.onDisposal?.(assetId) : undefined,
    });
  }

  if (items.length < limit) {
    items.push({
      id: "maintenance-queue",
      kind: "maintenance",
      title: "Maintenance",
      detail: "Open maintenance workspace",
      onNavigate: input.onMaintenance,
    });
  }

  return items.slice(0, limit);
}

export function OperationsPendingActions({
  items = [],
  loading,
  className,
}: OperationsPendingActionsProps) {
  return (
    <section
      aria-labelledby="asset-ops-pending-heading"
      className={cn("space-y-2", className)}
      data-testid="asset-ops-pending-actions"
    >
      <div className="flex items-center gap-2">
        <ClipboardList className="size-4 text-muted-foreground" aria-hidden />
        <h2 id="asset-ops-pending-heading" className="text-sm font-medium tracking-tight">
          Pending Actions
        </h2>
      </div>

      <div className="rounded-lg border border-border/70 bg-card shadow-sm">
        {loading ? (
          <div className="space-y-2 p-3" data-testid="pending-actions-skeleton">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-muted/60" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-4">
            <EmptyState
              variant="no-queue"
              compact
              title="No pending actions"
              description="Queues are clear for this branch."
            />
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {items.map((item) => {
              const Icon = KIND_ICON[item.kind];
              return (
                <li key={item.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <div className="flex min-w-0 items-start gap-2">
                    <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
                    </div>
                  </div>
                  {item.onNavigate ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="cursor-pointer shrink-0"
                      onClick={item.onNavigate}
                    >
                      Open
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
