"""Marketing domain enums."""

from enum import Enum


class MktEntityType(str, Enum):
    CAMPAIGN = "campaign"
    CONTENT = "content"


class CampaignStatus(str, Enum):
    DRAFT = "draft"
    IN_REVIEW = "in_review"
    CHANGES_REQUIRED = "changes_required"
    APPROVED = "approved"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class CampaignType(str, Enum):
    EMAIL = "email"
    SOCIAL = "social"
    WEBSITE = "website"
    EVENT = "event"
    PAID_ADS = "paid_ads"
    CONTENT_SERIES = "content_series"
    PRODUCT_LAUNCH = "product_launch"
    MIXED = "mixed"


class ContentStatus(str, Enum):
    DRAFT = "draft"
    IN_REVIEW = "in_review"
    CHANGES_REQUIRED = "changes_required"
    MEDIA_APPROVED = "media_approved"
    APPROVED = "approved"
    SCHEDULED = "scheduled"
    PUBLISHED = "published"
    ARCHIVED = "archived"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class PostingReportStatus(str, Enum):
    PENDING = "pending"
    POSTED = "posted"
    NOT_POSTED = "not_posted"


class ContentType(str, Enum):
    SOCIAL_POST = "social_post"
    BLOG_ARTICLE = "blog_article"
    WEBSITE_PAGE = "website_page"
    LANDING_PAGE = "landing_page"
    EMAIL_NEWSLETTER = "email_newsletter"
    AD_CREATIVE = "ad_creative"
    VIDEO = "video"
    CASE_STUDY = "case_study"
    WHITEPAPER = "whitepaper"
    EVENT_PROMO = "event_promo"
    OTHER = "other"


class ChannelPlatform(str, Enum):
    LINKEDIN = "linkedin"
    WEBSITE = "website"
    INSTAGRAM = "instagram"
    FACEBOOK = "facebook"
    TWITTER = "twitter"
    YOUTUBE = "youtube"
    EMAIL = "email"
    WHATSAPP = "whatsapp"
    OTHER = "other"


class AssignmentRole(str, Enum):
    CREATOR = "creator"
    COPYWRITER = "copywriter"
    DESIGNER = "designer"
    APPROVER = "approver"
    PUBLISHER = "publisher"
    CHANNEL_HANDLER = "channel_handler"
    REVIEWER = "reviewer"
    CAMPAIGN_HANDLER = "campaign_handler"
    LINKEDIN_HANDLER = "linkedin_handler"
    VIDEO_EDITOR = "video_editor"
    HEAD = "head"


class VerifierRole(str, Enum):
    CREATOR = "creator"
    CAMPAIGN_HANDLER = "campaign_handler"
    LINKEDIN_HANDLER = "linkedin_handler"
    VIDEO_EDITOR = "video_editor"
    PUBLISHER = "publisher"
    HEAD = "head"


class WorkflowStage(str, Enum):
    DRAFT = "draft"
    CAMPAIGN_HANDLER_REVIEW = "campaign_handler_review"
    LINKEDIN_HANDLER_REVIEW = "linkedin_handler_review"
    VIDEO_EDITOR_REVIEW = "video_editor_review"
    PUBLISHER_REVIEW = "publisher_review"
    HEAD_FINAL_REVIEW = "head_final_review"
    READY_TO_PUBLISH = "ready_to_publish"
    PUBLISHED = "published"
    CHANGES_REQUIRED = "changes_required"
    REJECTED = "rejected"


class VerificationItemStatus(str, Enum):
    PENDING = "pending"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"
    CHANGES_REQUESTED = "changes_requested"


class VerificationOverallStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    SUBMITTED_TO_HEAD = "submitted_to_head"
    APPROVED = "approved"
    REJECTED = "rejected"
    CHANGES_REQUESTED = "changes_requested"
    AWAITING_POSTING = "awaiting_posting"
    SENT_TO_PUBLISHER = "sent_to_publisher"
    PUBLISHER_REPORTED = "publisher_reported"


