"""Analytics Pydantic schemas."""

from decimal import Decimal
from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class DashboardCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DashboardUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DashboardResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    dashboard_number: str
    dashboard_code: str
    dashboard_name: str
    dashboard_type: str
    audience_role: str | None
    owner_employee_id: UUID
    department_id: UUID | None
    layout_json: dict | None
    is_default: bool
    published_at: datetime | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    version: int

class DashboardWidgetCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DashboardWidgetUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DashboardWidgetResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    dashboard_id: UUID
    widget_code: str
    widget_title: str
    widget_type: str
    metric_id: UUID | None
    kpi_id: UUID | None
    report_id: UUID | None
    dataset_id: UUID | None
    config_json: dict | None
    sequence_no: int
    status: str
    company_id: UUID
    version: int

class ReportCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ReportUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ReportResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    report_number: str
    report_code: str
    report_name: str
    report_type: str
    owner_employee_id: UUID
    department_id: UUID | None
    dataset_id: UUID | None
    definition_json: dict | list | None
    output_format: str | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    version: int

class ReportScheduleCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ReportScheduleUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ReportScheduleResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    report_id: UUID
    schedule_code: str
    cron_expression: str | None
    timezone: str | None
    next_run_at: datetime | None
    last_run_at: datetime | None
    recipients_json: dict | None
    is_enabled: bool
    status: str
    company_id: UUID
    version: int

class ReportExecutionCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ReportExecutionUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ReportExecutionResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    report_id: UUID
    schedule_id: UUID | None
    execution_number: str
    triggered_by_employee_id: UUID | None
    started_at: datetime | None
    completed_at: datetime | None
    row_count: int | None
    output_uri: str | None
    content_hash: str | None
    error_message: str | None
    status: str
    company_id: UUID
    version: int

class DatasetCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DatasetUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DatasetResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    dataset_number: str
    dataset_code: str
    dataset_name: str
    dataset_type: str
    description: str | None
    owner_employee_id: UUID
    steward_employee_id: UUID | None
    grain_description: str | None
    cache_ttl_seconds: int | None
    last_refreshed_at: datetime | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    version: int

class DatasetSourceCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DatasetSourceUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DatasetSourceResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    dataset_id: UUID
    source_code: str
    source_module: str
    source_entity: str | None
    source_ref_id: UUID | None
    connection_key: str | None
    extract_query_key: str | None
    filter_json: dict | None
    status: str
    company_id: UUID
    version: int

class MetricCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class MetricUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class MetricResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    metric_code: str
    metric_name: str
    dataset_id: UUID | None
    metric_category: str
    aggregation: str
    expression_json: dict | None
    unit: str | None
    owner_employee_id: UUID | None
    status: str
    company_id: UUID
    version: int

class KpiCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class KpiUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class KpiResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    kpi_number: str
    kpi_code: str
    kpi_name: str
    metric_id: UUID | None
    owner_employee_id: UUID
    department_id: UUID | None
    target_value: Decimal | None
    warning_threshold: Decimal | None
    critical_threshold: Decimal | None
    direction: str | None
    period_grain: str | None
    current_value: Decimal | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    version: int

class DimensionCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DimensionUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DimensionResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    dimension_code: str
    dimension_name: str
    dataset_id: UUID | None
    dimension_type: str
    source_module: str | None
    hierarchy_json: dict | None
    master_product_id: UUID | None
    master_customer_id: UUID | None
    master_vendor_id: UUID | None
    status: str
    company_id: UUID
    version: int

class FactTableCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class FactTableUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class FactTableResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    fact_code: str
    fact_name: str
    dataset_id: UUID
    grain_description: str | None
    measure_codes_json: dict | None
    dimension_codes_json: dict | None
    storage_uri: str | None
    physical_table_name: str | None
    status: str
    company_id: UUID
    version: int

class DataSnapshotCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DataSnapshotUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DataSnapshotResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    dataset_id: UUID
    snapshot_number: str
    snapshot_at: datetime | None
    period_start: date | None
    period_end: date | None
    row_count: int | None
    payload_json: dict | None
    storage_uri: str | None
    refresh_id: UUID | None
    status: str
    company_id: UUID
    version: int

class DataRefreshCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DataRefreshUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DataRefreshResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    refresh_number: str
    dataset_id: UUID
    refresh_type: str
    requested_by_employee_id: UUID
    started_at: datetime | None
    completed_at: datetime | None
    rows_processed: int | None
    error_message: str | None
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    version: int

class AlertRuleCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class AlertRuleUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class AlertRuleResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    alert_number: str
    alert_code: str
    alert_name: str
    kpi_id: UUID | None
    metric_id: UUID | None
    condition_operator: str
    threshold_value: Decimal | None
    threshold_upper: Decimal | None
    severity: str
    owner_employee_id: UUID
    is_enabled: bool
    status: str
    workflow_status: str | None
    workflow_instance_id: UUID | None
    company_id: UUID
    version: int

class AlertNotificationCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class AlertNotificationUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class AlertNotificationResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    alert_rule_id: UUID
    triggered_at: datetime | None
    observed_value: Decimal | None
    message: str | None
    recipient_user_id: UUID | None
    recipient_employee_id: UUID | None
    delivery_status: str
    acknowledged_at: datetime | None
    status: str
    company_id: UUID
    version: int

class SubscriptionCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class SubscriptionUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class SubscriptionResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    subscription_number: str
    subscriber_employee_id: UUID
    target_type: str
    dashboard_id: UUID | None
    report_id: UUID | None
    kpi_id: UUID | None
    alert_rule_id: UUID | None
    channel: str
    frequency: str
    status: str
    company_id: UUID
    version: int

class DataExportCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DataExportUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DataExportResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    export_number: str
    report_id: UUID | None
    dataset_id: UUID | None
    requested_by_employee_id: UUID
    format: str
    storage_uri: str | None
    content_hash: str | None
    file_size_bytes: int | None
    started_at: datetime | None
    completed_at: datetime | None
    status: str
    company_id: UUID
    version: int

class DataImportCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DataImportUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DataImportResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    import_number: str
    dataset_id: UUID
    requested_by_employee_id: UUID
    source_uri: str | None
    content_hash: str | None
    format: str
    rows_loaded: int | None
    error_message: str | None
    status: str
    company_id: UUID
    version: int

class QueryHistoryCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class QueryHistoryUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class QueryHistoryResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    dataset_id: UUID | None
    report_id: UUID | None
    executed_by_employee_id: UUID | None
    executed_by_user_id: UUID | None
    query_text: str | None
    query_hash: str | None
    duration_ms: int | None
    row_count: int | None
    executed_at: datetime | None
    status: str
    company_id: UUID
    version: int

class UsageAuditCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class UsageAuditUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class UsageAuditResponse(OrmModel):
    id: UUID
    branch_id: UUID | None
    actor_employee_id: UUID | None
    actor_user_id: UUID | None
    resource_type: str
    resource_id: UUID | None
    action: str
    payload_json: dict | None
    occurred_at: datetime | None
    status: str
    company_id: UUID
    version: int
