"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { MarketingEnlargeableMedia } from "@/components/marketing/marketing-enlargeable-media";
import { canHeadReviewVideoFinalDraft } from "@/lib/video-section-approval";
import {
  ApiClientError,
  listContentAssets,
  marketingAssetUrl,
  videoHeadReviewFinalDraft,
  type MarketingContentItem,
  type MarketingLinkedAsset,
} from "@/services/marketing-service";

type MarketingVideoHeadFinalDraftApprovalProps = {
  item: MarketingContentItem;
  onUpdated: (item?: MarketingContentItem) => void;
};

export function MarketingVideoHeadFinalDraftApproval({
  item,
  onUpdated,
}: MarketingVideoHeadFinalDraftApprovalProps) {
  const [assets, setAssets] = useState<MarketingLinkedAsset[]>([]);
  const [comments, setComments] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const draft = item.video_final_draft;

  const loadAssets = useCallback(async () => {
    try {
      setAssets(await listContentAssets(item.id));
    } catch {
      setAssets([]);
    }
  }, [item.id]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  if (!canHeadReviewVideoFinalDraft(item) || !draft) {
    return null;
  }

  const videoAsset = draft.poster_media_asset_id
    ? assets.find((a) => a.asset.id === draft.poster_media_asset_id)
    : null;

  const run = async (status: "approved" | "changes_requested" | "rejected") => {
    setBusy(true);
    setError(null);
    try {
      const updated = await videoHeadReviewFinalDraft(item.id, {
        status,
        comments: comments.trim() || undefined,
      });
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Approval failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-violet-500/40 bg-violet-500/5 p-4">
      <p className="text-sm font-medium">Final draft approval — video &amp; caption</p>
      <p className="text-xs text-muted-foreground">
        Video editor submitted the finished video and caption. Approve before they can send to the publisher.
      </p>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="space-y-3 rounded-lg border border-border/60 bg-background p-3 text-sm">
        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground">Final caption</p>
          <p className="mt-1 whitespace-pre-wrap">{draft.content_text || "—"}</p>
        </div>
        {videoAsset ? (
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Final video</p>
            <MarketingEnlargeableMedia
              src={marketingAssetUrl(videoAsset.asset.file_url)}
              alt="Final video"
              isVideo
              showCaption={false}
              mediaClassName="max-h-64 w-full"
            />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No final video provided.</p>
        )}
      </div>

      <div className="space-y-2">
        <textarea
          rows={2}
          placeholder="Feedback to sender (required for send back or reject)…"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={comments}
          onChange={(e) => setComments(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" disabled={busy} onClick={() => void run("approved")}>
            Approve final draft
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void run("changes_requested")}>
            Send feedback
          </Button>
          <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => void run("rejected")}>
            Reject
          </Button>
        </div>
      </div>
    </div>
  );
}
