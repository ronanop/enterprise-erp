"""Asset notification validation rules for FP-ASSET-017."""

from __future__ import annotations

import json
import re
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.asset.adapters.master_data_port import AssetMasterDataAdapter
from modules.asset.domain.enums import (
    AssetNotificationDeliveryStatus,
    AssetNotificationEventSubtype,
    AssetNotificationStatus,
    AssetNotificationType,
    AssetStatus,
)
from modules.asset.domain.exceptions import NotificationValidationError
from modules.asset.models import AstAssetNotification
from modules.asset.repository.asset_repository import AssetRepository
from modules.foundation.domain.value_objects import TenantContext

NOTIFICATION_TYPES = frozenset(t.value for t in AssetNotificationType)
EVENT_SUBTYPES = frozenset(t.value for t in AssetNotificationEventSubtype)
DELIVERY_STATUSES = frozenset(t.value for t in AssetNotificationDeliveryStatus)
BLOCKED_ASSET_STATUSES = frozenset(
    {
        AssetStatus.DISPOSED.value,
        AssetStatus.WRITTEN_OFF.value,
    }
)
IMMUTABLE_AFTER_DELIVERY = frozenset(
    {
        "asset_id",
        "notification_type",
        "recipient_user_id",
        "recipient_employee_id",
        "payload_json",
        "company_id",
    }
)
SECRET_KEY_PATTERN = re.compile(
    r"(password|passwd|secret|api[_-]?key|token|authorization|private[_-]?key)",
    re.IGNORECASE,
)
MAX_PAYLOAD_BYTES = 32 * 1024
MAX_PAYLOAD_DEPTH = 4


