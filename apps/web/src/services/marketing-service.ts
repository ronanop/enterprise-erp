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

export type MarketingTask = {
  id: string;
  task_code: string;
  title: string;
  task_kind: string;
  execution_mode: string;
  status: string;
  complexity: number;
  estimated_hours?: string | number | null;
  actual_hours?: string | number | null;
  is_urgent: boolean;
  campaign_id?: string | null;
  parent_task_id?: string | null;
};

export type WorkloadOverview = {
  company: {
    active_tasks: number;
    pending_reviews: number;
    delayed_tasks: number;
    workload_score: number;
    utilization_pct: number;
  };
  me: {
    active_tasks: number;
    pending_reviews: number;
    delayed_tasks: number;
    workload_score: number;
    utilization_pct: number;
    completed_tasks: number;
    actual_hours: number;
  };
  people: Array<{
    user_id: string;
    workload_score: number;
    utilization_pct: number;
    reassignment: string;
    active_tasks: number;
  }>;
  overloaded: Array<{ user_id: string; workload_score: number }>;
  underutilized: Array<{ user_id: string; workload_score: number }>;
  campaign_health: Array<{
    campaign_id: string;
    campaign_name: string;
    status: string;
    delayed: number;
    task_count: number;
    completed: number;
    priority?: string;
  }>;
};

export type M365Workspace = {
  id: string;
  campaign_id: string;
  display_name: string;
  provision_status: string;
  last_error?: string | null;
  folder_structure?: { folders?: string[] } | null;
};

export type M365File = {
  id: string;
  file_name: string;
  folder_path: string;
  storage_tier: string;
  status: string;
  version_label: string;
};

export async function listMarketingTasks(mine = false): Promise<MarketingTask[]> {
  const res = await resourceService.list<MarketingTask>("/marketing/tasks", mine ? { mine: true } : undefined);
  return Array.isArray(res.data) ? res.data : [];
}

export async function createMarketingTask(body: {
  title: string;
  task_kind?: string;
  estimated_hours?: number;
  is_urgent?: boolean;
  parent_task_id?: string;
}): Promise<MarketingTask> {
  const res = await resourceService.create<MarketingTask>("/marketing/tasks", body);
  if (!res.data) throw new Error("Task create failed");
  return res.data;
}

export async function executeMarketingTask(id: string) {
  return apiClient<MarketingTask>(`/marketing/tasks/${id}/execute`, { method: "POST" });
}

export async function loadWorkloadOverview(): Promise<WorkloadOverview> {
  const res = await apiClient<WorkloadOverview>("/marketing/workload/overview", { method: "GET" });
  return (
    res.data ?? {
      company: {
        active_tasks: 0,
        pending_reviews: 0,
        delayed_tasks: 0,
        workload_score: 0,
        utilization_pct: 0,
      },
      me: {
        active_tasks: 0,
        pending_reviews: 0,
        delayed_tasks: 0,
        workload_score: 0,
        utilization_pct: 0,
        completed_tasks: 0,
        actual_hours: 0,
      },
      people: [],
      overloaded: [],
      underutilized: [],
      campaign_health: [],
    }
  );
}

export async function listM365Workspaces(): Promise<M365Workspace[]> {
  const res = await resourceService.list<M365Workspace>("/marketing/m365/workspaces");
  return Array.isArray(res.data) ? res.data : [];
}

export async function listM365Files(): Promise<M365File[]> {
  const res = await resourceService.list<M365File>("/marketing/m365/files");
  return Array.isArray(res.data) ? res.data : [];
}

export async function registerM365File(file_name: string) {
  return resourceService.create<M365File>("/marketing/m365/files", {
    file_name,
    storage_tier: "onedrive",
    folder_path: "/Content",
  });
}

export async function aiImprove(text: string, mode: string) {
  return apiClient("/marketing/ai/improve", { method: "POST", body: JSON.stringify({ text, mode }) });
}

export async function aiReview(text: string) {
  return apiClient("/marketing/ai/review", { method: "POST", body: JSON.stringify({ text, mode: "review" }) });
}

export async function aiCreative(topic: string) {
  return apiClient("/marketing/ai/creative", { method: "POST", body: JSON.stringify({ topic }) });
}

export async function aiVideo(topic: string) {
  return apiClient("/marketing/ai/video", { method: "POST", body: JSON.stringify({ topic }) });
}
