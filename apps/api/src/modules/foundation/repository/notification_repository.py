"""Notification repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from modules.foundation.domain.entities import NotificationTemplateEntity
from modules.foundation.models.notification import NtfDelivery, NtfEvent, NtfTemplate
from modules.foundation.repository.base import TenantScopedRepository, utcnow

DIRECT_EMAIL_TEMPLATE_CODE = "EMAIL_DIRECT"


class NotificationRepository(TenantScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def list_templates(
        self, tenant_id: UUID, *, channel: str | None = None
    ) -> list[NotificationTemplateEntity]:
        stmt = select(NtfTemplate).where(
            NtfTemplate.tenant_id == tenant_id,
            NtfTemplate.is_deleted.is_(False),
        )
        if channel:
            stmt = stmt.where(NtfTemplate.channel == channel)
        stmt = stmt.order_by(NtfTemplate.template_code.asc())
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

    def ensure_direct_email_template(
        self, *, tenant_id: UUID, created_by: UUID | None = None
    ) -> NtfTemplate:
        stmt = select(NtfTemplate).where(
            NtfTemplate.tenant_id == tenant_id,
            NtfTemplate.template_code == DIRECT_EMAIL_TEMPLATE_CODE,
            NtfTemplate.channel == "email",
            NtfTemplate.is_deleted.is_(False),
        )
        existing = self.db.scalars(stmt).first()
        if existing is not None:
            return existing
        row = NtfTemplate(
            id=uuid4(),
            tenant_id=tenant_id,
            template_code=DIRECT_EMAIL_TEMPLATE_CODE,
            template_name="Direct compose email",
            channel="email",
            subject_template="{{_subject}}",
            body_template="{{_body}}",
            created_by=created_by,
            updated_by=created_by,
        )
        self.db.add(row)
        self.db.flush()
        return row

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

    def list_events(self, tenant_id: UUID, *, limit: int = 100) -> list[dict]:
        stmt = (
            select(NtfEvent)
            .where(NtfEvent.tenant_id == tenant_id)
            .order_by(NtfEvent.created_at.desc())
            .limit(limit)
        )
        rows = list(self.db.scalars(stmt).all())
        return [
            {
                "id": str(e.id),
                "template_id": str(e.template_id),
                "event_type": e.event_type,
                "recipient_address": e.recipient_address,
                "recipient_user_id": str(e.recipient_user_id) if e.recipient_user_id else None,
                "status": e.status,
                "created_at": e.created_at.isoformat() if e.created_at else None,
                "payload_json": e.payload_json,
            }
            for e in rows
        ]

    def list_events_for_recipient(
        self,
        tenant_id: UUID,
        recipient_user_id: UUID,
        *,
        event_type_prefix: str | None = None,
        limit: int = 30,
    ) -> list[dict]:
        stmt = (
            select(NtfEvent)
            .where(
                NtfEvent.tenant_id == tenant_id,
                NtfEvent.recipient_user_id == recipient_user_id,
            )
            .order_by(NtfEvent.created_at.desc())
            .limit(limit)
        )
        if event_type_prefix:
            stmt = stmt.where(NtfEvent.event_type.like(f"{event_type_prefix}%"))
        rows = list(self.db.scalars(stmt).all())
        return [
            {
                "id": str(e.id),
                "event_type": e.event_type,
                "status": e.status,
                "created_at": e.created_at.isoformat() if e.created_at else None,
                "payload_json": e.payload_json,
            }
            for e in rows
        ]

    def list_deliveries(self, tenant_id: UUID, *, limit: int = 100) -> list[dict]:
        stmt = (
            select(NtfDelivery)
            .options(joinedload(NtfDelivery.event))
            .where(NtfDelivery.tenant_id == tenant_id)
            .order_by(NtfDelivery.id.desc())
            .limit(limit)
        )
        rows = list(self.db.scalars(stmt).unique().all())
        result: list[dict] = []
        for d in rows:
            event = d.event
            result.append(
                {
                    "id": str(d.id),
                    "event_id": str(d.event_id),
                    "channel": d.channel,
                    "attempt_no": d.attempt_no,
                    "status": d.status,
                    "provider_response": d.provider_response,
                    "delivered_at": d.delivered_at.isoformat() if d.delivered_at else None,
                    "event_type": event.event_type if event else None,
                    "recipient_address": event.recipient_address if event else None,
                    "event_status": event.status if event else None,
                    "created_at": event.created_at.isoformat() if event and event.created_at else None,
                    "subject": (event.payload_json or {}).get("_subject") if event else None,
                }
            )
        return result

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
