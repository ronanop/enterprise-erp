"""Celery application configuration — standalone HRMS."""

from celery import Celery

from core.config import settings
from modules.platform.celery_signals import install_celery_correlation

celery_app = Celery(
    "hrms_workers",
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
        "hr-biometric-fetch-punches": {
            "task": "hr.biometric_fetch_punches",
            "schedule": 60.0,
        },
        "hr-attendance-auto-absent": {
            "task": "hr.attendance_auto_absent",
            "schedule": 3600.0,
        },
        "hr-attendance-auto-lock": {
            "task": "hr.attendance_auto_lock",
            "schedule": 3600.0,
        },
        "platform.outbox_drain": {
            "task": "platform.outbox_drain",
            "schedule": 15.0,
        },
        "platform.outbox_purge": {
            "task": "platform.outbox_purge",
            "schedule": 3600.0,
        },
        "platform.retention_purge": {
            "task": "platform.retention_purge",
            "schedule": 3600.0,
        },
    },
)

install_celery_correlation()

celery_app.autodiscover_tasks(
    [
        "workers",
        "modules.foundation",
        "modules.platform",
        "modules.hr",
        "modules.payroll",
        "modules.recruitment",
    ],
    related_name="tasks",
    force=True,
)
