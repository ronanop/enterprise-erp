"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  RefreshCw,
  X,
} from "lucide-react";

import { ProcurementInventoryStockCard } from "@/components/procurement/procurement-inventory-stock-card";
import { ProcurementOpenOvfCard } from "@/components/procurement/procurement-open-ovf-card";
import { ProcurementPageHeader } from "@/components/procurement/procurement-page-header";
import { procurementUi } from "@/components/procurement/procurement-ui";
import { ProcurementPoSummaryCard } from "@/components/procurement/procurement-po-summary-card";
import { ProcurementDashboardCharts } from "@/components/procurement/procurement-dashboard-charts";
import { ProcurementPipelineFunnel } from "@/components/procurement/procurement-pipeline-funnel";
import { useClientAuth } from "@/hooks/use-client-auth";
import { cn } from "@/lib/utils";
import {
  asStatus,
  invalidateProcurementListCache,
  listProcurementInventory,
  loadProcurementOverview,
  peekProcurementOverviewFromCache,
  peekProcurementInventoryFromCache,
  peekPurchaseOrdersFromCache,
  type ProcurementOverview,
  type ProcurementRow,
  type ProcOrder,
  type ScmQueueItem,
} from "@/services/procurement-service";
import { getUnseenScmOvfIds } from "@/utils/scm-queue-seen";
import { deriveScmOvfQueueStatus } from "@/utils/scm-queue-ovf-status";
import { countPoBuckets, emptyPoBucketCounts } from "@/utils/procurement-po-buckets";
import {
  buildProcurementInventoryStockSummary,
  isGrnNonBilledStockRow,
  type ProcurementInventoryStockSummary,
} from "@/utils/procurement-inventory-report";

/** Same rule as GrnsListPage — GRN stage = POs with partial/delivered receipt. */
function isReceiptPo(row: ProcurementRow): boolean {
  const status = asStatus(row.status);
  if (status === "draft" || status === "submitted" || status === "cancelled") return false;
  const grn = asStatus(row.grn_status);
  return grn === "partial" || grn === "closed" || grn === "delivered";
}

function inventorySummaryFromCache(): ProcurementInventoryStockSummary | null {
  const cached = peekProcurementInventoryFromCache();
  if (!cached) return null;
  return buildProcurementInventoryStockSummary(cached.filter(isGrnNonBilledStockRow));
}

