"""Shared HR in-app notification helpers."""

from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy.orm import Session

from core.config import settings
from modules.foundation.models.security import SecUser
from modules.foundation.service.notification_href import sanitize_inbox_href
from modules.master_data.published import EmployeeRead
from modules.platform.compat.notify_facade import PlatformNotifyFacade
from security.rbac import RBACEngine
from shared.text_safety import escape_html_text

logger = logging.getLogger(__name__)


def _send_in_app(
    db: Session,
    *,
    tenant_id: UUID,
    recipient_user_id: UUID | None,
    recipient_address: str | None,
    template_code: str,
    template_name: str,
    event_type: str,
    title: str,
    body: str,
    kind: str,
    extra: dict | None = None,
) -> bool:
    _ = template_name
    if recipient_user_id is None and not recipient_address:
        return False
    payload = {"title": title, "body": body, "kind": kind}
    if extra:
        payload.update(extra)
    href = sanitize_inbox_href(payload.get("href"), kind=kind)
    if href:
        payload["href"] = href
    PlatformNotifyFacade(db).send(
        tenant_id=tenant_id,
        template_code=template_code,
        event_type=event_type,
        recipient_user_id=recipient_user_id,
        recipient_address=recipient_address,
        payload_json=payload,
        channel="in_app",
        idempotency_key=(
            f"hr:{event_type}:{recipient_user_id or recipient_address}:"
            f"{payload.get('employee_id') or payload.get('href') or kind}"
        ),
    )
    return True


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
    cc_reporting_manager: bool = True,
) -> bool:
    emp = db.get(EmployeeRead, employee_id)
    if emp is None:
        return False
    sent = _send_in_app(
        db,
        tenant_id=tenant_id,
        recipient_user_id=emp.user_id,
        recipient_address=emp.email,
        template_code=template_code,
        template_name=template_name,
        event_type=event_type,
        title=title,
        body=body,
        kind=kind,
        extra={**(extra or {}), "employee_id": str(employee_id)},
    )
    if cc_reporting_manager and emp.reporting_manager_id:
        mgr = db.get(EmployeeRead, emp.reporting_manager_id)
        if mgr is not None:
            manager_extra = {**(extra or {}), "employee_id": str(employee_id)}
            if kind == "leave":
                manager_extra["href"] = "/hr/ess-inbox"
            _send_in_app(
                db,
                tenant_id=tenant_id,
                recipient_user_id=mgr.user_id,
                recipient_address=mgr.email,
                template_code=template_code,
                template_name=template_name,
                event_type=event_type,
                title=f"[Manager] {title}",
                body=body,
                kind=kind,
                extra=manager_extra,
            )
    return sent


def email_employee(
    db: Session,
    *,
    tenant_id: UUID,
    employee_id: UUID,
    subject: str,
    body_html: str,
    event_type: str,
    created_by: UUID | None = None,
    payload_json: dict | None = None,
) -> bool:
    """Send SMTP mail to an employee's official email via the Notification Engine."""
    from modules.foundation.service.notification_service import NotificationService

    if not settings.smtp_configured:
        return False
    emp = db.get(EmployeeRead, employee_id)
    if emp is None or emp.is_deleted:
        return False
    to_addr = str(emp.email or "").strip()
    if not to_addr or "@" not in to_addr:
        return False
    try:
        NotificationService(db).send_email(
            tenant_id=tenant_id,
            to_address=to_addr,
            subject=subject,
            body_html=body_html,
            event_type=event_type,
            created_by=created_by,
            payload_json=payload_json,
        )
        return True
    except Exception as exc:  # noqa: BLE001 - enrollment must not fail create
        logger.warning("HR email to employee %s failed: %s", employee_id, exc)
        return False


