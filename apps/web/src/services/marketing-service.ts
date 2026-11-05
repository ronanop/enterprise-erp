import { apiClient, apiUpload, resourceService } from "@/services/api-client";

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
    kind?: string;
    variant?: string;
    parent_content_id?: string;
    label?: string;
    lines_to_change?: string[];
    prompt?: string;
    size?: string;
    platform?: string | null;
    image_relpath?: string;
    creative?: {
      category_id?: string;
      category_label?: string;
      format_id?: string;
      format_label?: string;
      width_px?: number;
      height_px?: number;
      inches?: string;
      cms?: string;
    } | null;
    cost?: {
      usd?: number;
      total_tokens?: number;
      source?: string;
      text_input_tokens?: number;
      image_output_tokens?: number;
    } | null;
    canva?: {
      mode?: string;
      canva_asset_id?: string;
      canva_design_id?: string;
      canva_edit_url?: string;
      canva_view_url?: string;
      fallback_reason?: string;
    } | null;
  } | null;
  content_request_id: string;
  ai_model?: string | null;
};

export type ImagePostProviders = {
  openai_configured: boolean;
  canva_configured: boolean;
  canva_connected: boolean;
  canva_scopes: string;
  sizes: string[];
  qualities?: string[];
  default_quality?: string;
};

export type ImageSpendBucket = {
  usd: number;
  tokens: number;
  image_count: number;
};

export type ImageSpendFx = {
  usd_inr: number;
  as_of?: string | null;
  source?: string;
  provider?: string;
  provider_url?: string | null;
};

export type ImageSpendSummary = {
  currency: string;
  today: ImageSpendBucket;
  last_7_days: ImageSpendBucket;
  last_image: {
    content_id?: string | null;
    created_at?: string | null;
    usd: number;
    tokens: number;
    text_input_tokens?: number;
    image_output_tokens?: number;
    source?: string | null;
    model?: string | null;
    size?: string | null;
    quality?: string | null;
  };
  rates: {
    text_input_per_m: number;
    image_input_per_m: number;
    image_output_per_m: number;
  };
  fx?: ImageSpendFx | null;
};

