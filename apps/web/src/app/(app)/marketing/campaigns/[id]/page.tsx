"use client";

import { useParams } from "next/navigation";

import { MarketingCampaignHome } from "@/components/marketing/marketing-campaign-home";

export default function Page() {
  const params = useParams<{ id: string }>();
  return <MarketingCampaignHome campaignId={params.id} />;
}
