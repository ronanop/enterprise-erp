"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatApiError } from "@/services/api-client";
import {
  completeInboxItem,
  listSocialInbox,
  syncSocialInbox,
  type SocialInboxItem,
} from "@/services/marketing-service";

export function MarketingInboxPage() {
  const params = useSearchParams();
  const campaignId = params.get("campaign") ?? undefined;
  const [rows, setRows] = useState<SocialInboxItem[]>([]);
  const [note, setNote] = useState("No live posts to pull yet.");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listSocialInbox(campaignId));
    } catch (err) {
      setError(formatApiError(err, "Could not load inbox"));
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSync() {
    setError(null);
    try {
      const result = await syncSocialInbox();
      setNote(
        result.live_posts === 0
          ? "Inbox stays empty until a real LinkedIn or Instagram post ID is stored."
          : `Pulled ${result.created} new replies from ${result.live_posts} live posts.`,
      );
      await load();
    } catch (err) {
      setError(formatApiError(err, "Sync failed"));
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reply inbox"
        description="Comments and mentions on posts this campaign actually published."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer transition-colors duration-200"
            onClick={() => void onSync()}
          >
            <RefreshCw className="size-3.5" aria-hidden />
            Pull replies
          </Button>
        }
      />
      <p className="text-xs text-muted-foreground">{note}</p>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          Loading inbox
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing to answer. Stub publishes do not create a thread.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="rounded-md border border-border/70 bg-card p-3">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">{row.author_name}</p>
                <Badge variant="outline" className="text-[10px] uppercase">
                  {row.kind}
                </Badge>
                <Badge variant="secondary" className="text-[10px] uppercase">
                  {row.status}
                </Badge>
              </div>
              <p className="text-xs leading-relaxed text-foreground/90">{row.body}</p>
              {row.status !== "done" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-2 cursor-pointer transition-colors duration-200"
                  onClick={() => void completeInboxItem(row.id).then(() => load())}
                >
                  Mark done
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
