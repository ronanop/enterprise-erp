"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useMarketingPermissions } from "@/hooks/use-marketing-permissions";
import {
  ApiClientError,
  formatMarketingStatus,
  listContentItems,
  type MarketingContentItem,
} from "@/services/marketing-service";

export function MarketingArchivePage() {
  const perms = useMarketingPermissions();
  const [rows, setRows] = useState<MarketingContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listContentItems({ status: "archived", page_size: 200 }));
    } catch (err) {
      setRows([]);
      setError(err instanceof ApiClientError ? err.message : "Failed to load archive");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (perms.loading || !perms.canArchive) return;
    void load();
  }, [load, perms.loading, perms.canArchive]);

  if (!perms.loading && !perms.canArchive) {
    return (
      <div className="space-y-4">
        <PageHeader title="Archive" />
        <p className="text-sm text-muted-foreground">Only the publisher role can move posted content to archive.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Archive"
        actions={
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-border/80">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-b border-border/70 bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Number</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Published</th>
              <th className="px-3 py-2">Archived</th>
            </tr>
          </thead>
          <tbody>
            {[...rows]
              .sort((a, b) => (b.archived_at ?? "").localeCompare(a.archived_at ?? ""))
              .map((row) => (
                <tr key={row.id} className="border-b border-border/50">
                  <td className="px-3 py-2 font-mono text-xs">{row.content_number}</td>
                  <td className="px-3 py-2 font-medium">{row.title}</td>
                  <td className="px-3 py-2">{formatMarketingStatus(row.content_type)}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {row.published_at ? new Date(row.published_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {row.archived_at ? new Date(row.archived_at).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  No archived content yet. Publisher moves published items here after posting.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
