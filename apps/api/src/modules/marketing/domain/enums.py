"""Marketing domain enums."""

from enum import StrEnum


class CampaignStatus(StrEnum):
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ContentRequestStatus(StrEnum):
    DRAFT = "draft"
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ContentStatus(StrEnum):
    DRAFT = "draft"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    SCHEDULED = "scheduled"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class PublishJobStatus(StrEnum):
    PENDING = "pending"
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"


class CalendarEntryStatus(StrEnum):
    PLANNED = "planned"
    SCHEDULED = "scheduled"
    PUBLISHED = "published"
    CANCELLED = "cancelled"


class BrandVoiceStatus(StrEnum):
    DRAFT = "draft"
    TRAINING = "training"
    ACTIVE = "active"
    ARCHIVED = "archived"


class SocialAccountStatus(StrEnum):
    DRAFT = "draft"
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"
