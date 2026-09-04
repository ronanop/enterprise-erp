"use client";

import { useEffect, useState } from "react";

import { listAnalyticsKpis, type AnalyticsKpi } from "@/services/analytics-service";

export function useAnalyticsKpis(): {
  kpis: AnalyticsKpi[];
  loading: boolean;
  error: string | null;
} {
  const [kpis, setKpis] = useState<AnalyticsKpi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void listAnalyticsKpis()
      .then((rows) => {
        if (!cancelled) {
          setKpis(rows);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load KPIs");
          setKpis([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { kpis, loading, error };
}

export function findKpiBySourceKey(kpis: AnalyticsKpi[], sourceKpiKey: string): AnalyticsKpi | undefined {
  return kpis.find((row) => row.source_kpi_key === sourceKpiKey);
}
