"""Asset transfer service (FP-ASSET-002)."""

from datetime import date, datetime, time, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.asset.adapters.master_data_port import AssetMasterDataAdapter
from modules.asset.domain.enums import AssetTransferStatus, AstEntityType
from modules.asset.domain.exceptions import (
    InvalidAssetWorkflowState,
    SegregationOfDutiesError,
    TransferValidationError,
)
from modules.asset.domain.workflow_codes import ENTITY_AST_TRANSFER
from modules.asset.models import AstAssetTransfer
from modules.asset.repository.asset_location_repository import AssetLocationRepository
from modules.asset.repository.asset_repository import AssetRepository
from modules.asset.repository.asset_transfer_repository import (
    AssetTransferListFilters,
    AssetTransferRepository,
)
from modules.asset.repository.base import utcnow
from modules.asset.service.asset_scope_validator import AssetScopeValidator
from modules.asset.service.document_number_service import DocumentNumberService
from modules.asset.service.engines import AssetLocationEngine, AssetTransferEngine
from modules.asset.service.governance_service import AssetGovernanceService
from modules.asset.service.transfer_validator import TransferValidator
from modules.asset.service.workflow_governance_settings import asset_workflow_governance_enabled
from modules.foundation.domain.enums import WorkflowStatus
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService


