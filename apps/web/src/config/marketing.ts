/** Marketing module configuration — nav, pipeline stages, enums. */

export const MARKETING_CONTENT_STATUSES = [
  "draft",
  "in_review",
  "changes_required",
  "media_approved",
  "approved",
  "scheduled",
  "published",
  "archived",
  "rejected",
  "cancelled",
] as const;

export const MARKETING_CONTENT_TYPES = [
  "social_post",
  "blog_article",
  "website_page",
  "landing_page",
  "email_newsletter",
  "ad_creative",
  "video",
  "case_study",
  "whitepaper",
  "event_promo",
  "other",
] as const;

export const MARKETING_PLATFORMS = [
  "linkedin",
  "website",
  "instagram",
  "facebook",
  "twitter",
  "youtube",
  "email",
  "whatsapp",
  "other",
] as const;

export const MARKETING_ASSIGNMENT_ROLES = [
  "creator",
  "copywriter",
  "designer",
  "approver",
  "publisher",
  "channel_handler",
  "reviewer",
] as const;

/** Content workflow pipeline for UI badges and filters. */
export const MARKETING_CONTENT_PIPELINE = [
  { key: "draft", label: "Draft" },
  { key: "in_review", label: "In Review" },
  { key: "changes_required", label: "Changes Required" },
  { key: "media_approved", label: "Media Approved" },
  { key: "approved", label: "Approved" },
  { key: "scheduled", label: "Scheduled" },
  { key: "published", label: "Published" },
  { key: "archived", label: "Published" },
] as const;

export const MARKETING_NAV_ITEMS = [
  { title: "Overview", href: "/marketing/pipeline" },
  { title: "Campaigns", href: "/marketing/campaigns" },
  { title: "Content", href: "/marketing/content" },
  { title: "Approvals", href: "/marketing/approvals" },
  { title: "Archive", href: "/marketing/archive" },
  { title: "Assets", href: "/marketing/assets" },
] as const;
