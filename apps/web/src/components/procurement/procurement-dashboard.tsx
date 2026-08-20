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
  listVendorOptions,
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
  isInventoryLedgerRow,
  type ProcurementInventoryStockSummary,
} from "@/utils/procurement-inventory-report";
import {
  buildProcurementPipelineMetrics,
} from "@/utils/procurement-pipeline-metrics";
import {
  isScmHoldOvfRow,
  isScmOpenOvfRow,
} from "@/utils/scm-queue-ovf-status";

/** Same rule as GrnsListPage — issued POs only (not draft/submitted/cancelled). */
function isIssuedVendorPo(row: ProcurementRow): boolean {
  const status = asStatus(row.status);
  return status !== "draft" && status !== "submitted" && status !== "cancelled";
}

function inventorySummaryFromCache(
  vendorLabels: Record<string, string> = {},
): ProcurementInventoryStockSummary | null {
  const cached = peekProcurementInventoryFromCache();
  if (!cached) return null;
  return buildProcurementInventoryStockSummary(cached.filter(isInventoryLedgerRow), {
    vendorLabels,
  });
}

export function ProcurementDashboard() {
  const cachedOnMount = peekProcurementOverviewFromCache();
  const [vendorLabels, setVendorLabels] = useState<Record<string, string>>({});
  const [inventorySummary, setInventorySummary] = useState<ProcurementInventoryStockSummary | null>(
    () => inventorySummaryFromCache(),
  );
  const [data, setData] = useState<ProcurementOverview | null>(() => cachedOnMount);
  const [loading, setLoading] = useState(() => cachedOnMount === null);
  const [refreshing, setRefreshing] = useState(false);
  const authenticated = useClientAuth();

  const rebuildInventorySummary = useCallback(
    (
      inventory: Awaited<ReturnType<typeof listProcurementInventory>>,
      labels: Record<string, string>,
    ) => {
      setInventorySummary(
        buildProcurementInventoryStockSummary(inventory.filter(isInventoryLedgerRow), {
          vendorLabels: labels,
        }),
      );
    },
    [],
  );

  const load = useCallback(async (force = false) => {
    if (force) invalidateProcurementListCache();
    const hadInstant = !force && peekProcurementOverviewFromCache() !== null;
    if (!hadInstant) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    try {
      const [overview, inventory, vendors] = await Promise.all([
        loadProcurementOverview(),
        listProcurementInventory().catch(() => []),
        listVendorOptions().catch(() => []),
      ]);
      const labels: Record<string, string> = {};
      for (const vendor of vendors) {
        if (vendor.id) labels[vendor.id] = vendor.label || vendor.id;
      }
      setVendorLabels(labels);
      setData(overview);
      rebuildInventorySummary(inventory, labels);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [rebuildInventorySummary]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!authenticated) return;
    const id = window.setInterval(() => {
      void loadProcurementOverview().then(setData).catch(() => undefined);
      void Promise.all([
        listProcurementInventory().catch(() => []),
        listVendorOptions().catch(() => []),
      ]).then(([inventory, vendors]) => {
        setVendorLabels((prev) => {
          const labels: Record<string, string> = { ...prev };
          for (const vendor of vendors) {
            if (vendor.id) labels[vendor.id] = vendor.label || vendor.id;
          }
          rebuildInventorySummary(inventory, labels);
          return labels;
        });
      });
    }, 45_000);
    return () => window.clearInterval(id);
  }, [authenticated, rebuildInventorySummary]);

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
    () => scmQueueItems.filter((row) => isScmOpenOvfRow(row)).length,
    [scmQueueItems],
  );

  const holdOvfCount = useMemo(
    () => scmQueueItems.filter((row) => isScmHoldOvfRow(row)).length,
    [scmQueueItems],
  );

  const inventoryLoading = loading && inventorySummary === null;

  const pipelineMetrics = useMemo(
    () =>
      buildProcurementPipelineMetrics({
        scmQueueCount: data?.scmQueue.length ?? 0,
        vendorPos: (data?.vendorPos ?? []).filter(isIssuedVendorPo),
      }),
    [data],
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
        holdOvfCount={holdOvfCount}
        openPoCount={poBucketCounts.open}
        poBucketCounts={poBucketCounts}
        inventorySummary={inventorySummary}
      />

      <ProcurementPipelineFunnel
        metrics={pipelineMetrics}
        vendorPos={(data?.vendorPos ?? []).filter(isIssuedVendorPo)}
        loading={loading}
      />
    </ProcurementPage>
  );
}