class TransferService:
    def __init__(self, db: Session) -> None:
        self._repo = AssetTransferRepository(db)
        self._assets = AssetRepository(db)
        self._locations = AssetLocationRepository(db)
        self._scope = AssetScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = AssetTransferEngine()
        self._location_engine = AssetLocationEngine()
        self._governance = AssetGovernanceService(db)
        self._master = AssetMasterDataAdapter(db)
        self._validator = TransferValidator(db)
        self._audit = AuditService(db)
        self._db = db

    def search(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        asset_id: UUID | None = None,
        branch_id: UUID | None = None,
        status: str | None = None,
        search: str | None = None,
        offset: int = 0,
        limit: int = 25,
        effective_from: date | None = None,
        effective_to: date | None = None,
    ) -> tuple[list[AstAssetTransfer], int]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        filters = AssetTransferListFilters(
            company_id=cid,
            asset_id=asset_id,
            branch_id=branch_id,
            status=status,
            search=search,
            effective_from=effective_from,
            effective_to=effective_to,
        )
        return self._repo.search(ctx, filters, offset=offset, limit=limit)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstAssetTransfer:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Asset transfer not found")
        return row

    def create(self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        self._validator.validate_create_fields(ctx, company_id=cid, fields=fields)

        asset = self._assets.get(ctx, fields["asset_id"])
        if asset is None:
            raise NotFoundException("Asset not found")
        if asset.branch_id != branch_id:
            raise TransferValidationError("Transfer branch must match the asset's current branch")

        current_locations = self._locations.find_current(ctx, asset.id)
        current_location = current_locations[0] if current_locations else None
        doc = self._numbers.generate(
            AstEntityType.TRANSFER,
            cid,
            AstAssetTransfer,
            "document_number",
            ctx=ctx,
        )
        row = self._repo.create(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            document_number=doc,
            asset_id=asset.id,
            from_branch_id=asset.branch_id,
            from_department_id=asset.department_id,
            from_employee_id=asset.custodian_employee_id,
            from_location_label=getattr(current_location, "location_label", None),
            from_org_location_id=getattr(current_location, "org_location_id", None),
            status=AssetTransferStatus.DRAFT.value,
            **{k: v for k, v in fields.items() if k != "asset_id"},
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_TRANSFER,
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
            new_value={"document_number": row.document_number, "asset_id": str(asset.id)},
        )
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        row = self.get(ctx, row_id)
        self._validator.validate_update_fields(ctx, row, fields)
        updated = self._repo.update(ctx, row_id, **fields)
        if updated is None:
            raise NotFoundException("Asset transfer not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_TRANSFER,
            entity_id=row_id,
            operation="update",
            performed_by=ctx.user_id,
        )
        return updated

    def submit(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._validator.validate_submit_readiness(ctx, row)
        self._engine.submit(row)
        if not asset_workflow_governance_enabled():
            return self._repo.update(ctx, row_id, status=row.status)
        instance = self._governance.submit_for_approval(
            ctx,
            entity_name=ENTITY_AST_TRANSFER,
            entity_id=row_id,
            recipient_user_id=row.created_by,
        )
        return self._repo.update(
            ctx,
            row_id,
            status=row.status,
            workflow_status=WorkflowStatus.IN_PROGRESS.value,
            workflow_instance_id=instance.id,
        )

    def approve(self, ctx: TenantContext, row_id: UUID, comments: str | None = None):
        row = self.get(ctx, row_id)
        if not asset_workflow_governance_enabled():
            return self._legacy_approve(ctx, row_id, row)
        if row.created_by == ctx.user_id:
            raise SegregationOfDutiesError("Creator cannot approve own transfer")
        if row.workflow_instance_id is None:
            raise InvalidAssetWorkflowState("Transfer has no workflow instance")

        def on_approved() -> None:
            self._execute_transfer(ctx, row_id)

        instance = self._governance.approve(
            ctx,
            instance_id=row.workflow_instance_id,
            entity_name=ENTITY_AST_TRANSFER,
            entity_id=row_id,
            on_approved=on_approved,
            comments=comments,
            recipient_user_id=row.created_by,
        )
        if instance.status == WorkflowStatus.APPROVED:
            return self.get(ctx, row_id)
        return self._repo.update(ctx, row_id, workflow_status=instance.status.value)

    def reject(self, ctx: TenantContext, row_id: UUID, comments: str | None = None):
        row = self.get(ctx, row_id)
        if not asset_workflow_governance_enabled():
            raise InvalidAssetWorkflowState("Workflow governance is disabled")
        if row.workflow_instance_id is None:
            raise InvalidAssetWorkflowState("Transfer has no workflow instance")

        def on_rejected() -> None:
            self._repo.update(
                ctx,
                row_id,
                status=AssetTransferStatus.CANCELLED.value,
                workflow_status=WorkflowStatus.REJECTED.value,
            )

        self._governance.reject(
            ctx,
            instance_id=row.workflow_instance_id,
            entity_name=ENTITY_AST_TRANSFER,
            entity_id=row_id,
            on_rejected=on_rejected,
            comments=comments,
            recipient_user_id=row.created_by,
        )
        return self.get(ctx, row_id)

    def cancel_draft(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.cancel_draft(row)
        if row.workflow_instance_id is not None:
            raise InvalidAssetWorkflowState("Cannot cancel after workflow started")
        updated = self._repo.update(ctx, row_id, status=row.status)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_TRANSFER,
            entity_id=row_id,
            operation="cancel",
            performed_by=ctx.user_id,
        )
        return updated

    def reopen(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.reopen(row, workflow_status=row.workflow_status)
        updated = self._repo.update(
            ctx,
            row_id,
            status=row.status,
            workflow_status=None,
            workflow_instance_id=None,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_TRANSFER,
            entity_id=row_id,
            operation="reopen",
            performed_by=ctx.user_id,
        )
        return updated

    def resubmit(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        if (
            row.status == AssetTransferStatus.CANCELLED.value
            and row.workflow_status == WorkflowStatus.REJECTED.value
        ):
            self.reopen(ctx, row_id)
        return self.submit(ctx, row_id)

    def _legacy_approve(self, ctx: TenantContext, row_id: UUID, row: AstAssetTransfer):
        """Non-production path when ASSET_WORKFLOW_GOVERNANCE_ENABLED=false (dev/support only)."""
        if row.status == AssetTransferStatus.DRAFT.value:
            self._engine.submit(row)
        self._engine.approve(row)
        self._repo.update(ctx, row_id, status=row.status)
        self._execute_transfer(ctx, row_id)
        return self.get(ctx, row_id)

    def _execute_transfer(self, ctx: TenantContext, row_id: UUID) -> None:
        transfer = self.get(ctx, row_id)
        asset = self._assets.get(ctx, transfer.asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        self._validator.validate_execute_readiness(ctx, transfer)

        self._engine.approve(transfer)

        asset_updates = {}
        if transfer.to_branch_id is not None and transfer.to_branch_id != transfer.from_branch_id:
            asset_updates["branch_id"] = transfer.to_branch_id
        if transfer.to_department_id is not None and transfer.to_department_id != transfer.from_department_id:
            asset_updates["department_id"] = transfer.to_department_id
        if transfer.to_employee_id is not None and transfer.to_employee_id != transfer.from_employee_id:
            asset_updates["custodian_employee_id"] = transfer.to_employee_id

        if asset_updates:
            self._assets.update(ctx, asset.id, **asset_updates)

        effective_from = self._resolve_effective_from(transfer.effective_date)

        location_changed = any(
            (
                transfer.to_branch_id is not None and transfer.to_branch_id != transfer.from_branch_id,
                transfer.to_location_label not in (None, "") and transfer.to_location_label != transfer.from_location_label,
                transfer.to_org_location_id is not None and transfer.to_org_location_id != transfer.from_org_location_id,
            )
        )
        if location_changed:
            for current in self._locations.find_current(ctx, transfer.asset_id):
                self._location_engine.mark_historical(current)
                current.effective_to = effective_from
            self._locations.create(
                ctx,
                company_id=transfer.company_id,
                asset_id=transfer.asset_id,
                branch_id=transfer.to_branch_id or asset_updates.get("branch_id") or asset.branch_id,
                location_label=transfer.to_location_label
                or transfer.from_location_label
                or "Transferred location",
                org_location_id=transfer.to_org_location_id,
                effective_from=effective_from,
                is_current=True,
                status="active",
            )

        master_payload = dict(asset_updates)
        if (
            transfer.to_org_location_id is not None
            and transfer.to_org_location_id != transfer.from_org_location_id
        ):
            master_payload["location_id"] = transfer.to_org_location_id

        if asset.master_asset_id is not None and master_payload:
            self._master.update_master_asset_transfer(ctx, asset.master_asset_id, **master_payload)

        self._engine.execute(transfer)
        now = utcnow()
        self._repo.update(
            ctx,
            row_id,
            status=transfer.status,
            workflow_status=WorkflowStatus.APPROVED.value,
            executed_at=now,
            executed_by=ctx.user_id,
            transferred_at=effective_from,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_TRANSFER,
            entity_id=row_id,
            operation="transfer_execute",
            performed_by=ctx.user_id,
            new_value={k: str(v) for k, v in master_payload.items()},
        )

    @staticmethod
    def _resolve_effective_from(effective_date: date | None) -> datetime:
        if effective_date is None:
            return utcnow()
        return datetime.combine(effective_date, time.min, tzinfo=timezone.utc)

