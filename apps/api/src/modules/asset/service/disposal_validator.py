"""Asset disposal validation rules for FP-ASSET-005."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.asset.domain.enums import AssetDisposalStatus, AssetStatus
from modules.asset.domain.exceptions import DisposalValidationError
from modules.asset.models import AstAssetDisposal
from modules.asset.repository.asset_assignment_repository import AssetAssignmentRepository
from modules.asset.repository.asset_disposal_repository import AssetDisposalRepository
from modules.asset.repository.asset_maintenance_repository import AssetMaintenanceRepository
from modules.asset.repository.asset_repository import AssetRepository
from modules.asset.repository.asset_transfer_repository import AssetTransferRepository
from modules.foundation.domain.value_objects import TenantContext

DISPOSAL_TYPES = frozenset({"sale", "scrap", "donation", "write_off"})
ELIGIBLE_ASSET_STATUSES = frozenset(
    {
        AssetStatus.ACTIVE.value,
        AssetStatus.IN_MAINTENANCE.value,
    }
)


class DisposalValidator:
    def __init__(self, db: Session) -> None:
        self._assets = AssetRepository(db)
        self._disposals = AssetDisposalRepository(db)
        self._maintenances = AssetMaintenanceRepository(db)
        self._assignments = AssetAssignmentRepository(db)
        self._transfers = AssetTransferRepository(db)

    def validate_create_fields(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        fields: dict,
    ) -> None:
        asset_id = fields.get("asset_id")
        if asset_id is None:
            raise DisposalValidationError("asset_id is required")
        asset = self._assets.get(ctx, asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        if asset.company_id != company_id:
            raise DisposalValidationError("Asset does not belong to this company")
        self._validate_asset_eligible(asset.status)
        self._validate_disposal_type(fields)
        self._validate_open_disposal(ctx, asset_id, exclude_id=None)
        self._validate_open_maintenance(ctx, asset_id)
        self._validate_open_assignment(ctx, asset_id)
        self._validate_pending_transfer(ctx, asset_id)

    def validate_update_fields(
        self,
        ctx: TenantContext,
        row: AstAssetDisposal,
        fields: dict,
    ) -> None:
        if row.status != AssetDisposalStatus.DRAFT.value:
            raise DisposalValidationError("Only draft disposals can be updated")
        if "asset_id" in fields and fields["asset_id"] != row.asset_id:
            raise DisposalValidationError("asset_id cannot be changed")
        if "document_number" in fields:
            raise DisposalValidationError("document_number cannot be changed")
        merged = {
            "disposal_type": fields.get("disposal_type", row.disposal_type),
            "disposal_date": fields.get("disposal_date", row.disposal_date),
            "proceeds_amount": fields.get("proceeds_amount", row.proceeds_amount),
            "book_value_at_disposal": fields.get(
                "book_value_at_disposal", row.book_value_at_disposal
            ),
        }
        asset = self._assets.get(ctx, row.asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        self._validate_asset_eligible(asset.status)
        self._validate_disposal_type(merged)
        self._validate_open_disposal(ctx, row.asset_id, exclude_id=row.id)
        self._validate_open_maintenance(ctx, row.asset_id)
        self._validate_open_assignment(ctx, row.asset_id)
        self._validate_pending_transfer(ctx, row.asset_id)

    def validate_submit_readiness(self, ctx: TenantContext, row: AstAssetDisposal) -> None:
        if row.status != AssetDisposalStatus.DRAFT.value:
            raise DisposalValidationError("Only draft disposals can be submitted")
        self._validate_operational_gates(ctx, row)

    def validate_post_readiness(self, ctx: TenantContext, row: AstAssetDisposal) -> None:
        if (
            row.status == AssetDisposalStatus.POSTED.value
            or row.finance_journal_id is not None
        ):
            raise DisposalValidationError("Disposal already posted")
        if row.status != AssetDisposalStatus.APPROVED.value:
            raise DisposalValidationError("Only approved disposals can be posted")
        if row.disposal_date is None:
            raise DisposalValidationError("disposal_date is required before posting")
        self._validate_operational_gates(ctx, row)

    def validate_reopen_readiness(self, ctx: TenantContext, row: AstAssetDisposal) -> None:
        """Ensure reopening does not create a second open disposal (DSP-14)."""
        self._validate_open_disposal(ctx, row.asset_id, exclude_id=row.id)

    def _validate_operational_gates(self, ctx: TenantContext, row: AstAssetDisposal) -> None:
        asset = self._assets.get(ctx, row.asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        self._validate_asset_eligible(asset.status)
        self._validate_disposal_type(
            {
                "disposal_type": row.disposal_type,
                "disposal_date": row.disposal_date,
                "proceeds_amount": row.proceeds_amount,
                "book_value_at_disposal": row.book_value_at_disposal,
            }
        )
        self._validate_open_disposal(ctx, row.asset_id, exclude_id=row.id)
        self._validate_open_maintenance(ctx, row.asset_id)
        self._validate_open_assignment(ctx, row.asset_id)
        self._validate_pending_transfer(ctx, row.asset_id)

    def _validate_disposal_type(self, fields: dict) -> None:
        disposal_type = fields.get("disposal_type")
        if disposal_type not in DISPOSAL_TYPES:
            raise DisposalValidationError("disposal_type is required and must be valid")

    def _validate_open_disposal(
        self,
        ctx: TenantContext,
        asset_id: UUID,
        *,
        exclude_id: UUID | None,
    ) -> None:
        open_row = self._disposals.find_pending_for_asset(ctx, asset_id, exclude_id=exclude_id)
        if open_row is not None:
            raise DisposalValidationError(
                f"Asset already has an open disposal ({open_row.document_number})"
            )

    def _validate_open_maintenance(self, ctx: TenantContext, asset_id: UUID) -> None:
        open_wo = self._maintenances.find_open_for_asset(ctx, asset_id, exclude_id=None)
        if open_wo is not None:
            raise DisposalValidationError(
                f"Asset has an open maintenance work order ({open_wo.document_number})"
            )

    def _validate_open_assignment(self, ctx: TenantContext, asset_id: UUID) -> None:
        open_asn = self._assignments.find_pending_or_active_for_asset(
            ctx, asset_id, exclude_id=None
        )
        if open_asn is not None:
            raise DisposalValidationError(
                f"Asset has an open assignment ({open_asn.document_number}); return or cancel first"
            )

    def _validate_pending_transfer(self, ctx: TenantContext, asset_id: UUID) -> None:
        pending = self._transfers.find_pending_for_asset(ctx, asset_id, exclude_id=None)
        if pending is not None:
            raise DisposalValidationError(
                f"Asset has a pending transfer ({pending.document_number})"
            )

    @staticmethod
    def _validate_asset_eligible(status: str) -> None:
        if status in {AssetStatus.DISPOSED.value, AssetStatus.WRITTEN_OFF.value}:
            raise DisposalValidationError("Disposed or written-off assets cannot be disposed again")
        if status not in ELIGIBLE_ASSET_STATUSES:
            raise DisposalValidationError(
                "Only active or in_maintenance assets can be disposed"
            )
