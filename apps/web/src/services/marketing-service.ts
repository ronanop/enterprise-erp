import { apiClient, resourceService } from "@/services/api-client";

export type MarketingOverview = {
  campaigns_total: number;
  campaigns_active: number;
  content_requests_total: number;
  content_drafts: number;
  content_approved: number;
  calendar_upcoming: number;
  publish_pending: number;
  brand_voices: number;
  competitors: number;
  research_reports: number;
};

export type MarketingCampaign = {
  id: string;
  campaign_code: string;
  campaign_name: string;
  campaign_type: string;
  status: string;
  start_date?: string | null;
  end_date?: string | null;
};

export type MarketingContentRequest = {
  id: string;
  request_code: string;
  topic: string;
  content_type: string;
  status: string;
  platform_id?: string | null;
};

export type MarketingGeneratedContent = {
  id: string;
  headline?: string | null;
  body: string;
  status: string;
  scores?: Record<string, number | string | string[]> | null;
  content_request_id: string;
};

export async function loadMarketingOverview(): Promise<MarketingOverview> {
  const res = await apiClient<MarketingOverview>("/marketing/analytics/overview", {
    method: "GET",
  });
  return (
    res.data ?? {
      campaigns_total: 0,
      campaigns_active: 0,
      content_requests_total: 0,
      content_drafts: 0,
      content_approved: 0,
      calendar_upcoming: 0,
      publish_pending: 0,
      brand_voices: 0,
      competitors: 0,
      research_reports: 0,
    }
  );
}

export async function listMarketingCampaigns(): Promise<MarketingCampaign[]> {
  const res = await resourceService.list<MarketingCampaign>("/marketing/campaigns");
  return Array.isArray(res.data) ? res.data : [];
}

export async function createMarketingCampaign(body: {
  campaign_name: string;
  campaign_type?: string;
  objective?: string;
}): Promise<MarketingCampaign> {
  const res = await resourceService.create<MarketingCampaign>("/marketing/campaigns", body);
  if (!res.data) throw new Error("Campaign create failed");
  return res.data;
}

export async function listContentRequests(): Promise<MarketingContentRequest[]> {
  const res = await resourceService.list<MarketingContentRequest>("/marketing/content-requests");
  return Array.isArray(res.data) ? res.data : [];
}

export async function createContentRequest(body: {
  topic: string;
  content_type?: string;
  tone?: string;
  platform_id?: string;
  campaign_id?: string;
  brand_voice_id?: string;
  generate_now?: boolean;
}): Promise<MarketingContentRequest> {
  const res = await resourceService.create<MarketingContentRequest>(
    "/marketing/content-requests",
    body,
  );
  if (!res.data) throw new Error("Content request create failed");
  return res.data;
}

export async function listGeneratedContent(): Promise<MarketingGeneratedContent[]> {
  const res = await resourceService.list<MarketingGeneratedContent>("/marketing/content");
  return Array.isArray(res.data) ? res.data : [];
}

export async function createResearch(topic: string) {
  return resourceService.create("/marketing/research", { topic });
}

export async function createTrend(topic: string) {
  return resourceService.create("/marketing/trends", { topic });
}

export async function listPlatforms() {
  const res = await resourceService.list<{
    id: string;
    platform_code: string;
    platform_name: string;
  }>("/marketing/platforms");
  return Array.isArray(res.data) ? res.data : [];
}
