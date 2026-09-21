"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Mail, RefreshCw, TriangleAlert } from "lucide-react";

import { ProcurementPageHeader } from "@/components/procurement/procurement-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatApiError } from "@/services/api-client";
import {
  listScmCorrespondence,
  type ScmCorrespondenceDelivery,
} from "@/services/procurement-service";

const KIND_LABELS: Record<string, string> = {
  order_acknowledged: "Order acknowledgement",
  etd_reminder: "ETD reminder",
  delivery_date_shared: "Delivery date update",
};

type KindFilter = "all" | "order_acknowledged" | "etd_reminder" | "delivery_date_shared";
type StatusFilter = "all" | "delivered" | "pending" | "failed";

function kindLabel(kind: string | null | undefined, eventType?: string | null): string {
  if (kind && KIND_LABELS[kind]) return KIND_LABELS[kind];
  if (eventType?.includes("order_acknowledged")) return KIND_LABELS.order_acknowledged;
  if (eventType?.includes("etd_reminder")) return KIND_LABELS.etd_reminder;
  if (eventType?.includes("delivery_date_shared")) return KIND_LABELS.delivery_date_shared;
  return eventType?.replace("procurement.", "") || "Correspondence";
}

function resolveKind(row: ScmCorrespondenceDelivery): string {
  if (row.kind) return row.kind;
  if (row.event_type?.includes("order_acknowledged")) return "order_acknowledged";
  if (row.event_type?.includes("etd_reminder")) return "etd_reminder";
  if (row.event_type?.includes("delivery_date_shared")) return "delivery_date_shared";
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

export function CorrespondenceListPage() {
  const [rows, setRows] = useState<ScmCorrespondenceDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listScmCorrespondence(200));
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

  return (
    <div className="space-y-4">
      <ProcurementPageHeader
        title="Mails"
        description="All order acknowledgement, ETD reminder, and delivery update mails across purchase orders."
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
            <option value="order_acknowledged">Order acknowledgement</option>
            <option value="etd_reminder">ETD reminder</option>
            <option value="delivery_date_shared">Delivery date update</option>
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
          {filtered.length} of {rows.length} mail{rows.length === 1 ? "" : "s"}
        </p>
      </div>

      {error ? (
        <p className="flex items-center gap-1.5 text-xs font-medium text-red-600">
          <TriangleAlert className="size-3.5" /> {error}
        </p>
      ) : null}

      <section className="overflow-x-auto rounded-xl border border-border/70 bg-card">
        {loading && rows.length === 0 ? (
          <p className="flex items-center gap-2 px-4 py-10 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            Loading correspondence…
          </p>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <Mail className="size-8 text-muted-foreground/50" aria-hidden />
            <p className="text-sm font-medium text-foreground">No mails found</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Reminder mails sent from Delivery Tracking on any PO will show up here with
              delivery status.
            </p>
          </div>
        ) : (
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="border-b border-border/60 bg-muted/40 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-3 py-2.5">Sent</th>
                <th className="px-3 py-2.5">PO</th>
                <th className="px-3 py-2.5">Type</th>
                <th className="px-3 py-2.5">To</th>
                <th className="px-3 py-2.5">Subject</th>
                <th className="px-3 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border/40 transition-colors duration-150 hover:bg-muted/30 last:border-0"
                >
                  <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                    {formatWhen(row.delivered_at || row.created_at)}
                  </td>
                  <td className="px-3 py-2.5 font-semibold">
                    {row.order_id ? (
                      <Link
                        href={`/procurement/orders/${row.order_id}`}
                        className="cursor-pointer text-[#0369A1] underline-offset-2 transition-colors duration-200 hover:text-[#0284C7] hover:underline"
                      >
                        {row.company_po_number?.trim() || "Open PO"}
                      </Link>
                    ) : (
                      row.company_po_number?.trim() || "—"
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-medium">
                    {kindLabel(row.kind, row.event_type)}
                  </td>
                  <td className="px-3 py-2.5">{row.recipient_address || "—"}</td>
                  <td
                    className="max-w-[260px] truncate px-3 py-2.5"
                    title={row.subject ?? undefined}
                  >
                    {row.subject || "—"}
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
        )}
      </section>
    </div>
  );
}
