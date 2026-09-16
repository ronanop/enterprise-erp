"""Finance Celery tasks."""

from datetime import date

from database.session import SessionLocal
from modules.finance.repository.subledger_repository import SubLedgerRepository
from workers.celery_app import celery_app


@celery_app.task(name="finance.process_recurring_journals")
def process_recurring_journals() -> dict:
    """Stub - recurring journal templates deferred to Sprint 5+."""
    return {"status": "stub", "processed": 0}


@celery_app.task(name="finance.sync_currency_rates")
def sync_currency_rates() -> dict:
    """Placeholder for external rate feed integration."""
    return {"status": "stub", "message": "Manual currency rates required"}


@celery_app.task(name="finance.period_close_reminder")
def period_close_reminder() -> dict:
    """Notify finance managers of open periods approaching month-end."""
    return {"status": "stub", "reminders_sent": 0}


@celery_app.task(name="finance.compute_aging_buckets")
def compute_aging_buckets() -> dict:
    db = SessionLocal()
    try:
        from sqlalchemy import select

        from modules.foundation.models.security import SecTenant

        tenants = db.scalars(select(SecTenant).where(SecTenant.is_deleted.is_(False))).all()
        updated = 0
        repo = SubLedgerRepository(db)
        today = date.today()
        for tenant in tenants:
            from modules.organization.models.company import OrgCompany

            companies = db.scalars(
                select(OrgCompany).where(
                    OrgCompany.tenant_id == tenant.id,
                    OrgCompany.is_deleted.is_(False),
                )
            ).all()
            for company in companies:
                from modules.foundation.domain.value_objects import TenantContext

                ctx = TenantContext(
                    tenant_id=tenant.id,
                    user_id=tenant.id,
                    user_type="tenant_admin",
                )
                for entry in repo.list_open_ar_for_aging(ctx, company.id):
                    entry.aging_bucket = repo.compute_aging_bucket(entry.due_date, today)
                    updated += 1
                for entry in repo.list_open_ap_for_aging(ctx, company.id):
                    entry.aging_bucket = repo.compute_aging_bucket(entry.due_date, today)
                    updated += 1
        db.commit()
        return {"status": "ok", "updated": updated}
    finally:
        db.close()
