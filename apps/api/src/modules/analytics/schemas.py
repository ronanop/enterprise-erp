"""Analytics Pydantic schemas."""

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
    company_id: UUID
    status: str
    version: int

class DashboardWidgetCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DashboardWidgetUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DashboardWidgetResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class ReportCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ReportUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ReportResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class ReportScheduleCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ReportScheduleUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ReportScheduleResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class ReportExecutionCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class ReportExecutionUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class ReportExecutionResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class DatasetCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DatasetUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DatasetResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class DatasetSourceCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DatasetSourceUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DatasetSourceResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class MetricCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class MetricUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class MetricResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class KpiCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class KpiUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class KpiResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class DimensionCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DimensionUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DimensionResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class FactTableCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class FactTableUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class FactTableResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class DataSnapshotCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DataSnapshotUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DataSnapshotResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class DataRefreshCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DataRefreshUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DataRefreshResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class AlertRuleCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class AlertRuleUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class AlertRuleResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class AlertNotificationCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class AlertNotificationUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class AlertNotificationResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class SubscriptionCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class SubscriptionUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class SubscriptionResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class DataExportCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DataExportUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DataExportResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class DataImportCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class DataImportUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class DataImportResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class QueryHistoryCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class QueryHistoryUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class QueryHistoryResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int

class UsageAuditCreate(BaseModel):
    company_id: UUID | None = None
    status: str | None = None

class UsageAuditUpdate(BaseModel):
    status: str | None = None
    version: int | None = None

class UsageAuditResponse(OrmModel):
    id: UUID
    company_id: UUID
    status: str
    version: int
