"""Tests for MinIO-only workplace feed image storage."""

import uuid
from unittest.mock import patch

import pytest

from core.exceptions import AppException, NotFoundException
from modules.ess import feed_storage


def test_save_requires_object_storage(monkeypatch):
    monkeypatch.setattr(feed_storage.object_storage, "is_enabled", lambda: False)
    with pytest.raises(AppException) as exc:
        feed_storage.save_feed_image_bytes(
            company_id=uuid.uuid4(),
            post_id=uuid.uuid4(),
            file_name="shot.jpg",
            raw=b"\xff\xd8\xff fakejpeg",
        )
    assert exc.value.status_code == 503


def test_save_puts_to_minio(monkeypatch):
    monkeypatch.setattr(feed_storage.object_storage, "is_enabled", lambda: True)

    def fake_put(key, data, content_type=None):
        assert "hr/social-feed" in key or key.startswith("hr/")
        assert data.startswith(b"\xff\xd8")
        return f"s3://cache-erp-bucket/{key}"

    monkeypatch.setattr(feed_storage.object_storage, "put_bytes", fake_put)
    monkeypatch.setattr(
        feed_storage.object_storage,
        "module_key",
        lambda *parts: "/".join(str(p).strip("/") for p in parts),
    )

    cid = uuid.uuid4()
    pid = uuid.uuid4()
    uri, name, media = feed_storage.save_feed_image_bytes(
        company_id=cid,
        post_id=pid,
        file_name="team.jpg",
        raw=b"\xff\xd8\xff fakejpeg",
        content_type="image/jpeg",
    )
    assert uri.startswith("s3://")
    assert str(cid) in uri and str(pid) in uri
    assert name.endswith("team.jpg") or "team.jpg" in name
    assert media in {"image/jpeg", None} or "jpeg" in (media or "")


def test_load_rejects_non_object_uri():
    with pytest.raises(NotFoundException):
        feed_storage.load_feed_image("hr-feed:local/path.jpg", "x.jpg")


def test_load_reads_minio(monkeypatch):
    monkeypatch.setattr(
        feed_storage.object_storage, "is_object_uri", lambda uri: True
    )
    monkeypatch.setattr(
        feed_storage.object_storage,
        "get_bytes",
        lambda uri: b"IMGDATA",
    )
    dl = feed_storage.load_feed_image(
        "s3://bucket/hr/social-feed/c/p/uuid_photo.jpg", "photo"
    )
    assert dl.content == b"IMGDATA"
    assert dl.filename.endswith(".jpg")
