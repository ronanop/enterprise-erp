"""P2P domain invariants - code prefixes and invoice postable state."""


import pytest

from modules.procurement.domain.enums import CODE_PREFIXES, ProcEntityType
from modules.procurement.domain.exceptions import InvalidDocumentState
from modules.procurement.service.engines.invoice_engine import InvoiceEngine


class _ILine:
    def __init__(self):
        self.quantity = 1
        self.unit_cost = 100
        self.tax_rate = 0
        self.tax_amount = 0
        self.line_total = 100
        self.is_deleted = False


class _Invoice:
    def __init__(self, status, lines=None):
        self.status = status
        self.lines = lines if lines is not None else [_ILine()]
        self.total_amount = 100
        self.amount_paid = 0
        self.balance_due = 100


def test_code_prefixes_cover_p2p_documents() -> None:
    for entity in (
        ProcEntityType.REQUISITION,
        ProcEntityType.RFQ,
        ProcEntityType.ORDER,
        ProcEntityType.GRN,
        ProcEntityType.INVOICE,
        ProcEntityType.RETURN,
    ):
        prefix, width = CODE_PREFIXES[entity]
        assert prefix.endswith("-")
        assert width >= 4


def test_invoice_postable_from_submitted() -> None:
    engine = InvoiceEngine()
    invoice = _Invoice("submitted")
    engine.validate_postable(invoice)


def test_invoice_not_postable_when_posted() -> None:
    engine = InvoiceEngine()
    invoice = _Invoice("posted")
    with pytest.raises(InvalidDocumentState):
        engine.validate_postable(invoice)


def test_invoice_balance_due_refresh() -> None:
    engine = InvoiceEngine()
    invoice = _Invoice("posted")
    invoice.amount_paid = 40
    engine.refresh_balance_due(invoice)
    assert invoice.balance_due == 60.0
    assert invoice.status == "partially_paid"
