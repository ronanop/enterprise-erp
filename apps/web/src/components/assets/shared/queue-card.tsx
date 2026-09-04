import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { EmptyState } from "./empty-state";
import { QueueCardSkeleton } from "./loading-skeleton";
import {
  TABLE_SERIAL_HEADER_LABEL,
  tableRowSerialFromIndex,
  tableSerialCellClassName,
  tableSerialHeaderClassName,
} from "./table-serial";

export type QueueCardRow = {
  id: string;
  cells: ReactNode[];
};

export type QueueCardProps = {
  title: string;
  /** Optional total count badge (e.g. API list `total`). */
  count?: number | null;
  rows?: QueueCardRow[];
  columnLabels?: string[];
  action?: { label: string; onClick?: () => void };
  loading?: boolean;
  emptyVariant?: "no-queue" | "no-results";
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
  dense?: boolean;
};

export function QueueCard({
  title,
  count,
  rows = [],
  columnLabels,
  action,
  loading,
  emptyVariant = "no-queue",
  emptyTitle,
  emptyDescription,
  className,
  dense = false,
}: QueueCardProps) {
  if (loading) {
    return <QueueCardSkeleton className={className} />;
  }

  const isEmpty = rows.length === 0;
  const showCount = typeof count === "number" && Number.isFinite(count);

  return (
    <Card
      className={cn(
        "overflow-hidden border-border/70 bg-background/95 shadow-md",
        className,
      )}
    >
      <CardHeader
        className={cn(
          "flex flex-row items-center justify-between gap-2 space-y-0 border-b border-border/50",
          dense ? "pb-2.5 pt-3.5" : "pb-3 pt-4",
        )}
      >
        <CardTitle className="text-sm font-semibold tracking-tight">{title}</CardTitle>
        {showCount ? (
          <span
            className="inline-flex min-w-6 items-center justify-center rounded-md border border-border/70 bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-muted-foreground"
            data-testid="queue-card-count"
            aria-label={`${count} total`}
          >
            {count}
          </span>
        ) : null}
      </CardHeader>
      <CardContent className={cn("pt-3", dense && "pb-2")}>
        {isEmpty ? (
          <EmptyState
            variant={emptyVariant}
            title={emptyTitle}
            description={emptyDescription}
            compact
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[240px] text-left text-sm">
              {columnLabels?.length ? (
                <thead>
                  <tr className="border-b border-border/60 text-[11px] text-muted-foreground">
                    <th
                      className={tableSerialHeaderClassName(
                        cn("font-medium", dense ? "pb-1.5 pr-2" : "pb-2 pr-3"),
                      )}
                      scope="col"
                    >
                      {TABLE_SERIAL_HEADER_LABEL}
                    </th>
                    {columnLabels.map((label) => (
                      <th key={label} className={cn("font-medium", dense ? "pb-1.5 pr-2" : "pb-2 pr-3")}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
              ) : null}
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={row.id}
                    className="border-b border-border/40 transition-colors duration-150 last:border-0 hover:bg-muted/30"
                  >
                    <td
                      className={tableSerialCellClassName(
                        dense ? "py-1.5 pr-2 text-[13px]" : "py-2 pr-3",
                      )}
                    >
                      {tableRowSerialFromIndex(index)}
                    </td>
                    {row.cells.map((cell, i) => (
                      <td
                        key={`${row.id}-${i}`}
                        className={cn(
                          "text-foreground/90",
                          dense ? "py-1.5 pr-2 text-[13px]" : "py-2 pr-3",
                        )}
                      >
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
        <CardFooter className={cn(dense ? "pt-0 pb-3" : "pt-0")}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 cursor-pointer px-2 text-xs"
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}
