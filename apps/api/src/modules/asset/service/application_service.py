"""Asset application service facade."""

from sqlalchemy.orm import Session

from modules.asset.service.asset_audit_service import AssetAuditService
from modules.asset.service.asset_category_service import AssetCategoryService
from modules.asset.service.asset_report_service import AssetReportService
from modules.asset.service.asset_service import AssetService
from modules.asset.service.assignment_service import AssignmentService
from modules.asset.service.checklist_service import ChecklistService
from modules.asset.service.component_service import (
    AssetComponentService,
    ComponentService,
)
from modules.asset.service.depreciation_service import DepreciationService
from modules.asset.service.disposal_service import DisposalService
from modules.asset.service.document_service import DocumentService
from modules.asset.service.insurance_service import InsuranceService
from modules.asset.service.integration_service import AssetIntegrationService
from modules.asset.service.location_service import LocationService
from modules.asset.service.maintenance_plan_service import MaintenancePlanService
from modules.asset.service.maintenance_service import MaintenanceService
from modules.asset.service.meter_reading_service import MeterReadingService
from modules.asset.service.notification_service import AssetNotificationService
from modules.asset.service.revaluation_service import RevaluationService
from modules.asset.service.service_history_service import ServiceHistoryService
from modules.asset.service.transfer_service import TransferService
from modules.asset.service.warranty_service import WarrantyService


class AssetApplicationService:
    def __init__(self, db: Session) -> None:
        self.categories = AssetCategoryService(db)
        self.assets = AssetService(db)
        self.components = ComponentService(db)
        self.assignments = AssignmentService(db)
        self.transfers = TransferService(db)
        self.locations = LocationService(db)
        self.warranties = WarrantyService(db)
        self.insurances = InsuranceService(db)
        self.maintenance_plans = MaintenancePlanService(db)
        self.maintenances = MaintenanceService(db)
        self.service_histories = ServiceHistoryService(db)
        self.depreciations = DepreciationService(db)
        self.disposals = DisposalService(db)
        self.revaluations = RevaluationService(db)
        self.audits = AssetAuditService(db)
        self.documents = DocumentService(db)
        self.checklists = ChecklistService(db)
        self.meter_readings = MeterReadingService(db)
        self.notifications = AssetNotificationService(db)
        self.reports = AssetReportService(db)
        self.integration = AssetIntegrationService(db)
