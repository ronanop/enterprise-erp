"""Celery application configuration."""

from celery.schedules import crontab
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
        "hr-attendance-auto-absent": {
            "task": "hr.attendance_auto_absent",
            "schedule": 3600.0,
        },
        "hr-attendance-auto-lock": {
            "task": "hr.attendance_auto_lock",
            "schedule": 3600.0,
        },
        "quality-spc-out-of-control-alert": {
            "task": "quality.spc_out_of_control_alert",
            "schedule": 3600.0,
        },
        "quality-ppap-pending-approval-alerts": {
            "task": "quality.ppap_pending_approval_alerts",
            "schedule": 3600.0,
        },
        "quality-scar-overdue-alerts": {
            "task": "quality.scar_overdue_alerts",
            "schedule": 3600.0,
        },
        "analytics-kpi-daily-snapshot": {
            "task": "analytics.kpi_daily_snapshot",
            "schedule": crontab(hour=1, minute=0),
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
