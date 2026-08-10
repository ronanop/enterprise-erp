import type { useMarketingPermissions } from "@/hooks/use-marketing-permissions";

export const VERIFIER_ROLE_LABELS: Record<string, string> = {
  creator: "Content Creator",
  campaign_handler: "Campaign & Social Media Handler",
  linkedin_handler: "LinkedIn Handler",
  video_editor: "Video Editor",
  publisher: "Publisher",
};

export const WORKFLOW_STAGE_LABELS: Record<string, string> = {
  draft: "Draft",
  head_final_review: "Awaiting Marketing Head",
  publisher_review: "With Publisher",
  changes_required: "Changes Required",
  rejected: "Rejected",
  published: "Published",
  ready_to_publish: "Ready to Publish",
};

/** Submitter roles — each works independently with marketing head. */
export function inferSubmitterRole(perms: ReturnType<typeof useMarketingPermissions>): string | null {
  if (perms.canApprove) return null;
  if (perms.canPublish && !perms.canVerify) return null;
  if (perms.canVerify && perms.canCampaignUpdate) return "campaign_handler";
  if (perms.canVerify && perms.canChannelUpdate) return "linkedin_handler";
  if (perms.canSubmit) return "creator";
  if (perms.canVerify && perms.canAssetCreate) return "video_editor";
  return null;
}

export function isMarketingHead(perms: ReturnType<typeof useMarketingPermissions>): boolean {
  return perms.canApprove;
}

export function isLinkedInHandler(perms: ReturnType<typeof useMarketingPermissions>): boolean {
  return (
    perms.canVerify &&
    perms.canChannelUpdate &&
    !perms.canCampaignUpdate &&
    !perms.canApprove
  );
}

export function isPublisherOnly(perms: ReturnType<typeof useMarketingPermissions>): boolean {
  return perms.canPublish && !perms.canApprove;
}

export function canReportPostingToHead(
  perms: ReturnType<typeof useMarketingPermissions>,
  verificationOverallStatus?: string | null,
): boolean {
  if (perms.canApprove) return false;
  if (perms.canPublish && !perms.canVerify) return false;
  return (
    verificationOverallStatus === "awaiting_posting" ||
    verificationOverallStatus === "approved"
  );
}

export type VerificationItemInputType = "text" | "image" | "video";

const IMAGE_ITEM_KEYS = new Set([
  "image_dimensions",
  "image_transparency",
  "other_design",
  "branding_guidelines",
]);

const VIDEO_ITEM_KEYS = new Set([
  "video_quality",
  "resolution",
  "aspect_ratio",
  "subtitles",
  "video_branding",
  "thumbnail",
  "audio_quality",
]);

export function getVerificationItemInputType(itemKey: string): VerificationItemInputType {
  if (IMAGE_ITEM_KEYS.has(itemKey)) return "image";
  if (VIDEO_ITEM_KEYS.has(itemKey)) return "video";
  return "text";
}

export type VerificationTextField = "body" | "hashtags" | "theme" | "font_name" | "font_size" | "color_codes";

const VERIFICATION_TEXT_FIELD_MAP: Record<string, VerificationTextField> = {
  text_copy: "body",
  content: "body",
  hashtags: "hashtags",
  theme: "theme",
  font_name: "font_name",
  font_size: "font_size",
  color_codes: "color_codes",
};

export function getVerificationTextField(itemKey: string): VerificationTextField | null {
  return VERIFICATION_TEXT_FIELD_MAP[itemKey] ?? null;
}

export function verificationTextFieldLabel(field: VerificationTextField): string {
  switch (field) {
    case "body":
      return "Post text / copy";
    case "hashtags":
      return "Hashtags";
    case "theme":
      return "Theme";
    case "font_name":
      return "Font name";
    case "font_size":
      return "Font size";
    case "color_codes":
      return "Color codes";
    default:
      return field;
  }
}
