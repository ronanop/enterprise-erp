import type { AssetDetailDrawerTimelineEvent } from "@/components/assets/inventory/interaction/inventory-interaction.types";
import { classifyActivityDay } from "@/components/assets/operations-activity-grouping";
import { EmptyState } from "@/components/assets/shared";
import { cn } from "@/lib/utils";

export type TimelineSectionProps = {
  events?: AssetDetailDrawerTimelineEvent[] | null;
  className?: string;
};

const GROUP_ORDER = ["today", "yesterday", "earlier"] as const;
const GROUP_LABELS = {
  today: "Today",
  yesterday: "Yesterday",
  earlier: "Earlier",
} as const;

export function TimelineSection({ events, className }: TimelineSectionProps) {
  const list = events ?? [];
  const grouped = GROUP_ORDER.map((g) => ({
    group: g,
    label: GROUP_LABELS[g],
    items: list.filter((event) => classifyActivityDay(event.at) === g),
  })).filter((g) => g.items.length > 0);

  return (
    <section
      aria-labelledby="drawer-timeline-heading"
      className={cn("space-y-3", className)}
      data-testid="drawer-timeline-section"
    >
      <h3 id="drawer-timeline-heading" className="text-sm font-medium tracking-tight text-foreground">
        Timeline
      </h3>
      {list.length === 0 ? (
        <EmptyState
          variant="no-activity"
          compact
          title="No timeline events"
          description="Lifecycle and assignment activity will appear here."
        />
      ) : (
        <div className="space-y-4">
          {grouped.map((group) => (
            <div key={group.group} data-testid="drawer-timeline-day-group">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </p>
              <ol className="relative space-y-0 border-l border-border/70 pl-4">
                {group.items.map((event, index) => (
                  <li
                    key={event.id}
                    className="relative pb-4 last:pb-0"
                    data-testid="drawer-timeline-event"
                  >
                    <span
                      className={cn(
                        "absolute -left-[1.15rem] top-1 size-2.5 rounded-full border-2 border-background",
                        index === group.items.length - 1 ? "bg-primary" : "bg-muted-foreground/50",
                      )}
                      aria-hidden
                    />
                    <p className="text-sm font-medium text-foreground">{event.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {event.at === "—" ? "Date unknown" : event.at}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
