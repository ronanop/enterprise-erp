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
        templates = self._repo.list_templates(tenant_id)
        template = next((t for t in templates if t.id == template_id), None)
        channel = (getattr(template, "channel", None) or "in_app").lower()
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
            channel=channel,
        )
        send_notification_task.delay(str(event.id), str(delivery.id))
        self._audit.log_entity_change(
            tenant_id=tenant_id,
            entity_name="ntf_event",
            entity_id=event.id,
            operation="create",
            performed_by=created_by,
        )
        return event
