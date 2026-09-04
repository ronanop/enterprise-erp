"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { ModuleDetailGrid, ModuleDetailPage, ModuleDetailSection, textOrDash } from "@/components/module/module-detail-ui";
import { ApiClientError } from "@/services/api-client";
import { getAnalyticsKpiDetail, type AnalyticsKpiDetail } from "@/services/analytics-service";

export function ExecutiveKpiDetailPage() {
  const params = useParams<{ kpiId: string }>();
  const search = useSearchParams();
  const from = search.get("from") ?? "ceo";
  const kpiId = params.kpiId;
  const [detail, setDetail] = useState<AnalyticsKpiDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void getAnalyticsKpiDetail(kpiId)
      .then((row) => {
        if (!cancelled) {
          setDetail(row);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setDetail(null);
          setError(err instanceof ApiClientError ? err.message : "Failed to load KPI detail");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [kpiId]);

  const backHref = `/analytics/executive/${from}`;

  return (
    <ModuleDetailPage
      title={detail?.kpi_code ?? "KPI detail"}
      subtitle="Executive drill-down"
      backHref={backHref}
      backLabel={`Back to ${from.toUpperCase()}`}
      loading={loading}
      error={error}
    >
      {detail ? (
        <div className="space-y-6">
          <ModuleDetailSection title="Performance">
            <ModuleDetailGrid
              items={[
                { label: "Code", value: textOrDash(detail.kpi_code) },
                { label: "Current", value: textOrDash(detail.current_value) },
                { label: "Target", value: textOrDash(detail.target_value) },
              ]}
            />
          </ModuleDetailSection>
          <ModuleDetailSection title="Breakdown">
            {detail.breakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">No breakdown available yet</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border/70 text-[11px] tracking-wide text-muted-foreground uppercase">
                    <th className="py-2 pr-3 font-medium">Dimension</th>
                    <th className="py-2 font-medium">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.breakdown.map((row) => (
                    <tr key={row.dimension_label} className="border-b border-border/50">
                      <td className="py-2 pr-3">{row.dimension_label}</td>
                      <td className="py-2 font-mono tabular-nums">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </ModuleDetailSection>
          <Link href={backHref} className="text-sm font-medium text-primary hover:underline">
            Back to {from.toUpperCase()}
          </Link>
        </div>
      ) : null}
    </ModuleDetailPage>
  );
}
