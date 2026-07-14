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


@celery_app.task(name="crm.stale_lead_alerts")
def stale_lead_alerts() -> dict:
    from datetime import datetime, timedelta, timezone

    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.crm.models import CrmLead

    db = SessionLocal()
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(days=14)
        rows = list(
            db.scalars(
                select(CrmLead).where(
                    CrmLead.is_deleted.is_(False),
                    CrmLead.status.in_(["new", "assigned", "contacted"]),
                    CrmLead.updated_at < cutoff,
                )
            ).all()
        )
        return {"status": "ok", "stale_leads": len(rows)}
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
