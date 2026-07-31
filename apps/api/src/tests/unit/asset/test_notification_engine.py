"""Unit tests for AssetNotificationEngine (FP-ASSET-017)."""

from types import SimpleNamespace

import pytest

from modules.asset.domain.exceptions import InvalidAssetNotificationState
from modules.asset.service.engines.asset_notification_engine import AssetNotificationEngine


def test_archive_from_active() -> None:
    engine = AssetNotificationEngine()
    row = SimpleNamespace(status="active")
    engine.archive(row)
    assert row.status == "archived"


def test_archive_rejects_archived() -> None:
    engine = AssetNotificationEngine()
    row = SimpleNamespace(status="archived")
    with pytest.raises(InvalidAssetNotificationState, match="active"):
        engine.archive(row)


def test_mark_sent_from_pending_sets_sent_at() -> None:
    engine = AssetNotificationEngine()
    row = SimpleNamespace(status="active", delivery_status="pending", sent_at=None)
    engine.mark_sent(row)
    assert row.delivery_status == "sent"
    assert row.sent_at is not None


def test_mark_sent_from_failed() -> None:
    engine = AssetNotificationEngine()
    row = SimpleNamespace(status="active", delivery_status="failed", sent_at=None)
    engine.mark_sent(row)
    assert row.delivery_status == "sent"


def test_mark_failed_from_pending() -> None:
    engine = AssetNotificationEngine()
    row = SimpleNamespace(status="active", delivery_status="pending")
    engine.mark_failed(row)
    assert row.delivery_status == "failed"


def test_mark_failed_rejects_sent() -> None:
    engine = AssetNotificationEngine()
    row = SimpleNamespace(status="active", delivery_status="sent")
    with pytest.raises(InvalidAssetNotificationState, match="pending"):
        engine.mark_failed(row)


def test_mark_read_from_sent() -> None:
    engine = AssetNotificationEngine()
    row = SimpleNamespace(status="active", delivery_status="sent")
    engine.mark_read(row)
    assert row.delivery_status == "read"


def test_mark_read_rejects_pending() -> None:
    engine = AssetNotificationEngine()
    row = SimpleNamespace(status="active", delivery_status="pending")
    with pytest.raises(InvalidAssetNotificationState, match="sent"):
        engine.mark_read(row)


def test_apply_metadata() -> None:
    engine = AssetNotificationEngine()
    row = SimpleNamespace(branch_id=None, recipient_user_id=None, payload_json=None)
    uid = __import__("uuid").uuid4()
    engine.apply_metadata(row, {"recipient_user_id": uid, "payload_json": {"a": 1}})
    assert row.recipient_user_id == uid
    assert row.payload_json == {"a": 1}
