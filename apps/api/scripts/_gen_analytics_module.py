"""Generate Sprint 20 Business Intelligence / Analytics module. Run from apps/api:
.venv\\Scripts\\python.exe scripts/_gen_analytics_module.py
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
ANALYTICS = SRC / "modules" / "analytics"
ALEMBIC = ROOT / "alembic" / "versions"
TESTS = SRC / "tests"
SHARED = SRC / "shared"

FILES_WRITTEN: list[Path] = []

WF_FIELDS = """
    workflow_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    workflow_instance_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.wf_instance.id", ondelete="SET NULL"),
        nullable=True,
    )
"""

OPT_BRANCH = """
    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
"""


def w(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not content.endswith("\n"):
        content += "\n"
    path.write_text(content, encoding="utf-8")
    FILES_WRITTEN.append(path)
    print("wrote", path.relative_to(ROOT))


def patch_file(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new.strip() in text:
        print("skip (already)", path.relative_to(ROOT))
        return
    if old not in text:
        raise SystemExit(f"patch failed in {path}: marker not found")
    path.write_text(text.replace(old, new), encoding="utf-8")
    print("patched", path.relative_to(ROOT))


# table_key, ORM class, stem, branch_scoped
TABLES: list[tuple[str, str, str, bool]] = [
    ("dashboard", "BiDashboard", "Dashboard", False),
    ("dashboard_widget", "BiDashboardWidget", "DashboardWidget", False),
    ("report", "BiReport", "Report", False),
    ("report_schedule", "BiReportSchedule", "ReportSchedule", False),
    ("report_execution", "BiReportExecution", "ReportExecution", False),
    ("dataset", "BiDataset", "Dataset", False),
    ("dataset_source", "BiDatasetSource", "DatasetSource", False),
    ("metric", "BiMetric", "Metric", False),
    ("kpi", "BiKpi", "Kpi", False),
    ("dimension", "BiDimension", "Dimension", False),
    ("fact_table", "BiFactTable", "FactTable", False),
    ("data_snapshot", "BiDataSnapshot", "DataSnapshot", False),
    ("data_refresh", "BiDataRefresh", "DataRefresh", False),
    ("alert_rule", "BiAlertRule", "AlertRule", False),
    ("alert_notification", "BiAlertNotification", "AlertNotification", False),
    ("subscription", "BiSubscription", "Subscription", False),
    ("data_export", "BiDataExport", "DataExport", False),
    ("data_import", "BiDataImport", "DataImport", False),
    ("query_history", "BiQueryHistory", "QueryHistory", False),
    ("usage_audit", "BiUsageAudit", "UsageAudit", False),
]

CLASS_MAP = {t[0]: t[1] for t in TABLES}

MIGRATIONS: list[tuple[str, str | list[str], str]] = [
    ("0355_create_analytics_schema", "schema", "0354_seed_grc_workflows"),
    ("0356_bi_dashboard", "dashboard", "0355_create_analytics_schema"),
    ("0357_bi_dashboard_widget", "dashboard_widget", "0356_bi_dashboard"),
    ("0358_bi_report", "report", "0357_bi_dashboard_widget"),
    ("0359_bi_report_schedule", "report_schedule", "0358_bi_report"),
    ("0360_bi_report_execution", "report_execution", "0359_bi_report_schedule"),
    ("0361_bi_dataset_and_source", ["dataset", "dataset_source"], "0360_bi_report_execution"),
    ("0362_bi_metric", "metric", "0361_bi_dataset_and_source"),
    ("0363_bi_kpi", "kpi", "0362_bi_metric"),
    ("0364_bi_dimension", "dimension", "0363_bi_kpi"),
    ("0365_bi_fact_table", "fact_table", "0364_bi_dimension"),
    ("0366_bi_data_snapshot", "data_snapshot", "0365_bi_fact_table"),
    ("0367_bi_data_refresh", "data_refresh", "0366_bi_data_snapshot"),
    ("0368_bi_alert_rule", "alert_rule", "0367_bi_data_refresh"),
    ("0369_bi_alert_notification", "alert_notification", "0368_bi_alert_rule"),
    ("0370_bi_subscription", "subscription", "0369_bi_alert_notification"),
    ("0371_bi_data_export", "data_export", "0370_bi_subscription"),
    ("0372_bi_data_import", "data_import", "0371_bi_data_export"),
    ("0373_bi_query_history", "query_history", "0372_bi_data_import"),
    ("0374_bi_usage_audit", "usage_audit", "0373_bi_query_history"),
    ("0375_seed_analytics_permissions", "seed_perms", "0374_bi_usage_audit"),
    ("0376_seed_analytics_workflows", "seed_wf", "0375_seed_analytics_permissions"),
]

# route prefix, schema name, service class, perm resource, branch_required
ROUTE_SPECS: list[tuple[str, str, str, str, bool]] = [
    ("dashboards", "Dashboard", "DashboardService", "analytics.dashboard", False),
    ("dashboard-widgets", "DashboardWidget", "DashboardWidgetService", "analytics.widget", False),
    ("reports", "Report", "ReportService", "analytics.report", False),
    ("report-schedules", "ReportSchedule", "ReportScheduleService", "analytics.schedule", False),
    ("report-executions", "ReportExecution", "ReportExecutionService", "analytics.execution", False),
    ("datasets", "Dataset", "DatasetService", "analytics.dataset", False),
    ("dataset-sources", "DatasetSource", "DatasetSourceService", "analytics.source", False),
    ("metrics", "Metric", "MetricService", "analytics.metric", False),
    ("kpis", "Kpi", "KpiService", "analytics.kpi", False),
    ("dimensions", "Dimension", "DimensionService", "analytics.dimension", False),
    ("fact-tables", "FactTable", "FactTableService", "analytics.fact", False),
    ("data-snapshots", "DataSnapshot", "DataSnapshotService", "analytics.snapshot", False),
    ("data-refreshes", "DataRefresh", "DataRefreshService", "analytics.refresh", False),
    ("alert-rules", "AlertRule", "AlertRuleService", "analytics.alert", False),
    ("alert-notifications", "AlertNotification", "AlertNotificationService", "analytics.notification", False),
    ("subscriptions", "Subscription", "SubscriptionService", "analytics.subscription", False),
    ("data-exports", "DataExport", "DataExportService", "analytics.export", False),
    ("data-imports", "DataImport", "DataImportService", "analytics.import", False),
    ("query-history", "QueryHistory", "QueryHistoryService", "analytics.query_history", False),
    ("usage-audits", "UsageAudit", "UsageAuditService", "analytics.usage_audit", False),
]

ENGINE_NAMES = [
    "Dashboard",
    "DashboardWidget",
    "Report",
    "ReportSchedule",
    "ReportExecution",
    "Dataset",
    "DatasetSource",
    "Metric",
    "Kpi",
    "Dimension",
    "FactTable",
    "DataSnapshot",
    "DataRefresh",
    "AlertRule",
    "AlertNotification",
    "Subscription",
    "DataExport",
    "DataImport",
    "QueryHistory",
    "UsageAudit",
]

ENGINE_FILE_MAP = {
    "Dashboard": "dashboard",
    "DashboardWidget": "dashboard_widget",
    "Report": "report",
    "ReportSchedule": "report_schedule",
    "ReportExecution": "report_execution",
    "Dataset": "dataset",
    "DatasetSource": "dataset_source",
    "Metric": "metric",
    "Kpi": "kpi",
    "Dimension": "dimension",
    "FactTable": "fact_table",
    "DataSnapshot": "data_snapshot",
    "DataRefresh": "data_refresh",
    "AlertRule": "alert_rule",
    "AlertNotification": "alert_notification",
    "Subscription": "subscription",
    "DataExport": "data_export",
    "DataImport": "data_import",
    "QueryHistory": "query_history",
    "UsageAudit": "usage_audit",
}


def _emp_fk(col: str, nullable: bool = True) -> str:
    null = "True" if nullable else "False"
    mapped = "UUID | None" if nullable else "UUID"
    return f'''
    {col}: Mapped[{mapped}] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable={null},
        index=True,
    )'''


def _dept_fk(col: str = "department_id", nullable: bool = True) -> str:
    null = "True" if nullable else "False"
    mapped = "UUID | None" if nullable else "UUID"
    return f'''
    {col}: Mapped[{mapped}] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_department.id", ondelete="RESTRICT"),
        nullable={null},
        index=True,
    )'''


def _uuid_only(col: str) -> str:
    return f'''
    {col}: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)'''


def _fk(
    col: str,
    table: str,
    *,
    nullable: bool = True,
    ondelete: str = "SET NULL",
    use_alter: bool = False,
    name: str | None = None,
) -> str:
    null = "True" if nullable else "False"
    mapped = "UUID | None" if nullable else "UUID"
    extra = ""
    if use_alter:
        fk_name = name or f"fk_bi_{col}"
        extra = f',\n            use_alter=True,\n            name="{fk_name}"'
    return f'''
    {col}: Mapped[{mapped}] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "{table}",
            ondelete="{ondelete}"{extra},
        ),
        nullable={null},
        index=True,
    )'''


MODELS: dict[str, str] = {}

MODELS["dashboard"] = f'''"""Dashboard ORM per ERD_20 section 6.1."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.analytics.models.mixins import BiRowMixin


