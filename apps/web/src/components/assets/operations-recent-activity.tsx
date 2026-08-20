"use client";

import type { RecentActivityItem } from "@/components/assets/dashboard.mapper";
import { groupRecentActivityByDay } from "@/components/assets/operations-activity-grouping";
import { EmptyState, TableRowsSkeleton } from "@/components/assets/shared";
import { cn } from "@/lib/utils";

export type OperationsRecentActivityProps = {
  items?: RecentActivityItem[];
  loading?: boolean;
  className?: string;
};

export function OperationsRecentActivity({
  items = [],
  loading = false,
  className,
}: OperationsRecentActivityProps) {
  const groups = groupRecentActivityByDay(items);

  return (
    <section
      aria-labelledby="asset-ops-recent-activity-heading"
      className={cn(
        "space-y-3 transition-opacity duration-200 motion-reduce:transition-none",
        className,
      )}
      data-testid="asset-ops-recent-activity"
    >
      <h2
        id="asset-ops-recent-activity-heading"
        className="text-sm font-medium tracking-tight text-foreground"
      >
        Recent Activity
      </h2>

      <div className="overflow-x-auto rounded-lg border border-border/70">
        <table className="w-full min-w-[640px] text-sm" data-testid="asset-ops-recent-activity-table">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Event</th>
              <th className="px-3 py-2 font-medium">Asset</th>
              <th className="px-3 py-2 font-medium">Employee</th>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="p-4">
                  <TableRowsSkeleton rows={4} />
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6">
                  <EmptyState variant="no-activity" compact />
                </td>
              </tr>
            ) : (
              groups.map((group) => (
                <GroupRows key={group.group} label={group.label} items={group.items} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function GroupRows({ label, items }: { label: string; items: RecentActivityItem[] }) {
  return (
    <>
      <tr className="border-t border-border/50 bg-muted/30" data-testid="activity-day-group">
        <td colSpan={5} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </td>
      </tr>
      {items.map((item) => (
        <tr
          key={item.id}
          className="border-t border-border/40 transition-colors duration-150 hover:bg-muted/20"
          data-testid="asset-ops-recent-activity-row"
        >
          <td className="px-3 py-2 font-medium">{item.label}</td>
          <td className="px-3 py-2 font-mono text-xs">{item.asset}</td>
          <td className="px-3 py-2">{item.employee}</td>
          <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{item.date}</td>
          <td className="px-3 py-2 capitalize">{item.status}</td>
        </tr>
      ))}
    </>
  );
}
