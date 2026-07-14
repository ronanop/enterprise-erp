"""Unit tests for CRM Celery task registration."""

from modules.crm import tasks


def test_crm_task_names():
    names = {
        tasks.lead_followup_reminders.name,
        tasks.stale_lead_alerts.name,
        tasks.opportunity_close_reminders.name,
        tasks.campaign_end_notifications.name,
        tasks.refresh_customer_satisfaction.name,
        tasks.retry_sales_conversion.name,
    }
    assert names == {
        "crm.lead_followup_reminders",
        "crm.stale_lead_alerts",
        "crm.opportunity_close_reminders",
        "crm.campaign_end_notifications",
        "crm.refresh_customer_satisfaction",
        "crm.retry_sales_conversion",
    }
