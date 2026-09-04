"""Asset physical audit validation rules for FP-ASSET-008."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.asset.adapters.master_data_port import AssetMasterDataAdapter
from modules.asset.domain.enums import AssetAuditStatus, AssetStatus
from modules.asset.domain.exceptions import AssetAuditValidationError
from modules.asset.models import AstAssetAudit
from modules.asset.repository.asset_repository import AssetRepository
from modules.foundation.domain.value_objects import TenantContext

FOUND_STATUSES = frozenset({"found", "missing", "damaged", "relocated"})
ELIGIBLE_ASSET_STATUSES = frozenset(
    {
        AssetStatus.ACTIVE.value,
        AssetStatus.IN_MAINTENANCE.value,
        AssetStatus.TRANSFERRED.value,
    }
)


class AssetAuditValidator:
    def __init__(self, db: Session) -> None:
        self._assets = AssetRepository(db)
        self._master = AssetMasterDataAdapter(db)

    def validate_create_fields(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        fields: dict,
    ) -> None:
        asset_id = fields.get("asset_id")
        if asset_id is None:
            raise AssetAuditValidationError("asset_id is required")
        auditor_id = fields.get("auditor_employee_id")
        if auditor_id is None:
            raise AssetAuditValidationError("auditor_employee_id is required")

        asset = self._assets.get(ctx, asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        if asset.company_id != company_id:
            raise AssetAuditValidationError("Asset does not belong to this company")
        self._validate_asset_eligible(asset.status)
        self._validate_auditor(ctx, auditor_id)
        found = fields.get("found_status")
        if found is not None and found not in FOUND_STATUSES:
            raise AssetAuditValidationError("found_status must be valid")

    def validate_update_fields(
        self,
        ctx: TenantContext,
        row: AstAssetAudit,
        fields: dict,
    ) -> None:
        if row.status != AssetAuditStatus.PLANNED.value:
            raise AssetAuditValidationError("Only planned audits can be updated")
        if "asset_id" in fields and fields["asset_id"] != row.asset_id:
            raise AssetAuditValidationError("asset_id cannot be changed")
        if "document_number" in fields:
            raise AssetAuditValidationError("document_number cannot be changed")

        asset = self._assets.get(ctx, row.asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        self._validate_asset_eligible(asset.status)

        auditor_id = fields.get("auditor_employee_id", row.auditor_employee_id)
        if auditor_id is None:
            raise AssetAuditValidationError("auditor_employee_id is required")
        self._validate_auditor(ctx, auditor_id)

        found = fields.get("found_status", row.found_status)
        if found is not None and found not in FOUND_STATUSES:
            raise AssetAuditValidationError("found_status must be valid")

    def validate_start_readiness(self, ctx: TenantContext, row: AstAssetAudit) -> None:
        if row.status != AssetAuditStatus.PLANNED.value:
            raise AssetAuditValidationError("Only planned audits can be started")
        if row.audit_date is None:
            raise AssetAuditValidationError("audit_date is required before start")
        self._validate_row_asset(ctx, row)

    def validate_complete_readiness(self, ctx: TenantContext, row: AstAssetAudit) -> None:
        if row.status not in {
            AssetAuditStatus.PLANNED.value,
            AssetAuditStatus.IN_PROGRESS.value,
        }:
            raise AssetAuditValidationError("Only planned or in_progress audits can be completed")
        if row.found_status not in FOUND_STATUSES:
            raise AssetAuditValidationError("found_status is required before complete")
        if row.audit_date is None:
            raise AssetAuditValidationError("audit_date is required before complete")
        self._validate_row_asset(ctx, row)

    def validate_cancel_readiness(self, ctx: TenantContext, row: AstAssetAudit) -> None:
        if row.status == AssetAuditStatus.COMPLETED.value:
            raise AssetAuditValidationError("Completed audits cannot be cancelled")
        if row.status == AssetAuditStatus.CANCELLED.value:
            raise AssetAuditValidationError("Audit is already cancelled")

    def _validate_row_asset(self, ctx: TenantContext, row: AstAssetAudit) -> None:
        if row.asset_id is None:
            raise AssetAuditValidationError("asset_id is required")
        asset = self._assets.get(ctx, row.asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        self._validate_asset_eligible(asset.status)

    def _validate_auditor(self, ctx: TenantContext, auditor_employee_id: UUID) -> None:
        try:
            employee = self._master.get_employee(ctx, auditor_employee_id)
        except Exception as exc:  # noqa: BLE001
            raise AssetAuditValidationError("auditor_employee_id is invalid") from exc
        if employee is None:
            raise AssetAuditValidationError("auditor_employee_id is invalid")

    @staticmethod
    def _validate_asset_eligible(status: str) -> None:
        if status in {AssetStatus.DISPOSED.value, AssetStatus.WRITTEN_OFF.value}:
            raise AssetAuditValidationError(
                "Disposed or written-off assets cannot be audited"
            )
        if status not in ELIGIBLE_ASSET_STATUSES:
            raise AssetAuditValidationError(
                "Only active, in_maintenance, or transferred assets can be audited"
            )
