"""Shared HR in-app notification helpers."""

from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from modules.foundation.models.security import SecUser
from modules.foundation.service.notification_href import sanitize_inbox_href
from modules.master_data.published import EmployeeRead
from modules.platform.compat.notify_facade import PlatformNotifyFacade
from security.rbac import RBACEngine

logger = logging.getLogger(__name__)

_ENTITY_ID_KEYS = (
    "correction_id",
    "attendance_correction_id",
    "leave_request_id",
    "wfh_request_id",
    "compoff_request_id",
    "on_duty_request_id",
    "ot_request_id",
    "separation_id",
    "document_number",
    "href",
    "employee_id",
)


def _idem_suffix(payload: dict) -> str:
    for key in _ENTITY_ID_KEYS:
        value = payload.get(key)
        if value:
            return str(value)
    return str(payload.get("kind") or "in_app")


def _resolve_recipient_user_id(
    db: Session,
    *,
    tenant_id: UUID,
    user_id: UUID | None,
    email: str | None,
) -> UUID | None:
    if user_id is not None:
        return user_id
    address = (email or "").strip().lower()
    if not address:
        return None
    row = db.scalars(
        select(SecUser).where(
            SecUser.tenant_id == tenant_id,
            func.lower(SecUser.email) == address,
            SecUser.is_deleted.is_(False),
        )
    ).first()
    return row.id if row is not None else None


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
    resolved_user_id = _resolve_recipient_user_id(
        db,
        tenant_id=tenant_id,
        user_id=recipient_user_id,
        email=recipient_address,
    )
    if resolved_user_id is None and not recipient_address:
        return False
    payload = {"title": title, "body": body, "kind": kind}
    if extra:
        payload.update(extra)
    href = sanitize_inbox_href(payload.get("href"), kind=kind)
    if href:
        payload["href"] = href
    # Prefer outbox enqueue so approve APIs never block on sync SMTP/Celery/Redis.
    # Local broker flakes were hanging manager→HR actions for 45s+.
    PlatformNotifyFacade(db, use_outbox=True).send(
        tenant_id=tenant_id,
        template_code=template_code,
        event_type=event_type,
        recipient_user_id=resolved_user_id,
        recipient_address=recipient_address,
        payload_json=payload,
        channel="in_app",
        idempotency_key=(
            f"hr:{event_type}:{resolved_user_id or recipient_address}:"
            f"{_idem_suffix(payload)}"
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
    try:
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
    except Exception:
        logger.exception(
            "HR notify failed employee_id=%s event_type=%s", employee_id, event_type
        )
        return False
    if cc_reporting_manager and emp.reporting_manager_id:
        mgr = db.get(EmployeeRead, emp.reporting_manager_id)
        if mgr is not None:
            manager_extra = {**(extra or {}), "employee_id": str(employee_id)}
            # Reporting managers use ESS Approvals, not the HRMS inbox.
            if kind in {"leave", "wfh", "compoff", "on_duty", "attendance", "miss_punch"}:
                manager_extra["href"] = "/approvals"
            try:
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
            except Exception:
                logger.exception(
                    "HR manager CC notify failed employee_id=%s event_type=%s",
                    employee_id,
                    event_type,
                )
    return sent


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
        try:
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
        except Exception:
            logger.exception(
                "HR permission notify failed user_id=%s event_type=%s", uid, event_type
            )
    return count
