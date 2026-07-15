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
        "modules.helpdesk",
        "modules.document",
        "modules.grc",
        "modules.analytics",
    ],
    related_name="tasks",
    force=True,
)
