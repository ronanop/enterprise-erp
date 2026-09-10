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
from modules.quality.service.pfmea_ppap_service import PfmeaService, PpapService
from modules.quality.service.scar_service import ScarService
from modules.quality.service.spc_reading_service import SpcReadingService
from modules.quality.service.vin_trace_service import VinTraceService
from modules.quality.service.warranty_claim_service import WarrantyClaimService
from modules.quality.service.recall_service import RecallService

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
    "PfmeaService",
    "PpapService",
    "ScarService",
    "SpcReadingService",
    "VinTraceService",
    "WarrantyClaimService",
    "RecallService",
]
