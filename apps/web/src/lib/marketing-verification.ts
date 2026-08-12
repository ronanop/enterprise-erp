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
  if (perms.canVerify && perms.canAssetCreate && !perms.canChannelUpdate && !perms.canCampaignUpdate) {
    return "video_editor";
  }
  if (perms.canSubmit) return "creator";
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
  return (
    perms.canPublish &&
    !perms.canApprove &&
    !perms.canSubmit &&
    !perms.canChannelUpdate
  );
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

export const LINKEDIN_VERIFICATION_ITEMS = [
  { itemKey: "linkedin_content", label: "Content" },
  { itemKey: "theme", label: "Theme" },
  { itemKey: "fonts", label: "Fonts" },
] as const;

/** Head review page — three stacked sections matching LinkedIn draft tabs. */
export const HEAD_REVIEW_SECTIONS = [
  {
    id: "content",
    label: "Content",
    itemKeys: ["linkedin_content", "content", "hashtags", "text_copy"],
  },
  {
    id: "theme",
    label: "Theme",
    itemKeys: ["theme"],
  },
  {
    id: "fonts",
    label: "Fonts",
    itemKeys: ["fonts", "font_name", "font_size", "color_codes"],
  },
] as const;

export type HeadReviewSectionId = (typeof HEAD_REVIEW_SECTIONS)[number]["id"];

export const LINKEDIN_SECTION_ITEM_KEY: Record<HeadReviewSectionId, string> = {
  content: "linkedin_content",
  theme: "theme",
  fonts: "fonts",
};

const HEAD_REVIEW_SECTION_LABELS: Record<HeadReviewSectionId, string> = {
  content: "Content",
  theme: "Theme",
  fonts: "Fonts",
};

export function headReviewSectionLabel(sectionId: HeadReviewSectionId): string {
  return HEAD_REVIEW_SECTION_LABELS[sectionId];
}

export type SectionVerificationEntry = {
  verifier_role: string;
  item_key: string;
  status: string;
  comments: string | null;
};

export type SectionAggregateStatus =
  | "approved"
  | "submitted"
  | "pending"
  | "changes_requested"
  | "rejected"
  | "missing";

export type HeadReviewSectionState = {
  entries: SectionVerificationEntry[];
  aggregateStatus: SectionAggregateStatus;
  remarks: string | null;
};

type VerificationLike = {
  verifier_role: string;
  items: Array<{ item_key: string; status: string; comments?: string | null }>;
};

function pickVerifications(verifications: VerificationLike[], preferredRole?: string | null): VerificationLike[] {
  if (!preferredRole) return verifications;
  const preferred = verifications.filter((v) => v.verifier_role === preferredRole);
  return preferred.length > 0 ? preferred : verifications;
}

export function canonicalSectionEntries(
  sectionId: HeadReviewSectionId,
  entries: SectionVerificationEntry[],
): SectionVerificationEntry[] {
  if (entries.length === 0) return entries;
  if (sectionId === "content") {
    const linkedin = entries.find((e) => e.item_key === "linkedin_content");
    const legacy = entries.filter((e) => ["content", "hashtags", "text_copy"].includes(e.item_key));
    if (linkedin && linkedin.status !== "pending") return [linkedin];
    if (linkedin && legacy.length === 0) return [linkedin];
    if (legacy.length > 0 && legacy.every((e) => e.status === "approved")) return legacy;
    if (linkedin) return [linkedin];
    return legacy;
  }
  if (sectionId === "theme") {
    return entries.filter((e) => e.item_key === "theme");
  }
  const fonts = entries.find((e) => e.item_key === "fonts");
  if (fonts) return [fonts];
  return entries.filter((e) => ["font_name", "font_size", "color_codes"].includes(e.item_key));
}

export function resolveHeadReviewSectionState(
  verifications: VerificationLike[],
  sectionId: HeadReviewSectionId,
  preferredRole?: string | null,
): HeadReviewSectionState {
  const section = HEAD_REVIEW_SECTIONS.find((s) => s.id === sectionId);
  if (!section) {
    return { entries: [], aggregateStatus: "missing", remarks: null };
  }

  const ordered = pickVerifications(verifications, preferredRole);
  const entries: SectionVerificationEntry[] = [];
  const seen = new Set<string>();

  for (const key of section.itemKeys) {
    for (const verification of ordered) {
      const item = verification.items.find((i) => i.item_key === key);
      if (item && !seen.has(key)) {
        seen.add(key);
        entries.push({
          verifier_role: verification.verifier_role,
          item_key: item.item_key,
          status: item.status,
          comments: item.comments ?? null,
        });
      }
    }
  }

  if (entries.length === 0) {
    return { entries: [], aggregateStatus: "missing", remarks: null };
  }

  const canonical = canonicalSectionEntries(sectionId, entries);
  const statuses = canonical.map((e) => e.status);
  let aggregateStatus: SectionAggregateStatus = "pending";
  if (statuses.some((s) => s === "rejected")) aggregateStatus = "rejected";
  else if (statuses.some((s) => s === "changes_requested")) aggregateStatus = "changes_requested";
  else if (statuses.some((s) => s === "submitted")) aggregateStatus = "submitted";
  else if (statuses.every((s) => s === "approved")) aggregateStatus = "approved";
  else if (statuses.some((s) => s === "pending")) aggregateStatus = "pending";

  const remarks = canonical
    .filter((e) => e.comments?.trim())
    .map((e) => e.comments as string)
    .join("\n\n");

  return { entries: canonical, aggregateStatus, remarks: remarks || null };
}

