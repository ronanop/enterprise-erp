"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useMarketingPermissions } from "@/hooks/use-marketing-permissions";
import {
  ApiClientError,
  formatMarketingStatus,
  getReportSummary,
  type MarketingReportSummary,
} from "@/services/marketing-service";

function SummaryTable({ title, rows }: { title: string; rows: { key: string; label: string; count: number }[] }) {
  return (
    <div className="rounded-xl border border-border/80">
      <div className="border-b border-border/70 px-4 py-3">
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-border/50 last:border-0">
              <td className="px-4 py-2">{formatMarketingStatus(row.label)}</td>
              <td className="px-4 py-2 text-right tabular-nums font-medium">{row.count}</td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={2} className="px-4 py-6 text-center text-muted-foreground">
                No data
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

export function MarketingReportsPage() {
  const [summary, setSummary] = useState<MarketingReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    void getReportSummary()
      .then(setSummary)
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Failed to load reports"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reports"
        actions={
          <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <SummaryTable title="By status" rows={summary?.by_status ?? []} />
        <SummaryTable title="By content type" rows={summary?.by_content_type ?? []} />
        <SummaryTable title="By channel (publications)" rows={summary?.by_channel ?? []} />
        <SummaryTable title="By campaign" rows={summary?.by_campaign ?? []} />
      </div>
    </div>
  );
}
