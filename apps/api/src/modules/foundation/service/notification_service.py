"""Notification service — Foundation Notification Engine (C-05 / DG-04)."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from core.config import settings
from core.exceptions import AppException, NotFoundException, ValidationException
from modules.foundation.adapters.graph_email_adapter import GraphEmailAdapter
from modules.foundation.domain.entities import NotificationInboxItem
from modules.foundation.models.notification import NtfEvent, NtfTemplate
from modules.foundation.repository.notification_repository import NotificationRepository
from modules.foundation.service.audit_service import AuditService
from modules.foundation.service.notification_href import sanitize_inbox_href
from modules.foundation.service.engines.email_delivery_engine import (
    EmailDeliveryEngine,
    render_template,
)
from modules.foundation.tasks import send_notification_task


class NotificationService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = NotificationRepository(db)
        self._audit = AuditService(db)
        self._graph = GraphEmailAdapter()

    def list_templates(self, tenant_id: UUID, *, channel: str | None = None):
        return self._repo.list_templates(tenant_id, channel=channel)

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
            new_value={"template_code": template_code, "channel": channel},
        )
        return template

    def list_events(self, tenant_id: UUID, *, limit: int = 100):
        return self._repo.list_events(tenant_id, limit=limit)

    def list_deliveries(self, tenant_id: UUID, *, limit: int = 100):
        return self._repo.list_deliveries(tenant_id, limit=limit)

    def email_provider_status(self) -> dict:
        diag = settings.graph_credential_diagnostics()
        return {
            "provider": "microsoft_graph",
            "configured": self._graph.configured,
            "from_email": self._graph.from_email if self._graph.from_email else None,
            "delivery_mode": settings.email_delivery_mode,
            "tenant_id_set": bool(settings.azure_tenant_id.strip()),
            "client_id_set": bool(settings.azure_client_id.strip()),
            "client_secret_set": bool(settings.azure_client_secret.strip()),
            "diagnostics": diag,
        }

    def test_email_connection(self) -> dict:
        result = self._graph.test_connection()
        diag = settings.graph_credential_diagnostics()
        return {
            "ok": result.ok,
            "message": result.message,
            "status_code": result.status_code,
            "from_email": self._graph.from_email or None,
            "provider_response": result.provider_response,
            "diagnostics": diag,
            "details": {
                "step": "token" if self._graph.configured else "config",
                "hint": diag.get("hint"),
                "missing": diag.get("missing"),
                "present": diag.get("present"),
                "env_files_found": diag.get("env_files_found"),
                "tenant_id_preview": diag.get("tenant_id_preview"),
                "client_id_preview": diag.get("client_id_preview"),
            },
        }

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
        channel_override: str | None = None,
    ):
        template = self._db.get(NtfTemplate, template_id)
        if template is None or template.tenant_id != tenant_id or template.is_deleted:
            raise NotFoundException("Notification template not found")

        channel = channel_override or template.channel or "in_app"
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
        self._audit.log_entity_change(
            tenant_id=tenant_id,
            entity_name="ntf_event",
            entity_id=event.id,
            operation="create",
            performed_by=created_by,
            new_value={"event_type": event_type, "channel": channel},
        )
        self._db.flush()
        self._dispatch(event.id, delivery.id)

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
                    try:
                        send_notification_task.delay(
                            str(event.id),
                            str(push_delivery.id),
                            tok.token,
                            tok.platform,
                        )
                    except Exception:  # noqa: BLE001 — broker optional in local
                        pass
            except Exception:  # noqa: BLE001 — push fan-out must not break primary send
                pass

        return event

    def send_email(
        self,
        *,
        tenant_id: UUID,
        to_address: str,
        subject: str,
        body_html: str,
        event_type: str = "email.compose",
        template_id: UUID | None = None,
        payload_json: dict | None = None,
        created_by: UUID | None = None,
    ):
        to = (to_address or "").strip()
        if not to:
            raise ValidationException("Recipient email is required")
        if not subject.strip():
            raise ValidationException("Subject is required")

        payload = dict(payload_json or {})
        tpl: NtfTemplate | None = None
        if template_id is not None:
            tpl = self._db.get(NtfTemplate, template_id)
            if tpl is None or tpl.tenant_id != tenant_id or tpl.is_deleted:
                raise NotFoundException("Notification template not found")
            if tpl.channel != "email":
                raise ValidationException("Template channel must be email")
            subject = render_template(tpl.subject_template, {**payload, **{"subject": subject}}) or subject
            body_html = render_template(tpl.body_template, {**payload, **{"body": body_html}}) or body_html
        else:
            tpl = self._repo.ensure_direct_email_template(tenant_id=tenant_id, created_by=created_by)

        payload["_subject"] = subject
        payload["_body"] = body_html

        return self.send(
            tenant_id=tenant_id,
            template_id=tpl.id,
            event_type=event_type,
            recipient_user_id=None,
            recipient_address=to,
            payload_json=payload,
            created_by=created_by,
            channel_override="email",
        )

    def overview(self, tenant_id: UUID) -> dict:
        templates = self._repo.list_templates(tenant_id, channel="email")
        events = self._repo.list_events(tenant_id, limit=50)
        deliveries = self._repo.list_deliveries(tenant_id, limit=50)
        delivered = sum(1 for d in deliveries if d["status"] == "delivered")
        failed = sum(1 for d in deliveries if d["status"] == "failed")
        queued = sum(1 for e in events if e["status"] == "queued")
        return {
            "provider": self.email_provider_status(),
            "counts": {
                "email_templates": len(templates),
                "events": len(events),
                "deliveries": len(deliveries),
                "delivered": delivered,
                "failed": failed,
                "queued": queued,
            },
            "recent_deliveries": deliveries[:10],
            "recent_events": events[:10],
        }

    def _dispatch(self, event_id: UUID, delivery_id: UUID) -> None:
        mode = (settings.email_delivery_mode or "sync").strip().lower()
        if mode == "sync":
            EmailDeliveryEngine(self._db).deliver(event_id, delivery_id)
            return
        try:
            send_notification_task.delay(str(event_id), str(delivery_id))
        except Exception:  # noqa: BLE001 — fall back to sync if broker unavailable
            EmailDeliveryEngine(self._db).deliver(event_id, delivery_id)


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
        from modules.foundation.repository.base import utcnow

        if user_id is None:
            raise AppException("Authenticated user required")
        row = self._repo.get_inbox_event(tenant_id=tenant_id, user_id=user_id, event_id=event_id)
        if row is None:
            raise NotFoundException("Notification not found")
        if row.read_at is None:
            row.read_at = utcnow()
        row.status = "read"
        self._repo.db.flush()
        return self._to_inbox_item(row)

    def mark_all_read(self, *, tenant_id: UUID, user_id: UUID | None) -> int:
        from modules.foundation.repository.base import utcnow

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
