"""CRM in-app notifications (Foundation notification engine)."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.service.notification_service import NotificationService


def notify_approval_rejected(
    db: Session,
    *,
    tenant_id: UUID,
    recipient_user_id: UUID,
    title: str,
    body: str,
    entity_type: str,
    entity_id: UUID,
    task_title: str | None = None,
    remark: str | None = None,
    created_by: UUID | None = None,
) -> None:
    from modules.foundation.repository.base import utcnow

    notif = NotificationService(db)
    tpl = notif.get_or_create_template(
        tenant_id=tenant_id,
        template_code="crm.approval_rejected",
        template_name="CRM approval rejected",
        channel="in_app",
        subject_template="{{title}}",
        body_template="{{body}}",
        created_by=created_by,
    )
    digest_key = f"{entity_type}:{entity_id}"
    payload = {
        "title": title,
        "body": body,
        "kind": "crm_approval_rejected",
        "entity_type": entity_type,
        "entity_id": str(entity_id),
        "task_title": task_title,
        "remark": remark,
        "digest_key": digest_key,
    }
    existing = notif.find_unread_digest(
        tenant_id=tenant_id,
        user_id=recipient_user_id,
        event_type="crm.approval.rejected",
        digest_key=digest_key,
    )
    if existing is not None:
        existing.payload_json = payload
        existing.created_at = utcnow()
        db.flush()
        return

    notif.send(
        tenant_id=tenant_id,
        template_id=tpl.id,
        event_type="crm.approval.rejected",
        recipient_user_id=recipient_user_id,
        recipient_address=None,
        payload_json=payload,
        created_by=created_by,
    )
