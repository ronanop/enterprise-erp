"""Celery application configuration."""

from celery import Celery

from core.config import settings
from modules.platform.celery_signals import install_celery_correlation

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
        # Pull ZK/K40 punches into attendance every minute (idempotent by emp+date).
        "hr-biometric-fetch-punches": {
            "task": "hr.biometric_fetch_punches",
            "schedule": 60.0,
        },
        "hr-attendance-auto-absent": {
            "task": "hr.attendance_auto_absent",
            "schedule": 3600.0,  # hourly; safe if idempotent per day
        },
        "hr-attendance-auto-lock": {
            "task": "hr.attendance_auto_lock",
            "schedule": 3600.0,
        },
        "service.poll_support_mailbox": {
            "task": "service.poll_support_mailbox",
            "schedule": 120.0,
        },
        # Order acknowledgement, distributor ETD chase, customer delivery
        # updates. Idempotent per PO, so a daily pass is enough.
        "procurement.delivery_notifications": {
            "task": "procurement.delivery_notifications",
            "schedule": 86400.0,
        },
        # Unconverted idle leads → owner in-app reminder every 5 days.
        "crm.stale_lead_alerts": {
            "task": "crm.stale_lead_alerts",
            "schedule": 86400.0,
        },
        # Stock carrying cost first, then the OVF live margin that absorbs it.
        "procurement.inventory_holding_costs": {
            "task": "procurement.inventory_holding_costs",
            "schedule": 86400.0,
        },
        "crm.ovf_live_margin_refresh": {
            "task": "crm.ovf_live_margin_refresh",
            "schedule": 86400.0,
        },
        # BOQ/SOW: 1-hour response and 6-hour attach SLAs need a tight loop.
        "crm.boq_sow_sla_escalations": {
            "task": "crm.boq_sow_sla_escalations",
            "schedule": 600.0,
        },
        # Transactional outbox drain — notify/audit/finance/integration handlers.
        "platform.outbox_drain": {
            "task": "platform.outbox_drain",
            "schedule": 15.0,
        },
        # Daily jobs below are claimed per UTC day (fnd_job_run), so a shorter
        # schedule only retries a failed run; it never repeats a successful one.
        "platform.outbox_purge": {
            "task": "platform.outbox_purge",
            "schedule": 3600.0,
        },
        "platform.retention_purge": {
            "task": "platform.retention_purge",
            "schedule": 3600.0,
        },
        "inventory.reservation_cleanup": {
            "task": "inventory.reservation_cleanup",
            "schedule": 3600.0,
        },
    },
)

install_celery_correlation()

# Domain task modules registered in Sprint 1.
celery_app.autodiscover_tasks(
    [
        "workers",
        "modules.foundation",
        "modules.platform",
        "modules.finance",
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
        "modules.marketing",
        "modules.analytics",
        "modules.ecommerce",
    ],
    related_name="tasks",
    force=True,
)
