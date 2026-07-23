"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  FilePlus2,
  GitBranch,
  Paperclip,
  Send,
  ShieldCheck,
  XCircle,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";
import {
  getOpportunityTimeline,
  type OpportunityTimeline,
  type OpportunityTimelineEvent,
} from "@/services/sales-crm-service";

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function eventIcon(event: OpportunityTimelineEvent) {
  switch (event.event_type) {
    case "approval_requested":
      return Send;
    case "approval_decided":
      return event.decision === "rejected" ? XCircle : ShieldCheck;
    case "approval_cancelled":
      return XCircle;
    case "attachment":
      return Paperclip;
    case "created":
      return FilePlus2;
    case "stage_change":
      return GitBranch;
    case "state_transition":
      return CheckCircle2;
    default:
      return Clock3;
  }
}

function eventTone(event: OpportunityTimelineEvent): string {
  if (event.event_type === "approval_decided" && event.decision === "rejected") {
    return "border-destructive/40 bg-destructive/10 text-destructive";
  }
  if (event.event_type === "approval_decided" && event.decision === "approved") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700";
  }
  if (event.event_type === "approval_requested") {
    return "border-sky-500/30 bg-sky-500/10 text-sky-700";
  }
  if (event.event_type === "attachment") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-800";
  }
  return "border-border bg-muted text-muted-foreground";
}

function EventCard({ event }: { event: OpportunityTimelineEvent }) {
  const Icon = eventIcon(event);
  return (
    <li className="relative pl-8">
      <span
        className={cn(
          "absolute top-0.5 left-0 flex size-6 items-center justify-center rounded-full border",
          eventTone(event),
        )}
        aria-hidden
      >
        <Icon className="size-3.5" />
      </span>
      <div className="rounded-lg border border-border/70 bg-card px-3 py-2.5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-foreground">{event.title}</p>
            {event.entity_label ? (
              <p className="mt-0.5 text-[11px] text-muted-foreground">{event.entity_label}</p>
            ) : null}
          </div>
          <time
            dateTime={event.occurred_at}
            className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground"
          >
            {formatWhen(event.occurred_at)}
          </time>
        </div>

        {event.summary ? (
          <p className="mt-1.5 text-[12px] leading-relaxed text-foreground/85">{event.summary}</p>
        ) : null}

        <dl className="mt-2 grid gap-1 text-[11px] text-muted-foreground">
          {event.actor_name ? (
            <div className="flex gap-1.5">
              <dt className="shrink-0 font-medium text-foreground/70">By</dt>
              <dd>{event.actor_name}</dd>
            </div>
          ) : null}
          {event.requested_by_name && event.event_type !== "approval_requested" ? (
            <div className="flex gap-1.5">
              <dt className="shrink-0 font-medium text-foreground/70">Requested by</dt>
              <dd>{event.requested_by_name}</dd>
            </div>
          ) : null}
          {event.decided_by_name ? (
            <div className="flex gap-1.5">
              <dt className="shrink-0 font-medium text-foreground/70">Decided by</dt>
              <dd>{event.decided_by_name}</dd>
            </div>
          ) : null}
          {event.from_state || event.to_state ? (
            <div className="flex gap-1.5">
              <dt className="shrink-0 font-medium text-foreground/70">State</dt>
              <dd className="font-mono">
                {[event.from_state, event.to_state].filter(Boolean).join(" → ")}
              </dd>
            </div>
          ) : null}
          {event.team_role ? (
            <div className="flex gap-1.5">
              <dt className="shrink-0 font-medium text-foreground/70">Team</dt>
              <dd className="capitalize">{event.team_role.replaceAll("_", " ")}</dd>
            </div>
          ) : null}
          {typeof event.version === "number" ? (
            <div className="flex gap-1.5">
              <dt className="shrink-0 font-medium text-foreground/70">Version</dt>
              <dd className="font-mono">v{event.version}</dd>
            </div>
          ) : null}
          {event.remark && event.remark !== event.summary ? (
            <div className="flex gap-1.5">
              <dt className="shrink-0 font-medium text-foreground/70">Remark</dt>
              <dd>{event.remark}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    </li>
  );
}

export function OpportunityTimelinePanel({
  opportunityId,
  open,
  onClose,
}: {
  opportunityId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [data, setData] = useState<OpportunityTimeline | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getOpportunityTimeline(opportunityId)
      .then((timeline) => {
        if (!cancelled) setData(timeline);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiClientError ? err.message : "Failed to load timeline");
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, opportunityId]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-foreground/40 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200"
      role="presentation"
      onClick={onClose}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="opportunity-timeline-title"
        className="flex h-full w-full max-w-md flex-col border-l border-border/80 bg-background shadow-xl motion-safe:animate-in motion-safe:slide-in-from-right-4 motion-safe:duration-200"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
              History
            </p>
            <h2
              id="opportunity-timeline-title"
              className="truncate text-sm font-medium tracking-tight text-foreground"
            >
              Opportunity timeline
            </h2>
            {data?.opportunity_code || data?.opportunity_name ? (
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {[data.opportunity_code, data.opportunity_name].filter(Boolean).join(" · ")}
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 shrink-0 cursor-pointer p-0"
            aria-label="Close timeline"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <p className="text-xs text-muted-foreground">Loading history…</p>
          ) : null}
          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          ) : null}
          {!loading && !error && data && data.events.length === 0 ? (
            <p className="text-xs text-muted-foreground">No history recorded yet.</p>
          ) : null}
          {!loading && data && data.events.length > 0 ? (
            <ol className="relative space-y-3 before:absolute before:top-3 before:bottom-3 before:left-[11px] before:w-px before:bg-border/80">
              {data.events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </ol>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
