"""Unit tests for GRN receipt-batch reversal helpers and service."""

from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest

from core.exceptions import ConflictException
from modules.procurement.domain.enums import OrderStatus
from modules.procurement.domain.exceptions import InvalidDocumentState
from modules.procurement.service.engines.receipt_reversal import (
    assert_batch_reversible,
    line_receipt_status,
    order_receipt_status,
    subtract_received,
)
from modules.procurement.service.scm_handoff_service import ScmHandoffService


def test_subtract_received_never_below_zero():
    assert subtract_received(5, 3) == 2
    assert subtract_received(2, 5) == 0
    assert subtract_received(0, 1) == 0


def test_line_receipt_status_open_partial_received():
    assert line_receipt_status(10, 0) == "open"
    assert line_receipt_status(10, 4) == "partially_received"
    assert line_receipt_status(10, 10) == "received"
    assert line_receipt_status(10, 12) == "received"


def test_order_receipt_status_reopens_completed_po():
    lines = [
        SimpleNamespace(is_deleted=False, quantity=10, quantity_received=10, unit_cost=2),
        SimpleNamespace(is_deleted=False, quantity=5, quantity_received=5, unit_cost=4),
    ]
    status, amount = order_receipt_status(lines)
    assert status == OrderStatus.RECEIVED.value
    assert amount == 40

    lines[1].quantity_received = 2
    status, amount = order_receipt_status(lines)
    assert status == OrderStatus.PARTIALLY_RECEIVED.value
    assert amount == 28

    lines[0].quantity_received = 0
    lines[1].quantity_received = 0
    status, amount = order_receipt_status(lines)
    assert status == OrderStatus.SENT.value
    assert amount == 0


def test_assert_batch_reversible_rejects_duplicate_and_draft():
    assert_batch_reversible(reversal_status="posted", order_status=OrderStatus.RECEIVED.value)
    with pytest.raises(ConflictException, match="already been reversed"):
        assert_batch_reversible(reversal_status="reversed", order_status=OrderStatus.RECEIVED.value)
    with pytest.raises(InvalidDocumentState, match="issued purchase orders"):
        assert_batch_reversible(reversal_status="posted", order_status=OrderStatus.DRAFT.value)
    with pytest.raises(InvalidDocumentState, match="issued purchase orders"):
        assert_batch_reversible(reversal_status="posted", order_status=OrderStatus.CANCELLED.value)


class _Query:
    def __init__(self, rows):
        self.rows = list(rows)

    def filter(self, *a, **k):
        return self

    def with_for_update(self):
        return self

    def join(self, *a, **k):
        return self

    def order_by(self, *a, **k):
        return self

    def first(self):
        return self.rows[0] if self.rows else None

    def all(self):
        return list(self.rows)


class _FakeDb:
    def __init__(self, *, batch, batch_lines, stock=None, remaining_pairs=None):
        self.batch = batch
        self.batch_lines = batch_lines
        self.stock = stock or []
        self.remaining_pairs = remaining_pairs or []
        self.added = []

    def query(self, *models):
        if len(models) == 2:
            return _Query(self.remaining_pairs)
        name = getattr(models[0], "__name__", "")
        if name == "ProcOrderReceiptBatch":
            return _Query([self.batch])
        if name == "ProcOrderReceiptBatchLine":
            return _Query(self.batch_lines)
        if name == "ProcInventoryStockUnit":
            return _Query(self.stock)
        return _Query([])

    def add(self, obj):
        self.added.append(obj)

    def flush(self):
        pass


def _ctx(tenant_id, user_id):
    return SimpleNamespace(tenant_id=tenant_id, user_id=user_id)


def _line(*, line_id, qty, received, unit_cost=10, billing_qty=0):
    return SimpleNamespace(
        id=line_id,
        is_deleted=False,
        quantity=qty,
        quantity_received=received,
        unit_cost=unit_cost,
        status="received" if received >= qty else "partially_received",
        line_number=1,
        product_name="Switch",
        last_receipt_qty=received,
        last_receipt_at=datetime.now(timezone.utc),
        last_receipt_batch_id=None,
        last_receipt_serial_numbers=["S1"],
        last_receipt_billing=billing_qty > 0,
        last_receipt_billing_quantity=billing_qty,
        updated_by=None,
        updated_at=None,
    )


