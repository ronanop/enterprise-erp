import type { MarketingContentItem } from "@/services/marketing-service";

export const LINKEDIN_HEAD_SECTIONS = [
  { id: "content", label: "Content" },
  { id: "theme", label: "Theme" },
  { id: "fonts", label: "Fonts" },
] as const;

export type LinkedInHeadSectionId = (typeof LINKEDIN_HEAD_SECTIONS)[number]["id"];

export type LinkedInSectionRecord = {
  status: string;
  comments?: string | null;
  reviewed_at?: string | null;
  reviewed_by_user_id?: string | null;
};

export type LinkedInHeadSections = Partial<Record<LinkedInHeadSectionId, LinkedInSectionRecord>>;

export type SectionDisplayStatus =
  | "approved"
  | "submitted"
  | "pending"
  | "changes_requested"
  | "rejected"
  | "missing";

export function isMarketingContentLocked(item: MarketingContentItem): boolean {
  return item.status === "published" || item.status === "archived";
}

export function usesLinkedInSectionWorkflow(item: MarketingContentItem): boolean {
  return item.content_type === "social_post";
}

export function hasLinkedInSectionApproval(item: MarketingContentItem): boolean {
  if (!usesLinkedInSectionWorkflow(item)) return false;
  if (item.linkedin_head_sections != null) return true;
  return item.status === "in_review" || item.status === "changes_required";
}

function sectionRecord(
  sections: LinkedInHeadSections | null | undefined,
  sectionId: LinkedInHeadSectionId,
): LinkedInSectionRecord | null {
  return sections?.[sectionId] ?? null;
}

export function isSectionDataReady(
  sectionId: LinkedInHeadSectionId,
  item: MarketingContentItem,
): boolean {
  if (sectionId === "content") {
    return Boolean((item.body ?? "").trim()) && Boolean((item.hashtags ?? "").trim());
  }
  if (sectionId === "theme") {
    return Boolean((item.theme ?? "").trim());
  }
  return Boolean((item.font_name ?? "").trim())
    && Boolean((item.font_size ?? "").trim())
    && Boolean((item.color_codes ?? "").trim());
}

export function mapSectionDisplayStatus(status: string | undefined): SectionDisplayStatus {
  switch (status) {
    case "approved":
      return "approved";
    case "awaiting_head":
      return "submitted";
    case "changes_requested":
      return "changes_requested";
    case "rejected":
      return "rejected";
    case "pending":
      return "pending";
    default:
      return "missing";
  }
}

export function getLinkedInSectionDisplayStatus(
  sections: LinkedInHeadSections | null | undefined,
  sectionId: LinkedInHeadSectionId,
  item: MarketingContentItem,
): SectionDisplayStatus {
  const record = sectionRecord(sections, sectionId);
  if (!record) {
    return isSectionDataReady(sectionId, item) ? "pending" : "missing";
  }
  return mapSectionDisplayStatus(record.status);
}

export function isLinkedInPriorSectionApproved(
  sections: LinkedInHeadSections | null | undefined,
  sectionId: LinkedInHeadSectionId,
): boolean {
  if (sectionId === "content") return true;
  const priorId: LinkedInHeadSectionId = sectionId === "theme" ? "content" : "theme";
  return sectionRecord(sections, priorId)?.status === "approved";
}

export function canHeadApproveLinkedInSection(
  sections: LinkedInHeadSections | null | undefined,
  sectionId: LinkedInHeadSectionId,
  item: MarketingContentItem,
): boolean {
  if (!usesLinkedInSectionWorkflow(item)) return false;
  if (!isLinkedInPriorSectionApproved(sections, sectionId)) return false;
  const record = sectionRecord(sections, sectionId);
  if (record?.status === "approved") return false;
  if (!isSectionDataReady(sectionId, item)) return false;
  if (!sections) {
    return sectionId === "content";
  }
  if (record?.status === "awaiting_head") return true;
  if (record?.status === "pending" && isLinkedInPriorSectionApproved(sections, sectionId)) return true;
  return false;
}

export function linkedInSectionWaitingMessage(
  sections: LinkedInHeadSections | null | undefined,
  sectionId: LinkedInHeadSectionId,
  item: MarketingContentItem,
): string | null {
  const label = LINKEDIN_HEAD_SECTIONS.find((s) => s.id === sectionId)?.label ?? sectionId;
  if (!isLinkedInPriorSectionApproved(sections, sectionId)) {
    const priorId: LinkedInHeadSectionId | null =
      sectionId === "theme" ? "content" : sectionId === "fonts" ? "theme" : null;
    if (priorId) {
      const priorLabel = LINKEDIN_HEAD_SECTIONS.find((s) => s.id === priorId)?.label ?? priorId;
      return `Approve ${priorLabel} first to unlock ${label} for approval.`;
    }
  }
  if (canHeadApproveLinkedInSection(sections, sectionId, item)) return null;
  const record = sectionRecord(sections, sectionId);
  if (record?.status === "approved") return null;
  if (!isSectionDataReady(sectionId, item)) {
    return `LinkedIn handler has not completed the ${label} section yet.`;
  }
  return null;
}

