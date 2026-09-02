"""Asset operational status application service (CR-004).

Orchestrates validator → engine → repository. Sole workflow writer for operational_status.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from modules.asset.domain.enums import (
    DC_CHALLAN_OPS_AUTO_CANCEL_STATUSES,
    AssetOperationalStatus,
)
from modules.asset.domain.operational_status_exceptions import (
    AssetNotFoundForOperationalStatus,
    OperationalStatusConflict,
)
from modules.asset.repository.asset_repository import AssetRepository
from modules.asset.service.engines.asset_operational_status_engine import (
    AssetOperationalStatusEngine,
)
from modules.asset.service.operational_status_audit import log_operational_status_change
from modules.asset.service.operational_status_validator import OperationalStatusValidator
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService


class AssetOperationalStatusService:
    def __init__(
        self,
        db: Session,
        *,
        validator: OperationalStatusValidator | None = None,
        engine: AssetOperationalStatusEngine | None = None,
        audit: AuditService | None = None,
    ) -> None:
        self._db = db
        self._repo = AssetRepository(db)
        self._engine = engine or AssetOperationalStatusEngine()
        self._validator = validator or OperationalStatusValidator(self._engine)
        self._audit = audit or AuditService(db)

    def get_status(self, ctx: TenantContext, asset_id: UUID) -> str | None:
        return self._repo.get_operational_status(ctx, asset_id)

    def initialize_ready_to_move(
        self,
        ctx: TenantContext,
        asset_id: UUID,
        *,
        expected_version: int | None = None,
        reason: str | None = None,
        remarks: str | None = None,
    ) -> str:
        """Set initial READY_TO_MOVE on registration activate (not a matrix transition)."""
        row = self._repo.lock_for_update(ctx, asset_id)
        if row is None:
            raise AssetNotFoundForOperationalStatus()
        self._assert_version(row, expected_version)
        ready = AssetOperationalStatus.READY_TO_MOVE.value
        old = row.operational_status
        if old is None:
            self._repo.set_operational_status(
                ctx,
                asset_id,
                ready,
                expected_version=int(row.version or 1),
                row=row,
            )
            log_operational_status_change(
                self._audit,
                ctx,
                asset_id,
                old_status=old,
                new_status=ready,
                action="initialize_ready_to_move",
                reason=reason or "asset_registration",
                remarks=remarks,
            )
            return ready
        if old == ready:
            return ready
        return old

    def transition(
        self,
        ctx: TenantContext,
        asset_id: UUID,
        *,
        target_status: str,
        expected_version: int | None = None,
        reason: str | None = None,
        remarks: str | None = None,
        source_entity: str | None = None,
        source_entity_id: UUID | None = None,
    ) -> str:
        return self._apply_target(
            ctx,
            asset_id,
            target_status=target_status,
            action=f"transition:{target_status}",
            expected_version=expected_version,
            reason=reason,
            remarks=remarks,
            source_entity=source_entity,
            source_entity_id=source_entity_id,
        )

    def apply_action(
        self,
        ctx: TenantContext,
        asset_id: UUID,
        *,
        action: str,
        expected_version: int | None = None,
        reason: str | None = None,
        remarks: str | None = None,
        source_entity: str | None = None,
        source_entity_id: UUID | None = None,
    ) -> str:
        row = self._repo.lock_for_update(ctx, asset_id)
        if row is None:
            raise AssetNotFoundForOperationalStatus()
        self._assert_version(row, expected_version)
        current = row.operational_status
        target = self._validator.validate_action(current, action)
        return self._persist_transition(
            ctx,
            asset_id,
            current=current,
            target=target,
            action=action,
            expected_version=int(row.version or 1),
            reason=reason,
            remarks=remarks,
            source_entity=source_entity,
            source_entity_id=source_entity_id,
            row=row,
        )

    def _apply_target(
        self,
        ctx: TenantContext,
        asset_id: UUID,
        *,
        target_status: str,
        action: str,
        expected_version: int | None,
        reason: str | None,
        remarks: str | None,
        source_entity: str | None,
        source_entity_id: UUID | None,
    ) -> str:
        row = self._repo.lock_for_update(ctx, asset_id)
        if row is None:
            raise AssetNotFoundForOperationalStatus()
        self._assert_version(row, expected_version)
        current = row.operational_status
        self._validator.validate_transition(current, target_status)
        target = self._engine.resolve_transition(current, target_status)
        return self._persist_transition(
            ctx,
            asset_id,
            current=current,
            target=target,
            action=action,
            expected_version=int(row.version or 1),
            reason=reason,
            remarks=remarks,
            source_entity=source_entity,
            source_entity_id=source_entity_id,
            row=row,
        )

    def _persist_transition(
        self,
        ctx: TenantContext,
        asset_id: UUID,
        *,
        current: str | None,
        target: str,
        action: str,
        expected_version: int,
        reason: str | None,
        remarks: str | None,
        source_entity: str | None,
        source_entity_id: UUID | None,
        row,
    ) -> str:
        updated = self._repo.set_operational_status(
            ctx,
            asset_id,
            target,
            expected_version=expected_version,
            row=row,
        )
        if updated is None:
            raise AssetNotFoundForOperationalStatus()
        log_operational_status_change(
            self._audit,
            ctx,
            asset_id,
            old_status=current,
            new_status=target,
            action=action,
            reason=reason,
            remarks=remarks,
            source_entity=source_entity,
            source_entity_id=source_entity_id,
        )
        ops_cancel = {
            AssetOperationalStatus.RETIRED.value,
            AssetOperationalStatus.PENDING_DISPOSAL.value,
            AssetOperationalStatus.DISPOSED.value,
        }
        if target in ops_cancel:
            from modules.asset.service.dc_challan_service import DcChallanService

            DcChallanService(self._db).auto_cancel_open_for_asset(
                ctx,
                asset_id,
                remark=f"Auto-cancelled because asset operational status became {target}.",
                statuses=DC_CHALLAN_OPS_AUTO_CANCEL_STATUSES,
            )
        return target

    @staticmethod
    def _assert_version(row, expected_version: int | None) -> None:
        if expected_version is None:
            return
        if int(row.version or 0) != int(expected_version):
            raise OperationalStatusConflict()
