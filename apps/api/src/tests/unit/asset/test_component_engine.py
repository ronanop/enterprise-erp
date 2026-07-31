"""Unit tests for AssetComponentEngine (FP-ASSET-019)."""

from types import SimpleNamespace

import pytest

from modules.asset.domain.exceptions import InvalidAssetComponentState
from modules.asset.service.engines.asset_component_engine import AssetComponentEngine


def test_install_defaults_sets_active() -> None:
    engine = AssetComponentEngine()
    row = SimpleNamespace(status="draft")
    engine.install_defaults(row)
    assert row.status == "active"


def test_replace_from_active() -> None:
    engine = AssetComponentEngine()
    row = SimpleNamespace(status="active")
    engine.replace(row)
    assert row.status == "replaced"


def test_dispose_from_active() -> None:
    engine = AssetComponentEngine()
    row = SimpleNamespace(status="active")
    engine.dispose(row)
    assert row.status == "disposed"


def test_replace_rejects_non_active() -> None:
    engine = AssetComponentEngine()
    row = SimpleNamespace(status="disposed")
    with pytest.raises(InvalidAssetComponentState, match="active"):
        engine.replace(row)


def test_dispose_rejects_non_active() -> None:
    engine = AssetComponentEngine()
    row = SimpleNamespace(status="replaced")
    with pytest.raises(InvalidAssetComponentState, match="active"):
        engine.dispose(row)


def test_dispose_rejects_already_disposed() -> None:
    engine = AssetComponentEngine()
    row = SimpleNamespace(status="disposed")
    with pytest.raises(InvalidAssetComponentState, match="active"):
        engine.dispose(row)
