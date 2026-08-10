"""Marketing content workflow engine."""

from datetime import datetime, timezone

from modules.marketing.domain.enums import ContentStatus
from modules.marketing.domain.exceptions import InvalidMarketingState
from modules.marketing.models.content_item import MktContentItem


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ContentItemEngine:
    @staticmethod
    def assert_editable(row: MktContentItem) -> None:
        if row.status in {ContentStatus.PUBLISHED.value, ContentStatus.ARCHIVED.value}:
            raise InvalidMarketingState("Published and archived content is read-only")

    def submit(self, row: MktContentItem) -> None:
        self.assert_editable(row)
        if row.status not in {ContentStatus.DRAFT.value, ContentStatus.CHANGES_REQUIRED.value}:
            raise InvalidMarketingState("Only draft or changes-required content can be submitted for review")
        row.status = ContentStatus.IN_REVIEW.value
        row.submitted_at = _utcnow()
        row.rejection_reason = None

    def request_changes(self, row: MktContentItem, reason: str | None = None) -> None:
        if row.status not in {ContentStatus.IN_REVIEW.value, ContentStatus.MEDIA_APPROVED.value}:
            raise InvalidMarketingState("Changes can only be requested while content is in review")
        row.status = ContentStatus.CHANGES_REQUIRED.value
        row.rejection_reason = reason

    def approve_media(self, row: MktContentItem, approver_id) -> None:
        if row.status != ContentStatus.IN_REVIEW.value:
            raise InvalidMarketingState("Only in-review content can receive media approval")
        row.status = ContentStatus.MEDIA_APPROVED.value
        row.rejection_reason = None

    def approve(self, row: MktContentItem, approver_id) -> None:
        if row.status != ContentStatus.MEDIA_APPROVED.value:
            raise InvalidMarketingState("Marketing head approval requires media sign-off first")
        row.status = ContentStatus.APPROVED.value
        row.approved_at = _utcnow()
        row.approved_by_id = approver_id
        row.rejection_reason = None

    def reject(self, row: MktContentItem, reason: str | None = None) -> None:
        if row.status not in {ContentStatus.IN_REVIEW.value, ContentStatus.MEDIA_APPROVED.value}:
            raise InvalidMarketingState("Only in-review or media-approved content can be rejected")
        row.status = ContentStatus.REJECTED.value
        row.rejection_reason = reason

    def schedule(self, row: MktContentItem, scheduled_at: datetime) -> None:
        if row.status not in {ContentStatus.APPROVED.value, ContentStatus.SCHEDULED.value}:
            raise InvalidMarketingState("Only approved content can be scheduled")
        row.status = ContentStatus.SCHEDULED.value
        row.scheduled_at = scheduled_at

    def mark_published(self, row: MktContentItem, publisher_id) -> None:
        if row.status not in {ContentStatus.SCHEDULED.value, ContentStatus.APPROVED.value}:
            raise InvalidMarketingState("Content must be approved or scheduled before publishing")
        row.status = ContentStatus.PUBLISHED.value
        row.published_at = _utcnow()
        row.published_by_id = publisher_id

    def archive(self, row: MktContentItem) -> None:
        if row.status not in {ContentStatus.PUBLISHED.value, ContentStatus.REJECTED.value, ContentStatus.CANCELLED.value}:
            raise InvalidMarketingState("Only published, rejected, or cancelled content can be archived")
        row.status = ContentStatus.ARCHIVED.value
        row.archived_at = _utcnow()

    def cancel(self, row: MktContentItem) -> None:
        if row.status in {ContentStatus.PUBLISHED.value, ContentStatus.ARCHIVED.value}:
            raise InvalidMarketingState("Published or archived content cannot be cancelled")
        row.status = ContentStatus.CANCELLED.value
