"""Unit tests for DisposalApprovalNotifier helpers."""

from types import SimpleNamespace
from uuid import uuid4

from modules.asset.service.disposal_approval_notifier import (
    build_ceo_approval_email_payload,
    render_ceo_approval_email_body,
)


def test_ceo_email_payload_contains_required_business_fields() -> None:
    asset = SimpleNamespace(
        asset_code="AST-1",
        asset_name="Laptop",
        serial_number="SN1",
        make="Dell",
        model="XPS",
        custodian_employee_id=uuid4(),
        department_id=uuid4(),
        branch_id=uuid4(),
        current_location_label="Store A",
    )
    disposal = SimpleNamespace(
        id=uuid4(),
        document_number="ADISP-1",
        remarks="End of life scrap",
        created_at="2026-09-17",
    )
    payload = build_ceo_approval_email_payload(
        asset=asset,
        disposal=disposal,
        requested_by_label="IT Admin",
        approval_url="http://localhost:3000/assets/asset-disposals?id=1",
    )
    assert payload["subject"] == "Asset Disposal Approval Required - AST-1"
    assert payload["disposal_type"] == "Scrap"
    assert payload["reason"] == "End of life scrap"
    body = render_ceo_approval_email_body(payload)
    assert "CEO approval is required" in body
    assert "AST-1" in body
    assert "End of life scrap" in body
