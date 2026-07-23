"""Unit tests for SCM OVF → vendor PO handoff service."""

from datetime import date
from types import SimpleNamespace
from uuid import uuid4

import pytest

from core.exceptions import ConflictException
from modules.procurement.domain.enums import OrderStatus
from modules.procurement.domain.exceptions import InvalidDocumentState
from modules.procurement.service.scm_handoff_service import ScmHandoffService, _grn_badge, _header_grn_badge


def test_grn_badge_helpers():
    assert _grn_badge(quantity=10, quantity_received=0, line_status="open") == "pending"
    assert _grn_badge(quantity=10, quantity_received=4, line_status="partially_received") == "partial"
    assert _grn_badge(quantity=10, quantity_received=10, line_status="received") == "delivered"

    lines = [
        SimpleNamespace(is_deleted=False, quantity=5, quantity_received=5, status="received"),
        SimpleNamespace(is_deleted=False, quantity=2, quantity_received=2, status="received"),
    ]
    assert _header_grn_badge(lines) == "closed"

    lines[1].quantity_received = 1
    lines[1].status = "partially_received"
    assert _header_grn_badge(lines) == "partial"


class _FakeOrdersRepo:
    def __init__(self) -> None:
        self.by_source = None
        self.updated = {}

    def find_by_source(self, *_a, **_k):
        return self.by_source

    def update_order(self, _ctx, order_id, **fields):
        self.updated[order_id] = fields
        if self.by_source and self.by_source.id == order_id:
            for k, v in fields.items():
                setattr(self.by_source, k, v)
            return self.by_source
        return None

    def list_orders_with_lines(self, *_a, **_k):
        return []


class _FakeOrderService:
    def __init__(self, order) -> None:
        self.order = order

    def get_order(self, _ctx, _order_id):
        return self.order


def test_finalize_rejects_non_crm_source():
    order = SimpleNamespace(
        id=uuid4(),
        source_module="procurement",
        source_document_type="requisition",
        status=OrderStatus.DRAFT.value,
        lines=[SimpleNamespace(is_deleted=False)],
    )
    svc = ScmHandoffService.__new__(ScmHandoffService)
    svc._order_service = _FakeOrderService(order)
    svc._orders = _FakeOrdersRepo()
    with pytest.raises(InvalidDocumentState):
        svc.finalize_scm_po(SimpleNamespace(), order.id)


def test_create_po_blocks_duplicate(monkeypatch):
    ovf_id = uuid4()
    existing = SimpleNamespace(id=uuid4(), document_number="PO-000001")
    svc = ScmHandoffService.__new__(ScmHandoffService)
    svc._crm = SimpleNamespace(
        get_handoff=lambda *_a, **_k: {
            "ovf_id": ovf_id,
            "vendor_lines": [{"product_name": "X", "qty": 1, "unit_price": 10, "line_total": 10}],
            "company_id": uuid4(),
            "branch_id": uuid4(),
        }
    )
    repo = _FakeOrdersRepo()
    repo.by_source = existing
    svc._orders = repo
    with pytest.raises(ConflictException, match="already exists"):
        svc.create_po_from_ovf(
            SimpleNamespace(),
            ovf_id=ovf_id,
            vendor_id=uuid4(),
            document_date=date.today(),
        )
