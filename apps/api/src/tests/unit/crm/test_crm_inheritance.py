"""CRM sales-stage field inheritance tests."""

from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

from modules.crm.service.ovf_service import OvfService
from modules.crm.service.quote_service import QuoteService


def test_quote_inherits_customer_and_lead_details() -> None:
    service = QuoteService(MagicMock())
    ctx = MagicMock()
    opportunity = SimpleNamespace(
        id=uuid4(),
        company_id=uuid4(),
        branch_id=uuid4(),
        lead_id=uuid4(),
        company_account_id=uuid4(),
        blueprint_state="quote_in_progress",
        oem_quote_attached=True,
        locked=False,
        project_title="Data-centre refresh",
        opportunity_name="Fallback opportunity",
        owner_employee_id=uuid4(),
    )
    lead = SimpleNamespace(
        entity_name="Calipers Entity",
        entity_email="entity@example.com",
        entity_address="Entity address",
        entity_gst="GST-1",
        entity_contact="+91-90000-00000",
        country="India",
        notes="Inherited requirement notes",
        product_type="Hardware",
    )
    account = SimpleNamespace(
        customer_name="Calipers Consulting",
        customer_email="customer@example.com",
        phone="+91-91111-11111",
        billing_street="Street",
        billing_city="Mumbai",
        billing_state="Maharashtra",
        billing_code="400070",
        billing_country="India",
        shipping_country="India",
        description="Company description",
    )
    contact = SimpleNamespace(id=uuid4(), is_primary=True)
    created = SimpleNamespace(id=uuid4())
    service._opportunities.get = MagicMock(return_value=opportunity)
    service._leads.get = MagicMock(return_value=lead)
    service._companies.get = MagicMock(return_value=account)
    service._contacts.list_contacts = MagicMock(return_value=[contact])
    service._employees.get_employee = MagicMock(
        return_value=SimpleNamespace(first_name="Ada", last_name="Lovelace")
    )
    service._numbers.generate = MagicMock(return_value="QUO2026-00001")
    service._repo.create = MagicMock(return_value=created)

    result = service.create(
        ctx,
        opportunity_id=opportunity.id,
        branch_id=uuid4(),
        subject=None,
        project_title=None,
        account_name=None,
        service_type=None,
        owner_name=None,
        contact_id=None,
        entity_name=None,
        entity_email=None,
        entity_address=None,
        entity_gst=None,
        entity_contact=None,
        billing_country=None,
        shipping_country=None,
        description=None,
    )

    assert result is created
    fields = service._repo.create.call_args.kwargs
    assert fields["branch_id"] == opportunity.branch_id
    assert fields["subject"] == "Data-centre refresh"
    assert fields["project_title"] == "Data-centre refresh"
    assert fields["account_name"] == "Calipers Consulting"
    assert fields["service_type"] == "hardware"
    assert fields["owner_name"] == "Ada Lovelace"
    assert fields["contact_id"] == contact.id
    assert fields["entity_name"] == "Calipers Entity"
    assert fields["entity_email"] == "entity@example.com"
    assert fields["entity_address"] == "Entity address"
    assert fields["entity_gst"] == "GST-1"
    assert fields["entity_contact"] == "+91-90000-00000"
    assert fields["billing_country"] == "India"
    assert fields["shipping_country"] == "India"
    assert fields["description"] == "Inherited requirement notes"


def test_ovf_inherits_quote_totals_and_lines(monkeypatch) -> None:
    service = OvfService(MagicMock())
    ctx = MagicMock()
    opportunity = SimpleNamespace(
        id=uuid4(),
        company_id=uuid4(),
        branch_id=uuid4(),
        company_account_id=uuid4(),
        blueprint_state="ovf_ready",
        customer_po_approved=True,
        locked=False,
        owner_employee_id=None,
    )
    quote = SimpleNamespace(
        id=uuid4(),
        opportunity_id=opportunity.id,
        quote_stage="accepted",
        entity_name="Acme India",
        entity_address="1 Business Park",
        entity_contact="Priya Shah",
        subject="Infrastructure Refresh",
        project_title=None,
        account_name=None,
        owner_name=None,
        billing_country="India",
        shipping_country="India",
        freight=Decimal("250"),
        avg_margin_pct=Decimal("12.5"),
        total_margin_amount=Decimal("5000"),
    )
    quote_line = SimpleNamespace(
        line_no=1,
        product_name="Server",
        qty=Decimal("2"),
        unit_sell=Decimal("1000"),
        unit_cost=Decimal("800"),
    )
    created = SimpleNamespace(id=uuid4())
    service._quotes.get = MagicMock(return_value=quote)
    service._companies.get = MagicMock(return_value=None)
    service._opportunities.get = MagicMock(return_value=opportunity)
    service._quote_lines.list_for_quote = MagicMock(return_value=[quote_line])
    service._numbers.generate = MagicMock(return_value="OVF2026-00001")
    service._repo.create = MagicMock(return_value=created)
    service._repo.list_ovfs = MagicMock(return_value=[])
    service._lines.create = MagicMock()
    service._opportunities.update = MagicMock()
    monkeypatch.setattr("modules.crm.service.ovf_service.log_state_history", MagicMock())

    result = service.create(
        ctx,
        quote_id=quote.id,
        branch_id=uuid4(),
        freight=Decimal("0"),
        vendor_payment_days=0,
        customer_payment_days=0,
    )

    assert result is created
    fields = service._repo.create.call_args.kwargs
    assert fields["branch_id"] == opportunity.branch_id
    assert fields["freight"] == Decimal("250")
    assert fields["total_margin_pct"] == Decimal("12.5")
    assert fields["total_margin_amount"] == Decimal("5000")
    assert fields["customer_name"] == "Acme India"
    assert fields["quote_name"] == "Infrastructure Refresh"
    assert fields["billing_address"] == "1 Business Park"
    assert fields["billing_contact_person"] == "Priya Shah"
    assert service._lines.create.call_count == 2
    customer_line, vendor_line = service._lines.create.call_args_list
    assert customer_line.kwargs["side"] == "customer_po"
    assert customer_line.kwargs["unit_price"] == Decimal("1000")
    assert vendor_line.kwargs["side"] == "vendor"
    assert vendor_line.kwargs["unit_price"] == Decimal("800")
