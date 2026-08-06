"""Unit tests — AssetExcelImportService batching & summary (CR-004 Phase 8B)."""

from __future__ import annotations

from decimal import Decimal
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from modules.asset.domain.excel_import import (
    DEFAULT_IMPORT_BATCH_SIZE,
    ExcelImportDefaults,
    ExcelImportRowInput,
    ExcelImportRowOutcome,
    ExcelImportRowResult,
    ExcelImportSkipReason,
)
from modules.asset.service.asset_excel_import_service import AssetExcelImportService
from modules.foundation.domain.value_objects import TenantContext


def _ctx() -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )


def _defaults() -> ExcelImportDefaults:
    return ExcelImportDefaults(asset_category_id=uuid4(), purchase_cost=Decimal("0"))


def _row(n: int, **kwargs) -> ExcelImportRowInput:
    data = dict(
        row_number=n,
        preview_status="valid",
        asset_tag=f"AST-{n}",
        asset_name=f"Asset {n}",
        branch_id=uuid4(),
        operational_status="READY_TO_MOVE",
    )
    data.update(kwargs)
    return ExcelImportRowInput(**data)


def _service_with_engine(engine: MagicMock | None = None):
    db = MagicMock()
    nested = MagicMock()
    db.begin_nested.return_value = nested
    eng = engine or MagicMock()
    svc = AssetExcelImportService(db, engine=eng)
    return svc, db, eng, nested


def test_empty_rows_summary() -> None:
    svc, db, eng, _ = _service_with_engine()
    summary = svc.import_rows(_ctx(), [], defaults=_defaults())
    assert summary.total_rows == 0
    assert summary.imported == 0
    assert summary.batch_count == 0
    eng.import_row.assert_not_called()
    db.commit.assert_not_called()


def test_single_row_imported() -> None:
    svc, db, eng, nested = _service_with_engine()
    eng.import_row.return_value = ExcelImportRowResult(
        row_number=1,
        outcome=ExcelImportRowOutcome.IMPORTED.value,
        asset_id=uuid4(),
        operational_status="READY_TO_MOVE",
    )
    summary = svc.import_rows(_ctx(), [_row(1)], defaults=_defaults())
    assert summary.imported == 1
    assert summary.batch_count == 1
    nested.commit.assert_called_once()
    db.commit.assert_called_once()


def test_skipped_and_duplicate_counts() -> None:
    svc, _, eng, nested = _service_with_engine()
    eng.import_row.side_effect = [
        ExcelImportRowResult(
            row_number=1,
            outcome=ExcelImportRowOutcome.SKIPPED.value,
            reason=ExcelImportSkipReason.INVALID_PREVIEW.value,
        ),
        ExcelImportRowResult(
            row_number=2,
            outcome=ExcelImportRowOutcome.DUPLICATE.value,
            reason=ExcelImportSkipReason.DUPLICATE_ASSET_TAG.value,
        ),
        ExcelImportRowResult(
            row_number=3,
            outcome=ExcelImportRowOutcome.IMPORTED.value,
        ),
    ]
    summary = svc.import_rows(
        _ctx(),
        [_row(1), _row(2), _row(3)],
        defaults=_defaults(),
        batch_size=50,
    )
    assert summary.imported == 1
    assert summary.duplicates == 1
    assert summary.skipped == 2
    assert nested.commit.call_count >= 1


def test_failed_row_rolls_back_savepoint_continues() -> None:
    svc, db, eng, nested = _service_with_engine()
    eng.import_row.side_effect = [
        ExcelImportRowResult(row_number=1, outcome=ExcelImportRowOutcome.FAILED.value, reason="x"),
        ExcelImportRowResult(row_number=2, outcome=ExcelImportRowOutcome.IMPORTED.value),
    ]
    summary = svc.import_rows(_ctx(), [_row(1), _row(2)], defaults=_defaults())
    assert summary.failed == 1
    assert summary.imported == 1
    assert nested.rollback.call_count >= 1
    nested.commit.assert_called()
    db.commit.assert_called_once()


def test_batch_commit_failure_marks_batch_failed() -> None:
    svc, db, eng, nested = _service_with_engine()
    eng.import_row.return_value = ExcelImportRowResult(
        row_number=1, outcome=ExcelImportRowOutcome.IMPORTED.value
    )
    db.commit.side_effect = RuntimeError("db down")
    summary = svc.import_rows(_ctx(), [_row(1), _row(2)], defaults=_defaults(), batch_size=50)
    assert summary.failed == 2
    assert summary.imported == 0
    db.rollback.assert_called()
    assert all(
        ExcelImportSkipReason.BATCH_ROLLED_BACK.value in (r.reason or "") for r in summary.rows
    )


def test_batch_size_splits() -> None:
    svc, db, eng, _ = _service_with_engine()
    eng.import_row.side_effect = [
        ExcelImportRowResult(row_number=i, outcome=ExcelImportRowOutcome.IMPORTED.value)
        for i in range(1, 6)
    ]
    summary = svc.import_rows(
        _ctx(),
        [_row(i) for i in range(1, 6)],
        defaults=_defaults(),
        batch_size=2,
    )
    assert summary.batch_count == 3
    assert summary.imported == 5
    assert db.commit.call_count == 3


