"""Unit tests — Excel import schemas & domain constants (CR-004 Phase 8B)."""

from __future__ import annotations

from decimal import Decimal
from uuid import uuid4

import pytest
from pydantic import ValidationError

from modules.asset.domain.excel_import import (
    DEFAULT_IMPORT_BATCH_SIZE,
    MAX_IMPORT_BATCH_SIZE,
    VALID_IMPORT_OPERATIONAL_STATUSES,
    ExcelImportSkipReason,
)
from modules.asset.schemas import (
    AssetExcelImportDefaults,
    AssetExcelImportRequest,
    AssetExcelImportRow,
    AssetExcelImportSummaryResponse,
)


def test_default_batch_size() -> None:
    assert DEFAULT_IMPORT_BATCH_SIZE == 50
    assert MAX_IMPORT_BATCH_SIZE == 500


def test_valid_ops_statuses() -> None:
    assert "READY_TO_MOVE" in VALID_IMPORT_OPERATIONAL_STATUSES
    assert "DISPOSED" in VALID_IMPORT_OPERATIONAL_STATUSES
    assert len(VALID_IMPORT_OPERATIONAL_STATUSES) == 5


def test_skip_reasons() -> None:
    assert ExcelImportSkipReason.DUPLICATE_ASSET_TAG.value == "duplicate_asset_tag"
    assert ExcelImportSkipReason.BATCH_ROLLED_BACK.value == "batch_rolled_back"


def test_import_row_schema_requires_tag() -> None:
    with pytest.raises(ValidationError):
        AssetExcelImportRow(
            row_number=1,
            preview_status="valid",
            asset_tag="",
            asset_name="x",
            branch_id=uuid4(),
            operational_status="READY_TO_MOVE",
        )


def test_import_request_defaults() -> None:
    body = AssetExcelImportRequest(
        defaults=AssetExcelImportDefaults(asset_category_id=uuid4()),
        rows=[
            AssetExcelImportRow(
                row_number=2,
                preview_status="valid",
                asset_tag="A1",
                asset_name="N",
                branch_id=uuid4(),
                operational_status="READY_TO_MOVE",
            )
        ],
    )
    assert body.batch_size == 50
    assert body.confirm_warnings is False
    assert body.defaults.purchase_cost == Decimal("0")


def test_import_request_batch_bounds() -> None:
    with pytest.raises(ValidationError):
        AssetExcelImportRequest(
            batch_size=0,
            defaults=AssetExcelImportDefaults(asset_category_id=uuid4()),
            rows=[],
        )


def test_summary_response_shape() -> None:
    payload = AssetExcelImportSummaryResponse(
        total_rows=10,
        imported=7,
        skipped=1,
        duplicates=1,
        warnings=1,
        failed=1,
        duration_ms=12,
        batch_count=1,
        rows=[],
    )
    assert payload.imported == 7


def test_row_number_must_be_positive() -> None:
    with pytest.raises(ValidationError):
        AssetExcelImportRow(
            row_number=0,
            preview_status="valid",
            asset_tag="A",
            asset_name="N",
            branch_id=uuid4(),
            operational_status="READY_TO_MOVE",
        )
