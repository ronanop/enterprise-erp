import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { EmptyState } from "./empty-state";
import { QueueCardSkeleton } from "./loading-skeleton";

export type QueueCardRow = {
  id: string;
  cells: ReactNode[];
};

export type QueueCardProps = {
  title: string;
  rows?: QueueCardRow[];
  columnLabels?: string[];
  action?: { label: string; onClick?: () => void };
  loading?: boolean;
  emptyVariant?: "no-queue" | "no-results";
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
};

export function QueueCard({
  title,
  rows = [],
  columnLabels,
  action,
  loading,
  emptyVariant = "no-queue",
  emptyTitle,
  emptyDescription,
  className,
}: QueueCardProps) {
  if (loading) {
    return <QueueCardSkeleton className={className} />;
  }

  const isEmpty = rows.length === 0;

  return (
    <Card className={cn("border-border/80 shadow-sm", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium tracking-tight">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {isEmpty ? (
          <EmptyState
            variant={emptyVariant}
            title={emptyTitle}
            description={emptyDescription}
            compact
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[280px] text-left text-sm">
              {columnLabels?.length ? (
                <thead>
                  <tr className="border-b border-border/60 text-xs text-muted-foreground">
                    {columnLabels.map((label) => (
                      <th key={label} className="pb-2 pr-3 font-medium">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
              ) : null}
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-border/40 last:border-0">
                    {row.cells.map((cell, i) => (
                      <td key={`${row.id}-${i}`} className="py-2 pr-3 text-foreground/90">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
      {action ? (
        <CardFooter className="pt-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="cursor-pointer"
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}
