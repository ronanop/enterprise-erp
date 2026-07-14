"""Integration smoke: quality module imports and router mount."""

from modules.quality.models import QmIncomingInspection, QmInspectionPlan, QmNcr
from modules.quality.router import quality_router
from modules.quality.service import IncomingInspectionService, NcrService
from modules.quality.service.engines import IncomingInspectionEngine, NcrEngine


def test_models_importable():
    assert QmInspectionPlan.__tablename__ == "qm_inspection_plan"
    assert QmIncomingInspection.__tablename__ == "qm_incoming_inspection"
    assert QmNcr.__tablename__ == "qm_ncr"


def test_router_prefix():
    assert quality_router.prefix == "/quality"
    assert len(quality_router.routes) > 20


def test_services_and_engines_importable():
    assert IncomingInspectionService.__name__ == "IncomingInspectionService"
    assert NcrService.__name__ == "NcrService"
    assert IncomingInspectionEngine.__name__ == "IncomingInspectionEngine"
    assert NcrEngine.__name__ == "NcrEngine"