class BiDashboard(Base, *BiRowMixin):
    __tablename__ = "bi_dashboard"
    __table_args__ = (
        UniqueConstraint("company_id", "dashboard_number", name="uk_bi_dashboard_number"),
        UniqueConstraint("company_id", "dashboard_code", name="uk_bi_dashboard_code"),
        CheckConstraint(
            "dashboard_type IN ('executive','operational','self_service')",
            name="ck_bi_dashboard_type",
        ),
        CheckConstraint(
            "status IN ('draft','submitted','approved','published','archived','cancelled')",
            name="ck_bi_dashboard_status",
        ),
        Index("ix_bi_dashboard_tenant_co_status", "tenant_id", "company_id", "status"),
        {{"schema": "analytics"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{OPT_BRANCH}
    dashboard_number: Mapped[str] = mapped_column(String(50), nullable=False)
    dashboard_code: Mapped[str] = mapped_column(String(50), nullable=False)
    dashboard_name: Mapped[str] = mapped_column(String(255), nullable=False)
    dashboard_type: Mapped[str] = mapped_column(String(40), nullable=False)
    audience_role: Mapped[str | None] = mapped_column(String(40), nullable=True)
{_emp_fk("owner_employee_id", nullable=False)}
{_dept_fk()}
    layout_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
{WF_FIELDS}
'''

MODELS["dashboard_widget"] = f'''"""Dashboard widget ORM per ERD_20 section 6.2."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.analytics.models.mixins import BiRowMixin


class BiDashboardWidget(Base, *BiRowMixin):
    __tablename__ = "bi_dashboard_widget"
    __table_args__ = (
        UniqueConstraint("dashboard_id", "widget_code", name="uk_bi_dashboard_widget_code"),
        CheckConstraint(
            "widget_type IN ('kpi_tile','chart','table','gauge','map','text','iframe')",
            name="ck_bi_widget_type",
        ),
        CheckConstraint(
            "status IN ('active','hidden','archived')",
            name="ck_bi_widget_status",
        ),
        {{"schema": "analytics"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{OPT_BRANCH}
    dashboard_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("analytics.bi_dashboard.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    widget_code: Mapped[str] = mapped_column(String(50), nullable=False)
    widget_title: Mapped[str] = mapped_column(String(255), nullable=False)
    widget_type: Mapped[str] = mapped_column(String(40), nullable=False)
{_fk("metric_id", "analytics.bi_metric.id", use_alter=True, name="fk_bi_widget_metric")}
{_fk("kpi_id", "analytics.bi_kpi.id", use_alter=True, name="fk_bi_widget_kpi")}
{_fk("report_id", "analytics.bi_report.id", use_alter=True, name="fk_bi_widget_report")}
{_fk("dataset_id", "analytics.bi_dataset.id", use_alter=True, name="fk_bi_widget_dataset")}
    config_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    sequence_no: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
'''

MODELS["report"] = f'''"""Report ORM per ERD_20 section 6.3."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.analytics.models.mixins import BiRowMixin


class BiReport(Base, *BiRowMixin):
    __tablename__ = "bi_report"
    __table_args__ = (
        UniqueConstraint("company_id", "report_number", name="uk_bi_report_number"),
        UniqueConstraint("company_id", "report_code", name="uk_bi_report_code"),
        CheckConstraint(
            "report_type IN ('operational','financial','cross_module','ad_hoc','scheduled')",
            name="ck_bi_report_type",
        ),
        CheckConstraint(
            "status IN ('draft','submitted','approved','published','archived','cancelled')",
            name="ck_bi_report_status",
        ),
        Index("ix_bi_report_tenant_co_status", "tenant_id", "company_id", "status"),
        {{"schema": "analytics"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{OPT_BRANCH}
    report_number: Mapped[str] = mapped_column(String(50), nullable=False)
    report_code: Mapped[str] = mapped_column(String(50), nullable=False)
    report_name: Mapped[str] = mapped_column(String(255), nullable=False)
    report_type: Mapped[str] = mapped_column(String(40), nullable=False)
{_emp_fk("owner_employee_id", nullable=False)}
{_dept_fk()}
{_fk("dataset_id", "analytics.bi_dataset.id", use_alter=True, name="fk_bi_report_dataset")}
    definition_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    output_format: Mapped[str | None] = mapped_column(String(20), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
{WF_FIELDS}
'''

MODELS["report_schedule"] = f'''"""Report schedule ORM per ERD_20 section 6.4."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.analytics.models.mixins import BiRowMixin


class BiReportSchedule(Base, *BiRowMixin):
    __tablename__ = "bi_report_schedule"
    __table_args__ = (
        UniqueConstraint("report_id", "schedule_code", name="uk_bi_report_schedule_code"),
        CheckConstraint(
            "status IN ('active','paused','retired')",
            name="ck_bi_report_schedule_status",
        ),
        {{"schema": "analytics"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{OPT_BRANCH}
    report_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("analytics.bi_report.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    schedule_code: Mapped[str] = mapped_column(String(50), nullable=False)
    cron_expression: Mapped[str | None] = mapped_column(String(100), nullable=True)
    timezone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    next_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    recipients_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
'''

MODELS["report_execution"] = f'''"""Report execution ORM per ERD_20 section 6.5."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.analytics.models.mixins import BiRowMixin


class BiReportExecution(Base, *BiRowMixin):
    __tablename__ = "bi_report_execution"
    __table_args__ = (
        UniqueConstraint("company_id", "execution_number", name="uk_bi_report_execution_number"),
        CheckConstraint(
            "status IN ('queued','running','succeeded','failed','cancelled')",
            name="ck_bi_report_execution_status",
        ),
        CheckConstraint("row_count IS NULL OR row_count >= 0", name="ck_bi_rex_row_count"),
        {{"schema": "analytics"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{OPT_BRANCH}
    report_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("analytics.bi_report.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
{_fk("schedule_id", "analytics.bi_report_schedule.id")}
    execution_number: Mapped[str] = mapped_column(String(50), nullable=False)
{_emp_fk("triggered_by_employee_id")}
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    row_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    output_uri: Mapped[str | None] = mapped_column(String(500), nullable=True)
    content_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="queued", index=True)
'''

MODELS["dataset"] = f'''"""Dataset ORM per ERD_20 section 6.6."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.analytics.models.mixins import BiRowMixin


class BiDataset(Base, *BiRowMixin):
    __tablename__ = "bi_dataset"
    __table_args__ = (
        UniqueConstraint("company_id", "dataset_number", name="uk_bi_dataset_number"),
        UniqueConstraint("company_id", "dataset_code", name="uk_bi_dataset_code"),
        CheckConstraint(
            "dataset_type IN ('operational','warehouse','virtual','imported')",
            name="ck_bi_dataset_type",
        ),
        CheckConstraint(
            "status IN ('draft','submitted','approved','active','refreshing','failed','retired')",
            name="ck_bi_dataset_status",
        ),
        Index("ix_bi_dataset_tenant_co_status", "tenant_id", "company_id", "status"),
        {{"schema": "analytics"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{OPT_BRANCH}
    dataset_number: Mapped[str] = mapped_column(String(50), nullable=False)
    dataset_code: Mapped[str] = mapped_column(String(50), nullable=False)
    dataset_name: Mapped[str] = mapped_column(String(255), nullable=False)
    dataset_type: Mapped[str] = mapped_column(String(40), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
{_emp_fk("owner_employee_id", nullable=False)}
{_emp_fk("steward_employee_id")}
    grain_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    cache_ttl_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_refreshed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
{WF_FIELDS}
'''

MODELS["dataset_source"] = f'''"""Dataset source ORM per ERD_20 section 6.7."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.analytics.models.mixins import BiRowMixin


class BiDatasetSource(Base, *BiRowMixin):
    __tablename__ = "bi_dataset_source"
    __table_args__ = (
        UniqueConstraint("dataset_id", "source_code", name="uk_bi_dataset_source_code"),
        CheckConstraint(
            "source_module IN ('foundation','organization','master','finance','sales',"
            "'procurement','inventory','manufacturing','quality','crm','hr','payroll',"
            "'recruitment','project','asset','service','helpdesk','document','grc','external')",
            name="ck_bi_dataset_source_module",
        ),
        CheckConstraint("status IN ('active','inactive')", name="ck_bi_dataset_source_status"),
        Index("ix_bi_dataset_source_module_ref", "source_module", "source_ref_id"),
        {{"schema": "analytics"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{OPT_BRANCH}
    dataset_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("analytics.bi_dataset.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    source_code: Mapped[str] = mapped_column(String(50), nullable=False)
    source_module: Mapped[str] = mapped_column(String(40), nullable=False)
    source_entity: Mapped[str | None] = mapped_column(String(100), nullable=True)
{_uuid_only("source_ref_id")}
    connection_key: Mapped[str | None] = mapped_column(String(100), nullable=True)
    extract_query_key: Mapped[str | None] = mapped_column(String(100), nullable=True)
    filter_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
'''

MODELS["metric"] = f'''"""Metric ORM per ERD_20 section 6.8."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.analytics.models.mixins import BiRowMixin


class BiMetric(Base, *BiRowMixin):
    __tablename__ = "bi_metric"
    __table_args__ = (
        UniqueConstraint("company_id", "metric_code", name="uk_bi_metric_code"),
        CheckConstraint(
            "metric_category IN ('financial','sales','operations','hr','quality','project','custom')",
            name="ck_bi_metric_category",
        ),
        CheckConstraint(
            "aggregation IN ('sum','avg','count','min','max','distinct_count','ratio')",
            name="ck_bi_metric_aggregation",
        ),
        CheckConstraint(
            "status IN ('draft','active','deprecated')",
            name="ck_bi_metric_status",
        ),
        {{"schema": "analytics"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{OPT_BRANCH}
    metric_code: Mapped[str] = mapped_column(String(50), nullable=False)
    metric_name: Mapped[str] = mapped_column(String(255), nullable=False)
{_fk("dataset_id", "analytics.bi_dataset.id")}
    metric_category: Mapped[str] = mapped_column(String(40), nullable=False)
    aggregation: Mapped[str] = mapped_column(String(30), nullable=False)
    expression_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    unit: Mapped[str | None] = mapped_column(String(40), nullable=True)
{_emp_fk("owner_employee_id")}
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
'''

MODELS["kpi"] = f'''"""KPI ORM per ERD_20 section 6.9."""

from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Index, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.analytics.models.mixins import BiRowMixin


class BiKpi(Base, *BiRowMixin):
    __tablename__ = "bi_kpi"
    __table_args__ = (
        UniqueConstraint("company_id", "kpi_number", name="uk_bi_kpi_number"),
        UniqueConstraint("company_id", "kpi_code", name="uk_bi_kpi_code"),
        CheckConstraint(
            "direction IS NULL OR direction IN ('higher_better','lower_better')",
            name="ck_bi_kpi_direction",
        ),
        CheckConstraint(
            "period_grain IS NULL OR period_grain IN ('day','week','month','quarter','year')",
            name="ck_bi_kpi_period_grain",
        ),
        CheckConstraint(
            "status IN ('draft','submitted','approved','active','inactive','cancelled')",
            name="ck_bi_kpi_status",
        ),
        Index("ix_bi_kpi_tenant_co_status", "tenant_id", "company_id", "status"),
        {{"schema": "analytics"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{OPT_BRANCH}
    kpi_number: Mapped[str] = mapped_column(String(50), nullable=False)
    kpi_code: Mapped[str] = mapped_column(String(50), nullable=False)
    kpi_name: Mapped[str] = mapped_column(String(255), nullable=False)
{_fk("metric_id", "analytics.bi_metric.id")}
{_emp_fk("owner_employee_id", nullable=False)}
{_dept_fk()}
    target_value: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    warning_threshold: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    critical_threshold: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    direction: Mapped[str | None] = mapped_column(String(20), nullable=True)
    period_grain: Mapped[str | None] = mapped_column(String(20), nullable=True)
    current_value: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
{WF_FIELDS}
'''

MODELS["dimension"] = f'''"""Dimension ORM per ERD_20 section 6.10."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.analytics.models.mixins import BiRowMixin


class BiDimension(Base, *BiRowMixin):
    __tablename__ = "bi_dimension"
    __table_args__ = (
        UniqueConstraint("company_id", "dimension_code", name="uk_bi_dimension_code"),
        CheckConstraint(
            "dimension_type IN ('time','geo','org','product','customer','vendor','employee','custom')",
            name="ck_bi_dimension_type",
        ),
        CheckConstraint("status IN ('active','inactive')", name="ck_bi_dimension_status"),
        {{"schema": "analytics"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{OPT_BRANCH}
    dimension_code: Mapped[str] = mapped_column(String(50), nullable=False)
    dimension_name: Mapped[str] = mapped_column(String(255), nullable=False)
{_fk("dataset_id", "analytics.bi_dataset.id")}
    dimension_type: Mapped[str] = mapped_column(String(40), nullable=False)
    source_module: Mapped[str | None] = mapped_column(String(40), nullable=True)
    hierarchy_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    master_product_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_product.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    master_customer_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_customer.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    master_vendor_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_vendor.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
'''

MODELS["fact_table"] = f'''"""Fact table metadata ORM per ERD_20 section 6.11."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.analytics.models.mixins import BiRowMixin


class BiFactTable(Base, *BiRowMixin):
    __tablename__ = "bi_fact_table"
    __table_args__ = (
        UniqueConstraint("company_id", "fact_code", name="uk_bi_fact_table_code"),
        CheckConstraint(
            "status IN ('draft','active','rebuilding','retired')",
            name="ck_bi_fact_table_status",
        ),
        {{"schema": "analytics"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{OPT_BRANCH}
    fact_code: Mapped[str] = mapped_column(String(50), nullable=False)
    fact_name: Mapped[str] = mapped_column(String(255), nullable=False)
    dataset_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("analytics.bi_dataset.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    grain_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    measure_codes_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    dimension_codes_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    storage_uri: Mapped[str | None] = mapped_column(String(500), nullable=True)
    physical_table_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
'''

MODELS["data_snapshot"] = f'''"""Data snapshot ORM per ERD_20 section 6.12."""

from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.analytics.models.mixins import BiRowMixin


class BiDataSnapshot(Base, *BiRowMixin):
    __tablename__ = "bi_data_snapshot"
    __table_args__ = (
        UniqueConstraint("company_id", "snapshot_number", name="uk_bi_data_snapshot_number"),
        CheckConstraint(
            "status IN ('ready','expired','failed')",
            name="ck_bi_data_snapshot_status",
        ),
        CheckConstraint("row_count IS NULL OR row_count >= 0", name="ck_bi_snapshot_row_count"),
        {{"schema": "analytics"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{OPT_BRANCH}
    dataset_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("analytics.bi_dataset.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    snapshot_number: Mapped[str] = mapped_column(String(50), nullable=False)
    snapshot_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    period_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    period_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    row_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    payload_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    storage_uri: Mapped[str | None] = mapped_column(String(500), nullable=True)
{_fk("refresh_id", "analytics.bi_data_refresh.id", use_alter=True, name="fk_bi_snapshot_refresh")}
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="ready", index=True)
'''

MODELS["data_refresh"] = f'''"""Data refresh ORM per ERD_20 section 6.13."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.analytics.models.mixins import BiRowMixin


class BiDataRefresh(Base, *BiRowMixin):
    __tablename__ = "bi_data_refresh"
    __table_args__ = (
        UniqueConstraint("company_id", "refresh_number", name="uk_bi_data_refresh_number"),
        CheckConstraint(
            "refresh_type IN ('full','incremental','rebuild')",
            name="ck_bi_data_refresh_type",
        ),
        CheckConstraint(
            "status IN ('draft','submitted','queued','running','succeeded','failed','cancelled')",
            name="ck_bi_data_refresh_status",
        ),
        CheckConstraint(
            "rows_processed IS NULL OR rows_processed >= 0",
            name="ck_bi_refresh_rows_processed",
        ),
        {{"schema": "analytics"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{OPT_BRANCH}
    refresh_number: Mapped[str] = mapped_column(String(50), nullable=False)
    dataset_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("analytics.bi_dataset.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    refresh_type: Mapped[str] = mapped_column(String(30), nullable=False)
{_emp_fk("requested_by_employee_id", nullable=False)}
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rows_processed: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
{WF_FIELDS}
'''

MODELS["alert_rule"] = f'''"""Alert rule ORM per ERD_20 section 6.14."""

from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.analytics.models.mixins import BiRowMixin


class BiAlertRule(Base, *BiRowMixin):
    __tablename__ = "bi_alert_rule"
    __table_args__ = (
        UniqueConstraint("company_id", "alert_number", name="uk_bi_alert_rule_number"),
        UniqueConstraint("company_id", "alert_code", name="uk_bi_alert_rule_code"),
        CheckConstraint(
            "condition_operator IN ('gt','gte','lt','lte','eq','neq','between')",
            name="ck_bi_alert_condition_op",
        ),
        CheckConstraint(
            "severity IN ('info','warning','critical')",
            name="ck_bi_alert_severity",
        ),
        CheckConstraint(
            "status IN ('draft','submitted','approved','active','paused','retired')",
            name="ck_bi_alert_rule_status",
        ),
        {{"schema": "analytics"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{OPT_BRANCH}
    alert_number: Mapped[str] = mapped_column(String(50), nullable=False)
    alert_code: Mapped[str] = mapped_column(String(50), nullable=False)
    alert_name: Mapped[str] = mapped_column(String(255), nullable=False)
{_fk("kpi_id", "analytics.bi_kpi.id")}
{_fk("metric_id", "analytics.bi_metric.id")}
    condition_operator: Mapped[str] = mapped_column(String(20), nullable=False)
    threshold_value: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    threshold_upper: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    severity: Mapped[str] = mapped_column(String(20), nullable=False, default="warning")
{_emp_fk("owner_employee_id", nullable=False)}
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
{WF_FIELDS}
'''

MODELS["alert_notification"] = f'''"""Alert notification ORM per ERD_20 section 6.15."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.analytics.models.mixins import BiRowMixin


class BiAlertNotification(Base, *BiRowMixin):
    __tablename__ = "bi_alert_notification"
    __table_args__ = (
        CheckConstraint(
            "delivery_status IN ('pending','sent','failed','acknowledged')",
            name="ck_bi_alert_delivery_status",
        ),
        CheckConstraint(
            "status IN ('open','acknowledged','closed')",
            name="ck_bi_alert_notification_status",
        ),
        {{"schema": "analytics"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{OPT_BRANCH}
    alert_rule_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("analytics.bi_alert_rule.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    triggered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    observed_value: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
{_uuid_only("recipient_user_id")}
{_emp_fk("recipient_employee_id")}
    delivery_status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending")
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="open", index=True)
'''

MODELS["subscription"] = f'''"""Subscription ORM per ERD_20 section 6.16."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.analytics.models.mixins import BiRowMixin


class BiSubscription(Base, *BiRowMixin):
    __tablename__ = "bi_subscription"
    __table_args__ = (
        UniqueConstraint("company_id", "subscription_number", name="uk_bi_subscription_number"),
        CheckConstraint(
            "target_type IN ('dashboard','report','kpi','alert')",
            name="ck_bi_subscription_target_type",
        ),
        CheckConstraint(
            "channel IN ('in_app','email','webhook')",
            name="ck_bi_subscription_channel",
        ),
        CheckConstraint(
            "frequency IN ('realtime','daily','weekly','monthly')",
            name="ck_bi_subscription_frequency",
        ),
        CheckConstraint(
            "status IN ('active','paused','cancelled')",
            name="ck_bi_subscription_status",
        ),
        {{"schema": "analytics"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{OPT_BRANCH}
    subscription_number: Mapped[str] = mapped_column(String(50), nullable=False)
{_emp_fk("subscriber_employee_id", nullable=False)}
    target_type: Mapped[str] = mapped_column(String(30), nullable=False)
{_fk("dashboard_id", "analytics.bi_dashboard.id")}
{_fk("report_id", "analytics.bi_report.id")}
{_fk("kpi_id", "analytics.bi_kpi.id")}
{_fk("alert_rule_id", "analytics.bi_alert_rule.id")}
    channel: Mapped[str] = mapped_column(String(30), nullable=False)
    frequency: Mapped[str] = mapped_column(String(30), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
'''

MODELS["data_export"] = f'''"""Data export ORM per ERD_20 section 6.17."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.analytics.models.mixins import BiRowMixin


class BiDataExport(Base, *BiRowMixin):
    __tablename__ = "bi_data_export"
    __table_args__ = (
        UniqueConstraint("company_id", "export_number", name="uk_bi_data_export_number"),
        CheckConstraint(
            "format IN ('csv','xlsx','json','pdf','parquet')",
            name="ck_bi_data_export_format",
        ),
        CheckConstraint(
            "status IN ('queued','running','succeeded','failed','expired')",
            name="ck_bi_data_export_status",
        ),
        CheckConstraint(
            "file_size_bytes IS NULL OR file_size_bytes >= 0",
            name="ck_bi_export_file_size",
        ),
        {{"schema": "analytics"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{OPT_BRANCH}
    export_number: Mapped[str] = mapped_column(String(50), nullable=False)
{_fk("report_id", "analytics.bi_report.id")}
{_fk("dataset_id", "analytics.bi_dataset.id")}
{_emp_fk("requested_by_employee_id", nullable=False)}
    format: Mapped[str] = mapped_column(String(20), nullable=False)
    storage_uri: Mapped[str | None] = mapped_column(String(500), nullable=True)
    content_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    file_size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="queued", index=True)
'''

MODELS["data_import"] = f'''"""Data import ORM per ERD_20 section 6.18."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.analytics.models.mixins import BiRowMixin


class BiDataImport(Base, *BiRowMixin):
    __tablename__ = "bi_data_import"
    __table_args__ = (
        UniqueConstraint("company_id", "import_number", name="uk_bi_data_import_number"),
        CheckConstraint(
            "format IN ('csv','xlsx','json')",
            name="ck_bi_data_import_format",
        ),
        CheckConstraint(
            "status IN ('queued','running','succeeded','failed','cancelled')",
            name="ck_bi_data_import_status",
        ),
        CheckConstraint("rows_loaded IS NULL OR rows_loaded >= 0", name="ck_bi_import_rows_loaded"),
        {{"schema": "analytics"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{OPT_BRANCH}
    import_number: Mapped[str] = mapped_column(String(50), nullable=False)
    dataset_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("analytics.bi_dataset.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
{_emp_fk("requested_by_employee_id", nullable=False)}
    source_uri: Mapped[str | None] = mapped_column(String(500), nullable=True)
    content_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    format: Mapped[str] = mapped_column(String(20), nullable=False)
    rows_loaded: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="queued", index=True)
'''

MODELS["query_history"] = f'''"""Query history ORM per ERD_20 section 6.19."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.analytics.models.mixins import BiRowMixin


class BiQueryHistory(Base, *BiRowMixin):
    __tablename__ = "bi_query_history"
    __table_args__ = (
        CheckConstraint(
            "status IN ('succeeded','failed','timeout','recorded')",
            name="ck_bi_query_history_status",
        ),
        CheckConstraint("row_count IS NULL OR row_count >= 0", name="ck_bi_qh_row_count"),
        CheckConstraint("duration_ms IS NULL OR duration_ms >= 0", name="ck_bi_qh_duration"),
        {{"schema": "analytics"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{OPT_BRANCH}
{_fk("dataset_id", "analytics.bi_dataset.id")}
{_fk("report_id", "analytics.bi_report.id")}
{_emp_fk("executed_by_employee_id")}
{_uuid_only("executed_by_user_id")}
    query_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    query_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    row_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    executed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="recorded", index=True)
'''

MODELS["usage_audit"] = f'''"""Usage audit ORM per ERD_20 section 6.20."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.analytics.models.mixins import BiRowMixin


class BiUsageAudit(Base, *BiRowMixin):
    __tablename__ = "bi_usage_audit"
    __table_args__ = (
        CheckConstraint(
            "resource_type IN ('dashboard','report','kpi','dataset','export','widget','alert')",
            name="ck_bi_usage_resource_type",
        ),
        CheckConstraint(
            "action IN ('view','run','export','subscribe','edit','publish','refresh')",
            name="ck_bi_usage_action",
        ),
        CheckConstraint("status IN ('recorded')", name="ck_bi_usage_audit_status"),
        {{"schema": "analytics"}},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
{OPT_BRANCH}
{_emp_fk("actor_employee_id")}
{_uuid_only("actor_user_id")}
    resource_type: Mapped[str] = mapped_column(String(40), nullable=False)
    resource_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    action: Mapped[str] = mapped_column(String(30), nullable=False)
    payload_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    occurred_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="recorded", index=True)
'''


ENGINE_BODIES: dict[str, str] = {
    "Dashboard": '''
class DashboardEngine:
    def submit(self, row) -> None:
        if row.status != DashboardStatus.DRAFT.value:
            raise InvalidDashboardState("Only draft dashboards can be submitted")
        row.status = DashboardStatus.SUBMITTED.value

    def approve(self, row) -> None:
        if row.status != DashboardStatus.SUBMITTED.value:
            raise InvalidDashboardState("Only submitted dashboards can be approved")
        row.status = DashboardStatus.APPROVED.value

    def publish(self, row) -> None:
        if row.status != DashboardStatus.APPROVED.value:
            raise InvalidDashboardState("Only approved dashboards can be published")
        row.status = DashboardStatus.PUBLISHED.value

    def archive(self, row) -> None:
        row.status = DashboardStatus.ARCHIVED.value

    def cancel(self, row) -> None:
        row.status = DashboardStatus.CANCELLED.value
''',
    "DashboardWidget": '''
class DashboardWidgetEngine:
    def hide(self, row) -> None:
        row.status = DashboardWidgetStatus.HIDDEN.value

    def activate(self, row) -> None:
        row.status = DashboardWidgetStatus.ACTIVE.value

    def archive(self, row) -> None:
        row.status = DashboardWidgetStatus.ARCHIVED.value
''',
    "Report": '''
class ReportEngine:
    def submit(self, row) -> None:
        if row.status != ReportStatus.DRAFT.value:
            raise InvalidReportState("Only draft reports can be submitted")
        row.status = ReportStatus.SUBMITTED.value

    def approve(self, row) -> None:
        if row.status != ReportStatus.SUBMITTED.value:
            raise InvalidReportState("Only submitted reports can be approved")
        row.status = ReportStatus.APPROVED.value

    def publish(self, row) -> None:
        if row.status != ReportStatus.APPROVED.value:
            raise InvalidReportState("Only approved reports can be published")
        row.status = ReportStatus.PUBLISHED.value

    def run(self, row) -> None:
        if row.status not in {
            ReportStatus.APPROVED.value,
            ReportStatus.PUBLISHED.value,
        }:
            raise InvalidReportState("Report must be approved or published to run")
''',
    "ReportSchedule": '''
class ReportScheduleEngine:
    def pause(self, row) -> None:
        row.status = ReportScheduleStatus.PAUSED.value
        row.is_enabled = False

    def activate(self, row) -> None:
        row.status = ReportScheduleStatus.ACTIVE.value
        row.is_enabled = True

    def retire(self, row) -> None:
        row.status = ReportScheduleStatus.RETIRED.value
        row.is_enabled = False
''',
    "ReportExecution": '''
class ReportExecutionEngine:
    def start(self, row) -> None:
        row.status = ReportExecutionStatus.RUNNING.value

    def succeed(self, row) -> None:
        row.status = ReportExecutionStatus.SUCCEEDED.value

    def fail(self, row) -> None:
        row.status = ReportExecutionStatus.FAILED.value

    def cancel(self, row) -> None:
        row.status = ReportExecutionStatus.CANCELLED.value
''',
    "Dataset": '''
class DatasetEngine:
    def submit(self, row) -> None:
        if row.status != DatasetStatus.DRAFT.value:
            raise InvalidDatasetState("Only draft datasets can be submitted")
        row.status = DatasetStatus.SUBMITTED.value

    def approve(self, row) -> None:
        if row.status != DatasetStatus.SUBMITTED.value:
            raise InvalidDatasetState("Only submitted datasets can be approved")
        row.status = DatasetStatus.APPROVED.value

    def refresh(self, row) -> None:
        if row.status not in {
            DatasetStatus.APPROVED.value,
            DatasetStatus.ACTIVE.value,
            DatasetStatus.FAILED.value,
        }:
            raise InvalidDatasetState("Dataset not refreshable")
        row.status = DatasetStatus.REFRESHING.value

    def activate(self, row) -> None:
        row.status = DatasetStatus.ACTIVE.value

    def mark_failed(self, row) -> None:
        row.status = DatasetStatus.FAILED.value

    def retire(self, row) -> None:
        row.status = DatasetStatus.RETIRED.value
''',
    "DatasetSource": '''
class DatasetSourceEngine:
    def activate(self, row) -> None:
        row.status = DatasetSourceStatus.ACTIVE.value

    def deactivate(self, row) -> None:
        row.status = DatasetSourceStatus.INACTIVE.value
''',
    "Metric": '''
class MetricEngine:
    def activate(self, row) -> None:
        row.status = MetricStatus.ACTIVE.value

    def deprecate(self, row) -> None:
        row.status = MetricStatus.DEPRECATED.value
''',
    "Kpi": '''
class KpiEngine:
    def submit(self, row) -> None:
        if row.status != KpiStatus.DRAFT.value:
            raise InvalidKpiState("Only draft KPIs can be submitted")
        row.status = KpiStatus.SUBMITTED.value

    def approve(self, row) -> None:
        if row.status != KpiStatus.SUBMITTED.value:
            raise InvalidKpiState("Only submitted KPIs can be approved")
        row.status = KpiStatus.APPROVED.value

    def activate(self, row) -> None:
        row.status = KpiStatus.ACTIVE.value

    def deactivate(self, row) -> None:
        row.status = KpiStatus.INACTIVE.value

    def cancel(self, row) -> None:
        row.status = KpiStatus.CANCELLED.value
''',
    "Dimension": '''
class DimensionEngine:
    def activate(self, row) -> None:
        row.status = DimensionStatus.ACTIVE.value

    def deactivate(self, row) -> None:
        row.status = DimensionStatus.INACTIVE.value
''',
    "FactTable": '''
class FactTableEngine:
    def activate(self, row) -> None:
        row.status = FactTableStatus.ACTIVE.value

    def rebuild(self, row) -> None:
        row.status = FactTableStatus.REBUILDING.value

    def retire(self, row) -> None:
        row.status = FactTableStatus.RETIRED.value
''',
    "DataSnapshot": '''
class DataSnapshotEngine:
    def expire(self, row) -> None:
        row.status = DataSnapshotStatus.EXPIRED.value

    def mark_failed(self, row) -> None:
        row.status = DataSnapshotStatus.FAILED.value
''',
    "DataRefresh": '''
class DataRefreshEngine:
    def submit(self, row) -> None:
        if row.status != DataRefreshStatus.DRAFT.value:
            raise InvalidDataRefreshState("Only draft refreshes can be submitted")
        row.status = DataRefreshStatus.SUBMITTED.value

    def queue(self, row) -> None:
        row.status = DataRefreshStatus.QUEUED.value

    def start(self, row) -> None:
        row.status = DataRefreshStatus.RUNNING.value

    def succeed(self, row) -> None:
        row.status = DataRefreshStatus.SUCCEEDED.value

    def fail(self, row) -> None:
        row.status = DataRefreshStatus.FAILED.value

    def cancel(self, row) -> None:
        row.status = DataRefreshStatus.CANCELLED.value
''',
    "AlertRule": '''
class AlertRuleEngine:
    def submit(self, row) -> None:
        if row.status != AlertRuleStatus.DRAFT.value:
            raise InvalidAlertRuleState("Only draft alert rules can be submitted")
        row.status = AlertRuleStatus.SUBMITTED.value

    def approve(self, row) -> None:
        if row.status != AlertRuleStatus.SUBMITTED.value:
            raise InvalidAlertRuleState("Only submitted alert rules can be approved")
        row.status = AlertRuleStatus.APPROVED.value

    def activate(self, row) -> None:
        row.status = AlertRuleStatus.ACTIVE.value
        row.is_enabled = True

    def pause(self, row) -> None:
        row.status = AlertRuleStatus.PAUSED.value
        row.is_enabled = False

    def retire(self, row) -> None:
        row.status = AlertRuleStatus.RETIRED.value
        row.is_enabled = False
''',
    "AlertNotification": '''
class AlertNotificationEngine:
    def acknowledge(self, row) -> None:
        if row.status not in {
            AlertNotificationStatus.OPEN.value,
        }:
            raise InvalidAlertNotificationState("Only open notifications can be acknowledged")
        row.status = AlertNotificationStatus.ACKNOWLEDGED.value
        row.delivery_status = "acknowledged"

    def close(self, row) -> None:
        row.status = AlertNotificationStatus.CLOSED.value
''',
    "Subscription": '''
class SubscriptionEngine:
    def pause(self, row) -> None:
        row.status = SubscriptionStatus.PAUSED.value

    def activate(self, row) -> None:
        row.status = SubscriptionStatus.ACTIVE.value

    def cancel(self, row) -> None:
        row.status = SubscriptionStatus.CANCELLED.value
''',
    "DataExport": '''
class DataExportEngine:
    def run(self, row) -> None:
        if row.status not in {
            DataExportStatus.QUEUED.value,
            DataExportStatus.FAILED.value,
        }:
            raise InvalidDataExportState("Export not runnable")
        row.status = DataExportStatus.RUNNING.value

    def succeed(self, row) -> None:
        row.status = DataExportStatus.SUCCEEDED.value

    def fail(self, row) -> None:
        row.status = DataExportStatus.FAILED.value

    def expire(self, row) -> None:
        row.status = DataExportStatus.EXPIRED.value
''',
    "DataImport": '''
class DataImportEngine:
    def run(self, row) -> None:
        if row.status not in {
            DataImportStatus.QUEUED.value,
            DataImportStatus.FAILED.value,
        }:
            raise InvalidDataImportState("Import not runnable")
        row.status = DataImportStatus.RUNNING.value

    def succeed(self, row) -> None:
        row.status = DataImportStatus.SUCCEEDED.value

    def fail(self, row) -> None:
        row.status = DataImportStatus.FAILED.value

    def cancel(self, row) -> None:
        row.status = DataImportStatus.CANCELLED.value
''',
    "QueryHistory": '''
class QueryHistoryEngine:
    def record(self, row) -> None:
        row.status = QueryHistoryStatus.RECORDED.value
''',
    "UsageAudit": '''
class UsageAuditEngine:
    def record(self, row) -> None:
        row.status = UsageAuditStatus.RECORDED.value
''',
}


def gen_scaffold() -> None:
    w(ANALYTICS / "__init__.py", '"""Business Intelligence & Analytics module — Sprint 20."""\n')
    w(ANALYTICS / "domain" / "__init__.py", '"""Analytics domain layer."""\n')
    w(ANALYTICS / "adapters" / "__init__.py", '"""Analytics cross-module adapters."""\n')
    w(ANALYTICS / "service" / "__init__.py", '"""Analytics services — populated after generation."""\n')
    w(ANALYTICS / "service" / "engines" / "__init__.py", '"""Analytics engines — populated after generation."""\n')
    w(ANALYTICS / "repository" / "__init__.py", '"""Analytics repositories."""\n')
    w(ANALYTICS / "models" / "__init__.py", '"""Analytics models — populated after generation."""\n')
    w(
        ANALYTICS / "models" / "mixins.py",
        '''"""Analytics ORM mixin bundles per ERD_20."""

from database.mixins import (
    AuditMixin,
    CompanyMixin,
    SoftDeleteMixin,
    TenantMixin,
    VersionMixin,
)

# Optional branch_id is declared per-model (ERD: branch optional on all bi_* tables).
BiRowMixin = (
    AuditMixin,
    TenantMixin,
    CompanyMixin,
    SoftDeleteMixin,
    VersionMixin,
)
''',
    )


def gen_domain() -> None:
    w(
        ANALYTICS / "domain" / "enums.py",
        '''"""Analytics domain enums per ERD_20 section 11."""

from enum import Enum


class DashboardStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    PUBLISHED = "published"
    ARCHIVED = "archived"
    CANCELLED = "cancelled"


class DashboardWidgetStatus(str, Enum):
    ACTIVE = "active"
    HIDDEN = "hidden"
    ARCHIVED = "archived"


class ReportStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    PUBLISHED = "published"
    ARCHIVED = "archived"
    CANCELLED = "cancelled"


class ReportScheduleStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    RETIRED = "retired"


class ReportExecutionStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"


class DatasetStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    ACTIVE = "active"
    REFRESHING = "refreshing"
    FAILED = "failed"
    RETIRED = "retired"


class DatasetSourceStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class MetricStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    DEPRECATED = "deprecated"


class KpiStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    ACTIVE = "active"
    INACTIVE = "inactive"
    CANCELLED = "cancelled"


class DimensionStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class FactTableStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    REBUILDING = "rebuilding"
    RETIRED = "retired"


class DataSnapshotStatus(str, Enum):
    READY = "ready"
    EXPIRED = "expired"
    FAILED = "failed"


class DataRefreshStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"


class AlertRuleStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    ACTIVE = "active"
    PAUSED = "paused"
    RETIRED = "retired"


class AlertNotificationStatus(str, Enum):
    OPEN = "open"
    ACKNOWLEDGED = "acknowledged"
    CLOSED = "closed"


class SubscriptionStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    CANCELLED = "cancelled"


class DataExportStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    EXPIRED = "expired"


class DataImportStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"


class QueryHistoryStatus(str, Enum):
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    TIMEOUT = "timeout"
    RECORDED = "recorded"


class UsageAuditStatus(str, Enum):
    RECORDED = "recorded"


class AnalyticsEntityType(str, Enum):
    DASHBOARD = "dashboard"
    REPORT = "report"
    REPORT_EXECUTION = "report_execution"
    DATASET = "dataset"
    KPI = "kpi"
    ALERT = "alert"
    SUBSCRIPTION = "subscription"
    EXPORT = "export"
    IMPORT = "import"
    REFRESH = "refresh"
    SNAPSHOT = "snapshot"


CODE_PREFIXES: dict[AnalyticsEntityType, tuple[str, int, bool]] = {
    AnalyticsEntityType.DASHBOARD: ("DASH-", 6, True),
    AnalyticsEntityType.REPORT: ("RPT-", 6, True),
    AnalyticsEntityType.REPORT_EXECUTION: ("REX-", 6, True),
    AnalyticsEntityType.DATASET: ("DS-", 6, True),
    AnalyticsEntityType.KPI: ("KPI-", 6, True),
    AnalyticsEntityType.ALERT: ("ALR-", 6, True),
    AnalyticsEntityType.SUBSCRIPTION: ("SUB-", 6, True),
    AnalyticsEntityType.EXPORT: ("EXP-", 6, True),
    AnalyticsEntityType.IMPORT: ("IMP-", 6, True),
    AnalyticsEntityType.REFRESH: ("RFH-", 6, True),
    AnalyticsEntityType.SNAPSHOT: ("SNP-", 6, True),
}
''',
    )
    exc_lines = []
    for _, _, name, _ in TABLES:
        exc_lines.append(
            f'''
class Invalid{name}State(ConflictException):
    def __init__(self, message: str = "Invalid {name.lower()} state") -> None:
        super().__init__(message)
'''
        )
    w(
        ANALYTICS / "domain" / "exceptions.py",
        '"""Analytics domain exceptions."""\n\nfrom core.exceptions import ConflictException\n'
        + "".join(exc_lines),
    )
    w(
        ANALYTICS / "domain" / "value_objects.py",
        '''"""Analytics value objects."""

from dataclasses import dataclass


@dataclass(frozen=True)
class AnalyticsCodes:
    document_number: str
''',
    )
    w(
        ANALYTICS / "domain" / "entities.py",
        '''"""Analytics domain entity markers."""

from dataclasses import dataclass
from uuid import UUID


@dataclass
class DashboardIdentity:
    dashboard_id: UUID
    dashboard_number: str
    owner_employee_id: UUID
''',
    )


def gen_models() -> None:
    for key, body in MODELS.items():
        w(ANALYTICS / "models" / f"{key}.py", body)
    imports = "\n".join(
        f"from modules.analytics.models.{k} import {CLASS_MAP[k]}" for k in CLASS_MAP
    )
    all_names = ",\n    ".join(f'"{CLASS_MAP[k]}"' for k in CLASS_MAP)
    w(
        ANALYTICS / "models" / "__init__.py",
        f'"""Analytics ORM models."""\n\n{imports}\n\n__all__ = [\n    {all_names},\n]\n',
    )


def gen_migrations() -> None:
    w(
        ALEMBIC / "0355_create_analytics_schema.py",
        '''"""Create analytics schema."""

from collections.abc import Sequence

from alembic import op

revision: str = "0355_create_analytics_schema"
down_revision: str | None = "0354_seed_grc_workflows"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS analytics")


def downgrade() -> None:
    op.execute("DROP SCHEMA IF EXISTS analytics CASCADE")
''',
    )
    for rev, target, down in MIGRATIONS:
        if target == "schema" or (isinstance(target, str) and target.startswith("seed")):
            continue
        if isinstance(target, list):
            imports = "\n".join(
                f"from modules.analytics.models.{m} import {CLASS_MAP[m]}  # noqa: F401"
                for m in target
            )
            creates = "\n    ".join(
                f"{CLASS_MAP[m]}.__table__.create(bind=op.get_bind(), checkfirst=True)"
                for m in target
            )
            drops = "\n    ".join(
                f"{CLASS_MAP[m]}.__table__.drop(bind=op.get_bind(), checkfirst=True)"
                for m in reversed(target)
            )
            w(
                ALEMBIC / f"{rev}.py",
                f'''"""Create bi_dataset and bi_dataset_source tables."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

{imports}

revision: str = "{rev}"
down_revision: str | None = "{down}"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    {creates}


def downgrade() -> None:
    {drops}
''',
            )
        else:
            cls = CLASS_MAP[target]
            w(
                ALEMBIC / f"{rev}.py",
                f'''"""Create {cls} table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.analytics.models.{target} import {cls}  # noqa: F401

revision: str = "{rev}"
down_revision: str | None = "{down}"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    {cls}.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    {cls}.__table__.drop(bind=op.get_bind(), checkfirst=True)
''',
            )


def repo_template(module: str, cls: str, name: str, branch: bool) -> str:
    return f'''"""Analytics {cls} repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.analytics.models import {cls}
from modules.analytics.repository.base import AnalyticsScopedRepository, utcnow
from modules.foundation.domain.value_objects import TenantContext


class {name}Repository(AnalyticsScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> {cls} | None:
        stmt = select({cls}).where({cls}.id == row_id, {cls}.is_deleted.is_(False))
        stmt = self.apply_analytics_filter(stmt, {cls}, ctx, branch_scoped={branch})
        return self.db.scalar(stmt)

    def list_rows(self, ctx: TenantContext, company_id: UUID):
        stmt = select({cls}).where(
            {cls}.company_id == company_id,
            {cls}.is_deleted.is_(False),
        )
        stmt = self.apply_analytics_filter(stmt, {cls}, ctx, branch_scoped={branch})
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> {cls}:
        row = {cls}(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> {cls} | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        for k, v in fields.items():
            if v is not None:
                setattr(row, k, v)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        if hasattr(row, "version"):
            row.version = int(row.version or 1) + 1
        self.db.flush()
        return row
'''


def gen_repos() -> None:
    w(
        ANALYTICS / "repository" / "base.py",
        '''"""Analytics scoped repository base."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import ForbiddenException
from modules.foundation.domain.value_objects import TenantContext
from modules.organization.repository.base import OrgScopedRepository


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AnalyticsScopedRepository(OrgScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    @staticmethod
    def apply_analytics_filter(stmt, model, ctx: TenantContext, *, branch_scoped: bool = False):
        stmt = AnalyticsScopedRepository.apply_tenant_filter(stmt, model, ctx)
        if ctx.company_id and ctx.user_type not in {"super_admin", "tenant_admin"}:
            stmt = stmt.where(model.company_id == ctx.company_id)
        if (
            branch_scoped
            and ctx.branch_id
            and ctx.user_type not in {"super_admin", "tenant_admin"}
            and hasattr(model, "branch_id")
        ):
            stmt = stmt.where(model.branch_id == ctx.branch_id)
        return stmt

    @staticmethod
    def resolve_company_id(ctx: TenantContext, company_id: UUID | None) -> UUID:
        if company_id is not None:
            AnalyticsScopedRepository.ensure_company_access(ctx, company_id)
            return company_id
        if ctx.company_id is None:
            raise ForbiddenException("Company context required")
        return ctx.company_id
''',
    )
    w(
        ANALYTICS / "repository" / "code_sequence_repository.py",
        '''"""Analytics code sequences."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.analytics.domain.enums import CODE_PREFIXES, AnalyticsEntityType


class CodeSequenceRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def next_code(self, entity: AnalyticsEntityType, company_id: UUID, model, code_column: str) -> str:
        prefix, width, include_year = CODE_PREFIXES[entity]
        year = datetime.now(timezone.utc).year
        full_prefix = f"{prefix}{year}-" if include_year else prefix
        stmt = select(getattr(model, code_column)).where(
            model.company_id == company_id,
            getattr(model, code_column).like(f"{full_prefix}%"),
            model.is_deleted.is_(False),
        )
        existing = list(self.db.scalars(stmt).all())
        seq = 1
        if existing:
            nums = []
            for code in existing:
                try:
                    nums.append(int(str(code).rsplit("-", 1)[-1]))
                except ValueError:
                    continue
            if nums:
                seq = max(nums) + 1
        return f"{full_prefix}{seq:0{width}d}"
''',
    )
    for module, cls, name, branch in TABLES:
        w(
            ANALYTICS / "repository" / f"{module}_repository.py",
            repo_template(module, cls, name, branch),
        )


def gen_engines() -> None:
    status_imports = {
        "Dashboard": "DashboardStatus",
        "DashboardWidget": "DashboardWidgetStatus",
        "Report": "ReportStatus",
        "ReportSchedule": "ReportScheduleStatus",
        "ReportExecution": "ReportExecutionStatus",
        "Dataset": "DatasetStatus",
        "DatasetSource": "DatasetSourceStatus",
        "Metric": "MetricStatus",
        "Kpi": "KpiStatus",
        "Dimension": "DimensionStatus",
        "FactTable": "FactTableStatus",
        "DataSnapshot": "DataSnapshotStatus",
        "DataRefresh": "DataRefreshStatus",
        "AlertRule": "AlertRuleStatus",
        "AlertNotification": "AlertNotificationStatus",
        "Subscription": "SubscriptionStatus",
        "DataExport": "DataExportStatus",
        "DataImport": "DataImportStatus",
        "QueryHistory": "QueryHistoryStatus",
        "UsageAudit": "UsageAuditStatus",
    }
    exc_imports = {
        "Dashboard": "InvalidDashboardState",
        "Report": "InvalidReportState",
        "Dataset": "InvalidDatasetState",
        "Kpi": "InvalidKpiState",
        "DataRefresh": "InvalidDataRefreshState",
        "AlertRule": "InvalidAlertRuleState",
        "AlertNotification": "InvalidAlertNotificationState",
        "DataExport": "InvalidDataExportState",
        "DataImport": "InvalidDataImportState",
    }
    for eng_name, body in ENGINE_BODIES.items():
        fname = ENGINE_FILE_MAP[eng_name]
        st = status_imports[eng_name]
        header = f'"""{eng_name} lifecycle engine."""\n\n'
        header += f"from modules.analytics.domain.enums import (\n    {st},\n)\n"
        if eng_name in exc_imports:
            header += (
                f"from modules.analytics.domain.exceptions import (\n"
                f"    {exc_imports[eng_name]},\n)\n"
            )
        header += "\n"
        w(ANALYTICS / "service" / "engines" / f"{fname}_engine.py", header + body.lstrip("\n"))
    lines = [
        f"from modules.analytics.service.engines.{ENGINE_FILE_MAP[n]}_engine "
        f"import {n}Engine"
        for n in ENGINE_NAMES
    ]
    all_names = ",\n    ".join(f'"{n}Engine"' for n in ENGINE_NAMES)
    w(
        ANALYTICS / "service" / "engines" / "__init__.py",
        '"""Analytics business engines."""\n\n'
        + "\n".join(lines)
        + f"\n\n__all__ = [\n    {all_names},\n]\n",
    )


def catalog_service(
    svc_name: str,
    cls: str,
    repo_name: str,
    entity: str,
    engine_name: str,
) -> str:
    return f'''"""{svc_name} application service."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.analytics.models import {cls}
from modules.analytics.repository.{entity}_repository import {repo_name}Repository
from modules.analytics.service.analytics_scope_validator import AnalyticsScopeValidator
from modules.analytics.service.engines import {engine_name}Engine
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService


class {svc_name}:
    def __init__(self, db: Session) -> None:
        self._repo = {repo_name}Repository(db)
        self._scope = AnalyticsScopeValidator(db)
        self._engine = {engine_name}Engine()
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> {cls}:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("{svc_name} not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        row = self._repo.create(ctx, company_id=cid, **fields)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="bi_{entity}",
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("{svc_name} not found")
        return row
'''


def numbered_service(
    svc_name: str,
    cls: str,
    repo_name: str,
    entity: str,
    entity_type: str,
    code_col: str,
    engine_name: str,
    actions: list[str],
) -> str:
    action_methods = ""
    for act in actions:
        action_methods += f'''
    def {act}(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.{act}(row)
        return self._repo.update(ctx, row_id, status=row.status)
'''
    return f'''"""{svc_name}."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.analytics.domain.enums import AnalyticsEntityType
from modules.analytics.models import {cls}
from modules.analytics.repository.{entity}_repository import {repo_name}Repository
from modules.analytics.service.analytics_number_service import AnalyticsNumberService
from modules.analytics.service.analytics_scope_validator import AnalyticsScopeValidator
from modules.analytics.service.engines import {engine_name}Engine
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService


class {svc_name}:
    def __init__(self, db: Session) -> None:
        self._repo = {repo_name}Repository(db)
        self._scope = AnalyticsScopeValidator(db)
        self._numbers = AnalyticsNumberService(db)
        self._engine = {engine_name}Engine()
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> {cls}:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("{svc_name} not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        doc = self._numbers.generate(AnalyticsEntityType.{entity_type}, cid, {cls}, "{code_col}")
        return self._repo.create(ctx, company_id=cid, {code_col}=doc, **fields)

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("{svc_name} not found")
        return row
{action_methods}
'''


def gen_services() -> None:
    w(
        ANALYTICS / "service" / "analytics_scope_validator.py",
        '''"""Analytics scope validator."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.analytics.repository.base import AnalyticsScopedRepository
from modules.foundation.domain.value_objects import TenantContext


class AnalyticsScopeValidator(AnalyticsScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def validate_company_access(self, ctx: TenantContext, company_id: UUID) -> None:
        self.ensure_company_access(ctx, company_id)

    def validate_branch_access(self, ctx: TenantContext, branch_id: UUID) -> None:
        self.ensure_branch_access(ctx, branch_id)
''',
    )
    w(
        ANALYTICS / "service" / "analytics_number_service.py",
        '''"""Analytics numbering."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.analytics.domain.enums import AnalyticsEntityType
from modules.analytics.repository.code_sequence_repository import CodeSequenceRepository


class AnalyticsNumberService:
    def __init__(self, db: Session) -> None:
        self._seq = CodeSequenceRepository(db)

    def generate(self, entity: AnalyticsEntityType, company_id: UUID, model, code_column: str) -> str:
        return self._seq.next_code(entity, company_id, model, code_column)
''',
    )

    simple_specs = [
        ("DashboardWidgetService", "BiDashboardWidget", "DashboardWidget", "dashboard_widget", "DashboardWidget", "dashboard_widget_service.py"),
        ("ReportScheduleService", "BiReportSchedule", "ReportSchedule", "report_schedule", "ReportSchedule", "report_schedule_service.py"),
        ("DatasetSourceService", "BiDatasetSource", "DatasetSource", "dataset_source", "DatasetSource", "dataset_source_service.py"),
        ("MetricService", "BiMetric", "Metric", "metric", "Metric", "metric_service.py"),
        ("DimensionService", "BiDimension", "Dimension", "dimension", "Dimension", "dimension_service.py"),
        ("FactTableService", "BiFactTable", "FactTable", "fact_table", "FactTable", "fact_table_service.py"),
        ("AlertNotificationService", "BiAlertNotification", "AlertNotification", "alert_notification", "AlertNotification", "alert_notification_service.py"),
        ("QueryHistoryService", "BiQueryHistory", "QueryHistory", "query_history", "QueryHistory", "query_history_service.py"),
        ("UsageAuditService", "BiUsageAudit", "UsageAudit", "usage_audit", "UsageAudit", "usage_audit_service.py"),
    ]
    for svc, cls, repo, entity, eng, fname in simple_specs:
        body = catalog_service(svc, cls, repo, entity, eng)
        if svc == "AlertNotificationService":
            body = body.rstrip() + '''

    def acknowledge(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.acknowledge(row)
        return self._repo.update(ctx, row_id, status=row.status, delivery_status=row.delivery_status)
'''
        w(ANALYTICS / "service" / fname, body)

    numbered = [
        ("DashboardService", "BiDashboard", "Dashboard", "dashboard", "DASHBOARD", "dashboard_number", "Dashboard", ["submit", "approve", "publish"], "dashboard_service.py"),
        ("ReportService", "BiReport", "Report", "report", "REPORT", "report_number", "Report", ["submit", "approve", "publish", "run"], "report_service.py"),
        ("ReportExecutionService", "BiReportExecution", "ReportExecution", "report_execution", "REPORT_EXECUTION", "execution_number", "ReportExecution", [], "report_execution_service.py"),
        ("DatasetService", "BiDataset", "Dataset", "dataset", "DATASET", "dataset_number", "Dataset", ["submit", "approve", "refresh"], "dataset_service.py"),
        ("KpiService", "BiKpi", "Kpi", "kpi", "KPI", "kpi_number", "Kpi", ["submit", "approve"], "kpi_service.py"),
        ("DataSnapshotService", "BiDataSnapshot", "DataSnapshot", "data_snapshot", "SNAPSHOT", "snapshot_number", "DataSnapshot", [], "data_snapshot_service.py"),
        ("DataRefreshService", "BiDataRefresh", "DataRefresh", "data_refresh", "REFRESH", "refresh_number", "DataRefresh", ["submit"], "data_refresh_service.py"),
        ("AlertRuleService", "BiAlertRule", "AlertRule", "alert_rule", "ALERT", "alert_number", "AlertRule", ["submit", "approve"], "alert_rule_service.py"),
        ("SubscriptionService", "BiSubscription", "Subscription", "subscription", "SUBSCRIPTION", "subscription_number", "Subscription", [], "subscription_service.py"),
        ("DataExportService", "BiDataExport", "DataExport", "data_export", "EXPORT", "export_number", "DataExport", ["run"], "data_export_service.py"),
        ("DataImportService", "BiDataImport", "DataImport", "data_import", "IMPORT", "import_number", "DataImport", ["run"], "data_import_service.py"),
    ]
    for svc, cls, repo, entity, etype, col, eng, acts, fname in numbered:
        w(
            ANALYTICS / "service" / fname,
            numbered_service(svc, cls, repo, entity, etype, col, eng, acts),
        )

    w(
        ANALYTICS / "service" / "integration_service.py",
        '''"""Analytics integration — read-only peers; no PostingService / no fin_* writes."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.analytics.adapters.finance_read_port import AnalyticsFinanceReadAdapter
from modules.analytics.adapters.master_data_port import AnalyticsMasterDataAdapter
from modules.analytics.adapters.organization_port import AnalyticsOrganizationAdapter
from modules.foundation.domain.value_objects import TenantContext


class AnalyticsIntegrationService:
    def __init__(self, db: Session) -> None:
        self._master = AnalyticsMasterDataAdapter(db)
        self._org = AnalyticsOrganizationAdapter(db)
        self._finance = AnalyticsFinanceReadAdapter(db)

    def get_employee(self, ctx: TenantContext, employee_id: UUID):
        return self._master.get_employee(ctx, employee_id)

    def get_customer(self, ctx: TenantContext, customer_id: UUID):
        return self._master.get_customer(ctx, customer_id)

    def get_product(self, ctx: TenantContext, product_id: UUID):
        return self._master.get_product(ctx, product_id)

    def get_vendor(self, ctx: TenantContext, vendor_id: UUID):
        return self._master.get_vendor(ctx, vendor_id)

    def get_department(self, ctx: TenantContext, department_id: UUID):
        return self._org.get_department(ctx, department_id)

    def finance_ledger_hint(self, ctx: TenantContext, ledger_ref_id: UUID | None) -> UUID | None:
        return self._finance.resolve_ledger_ref(ctx, ledger_ref_id)
''',
    )

    w(
        ANALYTICS / "service" / "application_service.py",
        '''"""Analytics application service facade."""

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
''',
    )

    w(
        ANALYTICS / "service" / "__init__.py",
        '''"""Analytics services."""

from modules.analytics.service.alert_notification_service import AlertNotificationService
from modules.analytics.service.alert_rule_service import AlertRuleService
from modules.analytics.service.application_service import AnalyticsApplicationService
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

__all__ = [
    "AlertNotificationService",
    "AlertRuleService",
    "AnalyticsApplicationService",
    "AnalyticsIntegrationService",
    "DashboardService",
    "DashboardWidgetService",
    "DataExportService",
    "DataImportService",
    "DataRefreshService",
    "DataSnapshotService",
    "DatasetService",
    "DatasetSourceService",
    "DimensionService",
    "FactTableService",
    "KpiService",
    "MetricService",
    "QueryHistoryService",
    "ReportExecutionService",
    "ReportScheduleService",
    "ReportService",
    "SubscriptionService",
    "UsageAuditService",
]
''',
    )


def gen_adapters() -> None:
    w(
        ANALYTICS / "adapters" / "master_data_port.py",
        '''"""Master Data port — employee / customer / product / vendor (C-01)."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.master_data.service.customer_service import CustomerService
from modules.master_data.service.employee_service import EmployeeService
from modules.master_data.service.product_service import ProductService
from modules.master_data.service.vendor_service import VendorService


class AnalyticsMasterDataAdapter:
    def __init__(self, db: Session) -> None:
        self._customers = CustomerService(db)
        self._employees = EmployeeService(db)
        self._products = ProductService(db)
        self._vendors = VendorService(db)

    def get_customer(self, ctx: TenantContext, customer_id: UUID):
        return self._customers.get_customer(ctx, customer_id)

    def get_employee(self, ctx: TenantContext, employee_id: UUID):
        return self._employees.get_employee(ctx, employee_id)

    def get_product(self, ctx: TenantContext, product_id: UUID):
        return self._products.get_product(ctx, product_id)

    def get_vendor(self, ctx: TenantContext, vendor_id: UUID):
        return self._vendors.get_vendor(ctx, vendor_id)
''',
    )
    w(
        ANALYTICS / "adapters" / "organization_port.py",
        '''"""Organization port — read org_department only."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.organization.repository.hierarchy_repository import DepartmentRepository


class AnalyticsOrganizationAdapter:
    def __init__(self, db: Session) -> None:
        self._departments = DepartmentRepository(db)

    def get_department(self, ctx: TenantContext, department_id: UUID):
        row = self._departments.get_by_id(ctx, department_id)
        if row is None:
            raise NotFoundException("Department not found")
        return row
''',
    )
    w(
        ANALYTICS / "adapters" / "finance_read_port.py",
        '''"""Finance read port — analytical consumption ONLY.

NEVER uses PostingService. NEVER writes fin_* tables.
UUID / context resolution stubs only.
"""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext


class AnalyticsFinanceReadAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db

    def resolve_ledger_ref(self, ctx: TenantContext, ledger_ref_id: UUID | None) -> UUID | None:
        """Read-only UUID passthrough for analytical ledger context."""
        _ = (ctx, self._db)
        return ledger_ref_id
''',
    )


def gen_permissions() -> None:
    w(
        ANALYTICS / "permissions.py",
        '''"""Analytics permission constants per ERD_20 section 14."""

ANALYTICS_PERMISSIONS: list[tuple[str, str, str, str]] = [
    ("analytics.dashboard:read", "analytics.dashboard", "read", "analytics"),
    ("analytics.dashboard:create", "analytics.dashboard", "create", "analytics"),
    ("analytics.dashboard:update", "analytics.dashboard", "update", "analytics"),
    ("analytics.dashboard:submit", "analytics.dashboard", "submit", "analytics"),
    ("analytics.dashboard:approve", "analytics.dashboard", "approve", "analytics"),
    ("analytics.dashboard:publish", "analytics.dashboard", "publish", "analytics"),
    ("analytics.widget:read", "analytics.widget", "read", "analytics"),
    ("analytics.widget:create", "analytics.widget", "create", "analytics"),
    ("analytics.widget:update", "analytics.widget", "update", "analytics"),
    ("analytics.report:read", "analytics.report", "read", "analytics"),
    ("analytics.report:create", "analytics.report", "create", "analytics"),
    ("analytics.report:update", "analytics.report", "update", "analytics"),
    ("analytics.report:submit", "analytics.report", "submit", "analytics"),
    ("analytics.report:approve", "analytics.report", "approve", "analytics"),
    ("analytics.report:publish", "analytics.report", "publish", "analytics"),
    ("analytics.report:run", "analytics.report", "run", "analytics"),
    ("analytics.schedule:read", "analytics.schedule", "read", "analytics"),
    ("analytics.schedule:create", "analytics.schedule", "create", "analytics"),
    ("analytics.schedule:update", "analytics.schedule", "update", "analytics"),
    ("analytics.execution:read", "analytics.execution", "read", "analytics"),
    ("analytics.execution:create", "analytics.execution", "create", "analytics"),
    ("analytics.execution:update", "analytics.execution", "update", "analytics"),
    ("analytics.dataset:read", "analytics.dataset", "read", "analytics"),
    ("analytics.dataset:create", "analytics.dataset", "create", "analytics"),
    ("analytics.dataset:update", "analytics.dataset", "update", "analytics"),
    ("analytics.dataset:submit", "analytics.dataset", "submit", "analytics"),
    ("analytics.dataset:approve", "analytics.dataset", "approve", "analytics"),
    ("analytics.dataset:refresh", "analytics.dataset", "refresh", "analytics"),
    ("analytics.source:read", "analytics.source", "read", "analytics"),
    ("analytics.source:create", "analytics.source", "create", "analytics"),
    ("analytics.source:update", "analytics.source", "update", "analytics"),
    ("analytics.metric:read", "analytics.metric", "read", "analytics"),
    ("analytics.metric:create", "analytics.metric", "create", "analytics"),
    ("analytics.metric:update", "analytics.metric", "update", "analytics"),
    ("analytics.dimension:read", "analytics.dimension", "read", "analytics"),
    ("analytics.dimension:create", "analytics.dimension", "create", "analytics"),
    ("analytics.dimension:update", "analytics.dimension", "update", "analytics"),
    ("analytics.fact:read", "analytics.fact", "read", "analytics"),
    ("analytics.fact:create", "analytics.fact", "create", "analytics"),
    ("analytics.fact:update", "analytics.fact", "update", "analytics"),
    ("analytics.kpi:read", "analytics.kpi", "read", "analytics"),
    ("analytics.kpi:create", "analytics.kpi", "create", "analytics"),
    ("analytics.kpi:update", "analytics.kpi", "update", "analytics"),
    ("analytics.kpi:submit", "analytics.kpi", "submit", "analytics"),
    ("analytics.kpi:approve", "analytics.kpi", "approve", "analytics"),
    ("analytics.snapshot:read", "analytics.snapshot", "read", "analytics"),
    ("analytics.snapshot:create", "analytics.snapshot", "create", "analytics"),
    ("analytics.snapshot:submit", "analytics.snapshot", "submit", "analytics"),
    ("analytics.refresh:read", "analytics.refresh", "read", "analytics"),
    ("analytics.refresh:create", "analytics.refresh", "create", "analytics"),
    ("analytics.refresh:submit", "analytics.refresh", "submit", "analytics"),
    ("analytics.alert:read", "analytics.alert", "read", "analytics"),
    ("analytics.alert:create", "analytics.alert", "create", "analytics"),
    ("analytics.alert:update", "analytics.alert", "update", "analytics"),
    ("analytics.alert:submit", "analytics.alert", "submit", "analytics"),
    ("analytics.alert:approve", "analytics.alert", "approve", "analytics"),
    ("analytics.notification:read", "analytics.notification", "read", "analytics"),
    ("analytics.notification:acknowledge", "analytics.notification", "acknowledge", "analytics"),
    ("analytics.subscription:read", "analytics.subscription", "read", "analytics"),
    ("analytics.subscription:create", "analytics.subscription", "create", "analytics"),
    ("analytics.subscription:update", "analytics.subscription", "update", "analytics"),
    ("analytics.subscription:cancel", "analytics.subscription", "cancel", "analytics"),
    ("analytics.export:read", "analytics.export", "read", "analytics"),
    ("analytics.export:create", "analytics.export", "create", "analytics"),
    ("analytics.export:run", "analytics.export", "run", "analytics"),
    ("analytics.import:read", "analytics.import", "read", "analytics"),
    ("analytics.import:create", "analytics.import", "create", "analytics"),
    ("analytics.import:run", "analytics.import", "run", "analytics"),
    ("analytics.query_history:read", "analytics.query_history", "read", "analytics"),
    ("analytics.usage_audit:read", "analytics.usage_audit", "read", "analytics"),
]

_ALL = [p[0] for p in ANALYTICS_PERMISSIONS]

BI_ANALYST_PERMISSIONS = [
    p for p in _ALL
    if any(
        x in p
        for x in (
            "analytics.dashboard",
            "analytics.widget",
            "analytics.report",
            "analytics.schedule",
            "analytics.execution",
            "analytics.metric:read",
            "analytics.kpi:read",
            "analytics.dataset:read",
            "analytics.query_history:read",
            "analytics.subscription",
            "analytics.export",
        )
    )
    and ":approve" not in p
]
BI_MANAGER_PERMISSIONS = list(_ALL)
DATA_STEWARD_PERMISSIONS = [
    p for p in _ALL
    if any(
        x in p
        for x in (
            "analytics.dataset",
            "analytics.source",
            "analytics.metric",
            "analytics.dimension",
            "analytics.fact",
            "analytics.snapshot",
            "analytics.refresh",
            "analytics.kpi",
            "analytics.import",
            "analytics.query_history:read",
        )
    )
]
BI_ADMIN_PERMISSIONS = list(_ALL)
''',
    )
def gen_api() -> None:
    w(
        ANALYTICS / "dependencies.py",
        '''"""Analytics module dependencies."""

from dataclasses import dataclass
from typing import Annotated

from fastapi import Query

from database.session import get_db
from modules.foundation.dependencies import get_tenant_context, require_permission
from modules.foundation.domain.value_objects import TenantContext

__all__ = [
    "PaginationParams",
    "get_pagination",
    "get_tenant_context",
    "require_permission",
    "TenantContext",
    "get_db",
    "paginate",
    "extract_update_fields",
]


@dataclass(frozen=True)
class PaginationParams:
    page: int
    page_size: int

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


def get_pagination(
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=200)] = 25,
) -> PaginationParams:
    return PaginationParams(page=page, page_size=page_size)


def paginate(items: list, pagination: PaginationParams) -> list:
    return items[pagination.offset : pagination.offset + pagination.page_size]


def extract_update_fields(body) -> dict:
    fields = body.model_dump(exclude_unset=True)
    fields.pop("version", None)
    return fields
''',
    )

    schema_lines = [
        '"""Analytics Pydantic schemas."""',
        "",
        "from uuid import UUID",
        "",
        "from pydantic import BaseModel, ConfigDict",
        "",
        "",
        "class OrmModel(BaseModel):",
        "    model_config = ConfigDict(from_attributes=True)",
        "",
    ]
    for _, name, _, _, _ in ROUTE_SPECS:
        schema_lines += [
            "",
            f"class {name}Create(BaseModel):",
            "    company_id: UUID | None = None",
            "    status: str | None = None",
            "",
            f"class {name}Update(BaseModel):",
            "    status: str | None = None",
            "    version: int | None = None",
            "",
            f"class {name}Response(OrmModel):",
            "    id: UUID",
            "    company_id: UUID",
            "    status: str",
            "    version: int",
        ]
    w(ANALYTICS / "schemas.py", "\n".join(schema_lines) + "\n")

    router_parts: list[str] = [
        '"""Analytics API route handlers."""',
        "",
        "from typing import Annotated",
        "from uuid import UUID",
        "",
        "from fastapi import APIRouter, Depends",
        "from sqlalchemy.orm import Session",
        "",
        "from modules.analytics.dependencies import (",
        "    PaginationParams,",
        "    extract_update_fields,",
        "    get_db,",
        "    get_pagination,",
        "    paginate,",
        "    require_permission,",
        ")",
        "from modules.analytics.schemas import (",
    ]
    for _, name, _, _, _ in ROUTE_SPECS:
        router_parts.append(f"    {name}Create,")
        router_parts.append(f"    {name}Response,")
        router_parts.append(f"    {name}Update,")
    router_parts += [
        ")",
        "from modules.analytics.service import (",
    ]
    seen_svc: set[str] = set()
    for _, _, svc, _, _ in ROUTE_SPECS:
        if svc not in seen_svc:
            router_parts.append(f"    {svc},")
            seen_svc.add(svc)
    router_parts.append(")")
    router_parts.append("from modules.foundation.domain.value_objects import TenantContext")
    router_parts.append("from shared.schemas import APIResponse")
    router_parts.append("")

    exports: list[str] = []
    route_actions: dict[str, list[tuple[str, str]]] = {
        "dashboards": [
            ("submit", "analytics.dashboard:submit"),
            ("approve", "analytics.dashboard:approve"),
            ("publish", "analytics.dashboard:publish"),
        ],
        "reports": [
            ("submit", "analytics.report:submit"),
            ("approve", "analytics.report:approve"),
            ("publish", "analytics.report:publish"),
            ("run", "analytics.report:run"),
        ],
        "datasets": [
            ("submit", "analytics.dataset:submit"),
            ("approve", "analytics.dataset:approve"),
            ("refresh", "analytics.dataset:refresh"),
        ],
        "kpis": [
            ("submit", "analytics.kpi:submit"),
            ("approve", "analytics.kpi:approve"),
        ],
        "data-refreshes": [
            ("submit", "analytics.refresh:submit"),
        ],
        "alert-rules": [
            ("submit", "analytics.alert:submit"),
            ("approve", "analytics.alert:approve"),
        ],
        "alert-notifications": [
            ("acknowledge", "analytics.notification:acknowledge"),
        ],
        "data-exports": [
            ("run", "analytics.export:run"),
        ],
        "data-imports": [
            ("run", "analytics.import:run"),
        ],
    }

    for prefix, name, svc, perm, _branch in ROUTE_SPECS:
        rname = f"{prefix.replace('-', '_')}_router"
        exports.append(rname)
        router_parts.append(f'{rname} = APIRouter(prefix="/{prefix}", tags=["Analytics — {name}"])')
        router_parts.append("")
        create_call = f"{svc}(db).create(ctx, **body.model_dump(exclude_none=True))"
        update_perm = f"{perm}:update"
        create_perm = f"{perm}:create"
        if perm in {"analytics.query_history", "analytics.usage_audit"}:
            update_perm = f"{perm}:read"
            create_perm = f"{perm}:read"
        elif perm == "analytics.notification":
            create_perm = "analytics.notification:read"
            update_perm = "analytics.notification:read"
        elif perm == "analytics.snapshot":
            update_perm = "analytics.snapshot:create"
        elif perm == "analytics.refresh":
            update_perm = "analytics.refresh:create"

        fn = prefix.replace("-", "_")
        router_parts += [
            f'@{rname}.get("", response_model=APIResponse[list[{name}Response]])',
            f"def list_{fn}(",
            f'    ctx: Annotated[TenantContext, Depends(require_permission("{perm}:read"))],',
            "    db: Annotated[Session, Depends(get_db)],",
            "    pagination: Annotated[PaginationParams, Depends(get_pagination)],",
            "    company_id: UUID | None = None,",
            "):",
            f"    items = {svc}(db).list(ctx, company_id=company_id)",
            '    return APIResponse(message="OK", data=paginate(items, pagination))',
            "",
            f'@{rname}.get("/{{row_id}}", response_model=APIResponse[{name}Response])',
            f"def get_{fn}(",
            "    row_id: UUID,",
            f'    ctx: Annotated[TenantContext, Depends(require_permission("{perm}:read"))],',
            "    db: Annotated[Session, Depends(get_db)],",
            "):",
            f'    return APIResponse(message="OK", data={svc}(db).get(ctx, row_id))',
            "",
            f'@{rname}.post("", response_model=APIResponse[{name}Response])',
            f"def create_{fn}(",
            f"    body: {name}Create,",
            f'    ctx: Annotated[TenantContext, Depends(require_permission("{create_perm}"))],',
            "    db: Annotated[Session, Depends(get_db)],",
            "):",
            f'    return APIResponse(message="Created", data={create_call})',
            "",
            f'@{rname}.patch("/{{row_id}}", response_model=APIResponse[{name}Response])',
            f"def update_{fn}(",
            "    row_id: UUID,",
            f"    body: {name}Update,",
            f'    ctx: Annotated[TenantContext, Depends(require_permission("{update_perm}"))],',
            "    db: Annotated[Session, Depends(get_db)],",
            "):",
            (
                f'    return APIResponse(message="Updated", '
                f"data={svc}(db).update(ctx, row_id, **extract_update_fields(body)))"
            ),
            "",
        ]

        for act, pcode in route_actions.get(prefix, []):
            router_parts += [
                f'@{rname}.post("/{{row_id}}/{act}", response_model=APIResponse[{name}Response])',
                f"def {act}_{fn}(",
                "    row_id: UUID,",
                f'    ctx: Annotated[TenantContext, Depends(require_permission("{pcode}"))],',
                "    db: Annotated[Session, Depends(get_db)],",
                "):",
                f'    return APIResponse(message="{act}", data={svc}(db).{act}(ctx, row_id))',
                "",
            ]

    w(ANALYTICS / "routers" / "__init__.py", "\n".join(router_parts) + "\n")

    import_list = ",\n    ".join(exports)
    include_lines = "\n".join(f"analytics_router.include_router({e})" for e in exports)
    w(
        ANALYTICS / "router.py",
        f'''"""Analytics module router aggregation."""

from fastapi import APIRouter

from modules.analytics.routers import (
    {import_list},
)

analytics_router = APIRouter(prefix="/analytics")
{include_lines}
''',
    )


def gen_tasks_tests() -> None:
    w(
        ANALYTICS / "tasks.py",
        '''"""Analytics Celery task stubs per ERD_20 section 15."""

from workers.celery_app import celery_app


@celery_app.task(name="analytics.dataset_refresh_scheduler")
def dataset_refresh_scheduler() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.analytics.models import BiDataRefresh

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(BiDataRefresh).where(
                    BiDataRefresh.is_deleted.is_(False),
                    BiDataRefresh.status.in_(["submitted", "queued"]),
                )
            ).all()
        )
        return {"status": "ok", "refreshes_due": len(rows)}
    finally:
        db.close()


@celery_app.task(name="analytics.dashboard_cache_refresh")
def dashboard_cache_refresh() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.analytics.models import BiDashboard

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(BiDashboard).where(
                    BiDashboard.is_deleted.is_(False),
                    BiDashboard.status.in_(["published", "approved"]),
                )
            ).all()
        )
        return {"status": "ok", "dashboards": len(rows)}
    finally:
        db.close()


@celery_app.task(name="analytics.report_scheduler")
def report_scheduler() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.analytics.models import BiReportSchedule

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(BiReportSchedule).where(
                    BiReportSchedule.is_deleted.is_(False),
                    BiReportSchedule.is_enabled.is_(True),
                    BiReportSchedule.status == "active",
                )
            ).all()
        )
        return {"status": "ok", "schedules_due": len(rows)}
    finally:
        db.close()


@celery_app.task(name="analytics.alert_monitor")
def alert_monitor() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.analytics.models import BiAlertRule

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(BiAlertRule).where(
                    BiAlertRule.is_deleted.is_(False),
                    BiAlertRule.is_enabled.is_(True),
                    BiAlertRule.status == "active",
                )
            ).all()
        )
        return {"status": "ok", "alert_rules": len(rows)}
    finally:
        db.close()


@celery_app.task(name="analytics.usage_statistics_refresh")
def usage_statistics_refresh() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.analytics.models import BiUsageAudit

    db = SessionLocal()
    try:
        rows = list(
            db.scalars(
                select(BiUsageAudit).where(BiUsageAudit.is_deleted.is_(False))
            ).all()
        )
        return {"status": "ok", "usage_rows": len(rows)}
    finally:
        db.close()


@celery_app.task(name="analytics.retry_failed_refresh")
def retry_failed_refresh() -> dict:
    from sqlalchemy import select

    from database.session import SessionLocal
    from modules.analytics.models import BiDataRefresh, BiReportExecution

    db = SessionLocal()
    try:
        refreshes = list(
            db.scalars(
                select(BiDataRefresh).where(
                    BiDataRefresh.is_deleted.is_(False),
                    BiDataRefresh.status == "failed",
                )
            ).all()
        )
        executions = list(
            db.scalars(
                select(BiReportExecution).where(
                    BiReportExecution.is_deleted.is_(False),
                    BiReportExecution.status == "failed",
                )
            ).all()
        )
        return {
            "status": "ok",
            "failed_refreshes": len(refreshes),
            "failed_executions": len(executions),
        }
    finally:
        db.close()
''',
    )

    w(
        TESTS / "unit" / "analytics" / "test_analytics_engines.py",
        '''"""Unit tests for Analytics engines."""

from types import SimpleNamespace

from modules.analytics.service.engines import (
    AlertNotificationEngine,
    AlertRuleEngine,
    DashboardEngine,
    DataExportEngine,
    DatasetEngine,
    KpiEngine,
    ReportEngine,
)


def test_dashboard_lifecycle():
    engine = DashboardEngine()
    row = SimpleNamespace(status="draft")
    engine.submit(row)
    assert row.status == "submitted"
    engine.approve(row)
    assert row.status == "approved"
    engine.publish(row)
    assert row.status == "published"


def test_report_lifecycle_and_run():
    engine = ReportEngine()
    row = SimpleNamespace(status="draft")
    engine.submit(row)
    engine.approve(row)
    engine.publish(row)
    engine.run(row)
    assert row.status == "published"


def test_dataset_refresh():
    engine = DatasetEngine()
    row = SimpleNamespace(status="draft")
    engine.submit(row)
    engine.approve(row)
    engine.refresh(row)
    assert row.status == "refreshing"


def test_kpi_lifecycle():
    engine = KpiEngine()
    row = SimpleNamespace(status="draft")
    engine.submit(row)
    engine.approve(row)
    assert row.status == "approved"


def test_alert_rule_lifecycle():
    engine = AlertRuleEngine()
    row = SimpleNamespace(status="draft", is_enabled=False)
    engine.submit(row)
    engine.approve(row)
    engine.activate(row)
    assert row.status == "active"
    assert row.is_enabled is True


def test_alert_notification_acknowledge():
    engine = AlertNotificationEngine()
    row = SimpleNamespace(status="open", delivery_status="sent")
    engine.acknowledge(row)
    assert row.status == "acknowledged"


def test_data_export_run():
    engine = DataExportEngine()
    row = SimpleNamespace(status="queued")
    engine.run(row)
    assert row.status == "running"
''',
    )

    w(
        TESTS / "unit" / "analytics" / "test_analytics_tasks.py",
        '''"""Analytics Celery task name registration tests."""

from modules.analytics import tasks


def test_analytics_task_names_registered():
    assert tasks.dataset_refresh_scheduler.name == "analytics.dataset_refresh_scheduler"
    assert tasks.dashboard_cache_refresh.name == "analytics.dashboard_cache_refresh"
    assert tasks.report_scheduler.name == "analytics.report_scheduler"
    assert tasks.alert_monitor.name == "analytics.alert_monitor"
    assert tasks.usage_statistics_refresh.name == "analytics.usage_statistics_refresh"
    assert tasks.retry_failed_refresh.name == "analytics.retry_failed_refresh"
''',
    )

    w(
        TESTS / "security" / "analytics" / "test_analytics_permissions.py",
        '''"""Analytics RBAC permission tests."""

from modules.analytics.permissions import (
    ANALYTICS_PERMISSIONS,
    BI_ADMIN_PERMISSIONS,
    BI_ANALYST_PERMISSIONS,
    BI_MANAGER_PERMISSIONS,
    DATA_STEWARD_PERMISSIONS,
)


def test_analytics_permissions_defined():
    assert len(ANALYTICS_PERMISSIONS) >= 40
    codes = [p[0] for p in ANALYTICS_PERMISSIONS]
    assert "analytics.dashboard:approve" in codes
    assert "analytics.dashboard:publish" in codes
    assert "analytics.report:run" in codes
    assert "analytics.dataset:refresh" in codes


def test_analytics_roles():
    assert BI_ANALYST_PERMISSIONS
    assert BI_MANAGER_PERMISSIONS
    assert DATA_STEWARD_PERMISSIONS
    assert BI_ADMIN_PERMISSIONS
    assert "analytics.dashboard:create" in BI_ANALYST_PERMISSIONS
    assert "analytics.dashboard:approve" in BI_MANAGER_PERMISSIONS
    assert "analytics.dataset:approve" in DATA_STEWARD_PERMISSIONS
''',
    )

    w(
        TESTS / "integration" / "analytics" / "test_analytics_module_import.py",
        '''"""Integration smoke: Analytics module imports and router mount."""

from modules.analytics.models import BiDashboard, BiDataset, BiReport
from modules.analytics.router import analytics_router
from modules.analytics.service import (
    AnalyticsApplicationService,
    AnalyticsIntegrationService,
    DashboardService,
    DatasetService,
    ReportService,
)
from modules.analytics.service.engines import DashboardEngine, DatasetEngine, ReportEngine


def test_analytics_models_importable():
    assert BiDashboard.__tablename__ == "bi_dashboard"
    assert BiReport.__tablename__ == "bi_report"
    assert BiDataset.__tablename__ == "bi_dataset"


def test_analytics_router_mounted():
    assert analytics_router.prefix == "/analytics"
    paths = [getattr(r, "path", "") for r in analytics_router.routes]
    assert any("/{row_id}" in p for p in paths)
    assert any("dashboards" in p for p in paths)
    assert any("datasets" in p for p in paths)


def test_analytics_services_and_engines_importable():
    assert AnalyticsApplicationService is not None
    assert DashboardService is not None
    assert ReportService is not None
    assert DatasetService is not None
    assert AnalyticsIntegrationService is not None
    assert DashboardEngine is not None
    assert ReportEngine is not None
    assert DatasetEngine is not None
''',
    )


def gen_seeds() -> None:
    w(
        ALEMBIC / "0375_seed_analytics_permissions.py",
        '''"""Seed Analytics permissions and roles."""

import sys
from collections.abc import Sequence
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.analytics.permissions import (
    ANALYTICS_PERMISSIONS,
    BI_ADMIN_PERMISSIONS,
    BI_ANALYST_PERMISSIONS,
    BI_MANAGER_PERMISSIONS,
    DATA_STEWARD_PERMISSIONS,
)

revision: str = "0375_seed_analytics_permissions"
down_revision: str | None = "0374_bi_usage_audit"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PERMISSION_TABLE = sa.table(
    "sec_permission",
    sa.column("id", sa.Uuid),
    sa.column("permission_code", sa.String),
    sa.column("resource", sa.String),
    sa.column("action", sa.String),
    sa.column("module", sa.String),
    sa.column("is_active", sa.Boolean),
    sa.column("created_at", sa.DateTime(timezone=True)),
    schema="foundation",
)

ROLE_SPECS: list[tuple[str, str, list[str]]] = [
    ("BI_ANALYST", "BI Analyst", BI_ANALYST_PERMISSIONS),
    ("BI_MANAGER", "BI Manager", BI_MANAGER_PERMISSIONS),
    ("DATA_STEWARD", "Data Steward", DATA_STEWARD_PERMISSIONS),
    ("BI_ADMIN", "BI Admin", BI_ADMIN_PERMISSIONS),
]


def _ensure_permission(conn, now, code, resource, action, module):
    exists = conn.execute(
        sa.text("SELECT id FROM foundation.sec_permission WHERE permission_code = :code"),
        {"code": code},
    ).first()
    if exists:
        return str(exists[0])
    perm_id = str(uuid4())
    conn.execute(
        sa.insert(PERMISSION_TABLE).values(
            id=perm_id,
            permission_code=code,
            resource=resource,
            action=action,
            module=module,
            is_active=True,
            created_at=now,
        )
    )
    return perm_id


def _ensure_role(conn, now, tenant_id, role_code, role_name):
    exists = conn.execute(
        sa.text(
            """
            SELECT id FROM foundation.sec_role
            WHERE tenant_id = :tid AND role_code = :code AND is_deleted = false
            """
        ),
        {"tid": tenant_id, "code": role_code},
    ).first()
    if exists:
        return str(exists[0])
    role_id = str(uuid4())
    conn.execute(
        sa.text(
            """
            INSERT INTO foundation.sec_role
            (id, tenant_id, role_code, role_name, is_system_role, status,
             created_at, updated_at, is_deleted, version)
            VALUES (:id, :tid, :code, :name, true, 'active', :now, :now, false, 1)
            """
        ),
        {"id": role_id, "tid": tenant_id, "code": role_code, "name": role_name, "now": now},
    )
    return role_id


def _grant(conn, now, tenant_id, role_id, perm_id):
    exists = conn.execute(
        sa.text(
            """
            SELECT 1 FROM foundation.sec_role_permission
            WHERE role_id = :rid AND permission_id = :pid
            """
        ),
        {"rid": role_id, "pid": perm_id},
    ).first()
    if exists:
        return
    conn.execute(
        sa.text(
            """
            INSERT INTO foundation.sec_role_permission
            (id, tenant_id, role_id, permission_id, granted_at)
            VALUES (:id, :tid, :rid, :pid, :now)
            """
        ),
        {"id": str(uuid4()), "tid": tenant_id, "rid": role_id, "pid": perm_id, "now": now},
    )


def upgrade() -> None:
    conn = op.get_bind()
    now = datetime.now(timezone.utc)
    perm_ids: dict[str, str] = {}
    for code, resource, action, module in ANALYTICS_PERMISSIONS:
        perm_ids[code] = _ensure_permission(conn, now, code, resource, action, module)
    tenants = conn.execute(
        sa.text("SELECT id FROM foundation.sec_tenant WHERE is_deleted = false")
    ).fetchall()
    for (tenant_id,) in tenants:
        tid = str(tenant_id)
        for role_code, role_name, perms in ROLE_SPECS:
            role_id = _ensure_role(conn, now, tid, role_code, role_name)
            for perm_code in perms:
                _grant(conn, now, tid, role_id, perm_ids[perm_code])


def downgrade() -> None:
    conn = op.get_bind()
    for role_code, _, _ in reversed(ROLE_SPECS):
        conn.execute(
            sa.text(
                "DELETE FROM foundation.sec_role WHERE role_code = :code AND is_system_role = true"
            ),
            {"code": role_code},
        )
    for code, _, _, _ in ANALYTICS_PERMISSIONS:
        conn.execute(
            sa.text("DELETE FROM foundation.sec_permission WHERE permission_code = :code"),
            {"code": code},
        )
''',
    )

    w(
        ALEMBIC / "0376_seed_analytics_workflows.py",
        '''"""Seed Analytics workflow definitions per ERD_20."""

from collections.abc import Sequence
from datetime import datetime, timezone
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "0376_seed_analytics_workflows"
down_revision: str | None = "0375_seed_analytics_permissions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

WORKFLOWS: list[tuple[str, str, str, list[tuple[int, str, str, str]]]] = [
    (
        "BI_DASHBOARD_APPROVAL",
        "BI Dashboard Approval",
        "bi_dashboard",
        [
            (1, "BI_ANALYST", "Analyst Submit", "role"),
            (2, "BI_MANAGER", "BI Manager Approval", "role"),
            (3, "BI_ADMIN", "BI Admin Approval", "role"),
        ],
    ),
    (
        "BI_REPORT_APPROVAL",
        "BI Report Approval",
        "bi_report",
        [
            (1, "BI_ANALYST", "Analyst Submit", "role"),
            (2, "DATA_STEWARD", "Data Steward Approval", "role"),
            (3, "BI_MANAGER", "BI Manager Approval", "role"),
        ],
    ),
    (
        "BI_KPI_APPROVAL",
        "BI KPI Approval",
        "bi_kpi",
        [
            (1, "BI_ANALYST", "Owner Submit", "role"),
            (2, "DATA_STEWARD", "Data Steward Approval", "role"),
            (3, "BI_MANAGER", "BI Manager Approval", "role"),
        ],
    ),
    (
        "BI_DATASET_REFRESH",
        "BI Dataset Refresh",
        "bi_data_refresh",
        [
            (1, "DATA_STEWARD", "Steward Submit", "role"),
            (2, "BI_MANAGER", "BI Manager Approval", "role"),
        ],
    ),
    (
        "BI_ALERT_REVIEW",
        "BI Alert Review",
        "bi_alert_rule",
        [
            (1, "BI_ANALYST", "Owner Submit", "role"),
            (2, "BI_MANAGER", "BI Manager Approval", "role"),
            (3, "BI_ADMIN", "BI Admin Approval", "role"),
        ],
    ),
]


def upgrade() -> None:
    conn = op.get_bind()
    now = datetime.now(timezone.utc)
    tenants = conn.execute(
        sa.text("SELECT id FROM foundation.sec_tenant WHERE is_deleted = false")
    ).fetchall()
    for (tenant_id,) in tenants:
        tid = str(tenant_id)
        for workflow_code, workflow_name, document_type, steps in WORKFLOWS:
            exists = conn.execute(
                sa.text(
                    """
                    SELECT id FROM foundation.wf_definition
                    WHERE tenant_id = :tid AND workflow_code = :code AND version_no = 1
                    """
                ),
                {"tid": tid, "code": workflow_code},
            ).first()
            if exists:
                wf_id = str(exists[0])
            else:
                wf_id = str(uuid4())
                conn.execute(
                    sa.text(
                        """
                        INSERT INTO foundation.wf_definition
                        (id, tenant_id, workflow_code, workflow_name, module,
                         document_type, version_no, is_active, created_at, updated_at)
                        VALUES (:id, :tid, :code, :name, 'analytics', :doc, 1, true, :now, :now)
                        """
                    ),
                    {
                        "id": wf_id,
                        "tid": tid,
                        "code": workflow_code,
                        "name": workflow_name,
                        "doc": document_type,
                        "now": now,
                    },
                )
            for step_order, step_code, step_name, approver_type in steps:
                step_exists = conn.execute(
                    sa.text(
                        """
                        SELECT 1 FROM foundation.wf_step
                        WHERE workflow_id = :wid AND step_order = :ord
                        """
                    ),
                    {"wid": wf_id, "ord": step_order},
                ).first()
                if step_exists:
                    continue
                conn.execute(
                    sa.text(
                        """
                        INSERT INTO foundation.wf_step
                        (id, tenant_id, workflow_id, step_order, step_code, step_name,
                         approver_type, is_parallel, created_at, updated_at)
                        VALUES (:id, :tid, :wid, :ord, :code, :name, :atype, false, :now, :now)
                        """
                    ),
                    {
                        "id": str(uuid4()),
                        "tid": tid,
                        "wid": wf_id,
                        "ord": step_order,
                        "code": step_code,
                        "name": step_name,
                        "atype": approver_type,
                        "now": now,
                    },
                )


def downgrade() -> None:
    conn = op.get_bind()
    for workflow_code, _, _, _ in WORKFLOWS:
        conn.execute(
            sa.text(
                """
                DELETE FROM foundation.wf_step
                WHERE workflow_id IN (
                    SELECT id FROM foundation.wf_definition WHERE workflow_code = :code
                )
                """
            ),
            {"code": workflow_code},
        )
        conn.execute(
            sa.text("DELETE FROM foundation.wf_definition WHERE workflow_code = :code"),
            {"code": workflow_code},
        )
''',
    )


def gen_wiring() -> None:
    patch_file(
        SHARED / "router.py",
        "from modules.grc.router import grc_router\n",
        "from modules.grc.router import grc_router\n"
        "from modules.analytics.router import analytics_router\n",
    )
    patch_file(
        SHARED / "router.py",
        "api_v1_router.include_router(grc_router)\n",
        "api_v1_router.include_router(grc_router)\n"
        "api_v1_router.include_router(analytics_router)\n",
    )
    patch_file(
        ROOT / "alembic" / "env.py",
        "import modules.grc.models  # noqa: F401 — register ORM metadata\n",
        "import modules.grc.models  # noqa: F401 — register ORM metadata\n"
        "import modules.analytics.models  # noqa: F401 — register ORM metadata\n",
    )
    patch_file(
        ROOT / "src" / "workers" / "celery_app.py",
        '        "modules.grc",\n',
        '        "modules.grc",\n        "modules.analytics",\n',
    )
    patch_file(
        ROOT / "pyproject.toml",
        '    "modules.grc.*",\n',
        '    "modules.grc.*",\n    "modules.analytics.*",\n',
    )
    pyproject = (ROOT / "pyproject.toml").read_text(encoding="utf-8")
    ruff_marker = (
        '"src/modules/grc/**" = ["E501", "SIM102"]\n'
        '"src/modules/grc/domain/enums.py" = ["UP042"]\n'
    )
    ruff_new = (
        ruff_marker
        + '"src/modules/analytics/**" = ["E501", "SIM102"]\n'
        + '"src/modules/analytics/domain/enums.py" = ["UP042"]\n'
    )
    if ruff_marker in pyproject and '"src/modules/analytics/**"' not in pyproject:
        patch_file(ROOT / "pyproject.toml", ruff_marker, ruff_new)
    elif '"src/modules/analytics/**"' not in pyproject:
        alt = '"src/modules/grc/domain/enums.py" = ["UP042"]\n'
        if alt in pyproject:
            patch_file(
                ROOT / "pyproject.toml",
                alt,
                alt
                + '"src/modules/analytics/**" = ["E501", "SIM102"]\n'
                + '"src/modules/analytics/domain/enums.py" = ["UP042"]\n',
            )


def main() -> None:
    gen_scaffold()
    gen_domain()
    gen_models()
    gen_migrations()
    gen_repos()
    gen_engines()
    gen_services()
    gen_adapters()
    gen_permissions()
    gen_api()
    gen_tasks_tests()
    gen_seeds()
    gen_wiring()
    print(f"OK analytics module generated — {len(FILES_WRITTEN)} files")
    print("Alembic head revision: 0376_seed_analytics_workflows")


if __name__ == "__main__":
    main()
