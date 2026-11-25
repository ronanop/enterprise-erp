"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Loader2, Mail, RefreshCw, TriangleAlert } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatApiError } from "@/services/api-client";
import {
  listScmCorrespondence,
  type ScmCorrespondenceDelivery,
} from "@/services/procurement-service";

const KIND_LABELS: Record<string, string> = {
  order_acknowledged: "Order acknowledgement",
  etd_reminder: "ETD reminder",
  delivery_date_shared: "Delivery date update",
  po_sent_to_vendor: "PO sent to vendor",
  order_processed: "Order processed",
  customer_dispatch_shared: "Customer dispatch",
};

type KindFilter =
  | "all"
  | "order_acknowledged"
  | "etd_reminder"
  | "delivery_date_shared"
  | "po_sent_to_vendor"
  | "order_processed"
  | "customer_dispatch_shared";
type StatusFilter = "all" | "delivered" | "pending" | "failed";

type PoMailGroup = {
  key: string;
  poLabel: string;
  orderId: string | null;
  mails: ScmCorrespondenceDelivery[];
};

function kindLabel(kind: string | null | undefined, eventType?: string | null): string {
  if (kind && KIND_LABELS[kind]) return KIND_LABELS[kind];
  if (eventType?.includes("order_acknowledged")) return KIND_LABELS.order_acknowledged;
  if (eventType?.includes("etd_reminder")) return KIND_LABELS.etd_reminder;
  if (eventType?.includes("delivery_date_shared")) return KIND_LABELS.delivery_date_shared;
  if (eventType?.includes("po_sent_to_vendor")) return KIND_LABELS.po_sent_to_vendor;
  if (eventType?.includes("order_processed")) return KIND_LABELS.order_processed;
  if (eventType?.includes("customer_dispatch_shared")) return KIND_LABELS.customer_dispatch_shared;
  return eventType?.replace("procurement.", "") || "Correspondence";
}

function resolveKind(row: ScmCorrespondenceDelivery): string {
  if (row.kind && KIND_LABELS[row.kind]) return row.kind;
  if (row.event_type?.includes("order_acknowledged")) return "order_acknowledged";
  if (row.event_type?.includes("etd_reminder")) return "etd_reminder";
  if (row.event_type?.includes("delivery_date_shared")) return "delivery_date_shared";
  if (row.event_type?.includes("po_sent_to_vendor")) return "po_sent_to_vendor";
  if (row.event_type?.includes("order_processed")) return "order_processed";
  if (row.event_type?.includes("customer_dispatch_shared")) return "customer_dispatch_shared";
  if (row.kind) return row.kind;
  return "other";
}

function formatWhen(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 16);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "delivered" || s === "sent" || s === "success") {
    return "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200";
  }
  if (s === "pending" || s === "queued" || s === "processing") {
    return "border-transparent bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100";
  }
  if (s === "failed" || s === "bounced" || s === "error") {
    return "border-transparent bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200";
  }
  return "border-border/70 bg-muted text-muted-foreground";
}

function statusBucket(status: string): StatusFilter {
  const s = status.toLowerCase();
  if (s === "delivered" || s === "sent" || s === "success") return "delivered";
  if (s === "failed" || s === "bounced" || s === "error") return "failed";
  if (s === "pending" || s === "queued" || s === "processing") return "pending";
  return "pending";
}

function poGroupKey(row: ScmCorrespondenceDelivery): string {
  const po = row.company_po_number?.trim();
  if (po) return `po:${po.toLowerCase()}`;
  if (row.order_id) return `order:${row.order_id}`;
  return "unknown";
}

function poGroupLabel(row: ScmCorrespondenceDelivery): string {
  return row.company_po_number?.trim() || (row.order_id ? "Open PO" : "Unknown PO");
}

