"""Sub-phase 4D — delivery challan signature enrichment tests."""

import pytest

from modules.asset.domain import assignment_enrichment as enrich
from modules.asset.domain.exceptions import AssignmentValidationError
from modules.asset.schemas import AssetAssignmentCreate, AssetAssignmentResponse, AssetAssignmentUpdate
from uuid import uuid4
from datetime import datetime


def test_signature_defaults_to_not_signed() -> None:
    assert enrich.validate_delivery_challan_signature_status(None) == "not_signed"
    assert enrich.validate_delivery_challan_signature_status("") == "not_signed"


def test_signature_accepts_signed_and_not_signed() -> None:
    assert enrich.validate_delivery_challan_signature_status("signed") == "signed"
    assert enrich.validate_delivery_challan_signature_status("NOT_SIGNED") == "not_signed"


def test_signature_rejects_invalid() -> None:
    with pytest.raises(AssignmentValidationError, match="delivery_challan_signature_status"):
        enrich.validate_delivery_challan_signature_status("partial")


def test_draft_enrichment_includes_signature() -> None:
    result = enrich.validate_draft_enrichment_fields(
        delivery_reference_number="DC-1",
        delivery_reference_status="issued",
        delivery_challan_signature_status="signed",
        assignment_remarks="ok",
    )
    assert result["delivery_challan_signature_status"] == "signed"
    assert result["delivery_reference_status"] == "issued"


def test_received_status_still_valid() -> None:
    number, status = enrich.validate_delivery_reference_pair(
        number="DC-OLD", status="received"
    )
    assert number == "DC-OLD"
    assert status == "received"


def test_create_schema_accepts_signature() -> None:
    body = AssetAssignmentCreate(
        branch_id=uuid4(),
        asset_id=uuid4(),
        allocation_type="employee",
        delivery_reference_number="DC-2026-001",
        delivery_reference_status="issued",
        delivery_challan_signature_status="signed",
    )
    assert body.delivery_challan_signature_status == "signed"


def test_create_schema_omits_signature_ok() -> None:
    body = AssetAssignmentCreate(
        branch_id=uuid4(),
        asset_id=uuid4(),
        allocation_type="employee",
        delivery_reference_status="pending",
    )
    assert body.delivery_challan_signature_status is None


def test_update_schema_accepts_signature() -> None:
    body = AssetAssignmentUpdate(version=1, delivery_challan_signature_status="not_signed")
    assert body.delivery_challan_signature_status == "not_signed"


def test_response_defaults_signature_for_legacy() -> None:
    dto = AssetAssignmentResponse(
        id=uuid4(),
        document_number="ASN-1",
        asset_id=uuid4(),
        allocation_type="employee",
        employee_id=None,
        department_id=None,
        project_id=None,
        allocated_at=None,
        expected_return_at=None,
        returned_at=None,
        status="draft",
        delivery_reference_number=None,
        delivery_reference_status="pending",
        workflow_status=None,
        workflow_instance_id=None,
        company_id=uuid4(),
        branch_id=uuid4(),
        version=1,
    )
    assert dto.delivery_challan_signature_status == "not_signed"


def test_response_coerces_null_signature_from_orm() -> None:
    dto = AssetAssignmentResponse.model_validate(
        {
            "id": uuid4(),
            "document_number": "ASN-2",
            "asset_id": uuid4(),
            "allocation_type": "employee",
            "employee_id": None,
            "department_id": None,
            "project_id": None,
            "allocated_at": None,
            "expected_return_at": None,
            "returned_at": None,
            "status": "active",
            "delivery_reference_number": "DC-LEGACY",
            "delivery_reference_status": "received",
            "delivery_challan_signature_status": None,
            "workflow_status": None,
            "workflow_instance_id": None,
            "company_id": uuid4(),
            "branch_id": uuid4(),
            "version": 1,
        }
    )
    assert dto.delivery_challan_signature_status == "not_signed"
    assert dto.delivery_reference_status == "received"


def test_signed_pending_combination_allowed() -> None:
    result = enrich.validate_draft_enrichment_fields(
        delivery_reference_number=None,
        delivery_reference_status="pending",
        delivery_challan_signature_status="signed",
    )
    assert result["delivery_reference_status"] == "pending"
    assert result["delivery_challan_signature_status"] == "signed"
