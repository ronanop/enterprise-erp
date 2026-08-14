"""Notification repository."""

from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from modules.foundation.domain.entities import NotificationTemplateEntity
from modules.foundation.models.notification import NtfDelivery, NtfEvent, NtfTemplate
from modules.foundation.repository.base import TenantScopedRepository, utcnow


class NotificationRepository(TenantScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def list_templates(self, tenant_id: UUID) -> list[NotificationTemplateEntity]:
        stmt = select(NtfTemplate).where(
            NtfTemplate.tenant_id == tenant_id,
            NtfTemplate.is_deleted.is_(False),
        )
        return [self._tpl_to_entity(r) for r in self.db.scalars(stmt).all()]

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
    ) -> NotificationTemplateEntity:
        row = NtfTemplate(
            id=uuid4(),
            tenant_id=tenant_id,
            template_code=template_code,
            template_name=template_name,
            channel=channel,
            body_template=body_template,
            subject_template=subject_template,
            created_by=created_by,
            updated_by=created_by,
        )
        self.db.add(row)
        self.db.flush()
        return self._tpl_to_entity(row)

    def create_event(
        self,
        *,
        tenant_id: UUID,
        template_id: UUID,
        event_type: str,
        recipient_user_id: UUID | None,
        recipient_address: str | None,
        payload_json: dict | None,
    ) -> NtfEvent:
        row = NtfEvent(
            id=uuid4(),
            tenant_id=tenant_id,
            template_id=template_id,
            event_type=event_type,
            recipient_user_id=recipient_user_id,
            recipient_address=recipient_address,
            payload_json=payload_json,
            status="queued",
            created_at=utcnow(),
        )
        self.db.add(row)
        self.db.flush()
        return row

    def create_delivery(self, *, tenant_id: UUID, event_id: UUID, channel: str) -> NtfDelivery:
        row = NtfDelivery(
            id=uuid4(),
            tenant_id=tenant_id,
            event_id=event_id,
            channel=channel,
            attempt_no=1,
            status="pending",
        )
        self.db.add(row)
        self.db.flush()
        return row

    def list_events(self, tenant_id: UUID) -> list[NtfEvent]:
        stmt = select(NtfEvent).where(NtfEvent.tenant_id == tenant_id)
        return list(self.db.scalars(stmt).all())

    def list_inbox(self, *, tenant_id: UUID, user_id: UUID, limit: int = 50) -> list[NtfEvent]:
        stmt = (
            select(NtfEvent)
            .where(
                NtfEvent.tenant_id == tenant_id,
                NtfEvent.recipient_user_id == user_id,
            )
            .order_by(NtfEvent.created_at.desc())
            .limit(limit)
        )
        return list(self.db.scalars(stmt).all())

    def unread_count(self, *, tenant_id: UUID, user_id: UUID) -> int:
        count = self.db.scalar(
            select(func.count())
            .select_from(NtfEvent)
            .where(
                NtfEvent.tenant_id == tenant_id,
                NtfEvent.recipient_user_id == user_id,
                NtfEvent.read_at.is_(None),
                NtfEvent.status != "read",
            )
        )
        return int(count or 0)

    def get_inbox_event(self, *, tenant_id: UUID, user_id: UUID, event_id: UUID) -> NtfEvent | None:
        stmt = select(NtfEvent).where(
            NtfEvent.id == event_id,
            NtfEvent.tenant_id == tenant_id,
            NtfEvent.recipient_user_id == user_id,
        )
        return self.db.scalar(stmt)

    def list_unread(self, *, tenant_id: UUID, user_id: UUID) -> list[NtfEvent]:
        stmt = select(NtfEvent).where(
            NtfEvent.tenant_id == tenant_id,
            NtfEvent.recipient_user_id == user_id,
            NtfEvent.read_at.is_(None),
            NtfEvent.status != "read",
        )
        return list(self.db.scalars(stmt).all())

    def find_unread_digest(
        self,
        *,
        tenant_id: UUID,
        user_id: UUID,
        event_type: str,
        digest_key: str,
    ) -> NtfEvent | None:
        stmt = (
            select(NtfEvent)
            .where(
                NtfEvent.tenant_id == tenant_id,
                NtfEvent.recipient_user_id == user_id,
                NtfEvent.event_type == event_type,
                NtfEvent.read_at.is_(None),
                NtfEvent.status != "read",
                NtfEvent.payload_json.contains({"digest_key": digest_key}),
            )
            .order_by(NtfEvent.created_at.desc())
            .limit(1)
        )
        return self.db.scalar(stmt)

    @staticmethod
    def _tpl_to_entity(row: NtfTemplate) -> NotificationTemplateEntity:
        return NotificationTemplateEntity(
            id=row.id,
            tenant_id=row.tenant_id,
            template_code=row.template_code,
            template_name=row.template_name,
            channel=row.channel,
            body_template=row.body_template,
            locale=row.locale,
            subject_template=row.subject_template,
            is_active=row.is_active,
        )
