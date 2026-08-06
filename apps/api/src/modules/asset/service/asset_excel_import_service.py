"""Asset Excel import orchestration — batches, transactions, summary (CR-004 Phase 8B)."""

from __future__ import annotations

import time
from uuid import UUID

from sqlalchemy.orm import Session

from modules.asset.domain.excel_import import (
    DEFAULT_IMPORT_BATCH_SIZE,
    MAX_IMPORT_BATCH_SIZE,
    ExcelImportDefaults,
    ExcelImportRowInput,
    ExcelImportRowOutcome,
    ExcelImportRowResult,
    ExcelImportSkipReason,
    ExcelImportSummary,
)
from modules.asset.service.excel_import_engine import AssetExcelImportEngine
from modules.foundation.domain.value_objects import TenantContext


class AssetExcelImportService:
    """Batch import of preview-validated Excel rows through AssetExcelImportEngine."""

    def __init__(
        self,
        db: Session,
        *,
        engine: AssetExcelImportEngine | None = None,
    ) -> None:
        self._db = db
        self._engine = engine or AssetExcelImportEngine(db)

    def import_rows(
        self,
        ctx: TenantContext,
        rows: list[ExcelImportRowInput],
        *,
        defaults: ExcelImportDefaults,
        confirm_warnings: bool = False,
        batch_size: int = DEFAULT_IMPORT_BATCH_SIZE,
        company_id: UUID | None = None,
    ) -> ExcelImportSummary:
        started = time.perf_counter()
        size = self._normalize_batch_size(batch_size)
        summary = ExcelImportSummary(total_rows=len(rows))

        if not rows:
            summary.duration_ms = int((time.perf_counter() - started) * 1000)
            return summary

        batches = [rows[i : i + size] for i in range(0, len(rows), size)]
        summary.batch_count = len(batches)

        for batch in batches:
            self._import_batch(
                ctx,
                batch,
                defaults=defaults,
                confirm_warnings=confirm_warnings,
                company_id=company_id,
                summary=summary,
            )

        summary.duration_ms = int((time.perf_counter() - started) * 1000)
        return summary

    def _import_batch(
        self,
        ctx: TenantContext,
        batch: list[ExcelImportRowInput],
        *,
        defaults: ExcelImportDefaults,
        confirm_warnings: bool,
        company_id: UUID | None,
        summary: ExcelImportSummary,
    ) -> None:
        batch_results: list[ExcelImportRowResult] = []
        try:
            for row in batch:
                nested = self._db.begin_nested()
                try:
                    result = self._engine.import_row(
                        ctx,
                        row,
                        defaults=defaults,
                        confirm_warnings=confirm_warnings,
                        company_id=company_id,
                    )
                    if result.outcome == ExcelImportRowOutcome.FAILED.value:
                        nested.rollback()
                    else:
                        nested.commit()
                    batch_results.append(result)
                except Exception as exc:  # noqa: BLE001
                    nested.rollback()
                    batch_results.append(
                        ExcelImportRowResult(
                            row_number=row.row_number,
                            outcome=ExcelImportRowOutcome.FAILED.value,
                            reason=str(exc) or exc.__class__.__name__,
                        )
                    )
            self._db.commit()
        except Exception as exc:  # noqa: BLE001 — rollback only this batch
            self._db.rollback()
            reason = f"{ExcelImportSkipReason.BATCH_ROLLED_BACK.value}: {exc}"
            batch_results = [
                ExcelImportRowResult(
                    row_number=row.row_number,
                    outcome=ExcelImportRowOutcome.FAILED.value,
                    reason=reason,
                )
                for row in batch
            ]

        for result in batch_results:
            self._accumulate(summary, result)

    @staticmethod
    def _accumulate(summary: ExcelImportSummary, result: ExcelImportRowResult) -> None:
        summary.rows.append(result)
        if result.warning:
            summary.warnings += 1
        outcome = result.outcome
        if outcome == ExcelImportRowOutcome.IMPORTED.value:
            summary.imported += 1
        elif outcome == ExcelImportRowOutcome.DUPLICATE.value:
            summary.duplicates += 1
            summary.skipped += 1
        elif outcome == ExcelImportRowOutcome.SKIPPED.value:
            summary.skipped += 1
        elif outcome == ExcelImportRowOutcome.FAILED.value:
            summary.failed += 1

    @staticmethod
    def _normalize_batch_size(batch_size: int) -> int:
        if batch_size < 1:
            return DEFAULT_IMPORT_BATCH_SIZE
        return min(batch_size, MAX_IMPORT_BATCH_SIZE)
