"""Marketing campaign workflow engine."""

from datetime import datetime, timezone
from uuid import UUID

from modules.marketing.domain.enums import CampaignStatus
from modules.marketing.domain.exceptions import InvalidMarketingState
from modules.marketing.models.campaign import MktCampaign


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class CampaignEngine:
    def submit(self, row: MktCampaign) -> None:
        if row.status not in {CampaignStatus.DRAFT.value, CampaignStatus.CHANGES_REQUIRED.value}:
            raise InvalidMarketingState("Only draft or changes-required campaigns can be submitted for review")
        if not (row.description or row.goals):
            raise InvalidMarketingState("Add a description or goals before submitting for head approval")
        row.status = CampaignStatus.IN_REVIEW.value
        row.submitted_at = _utcnow()
        row.rejection_reason = None

    def approve(self, row: MktCampaign, approver_id: UUID) -> None:
        if row.status != CampaignStatus.IN_REVIEW.value:
            raise InvalidMarketingState("Only in-review campaigns can be approved by marketing head")
        row.status = CampaignStatus.APPROVED.value
        row.approved_at = _utcnow()
        row.approved_by_id = approver_id
        row.rejection_reason = None

    def request_changes(self, row: MktCampaign, reason: str | None = None) -> None:
        if row.status != CampaignStatus.IN_REVIEW.value:
            raise InvalidMarketingState("Changes can only be requested while campaign is in review")
        row.status = CampaignStatus.CHANGES_REQUIRED.value
        row.rejection_reason = reason

    def activate(self, row: MktCampaign) -> None:
        if row.status != CampaignStatus.APPROVED.value:
            raise InvalidMarketingState("Campaign must be approved by marketing head before activation")
        row.status = CampaignStatus.ACTIVE.value
        row.activated_at = _utcnow()

    def complete(self, row: MktCampaign) -> None:
        if row.status != CampaignStatus.ACTIVE.value:
            raise InvalidMarketingState("Only active campaigns can be completed")
        row.status = CampaignStatus.COMPLETED.value
        row.completed_at = _utcnow()

    def cancel(self, row: MktCampaign) -> None:
        if row.status in {CampaignStatus.COMPLETED.value, CampaignStatus.CANCELLED.value}:
            raise InvalidMarketingState("Campaign is already finished")
        row.status = CampaignStatus.CANCELLED.value
