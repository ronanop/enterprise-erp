"""Asset services."""

from modules.asset.service.application_service import AssetApplicationService
from modules.asset.service.asset_audit_service import AssetAuditService
from modules.asset.service.asset_category_service import AssetCategoryService
from modules.asset.service.asset_report_service import AssetReportService
from modules.asset.service.asset_dashboard_summary_service import AssetDashboardSummaryService
from modules.asset.service.asset_excel_import_service import AssetExcelImportService
from modules.asset.service.asset_service import AssetService
from modules.asset.service.assignment_service import AssignmentService
from modules.asset.service.excel_import_engine import AssetExcelImportEngine
from modules.asset.service.assignment_component_service import AssignmentComponentService
from modules.asset.service.checklist_service import ChecklistService
from modules.asset.service.component_service import (
    AssetComponentService,
    ComponentService,
)
from modules.asset.service.depreciation_service import DepreciationService
from modules.asset.service.disposal_service import DisposalService
from modules.asset.service.document_service import DocumentService
from modules.asset.service.insurance_service import InsuranceService
from modules.asset.service.incoming_asset_service import IncomingAssetService
from modules.asset.service.incoming_qc_service import IncomingAssetQcService
from modules.asset.service.incoming_registration_service import IncomingRegistrationService
from modules.asset.service.integration_service import AssetIntegrationService
from modules.asset.service.location_service import LocationService
from modules.asset.service.maintenance_plan_service import MaintenancePlanService
from modules.asset.service.maintenance_service import MaintenanceService
from modules.asset.service.meter_reading_service import MeterReadingService
from modules.asset.service.notification_service import (
    AssetNotificationService,
    NotificationService,
)
from modules.asset.service.revaluation_service import RevaluationService
from modules.asset.service.retirement_service import RetirementService
from modules.asset.service.reinstate_service import ReinstateService
from modules.asset.service.service_history_service import ServiceHistoryService
from modules.asset.service.transfer_service import TransferService
from modules.asset.service.warranty_service import WarrantyService

__all__ = [
    "AssetApplicationService",
    "AssetAuditService",
    "AssetCategoryService",
    "AssetDashboardSummaryService",
    "AssetExcelImportService",
    "AssetExcelImportEngine",
    "AssetIntegrationService",
    "AssetReportService",
    "AssetService",
    "AssignmentService",
    "AssignmentComponentService",
    "ChecklistService",
    "AssetComponentService",
    "ComponentService",
    "DepreciationService",
    "DisposalService",
    "DocumentService",
    "InsuranceService",
    "IncomingAssetService",
    "IncomingAssetQcService",
    "IncomingRegistrationService",
    "LocationService",
    "MaintenancePlanService",
    "MaintenanceService",
    "MeterReadingService",
    "AssetNotificationService",
    "NotificationService",
    "RevaluationService",
    "RetirementService",
    "ReinstateService",
    "ServiceHistoryService",
    "TransferService",
    "WarrantyService",
]
