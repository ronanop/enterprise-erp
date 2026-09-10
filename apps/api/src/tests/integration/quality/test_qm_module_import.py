"""Integration smoke: quality module imports and router mount."""

from modules.quality.models import (
    QmCapa,
    QmCustomerComplaint,
    QmFinalInspection,
    QmIncomingInspection,
    QmInspectionPlan,
    QmNcr,
    QmPfmea,
    QmPpap,
    QmScar,
    QmSpcReading,
    QmVinTrace,
    QmWarrantyClaim,
    QmRecall,
)
from modules.quality.router import quality_router
from modules.quality.routers import (
    scars_router,
    spc_readings_router,
    vin_traces_router,
    warranty_claims_router,
    recalls_router,
)
from modules.quality.service import IncomingInspectionService, NcrService
from modules.quality.service.engines import IncomingInspectionEngine, NcrEngine, SpcEngine
from modules.quality.service.posting_service import QualityPostingService


def test_models_importable():
    assert QmInspectionPlan.__tablename__ == "qm_inspection_plan"
    assert QmIncomingInspection.__tablename__ == "qm_incoming_inspection"
    assert QmNcr.__tablename__ == "qm_ncr"
    assert QmPfmea.__tablename__ == "qm_pfmea"
    assert QmPpap.__tablename__ == "qm_ppap"
    assert QmSpcReading.__tablename__ == "qm_spc_reading"
    assert QmScar.__tablename__ == "qm_scar"
    assert QmVinTrace.__tablename__ == "qm_vin_trace"
    assert QmWarrantyClaim.__tablename__ == "qm_warranty_claim"
    assert QmRecall.__tablename__ == "qm_recall"
    assert "vin" not in {c.name for c in QmFinalInspection.__table__.columns}
    assert "vin_trace_id" not in {c.name for c in QmCustomerComplaint.__table__.columns}
    assert "period_id" not in {c.name for c in QmWarrantyClaim.__table__.columns}
    assert "finance_journal_id" not in {c.name for c in QmWarrantyClaim.__table__.columns}
    assert "warranty_claim_id" not in {c.name for c in QmCapa.__table__.columns}
    assert "warranty_claim_id" not in {c.name for c in QmNcr.__table__.columns}
    assert "recall_id" not in {c.name for c in QmCapa.__table__.columns}
    assert "recall_id" not in {c.name for c in QmNcr.__table__.columns}
    assert "recall_id" not in {c.name for c in QmWarrantyClaim.__table__.columns}


def test_router_prefix():
    assert quality_router.prefix == "/quality"
    assert len(quality_router.routes) >= 18
    assert spc_readings_router.prefix == "/spc-readings"
    assert scars_router.prefix == "/scars"
    assert vin_traces_router.prefix == "/vin-traces"
    assert warranty_claims_router.prefix == "/warranty-claims"
    assert recalls_router.prefix == "/recalls"


def test_services_and_engines_importable():
    assert IncomingInspectionService.__name__ == "IncomingInspectionService"
    assert NcrService.__name__ == "NcrService"
    assert IncomingInspectionEngine.__name__ == "IncomingInspectionEngine"
    assert NcrEngine.__name__ == "NcrEngine"
    assert SpcEngine.__name__ == "SpcEngine"
    import inspect

    assert "QmWarrantyClaim" not in inspect.getsource(QualityPostingService)
    assert "QmRecall" not in inspect.getsource(QualityPostingService)
