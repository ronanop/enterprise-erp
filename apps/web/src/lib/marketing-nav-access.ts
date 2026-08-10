/** Nav and dashboard visibility rules for marketing RBAC. */

export type MarketingNavAccessInput = {
  canReadContent: boolean;
  canReadCampaign: boolean;
  canReadChannel: boolean;
  canReadPublication: boolean;
  canReadAsset: boolean;
  canReadReport: boolean;
  canCreate: boolean;
  canSubmit: boolean;
  canSchedule: boolean;
  canPublish: boolean;
  canArchive: boolean;
  canApproveMedia: boolean;
  canApprove: boolean;
  canCampaignCreate: boolean;
  canCampaignUpdate: boolean;
  canCampaignActivate: boolean;
};

export function canAccessMarketingCampaigns(perms: MarketingNavAccessInput): boolean {
  return (
    perms.canCampaignCreate ||
    perms.canCampaignUpdate ||
    perms.canCampaignActivate ||
    perms.canApprove
  );
}

export function canAccessMarketingCalendar(perms: MarketingNavAccessInput): boolean {
  return perms.canReadContent && (perms.canSchedule || perms.canPublish);
}

export function canAccessMarketingChannels(perms: MarketingNavAccessInput): boolean {
  return (
    perms.canReadChannel &&
    (perms.canChannelCreate ||
      perms.canChannelUpdate ||
      perms.canPublish ||
      perms.canSchedule ||
      perms.canApprove)
  );
}

export function canAccessMarketingApprovals(perms: MarketingNavAccessInput): boolean {
  return perms.canApproveMedia || perms.canApprove;
}

export function canShowMarketingNavHref(href: string, perms: MarketingNavAccessInput): boolean {
  switch (href) {
    case "/marketing":
    case "/marketing/pipeline":
    case "/marketing/workflow":
      return true;
    case "/marketing/campaigns":
      return canAccessMarketingCampaigns(perms);
    case "/marketing/content":
      return perms.canReadContent;
    case "/marketing/calendar":
      return canAccessMarketingCalendar(perms);
    case "/marketing/channels":
      return canAccessMarketingChannels(perms);
    case "/marketing/publish-log":
      return perms.canReadPublication;
    case "/marketing/approvals":
      return canAccessMarketingApprovals(perms);
    case "/marketing/archive":
      return perms.canArchive;
    case "/marketing/assets":
      return perms.canReadAsset;
    case "/marketing/reports":
      return perms.canReadReport;
    default:
      return true;
  }
}

export type DashboardStatKey =
  | "active_campaigns"
  | "draft_content"
  | "in_review_content"
  | "scheduled_content"
  | "published_this_month"
  | "active_channels";

export function canShowDashboardStat(key: DashboardStatKey, perms: MarketingNavAccessInput): boolean {
  switch (key) {
    case "active_campaigns":
      return canAccessMarketingCampaigns(perms);
    case "draft_content":
      return perms.canReadContent && perms.canCreate;
    case "in_review_content":
      return (
        perms.canSubmit ||
        perms.canApproveMedia ||
        perms.canApprove ||
        perms.canPublish
      );
    case "scheduled_content":
      return canAccessMarketingCalendar(perms);
    case "published_this_month":
      return perms.canReadPublication;
    case "active_channels":
      return canAccessMarketingChannels(perms);
    default:
      return true;
  }
}
