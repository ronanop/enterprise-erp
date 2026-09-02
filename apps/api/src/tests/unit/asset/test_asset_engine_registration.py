"""Asset engine reopen/cancel draft tests."""

import pytest

from modules.asset.domain.enums import AssetStatus
from modules.asset.domain.exceptions import InvalidAssetState
from modules.asset.service.engines.asset_engine import AssetEngine


class _Row:
    status = AssetStatus.CANCELLED.value
    master_asset_id = None
    workflow_status = "rejected"


def test_reopen_from_rejected_cancelled() -> None:
    row = _Row()
    AssetEngine().reopen(row, workflow_status="rejected")
    assert row.status == AssetStatus.DRAFT.value


def test_reopen_fails_without_rejected_workflow() -> None:
    row = _Row()
    row.workflow_status = "approved"
    with pytest.raises(InvalidAssetState):
        AssetEngine().reopen(row, workflow_status=row.workflow_status)
