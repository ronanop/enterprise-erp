"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  FileText,
  History,
  PackageCheck,
  RefreshCw,
  ShoppingCart,
  Truck,
  UserPlus,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";
import {
  getDealTimeline,
  type DealTimeline,
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
  const type = event.entity_type;
  const action = event.action ?? "";
  if (type === "project") return action === "project_completed" ? CheckCircle2 : UserPlus;
  if (event.event_type === "procurement_action") return ShoppingCart;
  if (event.event_type === "grn") return PackageCheck;
  if (event.event_type === "delivery") return Truck;
  if (type === "ovf" || type === "quote") return FileText;
  if (event.event_type === "state_transition") return CheckCircle2;
  return Clock3;
}

function eventTone(event: OpportunityTimelineEvent): string {
  const type = event.entity_type;
  const action = event.action ?? "";
  if (action === "project_completed" || action === "deal_won") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700";
  }
  if (type === "project") return "border-teal-500/30 bg-teal-500/10 text-teal-800";
  if (event.event_type === "delivery") return "border-indigo-500/30 bg-indigo-500/10 text-indigo-800";
  if (event.event_type === "grn") return "border-teal-500/30 bg-teal-500/10 text-teal-800";
  if (event.event_type === "procurement_action") return "border-violet-500/30 bg-violet-500/10 text-violet-800";
  if (type === "lead") return "border-sky-500/30 bg-sky-500/10 text-sky-700";
  if (type === "ovf") return "border-amber-500/30 bg-amber-500/10 text-amber-900";
  if (type === "quote") return "border-slate-400/30 bg-slate-500/10 text-slate-800";
  return "border-border bg-muted text-muted-foreground";
}

function LaneBadge({ event }: { event: OpportunityTimelineEvent }) {
  const lane =
    event.entity_type === "project"
      ? "Project"
      : event.entity_type === "ovf" && event.event_type !== "state_transition"
        ? "OVF"
        : event.event_type === "procurement_action" ||
            event.event_type === "grn" ||
            event.event_type === "delivery"
          ? "SCM"
          : event.entity_type === "lead"
            ? "CRM"
            : event.entity_type === "quote"
              ? "CRM"
              : "CRM";
  return (
    <Badge variant="outline" className="shrink-0 text-[10px] font-medium uppercase tracking-wide">
      {lane}
    </Badge>
  );
}

function TimelineEventCard({ event }: { event: OpportunityTimelineEvent }) {
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
          <div className="flex min-w-0 items-center gap-2">
            <p className="text-[13px] font-medium text-foreground">{event.title}</p>
            <LaneBadge event={event} />
          </div>
          <time
            dateTime={event.occurred_at}
            className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground"
          >
            {formatWhen(event.occurred_at)}
          </time>
        </div>
        {event.entity_label ? (
          <p className="mt-0.5 text-[11px] text-muted-foreground">{event.entity_label}</p>
        ) : null}
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
          {event.from_state || event.to_state ? (
            <div className="flex gap-1.5">
              <dt className="shrink-0 font-medium text-foreground/70">State</dt>
              <dd className="font-mono">{[event.from_state, event.to_state].filter(Boolean).join(" → ")}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    </li>
  );
}

export function DealTimelineDetailPage({ opportunityId }: { opportunityId: string }) {
  const [data, setData] = useState<DealTimeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        setData(await getDealTimeline(opportunityId));
      } catch (err) {
        setError(err instanceof ApiClientError ? err.message : "Failed to load deal timeline");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [opportunityId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const events = data?.events ?? [];
  const completed = (data?.timeline_status ?? "ongoing") === "completed";

  return (
    <div className="space-y-4">
      <PageHeader
        title={data?.opportunity_name || data?.opportunity_code || "Deal timeline"}
        description={
          [data?.opportunity_code, data?.customer_name].filter(Boolean).join(" · ") ||
          "Full deal journey across CRM, SCM, and Projects"
        }
        backHref="/crm/timeline"
        backLabel="Deal Timeline"
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer transition-colors duration-200"
            disabled={loading || refreshing}
            onClick={() => void load(true)}
          >
            <RefreshCw className={cn("mr-1.5 size-3.5", refreshing && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <section className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground">
            <History className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">Deal journey</h2>
            <p className="text-xs text-muted-foreground">
              Lead → Opportunity → Quote → OVF → Shared to SCM → PO → Delivery → Project handoff →
              Project completion.
            </p>
          </div>
          {data ? (
            <Badge
              variant="outline"
              className={cn(
                "font-medium uppercase",
                completed
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                  : "border-amber-300 bg-amber-50 text-amber-900",
              )}
            >
              {completed ? "Completed" : "Ongoing"}
            </Badge>
          ) : null}
        </div>

        {loading && !data ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading timeline…</p>
        ) : events.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No activity recorded yet.</p>
        ) : (
          <ol className="relative space-y-4 border-l border-border/70 pl-1">
            {events.map((event) => (
              <TimelineEventCard key={event.id} event={event} />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
