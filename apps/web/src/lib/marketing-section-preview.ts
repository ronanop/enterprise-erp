import {
  LINKEDIN_FINAL_POSTER_ROLE,
  hasLinkedInFinalDraftPreview,
  usesLinkedInSectionWorkflow,
} from "@/lib/linkedin-section-approval";
import { BANNER_VERIFICATION_ITEM_KEY } from "@/lib/marketing-content-upload";
import { LINKEDIN_CONTENT_MEDIA_ROLES } from "@/lib/marketing-verification";
import {
  VIDEO_CONTENT_MEDIA_ROLE,
  VIDEO_FINAL_RENDER_ROLE,
  hasVideoFinalDraftPreview,
  usesVideoSectionWorkflow,
} from "@/lib/video-section-approval";
import type { MarketingContentItem, MarketingLinkedAsset } from "@/services/marketing-service";

const FINAL_DRAFT_ASSET_ROLES = new Set([LINKEDIN_FINAL_POSTER_ROLE, VIDEO_FINAL_RENDER_ROLE]);

export function hasSectionWorkflowFinalDraft(item: MarketingContentItem): boolean {
  return hasLinkedInFinalDraftPreview(item) || hasVideoFinalDraftPreview(item);
}

export function usesSectionContentWorkflow(item: MarketingContentItem): boolean {
  return usesLinkedInSectionWorkflow(item) || usesVideoSectionWorkflow(item);
}

export function isFinalDraftMediaAsset(link: MarketingLinkedAsset): boolean {
  return FINAL_DRAFT_ASSET_ROLES.has(link.asset_role ?? "");
}

export function filterSourcePreviewMedia(
  assets: MarketingLinkedAsset[],
  item: MarketingContentItem,
): MarketingLinkedAsset[] {
  return assets.filter((link) => {
    if (isFinalDraftMediaAsset(link)) return false;
    const role = link.asset_role ?? "";
    if (item.content_type === "social_post") {
      if (
        LINKEDIN_CONTENT_MEDIA_ROLES.includes(role as (typeof LINKEDIN_CONTENT_MEDIA_ROLES)[number]) ||
        role === BANNER_VERIFICATION_ITEM_KEY
      ) {
        return true;
      }
      return !role && (link.asset.asset_kind === "image" || link.asset.asset_kind === "video");
    }
    if (item.content_type === "video") {
      if (role === VIDEO_CONTENT_MEDIA_ROLE) return true;
      return !role && (link.asset.asset_kind === "image" || link.asset.asset_kind === "video");
    }
    if (role === BANNER_VERIFICATION_ITEM_KEY) return true;
    return link.asset.asset_kind === "image" || link.asset.asset_kind === "video";
  });
}

/** Publisher queue / published items: show only the approved final draft, not the source brief. */
export function publisherSeesFinalDraftOnly(item: MarketingContentItem, isPublisher: boolean): boolean {
  if (!isPublisher || !hasSectionWorkflowFinalDraft(item)) return false;
  return (
    item.workflow_stage === "publisher_review" ||
    item.status === "published" ||
    item.status === "archived"
  );
}

function sectionPostRecord(item: MarketingContentItem): { status?: string } | null {
  const sections = item.video_head_sections ?? item.linkedin_head_sections;
  if (!sections) return null;
  return (sections.post as { status?: string } | undefined) ?? null;
}

export function sectionSourceDraftNeedsEdits(item: MarketingContentItem): boolean {
  if (item.status !== "changes_required") return false;
  if (!usesSectionContentWorkflow(item)) return false;
  const post = sectionPostRecord(item);
  return post?.status === "changes_requested";
}

export function canEditSectionSourceDraft(item: MarketingContentItem, userId: string | null): boolean {
  if (!sectionSourceDraftNeedsEdits(item)) return false;
  if (!userId) return false;
  return item.created_by_id === userId || item.assigned_to_id === userId;
}