export function ProcurementDashboard() {
  const cachedOnMount = peekProcurementOverviewFromCache();
  const cachedInventorySummary = inventorySummaryFromCache();
  const [data, setData] = useState<ProcurementOverview | null>(() => cachedOnMount);
  const [inventorySummary, setInventorySummary] = useState<ProcurementInventoryStockSummary | null>(
    () => cachedInventorySummary,
  );
  const [loading, setLoading] = useState(() => cachedOnMount === null);
  const [refreshing, setRefreshing] = useState(false);
  const [dismissedArrivalKey, setDismissedArrivalKey] = useState<string | null>(null);
  const authenticated = useClientAuth();

  const load = useCallback(async (force = false) => {
    if (force) invalidateProcurementListCache();
    const hadInstant = !force && peekProcurementOverviewFromCache() !== null;
    if (!hadInstant) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    try {
      const [overview, inventory] = await Promise.all([
        loadProcurementOverview(),
        listProcurementInventory().catch(() => []),
      ]);
      setData(overview);
      setInventorySummary(
        buildProcurementInventoryStockSummary(inventory.filter(isGrnNonBilledStockRow)),
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Light poll so newly shared OVFs surface without a manual refresh.
  useEffect(() => {
    if (!authenticated) return;
    const id = window.setInterval(() => {
      void loadProcurementOverview().then(setData).catch(() => undefined);
      void listProcurementInventory()
        .then((inventory) =>
          setInventorySummary(
            buildProcurementInventoryStockSummary(inventory.filter(isGrnNonBilledStockRow)),
          ),
        )
        .catch(() => undefined);
    }, 45_000);
    return () => window.clearInterval(id);
  }, [authenticated]);

  const [newQueueItems, setNewQueueItems] = useState<ProcurementRow[]>([]);

  useEffect(() => {
    const queue = data?.scmQueue ?? [];
    const ids = queue.map((row) => String(row.ovf_id ?? "")).filter(Boolean);
    const unseen = new Set(getUnseenScmOvfIds(ids));
    setNewQueueItems(queue.filter((row) => unseen.has(String(row.ovf_id ?? ""))));
  }, [data]);

  const arrivalKey = useMemo(
    () =>
      newQueueItems
        .map((row) => String(row.ovf_id ?? ""))
        .filter(Boolean)
        .sort()
        .join(","),
    [newQueueItems],
  );

  const showArrivalPopup =
    newQueueItems.length > 0 && dismissedArrivalKey !== arrivalKey;

  const poBucketCounts = useMemo(() => {
    const fromOrdersApi = peekPurchaseOrdersFromCache();
    const source = fromOrdersApi ?? (data?.orders as unknown as ProcOrder[] | undefined);
    if (!source || source.length === 0) return emptyPoBucketCounts();
    return countPoBuckets(source);
  }, [data?.orders]);

  const poOrdersForExport = useMemo((): ProcOrder[] => {
    const fromOrdersApi = peekPurchaseOrdersFromCache();
    return fromOrdersApi ?? (data?.orders as unknown as ProcOrder[] | undefined) ?? [];
  }, [data?.orders]);

  const [poExportError, setPoExportError] = useState<string | null>(null);

  const scmQueueItems = useMemo((): ScmQueueItem[] => {
    const raw = data?.scmQueue ?? [];
    return raw as ScmQueueItem[];
  }, [data?.scmQueue]);

  const inventoryLoading = loading && inventorySummary === null;

  const crmOrders = useMemo(
    () => (data?.orders ?? []).filter((row) => asStatus(row.source_module) === "crm"),
    [data],
  );

  const receiptPos = useMemo(
    () => (data?.vendorPos ?? []).filter(isReceiptPo),
    [data],
  );

  const pipelineCounts = useMemo(
    () => ({
      scm: data?.scmQueue.length ?? 0,
      // SCM pipeline: only CRM OVF-sourced POs (exclude seed / non-SCM demos).
      orders: crmOrders.length,
      // Align with /procurement/grns — receipt POs, not legacy GRN documents.
      grns: receiptPos.length,
      "delivery-challan": 0,
      "delivery-status": 0,
    }),
    [data, crmOrders, receiptPos],
  );

  const scmOvfStatusCounts = useMemo(() => {
    let open = 0;
    let close = 0;
    let hold = 0;
    for (const row of scmQueueItems) {
      const status = deriveScmOvfQueueStatus(row);
      if (status === "open" || status === "draft") open += 1;
      else if (status === "close") close += 1;
      else if (status === "hold") hold += 1;
    }
    return { open, close, hold };
  }, [scmQueueItems]);

  const authBlocked =
    Boolean(data?.statusCodes.includes(401)) ||
    (!authenticated && Boolean(data?.errors.length));

  return (
    <div className={procurementUi.page}>
      <ProcurementPageHeader
        title="Procurement"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={loading && !data}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3 text-sm font-medium shadow-sm transition-colors duration-200 hover:bg-muted disabled:opacity-60"
            >
              <RefreshCw
                className={cn("size-3.5", (loading || refreshing) && "animate-spin")}
              />
              Refresh
            </button>
            <div className="relative">
              <Link
                href="/procurement/scm"
                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-opacity duration-200 hover:opacity-90"
              >
                <ClipboardList className="size-3.5" />
                SCM Queue
                {newQueueItems.length > 0 ? (
                  <span className="ml-0.5 inline-flex min-w-5 items-center justify-center rounded-md bg-amber-400 px-1.5 py-0.5 text-[10px] font-semibold text-slate-900 tabular-nums">
                    {newQueueItems.length}
                  </span>
                ) : null}
              </Link>
              {showArrivalPopup ? (
                <div
                  role="status"
                  className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-sky-200 bg-card p-3 shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {newQueueItems.length === 1
                          ? "New PO arrived in SCM Queue"
                          : `${newQueueItems.length} new POs arrived in SCM Queue`}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {(() => {
                          const first = newQueueItems[0];
                          const label =
                            String(first?.customer_name ?? first?.ovf_no ?? "OVF").trim() || "OVF";
                          return newQueueItems.length === 1
                            ? `${label} is ready for purchase order.`
                            : `Including ${label} — open the queue to review.`;
                        })()}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Dismiss notification"
                      onClick={() => setDismissedArrivalKey(arrivalKey)}
                      className="cursor-pointer rounded-md p-1 text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                  <Link
                    href="/procurement/scm"
                    className="mt-2.5 inline-flex cursor-pointer text-xs font-medium text-sky-700 transition-opacity duration-200 hover:opacity-80"
                  >
                    Open SCM Queue →
                  </Link>
                </div>
              ) : null}
            </div>
            <Link
              href="/procurement/orders"
              className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border/80 bg-card px-3 text-sm font-medium shadow-sm transition-colors duration-200 hover:bg-muted"
            >
              Purchase Orders
            </Link>
          </div>
        }
      />

      {authBlocked ? (
        <div className="rounded-xl border border-dashed border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Sign in to load live procurement data.{" "}
          <Link href="/login" className="cursor-pointer font-medium underline underline-offset-2">
            Go to login
          </Link>
        </div>
      ) : null}

      {data?.partial && !authBlocked ? (
        <div className="rounded-xl border border-border/80 bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
          Some procurement endpoints returned errors. Showing available records.
        </div>
      ) : null}

      {poExportError ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {poExportError}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5 [&>*]:h-full">
        <ProcurementOpenOvfCard loading={loading} queue={scmQueueItems} />
        <ProcurementPoSummaryCard
          loading={loading}
          counts={poBucketCounts}
          orders={poOrdersForExport}
          onExportError={setPoExportError}
        />
        <ProcurementInventoryStockCard loading={inventoryLoading} summary={inventorySummary} />
      </div>

      <ProcurementPipelineFunnel counts={pipelineCounts} loading={loading} />

      <ProcurementDashboardCharts
        loading={loading}
        poBucketCounts={poBucketCounts}
        scmOpen={scmOvfStatusCounts.open}
        scmClose={scmOvfStatusCounts.close}
        scmHold={scmOvfStatusCounts.hold}
      />
    </div>
  );
}
