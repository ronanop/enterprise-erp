"use client";

import { useCallback, useMemo } from "react";

import {
  canAccessMarketingApprovals,
  canAccessMarketingCalendar,
  canAccessMarketingCampaigns,
  canAccessMarketingChannels,
  canShowDashboardStat,
  canShowMarketingNavHref,
  type DashboardStatKey,
  type MarketingNavAccessInput,
} from "@/lib/marketing-nav-access";
import { useUserPermissions } from "@/hooks/use-user-permissions";

/** Strict marketing RBAC — never assumes access when permissions are unknown. */
export function useMarketingPermissions() {
  const { user, profile, loading } = useUserPermissions();

  const perms = profile?.permissions ?? [];

  const has = useCallback(
    (code: string) => {
      if (!perms.length) return false;
      return perms.includes(code) || perms.includes("*");
    },
    [perms],
  );

  return useMemo(() => {
    const flags: MarketingNavAccessInput = {
      canReadContent: has("marketing.content:read"),
      canReadCampaign: has("marketing.campaign:read"),
      canReadChannel: has("marketing.channel:read"),
      canReadPublication: has("marketing.publication:read"),
      canReadAsset: has("marketing.asset:read"),
      canReadReport: has("marketing.report:read"),
      canCreate: has("marketing.content:create"),
      canUpdate: has("marketing.content:update"),
      canSubmit: has("marketing.content:submit"),
      canApproveMedia: has("marketing.content:approve_media"),
      canApprove: has("marketing.content:approve"),
      canPublish: has("marketing.content:publish"),
      canArchive: has("marketing.content:archive"),
      canSchedule: has("marketing.content:schedule"),
      canCampaignCreate: has("marketing.campaign:create"),
      canCampaignUpdate: has("marketing.campaign:update"),
      canCampaignActivate: has("marketing.campaign:activate"),
      canChannelCreate: has("marketing.channel:create"),
      canChannelUpdate: has("marketing.channel:update"),
      canAssetCreate: has("marketing.asset:create"),
      canAssetUpdate: has("marketing.asset:update"),
      canVerify: has("marketing.content:verify"),
      canReportPosting: has("marketing.content:submit") || has("marketing.content:publish"),
    };

    return {
      loading,
      user,
      userId: profile?.id ?? (user && "user" in user ? (user.user as { id?: string })?.id : null) ?? null,
      ...flags,
      canAccessCampaigns: canAccessMarketingCampaigns(flags),
      canAccessCalendar: canAccessMarketingCalendar(flags),
      canAccessChannels: canAccessMarketingChannels(flags),
      canAccessApprovals: canAccessMarketingApprovals(flags),
      canShowNav: (href: string) => canShowMarketingNavHref(href, flags),
      canShowStat: (key: DashboardStatKey) => canShowDashboardStat(key, flags),
    };
  }, [loading, user, profile, has]);
}
