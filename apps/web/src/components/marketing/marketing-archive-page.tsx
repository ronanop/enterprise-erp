"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { MarketingContentReviewDialog } from "@/components/marketing/marketing-content-review-dialog";
import { MarketingPageHeader } from "@/components/marketing/marketing-page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMarketingPermissions } from "@/hooks/use-marketing-permissions";
import { marketingPage, marketingTableHead, marketingTableRow, marketingTableShell } from "@/lib/marketing-ui";
import {
  ApiClientError,
  formatMarketingStatus,
  listContentItems,
  marketingContentStatusForDisplay,
  type MarketingContentItem,
} from "@/services/marketing-service";

export function MarketingArchivePage() {
  const perms = useMarketingPermissions();
  const [rows, setRows] = useState<MarketingContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [reviewItem, setReviewItem] = useState<MarketingContentItem | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listContentItems({ status: "archived", q: q || undefined, page_size: 200 }));
    } catch (err) {
      setRows([]);
      setError(err instanceof ApiClientError ? err.message : "Failed to load archive");
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    if (perms.loading || !perms.canReadContent) return;
    void load();
  }, [load, perms.loading, perms.canReadContent]);

  if (!perms.loading && !perms.canReadContent) {
    return (
      <div className={marketingPage}>
        <MarketingPageHeader title="Archive" />
        <p className="text-sm text-muted-foreground">You do not have permission to view marketing content.</p>
      </div>
    );
  }

  return (
    <div className={marketingPage}>
      <MarketingPageHeader
        title="Archive"
        description="Published posts are locked and listed here for all marketing roles."
        actions={
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search archived posts…"
        className="max-w-xs rounded-xl border-border/60 bg-background/80 shadow-sm"
      />

      <div className={`${marketingTableShell} overflow-x-auto`}>
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className={marketingTableHead}>
            <tr>
              <th className="px-3 py-2">Number</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Published</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {[...rows]
              .sort((a, b) => (b.archived_at ?? "").localeCompare(a.archived_at ?? ""))
              .map((row) => (
                <tr key={row.id} className={marketingTableRow}>
                  <td className="px-3 py-2 font-mono text-xs">{row.content_number}</td>
                  <td className="px-3 py-2 font-medium">{row.title}</td>
                  <td className="px-3 py-2">{formatMarketingStatus(row.content_type)}</td>
                  <td className="px-3 py-2">
                    <FinanceStatusBadge status={marketingContentStatusForDisplay(row.status)} />
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {row.published_at
                      ? new Date(row.published_at).toLocaleString()
                      : row.archived_at
                        ? new Date(row.archived_at).toLocaleString()
                        : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setReviewItem(row);
                        setReviewOpen(true);
                      }}
                    >
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  No published content yet. When the publisher marks a post as published, it appears here.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <MarketingContentReviewDialog
        item={reviewItem}
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        onDone={(updated) => {
          void load();
          if (updated) setReviewItem(updated);
        }}
      />
    </div>
  );
}
