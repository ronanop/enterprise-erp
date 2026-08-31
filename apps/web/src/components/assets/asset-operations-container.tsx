"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchAssetOperationsData } from "@/components/assets/asset-operations-fetch";
import { AssetOperationsDashboard } from "@/components/assets/asset-operations-dashboard";
import {
  branchLookupFromOptions,
  mapByLocationBreakdown,
  mapDashboardSummaryToKpiTrends,
  mapDashboardSummaryToKpis,
  mapTransfersToDashboardRows,
  type AssetOperationsKpiModel,
  type AssetOperationsKpiTrends,
  type DashboardTransferRow,
  type LocationBreakdownRow,
} from "@/components/assets/dashboard.mapper";
import { BRANCH_ALL_VALUE, type BranchOption } from "@/components/assets/shared";
import { listBranchOptions } from "@/lib/org-options";
import { listSiteLocations } from "@/services/asset-site-location-service";
import type { AssetDashboardSummaryDto } from "@/services/assets-service";

const EMPTY_SUMMARY: AssetDashboardSummaryDto = {
  company_id: "",
  total_assets: 0,
  ready_to_move: 0,
  assigned: 0,
  retired: 0,
  pending_disposal: 0,
  disposed: 0,
};

const EMPTY_LIST = { items: [], total: 0, page: 1, page_size: 10 };

export function AssetOperationsContainer() {
  const [locationId, setLocationId] = useState(BRANCH_ALL_VALUE);
  const [locations, setLocations] = useState<BranchOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [kpis, setKpis] = useState<AssetOperationsKpiModel | null>(null);
  const [kpiTrends, setKpiTrends] = useState<AssetOperationsKpiTrends | null>(null);
  const [byLocationRows, setByLocationRows] = useState<LocationBreakdownRow[]>([]);
  const [transferRows, setTransferRows] = useState<DashboardTransferRow[]>([]);
  const [transferTotal, setTransferTotal] = useState(0);
  const [kpisLoading, setKpisLoading] = useState(true);
  const [transfersLoading, setTransfersLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void listSiteLocations()
      .then((rows) => {
        if (!cancelled) {
          setLocations(rows.map((o) => ({ id: o.id, label: o.name })));
        }
      })
      .catch(() => {
        if (!cancelled) setLocations([]);
      });
    void listBranchOptions()
      .then((options) => {
        if (!cancelled) {
          setBranches(options.map((o) => ({ id: o.id, label: o.label })));
        }
      })
      .catch(() => {
        if (!cancelled) setBranches([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const branchLookup = useMemo(() => branchLookupFromOptions(branches), [branches]);

  const load = useCallback(async () => {
    setKpisLoading(true);
    setTransfersLoading(true);
    setErrorMessage(null);
    setTransferError(null);

    const result = await fetchAssetOperationsData(locationId);

    const nothingLoaded = !result.summary && !result.transfersList;

    if (nothingLoaded) {
      const messages = Object.values(result.errors).filter(Boolean);
      setErrorMessage(messages[0] ?? "Something went wrong. Please try again.");
      setKpis(null);
      setKpiTrends(null);
      setByLocationRows([]);
      setTransferRows([]);
      setTransferTotal(0);
      setKpisLoading(false);
      setTransfersLoading(false);
      return;
    }

    if (result.errors.summary) {
      setErrorMessage(result.errors.summary);
      setKpis(null);
      setKpiTrends(null);
      setByLocationRows([]);
    } else if (result.summary) {
      setErrorMessage(null);
      const kpisModel = mapDashboardSummaryToKpis(result.summary);
      setKpis(kpisModel);
      setKpiTrends(mapDashboardSummaryToKpiTrends(kpisModel));
      setByLocationRows(mapByLocationBreakdown(result.summary));
    } else {
      setKpis(mapDashboardSummaryToKpis(EMPTY_SUMMARY));
      setKpiTrends(null);
      setByLocationRows([]);
    }

    if (result.errors.transfers) {
      setTransferError(result.errors.transfers);
      setTransferRows([]);
      setTransferTotal(0);
    } else {
      setTransferError(null);
      const transfers = result.transfersList ?? EMPTY_LIST;
      const assets = result.assetsList ?? EMPTY_LIST;
      setTransferRows(mapTransfersToDashboardRows(transfers, assets));
      setTransferTotal(transfers.total ?? transfers.items.length);
    }

    setKpisLoading(false);
    setTransfersLoading(false);
  }, [locationId]);

  useEffect(() => {
    void load();
  }, [load, reloadToken]);

  const onRetry = useCallback(() => {
    setReloadToken((t) => t + 1);
  }, []);

  return (
    <AssetOperationsDashboard
      locationId={locationId}
      locations={locations}
      onLocationChange={setLocationId}
      kpisLoading={kpisLoading}
      transfersLoading={transfersLoading}
      kpis={kpis}
      kpiTrends={kpiTrends}
      byLocationRows={byLocationRows}
      transferRows={transferRows}
      transferTotal={transferTotal}
      transferError={transferError}
      errorMessage={errorMessage}
      onRetry={onRetry}
      branchLookup={branchLookup}
    />
  );
}
