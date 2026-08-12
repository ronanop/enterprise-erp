"use client";

import { MarketingLinkedInFinalDraftPreview } from "@/components/marketing/marketing-linkedin-final-draft-preview";
import { MarketingVideoFinalDraftPreview } from "@/components/marketing/marketing-video-final-draft-preview";
import type { MarketingContentItem } from "@/services/marketing-service";

type MarketingSectionFinalDraftPreviewsProps = {
  item: MarketingContentItem;
};

export function MarketingSectionFinalDraftPreviews({ item }: MarketingSectionFinalDraftPreviewsProps) {
  return (
    <>
      <MarketingLinkedInFinalDraftPreview item={item} />
      <MarketingVideoFinalDraftPreview item={item} />
    </>
  );
}
