import type { MarketingContentItem } from "@/services/marketing-service";

export const VIDEO_HEAD_SECTIONS = [{ id: "post", label: "Post" }] as const;

export type VideoHeadSectionId = (typeof VIDEO_HEAD_SECTIONS)[number]["id"];

export type VideoSectionRecord = {
  status: string;
  comments?: string | null;
  reviewed_at?: string | null;
  reviewed_by_user_id?: string | null;
};

export type VideoHeadSections = Partial<Record<VideoHeadSectionId, VideoSectionRecord>>;

export function usesVideoSectionWorkflow(item: MarketingContentItem): boolean {
  return item.content_type === "video";
}

export function hasVideoSectionApproval(item: MarketingContentItem): boolean {
  if (!usesVideoSectionWorkflow(item)) return false;
  if (item.video_head_sections != null) return true;
  return item.status === "in_review" || item.status === "changes_required";
}

function sectionRecord(
  sections: VideoHeadSections | null | undefined,
  sectionId: VideoHeadSectionId,
): VideoSectionRecord | null {
  if (!sections) return null;
  return sections[sectionId] ?? sections.post ?? null;
}

export function isSectionDataReady(_sectionId: VideoHeadSectionId, item: MarketingContentItem): boolean {
  const body = Boolean((item.body ?? "").trim());
  const company = Boolean((item.summary ?? "").trim());
  return body && company;
}

export function mapSectionDisplayStatus(status: string | undefined) {
  switch (status) {
    case "approved":
      return "approved" as const;
    case "awaiting_head":
      return "submitted" as const;
    case "changes_requested":
      return "changes_requested" as const;
    case "rejected":
      return "rejected" as const;
    case "pending":
      return "pending" as const;
    default:
      return "missing" as const;
  }
}

export function getVideoSectionDisplayStatus(
  sections: VideoHeadSections | null | undefined,
  sectionId: VideoHeadSectionId,
  item: MarketingContentItem,
) {
  const record = sectionRecord(sections, sectionId);
  if (!record) {
    return isSectionDataReady(sectionId, item) ? ("pending" as const) : ("missing" as const);
  }
  return mapSectionDisplayStatus(record.status);
}

export function canHeadApproveVideoSection(
  sections: VideoHeadSections | null | undefined,
  sectionId: VideoHeadSectionId,
  item: MarketingContentItem,
): boolean {
  if (!usesVideoSectionWorkflow(item)) return false;
  const record = sectionRecord(sections, sectionId);
  if (record?.status === "approved") return false;
  if (!isSectionDataReady(sectionId, item)) return false;
  if (!sections) return sectionId === "post";
  if (record?.status === "awaiting_head") return true;
  if (record?.status === "pending") return true;
  return false;
}

export function videoSectionWaitingMessage(
  sections: VideoHeadSections | null | undefined,
  sectionId: VideoHeadSectionId,
  item: MarketingContentItem,
): string | null {
  if (canHeadApproveVideoSection(sections, sectionId, item)) return null;
  const record = sectionRecord(sections, sectionId);
  if (record?.status === "approved") return null;
  if (!isSectionDataReady(sectionId, item)) {
    return "Video editor must add topic and company before this video can be reviewed.";
  }
  return null;
}

export function videoSectionRemarks(
  sections: VideoHeadSections | null | undefined,
  sectionId: VideoHeadSectionId,
): string | null {
  return sectionRecord(sections, sectionId)?.comments?.trim() || null;
}

export function allVideoSectionsApproved(item: MarketingContentItem): boolean {
  if (!hasVideoSectionApproval(item)) return false;
  const sections = item.video_head_sections as VideoHeadSections | null | undefined;
  const record = sectionRecord(sections, "post");
  if (!isSectionDataReady("post", item)) return false;
  return record?.status === "approved";
}

export const VIDEO_FINAL_RENDER_ROLE = "video_final_render";
export const VIDEO_CONTENT_MEDIA_ROLE = "video_content";

export function hasVideoFinalDraftPreview(item: MarketingContentItem): boolean {
  if (!usesVideoSectionWorkflow(item)) return false;
  const draft = item.video_final_draft;
  if (!draft) return false;
  return Boolean(
    (draft.content_text ?? "").trim() ||
      draft.poster_media_asset_id ||
      (draft.status && draft.status !== "draft"),
  );
}

export function videoFinalDraftApproved(item: MarketingContentItem): boolean {
  return item.video_final_draft?.status === "approved";
}

export function videoFinalDraftAwaitingHead(item: MarketingContentItem): boolean {
  return (
    item.workflow_stage === "video_final_draft_head_review" ||
    item.video_final_draft?.status === "awaiting_head"
  );
}

function isVideoEditorOwner(item: MarketingContentItem, userId: string | null): boolean {
  return Boolean(userId) && (item.created_by_id === userId || item.assigned_to_id === userId);
}

export function canVideoEditorSubmitFinalDraftToHead(
  item: MarketingContentItem,
  userId: string | null,
): boolean {
  if (!videoEditorInFinalDraftStage(item)) return false;
  if (!isVideoEditorOwner(item, userId)) return false;
  const status = item.video_final_draft?.status;
  return !status || status === "draft" || status === "changes_requested";
}

export function canVideoEditorSendToPublisher(item: MarketingContentItem, userId: string | null): boolean {
  if (!usesVideoSectionWorkflow(item)) return false;
  if (item.workflow_stage !== "video_editor_review") return false;
  if (item.status !== "approved") return false;
  if (!allVideoSectionsApproved(item)) return false;
  if (!videoFinalDraftApproved(item)) return false;
  return isVideoEditorOwner(item, userId);
}

export function videoEditorInFinalDraftStage(item: MarketingContentItem): boolean {
  return (
    usesVideoSectionWorkflow(item) &&
    hasVideoSectionApproval(item) &&
    item.workflow_stage === "video_editor_review" &&
    item.status === "approved" &&
    allVideoSectionsApproved(item)
  );
}

export function canHeadReviewVideoFinalDraft(item: MarketingContentItem): boolean {
  return videoFinalDraftAwaitingHead(item);
}

export function canMarkVideoAsPublished(
  perms: { canPublish: boolean; canApprove: boolean; canSubmit: boolean; canAssetCreate: boolean },
  item: MarketingContentItem,
): boolean {
  if (!hasVideoSectionApproval(item)) return false;
  if (item.workflow_stage !== "publisher_review" || item.status === "published" || item.status === "archived") {
    return false;
  }
  return (
    perms.canPublish &&
    !perms.canApprove &&
    !perms.canSubmit &&
    !perms.canAssetCreate
  );
}

export function videoEditorAwaitingPublisher(item: MarketingContentItem): boolean {
  return (
    usesVideoSectionWorkflow(item) &&
    hasVideoSectionApproval(item) &&
    item.workflow_stage === "publisher_review" &&
    item.status !== "published"
  );
}

export function videoPublishStatusLabel(item: MarketingContentItem): string | null {
  if (!hasVideoSectionApproval(item)) return null;
  if (item.status === "published" || item.posting_report_status === "posted") {
    return "Published";
  }
  if (videoEditorAwaitingPublisher(item)) {
    return item.posting_report_status === "not_posted"
      ? "Final video with publisher — not published yet"
      : "With publisher";
  }
  if (videoEditorInFinalDraftStage(item) && videoFinalDraftApproved(item)) {
    return "Final draft approved — send to publisher";
  }
  if (videoFinalDraftAwaitingHead(item)) {
    return "Final draft with marketing head";
  }
  if (videoEditorInFinalDraftStage(item)) {
    return "Head approved video — send final draft to head";
  }
  return null;
}
