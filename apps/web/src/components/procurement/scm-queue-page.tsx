"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ClipboardList,
  PauseCircle,
  RefreshCw,
  Search,
  ShoppingCart,
  CircleCheckBig,
} from "lucide-react";

import { ScmCreatePoEntry } from "@/components/procurement/scm-create-po-entry";
import { PageHeader } from "@/components/layout/page-header";
import {
  ProcurementErrorBanner,
  ProcurementKpiCard,
  ProcurementListPanel,
  ProcurementPage,
  procurementUi,
} from "@/components/procurement/procurement-ui";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";
import {
  formatInr,
  listScmQueue,
  invalidateProcurementListCache,
  peekScmQueueFromCache,
  type ScmQueueItem,
} from "@/services/procurement-service";
import { getUnseenScmOvfIds, markScmQueueSeen } from "@/utils/scm-queue-seen";

type QueueFilter = "all" | "open" | "close" | "hold";
type OvfStatus = "open" | "close" | "hold" | "draft";

function formatReceivedDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return String(value).slice(0, 10);
  }
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function queueDateMs(value?: string | null): number {
  if (!value) return 0;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

const QUEUE_FILTERS: { key: QueueFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "close", label: "Close" },
  { key: "hold", label: "Hold" },
];

function parseQueueFilter(value: string | null): QueueFilter {
  if (value === "open" || value === "close" || value === "hold") return value;
  // Legacy deep-links from older KPI cards.
  if (value === "awaiting" || value === "with_po") return "open";
  if (value === "closed") return "close";
  return "all";
}

/**
 * OVF status for SCM queue:
 * - Open   = no vendor PO yet
 * - Draft  = draft vendor PO created from OVF (not finalized)
 * - Close  = PO finalized (issued)
 * - Hold   = SCM parked the OVF without a live PO (or cancelled PO)
 */
function deriveOvfStatus(row: ScmQueueItem): OvfStatus {
  const status = (row.purchase_order_status || "").toLowerCase();
  if (status === "draft" && row.purchase_order_id && !row.can_create_po) {
    return "draft";
  }
  if (row.scm_on_hold || status === "hold" || status === "cancelled") return "hold";
  if (!row.purchase_order_id || row.can_create_po) return "open";
  if (status === "submitted" || status === "") return "open";
  return "close";
}

function payTermsLabel(days: number | null | undefined): string {
  const value = Number(days) || 0;
  if (value <= 0) return "—";
  return `Net ${value} days`;
}

function formatNetMarginPct(margin: number | null | undefined, customerTotal: number | null | undefined): string {
  const customer = Number(customerTotal) || 0;
  if (customer <= 0) return "—";
  const pct = ((Number(margin) || 0) / customer) * 100;
  return `${pct.toFixed(2)}%`;
}

function scmQueueRowMatchesSearch(
  row: ScmQueueItem & { ovf_status?: OvfStatus },
  rawQuery: string,
): boolean {
  const tokens = rawQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  const poNumber = String(row.company_po_number ?? "").toLowerCase();
  const customerName = String(row.customer_name ?? "").toLowerCase();
  const vendorName = String(row.vendor_name ?? row.oem_name ?? "").toLowerCase();

  return tokens.every((token) => {
    if (/^\d+$/.test(token)) {
      if (!poNumber) return false;
      if (poNumber.includes(token)) return true;
      const poDigits = poNumber.replace(/\D/g, "");
      return poDigits.includes(token) || poDigits.endsWith(token);
    }

    const nameHit = customerName.includes(token) || vendorName.includes(token);
    const poHit = poNumber.includes(token);
    return nameHit || poHit;
  });
}

function OvfStatusBadge({ status }: { status: OvfStatus }) {
  const label =
    status === "open"
      ? "Open"
      : status === "close"
        ? "Close"
        : status === "draft"
          ? "Draft"
          : "Hold";
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium",
        status === "open" && "border-amber-300 bg-amber-50 text-amber-900",
        status === "close" && "border-emerald-300 bg-emerald-50 text-emerald-900",
        status === "draft" && "border-sky-300 bg-sky-50 text-sky-900",
        status === "hold" && "border-red-300 bg-red-50 text-red-800",
      )}
    >
      {label}
    </Badge>
  );
}

