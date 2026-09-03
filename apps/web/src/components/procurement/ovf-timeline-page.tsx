"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock3,
  History,
  PackageCheck,
  RefreshCw,
  Search,
  ShoppingCart,
  Truck,
} from "lucide-react";

import { ProcurementPageHeader } from "@/components/procurement/procurement-page-header";
import {
  ProcurementErrorBanner,
  ProcurementListPanel,
  ProcurementPage,
  procurementUi,
} from "@/components/procurement/procurement-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";
import {
  getOvfTimeline,
  listOvfTimelineRows,
  type OvfTimeline,
  type OvfTimelineEvent,
  type OvfTimelineListItem,
} from "@/services/procurement-service";
import {
  buildLocalDeliveryTimelineEvents,
  mergeOvfTimelineEvents,
  resolveTimelineStatus,
} from "@/utils/ovf-timeline-delivery-events";
import { formatUniquePoList } from "@/utils/format-po-labels";

const REFRESH_MS = 15_000;

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function eventIcon(event: OvfTimelineEvent) {
  switch (event.event_type) {
    case "procurement_action":
      return ShoppingCart;
    case "grn":
      return PackageCheck;
    case "delivery":
      return Truck;
    case "state_transition":
      return CheckCircle2;
    default:
      return Clock3;
  }
}

function eventTone(event: OvfTimelineEvent): string {
  if (event.event_type === "delivery") {
    if (event.action === "delivery_completed") {
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700";
    }
    if (event.action === "delivery_failed") {
      return "border-red-500/30 bg-red-500/10 text-red-800";
    }
    if (event.action === "bill_taken") {
      return "border-amber-500/30 bg-amber-500/10 text-amber-900";
    }
    return "border-indigo-500/30 bg-indigo-500/10 text-indigo-800";
  }
  if (event.event_type === "grn") {
    return "border-teal-500/30 bg-teal-500/10 text-teal-800";
  }
  if (event.event_type === "procurement_action") {
    return "border-violet-500/30 bg-violet-500/10 text-violet-800";
  }
  if (event.action === "scm_hold") {
    return "border-red-500/30 bg-red-500/10 text-red-800";
  }
  if (event.action === "scm_release") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700";
  }
  if (event.action === "share_to_scm") {
    return "border-sky-500/30 bg-sky-500/10 text-sky-700";
  }
  return "border-border bg-muted text-muted-foreground";
}

function TimelineEventCard({ event }: { event: OvfTimelineEvent }) {
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
          {event.from_state || event.to_state ? (
            <div className="flex gap-1.5">
              <dt className="shrink-0 font-medium text-foreground/70">State</dt>
              <dd className="font-mono">
                {[event.from_state, event.to_state].filter(Boolean).join(" → ")}
              </dd>
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

function StatusBadge({ status }: { status: string }) {
  const completed = status === "completed";
  return (
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
  );
}

export function ProcurementTimelineListPage() {
  const router = useRouter();
  const [rows, setRows] = useState<OvfTimelineListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      setRows(await listOvfTimelineRows());
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load OVF timeline");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const filtered = useMemo(() => {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return rows;
    return rows.filter((row) => {
      const haystack = [
        row.ovf_no,
        row.customer_name,
        row.quote_name,
        row.account_name,
        row.blueprint_state,
        row.timeline_status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return tokens.every((token) => haystack.includes(token));
    });
  }, [query, rows]);

  return (
    <ProcurementPage>
      <ProcurementPageHeader
        title="Timeline"
        description="Procurement steps for each OVF — from SCM handoff through GRN, delivery challan, dispatch, and delivery completion."
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

      {error ? <ProcurementErrorBanner>{error}</ProcurementErrorBanner> : null}

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search OVF, customer, PO…"
          className={cn(procurementUi.searchInput, "pl-9")}
        />
      </div>

      <ProcurementListPanel id="procurement-list">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-bold">OVF no.</th>
                <th className="px-3 py-2 font-bold">Customer</th>
                <th className="px-3 py-2 font-bold">PO number</th>
                <th className="px-3 py-2 font-bold">Status</th>
                <th className="px-3 py-2 font-bold">Updated</th>
              </tr>
            </thead>
            <tbody>
              {loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                    Loading OVF timeline…
                  </td>
                </tr>
              ) : null}
              {!loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                    No OVFs in the timeline yet.
                  </td>
                </tr>
              ) : null}
              {filtered.map((row) => (
                <tr
                  key={row.ovf_id}
                  role="link"
                  tabIndex={0}
                  onClick={() => router.push(`/procurement/timeline/${row.ovf_id}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      router.push(`/procurement/timeline/${row.ovf_id}`);
                    }
                  }}
                  className="cursor-pointer border-b border-border/70 transition-colors duration-150 hover:bg-muted/30"
                >
                  <td className="px-3 py-2 font-medium tabular-nums">{row.ovf_no}</td>
                  <td className="px-3 py-2">{row.customer_name || row.account_name || "—"}</td>
                  <td className="max-w-[220px] px-3 py-2 text-muted-foreground">
                    {formatUniquePoList(row.company_po_numbers)}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={row.timeline_status} />
                  </td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {formatWhen(row.updated_at || row.shared_to_scm_at || "")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ProcurementListPanel>
    </ProcurementPage>
  );
}

export function OvfTimelineDetailPage({ ovfId }: { ovfId: string }) {
  const [data, setData] = useState<OvfTimeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      setData(await getOvfTimeline(ovfId));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load OVF timeline");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [ovfId]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const events = useMemo(() => {
    if (!data) return [];
    const local = buildLocalDeliveryTimelineEvents(data.linked_order_ids ?? []);
    return mergeOvfTimelineEvents(data.events ?? [], local);
  }, [data]);

  const timelineStatus = useMemo(
    () => resolveTimelineStatus(data?.timeline_status ?? "ongoing", events),
    [data?.timeline_status, events],
  );

  return (
    <ProcurementPage>
      <ProcurementPageHeader
        title={data?.ovf_no ? `OVF ${data.ovf_no}` : "OVF timeline"}
        description={
          data
            ? [data.customer_name, data.quote_name].filter(Boolean).join(" · ") ||
              "Procurement activity"
            : "Procurement activity"
        }
        backHref="/procurement/timeline"
        backLabel="list"
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

      {error ? <ProcurementErrorBanner>{error}</ProcurementErrorBanner> : null}

      <section className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground">
            <History className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">Procurement timeline</h2>
            <p className="text-xs text-muted-foreground">
              Shared to SCM, vendor PO, GRN receipt, delivery challan, dispatch, delivery outcome,
              and billing steps with actor and timestamp. Auto-refreshes every 15s.
            </p>
          </div>
          {data ? <StatusBadge status={timelineStatus} /> : null}
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
    </ProcurementPage>
  );
}
