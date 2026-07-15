"""Analytics module router aggregation."""

from fastapi import APIRouter

from modules.analytics.routers import (
    alert_notifications_router,
    alert_rules_router,
    dashboard_widgets_router,
    dashboards_router,
    data_exports_router,
    data_imports_router,
    data_refreshes_router,
    data_snapshots_router,
    dataset_sources_router,
    datasets_router,
    dimensions_router,
    fact_tables_router,
    kpis_router,
    metrics_router,
    query_history_router,
    report_executions_router,
    report_schedules_router,
    reports_router,
    subscriptions_router,
    usage_audits_router,
)

analytics_router = APIRouter(prefix="/analytics")
analytics_router.include_router(dashboards_router)
analytics_router.include_router(dashboard_widgets_router)
analytics_router.include_router(reports_router)
analytics_router.include_router(report_schedules_router)
analytics_router.include_router(report_executions_router)
analytics_router.include_router(datasets_router)
analytics_router.include_router(dataset_sources_router)
analytics_router.include_router(metrics_router)
analytics_router.include_router(kpis_router)
analytics_router.include_router(dimensions_router)
analytics_router.include_router(fact_tables_router)
analytics_router.include_router(data_snapshots_router)
analytics_router.include_router(data_refreshes_router)
analytics_router.include_router(alert_rules_router)
analytics_router.include_router(alert_notifications_router)
analytics_router.include_router(subscriptions_router)
analytics_router.include_router(data_exports_router)
analytics_router.include_router(data_imports_router)
analytics_router.include_router(query_history_router)
analytics_router.include_router(usage_audits_router)
