"""Notification service."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.repository.notification_repository import NotificationRepository
from modules.foundation.service.audit_service import AuditService
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
        send_notification_task.delay(str(event.id), str(delivery.id))

        # Fan-out push deliveries when the user has registered device tokens
        if recipient_user_id is not None:
            try:
                from modules.foundation.models.device_token import NtfDeviceToken
                from sqlalchemy import select

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

    def register_device_token(
        self,
        *,
        tenant_id: UUID,
        user_id: UUID,
        token: str,
        platform: str = "web",
        created_by: UUID | None = None,
    ):
        from modules.foundation.models.device_token import NtfDeviceToken
        from sqlalchemy import select
        from uuid import uuid4

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