export function linkedInSectionRemarks(
  sections: LinkedInHeadSections | null | undefined,
  sectionId: LinkedInHeadSectionId,
): string | null {
  const comments = sectionRecord(sections, sectionId)?.comments?.trim();
  return comments || null;
}

export function allLinkedInSectionsApproved(item: MarketingContentItem): boolean {
  if (!hasLinkedInSectionApproval(item)) return false;
  const sections = item.linkedin_head_sections as LinkedInHeadSections | null | undefined;
  return LINKEDIN_HEAD_SECTIONS.every((section) => {
    if (!isSectionDataReady(section.id, item)) return true;
    return sections?.[section.id]?.status === "approved";
  });
}

export const LINKEDIN_FINAL_POSTER_ROLE = "linkedin_final_poster";

export function linkedInFinalDraftApproved(item: MarketingContentItem): boolean {
  return item.linkedin_final_draft?.status === "approved";
}

export function linkedInFinalDraftAwaitingHead(item: MarketingContentItem): boolean {
  return (
    item.workflow_stage === "linkedin_final_draft_head_review" ||
    item.linkedin_final_draft?.status === "awaiting_head"
  );
}

function isLinkedInHandlerOwner(item: MarketingContentItem, userId: string | null): boolean {
  return Boolean(userId) && (item.created_by_id === userId || item.assigned_to_id === userId);
}

export function canLinkedInHandlerSubmitFinalDraftToHead(
  item: MarketingContentItem,
  userId: string | null,
): boolean {
  if (!linkedInHandlerInFinalDraftStage(item)) return false;
  if (!isLinkedInHandlerOwner(item, userId)) return false;
  const status = item.linkedin_final_draft?.status;
  return !status || status === "draft" || status === "changes_requested";
}

export function canLinkedInHandlerSendToPublisher(
  item: MarketingContentItem,
  userId: string | null,
): boolean {
  if (!usesLinkedInSectionWorkflow(item)) return false;
  if (item.workflow_stage !== "linkedin_handler_review") return false;
  if (item.status !== "approved") return false;
  if (!allLinkedInSectionsApproved(item)) return false;
  if (!linkedInFinalDraftApproved(item)) return false;
  return isLinkedInHandlerOwner(item, userId);
}

export function linkedInHandlerInFinalDraftStage(item: MarketingContentItem): boolean {
  return (
    usesLinkedInSectionWorkflow(item) &&
    hasLinkedInSectionApproval(item) &&
    item.workflow_stage === "linkedin_handler_review" &&
    item.status === "approved" &&
    allLinkedInSectionsApproved(item)
  );
}

export function canHeadReviewLinkedInFinalDraft(item: MarketingContentItem): boolean {
  return linkedInFinalDraftAwaitingHead(item);
}

export function canMarkLinkedInAsPublished(
  perms: { canPublish: boolean; canApprove: boolean; canSubmit: boolean; canChannelUpdate: boolean },
  item: MarketingContentItem,
): boolean {
  if (!hasLinkedInSectionApproval(item)) return false;
  if (item.workflow_stage !== "publisher_review" || isMarketingContentLocked(item)) return false;
  return (
    perms.canPublish &&
    !perms.canApprove &&
    !perms.canSubmit &&
    !perms.canChannelUpdate
  );
}

export function linkedInHandlerAwaitingPublisher(item: MarketingContentItem): boolean {
  return (
    usesLinkedInSectionWorkflow(item) &&
    hasLinkedInSectionApproval(item) &&
    item.workflow_stage === "publisher_review" &&
    item.status !== "published"
  );
}

export function linkedInPublishStatusLabel(item: MarketingContentItem): string | null {
  if (!hasLinkedInSectionApproval(item)) return null;
  if (item.status === "published" || item.posting_report_status === "posted") {
    return "Published";
  }
  if (linkedInHandlerAwaitingPublisher(item)) {
    return item.posting_report_status === "not_posted"
      ? "Final draft with publisher — not published yet"
      : "With publisher";
  }
  if (linkedInHandlerInFinalDraftStage(item) && linkedInFinalDraftApproved(item)) {
    return "Final draft approved — send to publisher";
  }
  if (linkedInFinalDraftAwaitingHead(item)) {
    return "Final draft with marketing head";
  }
  if (canLinkedInHandlerSubmitFinalDraftToHead(item, null)) {
    return "Head approved sections — send final draft to head";
  }
  if (linkedInHandlerInFinalDraftStage(item)) {
    return "Head approved sections — send final draft to head";
  }
  return null;
}
