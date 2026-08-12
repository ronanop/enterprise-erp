"use client";

import { useCallback, useEffect, useState } from "react";

import { MarketingBannerUploadField } from "@/components/marketing/marketing-banner-upload-field";
import { MarketingEnlargeableMedia } from "@/components/marketing/marketing-enlargeable-media";
import { Button } from "@/components/ui/button";
import { uploadContentAssetForItem } from "@/lib/marketing-content-upload";
import {
  canVideoEditorSendToPublisher,
  canVideoEditorSubmitFinalDraftToHead,
  VIDEO_FINAL_RENDER_ROLE,
  videoEditorAwaitingPublisher,
  videoFinalDraftApproved,
  videoFinalDraftAwaitingHead,
} from "@/lib/video-section-approval";
import {
  ApiClientError,
  listContentAssets,
  linkedAssetMediaId,
  marketingAssetUrl,
  videoSendToPublisher,
  videoSubmitFinalDraftToHead,
  type MarketingContentItem,
  type MarketingLinkedAsset,
} from "@/services/marketing-service";

type MarketingVideoFinalDraftPanelProps = {
  item: MarketingContentItem;
  userId: string | null;
  busy?: boolean;
  onUpdated: (item?: MarketingContentItem) => void;
};

export function MarketingVideoFinalDraftPanel({
  item,
  userId,
  busy: externalBusy,
  onUpdated,
}: MarketingVideoFinalDraftPanelProps) {
  const [assets, setAssets] = useState<MarketingLinkedAsset[]>([]);
  const [contentText, setContentText] = useState("");
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [videoAssetId, setVideoAssetId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isBusy = busy || Boolean(externalBusy);
  const canSubmit = canVideoEditorSubmitFinalDraftToHead(item, userId);
  const canSendPublisher = canVideoEditorSendToPublisher(item, userId);
  const awaitingHead = videoFinalDraftAwaitingHead(item);
  const draftApproved = videoFinalDraftApproved(item);
  const withPublisher = videoEditorAwaitingPublisher(item);

  const loadAssets = useCallback(async () => {
    try {
      const linked = await listContentAssets(item.id);
      setAssets(linked);
      const render = linked.find((a) => a.asset_role === VIDEO_FINAL_RENDER_ROLE);
      if (render) {
        setVideoAssetId(linkedAssetMediaId(render));
        setVideoPreview(marketingAssetUrl(render.asset.file_url));
      }
    } catch {
      setAssets([]);
    }
  }, [item.id]);

  useEffect(() => {
    setContentText(item.video_final_draft?.content_text ?? item.body ?? "");
    void loadAssets();
  }, [item, loadAssets]);

  const run = async (action: () => Promise<MarketingContentItem>) => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await action();
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const onVideoSelected = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const uploaded = await uploadContentAssetForItem(
        item.id,
        item.company_id,
        file,
        VIDEO_FINAL_RENDER_ROLE,
        "video",
      );
      setVideoAssetId(uploaded.id);
      setVideoPreview(URL.createObjectURL(file));
      await loadAssets();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const submitToHead = async () => {
    const resolvedVideoId =
      videoAssetId ?? assets.find((a) => a.asset_role === VIDEO_FINAL_RENDER_ROLE)?.asset.id ?? null;
    const text = contentText.trim() || "NA";
    await run(async () => {
      const updated = await videoSubmitFinalDraftToHead(item.id, {
        content_text: text,
        poster_media_asset_id: resolvedVideoId,
      });
      setSuccess("Final draft sent to marketing head. Waiting for their approval.");
      return updated;
    });
  };

  if (!canSubmit && !canSendPublisher && !awaitingHead && !withPublisher && !draftApproved) {
    return null;
  }

  const submittedDraft = item.video_final_draft;
  const showSubmittedVideo =
    submittedDraft?.poster_media_asset_id &&
    assets.find((a) => a.asset.id === submittedDraft.poster_media_asset_id);

  return (
    <div className="space-y-3 rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4">
      <div>
        <p className="text-sm font-medium">
          {canSubmit
            ? "Final draft — send to marketing head"
            : awaitingHead
              ? "Final draft submitted to marketing head"
              : canSendPublisher
                ? "Final draft approved — send to publisher"
                : withPublisher
                  ? "Final draft with publisher"
                  : "Final draft"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {canSubmit
            ? "Upload the final rendered video and caption. Marketing head must approve before the publisher receives it."
            : awaitingHead
              ? "Waiting for marketing head to approve your final video and caption."
              : canSendPublisher
                ? "Marketing head approved your final draft. Send it to the publisher when ready."
                : withPublisher
                  ? "The publisher will mark this as published when it goes live."
                  : null}
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-700 dark:text-emerald-300">{success}</p> : null}

      {canSubmit ? (
        <div className="space-y-3 rounded-lg border border-border/60 bg-background p-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Final video <span className="text-muted-foreground/70">(optional)</span>
            </label>
            <MarketingBannerUploadField
              disabled={isBusy}
              previewUrl={videoPreview}
              previewIsVideo
              accept="video/*"
              title="Final video"
              chooseLabel="Upload final video"
              hint="Optional — the finished video file for publishing."
              onFileSelected={(file) => void onVideoSelected(file)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Caption / post text <span className="text-muted-foreground/70">(optional)</span>
            </label>
            <textarea
              rows={4}
              value={contentText}
              disabled={isBusy}
              placeholder='Optional — write the caption, or leave blank / type "NA"'
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              onChange={(e) => setContentText(e.target.value)}
            />
          </div>
          <Button type="button" disabled={isBusy} onClick={() => void submitToHead()}>
            Send final draft to marketing head
          </Button>
        </div>
      ) : null}

      {(awaitingHead || draftApproved || withPublisher) && submittedDraft ? (
        <div className="space-y-3 rounded-lg border border-border/60 bg-background p-3 text-sm">
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Final caption</p>
            <p className="mt-1 whitespace-pre-wrap">{submittedDraft.content_text || "—"}</p>
          </div>
          {showSubmittedVideo ? (
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">Final video</p>
              <MarketingEnlargeableMedia
                src={marketingAssetUrl(showSubmittedVideo.asset.file_url)}
                alt="Final video"
                isVideo
                showCaption={false}
                mediaClassName="max-h-56 w-full"
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {canSendPublisher ? (
        <Button type="button" disabled={isBusy} onClick={() => void run(() => videoSendToPublisher(item.id))}>
          Send to publisher
        </Button>
      ) : null}
    </div>
  );
}
