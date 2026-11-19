"use client";

import { cn } from "@/lib/utils";
import { formatServiceDisplayText } from "@/lib/service-display-text";
import {
  formatDurationMinutes,
  type TicketSlaPauseItem,
} from "@/services/service-request-ticket-service";

type SlaHistoryEvent = {
  id: string;
  kind: "paused" | "resumed";
  at: string;
  reason: string;
  durationMinutes?: number | null;
  stillActive?: boolean;
};

function formatWhen(iso: string | null | undefined): { date: string; time: string } {
  if (!iso) return { date: "—", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    const raw = iso.slice(0, 16).replace("T", " ");
    const [date = raw, time = ""] = raw.split(" ");
    return { date, time };
  }
  return {
    date: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
  };
}

function toEvents(pauses: TicketSlaPauseItem[]): SlaHistoryEvent[] {
  const events: SlaHistoryEvent[] = [];
  for (const pause of pauses) {
    events.push({
      id: `${pause.id}-paused`,
      kind: "paused",
      at: pause.paused_at,
      reason: pause.reason,
      stillActive: Boolean(pause.is_active || !pause.resumed_at),
    });
    if (pause.resumed_at) {
      events.push({
        id: `${pause.id}-resumed`,
        kind: "resumed",
        at: pause.resumed_at,
        reason: pause.resume_reason?.trim() || "SLA clock resumed",
        durationMinutes: pause.duration_minutes,
      });
    }
  }
  return events.sort((a, b) => (b.at || "").localeCompare(a.at || ""));
}

export function SlaHistoryTimeline({
  pauses,
  emptyText = "No SLA pause / resume history yet.",
  className,
  maxHeightClassName = "max-h-72",
}: {
  pauses: TicketSlaPauseItem[];
  emptyText?: string;
  className?: string;
  maxHeightClassName?: string;
}) {
  const events = toEvents(pauses);

  if (events.length === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border border-dashed border-border/70 px-3 py-8 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        {emptyText}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{events.length}</span> SLA event
        {events.length === 1 ? "" : "s"} · newest first
      </p>
      <ol className={cn("relative space-y-0 overflow-y-auto pr-1", maxHeightClassName)}>
        {events.map((event, i) => {
          const when = formatWhen(event.at);
          const isPaused = event.kind === "paused";
          return (
            <li key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
              <div className="flex w-3 shrink-0 flex-col items-center">
                <span
                  className={cn(
                    "mt-1.5 size-2.5 shrink-0 rounded-full ring-4 ring-card",
                    isPaused ? "bg-amber-500" : "bg-teal-500",
                  )}
                  aria-hidden
                />
                {i < events.length - 1 ? (
                  <span className="mt-1 w-px flex-1 bg-border/80" aria-hidden />
                ) : null}
              </div>

              <div className="min-w-0 flex-1 rounded-lg border border-border/70 bg-background/80 px-3 py-2.5 shadow-sm">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
                      isPaused
                        ? "bg-amber-500/15 text-amber-900 dark:text-amber-300"
                        : "bg-teal-500/15 text-teal-800 dark:text-teal-300",
                    )}
                  >
                    {isPaused
                      ? event.stillActive
                        ? "Paused · active"
                        : "Paused"
                      : "Unpaused"}
                  </span>
                  <time className="text-[11px] tabular-nums text-muted-foreground" dateTime={event.at}>
                    <span className="font-semibold text-foreground/80">{when.date}</span>
                    {when.time ? <> · {when.time}</> : null}
                  </time>
                </div>

                <p className="mt-1.5 text-sm font-semibold text-foreground">
                  {isPaused ? "SLA clock paused" : "SLA clock resumed"}
                </p>

                <dl className="mt-2 space-y-1.5">
                  <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-2 text-xs leading-snug">
                    <dt className="font-semibold tracking-wide text-foreground/80">
                      {isPaused ? "Reason" : "Resume"}
                    </dt>
                    <dd className="min-w-0 break-words font-bold text-foreground [overflow-wrap:anywhere]">
                      {formatServiceDisplayText(event.reason)}
                    </dd>
                  </div>
                  {!isPaused && event.durationMinutes != null ? (
                    <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-2 text-xs leading-snug">
                      <dt className="font-semibold tracking-wide text-foreground/80">Duration</dt>
                      <dd className="font-bold text-foreground">
                        {formatDurationMinutes(event.durationMinutes)}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
