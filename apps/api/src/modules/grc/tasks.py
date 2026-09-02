"""GRC Celery task stubs per ERD_19 section 15."""

from workers.celery_app import celery_app


@celery_app.task(name="grc.policy_review_reminders")
def policy_review_reminders() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.grc.models import GrcPolicy

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(GrcPolicy).where(
                    GrcPolicy.is_deleted.is_(False),
                    GrcPolicy.review_due_at.is_not(None),
                    GrcPolicy.status.in_(["published", "approved"]),
                )
            ).all()
        )
        return {"status": "ok", "policies_due": len(rows)}
    finally:
        db.close()


@celery_app.task(name="grc.risk_review_scheduler")
def risk_review_scheduler() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.grc.models import GrcRiskRegister

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(GrcRiskRegister).where(
                    GrcRiskRegister.is_deleted.is_(False),
                    GrcRiskRegister.next_review_at.is_not(None),
                    GrcRiskRegister.status.in_(["open", "approved", "mitigated"]),
                )
            ).all()
        )
        return {"status": "ok", "risks_due": len(rows)}
    finally:
        db.close()


@celery_app.task(name="grc.audit_due_notifications")
def audit_due_notifications() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.grc.models import GrcAudit

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(GrcAudit).where(
                    GrcAudit.is_deleted.is_(False),
                    GrcAudit.status.in_(["planned", "approved", "in_progress"]),
                )
            ).all()
        )
        return {"status": "ok", "audits_due": len(rows)}
    finally:
        db.close()


@celery_app.task(name="grc.corrective_action_followups")
def corrective_action_followups() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.grc.models import GrcCorrectiveAction

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(GrcCorrectiveAction).where(
                    GrcCorrectiveAction.is_deleted.is_(False),
                    GrcCorrectiveAction.due_date.is_not(None),
                    GrcCorrectiveAction.status.in_(["open", "in_progress", "approved"]),
                )
            ).all()
        )
        return {"status": "ok", "capas_due": len(rows)}
    finally:
        db.close()


@celery_app.task(name="grc.compliance_refresh")
def compliance_refresh() -> dict:
    from database.session import SessionLocal
    from modules.foundation.domain.value_objects import TenantContext
    from modules.foundation.models.security import SecUser
    from modules.grc.service.compliance_monitor_service import ComplianceMonitorService
    from sqlalchemy import select

    db = SessionLocal()
    try:
        admin = db.scalar(
            select(SecUser).where(SecUser.email == "admin@example.com").limit(1)
        )
        if admin is None:
            return {"status": "skipped", "reason": "no bootstrap admin"}
        ctx = TenantContext(
            tenant_id=admin.tenant_id,
            user_id=admin.id,
            user_type="super_admin",
            company_id=None,
            branch_id=None,
        )
        from modules.organization.models.company import OrgCompany

        company = db.scalar(
            select(OrgCompany).where(OrgCompany.tenant_id == admin.tenant_id).limit(1)
        )
        if company is None:
            return {"status": "skipped", "reason": "no company"}
        from modules.organization.models.branch import OrgBranch

        branch = db.scalar(
            select(OrgBranch).where(OrgBranch.company_id == company.id).limit(1)
        )
        if branch is None:
            return {"status": "skipped", "reason": "no branch"}
        ctx = TenantContext(
            tenant_id=admin.tenant_id,
            user_id=admin.id,
            user_type="super_admin",
            company_id=company.id,
            branch_id=branch.id,
        )
        result = ComplianceMonitorService(db).refresh_company(ctx, company.id, branch_id=branch.id)
        db.commit()
        return {"status": "ok", **result}
    finally:
        db.close()


@celery_app.task(name="grc.retry_finance_posting")
def retry_finance_posting() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.grc.models import GrcCorrectiveAction, GrcIncident

    db = SessionLocal()
    try:
        incidents = list(
            db.scalars(
                select(GrcIncident).where(
                    GrcIncident.is_deleted.is_(False),
                    GrcIncident.status.in_(["resolved", "closed"]),
                    GrcIncident.finance_journal_id.is_(None),
                )
            ).all()
        )
        capas = list(
            db.scalars(
                select(GrcCorrectiveAction).where(
                    GrcCorrectiveAction.is_deleted.is_(False),
                    GrcCorrectiveAction.status.in_(["completed", "verified"]),
                    GrcCorrectiveAction.finance_journal_id.is_(None),
                )
            ).all()
        )
        return {
            "status": "ok",
            "unposted_incidents": len(incidents),
            "unposted_capas": len(capas),
        }
    finally:
        db.close()
