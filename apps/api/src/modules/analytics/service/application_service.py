"""Analytics application service facade."""

from sqlalchemy.orm import Session

from modules.analytics.service.alert_notification_service import AlertNotificationService
from modules.analytics.service.alert_rule_service import AlertRuleService
from modules.analytics.service.dashboard_service import DashboardService
from modules.analytics.service.dashboard_widget_service import DashboardWidgetService
from modules.analytics.service.data_export_service import DataExportService
from modules.analytics.service.data_import_service import DataImportService
from modules.analytics.service.data_refresh_service import DataRefreshService
from modules.analytics.service.data_snapshot_service import DataSnapshotService
from modules.analytics.service.dataset_service import DatasetService
from modules.analytics.service.dataset_source_service import DatasetSourceService
from modules.analytics.service.dimension_service import DimensionService
from modules.analytics.service.fact_table_service import FactTableService
from modules.analytics.service.integration_service import AnalyticsIntegrationService
from modules.analytics.service.kpi_service import KpiService
from modules.analytics.service.metric_service import MetricService
from modules.analytics.service.query_history_service import QueryHistoryService
from modules.analytics.service.report_execution_service import ReportExecutionService
from modules.analytics.service.report_schedule_service import ReportScheduleService
from modules.analytics.service.report_service import ReportService
from modules.analytics.service.subscription_service import SubscriptionService
from modules.analytics.service.usage_audit_service import UsageAuditService


class AnalyticsApplicationService:
    def __init__(self, db: Session) -> None:
        self.dashboards = DashboardService(db)
        self.dashboard_widgets = DashboardWidgetService(db)
        self.reports = ReportService(db)
        self.report_schedules = ReportScheduleService(db)
        self.report_executions = ReportExecutionService(db)
        self.datasets = DatasetService(db)
        self.dataset_sources = DatasetSourceService(db)
        self.metrics = MetricService(db)
        self.kpis = KpiService(db)
        self.dimensions = DimensionService(db)
        self.fact_tables = FactTableService(db)
        self.data_snapshots = DataSnapshotService(db)
        self.data_refreshes = DataRefreshService(db)
        self.alert_rules = AlertRuleService(db)
        self.alert_notifications = AlertNotificationService(db)
        self.subscriptions = SubscriptionService(db)
        self.data_exports = DataExportService(db)
        self.data_imports = DataImportService(db)
        self.query_history = QueryHistoryService(db)
        self.usage_audits = UsageAuditService(db)
        self.integration = AnalyticsIntegrationService(db)
