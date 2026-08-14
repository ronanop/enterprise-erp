"""Notification service."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import AppException, NotFoundException
from modules.foundation.domain.entities import NotificationInboxItem
from modules.foundation.models.notification import NtfEvent
from modules.foundation.repository.base import utcnow
from modules.foundation.repository.notification_repository import NotificationRepository
from modules.foundation.service.audit_service import AuditService
from modules.foundation.service.notification_href import sanitize_inbox_href
from modules.foundation.tasks import send_notification_task


class NotificationService:
    def __init__(self, db: Session) -> None:
        self._repo = NotificationRepository(db)
        self._audit = AuditService(db)

    def list_templates(self, tenant_id: UUID):
        return self._repo.list_templates(tenant_id)

    def get_or_create_template(
        self,
        *,
        tenant_id: UUID,
        template_code: str,
        template_name: str,
        channel: str = "in_app",
        body_template: str,
        subject_template: str | None = None,
        created_by: UUID | None = None,
    ):
        for tpl in self._repo.list_templates(tenant_id):
            if tpl.template_code == template_code and tpl.channel == channel:
                return tpl
        return self.create_template(
            tenant_id=tenant_id,
            template_code=template_code,
            template_name=template_name,
            channel=channel,
            body_template=body_template,
            subject_template=subject_template,
            created_by=created_by,
        )

    def create_template(
        self,
        *,
        tenant_id: UUID,
        template_code: str,
        template_name: str,
        channel: str,
        body_template: str,
        subject_template: str | None = None,
        created_by: UUID | None = None,
    ):
        template = self._repo.create_template(
            tenant_id=tenant_id,
            template_code=template_code,
            template_name=template_name,
            channel=channel,
            body_template=body_template,
            subject_template=subject_template,
            created_by=created_by,
        )
        self._audit.log_entity_change(
            tenant_id=tenant_id,
            entity_name="ntf_template",
            entity_id=template.id,
            operation="create",
            performed_by=created_by,
            new_value={"template_code": template_code},
        )
        return template

    def list_events(self, tenant_id: UUID):
        return self._repo.list_events(tenant_id)

    def send(
        self,
        *,
        tenant_id: UUID,
        template_id: UUID,
        event_type: str,
        recipient_user_id: UUID | None,
        recipient_address: str | None,
        payload_json: dict | None,
        created_by: UUID | None = None,
    ):
        event = self._repo.create_event(
            tenant_id=tenant_id,
            template_id=template_id,
            event_type=event_type,
            recipient_user_id=recipient_user_id,
            recipient_address=recipient_address,
            payload_json=payload_json,
        )
        delivery = self._repo.create_delivery(
            tenant_id=tenant_id,
            event_id=event.id,
            channel="in_app",
        )
        try:
            send_notification_task.delay(str(event.id), str(delivery.id))
        except Exception:
            send_notification_task(str(event.id), str(delivery.id))

        # Fan-out push deliveries when the user has registered device tokens
        if recipient_user_id is not None:
            try:
                from sqlalchemy import select

                from modules.foundation.models.device_token import NtfDeviceToken

                tokens = list(
                    self._repo.db.scalars(
                        select(NtfDeviceToken).where(
                            NtfDeviceToken.tenant_id == tenant_id,
                            NtfDeviceToken.user_id == recipient_user_id,
                            NtfDeviceToken.is_deleted.is_(False),
                            NtfDeviceToken.is_active.is_(True),
                        )
                    ).all()
                )
                for tok in tokens:
                    push_delivery = self._repo.create_delivery(
                        tenant_id=tenant_id,
                        event_id=event.id,
                        channel="push",
                    )
                    # Store token hint on provider_response via task
                    send_notification_task.delay(
                        str(event.id),
                        str(push_delivery.id),
                        tok.token,
                        tok.platform,
                    )
            except Exception:
                pass

        self._audit.log_entity_change(
            tenant_id=tenant_id,
            entity_name="ntf_event",
            entity_id=event.id,
            operation="create",
            performed_by=created_by,
        )
        return event

    def list_inbox(
        self, *, tenant_id: UUID, user_id: UUID | None, limit: int = 50
    ) -> list[NotificationInboxItem]:
        if user_id is None:
            raise AppException("Authenticated user required")
        rows = self._repo.list_inbox(tenant_id=tenant_id, user_id=user_id, limit=limit)
        return [self._to_inbox_item(row) for row in rows]

    def unread_count(self, *, tenant_id: UUID, user_id: UUID | None) -> int:
        if user_id is None:
            raise AppException("Authenticated user required")
        return self._repo.unread_count(tenant_id=tenant_id, user_id=user_id)

    def mark_read(
        self, *, tenant_id: UUID, user_id: UUID | None, event_id: UUID
    ) -> NotificationInboxItem:
        if user_id is None:
            raise AppException("Authenticated user required")
        row = self._repo.get_inbox_event(tenant_id=tenant_id, user_id=user_id, event_id=event_id)
        if row is None:
            raise NotFoundException("Notification not found")
        self._mark_event_read(row)
        self._repo.db.flush()
        return self._to_inbox_item(row)

    def mark_all_read(self, *, tenant_id: UUID, user_id: UUID | None) -> int:
        if user_id is None:
            raise AppException("Authenticated user required")
        rows = self._repo.list_unread(tenant_id=tenant_id, user_id=user_id)
        now = utcnow()
        for row in rows:
            if row.read_at is None:
                row.read_at = now
            row.status = "read"
        self._repo.db.flush()
        return len(rows)

    def find_unread_digest(
        self,
        *,
        tenant_id: UUID,
        user_id: UUID,
        event_type: str,
        digest_key: str,
    ) -> NtfEvent | None:
        return self._repo.find_unread_digest(
            tenant_id=tenant_id,
            user_id=user_id,
            event_type=event_type,
            digest_key=digest_key,
        )

    @staticmethod
    def _mark_event_read(row: NtfEvent) -> None:
        if row.read_at is None:
            row.read_at = utcnow()
        row.status = "read"

    @staticmethod
    def _to_inbox_item(row: NtfEvent) -> NotificationInboxItem:
        payload = row.payload_json if isinstance(row.payload_json, dict) else {}
        kind = str(payload.get("kind") or row.event_type or "info")
        href = sanitize_inbox_href(payload.get("href") or payload.get("action_href"), kind=kind)
        unread = row.read_at is None and row.status != "read"
        return NotificationInboxItem(
            id=row.id,
            title=str(payload.get("title") or row.event_type),
            body=str(payload.get("body") or ""),
            kind=kind,
            unread=unread,
            created_at=row.created_at,
            href=href,
            read_at=row.read_at,
        )

    def register_device_token(
        self,
        *,
        tenant_id: UUID,
        user_id: UUID,
        token: str,
        platform: str = "web",
        created_by: UUID | None = None,
    ):
        from uuid import uuid4

        from sqlalchemy import select

        from modules.foundation.models.device_token import NtfDeviceToken
        from modules.foundation.repository.base import utcnow

        if platform not in {"web", "android", "ios"}:
            platform = "web"
        existing = self._repo.db.scalar(
            select(NtfDeviceToken).where(
                NtfDeviceToken.tenant_id == tenant_id,
                NtfDeviceToken.user_id == user_id,
                NtfDeviceToken.token == token,
                NtfDeviceToken.is_deleted.is_(False),
            )
        )
        if existing:
            existing.is_active = True
            existing.platform = platform
            existing.updated_at = utcnow()
            existing.updated_by = created_by or user_id
            self._repo.db.flush()
            return existing
        row = NtfDeviceToken(
            id=uuid4(),
            tenant_id=tenant_id,
            user_id=user_id,
            token=token,
            platform=platform,
            is_active=True,
            created_by=created_by or user_id,
            updated_by=created_by or user_id,
        )
        self._repo.db.add(row)
        self._repo.db.flush()
        return row
