"""Analytics API route handlers."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from modules.analytics.dependencies import (
    PaginationParams,
    extract_update_fields,
    get_db,
    get_pagination,
    paginate,
    require_permission,
)
from modules.analytics.schemas import (
    AlertNotificationCreate,
    AlertNotificationResponse,
    AlertNotificationUpdate,
    AlertRuleCreate,
    AlertRuleResponse,
    AlertRuleUpdate,
    DashboardCreate,
    DashboardResponse,
    DashboardUpdate,
    DashboardWidgetCreate,
    DashboardWidgetResponse,
    DashboardWidgetUpdate,
    DataExportCreate,
    DataExportResponse,
    DataExportUpdate,
    DataImportCreate,
    DataImportResponse,
    DataImportUpdate,
    DataRefreshCreate,
    DataRefreshResponse,
    DataRefreshUpdate,
    DatasetCreate,
    DatasetResponse,
    DatasetSourceCreate,
    DatasetSourceResponse,
    DatasetSourceUpdate,
    DatasetUpdate,
    DataSnapshotCreate,
    DataSnapshotResponse,
    DataSnapshotUpdate,
    DimensionCreate,
    DimensionResponse,
    DimensionUpdate,
    FactTableCreate,
    FactTableResponse,
    FactTableUpdate,
    KpiCreate,
    KpiResponse,
    KpiUpdate,
    MetricCreate,
    MetricResponse,
    MetricUpdate,
    QueryHistoryCreate,
    QueryHistoryResponse,
    QueryHistoryUpdate,
    ReportCreate,
    ReportExecutionCreate,
    ReportExecutionResponse,
    ReportExecutionUpdate,
    ReportResponse,
    ReportScheduleCreate,
    ReportScheduleResponse,
    ReportScheduleUpdate,
    ReportUpdate,
    SubscriptionCreate,
    SubscriptionResponse,
    SubscriptionUpdate,
    UsageAuditCreate,
    UsageAuditResponse,
    UsageAuditUpdate,
)
from modules.analytics.service import (
    AlertNotificationService,
    AlertRuleService,
    DashboardService,
    DashboardWidgetService,
    DataExportService,
    DataImportService,
    DataRefreshService,
    DatasetService,
    DatasetSourceService,
    DataSnapshotService,
    DimensionService,
    FactTableService,
    KpiService,
    MetricService,
    QueryHistoryService,
    ReportExecutionService,
    ReportScheduleService,
    ReportService,
    SubscriptionService,
    UsageAuditService,
)
from modules.foundation.domain.value_objects import TenantContext
from shared.schemas import APIResponse

dashboards_router = APIRouter(prefix="/dashboards", tags=["Analytics — Dashboard"])

@dashboards_router.get("", response_model=APIResponse[list[DashboardResponse]])
def list_dashboards(
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.dashboard:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = DashboardService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@dashboards_router.get("/{row_id}", response_model=APIResponse[DashboardResponse])
def get_dashboards(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.dashboard:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=DashboardService(db).get(ctx, row_id))

@dashboards_router.post("", response_model=APIResponse[DashboardResponse])
def create_dashboards(
    body: DashboardCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.dashboard:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=DashboardService(db).create(ctx, **body.model_dump(exclude_none=True)))

@dashboards_router.patch("/{row_id}", response_model=APIResponse[DashboardResponse])
def update_dashboards(
    row_id: UUID,
    body: DashboardUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.dashboard:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=DashboardService(db).update(ctx, row_id, **extract_update_fields(body)))

@dashboards_router.post("/{row_id}/submit", response_model=APIResponse[DashboardResponse])
def submit_dashboards(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.dashboard:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="submit", data=DashboardService(db).submit(ctx, row_id))

@dashboards_router.post("/{row_id}/approve", response_model=APIResponse[DashboardResponse])
def approve_dashboards(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.dashboard:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="approve", data=DashboardService(db).approve(ctx, row_id))

@dashboards_router.post("/{row_id}/publish", response_model=APIResponse[DashboardResponse])
def publish_dashboards(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.dashboard:publish"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="publish", data=DashboardService(db).publish(ctx, row_id))

dashboard_widgets_router = APIRouter(prefix="/dashboard-widgets", tags=["Analytics — DashboardWidget"])

@dashboard_widgets_router.get("", response_model=APIResponse[list[DashboardWidgetResponse]])
def list_dashboard_widgets(
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.widget:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = DashboardWidgetService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@dashboard_widgets_router.get("/{row_id}", response_model=APIResponse[DashboardWidgetResponse])
def get_dashboard_widgets(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.widget:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=DashboardWidgetService(db).get(ctx, row_id))

@dashboard_widgets_router.post("", response_model=APIResponse[DashboardWidgetResponse])
def create_dashboard_widgets(
    body: DashboardWidgetCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.widget:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=DashboardWidgetService(db).create(ctx, **body.model_dump(exclude_none=True)))

@dashboard_widgets_router.patch("/{row_id}", response_model=APIResponse[DashboardWidgetResponse])
def update_dashboard_widgets(
    row_id: UUID,
    body: DashboardWidgetUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.widget:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=DashboardWidgetService(db).update(ctx, row_id, **extract_update_fields(body)))

reports_router = APIRouter(prefix="/reports", tags=["Analytics — Report"])

@reports_router.get("", response_model=APIResponse[list[ReportResponse]])
def list_reports(
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.report:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ReportService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@reports_router.get("/{row_id}", response_model=APIResponse[ReportResponse])
def get_reports(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.report:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ReportService(db).get(ctx, row_id))

@reports_router.post("", response_model=APIResponse[ReportResponse])
def create_reports(
    body: ReportCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.report:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ReportService(db).create(ctx, **body.model_dump(exclude_none=True)))

@reports_router.patch("/{row_id}", response_model=APIResponse[ReportResponse])
def update_reports(
    row_id: UUID,
    body: ReportUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.report:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ReportService(db).update(ctx, row_id, **extract_update_fields(body)))

@reports_router.post("/{row_id}/submit", response_model=APIResponse[ReportResponse])
def submit_reports(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.report:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="submit", data=ReportService(db).submit(ctx, row_id))

@reports_router.post("/{row_id}/approve", response_model=APIResponse[ReportResponse])
def approve_reports(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.report:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="approve", data=ReportService(db).approve(ctx, row_id))

@reports_router.post("/{row_id}/publish", response_model=APIResponse[ReportResponse])
def publish_reports(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.report:publish"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="publish", data=ReportService(db).publish(ctx, row_id))

@reports_router.post("/{row_id}/run", response_model=APIResponse[ReportResponse])
def run_reports(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.report:run"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="run", data=ReportService(db).run(ctx, row_id))

report_schedules_router = APIRouter(prefix="/report-schedules", tags=["Analytics — ReportSchedule"])

@report_schedules_router.get("", response_model=APIResponse[list[ReportScheduleResponse]])
def list_report_schedules(
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.schedule:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ReportScheduleService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@report_schedules_router.get("/{row_id}", response_model=APIResponse[ReportScheduleResponse])
def get_report_schedules(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.schedule:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ReportScheduleService(db).get(ctx, row_id))

@report_schedules_router.post("", response_model=APIResponse[ReportScheduleResponse])
def create_report_schedules(
    body: ReportScheduleCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.schedule:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ReportScheduleService(db).create(ctx, **body.model_dump(exclude_none=True)))

@report_schedules_router.patch("/{row_id}", response_model=APIResponse[ReportScheduleResponse])
def update_report_schedules(
    row_id: UUID,
    body: ReportScheduleUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.schedule:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ReportScheduleService(db).update(ctx, row_id, **extract_update_fields(body)))

report_executions_router = APIRouter(prefix="/report-executions", tags=["Analytics — ReportExecution"])

@report_executions_router.get("", response_model=APIResponse[list[ReportExecutionResponse]])
def list_report_executions(
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.execution:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = ReportExecutionService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@report_executions_router.get("/{row_id}", response_model=APIResponse[ReportExecutionResponse])
def get_report_executions(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.execution:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ReportExecutionService(db).get(ctx, row_id))

@report_executions_router.post("", response_model=APIResponse[ReportExecutionResponse])
def create_report_executions(
    body: ReportExecutionCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.execution:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=ReportExecutionService(db).create(ctx, **body.model_dump(exclude_none=True)))

@report_executions_router.patch("/{row_id}", response_model=APIResponse[ReportExecutionResponse])
def update_report_executions(
    row_id: UUID,
    body: ReportExecutionUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.execution:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=ReportExecutionService(db).update(ctx, row_id, **extract_update_fields(body)))

datasets_router = APIRouter(prefix="/datasets", tags=["Analytics — Dataset"])

@datasets_router.get("", response_model=APIResponse[list[DatasetResponse]])
def list_datasets(
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.dataset:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = DatasetService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@datasets_router.get("/{row_id}", response_model=APIResponse[DatasetResponse])
def get_datasets(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.dataset:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=DatasetService(db).get(ctx, row_id))

@datasets_router.post("", response_model=APIResponse[DatasetResponse])
def create_datasets(
    body: DatasetCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.dataset:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=DatasetService(db).create(ctx, **body.model_dump(exclude_none=True)))

@datasets_router.patch("/{row_id}", response_model=APIResponse[DatasetResponse])
def update_datasets(
    row_id: UUID,
    body: DatasetUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.dataset:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=DatasetService(db).update(ctx, row_id, **extract_update_fields(body)))

@datasets_router.post("/{row_id}/submit", response_model=APIResponse[DatasetResponse])
def submit_datasets(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.dataset:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="submit", data=DatasetService(db).submit(ctx, row_id))

@datasets_router.post("/{row_id}/approve", response_model=APIResponse[DatasetResponse])
def approve_datasets(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.dataset:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="approve", data=DatasetService(db).approve(ctx, row_id))

@datasets_router.post("/{row_id}/refresh", response_model=APIResponse[DatasetResponse])
def refresh_datasets(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.dataset:refresh"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="refresh", data=DatasetService(db).refresh(ctx, row_id))

dataset_sources_router = APIRouter(prefix="/dataset-sources", tags=["Analytics — DatasetSource"])

@dataset_sources_router.get("", response_model=APIResponse[list[DatasetSourceResponse]])
def list_dataset_sources(
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.source:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = DatasetSourceService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@dataset_sources_router.get("/{row_id}", response_model=APIResponse[DatasetSourceResponse])
def get_dataset_sources(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.source:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=DatasetSourceService(db).get(ctx, row_id))

@dataset_sources_router.post("", response_model=APIResponse[DatasetSourceResponse])
def create_dataset_sources(
    body: DatasetSourceCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.source:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=DatasetSourceService(db).create(ctx, **body.model_dump(exclude_none=True)))

@dataset_sources_router.patch("/{row_id}", response_model=APIResponse[DatasetSourceResponse])
def update_dataset_sources(
    row_id: UUID,
    body: DatasetSourceUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.source:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=DatasetSourceService(db).update(ctx, row_id, **extract_update_fields(body)))

metrics_router = APIRouter(prefix="/metrics", tags=["Analytics — Metric"])

@metrics_router.get("", response_model=APIResponse[list[MetricResponse]])
def list_metrics(
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.metric:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = MetricService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@metrics_router.get("/{row_id}", response_model=APIResponse[MetricResponse])
def get_metrics(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.metric:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=MetricService(db).get(ctx, row_id))

@metrics_router.post("", response_model=APIResponse[MetricResponse])
def create_metrics(
    body: MetricCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.metric:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=MetricService(db).create(ctx, **body.model_dump(exclude_none=True)))

@metrics_router.patch("/{row_id}", response_model=APIResponse[MetricResponse])
def update_metrics(
    row_id: UUID,
    body: MetricUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.metric:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=MetricService(db).update(ctx, row_id, **extract_update_fields(body)))

kpis_router = APIRouter(prefix="/kpis", tags=["Analytics — Kpi"])

@kpis_router.get("", response_model=APIResponse[list[KpiResponse]])
def list_kpis(
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.kpi:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = KpiService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@kpis_router.get("/{row_id}", response_model=APIResponse[KpiResponse])
def get_kpis(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.kpi:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=KpiService(db).get(ctx, row_id))

@kpis_router.post("", response_model=APIResponse[KpiResponse])
def create_kpis(
    body: KpiCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.kpi:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=KpiService(db).create(ctx, **body.model_dump(exclude_none=True)))

@kpis_router.patch("/{row_id}", response_model=APIResponse[KpiResponse])
def update_kpis(
    row_id: UUID,
    body: KpiUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.kpi:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=KpiService(db).update(ctx, row_id, **extract_update_fields(body)))

@kpis_router.post("/{row_id}/submit", response_model=APIResponse[KpiResponse])
def submit_kpis(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.kpi:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="submit", data=KpiService(db).submit(ctx, row_id))

@kpis_router.post("/{row_id}/approve", response_model=APIResponse[KpiResponse])
def approve_kpis(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.kpi:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="approve", data=KpiService(db).approve(ctx, row_id))

dimensions_router = APIRouter(prefix="/dimensions", tags=["Analytics — Dimension"])

@dimensions_router.get("", response_model=APIResponse[list[DimensionResponse]])
def list_dimensions(
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.dimension:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = DimensionService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@dimensions_router.get("/{row_id}", response_model=APIResponse[DimensionResponse])
def get_dimensions(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.dimension:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=DimensionService(db).get(ctx, row_id))

@dimensions_router.post("", response_model=APIResponse[DimensionResponse])
def create_dimensions(
    body: DimensionCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.dimension:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=DimensionService(db).create(ctx, **body.model_dump(exclude_none=True)))

@dimensions_router.patch("/{row_id}", response_model=APIResponse[DimensionResponse])
def update_dimensions(
    row_id: UUID,
    body: DimensionUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.dimension:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=DimensionService(db).update(ctx, row_id, **extract_update_fields(body)))

fact_tables_router = APIRouter(prefix="/fact-tables", tags=["Analytics — FactTable"])

@fact_tables_router.get("", response_model=APIResponse[list[FactTableResponse]])
def list_fact_tables(
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.fact:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = FactTableService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@fact_tables_router.get("/{row_id}", response_model=APIResponse[FactTableResponse])
def get_fact_tables(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.fact:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=FactTableService(db).get(ctx, row_id))

@fact_tables_router.post("", response_model=APIResponse[FactTableResponse])
def create_fact_tables(
    body: FactTableCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.fact:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=FactTableService(db).create(ctx, **body.model_dump(exclude_none=True)))

@fact_tables_router.patch("/{row_id}", response_model=APIResponse[FactTableResponse])
def update_fact_tables(
    row_id: UUID,
    body: FactTableUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.fact:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=FactTableService(db).update(ctx, row_id, **extract_update_fields(body)))

data_snapshots_router = APIRouter(prefix="/data-snapshots", tags=["Analytics — DataSnapshot"])

@data_snapshots_router.get("", response_model=APIResponse[list[DataSnapshotResponse]])
def list_data_snapshots(
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.snapshot:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = DataSnapshotService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@data_snapshots_router.get("/{row_id}", response_model=APIResponse[DataSnapshotResponse])
def get_data_snapshots(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.snapshot:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=DataSnapshotService(db).get(ctx, row_id))

@data_snapshots_router.post("", response_model=APIResponse[DataSnapshotResponse])
def create_data_snapshots(
    body: DataSnapshotCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.snapshot:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=DataSnapshotService(db).create(ctx, **body.model_dump(exclude_none=True)))

@data_snapshots_router.patch("/{row_id}", response_model=APIResponse[DataSnapshotResponse])
def update_data_snapshots(
    row_id: UUID,
    body: DataSnapshotUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.snapshot:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=DataSnapshotService(db).update(ctx, row_id, **extract_update_fields(body)))

data_refreshes_router = APIRouter(prefix="/data-refreshes", tags=["Analytics — DataRefresh"])

@data_refreshes_router.get("", response_model=APIResponse[list[DataRefreshResponse]])
def list_data_refreshes(
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.refresh:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = DataRefreshService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@data_refreshes_router.get("/{row_id}", response_model=APIResponse[DataRefreshResponse])
def get_data_refreshes(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.refresh:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=DataRefreshService(db).get(ctx, row_id))

@data_refreshes_router.post("", response_model=APIResponse[DataRefreshResponse])
def create_data_refreshes(
    body: DataRefreshCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.refresh:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=DataRefreshService(db).create(ctx, **body.model_dump(exclude_none=True)))

@data_refreshes_router.patch("/{row_id}", response_model=APIResponse[DataRefreshResponse])
def update_data_refreshes(
    row_id: UUID,
    body: DataRefreshUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.refresh:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=DataRefreshService(db).update(ctx, row_id, **extract_update_fields(body)))

@data_refreshes_router.post("/{row_id}/submit", response_model=APIResponse[DataRefreshResponse])
def submit_data_refreshes(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.refresh:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="submit", data=DataRefreshService(db).submit(ctx, row_id))

alert_rules_router = APIRouter(prefix="/alert-rules", tags=["Analytics — AlertRule"])

@alert_rules_router.get("", response_model=APIResponse[list[AlertRuleResponse]])
def list_alert_rules(
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.alert:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = AlertRuleService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@alert_rules_router.get("/{row_id}", response_model=APIResponse[AlertRuleResponse])
def get_alert_rules(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.alert:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=AlertRuleService(db).get(ctx, row_id))

@alert_rules_router.post("", response_model=APIResponse[AlertRuleResponse])
def create_alert_rules(
    body: AlertRuleCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.alert:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=AlertRuleService(db).create(ctx, **body.model_dump(exclude_none=True)))

@alert_rules_router.patch("/{row_id}", response_model=APIResponse[AlertRuleResponse])
def update_alert_rules(
    row_id: UUID,
    body: AlertRuleUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.alert:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=AlertRuleService(db).update(ctx, row_id, **extract_update_fields(body)))

@alert_rules_router.post("/{row_id}/submit", response_model=APIResponse[AlertRuleResponse])
def submit_alert_rules(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.alert:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="submit", data=AlertRuleService(db).submit(ctx, row_id))

@alert_rules_router.post("/{row_id}/approve", response_model=APIResponse[AlertRuleResponse])
def approve_alert_rules(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.alert:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="approve", data=AlertRuleService(db).approve(ctx, row_id))

alert_notifications_router = APIRouter(prefix="/alert-notifications", tags=["Analytics — AlertNotification"])

@alert_notifications_router.get("", response_model=APIResponse[list[AlertNotificationResponse]])
def list_alert_notifications(
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.notification:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = AlertNotificationService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@alert_notifications_router.get("/{row_id}", response_model=APIResponse[AlertNotificationResponse])
def get_alert_notifications(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.notification:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=AlertNotificationService(db).get(ctx, row_id))

@alert_notifications_router.post("", response_model=APIResponse[AlertNotificationResponse])
def create_alert_notifications(
    body: AlertNotificationCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.notification:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=AlertNotificationService(db).create(ctx, **body.model_dump(exclude_none=True)))

@alert_notifications_router.patch("/{row_id}", response_model=APIResponse[AlertNotificationResponse])
def update_alert_notifications(
    row_id: UUID,
    body: AlertNotificationUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.notification:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=AlertNotificationService(db).update(ctx, row_id, **extract_update_fields(body)))

@alert_notifications_router.post("/{row_id}/acknowledge", response_model=APIResponse[AlertNotificationResponse])
def acknowledge_alert_notifications(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.notification:acknowledge"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="acknowledge", data=AlertNotificationService(db).acknowledge(ctx, row_id))

subscriptions_router = APIRouter(prefix="/subscriptions", tags=["Analytics — Subscription"])

@subscriptions_router.get("", response_model=APIResponse[list[SubscriptionResponse]])
def list_subscriptions(
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.subscription:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = SubscriptionService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@subscriptions_router.get("/{row_id}", response_model=APIResponse[SubscriptionResponse])
def get_subscriptions(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.subscription:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=SubscriptionService(db).get(ctx, row_id))

@subscriptions_router.post("", response_model=APIResponse[SubscriptionResponse])
def create_subscriptions(
    body: SubscriptionCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.subscription:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=SubscriptionService(db).create(ctx, **body.model_dump(exclude_none=True)))

@subscriptions_router.patch("/{row_id}", response_model=APIResponse[SubscriptionResponse])
def update_subscriptions(
    row_id: UUID,
    body: SubscriptionUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.subscription:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=SubscriptionService(db).update(ctx, row_id, **extract_update_fields(body)))

data_exports_router = APIRouter(prefix="/data-exports", tags=["Analytics — DataExport"])

@data_exports_router.get("", response_model=APIResponse[list[DataExportResponse]])
def list_data_exports(
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.export:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = DataExportService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@data_exports_router.get("/{row_id}", response_model=APIResponse[DataExportResponse])
def get_data_exports(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.export:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=DataExportService(db).get(ctx, row_id))

@data_exports_router.post("", response_model=APIResponse[DataExportResponse])
def create_data_exports(
    body: DataExportCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.export:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=DataExportService(db).create(ctx, **body.model_dump(exclude_none=True)))

@data_exports_router.patch("/{row_id}", response_model=APIResponse[DataExportResponse])
def update_data_exports(
    row_id: UUID,
    body: DataExportUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.export:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=DataExportService(db).update(ctx, row_id, **extract_update_fields(body)))

@data_exports_router.post("/{row_id}/run", response_model=APIResponse[DataExportResponse])
def run_data_exports(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.export:run"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="run", data=DataExportService(db).run(ctx, row_id))

data_imports_router = APIRouter(prefix="/data-imports", tags=["Analytics — DataImport"])

@data_imports_router.get("", response_model=APIResponse[list[DataImportResponse]])
def list_data_imports(
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.import:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = DataImportService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@data_imports_router.get("/{row_id}", response_model=APIResponse[DataImportResponse])
def get_data_imports(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.import:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=DataImportService(db).get(ctx, row_id))

@data_imports_router.post("", response_model=APIResponse[DataImportResponse])
def create_data_imports(
    body: DataImportCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.import:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=DataImportService(db).create(ctx, **body.model_dump(exclude_none=True)))

@data_imports_router.patch("/{row_id}", response_model=APIResponse[DataImportResponse])
def update_data_imports(
    row_id: UUID,
    body: DataImportUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.import:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=DataImportService(db).update(ctx, row_id, **extract_update_fields(body)))

@data_imports_router.post("/{row_id}/run", response_model=APIResponse[DataImportResponse])
def run_data_imports(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.import:run"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="run", data=DataImportService(db).run(ctx, row_id))

query_history_router = APIRouter(prefix="/query-history", tags=["Analytics — QueryHistory"])

@query_history_router.get("", response_model=APIResponse[list[QueryHistoryResponse]])
def list_query_history(
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.query_history:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = QueryHistoryService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@query_history_router.get("/{row_id}", response_model=APIResponse[QueryHistoryResponse])
def get_query_history(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.query_history:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=QueryHistoryService(db).get(ctx, row_id))

@query_history_router.post("", response_model=APIResponse[QueryHistoryResponse])
def create_query_history(
    body: QueryHistoryCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.query_history:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=QueryHistoryService(db).create(ctx, **body.model_dump(exclude_none=True)))

@query_history_router.patch("/{row_id}", response_model=APIResponse[QueryHistoryResponse])
def update_query_history(
    row_id: UUID,
    body: QueryHistoryUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.query_history:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=QueryHistoryService(db).update(ctx, row_id, **extract_update_fields(body)))

usage_audits_router = APIRouter(prefix="/usage-audits", tags=["Analytics — UsageAudit"])

@usage_audits_router.get("", response_model=APIResponse[list[UsageAuditResponse]])
def list_usage_audits(
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.usage_audit:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    items = UsageAuditService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=paginate(items, pagination))

@usage_audits_router.get("/{row_id}", response_model=APIResponse[UsageAuditResponse])
def get_usage_audits(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.usage_audit:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=UsageAuditService(db).get(ctx, row_id))

@usage_audits_router.post("", response_model=APIResponse[UsageAuditResponse])
def create_usage_audits(
    body: UsageAuditCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.usage_audit:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Created", data=UsageAuditService(db).create(ctx, **body.model_dump(exclude_none=True)))

@usage_audits_router.patch("/{row_id}", response_model=APIResponse[UsageAuditResponse])
def update_usage_audits(
    row_id: UUID,
    body: UsageAuditUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("analytics.usage_audit:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="Updated", data=UsageAuditService(db).update(ctx, row_id, **extract_update_fields(body)))

