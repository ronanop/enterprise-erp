"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { MarketingContentReviewDialog } from "@/components/marketing/marketing-content-review-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMarketingPermissions } from "@/hooks/use-marketing-permissions";
import { linkedInPublishStatusLabel } from "@/lib/linkedin-section-approval";
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
      <div className="space-y-4">
        <PageHeader title="Archive" />
        <p className="text-sm text-muted-foreground">You do not have permission to view marketing content.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Archive"
        description="Published posts are locked and moved here automatically. All marketing roles can view the archive."
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
        className="max-w-xs"
      />

      <div className="overflow-x-auto rounded-xl border border-border/80">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-b border-border/70 bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Number</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Published</th>
              <th className="px-3 py-2">Archived</th>
              <th className="px-3 py-2">Action</th>
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
                  <td className="px-3 py-2">
                    <FinanceStatusBadge status={row.status} />
                    {linkedInPublishStatusLabel(row) ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">{linkedInPublishStatusLabel(row)}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {row.published_at ? new Date(row.published_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {row.archived_at ? new Date(row.archived_at).toLocaleString() : "—"}
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
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  No archived content yet. When the publisher marks a post as published, it is locked and archived automatically.
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
