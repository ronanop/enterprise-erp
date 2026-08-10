"""Marketing Celery tasks."""

import logging
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select

from database.session import SessionLocal
from modules.marketing.domain.enums import CampaignStatus, ContentStatus
from modules.marketing.models.campaign import MktCampaign
from modules.marketing.models.content_item import MktContentItem
from workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="marketing.publish_reminders")
def publish_reminders() -> int:
    """Remind publishers about content scheduled in the next 24 hours."""
    now = datetime.now(timezone.utc)
    window_end = now + timedelta(hours=24)
    count = 0
    with SessionLocal() as db:
        rows = db.scalars(
            select(MktContentItem).where(
                MktContentItem.is_deleted.is_(False),
                MktContentItem.status == ContentStatus.SCHEDULED.value,
                MktContentItem.scheduled_at.isnot(None),
                MktContentItem.scheduled_at >= now,
                MktContentItem.scheduled_at <= window_end,
            )
        ).all()
        for row in rows:
            logger.info("Publish reminder: %s (%s) scheduled at %s", row.content_number, row.title, row.scheduled_at)
            count += 1
    return count


@celery_app.task(name="marketing.approval_reminders")
def approval_reminders() -> int:
    """Remind approvers about content stuck in review for more than 48 hours."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=48)
    count = 0
    with SessionLocal() as db:
        rows = db.scalars(
            select(MktContentItem).where(
                MktContentItem.is_deleted.is_(False),
                MktContentItem.status == ContentStatus.IN_REVIEW.value,
                MktContentItem.submitted_at.isnot(None),
                MktContentItem.submitted_at <= cutoff,
            )
        ).all()
        for row in rows:
            logger.info("Approval reminder: %s (%s) submitted at %s", row.content_number, row.title, row.submitted_at)
            count += 1
    return count


@celery_app.task(name="marketing.campaign_end_alerts")
def campaign_end_alerts() -> int:
    """Alert on active campaigns ending within 7 days."""
    today = date.today()
    window_end = today + timedelta(days=7)
    count = 0
    with SessionLocal() as db:
        rows = db.scalars(
            select(MktCampaign).where(
                MktCampaign.is_deleted.is_(False),
                MktCampaign.status == CampaignStatus.ACTIVE.value,
                MktCampaign.end_date.isnot(None),
                MktCampaign.end_date >= today,
                MktCampaign.end_date <= window_end,
            )
        ).all()
        for row in rows:
            logger.info(
                "Campaign end alert: %s (%s) ends on %s",
                row.campaign_number,
                row.name,
                row.end_date,
            )
            count += 1
    return count
