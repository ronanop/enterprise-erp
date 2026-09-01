import type { MarketingNavAccessInput } from "@/lib/marketing-nav-access";

export type MarketingPersona =
  | "head"
  | "business_owner"
  | "linkedin_handler"
  | "campaign_handler"
  | "creator"
  | "publisher"
  | "video_editor"
  | "default";

export function detectMarketingPersona(
  perms: MarketingNavAccessInput & {
    canVerify?: boolean;
    canChannelUpdate?: boolean;
    canAssetCreate?: boolean;
    canCampaignUpdate?: boolean;
    canCreate?: boolean;
    canApproveBusiness?: boolean;
  },
): MarketingPersona {
  if (perms.canApprove) return "head";
  if (perms.canApproveBusiness && !perms.canApprove) return "business_owner";
  if (perms.canVerify && perms.canChannelUpdate && !perms.canCampaignUpdate) return "linkedin_handler";
  if (perms.canVerify && perms.canCampaignUpdate) return "campaign_handler";
  if (perms.canPublish && !perms.canVerify) return "publisher";
  if (
    perms.canVerify &&
    perms.canAssetCreate &&
    !perms.canChannelUpdate &&
    !perms.canCampaignUpdate &&
    !perms.canCampaignCreate
  ) {
    return "video_editor";
  }
  if (perms.canSubmit || perms.canCreate) return "creator";
  return "default";
}

export function isLinkedInHandler(
  perms: MarketingNavAccessInput & {
    canVerify?: boolean;
    canChannelUpdate?: boolean;
    canCampaignUpdate?: boolean;
    canApprove?: boolean;
  },
): boolean {
  return detectMarketingPersona(perms) === "linkedin_handler";
}

export function isVideoEditor(
  perms: MarketingNavAccessInput & {
    canVerify?: boolean;
    canAssetCreate?: boolean;
    canChannelUpdate?: boolean;
    canCampaignUpdate?: boolean;
    canApprove?: boolean;
  },
): boolean {
  return detectMarketingPersona(perms) === "video_editor";
}

const NAV_LABELS: Partial<Record<MarketingPersona, Partial<Record<string, string>>>> = {
  linkedin_handler: {
    "/marketing/pipeline": "Overview",
    "/marketing/content": "LinkedIn posts",
  },
  video_editor: {
    "/marketing/pipeline": "Overview",
    "/marketing/content": "Video content",
  },
  head: {
    "/marketing/pipeline": "Overview",
    "/marketing/content": "All content",
    "/marketing/approvals": "Approvals",
    "/marketing/campaigns": "Campaigns",
    "/marketing/archive": "Archive",
  },
};

const WORKSPACE_LABELS: Record<MarketingPersona, { section: string; title: string }> = {
  linkedin_handler: { section: "LinkedIn", title: "Post workspace" },
  head: { section: "Marketing", title: "Admin hub" },
  business_owner: { section: "Marketing", title: "Business owner review" },
  campaign_handler: { section: "Marketing", title: "Campaign workspace" },
  creator: { section: "Marketing", title: "Content workspace" },
  publisher: { section: "Marketing", title: "Publishing hub" },
  video_editor: { section: "Marketing", title: "Video workspace" },
  default: { section: "Marketing", title: "Ops hub" },
};

export function marketingNavTitle(href: string, persona: MarketingPersona, defaultTitle: string): string {
  return NAV_LABELS[persona]?.[href] ?? defaultTitle;
}

export function marketingWorkspaceLabels(persona: MarketingPersona) {
  return WORKSPACE_LABELS[persona];
}
