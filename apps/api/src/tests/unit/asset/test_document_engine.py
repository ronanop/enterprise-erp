"""Unit tests for AssetDocumentEngine (FP-ASSET-016)."""

from types import SimpleNamespace

import pytest

from modules.asset.domain.exceptions import InvalidAssetDocumentState
from modules.asset.service.engines.asset_document_engine import AssetDocumentEngine


def test_supersede_from_active() -> None:
    engine = AssetDocumentEngine()
    row = SimpleNamespace(status="active")
    engine.supersede(row)
    assert row.status == "superseded"


def test_archive_from_active() -> None:
    engine = AssetDocumentEngine()
    row = SimpleNamespace(status="active")
    engine.archive(row)
    assert row.status == "archived"


def test_archive_from_superseded() -> None:
    engine = AssetDocumentEngine()
    row = SimpleNamespace(status="superseded")
    engine.archive(row)
    assert row.status == "archived"


def test_supersede_rejects_non_active() -> None:
    engine = AssetDocumentEngine()
    row = SimpleNamespace(status="archived")
    with pytest.raises(InvalidAssetDocumentState, match="active"):
        engine.supersede(row)


def test_archive_rejects_archived() -> None:
    engine = AssetDocumentEngine()
    row = SimpleNamespace(status="archived")
    with pytest.raises(InvalidAssetDocumentState, match="active or superseded"):
        engine.archive(row)
