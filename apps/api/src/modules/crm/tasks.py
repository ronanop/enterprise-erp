"""CRM Celery tasks."""

from workers.celery_app import celery_app


@celery_app.task(name="crm.lead_followup_reminders")
def lead_followup_reminders() -> dict:
    from datetime import datetime, timezone

    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.crm.models import CrmFollowup

    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        rows = list(
            db.scalars(
                select(CrmFollowup).where(
                    CrmFollowup.is_deleted.is_(False),
                    CrmFollowup.status == "scheduled",
                    CrmFollowup.followup_at <= now,
                )
            ).all()
        )
        return {"status": "ok", "due_followups": len(rows)}
    finally:
        db.close()


def _resolve_owner_user_id(db, tenant_id, owner_employee_id):
    """Map lead owner (master_employee) to foundation sec_user id."""
    from sqlalchemy import select

    from modules.foundation.models.security import SecUser
    from modules.master_data.models.employee import MasterEmployee

    if owner_employee_id is None:
        return None
    user = db.scalar(
        select(SecUser).where(
            SecUser.tenant_id == tenant_id,
            SecUser.employee_id == owner_employee_id,
            SecUser.is_deleted.is_(False),
        )
    )
    if user is not None:
        return user.id
    emp = db.get(MasterEmployee, owner_employee_id)
    if emp is not None and emp.user_id is not None:
        return emp.user_id
    return None


@celery_app.task(name="crm.stale_lead_alerts")
def stale_lead_alerts() -> dict:
    """Notify lead owners every 5 idle days for unconverted, unworked leads."""
    from datetime import datetime, timedelta, timezone

    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.crm.models import CrmLead
    from modules.crm.service.crm_notification_service import notify_stale_lead

    stale_days = 5
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(days=stale_days)
        leads = list(
            db.scalars(
                select(CrmLead).where(
                    CrmLead.is_deleted.is_(False),
                    CrmLead.blueprint_state == "open",
                    CrmLead.converted_opportunity_id.is_(None),
                    CrmLead.status.notin_(["converted", "lost"]),
                    CrmLead.updated_at < cutoff,
                )
            ).all()
        )
        notified = 0
        skipped = 0
        for lead in leads:
            if lead.updated_at is None:
                skipped += 1
                continue
            days_idle = max((now - lead.updated_at).days, stale_days)
            if days_idle < stale_days:
                skipped += 1
                continue
            bucket = days_idle // stale_days
            user_id = _resolve_owner_user_id(db, lead.tenant_id, lead.owner_employee_id)
            if user_id is None:
                skipped += 1
                continue
            lead_name = f"{lead.first_name} {(lead.last_name or '').strip()}".strip()
            company = (lead.company_name or "").strip() or "Unknown company"
            sent = notify_stale_lead(
                db,
                tenant_id=lead.tenant_id,
                recipient_user_id=user_id,
                lead_id=lead.id,
                lead_code=lead.lead_code,
                lead_name=lead_name,
                company_name=company,
                days_idle=days_idle,
                digest_bucket=bucket,
            )
            if sent:
                notified += 1
            else:
                skipped += 1
        db.commit()
        return {
            "status": "ok",
            "stale_leads": len(leads),
            "notified": notified,
            "skipped": skipped,
        }
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


@celery_app.task(name="crm.opportunity_close_reminders")
def opportunity_close_reminders() -> dict:
    from datetime import date

    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.crm.models import CrmOpportunity

    db = SessionLocal()
    try:
        today = date.today()
        rows = list(
            db.scalars(
                select(CrmOpportunity).where(
                    CrmOpportunity.is_deleted.is_(False),
                    CrmOpportunity.status == "open",
                    CrmOpportunity.expected_close_date.is_not(None),
                    CrmOpportunity.expected_close_date <= today,
                )
            ).all()
        )
        return {"status": "ok", "due_opportunities": len(rows)}
    finally:
        db.close()


@celery_app.task(name="crm.campaign_end_notifications")
def campaign_end_notifications() -> dict:
    from datetime import date

    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.crm.models import CrmCampaign

    db = SessionLocal()
    try:
        today = date.today()
        rows = list(
            db.scalars(
                select(CrmCampaign).where(
                    CrmCampaign.is_deleted.is_(False),
                    CrmCampaign.status == "active",
                    CrmCampaign.end_date.is_not(None),
                    CrmCampaign.end_date <= today,
                )
            ).all()
        )
        return {"status": "ok", "ending_campaigns": len(rows)}
    finally:
        db.close()


@celery_app.task(name="crm.refresh_customer_satisfaction")
def refresh_customer_satisfaction() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.crm.models import CrmCustomerSatisfaction

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(CrmCustomerSatisfaction).where(
                    CrmCustomerSatisfaction.is_deleted.is_(False),
                    CrmCustomerSatisfaction.status == "draft",
                )
            ).all()
        )
        return {"status": "ok", "draft_scores": len(rows)}
    finally:
        db.close()


@celery_app.task(name="crm.retry_sales_conversion")
def retry_sales_conversion() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.crm.models import CrmOpportunity

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(CrmOpportunity).where(
                    CrmOpportunity.is_deleted.is_(False),
                    CrmOpportunity.status == "won",
                    CrmOpportunity.sales_quotation_id.is_(None),
                    CrmOpportunity.customer_id.is_not(None),
                )
            ).all()
        )
        return {"status": "ok", "pending_quotations": len(rows)}
    finally:
        db.close()