def _make_reverse_service(*, order, batch, batch_lines, stock=None, remaining_pairs=None):
    svc = ScmHandoffService.__new__(ScmHandoffService)
    svc._db = _FakeDb(
        batch=batch,
        batch_lines=batch_lines,
        stock=stock,
        remaining_pairs=remaining_pairs,
    )
    svc._receipt_batch_tables_exist = lambda: True
    svc._inventory_stock_table_exists = lambda: True
    svc._inventory_adjustment_table_exists = lambda: True
    svc._inventory_stock_has_quantity = lambda: True
    svc._orders = SimpleNamespace(get_order_for_update=lambda _ctx, _oid: order)
    svc._scope = SimpleNamespace(
        validate_company_access=lambda *_a, **_k: None,
        validate_branch_access=lambda *_a, **_k: None,
    )
    svc._audit = SimpleNamespace(log_entity_change=lambda **_k: None)
    svc._receipt_batch_attachment_summaries = lambda *_a, **_k: {}
    svc._latest_active_receipt_batch = lambda *_a, **_k: None
    return svc


def test_reverse_receipt_batch_rolls_back_qty_and_reopens_po():
    tenant_id = uuid4()
    user_id = uuid4()
    order_id = uuid4()
    line_id = uuid4()
    batch_id = uuid4()
    line = _line(line_id=line_id, qty=10, received=10, billing_qty=4)
    order = SimpleNamespace(
        id=order_id,
        tenant_id=tenant_id,
        company_id=uuid4(),
        branch_id=uuid4(),
        status=OrderStatus.RECEIVED.value,
        received_amount=100,
        lines=[line],
        current_receipt_batch_id=batch_id,
        current_receipt_batch_at=datetime.now(timezone.utc),
        current_grn_number="PO-1/001",
        updated_by=None,
        updated_at=None,
    )
    batch = SimpleNamespace(
        id=batch_id,
        order_header_id=order_id,
        tenant_id=tenant_id,
        sequence=1,
        grn_number="PO-1/001",
        receipt_at=datetime.now(timezone.utc),
        reversal_status="posted",
        reversed_at=None,
        reversed_by=None,
        reversal_reason=None,
        vendor_invoice_number="INV-1",
        vendor_invoice_date=None,
        vendor_invoice_quantity=4,
        vendor_invoice_subtotal=40,
        updated_by=None,
        updated_at=None,
        is_deleted=False,
    )
    batch_line = SimpleNamespace(
        order_line_id=line_id,
        quantity=10,
        is_deleted=False,
        serial_numbers=["S1"],
        billing=True,
        billing_quantity=4,
    )
    svc = _make_reverse_service(order=order, batch=batch, batch_lines=[batch_line])
    payload = svc.reverse_receipt_batch(
        _ctx(tenant_id, user_id),
        batch_id,
        reason="Wrong GRN posted",
    )

    assert line.quantity_received == 0.0
    assert line.status == "open"
    assert order.status == OrderStatus.SENT.value
    assert order.received_amount == 0.0
    assert order.current_receipt_batch_id is None
    assert order.current_receipt_batch_at is None
    assert batch.reversal_status == "reversed"
    assert batch.reversed_by == user_id
    assert batch.reversal_reason == "Wrong GRN posted"
    assert payload["reversed"] is True
    assert payload["reversal_reason"] == "Wrong GRN posted"


def test_reverse_receipt_batch_partial_leaves_remaining_receipt():
    tenant_id = uuid4()
    user_id = uuid4()
    order_id = uuid4()
    line_id = uuid4()
    batch_id = uuid4()
    line = _line(line_id=line_id, qty=10, received=10)
    line.status = "received"
    order = SimpleNamespace(
        id=order_id,
        tenant_id=tenant_id,
        company_id=uuid4(),
        branch_id=uuid4(),
        status=OrderStatus.RECEIVED.value,
        received_amount=100,
        lines=[line],
        current_receipt_batch_id=batch_id,
        current_receipt_batch_at=datetime.now(timezone.utc),
        current_grn_number="PO-1/002",
        updated_by=None,
        updated_at=None,
    )
    batch = SimpleNamespace(
        id=batch_id,
        order_header_id=order_id,
        tenant_id=tenant_id,
        sequence=2,
        grn_number="PO-1/002",
        receipt_at=datetime.now(timezone.utc),
        reversal_status="posted",
        reversed_at=None,
        reversed_by=None,
        reversal_reason=None,
        vendor_invoice_number=None,
        vendor_invoice_date=None,
        vendor_invoice_quantity=None,
        vendor_invoice_subtotal=None,
        updated_by=None,
        updated_at=None,
        is_deleted=False,
    )
    batch_line = SimpleNamespace(
        order_line_id=line_id,
        quantity=4,
        is_deleted=False,
        serial_numbers=[],
        billing=False,
        billing_quantity=0,
    )
    remaining_batch = SimpleNamespace(
        id=uuid4(),
        sequence=1,
        receipt_at=datetime.now(timezone.utc),
        grn_number="PO-1/001",
    )
    remaining_line = SimpleNamespace(
        order_line_id=line_id,
        quantity=6,
        serial_numbers=["KEEP"],
        billing=True,
        billing_quantity=2,
    )
    svc = _make_reverse_service(
        order=order,
        batch=batch,
        batch_lines=[batch_line],
        remaining_pairs=[(remaining_line, remaining_batch)],
    )
    svc._latest_active_receipt_batch = lambda *_a, **_k: remaining_batch
    svc.reverse_receipt_batch(_ctx(tenant_id, user_id), batch_id, reason="Correct second GRN")

    assert line.quantity_received == 6.0
    assert line.status == "partially_received"
    assert order.status == OrderStatus.PARTIALLY_RECEIVED.value
    assert order.current_receipt_batch_id == remaining_batch.id
    assert order.current_receipt_batch_at is None
    assert order.current_grn_number == "PO-1/001"
    assert line.last_receipt_qty == 6.0
    assert line.last_receipt_batch_id == remaining_batch.id
    assert line.last_receipt_billing_quantity == 2.0
    assert line.last_receipt_serial_numbers == ["KEEP"]


