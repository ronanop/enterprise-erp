"""Shared HR in-app notification helpers."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.service.notification_service import NotificationService
from modules.master_data.models.employee import MasterEmployee


def notify_employee(
    db: Session,
    *,
    tenant_id: UUID,
    employee_id: UUID,
    template_code: str,
    template_name: str,
    event_type: str,
    title: str,
    body: str,
    kind: str,
    extra: dict | None = None,
) -> bool:
    emp = db.get(MasterEmployee, employee_id)
    if emp is None:
        return False
    notif = NotificationService(db)
    tpl = notif.get_or_create_template(
        tenant_id=tenant_id,
        template_code=template_code,
        template_name=template_name,
        channel="in_app",
        subject_template=title,
        body_template=body,
    )
    payload = {"title": title, "body": body, "kind": kind, "employee_id": str(employee_id)}
    if extra:
        payload.update(extra)
    notif.send(
        tenant_id=tenant_id,
        template_id=tpl.id,
        event_type=event_type,
        recipient_user_id=emp.user_id,
        recipient_address=emp.email,
        payload_json=payload,
    )
    if emp.reporting_manager_id:
        mgr = db.get(MasterEmployee, emp.reporting_manager_id)
        if mgr is not None:
            notif.send(
                tenant_id=tenant_id,
                template_id=tpl.id,
                event_type=event_type,
                recipient_user_id=mgr.user_id,
                recipient_address=mgr.email,
                payload_json={**payload, "title": f"[Manager] {title}"},
            )
    return True
