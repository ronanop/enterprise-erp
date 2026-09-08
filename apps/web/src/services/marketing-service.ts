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
  hook?: string | null;
  body: string;
  status: string;
  campaign_id?: string | null;
  scores?: Record<string, number | string | string[]> | null;
  pipeline_result?: {
    variant?: string;
    label?: string;
    lines_to_change?: string[];
  } | null;
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

export type MarketingCampaignDeliverable = {
  id: string;
  campaign_id: string;
  deliverable_code: string;
  title: string;
  deliverable_type: string;
  due_date?: string | null;
  status: string;
  notes?: string | null;
  content_provider_user_id?: string | null;
  content_provider_name?: string | null;
  approval_head_user_id?: string | null;
  approval_head_name?: string | null;
  editor_user_id?: string | null;
  editor_name?: string | null;
};

export type MarketingTeamMember = {
  user_id: string;
  display_name: string;
  email: string;
  role: string;
};

export async function listCampaignDeliverables(
  campaignId: string,
): Promise<MarketingCampaignDeliverable[]> {
  const res = await resourceService.list<MarketingCampaignDeliverable>(
    `/marketing/campaigns/${campaignId}/deliverables`,
  );
  return Array.isArray(res.data) ? res.data : [];
}

export async function listMarketingTeamMembers(): Promise<MarketingTeamMember[]> {
  const res = await resourceService.list<MarketingTeamMember>("/marketing/team-members");
  return Array.isArray(res.data) ? res.data : [];
}

export async function createCampaignDeliverable(
  campaignId: string,
  body: {
    deliverable_type: string;
    due_date: string;
    title?: string;
    notes?: string;
    content_provider_user_id?: string;
    approval_head_user_id?: string;
    editor_user_id?: string;
  },
): Promise<MarketingCampaignDeliverable> {
  const res = await resourceService.create<MarketingCampaignDeliverable>(
    `/marketing/campaigns/${campaignId}/deliverables`,
    body,
  );
  if (!res.data) throw new Error("Deliverable create failed");
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
  description?: string | null;
  task_kind: string;
  execution_mode: string;
  status: string;
  complexity: number;
  estimated_hours?: string | number | null;
  actual_hours?: string | number | null;
  due_at?: string | null;
  is_urgent: boolean;
  campaign_id?: string | null;
  parent_task_id?: string | null;
  content_request_id?: string | null;
  owner_user_id?: string | null;
  assignee_user_id?: string | null;
  reviewer_user_id?: string | null;
  metadata_json?: {
    is_deliverable?: boolean;
    deliverable_type?: string;
    content_provider_user_id?: string;
    content_provider_name?: string;
    approval_head_user_id?: string;
    approval_head_name?: string;
    editor_user_id?: string;
    editor_name?: string;
    content_url?: string | null;
    external_link?: string | null;
    document_name?: string | null;
    submission_notes?: string | null;
    submission_status?: string | null;
    submission_kind?: "link" | "file" | string | null;
    file_storage_path?: string | null;
    improvement_comment?: string | null;
  } | null;
};

