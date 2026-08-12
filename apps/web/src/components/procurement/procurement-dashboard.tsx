"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";

import { ProcurementDashboardSummary } from "@/components/procurement/procurement-dashboard-summary";
import { ProcurementPipelineFunnel } from "@/components/procurement/procurement-pipeline-funnel";
import {
  ProcurementPage,
  ProcurementWarnBanner,
} from "@/components/procurement/procurement-ui";
import { Button } from "@/components/ui/button";
import { useClientAuth } from "@/hooks/use-client-auth";
import { cn } from "@/lib/utils";
import {
  asStatus,
  invalidateProcurementListCache,
  listProcurementInventory,
  loadProcurementOverview,
  peekProcurementInventoryFromCache,
  peekProcurementOverviewFromCache,
  peekPurchaseOrdersFromCache,
  type ProcurementOverview,
  type ProcurementRow,
  type ProcOrder,
  type ScmQueueItem,
} from "@/services/procurement-service";
import { countPoBuckets, emptyPoBucketCounts } from "@/utils/procurement-po-buckets";
import {
  buildProcurementInventoryStockSummary,
  isGrnNonBilledStockRow,
  type ProcurementInventoryStockSummary,
} from "@/utils/procurement-inventory-report";
import {
  isScmOpenOvfRow,
} from "@/utils/scm-queue-ovf-status";

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

  const poBucketCounts = useMemo(() => {
    const fromOrdersApi = peekPurchaseOrdersFromCache();
    const source = fromOrdersApi ?? (data?.orders as unknown as ProcOrder[] | undefined);
    if (!source || source.length === 0) return emptyPoBucketCounts();
    return countPoBuckets(source);
  }, [data?.orders]);

  const scmQueueItems = useMemo((): ScmQueueItem[] => {
    const raw = data?.scmQueue ?? [];
    return raw as ScmQueueItem[];
  }, [data?.scmQueue]);

  const openOvfCount = useMemo(
    () => scmQueueItems.filter(isScmOpenOvfRow).length,
    [scmQueueItems],
  );

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
      orders: crmOrders.length,
      grns: receiptPos.length,
      "delivery-challan": 0,
      "delivery-status": 0,
    }),
    [data, crmOrders, receiptPos],
  );

  const authBlocked =
    Boolean(data?.statusCodes.includes(401)) ||
    (!authenticated && Boolean(data?.errors.length));

  return (
    <ProcurementPage className="space-y-5">
      <div className="flex flex-col gap-4 border-b border-border/50 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[1.75rem] font-semibold tracking-tight text-foreground">
            Overview Dashboard
          </h1>
        </div>
        <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-2 sm:w-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 cursor-pointer rounded-xl"
            onClick={() => void load(true)}
            disabled={loading && !data}
          >
            <RefreshCw
              className={cn("size-3.5", (loading || refreshing) && "animate-spin")}
            />
            Refresh
          </Button>
        </div>
      </div>

      {authBlocked ? (
        <ProcurementWarnBanner>
          Sign in to load live procurement data.{" "}
          <Link href="/login" className="cursor-pointer font-medium underline underline-offset-2">
            Go to login
          </Link>
        </ProcurementWarnBanner>
      ) : null}

      {data?.partial && !authBlocked ? (
        <div className="rounded-xl border border-border/80 bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
          Some procurement endpoints returned errors. Showing available records.
        </div>
      ) : null}

      <ProcurementDashboardSummary
        loading={loading || inventoryLoading}
        openOvfCount={openOvfCount}
        openPoCount={poBucketCounts.open}
        partialPoCount={poBucketCounts.partial}
        stockUnits={inventorySummary?.totalUnits ?? 0}
        poBucketCounts={poBucketCounts}
      />

      <ProcurementPipelineFunnel counts={pipelineCounts} loading={loading} />
    </ProcurementPage>
  );
}
