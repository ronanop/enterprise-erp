"""Celery application configuration."""

from celery import Celery

from core.config import settings

celery_app = Celery(
    "erp_workers",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    beat_schedule={
        "service.poll_support_mailbox": {
            "task": "service.poll_support_mailbox",
            "schedule": 120.0,
        },
        "marketing-publish-reminders": {
            "task": "marketing.publish_reminders",
            "schedule": 3600.0,
        },
        "marketing-approval-reminders": {
            "task": "marketing.approval_reminders",
            "schedule": 3600.0,
        },
        "marketing-campaign-end-alerts": {
            "task": "marketing.campaign_end_alerts",
            "schedule": 86400.0,
        },
    },
)

# Domain task modules registered in Sprint 1.
celery_app.autodiscover_tasks(
    [
        "workers",
        "modules.foundation",
        "modules.finance",
        "modules.sales",
        "modules.procurement",
        "modules.inventory",
        "modules.manufacturing",
        "modules.quality",
        "modules.crm",
        "modules.hr",
        "modules.payroll",
        "modules.recruitment",
        "modules.project",
        "modules.asset",
        "modules.service",
        "modules.marketing",
        "modules.helpdesk",
        "modules.document",
        "modules.grc",
        "modules.analytics",
        "modules.integration",
        "modules.ecommerce",
        "modules.portal",
    ],
    related_name="tasks",
    force=True,
)
