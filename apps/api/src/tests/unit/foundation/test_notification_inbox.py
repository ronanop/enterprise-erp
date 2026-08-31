"""Unit tests for user-scoped notification inbox."""

from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest

from core.exceptions import AppException, NotFoundException
from modules.foundation.service.notification_service import NotificationService


def _event(**overrides):
    payload = overrides.pop("payload_json", {"title": "Leave Pending", "body": "Needs approval", "kind": "leave"})
    base = dict(
        id=uuid4(),
        tenant_id=uuid4(),
        recipient_user_id=uuid4(),
        event_type="hr.leave_submitted",
        payload_json=payload,
        status="sent",
        created_at=datetime.now(timezone.utc),
        read_at=None,
    )
    base.update(overrides)
    return SimpleNamespace(**base)


class _FakeRepo:
    def __init__(self, rows):
        self.rows = list(rows)
        self.db = SimpleNamespace(flush=lambda: None)

    def list_inbox(self, *, tenant_id, user_id, limit=50):
        return [
            row
            for row in self.rows
            if row.tenant_id == tenant_id and row.recipient_user_id == user_id
        ][:limit]

    def unread_count(self, *, tenant_id, user_id):
        return len(self.list_unread(tenant_id=tenant_id, user_id=user_id))

    def get_inbox_event(self, *, tenant_id, user_id, event_id):
        for row in self.rows:
            if row.id == event_id and row.tenant_id == tenant_id and row.recipient_user_id == user_id:
                return row
        return None

    def list_unread(self, *, tenant_id, user_id):
        return [
            row
            for row in self.rows
            if row.tenant_id == tenant_id
            and row.recipient_user_id == user_id
            and row.read_at is None
            and row.status != "read"
        ]


def _service(rows) -> NotificationService:
    svc = NotificationService.__new__(NotificationService)
    svc._repo = _FakeRepo(rows)
    svc._audit = SimpleNamespace()
    return svc


def test_list_inbox_isolates_tenant_and_user() -> None:
    tenant_a = uuid4()
    tenant_b = uuid4()
    user_a = uuid4()
    user_b = uuid4()
    mine = _event(tenant_id=tenant_a, recipient_user_id=user_a)
    other_user = _event(tenant_id=tenant_a, recipient_user_id=user_b)
    other_tenant = _event(tenant_id=tenant_b, recipient_user_id=user_a)
    svc = _service([mine, other_user, other_tenant])

    items = svc.list_inbox(tenant_id=tenant_a, user_id=user_a)
    assert [item.id for item in items] == [mine.id]


def test_unread_count_excludes_read() -> None:
    tenant_id = uuid4()
    user_id = uuid4()
    unread = _event(tenant_id=tenant_id, recipient_user_id=user_id)
    read = _event(tenant_id=tenant_id, recipient_user_id=user_id, status="read", read_at=datetime.now(timezone.utc))
    svc = _service([unread, read])
    assert svc.unread_count(tenant_id=tenant_id, user_id=user_id) == 1


def test_mark_read_sets_read_at_and_status() -> None:
    tenant_id = uuid4()
    user_id = uuid4()
    row = _event(tenant_id=tenant_id, recipient_user_id=user_id)
    svc = _service([row])
    item = svc.mark_read(tenant_id=tenant_id, user_id=user_id, event_id=row.id)
    assert item.unread is False
    assert row.status == "read"
    assert row.read_at is not None


def test_mark_read_rejects_other_users() -> None:
    row = _event()
    svc = _service([row])
    with pytest.raises(NotFoundException):
        svc.mark_read(tenant_id=row.tenant_id, user_id=uuid4(), event_id=row.id)


def test_mark_all_read() -> None:
    tenant_id = uuid4()
    user_id = uuid4()
    rows = [_event(tenant_id=tenant_id, recipient_user_id=user_id) for _ in range(3)]
    svc = _service(rows)
    assert svc.mark_all_read(tenant_id=tenant_id, user_id=user_id) == 3
    assert all(row.status == "read" and row.read_at is not None for row in rows)


def test_unsafe_href_falls_back_to_kind_route() -> None:
    row = _event(
        payload_json={
            "title": "Open Requisitions",
            "body": "1 open",
            "kind": "interview",
            "href": "https://evil.example/phish",
        }
    )
    svc = _service([row])
    items = svc.list_inbox(tenant_id=row.tenant_id, user_id=row.recipient_user_id)
    assert items[0].href == "/hr/recruitment"


def test_authenticated_user_required() -> None:
    svc = _service([])
    with pytest.raises(AppException):
        svc.list_inbox(tenant_id=uuid4(), user_id=None)