def test_reverse_receipt_batch_rejects_duplicate_and_empty_reason():
    tenant_id = uuid4()
    batch_id = uuid4()
    order = SimpleNamespace(
        id=uuid4(),
        tenant_id=tenant_id,
        company_id=uuid4(),
        branch_id=uuid4(),
        status=OrderStatus.RECEIVED.value,
        lines=[],
    )
    batch = SimpleNamespace(
        id=batch_id,
        order_header_id=order.id,
        tenant_id=tenant_id,
        reversal_status="reversed",
        is_deleted=False,
    )
    svc = _make_reverse_service(order=order, batch=batch, batch_lines=[])
    ctx = _ctx(tenant_id, uuid4())
    with pytest.raises(ConflictException, match="reason is required"):
        svc.reverse_receipt_batch(ctx, batch_id, reason="  ")
    with pytest.raises(ConflictException, match="already been reversed"):
        svc.reverse_receipt_batch(ctx, batch_id, reason="try again")


def test_apply_inventory_reversal_soft_deletes_on_hand_and_ledgers_consumed():
    tenant_id = uuid4()
    user_id = uuid4()
    now = datetime.now(timezone.utc)
    on_hand = SimpleNamespace(
        id=uuid4(),
        is_deleted=False,
        quantity=1.0,
        order_line_id=uuid4(),
        product_name="Switch",
        grn_number="PO-1/001",
        serial_number="ONHAND",
        unit_index=1,
        deleted_at=None,
        deleted_by=None,
        updated_by=None,
        updated_at=None,
    )
    consumed = SimpleNamespace(
        id=uuid4(),
        is_deleted=True,
        quantity=1.0,
        order_line_id=uuid4(),
        product_name="Switch",
        grn_number="PO-1/001",
        serial_number="USED",
        unit_index=2,
        deleted_at=now,
        deleted_by=user_id,
        updated_by=None,
        updated_at=None,
    )
    order = SimpleNamespace(
        id=uuid4(),
        tenant_id=tenant_id,
        company_id=uuid4(),
        branch_id=uuid4(),
    )
    batch = SimpleNamespace(id=uuid4())
    svc = _make_reverse_service(order=order, batch=batch, batch_lines=[], stock=[on_hand, consumed])
    svc._apply_inventory_reversal(
        _ctx(tenant_id, user_id),
        order=order,
        batch=batch,
        reason="Units already issued",
        now=now,
    )

    assert on_hand.is_deleted is True
    assert on_hand.deleted_by == user_id
    assert len(svc._db.added) == 1
    adj = svc._db.added[0]
    assert adj.quantity == -1.0
    assert adj.serial_number == "USED"
    assert adj.reason == "Units already issued"
    assert adj.stock_unit_id == consumed.id


def test_batch_reversal_fields_payload():
    posted = SimpleNamespace(
        reversal_status="posted",
        reversed_at=None,
        reversed_by=None,
        reversal_reason=None,
    )
    fields = ScmHandoffService._batch_reversal_fields(posted)
    assert fields["reversed"] is False
    reversed_at = datetime.now(timezone.utc)
    user_id = uuid4()
    reversed_batch = SimpleNamespace(
        reversal_status="reversed",
        reversed_at=reversed_at,
        reversed_by=user_id,
        reversal_reason="Duplicate GRN",
    )
    fields = ScmHandoffService._batch_reversal_fields(reversed_batch)
    assert fields["reversed"] is True
    assert fields["reversal_reason"] == "Duplicate GRN"
    assert fields["reversed_by"] == user_id
