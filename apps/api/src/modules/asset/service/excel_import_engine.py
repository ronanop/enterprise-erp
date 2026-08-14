"""Excel import engine — one validated row → existing business services (CR-004 Phase 8B).

Never writes via repository/ORM directly. Reuses AssetService, AssignmentService,
and AssetOperationalStatusService workflows (including audit embedded in those services).
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from modules.asset.domain.enums import AssetOperationalStatus
from modules.asset.domain.excel_import import (
    ExcelImportDefaults,
    ExcelImportRowInput,
    ExcelImportRowOutcome,
    ExcelImportRowResult,
    ExcelImportSkipReason,
    VALID_IMPORT_OPERATIONAL_STATUSES,
)
from modules.asset.domain.exceptions import DuplicateAssetRegistrationError
from modules.asset.service.asset_operational_status_service import AssetOperationalStatusService
from modules.asset.service.asset_service import AssetService
from modules.asset.service.assignment_service import AssignmentService
from modules.foundation.domain.value_objects import TenantContext

Ready = AssetOperationalStatus.READY_TO_MOVE.value
Assigned = AssetOperationalStatus.ASSIGNED.value
Retired = AssetOperationalStatus.RETIRED.value
Pending = AssetOperationalStatus.PENDING_DISPOSAL.value
Disposed = AssetOperationalStatus.DISPOSED.value


class AssetExcelImportEngine:
    """Import a single preview-validated row through existing CR-004 workflows."""

    def __init__(
        self,
        db: Session,
        *,
        assets: AssetService | None = None,
        assignments: AssignmentService | None = None,
        operational: AssetOperationalStatusService | None = None,
    ) -> None:
        self._db = db
        self._assets = assets or AssetService(db)
        self._assignments = assignments or AssignmentService(db)
        self._operational = operational or AssetOperationalStatusService(db)

    def import_row(
        self,
        ctx: TenantContext,
        row: ExcelImportRowInput,
        *,
        defaults: ExcelImportDefaults,
        confirm_warnings: bool,
        company_id: UUID | None = None,
    ) -> ExcelImportRowResult:
        preview = (row.preview_status or "").strip().lower()
        if preview == "invalid" or preview == "error":
            return ExcelImportRowResult(
                row_number=row.row_number,
                outcome=ExcelImportRowOutcome.SKIPPED.value,
                reason=ExcelImportSkipReason.INVALID_PREVIEW.value,
            )
        if preview == "warning" and not confirm_warnings:
            return ExcelImportRowResult(
                row_number=row.row_number,
                outcome=ExcelImportRowOutcome.SKIPPED.value,
                reason=ExcelImportSkipReason.WARNING_NOT_CONFIRMED.value,
                warning=True,
            )

        target_ops = (row.operational_status or "").strip().upper()
        if target_ops == Disposed:
            return ExcelImportRowResult(
                row_number=row.row_number,
                outcome=ExcelImportRowOutcome.FAILED.value,
                reason=(
                    "DISPOSED cannot be assigned directly through Excel import. "
                    "Create and post an Asset Disposal request."
                ),
                warning=preview == "warning",
            )
        if target_ops not in VALID_IMPORT_OPERATIONAL_STATUSES:
            return ExcelImportRowResult(
                row_number=row.row_number,
                outcome=ExcelImportRowOutcome.FAILED.value,
                reason=f"invalid_operational_status:{target_ops}",
                warning=preview == "warning",
            )

        try:
            cid = company_id or row.company_id
            dup = self._detect_duplicate(ctx, company_id=cid, row=row)
            if dup is not None:
                return dup

            asset = self._create_and_activate_asset(ctx, row=row, defaults=defaults, company_id=cid)
            assignment_id: UUID | None = None
            final_ops = Ready

            if target_ops == Ready:
                final_ops = Ready
            elif target_ops == Assigned:
                if row.employee_id is None:
                    raise ValueError("ASSIGNED rows require employee_id")
                assignment_id = self._assign_to_employee(ctx, asset_id=asset.id, row=row, company_id=cid)
                final_ops = Assigned
            elif target_ops == Retired:
                assignment_id = self._path_to_retired(ctx, asset_id=asset.id, row=row, company_id=cid)
                final_ops = Retired
            elif target_ops == Pending:
                assignment_id = self._path_to_pending(ctx, asset_id=asset.id, row=row, company_id=cid)
                final_ops = Pending

            return ExcelImportRowResult(
                row_number=row.row_number,
                outcome=ExcelImportRowOutcome.IMPORTED.value,
                asset_id=asset.id,
                assignment_id=assignment_id,
                operational_status=final_ops,
                warning=preview == "warning",
            )
        except DuplicateAssetRegistrationError as exc:
            return ExcelImportRowResult(
                row_number=row.row_number,
                outcome=ExcelImportRowOutcome.DUPLICATE.value,
                reason=str(exc),
                warning=preview == "warning",
            )
        except Exception as exc:  # noqa: BLE001 — row isolation; continue import
            return ExcelImportRowResult(
                row_number=row.row_number,
                outcome=ExcelImportRowOutcome.FAILED.value,
                reason=str(exc) or exc.__class__.__name__,
                warning=preview == "warning",
            )

    def _detect_duplicate(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None,
        row: ExcelImportRowInput,
    ) -> ExcelImportRowResult | None:
        tag = (row.asset_tag or "").strip()
        if not tag:
            return ExcelImportRowResult(
                row_number=row.row_number,
                outcome=ExcelImportRowOutcome.FAILED.value,
                reason="asset_tag is required",
            )
        existing = self._assets.find_by_asset_code(ctx, tag, company_id=company_id)
        if existing is not None:
            return ExcelImportRowResult(
                row_number=row.row_number,
                outcome=ExcelImportRowOutcome.DUPLICATE.value,
                reason=ExcelImportSkipReason.DUPLICATE_ASSET_TAG.value,
                asset_id=existing.id,
            )
        serial = (row.serial_number or "").strip()
        if serial:
            by_serial = self._assets.find_by_serial_number(ctx, serial, company_id=company_id)
            if by_serial is not None:
                return ExcelImportRowResult(
                    row_number=row.row_number,
                    outcome=ExcelImportRowOutcome.DUPLICATE.value,
                    reason=ExcelImportSkipReason.DUPLICATE_SERIAL.value,
                    asset_id=by_serial.id,
                )
        return None

    def _create_and_activate_asset(
        self,
        ctx: TenantContext,
        *,
        row: ExcelImportRowInput,
        defaults: ExcelImportDefaults,
        company_id: UUID | None,
    ):
        category_id = row.asset_category_id or defaults.asset_category_id
        purchase_date = row.issue_date or defaults.purchase_date or date.today()
        purchase_cost = defaults.purchase_cost if defaults.purchase_cost is not None else Decimal("0")
        asset = self._assets.create_for_import(
            ctx,
            branch_id=row.branch_id,
            company_id=company_id,
            asset_code=row.asset_tag.strip(),
            asset_name=row.asset_name.strip(),
            asset_category_id=category_id,
            asset_type=defaults.asset_type or "fixed",
            purchase_date=purchase_date,
            purchase_cost=purchase_cost,
            currency_code=defaults.currency_code or "USD",
            serial_number=(row.serial_number or "").strip() or None,
            make=(row.make or "").strip() or None,
            model=(row.model or "").strip() or None,
            configuration=(row.configuration or "").strip() or None,
            location_label=(row.location_label or "").strip() or None,
            department_id=row.department_id,
        )
        self._assets.submit(ctx, asset.id)
        return self._assets.approve(ctx, asset.id)

    def _assign_to_employee(
        self,
        ctx: TenantContext,
        *,
        asset_id: UUID,
        row: ExcelImportRowInput,
        company_id: UUID | None,
    ) -> UUID:
        assignment = self._assignments.create(
            ctx,
            branch_id=row.branch_id,
            company_id=company_id,
            asset_id=asset_id,
            allocation_type="employee",
            employee_id=row.employee_id,
            delivery_reference_number=row.delivery_reference_number,
            delivery_reference_status=row.delivery_reference_status,
            delivery_challan_signature_status=row.delivery_challan_signature_status,
            assignment_remarks=row.assignment_remarks or "excel_import",
        )
        self._assignments.submit(ctx, assignment.id)
        activated = self._assignments.approve(ctx, assignment.id)
        return activated.id

    def _path_to_retired(
        self,
        ctx: TenantContext,
        *,
        asset_id: UUID,
        row: ExcelImportRowInput,
        company_id: UUID | None,
    ) -> UUID:
        """READY→ASSIGNED→RETIRED via assignment workflows (matrix forbids READY→RETIRED)."""
        if row.employee_id is not None:
            assignment_id = self._assign_to_employee(
                ctx, asset_id=asset_id, row=row, company_id=company_id
            )
        else:
            assignment_id = self._assign_to_branch(
                ctx, asset_id=asset_id, row=row, company_id=company_id
            )
        self._assignments.return_assignment(
            ctx,
            assignment_id,
            return_condition="outdated",
            reason="excel_import",
            remarks=row.assignment_remarks or "excel_import_retired",
        )
        return assignment_id

    def _path_to_pending(
        self,
        ctx: TenantContext,
        *,
        asset_id: UUID,
        row: ExcelImportRowInput,
        company_id: UUID | None,
    ) -> UUID:
        """READY→ASSIGNED→PENDING_DISPOSAL via return dead."""
        if row.employee_id is not None:
            assignment_id = self._assign_to_employee(
                ctx, asset_id=asset_id, row=row, company_id=company_id
            )
        else:
            assignment_id = self._assign_to_branch(
                ctx, asset_id=asset_id, row=row, company_id=company_id
            )
        self._assignments.return_assignment(
            ctx,
            assignment_id,
            return_condition="dead",
            reason="excel_import",
            remarks=row.assignment_remarks or "excel_import_pending_disposal",
        )
        return assignment_id

    def _assign_to_branch(
        self,
        ctx: TenantContext,
        *,
        asset_id: UUID,
        row: ExcelImportRowInput,
        company_id: UUID | None,
    ) -> UUID:
        assignment = self._assignments.create(
            ctx,
            branch_id=row.branch_id,
            company_id=company_id,
            asset_id=asset_id,
            allocation_type="branch",
            assignment_remarks=row.assignment_remarks or "excel_import_status_path",
        )
        self._assignments.submit(ctx, assignment.id)
        activated = self._assignments.approve(ctx, assignment.id)
        return activated.id
