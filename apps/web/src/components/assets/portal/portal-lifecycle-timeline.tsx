"use client";

import type { LucideIcon } from "lucide-react";
import {
  CheckCircle2,
  CircleDot,
  FilePenLine,
  PlusCircle,
  RefreshCw,
  UserMinus,
  UserPlus,
  Wrench,
} from "lucide-react";
import type { ReactNode } from "react";

export type PortalTimelineKind =
  | "created"
  | "updated"
  | "status"
  | "assigned"
  | "returned"
  | "maintenance_started"
  | "maintenance_completed"
  | "other";

export type PortalTimelineEvent = {
  id: string;
  kind: PortalTimelineKind | string;
  stage: string;
  title: string;
  detail?: string | null;
  occurredAt?: string | null;
  actorLabel?: string | null;
  referenceLabel?: string | null;
  meta?: Array<{ label: string; value: string }>;
  action?: ReactNode;
};

const KIND_STYLE: Record<
  string,
  { icon: LucideIcon; rail: string; badge: string; iconWrap: string }
> = {
  created: {
    icon: PlusCircle,
    rail: "border-emerald-500/40",
    badge: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    iconWrap: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  },
  assigned: {
    icon: UserPlus,
    rail: "border-sky-500/40",
    badge: "bg-sky-50 text-sky-800 ring-sky-200",
    iconWrap: "bg-sky-100 text-sky-700 ring-sky-200",
  },
  returned: {
    icon: UserMinus,
    rail: "border-slate-400/50",
    badge: "bg-slate-100 text-slate-700 ring-slate-200",
    iconWrap: "bg-slate-100 text-slate-700 ring-slate-200",
  },
  maintenance_started: {
    icon: Wrench,
    rail: "border-amber-500/40",
    badge: "bg-amber-50 text-amber-900 ring-amber-200",
    iconWrap: "bg-amber-100 text-amber-800 ring-amber-200",
  },
  maintenance_completed: {
    icon: CheckCircle2,
    rail: "border-teal-500/40",
    badge: "bg-teal-50 text-teal-800 ring-teal-200",
    iconWrap: "bg-teal-100 text-teal-700 ring-teal-200",
  },
  updated: {
    icon: FilePenLine,
    rail: "border-violet-500/40",
    badge: "bg-violet-50 text-violet-800 ring-violet-200",
    iconWrap: "bg-violet-100 text-violet-700 ring-violet-200",
  },
  status: {
    icon: RefreshCw,
    rail: "border-indigo-500/40",
    badge: "bg-indigo-50 text-indigo-800 ring-indigo-200",
    iconWrap: "bg-indigo-100 text-indigo-700 ring-indigo-200",
  },
  other: {
    icon: CircleDot,
    rail: "border-border",
    badge: "bg-muted text-muted-foreground ring-border",
    iconWrap: "bg-muted text-muted-foreground ring-border",
  },
};

export function formatPortalDateTime(value?: string | null): string {
  if (!value || !String(value).trim()) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function formatPortalDate(value?: string | null): string {
  if (!value || !String(value).trim()) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(d);
}

type Props = {
  events: PortalTimelineEvent[];
  emptyTitle?: string;
  emptyDescription?: string;
  testId?: string;
};

export function PortalLifecycleTimeline({
  events,
  emptyTitle = "No activity yet",
  emptyDescription = "Lifecycle events will appear here as this asset is created, assigned, maintained, or updated.",
  testId = "portal-lifecycle-timeline",
}: Props) {
  if (events.length === 0) {
    return (
      <div
        className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-8 text-center"
        data-testid={testId}
      >
        <p className="text-sm font-medium text-foreground">{emptyTitle}</p>
        <p className="mt-1 text-xs text-muted-foreground">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <ol className="relative space-y-0" data-testid={testId}>
      {events.map((event, index) => {
        const style = KIND_STYLE[event.kind] ?? KIND_STYLE.other;
        const Icon = style.icon;
        const isLast = index === events.length - 1;
        return (
          <li key={event.id} className="relative flex gap-3 pb-6 last:pb-0">
            {!isLast ? (
              <span
                aria-hidden
                className={`absolute left-[15px] top-8 bottom-0 w-px bg-border/80`}
              />
            ) : null}
            <div
              className={`relative z-[1] mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ring-1 ${style.iconWrap}`}
            >
              <Icon className="size-3.5" aria-hidden />
            </div>
            <div
              className={`min-w-0 flex-1 rounded-xl border bg-card/80 px-3.5 py-3 shadow-sm transition-colors duration-200 hover:bg-card ${style.rail}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${style.badge}`}
                    >
                      {event.stage}
                    </span>
                    {event.referenceLabel ? (
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {event.referenceLabel}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm font-medium text-foreground">{event.title}</p>
                  {event.detail ? (
                    <p className="text-xs leading-relaxed text-muted-foreground">{event.detail}</p>
                  ) : null}
                  {event.meta && event.meta.length > 0 ? (
                    <dl className="mt-2 grid gap-1.5 sm:grid-cols-2">
                      {event.meta.map((item) => (
                        <div key={`${event.id}-${item.label}`} className="min-w-0">
                          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            {item.label}
                          </dt>
                          <dd className="truncate text-xs text-foreground">{item.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <time
                    className="whitespace-nowrap text-[11px] tabular-nums text-muted-foreground"
                    dateTime={event.occurredAt ?? undefined}
                  >
                    {formatPortalDateTime(event.occurredAt)}
                  </time>
                  {event.action}
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
