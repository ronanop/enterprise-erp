"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchAssetOperationsData } from "@/components/assets/asset-operations-fetch";
import { AssetOperationsDashboard } from "@/components/assets/asset-operations-dashboard";
import {
  mapDashboardSummaryToKpiTrends,
  mapDashboardSummaryToKpis,
  type AssetOperationsKpiModel,
  type AssetOperationsKpiTrends,
} from "@/components/assets/dashboard.mapper";
import { BRANCH_ALL_VALUE } from "@/components/assets/shared";

export function AssetOperationsContainer() {
  const [kpis, setKpis] = useState<AssetOperationsKpiModel | null>(null);
  const [kpiTrends, setKpiTrends] = useState<AssetOperationsKpiTrends | null>(null);
  const [kpisLoading, setKpisLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const load = useCallback(async () => {
    setKpisLoading(true);
    setErrorMessage(null);

    const result = await fetchAssetOperationsData(BRANCH_ALL_VALUE);

    if (!result.summary) {
      setErrorMessage(result.errors.summary ?? "Something went wrong. Please try again.");
      setKpis(null);
      setKpiTrends(null);
      setKpisLoading(false);
      return;
    }

    if (result.errors.summary) {
      setErrorMessage(result.errors.summary);
      setKpis(null);
      setKpiTrends(null);
    } else {
      setErrorMessage(null);
      const kpisModel = mapDashboardSummaryToKpis(result.summary);
      setKpis(kpisModel);
      setKpiTrends(mapDashboardSummaryToKpiTrends(kpisModel));
    }

    setKpisLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load, reloadToken]);

  const onRetry = useCallback(() => {
    setReloadToken((t) => t + 1);
  }, []);

  return (
    <AssetOperationsDashboard
      kpisLoading={kpisLoading}
      kpis={kpis}
      kpiTrends={kpiTrends}
      errorMessage={errorMessage}
      onRetry={onRetry}
    />
  );
}
