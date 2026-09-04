"""Unit tests for AssetDisposalEngine (FP-ASSET-005)."""

from types import SimpleNamespace

import pytest

from modules.asset.domain.exceptions import InvalidAssetDisposalState
from modules.asset.service.engines.asset_disposal_engine import AssetDisposalEngine
from modules.asset.service.engines.asset_engine import AssetEngine


def test_submit_approve_post() -> None:
    engine = AssetDisposalEngine()
    row = SimpleNamespace(status="draft")
    engine.submit(row)
    assert row.status == "submitted"
    engine.approve(row)
    assert row.status == "approved"
    engine.post(row)
    assert row.status == "posted"


def test_cancel_and_reopen() -> None:
    engine = AssetDisposalEngine()
    row = SimpleNamespace(status="draft")
    engine.cancel_draft(row)
    assert row.status == "cancelled"
    engine.reopen(row, workflow_status="rejected")
    assert row.status == "draft"


def test_reopen_requires_rejected() -> None:
    engine = AssetDisposalEngine()
    row = SimpleNamespace(status="cancelled")
    with pytest.raises(InvalidAssetDisposalState, match="rejected"):
        engine.reopen(row, workflow_status="approved")


def test_asset_dispose_sale_sets_disposed() -> None:
    engine = AssetEngine()
    row = SimpleNamespace(status="active")
    engine.dispose(row, disposal_type="sale")
    assert row.status == "disposed"


def test_asset_dispose_write_off_sets_written_off() -> None:
    engine = AssetEngine()
    row = SimpleNamespace(status="active")
    engine.dispose(row, disposal_type="write_off")
    assert row.status == "written_off"
