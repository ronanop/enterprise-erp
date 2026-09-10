"""Unit tests for quality Pydantic schemas."""

from decimal import Decimal
from uuid import uuid4

import pytest
from pydantic import ValidationError

from modules.quality.schemas import (
    DefectCreateRequest,
    IncomingInspectionCreateRequest,
    PpapCreateRequest,
    ScarCreateRequest,
    SpcReadingCreateRequest,
    VinTraceCreateRequest,
    WarrantyClaimCreateRequest,
    RecallCreateRequest,
)


def test_incoming_create_rejects_negative_qty():
    with pytest.raises(ValidationError, match="Quantity cannot be negative"):
        IncomingInspectionCreateRequest(
            company_id=uuid4(),
            branch_id=uuid4(),
            warehouse_id=uuid4(),
            product_id=uuid4(),
            uom_id=uuid4(),
            inspected_qty=6,
            accepted_qty=-10,
            rejected_qty=-16,
        )


def test_incoming_create_rejects_over_allocation():
    with pytest.raises(ValidationError, match="cannot exceed inspected"):
        IncomingInspectionCreateRequest(
            company_id=uuid4(),
            branch_id=uuid4(),
            warehouse_id=uuid4(),
            product_id=uuid4(),
            uom_id=uuid4(),
            inspected_qty=Decimal("10"),
            accepted_qty=Decimal("6"),
            rejected_qty=Decimal("6"),
        )


def test_defect_create_rejects_negative_quantity():
    with pytest.raises(ValidationError, match="Quantity cannot be negative"):
        DefectCreateRequest(
            company_id=uuid4(),
            branch_id=uuid4(),
            defect_type_id=uuid4(),
            quantity=-1,
        )


def test_ppap_create_rejects_invalid_level():
    with pytest.raises(ValidationError, match="submission_level"):
        PpapCreateRequest(
            company_id=uuid4(),
            branch_id=uuid4(),
            vendor_id=uuid4(),
            product_id=uuid4(),
            submission_level="6",
            inspection_plan_id=uuid4(),
        )


def test_spc_reading_rejects_invalid_source_type():
    with pytest.raises(ValidationError, match="source_inspection_type"):
        SpcReadingCreateRequest(
            company_id=uuid4(),
            branch_id=uuid4(),
            characteristic_id=uuid4(),
            measured_value=Decimal("10"),
            source_inspection_type="spc",
        )


def test_scar_create_rejects_invalid_severity():
    with pytest.raises(ValidationError, match="severity"):
        ScarCreateRequest(
            company_id=uuid4(),
            branch_id=uuid4(),
            vendor_id=uuid4(),
            severity="urgent",
        )


def test_vin_trace_rejects_short_vin():
    with pytest.raises(ValidationError, match="17"):
        VinTraceCreateRequest(
            company_id=uuid4(),
            branch_id=uuid4(),
            vin="SHORT",
            product_id=uuid4(),
        )


def test_warranty_claim_rejects_invalid_type():
    with pytest.raises(ValidationError, match="claim_type"):
        WarrantyClaimCreateRequest(
            company_id=uuid4(),
            branch_id=uuid4(),
            vin_trace_id=uuid4(),
            claim_type="kpi_complaint",
        )


def test_recall_rejects_inverted_vin_range():
    with pytest.raises(ValidationError, match="vin_from"):
        RecallCreateRequest(
            company_id=uuid4(),
            branch_id=uuid4(),
            product_id=uuid4(),
            vin_from="1HGCM82633A004999",
            vin_to="1HGCM82633A004001",
        )
