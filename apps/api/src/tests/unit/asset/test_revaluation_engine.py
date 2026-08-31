"""Unit tests for AssetRevaluationEngine (FP-ASSET-007)."""

from types import SimpleNamespace

import pytest

from modules.asset.domain.exceptions import InvalidAssetRevaluationState
from modules.asset.service.engines.asset_revaluation_engine import AssetRevaluationEngine


def test_submit_approve_post_transitions() -> None:
    engine = AssetRevaluationEngine()
    row = SimpleNamespace(status="draft")
    engine.submit(row)
    assert row.status == "submitted"
    engine.approve(row)
    assert row.status == "approved"
    engine.post(row)
    assert row.status == "posted"


def test_cancel_and_reopen_transitions() -> None:
    engine = AssetRevaluationEngine()
    row = SimpleNamespace(status="draft")
    engine.cancel_draft(row)
    assert row.status == "cancelled"
    engine.reopen(row, workflow_status="rejected")
    assert row.status == "draft"


def test_reopen_requires_cancelled_rejected_workflow() -> None:
    engine = AssetRevaluationEngine()
    with pytest.raises(InvalidAssetRevaluationState, match="cancelled"):
        engine.reopen(SimpleNamespace(status="submitted"), workflow_status="rejected")
    with pytest.raises(InvalidAssetRevaluationState, match="rejected"):
        engine.reopen(SimpleNamespace(status="cancelled"), workflow_status="approved")