def notify_training_enrollment(
    db: Session,
    *,
    tenant_id: UUID,
    employee_id: UUID,
    training_id: UUID,
    training_name: str,
    training_code: str,
    start_date: str,
    start_time: str,
    end_time: str,
    host_name: str,
    room_name: str,
    created_by: UUID | None = None,
) -> dict[str, bool]:
    """In-app + SMTP enrollment notice for one training attendee."""
    name_safe = escape_html_text(training_name)
    date_safe = escape_html_text(start_date) or "TBD"
    time_bits = " – ".join(p for p in (start_time, end_time) if p)
    time_safe = escape_html_text(time_bits) if time_bits else ""
    host_safe = escape_html_text(host_name)
    room_safe = escape_html_text(room_name)
    code_safe = escape_html_text(training_code)

    title = f"Enrolled: {training_name}"
    plain_body = (
        f'You are enrolled in "{training_name}"'
        f"{f' ({training_code})' if training_code else ''}"
        f" on {start_date or 'TBD'}"
        f"{f' at {time_bits}' if time_bits else ''}."
    )
    if host_name:
        plain_body += f" Host: {host_name}."
    if room_name:
        plain_body += f" Room: {room_name}."

    in_app = notify_employee(
        db,
        tenant_id=tenant_id,
        employee_id=employee_id,
        template_code="HR_TRAINING_ENROLLMENT",
        template_name="Training enrollment",
        event_type="hr.training.enrollment",
        title=title,
        body=plain_body,
        kind="training",
        extra={
            "href": "/hr/training",
            "training_id": str(training_id),
            "training_name": training_name,
        },
        cc_reporting_manager=False,
    )

    rows = [
        f"<li><strong>Date:</strong> {date_safe}</li>",
    ]
    if time_safe:
        rows.append(f"<li><strong>Time:</strong> {time_safe}</li>")
    if host_safe:
        rows.append(f"<li><strong>Host:</strong> {host_safe}</li>")
    if room_safe:
        rows.append(f"<li><strong>Room:</strong> {room_safe}</li>")
    if code_safe:
        rows.append(f"<li><strong>Code:</strong> {code_safe}</li>")

    emp = db.get(EmployeeRead, employee_id)
    greet = escape_html_text(
        f"{getattr(emp, 'first_name', '') or ''} {getattr(emp, 'last_name', '') or ''}".strip()
        or "there"
    )
    body_html = (
        f"<p>Hello {greet},</p>"
        f"<p>You have been enrolled in the following training:</p>"
        f"<p><strong>{name_safe}</strong></p>"
        f"<ul>{''.join(rows)}</ul>"
        "<p>Please attend as scheduled. If you have questions, contact HR.</p>"
        "<p>— HR Team</p>"
    )
    emailed = email_employee(
        db,
        tenant_id=tenant_id,
        employee_id=employee_id,
        subject=f"Training enrollment: {training_name}",
        body_html=body_html,
        event_type="hr.training.enrollment",
        created_by=created_by,
        payload_json={
            "training_id": str(training_id),
            "training_name": training_name,
            "employee_id": str(employee_id),
        },
    )
    return {"in_app": in_app, "email": emailed}


def notify_users_with_permission(
    db: Session,
    *,
    tenant_id: UUID,
    permission_code: str,
    template_code: str,
    template_name: str,
    event_type: str,
    title: str,
    body: str,
    kind: str,
    extra: dict | None = None,
    exclude_user_ids: set[UUID] | None = None,
) -> int:
    """Notify every active user with the given permission (e.g. HR on manager approval)."""
    exclude = exclude_user_ids or set()
    user_ids = RBACEngine(db).list_user_ids_with_permission(tenant_id, permission_code)
    count = 0
    for uid in user_ids:
        if uid in exclude:
            continue
        user = db.get(SecUser, uid)
        if user is None or getattr(user, "is_deleted", False) or user.status != "active":
            continue
        if _send_in_app(
            db,
            tenant_id=tenant_id,
            recipient_user_id=user.id,
            recipient_address=user.email,
            template_code=template_code,
            template_name=template_name,
            event_type=event_type,
            title=title,
            body=body,
            kind=kind,
            extra=extra,
        ):
            count += 1
    return count