export function sectionStatusLabel(status: SectionAggregateStatus): string {
  switch (status) {
    case "approved":
      return "Approved";
    case "submitted":
      return "Awaiting approval";
    case "pending":
      return "Not submitted yet";
    case "changes_requested":
      return "Changes requested";
    case "rejected":
      return "Rejected";
    case "missing":
      return "Not submitted yet";
    default:
      return "Not submitted yet";
  }
}

export function canResubmitSectionItem(status: string): boolean {
  return status === "pending" || status === "changes_requested" || status === "rejected";
}

export function isPriorSectionApproved(
  verifications: VerificationLike[],
  sectionId: HeadReviewSectionId,
  preferredRole?: string | null,
): boolean {
  if (sectionId === "content") return true;
  const priorId: HeadReviewSectionId = sectionId === "theme" ? "content" : "theme";
  const prior = resolveHeadReviewSectionState(verifications, priorId, preferredRole);
  return (
    prior.aggregateStatus === "approved"
    || prior.entries.some((entry) => entry.status === "approved")
  );
}

export function linkedInSectionGateMessage(
  verifications: VerificationLike[],
  sectionId: HeadReviewSectionId,
  preferredRole?: string | null,
): string | null {
  if (isPriorSectionApproved(verifications, sectionId, preferredRole)) return null;
  const priorLabel = sectionId === "theme" ? "Content" : "Theme";
  return `Marketing head must approve ${priorLabel} before this section can be submitted for approval.`;
}

export function isSectionReadyForHeadApproval(
  verifications: VerificationLike[],
  sectionId: HeadReviewSectionId,
  preferredRole?: string | null,
  contentItem?: {
    body?: string | null;
    summary?: string | null;
    hashtags?: string | null;
    theme?: string | null;
    font_name?: string | null;
    font_size?: string | null;
    color_codes?: string | null;
  },
): boolean {
  return getHeadReviewTargets(verifications, sectionId, preferredRole, contentItem).length > 0;
}

export function headSectionWaitingMessage(
  verifications: VerificationLike[],
  sectionId: HeadReviewSectionId,
  preferredRole?: string | null,
  contentItem?: {
    body?: string | null;
    summary?: string | null;
    theme?: string | null;
    font_name?: string | null;
    font_size?: string | null;
    color_codes?: string | null;
  },
): string | null {
  const label = headReviewSectionLabel(sectionId);
  if (!isPriorSectionApproved(verifications, sectionId, preferredRole)) {
    const priorId: HeadReviewSectionId | null =
      sectionId === "theme" ? "content" : sectionId === "fonts" ? "theme" : null;
    if (priorId) {
      return `Approve ${headReviewSectionLabel(priorId)} first to unlock ${label} for approval.`;
    }
  }
  const state = resolveHeadReviewSectionState(verifications, sectionId, preferredRole);
  if (getHeadReviewTargets(verifications, sectionId, preferredRole, contentItem).length > 0) {
    return null;
  }
  if (!state.entries.some((e) => e.status === "submitted")) {
    return `Waiting for LinkedIn handler to submit ${label}.`;
  }
  return null;
}

export function headSectionDisplayStatus(
  verifications: VerificationLike[],
  sectionId: HeadReviewSectionId,
  preferredRole?: string | null,
  contentItem?: {
    body?: string | null;
    summary?: string | null;
    hashtags?: string | null;
    theme?: string | null;
    font_name?: string | null;
    font_size?: string | null;
    color_codes?: string | null;
  },
): SectionAggregateStatus {
  const state = resolveHeadReviewSectionState(verifications, sectionId, preferredRole);
  if (state.aggregateStatus === "approved") return "approved";
  if (getHeadReviewTargets(verifications, sectionId, preferredRole, contentItem).length > 0) {
    return "submitted";
  }
  return state.aggregateStatus;
}

export function findSectionVerificationItems(
  verifications: VerificationLike[],
  sectionItemKeys: readonly string[],
  preferredRole?: string | null,
): Array<{ verifier_role: string; item_key: string; status: string; comments: string | null }> {
  const ordered = pickVerifications(verifications, preferredRole);
  const seen = new Set<string>();
  const results: Array<{ verifier_role: string; item_key: string; status: string; comments: string | null }> = [];
  for (const key of sectionItemKeys) {
    for (const verification of ordered) {
      const item = verification.items.find((i) => i.item_key === key);
      if (item && !seen.has(key)) {
        seen.add(key);
        results.push({
          verifier_role: verification.verifier_role,
          item_key: item.item_key,
          status: item.status,
          comments: item.comments ?? null,
        });
      }
    }
  }
  return results;
}

