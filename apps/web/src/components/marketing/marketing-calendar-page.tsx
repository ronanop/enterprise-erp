"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useMarketingPermissions } from "@/hooks/use-marketing-permissions";
import {
  ApiClientError,
  listCalendarItems,
  type MarketingCalendarItem,
} from "@/services/marketing-service";

export function MarketingCalendarPage() {
  const perms = useMarketingPermissions();
  const [rows, setRows] = useState<MarketingCalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 2);
    end.setHours(23, 59, 59, 999);
    try {
      setRows(
        await listCalendarItems(start.toISOString(), end.toISOString(), { page_size: 200 }),
      );
    } catch (err) {
      setRows([]);
      setError(err instanceof ApiClientError ? err.message : "Failed to load calendar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (perms.loading || !perms.canAccessCalendar) return;
    void load();
  }, [load, perms.loading, perms.canAccessCalendar]);

  if (!perms.loading && !perms.canAccessCalendar) {
    return (
      <div className="space-y-4">
        <PageHeader title="Calendar" />
        <p className="text-sm text-muted-foreground">Scheduling is for LinkedIn handler, publisher, and marketing head.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Calendar"
        actions={
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-border/80">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border/70 bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Scheduled</th>
              <th className="px-3 py-2">Number</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {[...rows]
              .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
              .map((row) => (
                <tr key={row.id} className="border-b border-border/50">
                  <td className="px-3 py-2">{new Date(row.scheduled_at).toLocaleString()}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.content_number}</td>
                  <td className="px-3 py-2 font-medium">{row.title}</td>
                  <td className="px-3 py-2">
                    <FinanceStatusBadge status={row.status} />
                  </td>
                </tr>
              ))}
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                  Nothing scheduled in this window.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