export function ScmQueuePage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filter = parseQueueFilter(searchParams.get("filter"));

  const cachedOnMount = peekScmQueueFromCache();
  const [rows, setRows] = useState<ScmQueueItem[]>(() => cachedOnMount ?? []);
  const [loading, setLoading] = useState(() => cachedOnMount === null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newOvfIds, setNewOvfIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const queueOvfIdsRef = useRef<string[]>([]);

  const setFilter = useCallback(
    (next: QueueFilter) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "all") params.delete("filter");
      else params.set("filter", next);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const load = useCallback(async (force = false) => {
    if (force) invalidateProcurementListCache();
    const hadInstant = !force && peekScmQueueFromCache() !== null;
    if (!hadInstant) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);
    try {
      const queue = await listScmQueue();
      setRows(queue);
    } catch (err) {
      if (!hadInstant) {
        setRows([]);
      }
      setError(err instanceof ApiClientError ? err.message : "Failed to load SCM queue");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (loading) return;
    const ids = rows.map((row) => row.ovf_id).filter(Boolean);
    queueOvfIdsRef.current = ids;
    const unseen = getUnseenScmOvfIds(ids);
    setNewOvfIds(new Set(unseen));
  }, [loading, rows]);

  useEffect(() => {
    return () => {
      const ids = queueOvfIdsRef.current;
      if (ids.length > 0) markScmQueueSeen(ids);
    };
  }, []);

  const enriched = useMemo(
    () => rows.map((row) => ({ ...row, ovf_status: deriveOvfStatus(row) })),
    [rows],
  );

  const kpis = useMemo(() => {
    const open = enriched.filter((r) => r.ovf_status === "open" || r.ovf_status === "draft").length;
    const close = enriched.filter((r) => r.ovf_status === "close").length;
    const hold = enriched.filter((r) => r.ovf_status === "hold").length;
    return { open, close, hold, total: rows.length };
  }, [enriched, rows]);

  const filtered = useMemo(() => {
    let list = enriched;
    if (filter === "open") {
      list = enriched.filter((r) => r.ovf_status === "open" || r.ovf_status === "draft");
    } else if (filter === "close" || filter === "hold") {
      list = enriched.filter((r) => r.ovf_status === filter);
    }
    const q = query.trim();
    if (q) {
      list = list.filter((row) => scmQueueRowMatchesSearch(row, q));
    }
    return [...list].sort((a, b) => {
      const byDate = queueDateMs(b.received_at) - queueDateMs(a.received_at);
      if (byDate !== 0) return byDate;
      const an = newOvfIds.has(a.ovf_id) ? 0 : 1;
      const bn = newOvfIds.has(b.ovf_id) ? 0 : 1;
      return an - bn;
    });
  }, [enriched, filter, newOvfIds, query]);

  return (
    <ProcurementPage>
      <PageHeader
        title="SCM Queue"
        description="Finance-approved OVFs awaiting vendor PO creation, issuance, and SCM hold actions."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => void load(true)}
              disabled={loading && rows.length === 0}
            >
              <RefreshCw
                className={cn(
                  "mr-1.5 size-3.5",
                  (loading || refreshing) && "animate-spin",
                )}
              />
              Refresh
            </Button>
            <Link
              href="/procurement/orders"
              className={cn(
                buttonVariants({ size: "sm" }),
                "cursor-pointer transition-colors duration-200",
              )}
            >
              <ShoppingCart className="mr-1.5 size-3.5" />
              Purchase Orders
            </Link>
          </div>
        }
      />

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <ProcurementKpiCard
          label="Total OVF"
          value={String(kpis.total)}
          icon={ClipboardList}
          href="/procurement/scm"
        />
        <ProcurementKpiCard
          label="Open"
          value={String(kpis.open)}
          tone="warning"
          icon={ShoppingCart}
          href="/procurement/scm?filter=open"
        />
        <ProcurementKpiCard
          label="Close"
          value={String(kpis.close)}
          tone="success"
          icon={CircleCheckBig}
          href="/procurement/scm?filter=close"
        />
        <ProcurementKpiCard
          label="Hold"
          value={String(kpis.hold)}
          tone="danger"
          icon={PauseCircle}
          href="/procurement/scm?filter=hold"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {QUEUE_FILTERS.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => setFilter(chip.key)}
              className={cn(
                "cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium transition-colors duration-200",
                filter === chip.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
        <div className="relative w-full max-w-xs sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search PO # or customer / vendor name…"
            aria-label="Search SCM queue"
            className="h-8 bg-card pl-8 shadow-none transition-colors duration-200"
          />
        </div>
      </div>

      {error ? <ProcurementErrorBanner>{error}</ProcurementErrorBanner> : null}

      <ProcurementListPanel id="procurement-list" className="scroll-mt-24">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1440px] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">PO number</th>
                <th className="px-3 py-2 font-medium">Customer name</th>
                <th className="px-3 py-2 font-medium">Customer pay terms</th>
                <th className="px-3 py-2 font-medium">Vendor name</th>
                <th className="px-3 py-2 font-medium">Vendor pay terms</th>
                <th className="px-3 py-2 font-medium">OVF date</th>
                <th className="px-3 py-2 font-medium text-right">Customer amt</th>
                <th className="px-3 py-2 font-medium text-right">Vendor amt</th>
                <th
                  className="px-3 py-2 font-medium text-right"
                  title="Product margin minus freight, additional charges, and finance cost"
                >
                  Net margin
                </th>
                <th className="px-3 py-2 font-medium text-right">Margin %</th>
                <th className="px-3 py-2 font-medium">OVF status</th>
                <th className="px-3 py-2 font-medium">View OVF</th>
                <th className="px-3 py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-3 py-8 text-center text-muted-foreground">
                    Loading SCM queue…
                  </td>
                </tr>
              ) : null}
              {!loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-3 py-8 text-center text-muted-foreground">
                    {query.trim()
                      ? "No queue rows match your search."
                      : filter === "open"
                        ? "No open OVFs awaiting a finalized purchase order."
                        : filter === "close"
                          ? "No closed (finalized) POs in the queue."
                          : filter === "hold"
                            ? "No held (cancelled) POs in the queue."
                            : "No OVFs shared to SCM yet. Share an approved OVF from CRM Sales."}
                  </td>
                </tr>
              ) : null}
              {filtered.map((row) => {
                const isNew = newOvfIds.has(row.ovf_id);
                const ovfStatus = row.ovf_status;
                return (
                  <tr
                    key={row.ovf_id}
                    className={cn(
                      "border-b border-border/70 transition-colors duration-150 hover:bg-muted/30",
                      isNew && "bg-sky-50/80",
                    )}
                  >
                    <td className="px-3 py-2 font-medium tabular-nums">
                      <span className="inline-flex flex-wrap items-center gap-1.5">
                        <span>{row.company_po_number || "—"}</span>
                        {isNew ? (
                          <span
                            className="text-xs font-semibold tracking-tight text-sky-700"
                            title="Recently shared to SCM"
                          >
                            [New]
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className="px-3 py-2">{row.customer_name || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {payTermsLabel(row.customer_payment_days)}
                    </td>
                    <td className="px-3 py-2">
                      {row.vendor_name?.trim() || row.oem_name?.trim() || "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {payTermsLabel(row.vendor_payment_days)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">
                      {formatReceivedDate(row.received_at)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatInr(row.customer_total || 0)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatInr(row.vendor_total || 0)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatInr(row.margin_amount || 0)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {formatNetMarginPct(row.margin_amount, row.customer_total)}
                    </td>
                    <td className="px-3 py-2">
                      <OvfStatusBadge status={ovfStatus} />
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/procurement/scm/ovf/${row.ovf_id}`}
                        className={cn(
                          buttonVariants({ size: "sm", variant: "outline" }),
                          "cursor-pointer transition-colors duration-200",
                        )}
                      >
                        View OVF
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      {ovfStatus === "hold" || (ovfStatus === "open" && row.can_create_po) ? (
                        <ScmCreatePoEntry
                          ovfId={row.ovf_id}
                          scmOnHold={ovfStatus === "hold" && Boolean(row.scm_on_hold)}
                          scmOnHoldAt={row.scm_on_hold_at}
                          className="cursor-pointer transition-colors duration-200"
                        />
                      ) : ovfStatus === "draft" ||
                        (ovfStatus === "open" && row.purchase_order_id) ? (
                        <Link
                          href={`/procurement/orders/${row.purchase_order_id}`}
                          className={cn(
                            buttonVariants({ size: "sm", variant: "outline" }),
                            "cursor-pointer transition-colors duration-200",
                          )}
                        >
                          Open PO
                        </Link>
                      ) : row.purchase_order_id ? (
                        <Link
                          href={`/procurement/orders/${row.purchase_order_id}`}
                          className={cn(
                            buttonVariants({ size: "sm", variant: "outline" }),
                            "cursor-pointer transition-colors duration-200",
                          )}
                        >
                          View PO
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ProcurementListPanel>
    </ProcurementPage>
  );
}
