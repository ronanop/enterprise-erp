"""Unit tests for quality engines."""

from types import SimpleNamespace
from uuid import uuid4

import pytest

from modules.quality.domain.exceptions import (
    InvalidCapaState,
    InvalidComplaintState,
    InvalidDefectState,
    InvalidInspectionState,
    InvalidNcrState,
    InvalidPlanState,
    InvalidSamplingPlan,
    InvalidScoreState,
)
from modules.quality.service.engines import (
    CapaEngine,
    ComplaintEngine,
    DefectEngine,
    FinalInspectionEngine,
    IncomingInspectionEngine,
    InspectionPlanEngine,
    NcrEngine,
    QualityScoreEngine,
    SamplingEngine,
)


def test_sampling_accept_reject():
    engine = SamplingEngine()
    plan = SimpleNamespace(accept_count=1, reject_count=3)
    assert engine.validate_accept_reject(plan, defect_count=0) == "accept"
    assert engine.validate_accept_reject(plan, defect_count=3) == "reject"
    with pytest.raises(InvalidSamplingPlan):
        engine.validate_accept_reject(plan, defect_count=2)


def test_inspection_plan_activate_requires_characteristics():
    engine = InspectionPlanEngine()
    plan = SimpleNamespace(status="draft", plan_name="IQC Plan", characteristics=[])
    with pytest.raises(InvalidPlanState):
        engine.validate_activatable(plan)


def test_incoming_inspection_complete_validates_disposition():
    engine = IncomingInspectionEngine()
    inspection = SimpleNamespace(
        status="draft",
        inspected_qty=10,
        accepted_qty=6,
        rejected_qty=6,
        result="pending",
        lines=[SimpleNamespace(is_deleted=False)],
    )
    with pytest.raises(InvalidInspectionState):
        engine.apply_complete(inspection)


def test_incoming_inspection_approve_requires_completed():
    engine = IncomingInspectionEngine()
    inspection = SimpleNamespace(status="draft", result="accepted")
    with pytest.raises(InvalidInspectionState):
        engine.validate_approvable(inspection)


def test_final_inspection_submit_requires_qty():
    engine = FinalInspectionEngine()
    inspection = SimpleNamespace(status="draft", inspected_qty=0, result="pending")
    with pytest.raises(InvalidInspectionState):
        engine.apply_submit(inspection)


def test_defect_linkable_to_ncr():
    engine = DefectEngine()
    defect = SimpleNamespace(status="open", ncr_id=None)
    engine.validate_linkable_to_ncr(defect)
    linked = SimpleNamespace(status="linked_to_ncr", ncr_id=uuid4())
    with pytest.raises(InvalidDefectState):
        engine.validate_linkable_to_ncr(linked)


def test_ncr_lifecycle():
    engine = NcrEngine()
    ncr = SimpleNamespace(status="draft", description="Material defect")
    engine.apply_submit(ncr)
    assert ncr.status == "submitted"
    engine.apply_approve(ncr)
    assert ncr.status == "approved"
    engine.apply_close(ncr)
    assert ncr.status == "closed"


def test_ncr_submit_requires_description():
    engine = NcrEngine()
    ncr = SimpleNamespace(status="draft", description=None)
    with pytest.raises(InvalidNcrState):
        engine.apply_submit(ncr)


def test_capa_verify_requires_done_actions():
    engine = CapaEngine()
    capa = SimpleNamespace(
        status="in_progress",
        ncr_id=uuid4(),
        capa_type="corrective",
        corrective_actions=[SimpleNamespace(status="open")],
        preventive_actions=[],
        root_causes=[],
    )
    with pytest.raises(InvalidCapaState):
        engine.apply_verify(capa)


def test_complaint_close_from_investigating():
    engine = ComplaintEngine()
    complaint = SimpleNamespace(status="investigating")
    engine.apply_close(complaint)
    assert complaint.status == "closed"


def test_complaint_close_blocked_from_draft():
    engine = ComplaintEngine()
    complaint = SimpleNamespace(status="draft")
    with pytest.raises(InvalidComplaintState):
        engine.apply_close(complaint)


def test_quality_score_compute_kpis():
    engine = QualityScoreEngine()
    kpis = engine.compute_kpis(
        {"inspected": 100, "passed": 90, "defects": 10, "rework": 5, "complaints": 2}
    )
    assert float(kpis.first_pass_yield) == 90
    assert float(kpis.defect_rate) == 10


def test_quality_score_publish_requires_period():
    engine = QualityScoreEngine()
    score = SimpleNamespace(status="draft", period_start=None, period_end=None)
    with pytest.raises(InvalidScoreState):
        engine.validate_publishable(score)