export type EditInCanvaResult = {
  content: MarketingGeneratedContent;
  canva_edit_url: string;
  mode?: string | null;
  canva_design_id?: string | null;
  fallback_reason?: string | null;
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
  approval_head_user_ids?: string[];
  approval_head_names?: string[];
  editor_user_id?: string | null;
  editor_name?: string | null;
  self_checked?: boolean;
  review_annotations?: Array<{
    id: string;
    kind: string;
    body: string;
    x?: number | null;
    y?: number | null;
    at_seconds?: number | null;
    created_by?: string | null;
    created_at?: string;
  }>;
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
    approval_head_user_ids?: string[];
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

export async function createChannelProgram(body: {
  name: string;
  channel: string;
  deliverable_type?: string;
  start_date: string;
  days?: number;
  content_provider_user_id?: string;
  editor_user_id?: string;
  approval_head_user_ids?: string[];
}): Promise<{
  campaign_id: string;
  campaign_name: string;
  channel: string;
  days: number;
  deliverables: MarketingCampaignDeliverable[];
}> {
  const res = await apiClient<{
    campaign_id: string;
    campaign_name: string;
    channel: string;
    days: number;
    deliverables: MarketingCampaignDeliverable[];
  }>("/marketing/campaigns/channel-programs", { method: "POST", body });
  if (!res.data) throw new Error("Channel program create failed");
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

export async function loadImagePostProviders(): Promise<ImagePostProviders> {
  const res = await apiClient<ImagePostProviders>("/marketing/image-posts/providers", {
    method: "GET",
  });
  return (
    res.data ?? {
      openai_configured: false,
      canva_configured: false,
      canva_connected: false,
      canva_scopes: "",
      sizes: ["1024x1024", "1024x1536", "1536x1024"],
      qualities: ["low", "medium", "high", "xhigh", "max", "auto"],
      default_quality: "low",
    }
  );
}

export async function loadImagePostUsage(options?: {
  refreshFx?: boolean;
}): Promise<ImageSpendSummary> {
  const qs = options?.refreshFx ? "?refresh_fx=true" : "";
  const res = await apiClient<ImageSpendSummary>(`/marketing/image-posts/usage${qs}`, {
    method: "GET",
  });
  return (
    res.data ?? {
      currency: "USD",
      today: { usd: 0, tokens: 0, image_count: 0 },
      last_7_days: { usd: 0, tokens: 0, image_count: 0 },
      last_image: { usd: 0, tokens: 0 },
      rates: {
        text_input_per_m: 5,
        image_input_per_m: 8,
        image_output_per_m: 30,
      },
    }
  );
}

export async function listImagePosts(): Promise<MarketingGeneratedContent[]> {
  const res = await apiClient<MarketingGeneratedContent[]>("/marketing/image-posts", {
    method: "GET",
    query: { page: 1, page_size: 100 },
  });
  return Array.isArray(res.data) ? res.data : [];
}

export async function generateImagePost(body: {
  prompt: string;
  size?: string;
  quality?: string;
  platform?: string;
  campaign_id?: string;
  creative?: {
    category_id?: string;
    category_label?: string;
    format_id?: string;
    format_label?: string;
    width_px?: number;
    height_px?: number;
    inches?: string;
    cms?: string;
  };
}): Promise<MarketingGeneratedContent> {
  const res = await apiClient<MarketingGeneratedContent>("/marketing/image-posts", {
    method: "POST",
    body,
  });
  if (!res.data) throw new Error("Image post generation failed");
  return res.data;
}

export async function getCanvaAuthorizeUrl(returnTo = "/marketing/content"): Promise<{
  authorize_url: string;
  state: string;
}> {
  const res = await apiClient<{ authorize_url: string; state: string }>(
    "/marketing/image-posts/canva/authorize",
    { method: "GET", query: { return_to: returnTo } },
  );
  if (!res.data?.authorize_url) throw new Error("Canva authorize URL missing");
  return res.data;
}

export async function exchangeCanvaCode(body: {
  code: string;
  state: string;
}): Promise<{ connected: boolean; return_to: string }> {
  const res = await apiClient<{ connected: boolean; return_to: string; user_id: string }>(
    "/marketing/image-posts/canva/exchange",
    { method: "POST", body },
  );
  if (!res.data) throw new Error("Canva connect failed");
  return res.data;
}

export async function editImagePostInCanva(contentId: string): Promise<EditInCanvaResult> {
  const res = await apiClient<EditInCanvaResult>(
    `/marketing/image-posts/${contentId}/edit-in-canva`,
    { method: "POST" },
  );
  if (!res.data?.canva_edit_url) throw new Error("Edit in Canva failed");
  return res.data;
}

/** Same-origin path for authenticated image preview (cookies via Next rewrite). */
export function imagePostFilePath(contentId: string): string {
  return `/api/v1/marketing/image-posts/${contentId}/file`;
}

/** ChatGPT-style edit: new version from an existing image; original is kept. */
export async function repurposeImagePost(
  contentId: string,
  body: { prompt: string; size?: string; quality?: string },
): Promise<MarketingGeneratedContent> {
  const res = await apiClient<MarketingGeneratedContent>(
    `/marketing/image-posts/${contentId}/repurpose`,
    { method: "POST", body },
  );
  if (!res.data) throw new Error("Repurpose failed");
  return res.data;
}

export type MarketingChatProviders = {
  openai_configured: boolean;
  image_generation_configured?: boolean;
  default_model: string;
  max_attachments?: number;
  allowed_image_types?: string[];
  allowed_document_types?: string[];
};

export type MarketingChatSession = {
  id: string;
  title: string;
  status: string;
  message_count: number;
  last_message_at?: string | null;
  last_model?: string | null;
  settings_json?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type MarketingChatAttachment = {
  id: string;
  session_id: string;
  message_id?: string | null;
  kind: "image" | "document" | "generated_image" | string;
  status: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  created_at?: string | null;
};

export type MarketingChatMessage = {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system" | string;
  content: string;
  sequence_no: number;
  model?: string | null;
  usage_json?: Record<string, unknown> | null;
  meta_json?: Record<string, unknown> | null;
  attachments?: MarketingChatAttachment[];
  created_at?: string | null;
};

export type MarketingChatSendResult = {
  session: MarketingChatSession;
  user_message: MarketingChatMessage;
  assistant_message: MarketingChatMessage;
};

export type MarketingChatSettingsPayload = {
  provider?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  ragEnabled?: boolean;
  ragSource?: string;
  ragTopK?: number;
  ragMinScore?: number;
  ragIndexHint?: string;
  brandKitEnabled?: boolean;
  brandKitIncludeVoice?: boolean;
  brandKitIncludeColors?: boolean;
  brandKitIncludeLogoRules?: boolean;
  brandKitVoiceId?: string;
};

export type ChatSpendBucket = {
  usd: number;
  tokens: number;
  message_count: number;
};

export type ChatSpendFx = {
  usd_inr: number;
  as_of?: string | null;
  source?: string;
  provider?: string;
  provider_url?: string | null;
};

export type ChatSpendSummary = {
  currency: string;
  today: ChatSpendBucket;
  last_7_days: ChatSpendBucket;
  last_reply: {
    message_id?: string | null;
    session_id?: string | null;
    created_at?: string | null;
    usd: number;
    tokens: number;
    prompt_tokens?: number;
    completion_tokens?: number;
    source?: string | null;
    model?: string | null;
    kind?: string | null;
  };
  rates: {
    input_per_m: number;
    output_per_m: number;
  };
  fx?: ChatSpendFx | null;
};

export async function loadMarketingChatProviders(): Promise<MarketingChatProviders> {
  const res = await apiClient<MarketingChatProviders>("/marketing/chat/providers", {
    method: "GET",
  });
  return (
    res.data ?? {
      openai_configured: false,
      default_model: "gpt-4o-mini",
    }
  );
}

export async function loadMarketingChatUsage(options?: {
  refreshFx?: boolean;
}): Promise<ChatSpendSummary> {
  const qs = options?.refreshFx ? "?refresh_fx=true" : "";
  const res = await apiClient<ChatSpendSummary>(`/marketing/chat/usage${qs}`, {
    method: "GET",
  });
  return (
    res.data ?? {
      currency: "USD",
      today: { usd: 0, tokens: 0, message_count: 0 },
      last_7_days: { usd: 0, tokens: 0, message_count: 0 },
      last_reply: { usd: 0, tokens: 0 },
      rates: { input_per_m: 0.15, output_per_m: 0.6 },
    }
  );
}

export async function listMarketingChatSessions(): Promise<MarketingChatSession[]> {
  const res = await apiClient<MarketingChatSession[]>("/marketing/chat/sessions", {
    method: "GET",
  });
  return Array.isArray(res.data) ? res.data : [];
}

export async function createMarketingChatSession(body?: {
  title?: string;
  settings?: MarketingChatSettingsPayload;
}): Promise<MarketingChatSession> {
  const res = await apiClient<MarketingChatSession>("/marketing/chat/sessions", {
    method: "POST",
    body: body ?? {},
  });
  if (!res.data) throw new Error("Failed to create chat session");
  return res.data;
}

export async function renameMarketingChatSession(
  sessionId: string,
  title: string,
): Promise<MarketingChatSession> {
  const res = await apiClient<MarketingChatSession>(`/marketing/chat/sessions/${sessionId}`, {
    method: "PATCH",
    body: { title },
  });
  if (!res.data) throw new Error("Failed to rename chat session");
  return res.data;
}

export async function deleteMarketingChatSession(sessionId: string): Promise<void> {
  await apiClient<null>(`/marketing/chat/sessions/${sessionId}`, {
    method: "DELETE",
  });
}

export async function listMarketingChatMessages(
  sessionId: string,
): Promise<MarketingChatMessage[]> {
  const res = await apiClient<MarketingChatMessage[]>(
    `/marketing/chat/sessions/${sessionId}/messages`,
    { method: "GET" },
  );
  return Array.isArray(res.data) ? res.data : [];
}

export async function sendMarketingChatMessage(
  sessionId: string,
  body: {
    content: string;
    settings?: MarketingChatSettingsPayload;
    attachment_ids?: string[];
    generate_image?: boolean;
    image_size?: string;
    image_quality?: string;
  },
): Promise<MarketingChatSendResult> {
  const res = await apiClient<MarketingChatSendResult>(
    `/marketing/chat/sessions/${sessionId}/messages`,
    { method: "POST", body },
  );
  if (!res.data?.assistant_message) throw new Error("Chat reply failed");
  return res.data;
}

export async function uploadMarketingChatAttachment(
  sessionId: string,
  file: File,
): Promise<MarketingChatAttachment> {
  const form = new FormData();
  form.append("file", file);
  const res = await apiUpload<MarketingChatAttachment>(
    `/marketing/chat/sessions/${sessionId}/attachments`,
    form,
  );
  if (!res.data?.id) throw new Error("Attachment upload failed");
  return res.data;
}

/** Same-origin path for authenticated chat file preview (cookies via Next rewrite). */
export function marketingChatAttachmentFilePath(attachmentId: string): string {
  return `/api/v1/marketing/chat/attachments/${attachmentId}/file`;
}

export type MarketingChatFromImagePostResult = {
  session: MarketingChatSession;
  attachment: MarketingChatAttachment;
  suggested_prompt?: string | null;
};

/** Start a ChatGPT session with a Content Studio image already attached. */
export async function openImagePostInMarketingChat(
  contentId: string,
  settings?: MarketingChatSettingsPayload,
): Promise<MarketingChatFromImagePostResult> {
  const res = await apiClient<MarketingChatFromImagePostResult>("/marketing/chat/from-image-post", {
    method: "POST",
    body: {
      content_id: contentId,
      ...(settings ? { settings } : {}),
    },
  });
  if (!res.data?.session?.id || !res.data.attachment?.id) {
    throw new Error("Could not open image in chat");
  }
  return res.data;
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
    approval_head_user_ids?: string[];
    approval_head_names?: string[];
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
    rejection_reason?: string | null;
  } | null;
};

export type MarketingReviewAnnotation = {
  id: string;
  kind: string;
  body: string;
  x?: number | null;
  y?: number | null;
  at_seconds?: number | null;
  created_by?: string | null;
  created_at?: string;
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
  self_checked?: boolean;
  approval_head_user_ids?: string[];
  review_annotations?: MarketingReviewAnnotation[];
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
    checklist_pct?: number;
    duration_hours?: number;
  };
  people: Array<{
    user_id: string;
    display_name?: string;
    workload_score: number;
    utilization_pct: number;
    reassignment: string;
    active_tasks: number;
    completed_tasks?: number;
    checklist_pct?: number;
    duration_hours?: number;
    delayed_tasks?: number;
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
  team_checklist?: Array<{
    user_id: string;
    display_name: string;
    completed: number;
    active: number;
    checklist_pct: number;
    duration_hours: number;
    delayed: number;
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
    self_checked?: boolean;
    approval_head_user_ids?: string[];
  },
): Promise<MarketingTask> {
  const res = await apiClient<MarketingTask>(`/marketing/tasks/${taskId}/submit-content`, {
    method: "POST",
    body,
  });
  if (!res.data) throw new Error("Content submit failed");
  return res.data;
}

export async function reviewDeliverableTask(
  taskId: string,
  body: { action: "approve" | "reject"; comment?: string },
): Promise<MarketingTask> {
  const res = await apiClient<MarketingTask>(`/marketing/tasks/${taskId}/review`, {
    method: "POST",
    body,
  });
  if (!res.data) throw new Error("Review failed");
  return res.data;
}

export async function delegateMarketingTask(
  taskId: string,
  assigneeUserId: string,
): Promise<MarketingTask> {
  const res = await apiClient<MarketingTask>(`/marketing/tasks/${taskId}/delegate`, {
    method: "POST",
    body: { assignee_user_id: assigneeUserId },
  });
  if (!res.data) throw new Error("Delegate failed");
  return res.data;
}

export async function addDeliverableAnnotation(
  taskId: string,
  body: {
    kind: "image_mark" | "video_timestamp" | "text";
    body: string;
    x?: number;
    y?: number;
    at_seconds?: number;
  },
): Promise<MarketingTask> {
  const res = await apiClient<MarketingTask>(`/marketing/tasks/${taskId}/annotations`, {
    method: "POST",
    body,
  });
  if (!res.data) throw new Error("Annotation failed");
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
