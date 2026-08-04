"""Celery tasks for foundation module."""

from uuid import UUID

from database.session import SessionLocal
from modules.foundation.service.engines.email_delivery_engine import EmailDeliveryEngine
from workers.celery_app import celery_app


@celery_app.task(name="foundation.send_notification")
def send_notification_task(event_id: str, delivery_id: str) -> dict:
    db = SessionLocal()
    try:
        return EmailDeliveryEngine(db).deliver(UUID(event_id), UUID(delivery_id))
    finally:
        db.close()


@celery_app.task(name="foundation.workflow_escalation")
def workflow_escalation_stub() -> dict:
    """Stub for SLA-based workflow escalation — full logic in Sprint 2+."""
    return {"status": "stub", "escalated": 0}
