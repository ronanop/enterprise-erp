"use client";

import { useCallback, useEffect, useState } from "react";
import { FileCheck2 } from "lucide-react";

import { MarketingReviewSectionHeader } from "@/components/marketing/marketing-review-section-header";
import { MarketingEnlargeableMedia } from "@/components/marketing/marketing-enlargeable-media";
import { marketingCard } from "@/lib/marketing-ui";
import { hasLinkedInFinalDraftPreview } from "@/lib/linkedin-section-approval";
import {
  listContentAssets,
  marketingAssetUrl,
  type MarketingContentItem,
  type MarketingLinkedAsset,
} from "@/services/marketing-service";

type MarketingLinkedInFinalDraftPreviewProps = {
  item: MarketingContentItem;
};

export function MarketingLinkedInFinalDraftPreview({ item }: MarketingLinkedInFinalDraftPreviewProps) {
  const [assets, setAssets] = useState<MarketingLinkedAsset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);

  const draft = item.linkedin_final_draft;

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

  if (!hasLinkedInFinalDraftPreview(item) || !draft) {
    return null;
  }

  const poster = draft.poster_media_asset_id
    ? assets.find((a) => a.asset.id === draft.poster_media_asset_id)
    : null;

  return (
    <section className={marketingCard}>
      <MarketingReviewSectionHeader
        tone="preview"
        icon={FileCheck2}
        title="Final draft"
        description="Approved poster and copy sent to the publisher"
      />

      <div className="space-y-3 p-4">
        <div className="rounded-lg border border-border/50 bg-background/60 p-3.5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/80">Final content</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {(draft.content_text ?? "").trim() || "—"}
          </p>
        </div>

        {assetsLoading ? (
          <div className="rounded-lg border border-border/50 bg-background/60 p-3.5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/80">Final poster</p>
            <p className="mt-2 text-sm text-muted-foreground">Loading poster…</p>
          </div>
        ) : poster ? (
          <div className="rounded-lg border border-border/50 bg-background/60 p-3.5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/80">Final poster</p>
            <MarketingEnlargeableMedia
              src={marketingAssetUrl(poster.asset.file_url)}
              alt="Final poster"
              showCaption={false}
              mediaClassName="max-h-64 w-full"
            />
          </div>
        ) : draft.poster_media_asset_id ? (
          <div className="rounded-lg border border-border/50 bg-background/60 p-3.5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/80">Final poster</p>
            <p className="mt-2 text-sm text-muted-foreground">Poster unavailable.</p>
          </div>
        ) : null}

        {draft.comments ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3.5 text-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-800 dark:text-amber-200">
              Marketing head feedback
            </p>
            <p className="mt-2 whitespace-pre-wrap text-foreground">{draft.comments}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
