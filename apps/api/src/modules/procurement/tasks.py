"""Procurement Celery tasks."""

from workers.celery_app import celery_app


@celery_app.task(name="procurement.expire_vendor_quotations")
def expire_vendor_quotations() -> dict:
    """Mark past-valid_until vendor quotations as expired."""
    return {"status": "stub", "expired": 0}


@celery_app.task(name="procurement.retry_invoice_posting")
def retry_invoice_posting() -> dict:
    """Retry failed purchase invoice finance postings."""
    return {"status": "stub", "retried": 0}


@celery_app.task(name="procurement.delivery_notifications")
def delivery_notifications() -> dict:
    """Acknowledge new orders, chase distributors for an ETD, update customers.

    Idempotent: every message is stamped on the PO, so re-running the pass does
    not re-send anything.
    """
    from uuid import uuid4

    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.foundation.domain.value_objects import TenantContext
    from modules.procurement.models.order import ProcOrderHeader
    from modules.procurement.service.scm_delivery_notification_service import (
        ScmDeliveryNotificationService,
    )

    db = SessionLocal()
    try:
        tenant_ids = list(
            db.scalars(
                select(ProcOrderHeader.tenant_id)
                .where(ProcOrderHeader.is_deleted.is_(False))
                .distinct()
            ).all()
        )
        system_user = uuid4()
        totals = {"acknowledged": 0, "etd_chased": 0, "delivery_dates_shared": 0}
        for tenant_id in tenant_ids:
            ctx = TenantContext(
                tenant_id=tenant_id,
                user_id=system_user,
                user_type="super_admin",
            )
            try:
                counts = ScmDeliveryNotificationService(db).run(ctx)
            except Exception:
                db.rollback()
                continue
            db.commit()
            for key, value in counts.items():
                totals[key] += value
        return {"status": "ok", **totals}
    finally:
        db.close()
