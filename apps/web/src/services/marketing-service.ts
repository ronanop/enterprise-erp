import { ApiClientError, apiClient } from "@/services/api-client";
import { env } from "@/utils/env";

export { ApiClientError };

const API = "/marketing";

export type MarketingCampaign = {
  id: string;
  campaign_number: string;
  name: string;
  description: string | null;
  campaign_type: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  budget_amount: string | null;
  currency_code: string | null;
  owner_id: string | null;
  goals: string | null;
  target_audience_summary: string | null;
  company_id: string;
  version: number;
  created_at: string;
  activated_at: string | null;
  completed_at: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  approved_by_id: string | null;
  rejection_reason: string | null;
};

export type MarketingChannel = {
  id: string;
  name: string;
  platform: string;
  handle: string | null;
  profile_url: string | null;
  description: string | null;
  is_active: boolean;
  default_handler_id: string | null;
  company_id: string;
  version: number;
  created_at: string;
};

export type MarketingContentItem = {
  id: string;
  content_number: string;
  title: string;
  content_type: string;
  status: string;
  campaign_id: string | null;
  channel_id: string | null;
  body: string | null;
  summary: string | null;
  call_to_action: string | null;
  target_url: string | null;
  hashtags: string | null;
  created_by_id: string | null;
  assigned_to_id: string | null;
  approved_by_id: string | null;
  published_by_id: string | null;
  scheduled_at: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  published_at: string | null;
  archived_at: string | null;
  rejection_reason: string | null;
  posting_report_status: string | null;
  posting_report_notes: string | null;
  posting_reported_at: string | null;
  posting_reported_by_id: string | null;
  company_id: string;
  branch_id: string;
  version: number;
  created_at: string;
  theme?: string | null;
  font_name?: string | null;
  font_size?: string | null;
  color_codes?: string | null;
  workflow_stage?: string | null;
  final_head_approved_at?: string | null;
  linkedin_head_sections?: Record<
    string,
    { status: string; comments?: string | null; reviewed_at?: string | null }
  > | null;
  linkedin_final_draft?: {
    content_text?: string | null;
    poster_media_asset_id?: string | null;
    status?: string;
    comments?: string | null;
    submitted_at?: string | null;
    reviewed_at?: string | null;
  } | null;
};

export type MarketingPublication = {
  id: string;
  content_item_id: string;
  channel_id: string | null;
  published_url: string | null;
  external_post_id: string | null;
  posted_by_id: string | null;
  published_at: string;
  notes: string | null;
  metrics_json: Record<string, unknown> | null;
  company_id: string;
  created_at: string;
};

export type MarketingApproval = {
  id: string;
  content_item_id: string;
  approver_id: string;
  status: string;
  decision_at: string | null;
  comments: string | null;
  created_at: string;
};

export type MarketingAsset = {
  id: string;
  asset_number: string;
  name: string;
  file_url: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  alt_text: string | null;
  description: string | null;
  uploaded_by_id: string | null;
  company_id: string;
  version: number;
  created_at: string;
};

export type MarketingCalendarItem = {
  id: string;
  content_number: string;
  title: string;
  status: string;
  scheduled_at: string;
  channel_id: string | null;
  campaign_id: string | null;
};

export type MarketingDashboardStats = {
  active_campaigns: number;
  draft_content: number;
  in_review_content: number;
  scheduled_content: number;
  published_this_month: number;
  pending_approvals: number;
  active_channels: number;
};

type ListParams = Record<string, string | number | boolean | null | undefined>;

async function unwrap<T>(path: string, options?: Parameters<typeof apiClient>[1]): Promise<T> {
  const res = await apiClient<T>(path, options);
  if (res.data === null || res.data === undefined) {
    throw new ApiClientError("Empty response", 500);
  }
  return res.data;
}

export function listCampaigns(params?: ListParams) {
  return unwrap<MarketingCampaign[]>(`${API}/campaigns`, { query: params });
}

export function createCampaign(body: Record<string, unknown>) {
  return unwrap<MarketingCampaign>(`${API}/campaigns`, { method: "POST", body });
}

export function updateCampaign(id: string, body: Record<string, unknown>) {
  return unwrap<MarketingCampaign>(`${API}/campaigns/${id}`, { method: "PATCH", body });
}

export function activateCampaign(id: string) {
  return unwrap<MarketingCampaign>(`${API}/campaigns/${id}/activate`, { method: "POST" });
}

export function submitCampaign(id: string) {
  return unwrap<MarketingCampaign>(`${API}/campaigns/${id}/submit`, { method: "POST" });
}

export function approveCampaign(id: string) {
  return unwrap<MarketingCampaign>(`${API}/campaigns/${id}/approve`, { method: "POST" });
}

