"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useMarketingPermissions } from "@/hooks/use-marketing-permissions";
import {
  ApiClientError,
  listPublications,
  type MarketingPublication,
} from "@/services/marketing-service";

const POLL_MS = 10_000;

export function MarketingPublishLogPage() {
  const perms = useMarketingPermissions();
  const [rows, setRows] = useState<MarketingPublication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listPublications({ page_size: 200 }));
    } catch (err) {
      setRows([]);
      setError(err instanceof ApiClientError ? err.message : "Failed to load publish log");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (perms.loading || !perms.canReadPublication) return;
    void load();
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [load, perms.loading, perms.canReadPublication]);

  if (!perms.loading && !perms.canReadPublication) {
    return (
      <div className="space-y-4">
        <PageHeader title="Publish Log" />
        <p className="text-sm text-muted-foreground">
          This page is for roles that post content (LinkedIn handler, publisher, content creator).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Publish Log"
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
              <th className="px-3 py-2">Published</th>
              <th className="px-3 py-2">Content ID</th>
              <th className="px-3 py-2">URL</th>
              <th className="px-3 py-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            {[...rows]
              .sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""))
              .map((row) => (
                <tr key={row.id} className="border-b border-border/50">
                  <td className="px-3 py-2">{new Date(row.published_at).toLocaleString()}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.content_item_id.slice(0, 8)}…</td>
                  <td className="px-3 py-2">
                    {row.published_url ? (
                      <a href={row.published_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                        {row.published_url}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{row.notes ?? "—"}</td>
                </tr>
              ))}
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                  No publications logged yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
