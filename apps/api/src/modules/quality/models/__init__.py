"""Quality ORM models."""

from modules.quality.models.capa import (
    QmCapa,
    QmCorrectiveAction,
    QmPreventiveAction,
    QmRootCause,
)
from modules.quality.models.characteristic import QmQualityCharacteristic
from modules.quality.models.customer_complaint import QmCustomerComplaint
from modules.quality.models.defect import QmDefect
from modules.quality.models.defect_type import QmDefectType
from modules.quality.models.final_inspection import QmFinalInspection
from modules.quality.models.incoming_inspection import (
    QmIncomingInspection,
    QmIncomingInspectionLine,
)
from modules.quality.models.inprocess_inspection import QmInprocessInspection
from modules.quality.models.inspection_plan import QmInspectionPlan
from modules.quality.models.ncr import QmNcr
from modules.quality.models.pfmea import QmPfmea, QmPfmeaLine
from modules.quality.models.ppap import QmPpap
from modules.quality.models.quality_audit import QmQualityAudit
from modules.quality.models.quality_score import QmQualityScore
from modules.quality.models.sampling_plan import QmSamplingPlan
from modules.quality.models.scar import QmScar
from modules.quality.models.spc_reading import QmSpcReading
from modules.quality.models.supplier_quality import QmSupplierQuality
from modules.quality.models.vin_trace import QmVinTrace, QmVinTraceComponent
from modules.quality.models.warranty_claim import QmWarrantyClaim
from modules.quality.models.recall import QmRecall

__all__ = [
    "QmCapa",
    "QmCorrectiveAction",
    "QmPreventiveAction",
    "QmRootCause",
    "QmQualityCharacteristic",
    "QmCustomerComplaint",
    "QmDefect",
    "QmDefectType",
    "QmFinalInspection",
    "QmIncomingInspection",
    "QmIncomingInspectionLine",
    "QmInprocessInspection",
    "QmInspectionPlan",
    "QmNcr",
    "QmPfmea",
    "QmPfmeaLine",
    "QmPpap",
    "QmQualityAudit",
    "QmQualityScore",
    "QmSamplingPlan",
    "QmScar",
    "QmSpcReading",
    "QmSupplierQuality",
    "QmVinTrace",
    "QmVinTraceComponent",
    "QmWarrantyClaim",
    "QmRecall",
]
