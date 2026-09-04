"use client";

import Link from "next/link";

import { findKpiBySourceKey, useAnalyticsKpis } from "@/components/analytics/executive/use-analytics-kpis";

export function KpiTile({
  kpiKey,
  role,
}: {
  kpiKey: string;
  role: string;
}) {
  const { kpis, loading, error } = useAnalyticsKpis();
  const match = findKpiBySourceKey(kpis, kpiKey);
  const label = kpiKey.split(".").pop()?.replaceAll("_", " ") ?? kpiKey;
  const value =
    match?.current_value != null ? String(match.current_value) : match ? "—" : null;

  const body = (
    <article
      data-kpi-key={kpiKey}
      data-role={role}
      data-matched={match ? "true" : "false"}
      className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm transition-[box-shadow,border-color] duration-200 hover:border-border hover:shadow-md"
    >
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      {loading ? (
        <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
      ) : error ? (
        <p className="mt-2 text-sm text-destructive">{error}</p>
      ) : match ? (
        <>
          <p className="mt-2 font-mono text-xl font-medium tracking-tight text-foreground tabular-nums">
            {value}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {match.target_value != null ? `Target: ${match.target_value}` : "No target"}
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">No matching KPI for {kpiKey}</p>
      )}
    </article>
  );

  if (!match) return body;

  return (
    <Link
      href={`/analytics/executive/kpi/${match.id}?from=${encodeURIComponent(role)}`}
      className="block cursor-pointer rounded-xl focus-visible:ring-2 focus-visible:ring-ring"
    >
      {body}
    </Link>
  );
}