export function requestCampaignChanges(id: string, reason?: string) {
  return unwrap<MarketingCampaign>(`${API}/campaigns/${id}/request-changes`, {
    method: "POST",
    body: { reason },
  });
}

export function listChannels(params?: ListParams) {
  return unwrap<MarketingChannel[]>(`${API}/channels`, { query: params });
}

export function createChannel(body: Record<string, unknown>) {
  return unwrap<MarketingChannel>(`${API}/channels`, { method: "POST", body });
}

export function updateChannel(id: string, body: Record<string, unknown>) {
  return unwrap<MarketingChannel>(`${API}/channels/${id}`, { method: "PATCH", body });
}

export function listContentItems(params?: ListParams & { mine?: boolean }) {
  return unwrap<MarketingContentItem[]>(`${API}/content-items`, { query: params });
}

export function getContentItem(id: string) {
  return unwrap<MarketingContentItem>(`${API}/content-items/${id}`);
}

export function createContentItem(body: Record<string, unknown>) {
  return unwrap<MarketingContentItem>(`${API}/content-items`, { method: "POST", body });
}

export function updateContentItem(id: string, body: Record<string, unknown>) {
  return unwrap<MarketingContentItem>(`${API}/content-items/${id}`, { method: "PATCH", body });
}

export function submitContentItem(id: string) {
  return unwrap<MarketingContentItem>(`${API}/content-items/${id}/submit`, { method: "POST" });
}

export function approveContentItem(id: string) {
  return unwrap<MarketingContentItem>(`${API}/content-items/${id}/approve`, { method: "POST" });
}

export function approveMediaContentItem(id: string) {
  return unwrap<MarketingContentItem>(`${API}/content-items/${id}/approve-media`, { method: "POST" });
}

export function rejectContentItem(id: string, reason?: string) {
  return unwrap<MarketingContentItem>(`${API}/content-items/${id}/reject`, {
    method: "POST",
    body: { reason },
  });
}

export function requestContentChanges(id: string, reason?: string) {
  return unwrap<MarketingContentItem>(`${API}/content-items/${id}/request-changes`, {
    method: "POST",
    body: { reason },
  });
}

export function reportContentPosting(
  id: string,
  body: { posted: boolean; notes?: string; published_url?: string },
) {
  return unwrap<MarketingContentItem>(`${API}/content-items/${id}/report-posting`, {
    method: "POST",
    body,
  });
}

export function scheduleContentItem(id: string, scheduled_at: string) {
  return unwrap<MarketingContentItem>(`${API}/content-items/${id}/schedule`, {
    method: "POST",
    body: { scheduled_at },
  });
}

export function publishContentItem(id: string, body: Record<string, unknown>) {
  return unwrap<MarketingContentItem>(`${API}/content-items/${id}/publish`, { method: "POST", body });
}

export function archiveContentItem(id: string) {
  return unwrap<MarketingContentItem>(`${API}/content-items/${id}/archive`, { method: "POST" });
}

export function listPublications(params?: ListParams) {
  return unwrap<MarketingPublication[]>(`${API}/content-items/publications`, { query: params });
}

export function listPendingApprovals(params?: ListParams) {
  return unwrap<MarketingApproval[]>(`${API}/content-items/approvals/pending`, { query: params });
}

export function listCalendarItems(start: string, end: string, params?: ListParams) {
  return unwrap<MarketingCalendarItem[]>(`${API}/content-items/calendar`, {
    query: { start, end, ...params },
  });
}

export function listAssets(params?: ListParams) {
  return unwrap<MarketingAsset[]>(`${API}/assets`, { query: params });
}

export function createAsset(body: Record<string, unknown>) {
  return unwrap<MarketingAsset>(`${API}/assets`, { method: "POST", body });
}

export function getDashboardStats(params?: ListParams) {
  return unwrap<MarketingDashboardStats>(`${API}/dashboard/stats`, { query: params });
}

export type MarketingReportSummary = {
  by_status: { key: string; label: string; count: number }[];
  by_channel: { key: string; label: string; count: number }[];
  by_campaign: { key: string; label: string; count: number }[];
  by_content_type: { key: string; label: string; count: number }[];
};

export type MarketingActivityLog = {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_id: string | null;
  details: string | null;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
};

export function getReportSummary(params?: ListParams) {
  return unwrap<MarketingReportSummary>(`${API}/reports/summary`, { query: params });
}

export function getContentTimeline(contentId: string) {
  return unwrap<MarketingActivityLog[]>(`${API}/content-items/${contentId}/timeline`);
}

export type MarketingPipelineFunnelStage = {
  key: string;
  label: string;
  count: number;
};

export type MarketingPipelineCampaign = {
  id: string;
  name: string;
  status: string;
  campaign_number: string;
  description?: string | null;
  goals?: string | null;
  target_audience_summary?: string | null;
  rejection_reason?: string | null;
  submitted_at?: string | null;
  created_by?: string | null;
};

