"""Quality services."""

from modules.quality.service.inspection_service import (
    FinalInspectionService,
    IncomingInspectionService,
    InProcessInspectionService,
)
from modules.quality.service.ncr_capa_service import CapaService, DefectService, NcrService
from modules.quality.service.plan_service import (
    CharacteristicService,
    DefectTypeService,
    InspectionPlanService,
    SamplingPlanService,
)
from modules.quality.service.posting_service import QualityPostingService
from modules.quality.service.report_service import QualityReportService
from modules.quality.service.scorecard_service import (
    CustomerComplaintService,
    QualityAuditService,
    QualityScoreService,
    SupplierQualityService,
)

__all__ = [
    "SamplingPlanService",
    "InspectionPlanService",
    "CharacteristicService",
    "DefectTypeService",
    "IncomingInspectionService",
    "InProcessInspectionService",
    "FinalInspectionService",
    "DefectService",
    "NcrService",
    "CapaService",
    "SupplierQualityService",
    "CustomerComplaintService",
    "QualityAuditService",
    "QualityScoreService",
    "QualityPostingService",
    "QualityReportService",
]