def test_default_batch_size_constant() -> None:
    assert DEFAULT_IMPORT_BATCH_SIZE == 50


def test_normalize_batch_size_floor() -> None:
    assert AssetExcelImportService._normalize_batch_size(0) == DEFAULT_IMPORT_BATCH_SIZE
    assert AssetExcelImportService._normalize_batch_size(-1) == DEFAULT_IMPORT_BATCH_SIZE


def test_normalize_batch_size_cap() -> None:
    assert AssetExcelImportService._normalize_batch_size(9999) == 500


def test_warning_flag_increments_warnings() -> None:
    svc, _, eng, _ = _service_with_engine()
    eng.import_row.return_value = ExcelImportRowResult(
        row_number=1,
        outcome=ExcelImportRowOutcome.IMPORTED.value,
        warning=True,
    )
    summary = svc.import_rows(_ctx(), [_row(1)], defaults=_defaults(), confirm_warnings=True)
    assert summary.warnings == 1
    assert summary.imported == 1


def test_engine_exception_in_row_becomes_failed() -> None:
    svc, _, eng, nested = _service_with_engine()
    eng.import_row.side_effect = RuntimeError("unexpected")
    summary = svc.import_rows(_ctx(), [_row(1)], defaults=_defaults())
    assert summary.failed == 1
    nested.rollback.assert_called()


def test_duration_and_row_results_present() -> None:
    svc, _, eng, _ = _service_with_engine()
    eng.import_row.return_value = ExcelImportRowResult(
        row_number=7, outcome=ExcelImportRowOutcome.IMPORTED.value
    )
    summary = svc.import_rows(_ctx(), [_row(7)], defaults=_defaults())
    assert summary.duration_ms >= 0
    assert len(summary.rows) == 1
    assert summary.rows[0].row_number == 7


def test_confirm_warnings_forwarded() -> None:
    svc, _, eng, _ = _service_with_engine()
    eng.import_row.return_value = ExcelImportRowResult(
        row_number=1, outcome=ExcelImportRowOutcome.SKIPPED.value
    )
    svc.import_rows(
        _ctx(),
        [_row(1)],
        defaults=_defaults(),
        confirm_warnings=True,
    )
    assert eng.import_row.call_args.kwargs["confirm_warnings"] is True


def test_company_id_forwarded() -> None:
    svc, _, eng, _ = _service_with_engine()
    cid = uuid4()
    eng.import_row.return_value = ExcelImportRowResult(
        row_number=1, outcome=ExcelImportRowOutcome.IMPORTED.value
    )
    svc.import_rows(_ctx(), [_row(1)], defaults=_defaults(), company_id=cid)
    assert eng.import_row.call_args.kwargs["company_id"] == cid


def test_partial_failures_across_batches() -> None:
    svc, db, eng, _ = _service_with_engine()

    def _side(ctx, row, **kwargs):
        if row.row_number == 2:
            return ExcelImportRowResult(
                row_number=2, outcome=ExcelImportRowOutcome.FAILED.value, reason="bad"
            )
        return ExcelImportRowResult(
            row_number=row.row_number, outcome=ExcelImportRowOutcome.IMPORTED.value
        )

    eng.import_row.side_effect = _side
    summary = svc.import_rows(
        _ctx(),
        [_row(1), _row(2), _row(3)],
        defaults=_defaults(),
        batch_size=2,
    )
    assert summary.imported == 2
    assert summary.failed == 1
    assert db.commit.call_count == 2


@pytest.mark.parametrize(
    "outcome,imported,skipped,duplicates,failed",
    [
        (ExcelImportRowOutcome.IMPORTED.value, 1, 0, 0, 0),
        (ExcelImportRowOutcome.SKIPPED.value, 0, 1, 0, 0),
        (ExcelImportRowOutcome.DUPLICATE.value, 0, 1, 1, 0),
        (ExcelImportRowOutcome.FAILED.value, 0, 0, 0, 1),
    ],
)
def test_accumulate_matrix(outcome, imported, skipped, duplicates, failed) -> None:
    from modules.asset.domain.excel_import import ExcelImportSummary

    summary = ExcelImportSummary()
    AssetExcelImportService._accumulate(
        summary,
        ExcelImportRowResult(row_number=1, outcome=outcome),
    )
    assert summary.imported == imported
    assert summary.skipped == skipped
    assert summary.duplicates == duplicates
    assert summary.failed == failed


def test_performance_many_rows_mocked() -> None:
    svc, db, eng, _ = _service_with_engine()
    n = 120
    eng.import_row.side_effect = [
        ExcelImportRowResult(row_number=i, outcome=ExcelImportRowOutcome.IMPORTED.value)
        for i in range(1, n + 1)
    ]
    summary = svc.import_rows(
        _ctx(),
        [_row(i) for i in range(1, n + 1)],
        defaults=_defaults(),
        batch_size=50,
    )
    assert summary.imported == n
    assert summary.batch_count == 3
    assert db.commit.call_count == 3
    assert summary.duration_ms >= 0
