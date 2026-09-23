"""Phase 5D — RETIRED → PENDING_DISPOSAL (Start Disposal) governance.

Retirement itself remains assignment-return (outdated) → ops retire.
This service only bridges retired assets into the existing disposal queue.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.asset.domain.enums import AssetOperationalStatus, AssetStatus
from modules.asset.domain.exceptions import RetirementValidationError
from modules.asset.domain.operational_status_exceptions import InvalidTransition
from modules.asset.models import AstAsset
from modules.asset.repository.asset_assignment_repository import AssetAssignmentRepository
from modules.asset.repository.asset_disposal_repository import AssetDisposalRepository
from modules.asset.repository.asset_maintenance_repository import AssetMaintenanceRepository
from modules.asset.repository.asset_repository import AssetRepository
from modules.asset.repository.asset_transfer_repository import AssetTransferRepository
from modules.asset.repository.assignment_component_repository import AssignmentComponentRepository
from modules.asset.service.asset_operational_status_service import AssetOperationalStatusService
from modules.foundation.domain.value_objects import TenantContext

_RETIRED = AssetOperationalStatus.RETIRED.value
_PENDING = AssetOperationalStatus.PENDING_DISPOSAL.value
_DISPOSED = AssetOperationalStatus.DISPOSED.value

_TERMINAL_LIFECYCLE = frozenset(
    {
        AssetStatus.DISPOSED.value,
        AssetStatus.WRITTEN_OFF.value,
        AssetStatus.CANCELLED.value,
    }
)


class RetirementService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._assets = AssetRepository(db)
        self._assignments = AssetAssignmentRepository(db)
        self._transfers = AssetTransferRepository(db)
        self._maintenances = AssetMaintenanceRepository(db)
        self._disposals = AssetDisposalRepository(db)
        self._assignment_components = AssignmentComponentRepository(db)
        self._operational = AssetOperationalStatusService(db)

    def start_disposal(
        self,
        ctx: TenantContext,
        asset_id: UUID,
        *,
        remarks: str | None = None,
        expected_version: int | None = None,
    ) -> AstAsset:
        """Explicit RETIRED → PENDING_DISPOSAL via AssetOperationalStatusService."""
        row = self._assets.lock_for_update(ctx, asset_id)
        if row is None:
            raise NotFoundException("Asset not found")

        self._validate_preconditions(ctx, row)

        try:
            self._operational.apply_action(
                ctx,
                asset_id,
                action="start_disposal",
                expected_version=expected_version,
                reason="start_disposal",
                remarks=remarks,
                source_entity="ast_asset",
                source_entity_id=asset_id,
            )
        except InvalidTransition:
            # Concurrent transition after lock release / stale client.
            fresh = self._assets.get(ctx, asset_id)
            ops = getattr(fresh, "operational_status", None) if fresh else None
            raise RetirementValidationError(self._ops_error_message(ops)) from None

        updated = self._assets.get(ctx, asset_id)
        if updated is None:
            raise NotFoundException("Asset not found")
        return updated

    def _validate_preconditions(self, ctx: TenantContext, row: AstAsset) -> None:
        ops = str(row.operational_status or "").strip().upper()
        if ops != _RETIRED:
            raise RetirementValidationError(self._ops_error_message(ops))

        life = str(row.status or "").strip().lower()
        if life in _TERMINAL_LIFECYCLE:
            if life == AssetStatus.DISPOSED.value:
                raise RetirementValidationError("Asset has already been disposed.")
            if life == AssetStatus.WRITTEN_OFF.value:
                raise RetirementValidationError(
                    "Written-off assets cannot start disposal."
                )
            raise RetirementValidationError(
                "Cancelled assets cannot start disposal."
            )

        open_asn = self._assignments.find_pending_or_active_for_asset(
            ctx, row.id, exclude_id=None
        )
        if open_asn is not None:
            raise RetirementValidationError(
                "Asset cannot start disposal while it is assigned."
            )

        issued = self._assignment_components.list_issued_for_asset(ctx, row.id)
        if issued:
            raise RetirementValidationError(
                "Asset cannot start disposal while active components are assigned."
            )

        pending_xfer = self._transfers.find_pending_for_asset(ctx, row.id, exclude_id=None)
        if pending_xfer is not None:
            raise RetirementValidationError(
                "Asset cannot be moved to disposal while a transfer is in progress."
            )

        open_wo = self._maintenances.find_open_for_asset(ctx, row.id, exclude_id=None)
        if open_wo is not None:
            raise RetirementValidationError(
                "Asset cannot be moved to disposal while an active maintenance "
                "workflow exists."
            )

        open_disp = self._disposals.find_pending_for_asset(ctx, row.id, exclude_id=None)
        if open_disp is not None:
            raise RetirementValidationError(
                f"Asset already has an open disposal ({open_disp.document_number})."
            )

    @staticmethod
    def _ops_error_message(ops: str | None) -> str:
        key = str(ops or "").strip().upper()
        if key == _PENDING:
            return "Asset is already pending disposal."
        if key == _DISPOSED:
            return "Asset has already been disposed."
        if key == _RETIRED:
            return "Asset must be RETIRED before starting disposal."
        return "Asset must be RETIRED before starting disposal."
