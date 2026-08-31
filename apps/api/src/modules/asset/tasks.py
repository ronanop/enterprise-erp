"""Asset Celery tasks per ERD_15 section 15 (FP-ASSET-006 scheduler productized)."""

from datetime import date

from workers.celery_app import celery_app


@celery_app.task(name="asset.maintenance_due_alerts")
def maintenance_due_alerts() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.asset.models import AstAssetMaintenancePlan

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(AstAssetMaintenancePlan).where(
                    AstAssetMaintenancePlan.is_deleted.is_(False),
                    AstAssetMaintenancePlan.status == "active",
                )
            ).all()
        )
        return {"status": "ok", "active_plans": len(rows)}
    finally:
        db.close()


@celery_app.task(name="asset.warranty_expiry_alerts")
def warranty_expiry_alerts() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.asset.models import AstAssetWarranty

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(AstAssetWarranty).where(
                    AstAssetWarranty.is_deleted.is_(False),
                    AstAssetWarranty.status == "active",
                )
            ).all()
        )
        return {"status": "ok", "active_warranties": len(rows)}
    finally:
        db.close()


@celery_app.task(name="asset.insurance_expiry_alerts")
def insurance_expiry_alerts() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.asset.models import AstAssetInsurance

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(AstAssetInsurance).where(
                    AstAssetInsurance.is_deleted.is_(False),
                    AstAssetInsurance.status == "active",
                )
            ).all()
        )
        return {"status": "ok", "active_insurances": len(rows)}
    finally:
        db.close()


@celery_app.task(name="asset.depreciation_scheduler")
def depreciation_scheduler(
    period_year: int | None = None,
    period_month: int | None = None,
    tenant_id: str | None = None,
    company_id: str | None = None,
    user_id: str | None = None,
) -> dict:
    """Create draft depreciation rows for a period (DEP-11).

    Requires tenant_id, company_id, and user_id (UUID strings). Without them the
    task returns status=skipped and does not touch the database.

    Never calculates amounts and never posts to Finance. Operators must run
    calculate/post (or reverse) explicitly via the API/UI.
    """
    from uuid import UUID

    from database.session import SessionLocal
    from modules.asset.service.depreciation_service import DepreciationService
    from modules.foundation.domain.value_objects import TenantContext

    today = date.today()
    year = period_year or today.year
    month = period_month or today.month

    if not tenant_id or not company_id or not user_id:
        return {
            "status": "skipped",
            "reason": "tenant_id, company_id, and user_id are required for draft generation",
            "period_year": year,
            "period_month": month,
        }

    db = SessionLocal()
    try:
        ctx = TenantContext(
            tenant_id=UUID(tenant_id),
            user_id=UUID(user_id),
            user_type="employee",
            company_id=UUID(company_id),
            branch_id=None,
        )
        # Silence audit noise in scheduled context if AuditService fails without full stack
        try:
            result = DepreciationService(db).generate_period_run(
                ctx,
                period_year=year,
                period_month=month,
                company_id=UUID(company_id),
            )
            db.commit()
        except Exception:
            db.rollback()
            raise
        return {
            "status": "ok",
            "period_year": year,
            "period_month": month,
            "depreciation_batch_id": str(result["depreciation_batch_id"]),
            "created_count": result["created_count"],
            "skipped_count": result["skipped_count"],
        }
    finally:
        db.close()


@celery_app.task(name="asset.asset_audit_reminders")
def asset_audit_reminders() -> dict:
    """List planned physical audits for operational follow-up (does not auto-start/complete)."""
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.asset.models import AstAssetAudit

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(AstAssetAudit).where(
                    AstAssetAudit.is_deleted.is_(False),
                    AstAssetAudit.status == "planned",
                )
            ).all()
        )
        return {
            "status": "ok",
            "planned_audits": len(rows),
            "document_numbers": [r.document_number for r in rows[:100]],
        }
    finally:
        db.close()


@celery_app.task(name="asset.retry_finance_posting")
def retry_finance_posting() -> dict:
    """List failed depreciation rows for operational retry (does not auto-post)."""
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.asset.models import AstAssetDepreciation

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(AstAssetDepreciation).where(
                    AstAssetDepreciation.is_deleted.is_(False),
                    AstAssetDepreciation.status == "failed",
                )
            ).all()
        )
        return {
            "status": "ok",
            "failed_depreciations": len(rows),
            "document_numbers": [r.document_number for r in rows[:100]],
        }
    finally:
        db.close()