export type MarketingPipelineWorkStage = {
  key: string;
  label: string;
  description: string;
  count: number;
  items: MarketingContentItem[];
  campaigns?: MarketingPipelineCampaign[];
};

export type MarketingPipelineWork = {
  role_hints: string[];
  stages: MarketingPipelineWorkStage[];
  funnel: MarketingPipelineFunnelStage[];
  refreshed_at: string;
};

export type MarketingPipelineHeadReviewGroup = {
  user_id: string | null;
  display_name: string;
  email: string | null;
  items: MarketingContentItem[];
};

export type MarketingPipelineHeadReview = {
  groups: MarketingPipelineHeadReviewGroup[];
  refreshed_at: string;
};

export type VerificationItemStatus = "pending" | "submitted" | "approved" | "rejected" | "changes_requested";
export type VerificationOverallStatus =
  | "pending"
  | "in_progress"
  | "submitted_to_head"
  | "approved"
  | "rejected"
  | "changes_requested"
  | "awaiting_posting"
  | "sent_to_publisher"
  | "publisher_reported";

export type MarketingVerificationItem = {
  id: string;
  item_key: string;
  item_label: string;
  status: VerificationItemStatus;
  comments: string | null;
  submitted_to_head_at?: string | null;
  submitted_by_user_id?: string | null;
  submitted_by_name?: string | null;
  reviewed_at?: string | null;
};

export type MarketingVerification = {
  id: string;
  verifier_role: string;
  verifier_user_id: string | null;
  requested_by_user_id?: string | null;
  requested_by_name?: string | null;
  overall_status: VerificationOverallStatus;
  overall_comments: string | null;
  started_at: string | null;
  completed_at: string | null;
  posting_planned_at?: string | null;
  posting_timeline_notes?: string | null;
  posting_confirmed?: boolean | null;
  sent_to_publisher_at?: string | null;
  publisher_upload_status?: string | null;
  publisher_upload_notes?: string | null;
  publisher_reported_at?: string | null;
  items: MarketingVerificationItem[];
};

export type MarketingContentWorkflow = {
  content_id: string;
  content_number: string;
  title: string;
  content_type: string;
  workflow_stage: string | null;
  status: string;
  final_head_approved_at: string | null;
  submitter_roles?: string[];
  my_role?: string | null;
  is_head?: boolean;
  is_publisher?: boolean;
  verifications: MarketingVerification[];
  can_publish: boolean;
};

export type MarketingLinkedAsset = {
  id: string;
  asset_role: string | null;
  sort_order: number;
  asset: {
    id: string;
    name: string;
    file_url: string;
    mime_type: string | null;
    asset_kind: string | null;
    width_px: number | null;
    height_px: number | null;
  };
};

export function linkedAssetMediaId(link: MarketingLinkedAsset): string {
  return link.asset.id;
}

export type MarketingHeadVerificationDashboard = {
  items: Array<{
    content_id: string;
    content_number: string;
    title: string;
    workflow_stage: string | null;
    status: string;
    pending_head_items: number;
    verifications: MarketingVerification[];
  }>;
  summary: {
    total_in_pipeline: number;
    pending_head_reviews: number;
    awaiting_publisher?: number;
  };
};

export function getContentWorkflow(contentId: string) {
  return unwrap<MarketingContentWorkflow>(`${API}/content-items/${contentId}/workflow`);
}

export function getContentVerifications(contentId: string) {
  return unwrap<MarketingVerification[]>(`${API}/content-items/${contentId}/verifications`);
}

export function submitVerificationItem(
  contentId: string,
  body: { item_key: string; verifier_role?: string },
) {
  return unwrap<MarketingContentWorkflow>(`${API}/content-items/${contentId}/verifications/submit-item`, {
    method: "POST",
    body,
  });
}

export function headReviewVerificationItem(
  contentId: string,
  body: { verifier_role: string; item_key: string; status: string; comments?: string },
) {
  return unwrap<MarketingContentWorkflow>(`${API}/content-items/${contentId}/verifications/head-review`, {
    method: "POST",
    body,
  });
}

export function linkedInHeadReviewSection(
  contentId: string,
  body: { section: string; status: string; comments?: string },
) {
  return unwrap<MarketingContentItem>(`${API}/content-items/${contentId}/linkedin/head-review-section`, {
    method: "POST",
    body,
  });
}

export function linkedInSendToPublisher(contentId: string) {
  return unwrap<MarketingContentItem>(`${API}/content-items/${contentId}/linkedin/send-to-publisher`, {
    method: "POST",
  });
}

