"use client";

import {
  Archive,
  CheckCircle2,
  CircleDot,
  FileText,
  History,
  MessageSquare,
  Rocket,
  Send,
  ThumbsUp,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { formatMarketingStatus, type MarketingActivityLog } from "@/services/marketing-service";
import { cn } from "@/lib/utils";

type ActivityVisual = {
  icon: LucideIcon;
  tone: "default" | "success" | "warning" | "danger" | "info";
};

function activityVisual(action: string): ActivityVisual {
  const key = action.toLowerCase();
  if (key.includes("published") || key.includes("posted")) {
    return { icon: Rocket, tone: "success" };
  }
  if (key.includes("archived")) {
    return { icon: Archive, tone: "default" };
  }
  if (key.includes("approved")) {
    return { icon: ThumbsUp, tone: "success" };
  }
  if (key.includes("rejected")) {
    return { icon: XCircle, tone: "danger" };
  }
  if (key.includes("submitted") || key.includes("sent")) {
    return { icon: Send, tone: "info" };
  }
  if (key.includes("changes") || key.includes("feedback")) {
    return { icon: MessageSquare, tone: "warning" };
  }
  if (key.includes("reported")) {
    return { icon: CheckCircle2, tone: "info" };
  }
  if (key.includes("linkedin")) {
    return { icon: FileText, tone: "info" };
  }
  return { icon: History, tone: "default" };
}

const toneClasses: Record<ActivityVisual["tone"], { dot: string; icon: string }> = {
  default: {
    dot: "border-border bg-muted text-muted-foreground",
    icon: "bg-muted text-muted-foreground",
  },
  success: {
    dot: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    icon: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  warning: {
    dot: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
    icon: "bg-amber-500/10 text-amber-800 dark:text-amber-200",
  },
  danger: {
    dot: "border-destructive/40 bg-destructive/10 text-destructive",
    icon: "bg-destructive/10 text-destructive",
  },
  info: {
    dot: "border-primary/30 bg-primary/5 text-primary",
    icon: "bg-primary/5 text-primary",
  },
};

function formatActivityTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  let date: string;
  if (sameDay(d, today)) date = "Today";
  else if (sameDay(d, yesterday)) date = "Yesterday";
  else {
    date = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return { date, time };
}

type MarketingContentActivityTimelineProps = {
  entries: MarketingActivityLog[];
  className?: string;
};

export function MarketingContentActivityTimeline({ entries, className }: MarketingContentActivityTimelineProps) {
  const sorted = [...entries].sort((a, b) => a.created_at.localeCompare(b.created_at));

  return (
    <section className={cn("rounded-xl border border-border/80 bg-card", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-muted">
            <History className="size-3.5 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-medium">Activity</h3>
            <p className="text-[11px] text-muted-foreground">
              {sorted.length === 0 ? "No events yet" : `${sorted.length} event${sorted.length === 1 ? "" : "s"}`}
            </p>
          </div>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
          <CircleDot className="size-5 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">No activity recorded for this post yet.</p>
        </div>
      ) : (
        <ol className="max-h-56 space-y-0 overflow-y-auto px-4 py-3">
          {sorted.map((log, index) => {
            const { icon: Icon, tone } = activityVisual(log.action);
            const { date, time } = formatActivityTime(log.created_at);
            const isLast = index === sorted.length - 1;

            return (
              <li key={log.id} className="relative flex gap-3 pb-4 last:pb-0">
                {!isLast ? (
                  <span
                    aria-hidden
                    className="absolute left-[15px] top-8 bottom-0 w-px bg-border/80"
                  />
                ) : null}

                <div
                  className={cn(
                    "relative z-[1] flex size-8 shrink-0 items-center justify-center rounded-full border",
                    toneClasses[tone].dot,
                  )}
                >
                  <Icon className="size-3.5" />
                </div>

                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                    <p className="text-sm font-medium leading-snug">{formatMarketingStatus(log.action)}</p>
                    <div className="shrink-0 text-right text-[11px] leading-tight text-muted-foreground">
                      <p>{date}</p>
                      <p>{time}</p>
                    </div>
                  </div>
                  {log.details ? (
                    <p className="mt-1 rounded-md bg-muted/40 px-2.5 py-1.5 text-xs leading-relaxed text-muted-foreground">
                      {log.details}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
