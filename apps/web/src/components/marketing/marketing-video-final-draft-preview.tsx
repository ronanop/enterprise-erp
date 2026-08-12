"use client";

import { useCallback, useEffect, useState } from "react";
import { FileCheck2 } from "lucide-react";

import { MarketingReviewSectionHeader } from "@/components/marketing/marketing-review-section-header";
import { MarketingEnlargeableMedia } from "@/components/marketing/marketing-enlargeable-media";
import { marketingCard } from "@/lib/marketing-ui";
import { hasVideoFinalDraftPreview } from "@/lib/video-section-approval";
import {
  listContentAssets,
  marketingAssetUrl,
  type MarketingContentItem,
  type MarketingLinkedAsset,
} from "@/services/marketing-service";

type MarketingVideoFinalDraftPreviewProps = {
  item: MarketingContentItem;
};

export function MarketingVideoFinalDraftPreview({ item }: MarketingVideoFinalDraftPreviewProps) {
  const [assets, setAssets] = useState<MarketingLinkedAsset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);

  const draft = item.video_final_draft;

  const loadAssets = useCallback(async () => {
    setAssetsLoading(true);
    try {
      setAssets(await listContentAssets(item.id));
    } catch {
      setAssets([]);
    } finally {
      setAssetsLoading(false);
    }
  }, [item.id]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  if (!hasVideoFinalDraftPreview(item) || !draft) {
    return null;
  }

  const videoAsset = draft.poster_media_asset_id
    ? assets.find((a) => a.asset.id === draft.poster_media_asset_id)
    : null;

  return (
    <section className={marketingCard}>
      <MarketingReviewSectionHeader
        tone="preview"
        icon={FileCheck2}
        title="Final draft"
        description="Approved video and caption sent to the publisher"
      />

      <div className="space-y-3 p-4">
        <div className="rounded-lg border border-border/50 bg-background/60 p-3.5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/80">Final caption</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {(draft.content_text ?? "").trim() || "—"}
          </p>
        </div>

        {assetsLoading ? (
          <p className="text-sm text-muted-foreground">Loading final video…</p>
        ) : videoAsset ? (
          <div className="rounded-lg border border-border/50 bg-background/60 p-3.5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/80">Final video</p>
            <MarketingEnlargeableMedia
              src={marketingAssetUrl(videoAsset.asset.file_url)}
              alt="Final video"
              isVideo
              showCaption={false}
              mediaClassName="max-h-64 w-full"
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