export function CorrespondenceListPage() {
  const [rows, setRows] = useState<ScmCorrespondenceDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listScmCorrespondence(500));
    } catch (err) {
      setError(formatApiError(err, "Failed to load correspondence"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      const kind = resolveKind(row);
      if (kindFilter !== "all" && kind !== kindFilter) return false;
      if (statusFilter !== "all" && statusBucket(row.status) !== statusFilter) return false;
      if (!q) return true;
      const hay = [
        row.company_po_number,
        row.recipient_address,
        row.subject,
        kindLabel(row.kind, row.event_type),
        row.status,
        row.order_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query, kindFilter, statusFilter]);

  const groups = useMemo(() => {
    const map = new Map<string, PoMailGroup>();
    for (const row of filtered) {
      const key = poGroupKey(row);
      const existing = map.get(key);
      if (existing) {
        existing.mails.push(row);
        continue;
      }
      map.set(key, {
        key,
        poLabel: poGroupLabel(row),
        orderId: row.order_id || null,
        mails: [row],
      });
    }
    const list = [...map.values()];
    for (const group of list) {
      group.mails.sort((a, b) =>
        String(b.delivered_at || b.created_at || "").localeCompare(
          String(a.delivered_at || a.created_at || ""),
        ),
      );
    }
    list.sort((a, b) => {
      const aTs = a.mails[0]?.delivered_at || a.mails[0]?.created_at || "";
      const bTs = b.mails[0]?.delivered_at || b.mails[0]?.created_at || "";
      return String(bTs).localeCompare(String(aTs));
    });
    return list;
  }, [filtered]);

  function toggleGroup(key: string) {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Mails"
        description="Mails by purchase order — type, recipient, and delivery status for every send."
        actions={
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="cursor-pointer transition-colors duration-200"
            disabled={loading}
            onClick={() => void load()}
          >
            {loading ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 size-3.5" />
            )}
            Refresh
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1">
          <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            Search
          </span>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="PO, recipient, subject…"
            className="h-9 w-64 text-[13px]"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            Type
          </span>
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as KindFilter)}
            className="flex h-9 w-52 cursor-pointer rounded-md border border-border/80 bg-background px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-primary/25"
          >
            <option value="all">All types</option>
            <option value="po_sent_to_vendor">PO sent to vendor</option>
            <option value="order_processed">Order processed</option>
            <option value="order_acknowledged">Order acknowledgement</option>
            <option value="etd_reminder">ETD reminder</option>
            <option value="delivery_date_shared">Delivery date update</option>
            <option value="customer_dispatch_shared">Customer dispatch</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            Status
          </span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="flex h-9 w-40 cursor-pointer rounded-md border border-border/80 bg-background px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-primary/25"
          >
            <option value="all">All statuses</option>
            <option value="delivered">Delivered / sent</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </label>
        <p className="pb-2 text-[11px] text-muted-foreground">
          {groups.length} PO{groups.length === 1 ? "" : "s"} · {filtered.length} mail
          {filtered.length === 1 ? "" : "s"}
        </p>
      </div>

      {error ? (
        <p className="flex items-center gap-1.5 text-xs font-medium text-red-600">
          <TriangleAlert className="size-3.5" /> {error}
        </p>
      ) : null}

      <section className="space-y-3">
        {loading && rows.length === 0 ? (
          <div className="rounded-xl border border-border/70 bg-card px-4 py-10">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              Loading correspondence…
            </p>
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-border/70 bg-card px-4 py-12 text-center">
            <Mail className="size-8 text-muted-foreground/50" aria-hidden />
            <p className="text-sm font-medium text-foreground">No mails found</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Reminder mails sent from Delivery Tracking on any PO will show up here with
              delivery status.
            </p>
          </div>
        ) : (
          groups.map((group) => {
            const isCollapsed = Boolean(collapsed[group.key]);
            return (
              <div
                key={group.key}
                className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  className="flex w-full cursor-pointer items-center justify-between gap-3 border-b border-border/60 bg-muted/30 px-4 py-3 text-left transition-colors duration-200 hover:bg-muted/50"
                  aria-expanded={!isCollapsed}
                >
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                      Purchase order
                    </p>
                    {group.orderId ? (
                      <Link
                        href={`/procurement/orders/${group.orderId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="cursor-pointer text-sm font-semibold text-[#0369A1] underline-offset-2 transition-colors duration-200 hover:text-[#0284C7] hover:underline"
                      >
                        {group.poLabel}
                      </Link>
                    ) : (
                      <p className="text-sm font-semibold text-foreground">{group.poLabel}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge
                      variant="outline"
                      className="rounded-full px-2 py-0 text-[10px] font-semibold"
                    >
                      {group.mails.length} mail{group.mails.length === 1 ? "" : "s"}
                    </Badge>
                    <ChevronDown
                      className={cn(
                        "size-4 text-muted-foreground transition-transform duration-200",
                        isCollapsed && "-rotate-90",
                      )}
                      aria-hidden
                    />
                  </div>
                </button>

                {!isCollapsed ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[880px] text-left text-xs">
                      <thead className="border-b border-border/60 bg-muted/20 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                        <tr>
                          <th className="px-3 py-2.5">Mail type</th>
                          <th className="px-3 py-2.5">Sent to</th>
                          <th className="px-3 py-2.5">Subject</th>
                          <th className="px-3 py-2.5">Sent</th>
                          <th className="px-3 py-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.mails.map((row) => (
                          <tr
                            key={row.id}
                            className="border-b border-border/40 transition-colors duration-150 hover:bg-muted/30 last:border-0"
                          >
                            <td className="px-3 py-2.5 font-medium">
                              {kindLabel(row.kind, row.event_type)}
                            </td>
                            <td className="px-3 py-2.5">
                              <span className="font-medium text-foreground">
                                {row.recipient_address || "—"}
                              </span>
                            </td>
                            <td
                              className="max-w-[280px] truncate px-3 py-2.5"
                              title={row.subject ?? undefined}
                            >
                              {row.subject || "—"}
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                              {formatWhen(row.delivered_at || row.created_at)}
                            </td>
                            <td className="px-3 py-2.5">
                              <Badge
                                className={`rounded-full px-2 py-0 text-[10px] font-semibold capitalize ${statusBadgeClass(row.status)}`}
                              >
                                {row.status}
                              </Badge>
                              {row.provider_response ? (
                                <p
                                  className="mt-0.5 max-w-[200px] truncate text-[10px] text-muted-foreground"
                                  title={row.provider_response}
                                >
                                  {row.provider_response}
                                </p>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
