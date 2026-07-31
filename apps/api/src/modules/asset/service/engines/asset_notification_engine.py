"""AssetNotification lifecycle engine (FP-ASSET-017).

Owns delivery and archive state transitions only.
No persistence, HTTP, or Foundation Notification calls.
"""

from modules.asset.domain.enums import (
    AssetNotificationDeliveryStatus,
    AssetNotificationStatus,
)
from modules.asset.domain.exceptions import InvalidAssetNotificationState
from modules.asset.repository.base import utcnow


class AssetNotificationEngine:
    def archive(self, row) -> None:
        if row.status != AssetNotificationStatus.ACTIVE.value:
            raise InvalidAssetNotificationState("Only active notifications can be archived")
        row.status = AssetNotificationStatus.ARCHIVED.value

    def mark_sent(self, row) -> None:
        if row.status != AssetNotificationStatus.ACTIVE.value:
            raise InvalidAssetNotificationState("Archived notifications cannot be marked sent")
        if row.delivery_status not in {
            AssetNotificationDeliveryStatus.PENDING.value,
            AssetNotificationDeliveryStatus.FAILED.value,
        }:
            raise InvalidAssetNotificationState(
                "Only pending or failed notifications can be marked sent"
            )
        row.delivery_status = AssetNotificationDeliveryStatus.SENT.value
        if row.sent_at is None:
            row.sent_at = utcnow()

    def mark_failed(self, row) -> None:
        if row.status != AssetNotificationStatus.ACTIVE.value:
            raise InvalidAssetNotificationState("Archived notifications cannot be marked failed")
        if row.delivery_status != AssetNotificationDeliveryStatus.PENDING.value:
            raise InvalidAssetNotificationState("Only pending notifications can be marked failed")
        row.delivery_status = AssetNotificationDeliveryStatus.FAILED.value

    def mark_read(self, row) -> None:
        if row.status != AssetNotificationStatus.ACTIVE.value:
            raise InvalidAssetNotificationState("Archived notifications cannot be marked read")
        if row.delivery_status != AssetNotificationDeliveryStatus.SENT.value:
            raise InvalidAssetNotificationState("Only sent notifications can be marked read")
        row.delivery_status = AssetNotificationDeliveryStatus.READ.value

    def apply_metadata(self, row, fields: dict) -> None:
        """Apply validated metadata onto the entity (no persistence)."""
        for key, value in fields.items():
            if key == "version":
                continue
            if value is not None or key in {
                "branch_id",
                "recipient_user_id",
                "recipient_employee_id",
                "payload_json",
            }:
                setattr(row, key, value)