class AssetKind(str, Enum):
    IMAGE = "image"
    VIDEO = "video"
    OTHER = "other"


# Standard checklist keys for design/copy verification
STANDARD_VERIFICATION_ITEMS: list[tuple[str, str]] = [
    ("text_copy", "Text / Copy"),
    ("theme", "Theme"),
    ("content", "Content"),
    ("hashtags", "Hashtags"),
    ("font_name", "Font Name"),
    ("font_size", "Font Size"),
    ("color_codes", "Color Codes"),
    ("image_dimensions", "Image Dimensions"),
    ("image_transparency", "Image Transparency"),
    ("branding_guidelines", "Branding Guidelines"),
    ("other_design", "Other Design Elements"),
]

VIDEO_VERIFICATION_ITEMS: list[tuple[str, str]] = [
    ("video_quality", "Video Quality"),
    ("resolution", "Resolution"),
    ("aspect_ratio", "Aspect Ratio"),
    ("subtitles", "Subtitles / Captions"),
    ("video_branding", "Branding"),
    ("thumbnail", "Thumbnail"),
    ("audio_quality", "Audio Quality"),
]

# Per-role checklist items — each role submits these separately to marketing head
ROLE_VERIFICATION_ITEMS: dict[str, list[tuple[str, str]]] = {
    VerifierRole.CREATOR.value: [
        ("text_copy", "Text / Copy"),
        ("theme", "Theme"),
        ("content", "Content"),
        ("hashtags", "Hashtags"),
        ("font_name", "Font Name"),
        ("font_size", "Font Size"),
        ("color_codes", "Color Codes"),
        ("other_design", "Banner / Ad Creative"),
        ("image_dimensions", "Image Dimensions"),
        ("image_transparency", "Image Transparency"),
        ("branding_guidelines", "Branding Guidelines"),
    ],
    VerifierRole.CAMPAIGN_HANDLER.value: [
        ("text_copy", "Text / Copy"),
        ("theme", "Theme"),
        ("content", "Content"),
        ("hashtags", "Hashtags"),
        ("image_dimensions", "Image / Ad Dimensions"),
        ("image_transparency", "Image Transparency"),
        ("branding_guidelines", "Branding Guidelines"),
        ("other_design", "Ad / Creative Design"),
    ],
    VerifierRole.LINKEDIN_HANDLER.value: [
        ("text_copy", "Text / Copy"),
        ("content", "Content"),
        ("hashtags", "Hashtags"),
        ("image_dimensions", "Image Dimensions"),
        ("branding_guidelines", "Branding Guidelines"),
    ],
    VerifierRole.VIDEO_EDITOR.value: [
        ("text_copy", "Text / Copy"),
        ("hashtags", "Hashtags"),
        ("content", "Content"),
        *VIDEO_VERIFICATION_ITEMS,
    ],
}

SUBMITTER_ROLES: list[str] = [
    VerifierRole.CREATOR.value,
    VerifierRole.CAMPAIGN_HANDLER.value,
    VerifierRole.LINKEDIN_HANDLER.value,
    VerifierRole.VIDEO_EDITOR.value,
]

# Checklist items that require an uploaded image/banner/creative before submit
IMAGE_VERIFICATION_ITEM_KEYS: set[str] = {
    "image_dimensions",
    "image_transparency",
    "other_design",
    "branding_guidelines",
}

VIDEO_VERIFICATION_ITEM_KEYS: set[str] = {
    "video_quality",
    "resolution",
    "aspect_ratio",
    "subtitles",
    "video_branding",
    "thumbnail",
    "audio_quality",
}


class AudienceMemberStatus(str, Enum):
    TARGETED = "targeted"
    REACHED = "reached"
    ENGAGED = "engaged"
    CONVERTED = "converted"


CODE_PREFIXES: dict[MktEntityType, tuple[str, int, bool]] = {
    MktEntityType.CAMPAIGN: ("MKT-CMP-", 6, True),
    MktEntityType.CONTENT: ("MKT-CNT-", 6, True),
}