export type LinkedInVerificationItemKey = (typeof LINKEDIN_VERIFICATION_ITEMS)[number]["itemKey"];

export function isLinkedInVerificationRole(role: string | null | undefined): boolean {
  return role === "linkedin_handler";
}

export function isVideoVerificationRole(role: string | null | undefined): boolean {
  return role === "video_editor";
}

export const VIDEO_CONTENT_MEDIA_ROLES = ["video_content"] as const;

/** Asset roles that count as uploaded post media for LinkedIn Content approval. */
export const LINKEDIN_CONTENT_MEDIA_ROLES = ["linkedin_content", "image_dimensions", "content"] as const;

export function linkedInContentMediaReady(
  assets: Array<{ asset_role: string | null }>,
): boolean {
  const roles = new Set(assets.map((a) => a.asset_role).filter(Boolean));
  return LINKEDIN_CONTENT_MEDIA_ROLES.some((role) => roles.has(role));
}

export function linkedInContentTextReady(
  body: string | null | undefined,
  summary: string | null | undefined,
  hashtags?: string | null | undefined,
): boolean {
  return Boolean((body ?? "").trim()) && (Boolean((summary ?? "").trim()) || Boolean((hashtags ?? "").trim()));
}

export function isSectionDataReady(
  sectionId: HeadReviewSectionId,
  contentItem: {
    body?: string | null;
    summary?: string | null;
    hashtags?: string | null;
    theme?: string | null;
    font_name?: string | null;
    font_size?: string | null;
    color_codes?: string | null;
  },
): boolean {
  if (sectionId === "content") {
    return linkedInContentTextReady(contentItem.body, contentItem.summary, contentItem.hashtags);
  }
  if (sectionId === "theme") {
    return Boolean((contentItem.theme ?? "").trim());
  }
  return linkedInFontsReady(contentItem);
}

export function resolveLinkedInVerifierRole(
  verifications: VerificationLike[],
  preferredRole?: string | null,
): string {
  if (preferredRole && verifications.some((v) => v.verifier_role === preferredRole)) {
    return preferredRole;
  }
  const linkedin = verifications.find((v) => v.verifier_role === "linkedin_handler");
  if (linkedin) return linkedin.verifier_role;
  const withLinkedInItems = verifications.find((v) =>
    v.items.some((item) =>
      ["linkedin_content", "theme", "fonts", "content", "hashtags"].includes(item.item_key),
    ),
  );
  return withLinkedInItems?.verifier_role ?? preferredRole ?? "linkedin_handler";
}

function resolveTargetVerifierRole(
  verifications: VerificationLike[],
  sectionId: HeadReviewSectionId,
  preferredRole?: string | null,
): string {
  const itemKey = LINKEDIN_SECTION_ITEM_KEY[sectionId];
  const ordered = pickVerifications(verifications, preferredRole);
  for (const verification of ordered) {
    if (verification.items.some((item) => item.item_key === itemKey)) {
      return verification.verifier_role;
    }
  }
  return resolveLinkedInVerifierRole(verifications, preferredRole);
}

export type HeadReviewTarget = {
  verifier_role: string;
  item_key: string;
  status: string;
};

export function getHeadReviewTargets(
  verifications: VerificationLike[],
  sectionId: HeadReviewSectionId,
  preferredRole?: string | null,
  contentItem?: {
    body?: string | null;
    summary?: string | null;
    hashtags?: string | null;
    theme?: string | null;
    font_name?: string | null;
    font_size?: string | null;
    color_codes?: string | null;
  },
): HeadReviewTarget[] {
  if (!isPriorSectionApproved(verifications, sectionId, preferredRole)) return [];

  const state = resolveHeadReviewSectionState(verifications, sectionId, preferredRole);
  if (state.aggregateStatus === "approved") return [];

  const reviewable = state.entries.filter(
    (entry) => entry.status === "submitted" || entry.status === "pending",
  );
  if (reviewable.length > 0) return reviewable;

  if (!contentItem || !isSectionDataReady(sectionId, contentItem)) return [];

  return [
    {
      verifier_role: resolveTargetVerifierRole(verifications, sectionId, preferredRole),
      item_key: LINKEDIN_SECTION_ITEM_KEY[sectionId],
      status: "pending",
    },
  ];
}

export const LINKEDIN_HEAD_SECTION_KEYS = ["linkedin_content", "post"] as const;

export async function submitLinkedInSectionsToHead(
  contentId: string,
  submitItem: (contentId: string, payload: { item_key: string }) => Promise<unknown>,
): Promise<void> {
  for (const itemKey of LINKEDIN_HEAD_SECTION_KEYS) {
    try {
      await submitItem(contentId, { item_key: itemKey });
    } catch {
      /* section may not be ready yet */
    }
  }
}

export function linkedInFontsReady(item: {
  font_name?: string | null;
  font_size?: string | null;
  color_codes?: string | null;
}): boolean {
  return Boolean((item.font_name ?? "").trim())
    && Boolean((item.font_size ?? "").trim())
    && Boolean((item.color_codes ?? "").trim());
}
