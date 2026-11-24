"""Notify everyone on the current shift roster until a ticket is opened.

Runs on ticket create (immediate) and on a 10-minute schedule while opened_at
is still null. Stops once open_ticket / resume sets opened_at (or ticket ends).
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.config import settings
from modules.foundation.domain.value_objects import TenantContext
from modules.master_data.models.employee import MasterEmployee
from modules.service.adapters.hr_port import ServiceHrAdapter
from modules.service.models import SvcServiceNotification, SvcServiceRequest

logger = logging.getLogger(__name__)

NOTIFICATION_TYPE = "roster_open_reminder"
TERMINAL_STATUSES = ("draft", "resolved", "closed", "cancelled")
_SYSTEM_USER = UUID("00000000-0000-0000-0000-000000000001")


class RosterOpenReminderService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._hr = ServiceHrAdapter(db)

    @property
    def enabled(self) -> bool:
        return bool(settings.service_roster_open_reminder_enabled)

    @property
    def interval(self) -> timedelta:
        seconds = max(60, int(settings.service_roster_open_reminder_seconds or 600))
        return timedelta(seconds=seconds)

    def notify_on_duty_roster(
        self,
        ctx: TenantContext,
        row: SvcServiceRequest,
        *,
        message: str | None = None,
        force: bool = False,
    ) -> int:
        """Fan out in-app notifications to every on-duty roster member with a user account."""
        if not self.enabled:
            return 0
        if row.opened_at is not None or (row.status or "").lower() in TERMINAL_STATUSES:
            return 0

        on_duty = self._hr.list_on_duty_employee_ids_for_reminders(
            ctx, company_id=row.company_id
        )
        if not on_duty:
            return 0

        if not force and self._recently_reminded(row.id):
            return 0

        recipients = self._user_ids_for_employees(ctx.tenant_id, on_duty)
        if not recipients:
            return 0

        now = datetime.now(timezone.utc)
        doc = row.document_number or str(row.id)
        text = message or (
            f"Unopened ticket {doc} is waiting on your shift — open it or assign an owner"
        )
        created = 0
        for employee_id, user_id in recipients:
            self._db.add(
                SvcServiceNotification(
                    id=uuid.uuid4(),
                    tenant_id=ctx.tenant_id,
                    company_id=row.company_id,
                    branch_id=row.branch_id,
                    request_id=row.id,
                    notification_type=NOTIFICATION_TYPE,
                    recipient_user_id=user_id,
                    recipient_employee_id=employee_id,
                    payload_json={
                        "message": text,
                        "ticket_id": str(row.id),
                        "document_number": row.document_number,
                        "for_roster": True,
                        "employee_id": str(employee_id),
                    },
                    sent_at=now,
                    delivery_status="pending",
                    status="active",
                    created_by=ctx.user_id,
                    updated_by=ctx.user_id,
                )
            )
            created += 1
        if created:
            self._db.flush()
        return created

    def send_unopened_reminders(self) -> dict:
        """Scan all unopened tickets and ping the live shift roster (deduped by interval)."""
        if not self.enabled:
            return {"status": "skipped", "reason": "roster open reminders disabled"}

        rows = list(
            self._db.scalars(
                select(SvcServiceRequest).where(
                    SvcServiceRequest.is_deleted.is_(False),
                    SvcServiceRequest.opened_at.is_(None),
                    SvcServiceRequest.status.notin_(list(TERMINAL_STATUSES)),
                )
            ).all()
        )
        if not rows:
            return {"status": "ok", "tickets": 0, "notifications": 0}

        by_scope: dict[tuple[UUID, UUID], list[SvcServiceRequest]] = {}
        for row in rows:
            by_scope.setdefault((row.tenant_id, row.company_id), []).append(row)

        notified_tickets = 0
        total_notifications = 0
        for (tenant_id, company_id), group in by_scope.items():
            ctx = TenantContext(
                tenant_id=tenant_id,
                user_id=_SYSTEM_USER,
                company_id=company_id,
                branch_id=None,
                user_type="tenant_admin",
            )
            for row in group:
                count = self.notify_on_duty_roster(ctx, row, force=False)
                if count:
                    notified_tickets += 1
                    total_notifications += count

        self._db.commit()
        return {
            "status": "ok",
            "tickets_scanned": len(rows),
            "tickets_notified": notified_tickets,
            "notifications": total_notifications,
        }

    def _recently_reminded(self, request_id: UUID) -> bool:
        """Skip if this ticket already got a roster ping inside the reminder window."""
        cutoff = datetime.now(timezone.utc) - self.interval + timedelta(seconds=30)
        existing = self._db.scalar(
            select(SvcServiceNotification.id)
            .where(
                SvcServiceNotification.request_id == request_id,
                SvcServiceNotification.notification_type == NOTIFICATION_TYPE,
                SvcServiceNotification.is_deleted.is_(False),
                SvcServiceNotification.sent_at.is_not(None),
                SvcServiceNotification.sent_at >= cutoff,
            )
            .limit(1)
        )
        return existing is not None

    def _user_ids_for_employees(
        self, tenant_id: UUID, employee_ids: set[UUID]
    ) -> list[tuple[UUID, UUID]]:
        if not employee_ids:
            return []
        rows = list(
            self._db.execute(
                select(MasterEmployee.id, MasterEmployee.user_id).where(
                    MasterEmployee.tenant_id == tenant_id,
                    MasterEmployee.id.in_(employee_ids),
                    MasterEmployee.is_deleted.is_(False),
                    MasterEmployee.status == "active",
                    MasterEmployee.user_id.is_not(None),
                )
            ).all()
        )
        out: list[tuple[UUID, UUID]] = []
        seen_users: set[UUID] = set()
        for emp_id, user_id in rows:
            if user_id is None or user_id in seen_users:
                continue
            seen_users.add(user_id)
            out.append((emp_id, user_id))
        return out


def run_unopened_roster_reminders(db: Session | None = None) -> dict:
    """Entry point for Celery / API lifespan — owns session when none is passed."""
    owns = db is None
    if owns:
        from database.session import SessionLocal

        db = SessionLocal()
    assert db is not None
    try:
        return RosterOpenReminderService(db).send_unopened_reminders()
    except Exception:
        if owns:
            db.rollback()
        logger.exception("roster open reminder run failed")
        raise
    finally:
        if owns:
            db.close()