export type MarketingContentReviewItem = {
  id: string;
  request_code: string;
  topic: string;
  content_type: string;
  status: string;
  campaign_id?: string | null;
  content_id?: string | null;
  content_status?: string | null;
  content_url?: string | null;
  document_name?: string | null;
  submission_notes?: string | null;
  deliverable_task_id?: string | null;
  improvement_comment?: string | null;
  due_at?: string | null;
  submission_kind?: "link" | "file" | string | null;
  external_link?: string | null;
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
  const res = await resourceService.list<MarketingTask>("/marketing/tasks", {
    mine,
    page_size: 200,
  });
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

export async function submitDeliverableContent(
  taskId: string,
  body: {
    content_url?: string;
    document_name?: string;
    notes?: string;
    content_base64?: string;
    content_type?: string;
    file_name?: string;
  },
): Promise<MarketingTask> {
  const res = await apiClient<MarketingTask>(`/marketing/tasks/${taskId}/submit-content`, {
    method: "POST",
    body,
  });
  if (!res.data) throw new Error("Content submit failed");
  return res.data;
}

export function deliverableSubmissionFileUrl(taskId: string): string {
  return `/marketing/tasks/${taskId}/submission-file`;
}

export async function listContentReviewQueue(): Promise<MarketingContentReviewItem[]> {
  const res = await resourceService.list<MarketingContentReviewItem>(
    "/marketing/content-requests/review-queue",
  );
  return Array.isArray(res.data) ? res.data : [];
}

export async function reviewContentRequest(
  requestId: string,
  body: { action: "approve" | "reject" | "improve"; comment?: string },
): Promise<MarketingContentReviewItem> {
  const res = await apiClient<MarketingContentReviewItem>(
    `/marketing/content-requests/${requestId}/review`,
    { method: "POST", body },
  );
  if (!res.data) throw new Error("Review failed");
  return res.data;
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

export type MarketingCalendarEntry = {
  id: string;
  company_id: string;
  campaign_id?: string | null;
  content_id?: string | null;
  platform_id?: string | null;
  social_account_id?: string | null;
  title: string;
  notes?: string | null;
  scheduled_at: string;
  status: string;
  version: number;
};

export type CampaignHome = {
  campaign: MarketingCampaign & {
    objective?: string | null;
    budget_amount?: string | number | null;
    currency_code?: string | null;
    owner_user_id?: string | null;
    success_metrics?: Record<string, unknown> | null;
  };
  content: MarketingGeneratedContent[];
  requests: MarketingContentRequest[];
  calendar: Array<{
    id: string;
    title: string;
    scheduled_at: string;
    status: string;
    content_id?: string | null;
  }>;
  approvals: Array<{
    id: string;
    action: string;
    comment?: string | null;
    approval_level: number;
  }>;
  tasks: Array<{ id: string; title: string; status: string; task_code: string }>;
  assets: Array<{ id: string; file_name: string; folder_path: string; web_url?: string | null; status: string }>;
  inbox: Array<{ id: string; author_name: string; body: string; status: string; kind: string }>;
  health: Record<string, number>;
};

export async function loadCampaignHome(campaignId: string): Promise<CampaignHome> {
  const res = await apiClient<CampaignHome>(`/marketing/campaigns/${campaignId}/home`, { method: "GET" });
  if (!res.data) throw new Error("Campaign home failed");
  return res.data;
}

export async function submitGeneratedContent(contentId: string): Promise<MarketingGeneratedContent> {
  const res = await apiClient<MarketingGeneratedContent>(`/marketing/content/${contentId}/submit`, {
    method: "POST",
  });
  if (!res.data) throw new Error("Submit failed");
  return res.data;
}

export async function approveGeneratedContent(contentId: string): Promise<MarketingGeneratedContent> {
  const res = await apiClient<MarketingGeneratedContent>(`/marketing/content/${contentId}/approve`, {
    method: "POST",
  });
  if (!res.data) throw new Error("Approve failed");
  return res.data;
}

export async function reviseGeneratedContent(
  contentId: string,
  comment: string,
): Promise<MarketingGeneratedContent> {
  const res = await apiClient<MarketingGeneratedContent>(`/marketing/content/${contentId}/revise`, {
    method: "POST",
    body: { comment },
  });
  if (!res.data) throw new Error("Revision failed");
  return res.data;
}

export async function createWeekSlots(body: {
  content_id: string;
  start_at: string;
  social_account_id?: string;
  campaign_id?: string;
}): Promise<MarketingCalendarEntry[]> {
  const res = await apiClient<MarketingCalendarEntry[]>("/marketing/calendar/week-slots", {
    method: "POST",
    body,
  });
  return Array.isArray(res.data) ? res.data : [];
}

export type SocialInboxItem = {
  id: string;
  campaign_id?: string | null;
  author_name: string;
  body: string;
  kind: string;
  status: string;
  platform_code: string;
  assignee_user_id?: string | null;
};

export async function listSocialInbox(campaignId?: string): Promise<SocialInboxItem[]> {
  const query = campaignId ? `?campaign_id=${campaignId}` : "";
  const res = await apiClient<SocialInboxItem[]>(`/marketing/inbox${query}`, { method: "GET" });
  return Array.isArray(res.data) ? res.data : [];
}

export async function syncSocialInbox(): Promise<{ created: number; live_posts: number }> {
  const res = await apiClient<{ created: number; live_posts: number }>("/marketing/inbox/sync", {
    method: "POST",
  });
  return res.data ?? { created: 0, live_posts: 0 };
}

export async function completeInboxItem(id: string): Promise<SocialInboxItem> {
  const res = await apiClient<SocialInboxItem>(`/marketing/inbox/${id}/done`, { method: "POST" });
  if (!res.data) throw new Error("Inbox update failed");
  return res.data;
}

export type BrandKitRecord = {
  id: string;
  voice_name: string;
  description?: string | null;
  guidelines?: string | null;
  tone_keywords?: { keywords?: string[] } | null;
  brand_kit?: {
    wordmark?: string;
    logo_url?: string;
    logo_data_url?: string;
    logos?: Array<{
      name: string;
      usage: string;
      background: string;
      logo_url?: string;
      logo_data_url?: string;
      is_primary?: boolean;
    }>;
    usage_notes?: string;
    colors?: Array<{ name: string; role: string; hex: string }>;
    fonts?: Array<{ role: string; family: string; weight: string }>;
  } | null;
  status: string;
};

export async function loadBrandKit(): Promise<BrandKitRecord> {
  const res = await apiClient<BrandKitRecord>("/marketing/brand-voices/kit", { method: "GET" });
  if (!res.data) throw new Error("Brand kit load failed");
  return res.data;
}

export async function saveBrandKit(body: {
  voice_name?: string;
  description?: string;
  guidelines?: string;
  tone_keywords?: { keywords: string[] };
  brand_kit: BrandKitRecord["brand_kit"];
}): Promise<BrandKitRecord> {
  const res = await apiClient<BrandKitRecord>("/marketing/brand-voices/kit", {
    method: "PUT",
    body,
  });
  if (!res.data) throw new Error("Brand kit save failed");
  return res.data;
}

export async function listMarketingCalendar(): Promise<MarketingCalendarEntry[]> {
  const res = await resourceService.list<MarketingCalendarEntry>("/marketing/calendar", {
    page_size: 200,
  });
  return Array.isArray(res.data) ? res.data : [];
}

export async function createMarketingCalendarEntry(body: {
  title: string;
  scheduled_at: string;
  notes?: string;
  status?: string;
  campaign_id?: string;
  content_id?: string;
  social_account_id?: string;
}): Promise<MarketingCalendarEntry> {
  const res = await resourceService.create<MarketingCalendarEntry>("/marketing/calendar", body);
  if (!res.data) throw new Error("Calendar entry create failed");
  return res.data;
}

export async function updateMarketingCalendarEntry(
  id: string,
  body: {
    title?: string;
    notes?: string;
    scheduled_at?: string;
    status?: string;
    version?: number;
  },
): Promise<MarketingCalendarEntry> {
  const res = await resourceService.update<MarketingCalendarEntry>(
    "/marketing/calendar",
    id,
    body,
  );
  if (!res.data) throw new Error("Calendar entry update failed");
  return res.data;
}