class NotificationValidator:
    def __init__(self, db: Session) -> None:
        self._assets = AssetRepository(db)
        self._master = AssetMasterDataAdapter(db)

    def validate_create_fields(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        fields: dict,
    ) -> None:
        if fields.get("status") and fields["status"] != AssetNotificationStatus.ACTIVE.value:
            raise NotificationValidationError("Notification must be created in active status")
        if fields.get("delivery_status") and fields["delivery_status"] not in {
            AssetNotificationDeliveryStatus.PENDING.value,
            None,
        }:
            raise NotificationValidationError(
                "delivery_status must be pending on create (server-controlled)"
            )
        if fields.get("sent_at") is not None:
            raise NotificationValidationError("sent_at cannot be set on create")

        asset_id = fields.get("asset_id")
        if asset_id is None:
            raise NotificationValidationError("asset_id is required")

        notification_type = fields.get("notification_type")
        if not notification_type or str(notification_type).strip() not in NOTIFICATION_TYPES:
            raise NotificationValidationError(
                "notification_type must be maintenance_due, warranty_expiry, "
                "insurance_expiry, audit_due, depreciation, or other"
            )
        notification_type = str(notification_type).strip()
        fields["notification_type"] = notification_type

        recipient_user_id = fields.get("recipient_user_id")
        recipient_employee_id = fields.get("recipient_employee_id")
        if recipient_user_id is None and recipient_employee_id is None:
            raise NotificationValidationError(
                "At least one of recipient_user_id or recipient_employee_id is required"
            )
        if recipient_employee_id is not None:
            self._validate_employee(ctx, recipient_employee_id)

        payload = fields.get("payload_json")
        fields["payload_json"] = self.validate_payload(
            payload,
            notification_type=notification_type,
            require_subtype=(notification_type == AssetNotificationType.OTHER.value),
        )

        asset = self._assets.get(ctx, asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        self.validate_asset_belongs_to_company(asset, company_id)
        self.validate_asset_for_notification(
            asset.status,
            notification_type=notification_type,
            payload=fields["payload_json"],
        )

    def validate_update_fields(
        self,
        ctx: TenantContext,
        row: AstAssetNotification,
        fields: dict,
    ) -> None:
        if row.status != AssetNotificationStatus.ACTIVE.value:
            raise NotificationValidationError("Only active notifications can be updated")
        if "status" in fields and fields["status"] is not None and fields["status"] != row.status:
            raise NotificationValidationError("status cannot be changed via update; use archive")
        if "delivery_status" in fields and fields["delivery_status"] is not None:
            raise NotificationValidationError(
                "delivery_status cannot be changed via update; use mark-sent/failed/read"
            )
        if "sent_at" in fields and fields["sent_at"] is not None:
            raise NotificationValidationError("sent_at cannot be changed via update")

        delivered = row.delivery_status in {
            AssetNotificationDeliveryStatus.SENT.value,
            AssetNotificationDeliveryStatus.READ.value,
        }
        if delivered:
            for key in IMMUTABLE_AFTER_DELIVERY:
                if key in fields and fields[key] is not None and fields[key] != getattr(row, key):
                    raise NotificationValidationError(
                        f"{key} is immutable after delivery_status becomes sent or read"
                    )
            # Allow empty patch of only version — reject any metadata change attempt
            mutable = {
                k
                for k, v in fields.items()
                if k != "version" and v is not None and k not in IMMUTABLE_AFTER_DELIVERY
            }
            if mutable:
                raise NotificationValidationError(
                    "Metadata cannot be updated after delivery_status becomes sent or read"
                )
            return

        if row.delivery_status not in {
            AssetNotificationDeliveryStatus.PENDING.value,
            AssetNotificationDeliveryStatus.FAILED.value,
        }:
            raise NotificationValidationError("Metadata can only be updated while pending or failed")

        for key in ("asset_id", "notification_type", "company_id"):
            if key in fields and fields[key] is not None and fields[key] != getattr(row, key):
                raise NotificationValidationError(f"{key} cannot be changed")

        if "recipient_employee_id" in fields and fields["recipient_employee_id"] is not None:
            self._validate_employee(ctx, fields["recipient_employee_id"])

        next_user = fields.get("recipient_user_id", row.recipient_user_id)
        next_employee = fields.get("recipient_employee_id", row.recipient_employee_id)
        if next_user is None and next_employee is None:
            raise NotificationValidationError(
                "At least one of recipient_user_id or recipient_employee_id is required"
            )

        if "payload_json" in fields:
            fields["payload_json"] = self.validate_payload(
                fields.get("payload_json"),
                notification_type=row.notification_type,
                require_subtype=(row.notification_type == AssetNotificationType.OTHER.value),
            )

    def validate_archive_readiness(self, ctx: TenantContext, row: AstAssetNotification) -> None:
        if row.status != AssetNotificationStatus.ACTIVE.value:
            raise NotificationValidationError("Only active notifications can be archived")

    def validate_mark_sent_readiness(self, ctx: TenantContext, row: AstAssetNotification) -> None:
        self._require_active(row)
        if row.delivery_status not in {
            AssetNotificationDeliveryStatus.PENDING.value,
            AssetNotificationDeliveryStatus.FAILED.value,
        }:
            raise NotificationValidationError(
                "Only pending or failed notifications can be marked sent"
            )

    def validate_mark_failed_readiness(self, ctx: TenantContext, row: AstAssetNotification) -> None:
        self._require_active(row)
        if row.delivery_status != AssetNotificationDeliveryStatus.PENDING.value:
            raise NotificationValidationError("Only pending notifications can be marked failed")

    def validate_mark_read_readiness(self, ctx: TenantContext, row: AstAssetNotification) -> None:
        self._require_active(row)
        if row.delivery_status != AssetNotificationDeliveryStatus.SENT.value:
            raise NotificationValidationError("Only sent notifications can be marked read")

    @staticmethod
    def _require_active(row: AstAssetNotification) -> None:
        if row.status != AssetNotificationStatus.ACTIVE.value:
            raise NotificationValidationError("Archived notifications cannot change delivery status")

    @staticmethod
    def validate_asset_belongs_to_company(asset, company_id: UUID) -> None:
        if asset.company_id != company_id:
            raise NotificationValidationError("Asset does not belong to this company")

    @staticmethod
    def validate_asset_for_notification(
        status: str,
        *,
        notification_type: str,
        payload: dict | None,
    ) -> None:
        if status not in BLOCKED_ASSET_STATUSES:
            return
        subtype = (payload or {}).get("event_subtype")
        if (
            notification_type == AssetNotificationType.OTHER.value
            and subtype == AssetNotificationEventSubtype.DISPOSAL.value
        ):
            return
        raise NotificationValidationError(
            "Notifications cannot be recorded for disposed or written-off assets "
            "(except other/disposal)"
        )

    @staticmethod
    def validate_payload(
        payload: Any,
        *,
        notification_type: str,
        require_subtype: bool,
    ) -> dict | None:
        if payload is None:
            if require_subtype:
                raise NotificationValidationError(
                    "payload_json.event_subtype is required when notification_type is other"
                )
            return None
        if not isinstance(payload, dict):
            raise NotificationValidationError("payload_json must be a JSON object")

        NotificationValidator._reject_secret_keys(payload)
        depth = NotificationValidator._payload_depth(payload)
        if depth > MAX_PAYLOAD_DEPTH:
            raise NotificationValidationError(
                f"payload_json exceeds maximum depth of {MAX_PAYLOAD_DEPTH}"
            )
        try:
            serialized = json.dumps(payload, default=str)
        except (TypeError, ValueError) as exc:
            raise NotificationValidationError("payload_json is not serializable") from exc
        if len(serialized.encode("utf-8")) > MAX_PAYLOAD_BYTES:
            raise NotificationValidationError(
                f"payload_json exceeds maximum size of {MAX_PAYLOAD_BYTES} bytes"
            )

        if require_subtype or notification_type == AssetNotificationType.OTHER.value:
            subtype = payload.get("event_subtype")
            if not subtype or str(subtype).strip() not in EVENT_SUBTYPES:
                raise NotificationValidationError(
                    "payload_json.event_subtype must be assignment, disposal, custom, "
                    "maintenance_completed, or asset_returned"
                )
            payload = {**payload, "event_subtype": str(subtype).strip()}

        return payload

    @staticmethod
    def _payload_depth(value: Any, current: int = 1) -> int:
        if isinstance(value, dict):
            if not value:
                return current
            return max(
                NotificationValidator._payload_depth(v, current + 1) for v in value.values()
            )
        if isinstance(value, list):
            if not value:
                return current
            return max(NotificationValidator._payload_depth(v, current + 1) for v in value)
        return current

    @staticmethod
    def _reject_secret_keys(payload: dict, path: str = "") -> None:
        for key, value in payload.items():
            key_str = str(key)
            full = f"{path}.{key_str}" if path else key_str
            if SECRET_KEY_PATTERN.search(key_str):
                raise NotificationValidationError(
                    f"payload_json must not contain secret key '{full}'"
                )
            if isinstance(value, dict):
                NotificationValidator._reject_secret_keys(value, full)
            elif isinstance(value, list):
                for idx, item in enumerate(value):
                    if isinstance(item, dict):
                        NotificationValidator._reject_secret_keys(item, f"{full}[{idx}]")

    def _validate_employee(self, ctx: TenantContext, employee_id: UUID) -> None:
        try:
            self._master.get_employee(ctx, employee_id)
        except NotFoundException:
            raise
        except Exception as exc:
            raise NotificationValidationError("recipient_employee_id is invalid") from exc