export function linkedInSubmitFinalDraftToHead(
  contentId: string,
  body: { content_text?: string | null; poster_media_asset_id?: string | null },
) {
  return unwrap<MarketingContentItem>(`${API}/content-items/${contentId}/linkedin/submit-final-draft-to-head`, {
    method: "POST",
    body,
  });
}

export function linkedInHeadReviewFinalDraft(
  contentId: string,
  body: { status: string; comments?: string },
) {
  return unwrap<MarketingContentItem>(`${API}/content-items/${contentId}/linkedin/head-review-final-draft`, {
    method: "POST",
    body,
  });
}

export function setPostingTimeline(
  contentId: string,
  body: { verifier_role?: string; planned_at?: string; notes?: string; posted?: boolean },
) {
  return unwrap<MarketingContentWorkflow>(`${API}/content-items/${contentId}/verifications/posting-timeline`, {
    method: "POST",
    body,
  });
}

export function sendToPublisher(contentId: string, body: { verifier_role?: string }) {
  return unwrap<MarketingContentWorkflow>(`${API}/content-items/${contentId}/verifications/send-to-publisher`, {
    method: "POST",
    body,
  });
}

export function publisherUploadReport(
  contentId: string,
  body: { verifier_role: string; uploaded: boolean; notes?: string },
) {
  return unwrap<MarketingContentWorkflow>(`${API}/content-items/${contentId}/verifications/publisher-report`, {
    method: "POST",
    body,
  });
}

export function updateVerificationItem(
  contentId: string,
  body: { item_key: string; status: VerificationItemStatus; comments?: string },
) {
  return unwrap<MarketingVerification>(`${API}/content-items/${contentId}/verifications/items`, {
    method: "PATCH",
    body,
  });
}

export function completeVerification(
  contentId: string,
  body: { overall_status: VerificationOverallStatus; overall_comments?: string; verifier_role?: string },
) {
  return unwrap<MarketingContentWorkflow>(`${API}/content-items/${contentId}/verifications/complete`, {
    method: "POST",
    body,
  });
}

export function getHeadVerificationDashboard(params?: ListParams) {
  return unwrap<MarketingHeadVerificationDashboard>(`${API}/pipeline/head-verification-dashboard`, {
    query: params,
  });
}

export function listContentAssets(contentId: string) {
  return unwrap<MarketingLinkedAsset[]>(`${API}/content-items/${contentId}/assets`);
}

export function linkContentAsset(
  contentId: string,
  body: { media_asset_id: string; asset_role?: string; sort_order?: number },
) {
  return unwrap<MarketingLinkedAsset>(`${API}/content-items/${contentId}/assets`, { method: "POST", body });
}

export function uploadMarketingAsset(body: {
  name: string;
  content_base64: string;
  company_id?: string;
  mime_type?: string;
  asset_kind?: string;
  width_px?: number;
  height_px?: number;
  alt_text?: string;
  description?: string;
}) {
  return unwrap<MarketingAsset>(`${API}/assets/upload`, { method: "POST", body });
}

export function marketingAssetUrl(fileUrl: string): string {
  if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) return fileUrl;
  if (env.apiUrl.startsWith("/")) {
    return fileUrl.startsWith("/") ? fileUrl : `/${fileUrl}`;
  }
  const base = env.apiUrl.replace(/\/api\/v\d+$/, "");
  return `${base}${fileUrl}`;
}

export function getMarketingPipeline(params?: ListParams) {
  return unwrap<MarketingPipelineWork>(`${API}/pipeline/my-work`, { query: params });
}

export function getMarketingHeadReview(params?: ListParams) {
  return unwrap<MarketingPipelineHeadReview>(`${API}/pipeline/head-review`, { query: params });
}

export function formatMarketingStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Whether this user should confirm posting status to marketing head (never the head themselves). */
export function canUserReportPosting(
  item: MarketingContentItem,
  userId: string | null,
  perms: { canSubmit: boolean; canPublish: boolean; canApprove?: boolean; canVerify?: boolean },
): boolean {
  if (perms.canApprove) return false;
  if (item.content_type === "social_post" && item.linkedin_head_sections) {
    return false;
  }
  const postReady =
    item.status === "approved" ||
    item.status === "scheduled" ||
    item.status === "published" ||
    (item.status === "in_review" &&
      (!item.posting_report_status || item.posting_report_status === "pending"));
  const pending =
    !item.posting_report_status ||
    item.posting_report_status === "pending" ||
    item.posting_report_status === "not_posted";
  if (!postReady || !pending) return false;
  const isOwner =
    Boolean(userId) && (item.created_by_id === userId || item.assigned_to_id === userId);
  if (perms.canSubmit && isOwner) return true;
  if (perms.canVerify && !perms.canApprove) return true;
  if (perms.canPublish && !perms.canApprove) return true;
  return false;
}
