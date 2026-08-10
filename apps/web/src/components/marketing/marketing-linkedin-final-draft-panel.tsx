"use client";

import { useCallback, useEffect, useState } from "react";

import { MarketingBannerUploadField } from "@/components/marketing/marketing-banner-upload-field";
import { Button } from "@/components/ui/button";
import { uploadContentAssetForItem } from "@/lib/marketing-content-upload";
import {
  canLinkedInHandlerSendToPublisher,
  canLinkedInHandlerSubmitFinalDraftToHead,
  LINKEDIN_FINAL_POSTER_ROLE,
  linkedInFinalDraftApproved,
  linkedInFinalDraftAwaitingHead,
  linkedInHandlerAwaitingPublisher,
} from "@/lib/linkedin-section-approval";
import {
  ApiClientError,
  linkedInSendToPublisher,
  linkedInSubmitFinalDraftToHead,
  listContentAssets,
  linkedAssetMediaId,
  marketingAssetUrl,
  type MarketingContentItem,
  type MarketingLinkedAsset,
} from "@/services/marketing-service";

type MarketingLinkedInFinalDraftPanelProps = {
  item: MarketingContentItem;
  userId: string | null;
  busy?: boolean;
  onUpdated: (item?: MarketingContentItem) => void;
};

export function MarketingLinkedInFinalDraftPanel({
  item,
  userId,
  busy: externalBusy,
  onUpdated,
}: MarketingLinkedInFinalDraftPanelProps) {
  const [assets, setAssets] = useState<MarketingLinkedAsset[]>([]);
  const [contentText, setContentText] = useState("");
  const [posterPreview, setPosterPreview] = useState<string | null>(null);
  const [posterAssetId, setPosterAssetId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isBusy = busy || Boolean(externalBusy);
  const canSubmit = canLinkedInHandlerSubmitFinalDraftToHead(item, userId);
  const canSendPublisher = canLinkedInHandlerSendToPublisher(item, userId);
  const awaitingHead = linkedInFinalDraftAwaitingHead(item);
  const draftApproved = linkedInFinalDraftApproved(item);
  const withPublisher = linkedInHandlerAwaitingPublisher(item);

  const loadAssets = useCallback(async () => {
    try {
      const linked = await listContentAssets(item.id);
      setAssets(linked);
      const poster = linked.find((a) => a.asset_role === LINKEDIN_FINAL_POSTER_ROLE);
      if (poster) {
        setPosterAssetId(linkedAssetMediaId(poster));
        setPosterPreview(marketingAssetUrl(poster.asset.file_url));
      }
    } catch {
      setAssets([]);
    }
  }, [item.id]);

  useEffect(() => {
    setContentText(item.linkedin_final_draft?.content_text ?? item.body ?? "");
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

  const onPosterSelected = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const uploaded = await uploadContentAssetForItem(
        item.id,
        item.company_id,
        file,
        LINKEDIN_FINAL_POSTER_ROLE,
        "image",
      );
      setPosterAssetId(uploaded.id);
      setPosterPreview(URL.createObjectURL(file));
      await loadAssets();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const submitToHead = async () => {
    const resolvedPosterId =
      posterAssetId ??
      assets.find((a) => a.asset_role === LINKEDIN_FINAL_POSTER_ROLE)?.asset.id ??
      null;
    const text = contentText.trim() || "NA";
    await run(async () => {
      const updated = await linkedInSubmitFinalDraftToHead(item.id, {
        content_text: text,
        poster_media_asset_id: resolvedPosterId,
      });
      setSuccess("Final draft sent to marketing head. Waiting for their approval.");
      return updated;
    });
  };

  if (!canSubmit && !canSendPublisher && !awaitingHead && !withPublisher && !draftApproved) {
    return null;
  }

  const submittedDraft = item.linkedin_final_draft;
  const showSubmittedPoster =
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
            ? "Optionally upload a final poster and add post copy. Leave blank or use NA if not applicable. Marketing head must approve before the publisher receives it."
            : awaitingHead
              ? "Waiting for marketing head to approve your poster and content."
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
              Final poster image <span className="text-muted-foreground/70">(optional)</span>
            </label>
            <MarketingBannerUploadField
              disabled={isBusy}
              previewUrl={posterPreview}
              accept="image/*"
              title="Final poster"
              chooseLabel="Upload final poster"
              hint="Optional — the finished poster/creative for this LinkedIn post."
              onFileSelected={(file) => void onPosterSelected(file)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Final post content <span className="text-muted-foreground/70">(optional)</span>
            </label>
            <textarea
              rows={4}
              value={contentText}
              disabled={isBusy}
              placeholder='Optional — write the final post copy, or leave blank / type "NA"'
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              onChange={(e) => setContentText(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Leave empty or type <strong>NA</strong> if there is no copy.
            </p>
          </div>
          <Button
            type="button"
            disabled={isBusy}
            onClick={(e) => {
              e.stopPropagation();
              void submitToHead();
            }}
          >
            Send final draft to marketing head
          </Button>
        </div>
      ) : null}

      {(awaitingHead || draftApproved || withPublisher) && submittedDraft ? (
        <div className="space-y-3 rounded-lg border border-border/60 bg-background p-3 text-sm">
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Final content</p>
            <p className="mt-1 whitespace-pre-wrap">{submittedDraft.content_text || "—"}</p>
          </div>
          {showSubmittedPoster ? (
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">Final poster</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={marketingAssetUrl(showSubmittedPoster.asset.file_url)}
                alt="Final poster"
                className="mt-2 max-h-56 rounded border object-contain"
              />
            </div>
          ) : null}
          {submittedDraft.comments ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs">
              <p className="font-medium text-amber-800">Marketing head feedback</p>
              <p className="mt-1 whitespace-pre-wrap">{submittedDraft.comments}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {canSendPublisher ? (
        <Button
          type="button"
          disabled={isBusy}
          onClick={(e) => {
            e.stopPropagation();
            void run(() => linkedInSendToPublisher(item.id));
          }}
        >
          Send to publisher
        </Button>
      ) : null}
    </div>
  );
}
