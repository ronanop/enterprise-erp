"""DisposalService — retirement governance (FP-ASSET-005)."""

from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.asset.adapters.finance_port import AssetFinanceAdapter
from modules.asset.adapters.master_data_port import AssetMasterDataAdapter
from modules.asset.domain.enums import AssetDisposalStatus, AssetOperationalStatus, AstEntityType
from modules.asset.domain.exceptions import (
    DisposalValidationError,
    InvalidAssetWorkflowState,
    SegregationOfDutiesError,
)
from modules.asset.domain.workflow_codes import ENTITY_AST_ASSET, ENTITY_AST_DISPOSAL
from modules.asset.models import AstAssetDisposal
from modules.asset.repository.asset_component_repository import AssetComponentRepository
from modules.asset.repository.asset_disposal_repository import (
    AssetDisposalListFilters,
    AssetDisposalRepository,
)
from modules.asset.repository.asset_repository import AssetRepository
from modules.asset.service.asset_operational_status_service import AssetOperationalStatusService
from modules.asset.service.asset_scope_validator import AssetScopeValidator
from modules.asset.service.disposal_validator import DisposalValidator
from modules.asset.service.document_number_service import DocumentNumberService
from modules.asset.service.engines import AssetDisposalEngine, AssetEngine
from modules.asset.service.governance_service import AssetGovernanceService
from modules.asset.service.workflow_governance_settings import asset_workflow_governance_enabled
from modules.foundation.domain.enums import WorkflowStatus
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.repository.base import utcnow
from modules.foundation.service.audit_service import AuditService


class DisposalService:
    def __init__(self, db: Session) -> None:
        self._repo = AssetDisposalRepository(db)
        self._assets = AssetRepository(db)
        self._scope = AssetScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = AssetDisposalEngine()
        self._asset_engine = AssetEngine()
        self._finance = AssetFinanceAdapter(db)
        self._master = AssetMasterDataAdapter(db)
        self._audit = AuditService(db)
        self._governance = AssetGovernanceService(db)
        self._validator = DisposalValidator(db)
        self._operational = AssetOperationalStatusService(db)
        self._components = AssetComponentRepository(db)

    def _assert_no_active_components(self, ctx: TenantContext, asset_id: UUID) -> None:
        active = self._components.list_by_asset(ctx, asset_id, include_inactive=False)
        if not active:
            return
        labels = ", ".join(
            f"{c.component_code}"
            + (f" ({c.serial_number})" if c.serial_number else "")
            for c in active[:10]
        )
        raise DisposalValidationError(
            "Remove or dispose of active components before disposing this asset: "
            + labels
        )

    def search(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        asset_id: UUID | None = None,
        branch_id: UUID | None = None,
        status: str | None = None,
        disposal_type: str | None = None,
        search: str | None = None,
        offset: int = 0,
        limit: int = 25,
    ) -> tuple[list[AstAssetDisposal], int]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        filters = AssetDisposalListFilters(
            company_id=cid,
            asset_id=asset_id,
            branch_id=branch_id,
            status=status,
            disposal_type=disposal_type,
            search=search,
        )
        return self._repo.search(ctx, filters, offset=offset, limit=limit)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstAssetDisposal:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Asset disposal not found")
        return row

    def create(self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields):
        """Send to Disposal: create posted record + set operational DISPOSED atomically.

        Simplified scrap flow — no pending-disposal stage, no approval workflow on create.
        """
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        self._validator.validate_create_fields(ctx, company_id=cid, fields=fields)

        asset_id = fields["asset_id"]
        asset = self._assets.lock_for_update(ctx, asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        self._assert_no_active_components(ctx, asset.id)
        if asset.branch_id != branch_id:
            raise DisposalValidationError(
                "Disposal branch must match the asset's current branch"
            )

        remarks = str(fields.get("remarks") or "").strip()
        previous_ops = str(getattr(asset, "operational_status", "") or "").strip().upper() or None
        disposal_type = fields.get("disposal_type") or "scrap"
        disposal_date = fields.get("disposal_date") or date.today()
        management_approved = bool(fields.get("management_approved"))

        # Ready/Assigned/Retired/Pending → DISPOSED
        asset = self._ensure_disposed_ops(
            ctx,
            asset,
            remarks=remarks,
            disposal_type=disposal_type,
        )

        doc = self._numbers.generate(
            AstEntityType.DISPOSAL,
            cid,
            AstAssetDisposal,
            "document_number",
            ctx=ctx,
        )
        now = utcnow()
        row = self._repo.create(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            document_number=doc,
            asset_id=asset.id,
            disposal_type=disposal_type,
            disposal_date=disposal_date,
            proceeds_amount=fields.get("proceeds_amount"),
            book_value_at_disposal=fields.get("book_value_at_disposal"),
            remarks=remarks,
            management_approved=management_approved,
            previous_operational_status=previous_ops,
            status=AssetDisposalStatus.POSTED.value,
            completed_at=now,
            completed_by=ctx.user_id,
            approved_at=now if management_approved else None,
            approved_by=ctx.user_id if management_approved else None,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_DISPOSAL,
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
            new_value={
                "document_number": row.document_number,
                "asset_id": str(asset.id),
                "disposal_type": row.disposal_type,
                "disposal_date": str(disposal_date),
                "remarks": remarks,
                "management_approved": management_approved,
                "previous_operational_status": previous_ops,
                "operational_status": getattr(asset, "operational_status", None),
                "status": AssetDisposalStatus.POSTED.value,
            },
        )
        # Also stamp the asset entity so portal Activity Logs show disposal details.
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_ASSET,
            entity_id=asset.id,
            operation="Disposed",
            performed_by=ctx.user_id,
            new_value={
                "action": "dispose",
                "operational_status": AssetOperationalStatus.DISPOSED.value,
                "disposal_id": str(row.id),
                "disposal_document_number": row.document_number,
                "disposal_date": str(disposal_date),
                "reason": remarks,
                "management_approved": management_approved,
                "disposal_type": disposal_type,
            },
            old_value={
                "operational_status": previous_ops,
            },
        )
        return row

    def _ensure_disposed_ops(
        self,
        ctx: TenantContext,
        asset,
        *,
        remarks: str,
        disposal_type: str,
    ):
        """Move Ready/Assigned/Retired/Pending → DISPOSED in one action.

        Does not physically delete the asset.
        """
        disposed = AssetOperationalStatus.DISPOSED.value
        ops = str(getattr(asset, "operational_status", "") or "").strip().upper()
        if ops == disposed:
            raise DisposalValidationError("Disposed assets cannot be disposed again")

        eligible = {
            AssetOperationalStatus.READY_TO_MOVE.value,
            AssetOperationalStatus.ASSIGNED.value,
            AssetOperationalStatus.RETIRED.value,
            AssetOperationalStatus.PENDING_DISPOSAL.value,
        }
        if ops not in eligible:
            raise DisposalValidationError(
                "Asset operational status cannot be sent to disposal from "
                f"{ops or 'unknown'}"
            )

        # Lifecycle terminal status (disposed / written_off) — not a physical delete.
        self._asset_engine.dispose(asset, disposal_type=disposal_type)
        updated_asset = self._assets.update(ctx, asset.id, status=asset.status)
        asset_version = int((updated_asset or asset).version or 1)

        if asset.master_asset_id is not None:
            self._master.mark_master_disposed(ctx, asset.master_asset_id)

        final_ops = self._operational.apply_action(
            ctx,
            asset.id,
            action="dispose",
            expected_version=asset_version,
            reason="dispose_asset",
            remarks=remarks or None,
            source_entity=ENTITY_AST_DISPOSAL,
            source_entity_id=asset.id,
        )
        fresh = self._assets.get(ctx, asset.id)
        if fresh is None:
            raise NotFoundException("Asset not found")
        if str(getattr(fresh, "operational_status", "") or "").upper() != disposed:
            raise DisposalValidationError(
                f"Failed to set asset to disposed (got {final_ops})"
            )
        return fresh

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        row = self.get(ctx, row_id)
        self._validator.validate_update_fields(ctx, row, fields)
        updated = self._repo.update(ctx, row_id, **fields)
        if updated is None:
            raise NotFoundException("Asset disposal not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_DISPOSAL,
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
            entity_name=ENTITY_AST_DISPOSAL,
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

    def approve(
        self,
        ctx: TenantContext,
        row_id: UUID,
        comments: str | None = None,
        *,
        ceo_instruction: str | None = None,
    ):
        instruction = str(ceo_instruction or comments or "").strip()
        if not instruction:
            raise DisposalValidationError(
                "CEO Instruction is required when approving a disposal request"
            )
        row = self.get(ctx, row_id)
        if row.created_by == ctx.user_id:
            raise SegregationOfDutiesError("Creator cannot approve own disposal")
        self._validator.validate_approve_readiness(ctx, row)
        self._assert_no_active_components(ctx, row.asset_id)

        if not asset_workflow_governance_enabled() or row.workflow_instance_id is None:
            return self._finalize_approval(
                ctx,
                row_id,
                ceo_instruction=instruction,
                comments=comments,
            )

        def on_approved() -> None:
            fresh = self.get(ctx, row_id)
            self._validator.validate_approve_readiness(ctx, fresh)
            self._assert_no_active_components(ctx, fresh.asset_id)
            self._engine.approve(fresh)
            self._repo.update(
                ctx,
                row_id,
                status=fresh.status,
                workflow_status=WorkflowStatus.APPROVED.value,
                ceo_instruction=instruction,
                approved_at=utcnow(),
                approved_by=ctx.user_id,
            )
            self._audit.log_entity_change(
                tenant_id=ctx.tenant_id,
                entity_name=ENTITY_AST_DISPOSAL,
                entity_id=row_id,
                operation="approve",
                performed_by=ctx.user_id,
                new_value={"ceo_instruction": instruction},
            )

        instance = self._governance.approve(
            ctx,
            instance_id=row.workflow_instance_id,
            entity_name=ENTITY_AST_DISPOSAL,
            entity_id=row_id,
            on_approved=on_approved,
            comments=comments or instruction,
            recipient_user_id=row.created_by,
        )
        if instance.status == WorkflowStatus.APPROVED:
            return self.get(ctx, row_id)
        return self._repo.update(ctx, row_id, workflow_status=instance.status.value)

    def _finalize_approval(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        ceo_instruction: str,
        comments: str | None,
    ):
        row = self.get(ctx, row_id)
        if row.status == AssetDisposalStatus.DRAFT.value:
            self._validator.validate_submit_readiness(ctx, row)
            self._engine.submit(row)
            self._repo.update(ctx, row_id, status=row.status)
            row = self.get(ctx, row_id)
        self._validator.validate_approve_readiness(ctx, row)
        self._assert_no_active_components(ctx, row.asset_id)
        self._engine.approve(row)
        updated = self._repo.update(
            ctx,
            row_id,
            status=row.status,
            workflow_status=WorkflowStatus.APPROVED.value,
            ceo_instruction=ceo_instruction,
            approved_at=utcnow(),
            approved_by=ctx.user_id,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_DISPOSAL,
            entity_id=row_id,
            operation="approve",
            performed_by=ctx.user_id,
            new_value={
                "ceo_instruction": ceo_instruction,
                "comments": comments,
            },
        )
        return updated

    def reject(
        self,
        ctx: TenantContext,
        row_id: UUID,
        comments: str | None = None,
        *,
        rejection_reason: str | None = None,
    ):
        reason = str(rejection_reason or comments or "").strip()
        if not reason:
            raise DisposalValidationError("Rejection reason is required")
        row = self.get(ctx, row_id)
        if row.status not in {
            AssetDisposalStatus.DRAFT.value,
            AssetDisposalStatus.SUBMITTED.value,
        }:
            raise DisposalValidationError("Only pending disposal requests can be rejected")

        def on_rejected() -> None:
            self._repo.update(
                ctx,
                row_id,
                status=AssetDisposalStatus.CANCELLED.value,
                workflow_status=WorkflowStatus.REJECTED.value,
                rejection_reason=reason,
            )
            self._restore_previous_ops(ctx, row_id, remarks=reason)

        if asset_workflow_governance_enabled() and row.workflow_instance_id is not None:
            self._governance.reject(
                ctx,
                instance_id=row.workflow_instance_id,
                entity_name=ENTITY_AST_DISPOSAL,
                entity_id=row_id,
                on_rejected=on_rejected,
                comments=reason,
                recipient_user_id=row.created_by,
            )
        else:
            on_rejected()
            self._audit.log_entity_change(
                tenant_id=ctx.tenant_id,
                entity_name=ENTITY_AST_DISPOSAL,
                entity_id=row_id,
                operation="reject",
                performed_by=ctx.user_id,
                new_value={"rejection_reason": reason},
            )
        return self.get(ctx, row_id)

    def _restore_previous_ops(self, ctx: TenantContext, row_id: UUID, *, remarks: str) -> None:
        row = self.get(ctx, row_id)
        asset = self._assets.lock_for_update(ctx, row.asset_id)
        if asset is None:
            return
        current = str(getattr(asset, "operational_status", "") or "").upper()
        pending = AssetOperationalStatus.PENDING_DISPOSAL.value
        if current != pending:
            return
        target = str(row.previous_operational_status or AssetOperationalStatus.READY_TO_MOVE.value).upper()
        if target == pending:
            target = AssetOperationalStatus.READY_TO_MOVE.value
        allowed = {
            AssetOperationalStatus.READY_TO_MOVE.value,
            AssetOperationalStatus.ASSIGNED.value,
            AssetOperationalStatus.RETIRED.value,
        }
        if target not in allowed:
            target = AssetOperationalStatus.READY_TO_MOVE.value
        self._operational.transition(
            ctx,
            asset.id,
            target_status=target,
            expected_version=int(asset.version or 1),
            reason="disposal_rejected",
            remarks=remarks,
            source_entity=ENTITY_AST_DISPOSAL,
            source_entity_id=row_id,
        )

    def complete(self, ctx: TenantContext, row_id: UUID):
        """IT Admin completes physical disposal after CEO approval (no finance required)."""
        row = self.get(ctx, row_id)
        if row.status != AssetDisposalStatus.APPROVED.value:
            raise DisposalValidationError(
                "Only CEO-approved disposals can be completed"
            )
        self._assert_no_active_components(ctx, row.asset_id)
        asset = self._assets.lock_for_update(ctx, row.asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        ops = str(getattr(asset, "operational_status", "") or "").upper()
        if ops != AssetOperationalStatus.PENDING_DISPOSAL.value:
            raise DisposalValidationError(
                "Asset must remain in Disposal status until completion"
            )

        disposal_date = row.disposal_date or date.today()
        self._engine.post(row)
        updated = self._repo.update(
            ctx,
            row_id,
            status=row.status,
            disposal_date=disposal_date,
            completed_at=utcnow(),
            completed_by=ctx.user_id,
            version=int(row.version or 1),
        )

        self._asset_engine.dispose(asset, disposal_type=row.disposal_type)
        updated_asset = self._assets.update(ctx, asset.id, status=asset.status)
        asset_version = int((updated_asset or asset).version or 1)
        if asset.master_asset_id is not None:
            self._master.mark_master_disposed(ctx, asset.master_asset_id)
        self._operational.apply_action(
            ctx,
            asset.id,
            action="complete_disposal",
            expected_version=asset_version,
            reason="disposal_complete",
            remarks=row.ceo_instruction or row.remarks,
            source_entity=ENTITY_AST_DISPOSAL,
            source_entity_id=row_id,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_DISPOSAL,
            entity_id=row_id,
            operation="complete",
            performed_by=ctx.user_id,
            new_value={
                "status": AssetDisposalStatus.POSTED.value,
                "completed_at": str(updated.completed_at) if updated else None,
            },
        )
        return updated

    def cancel_draft(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        if row.workflow_instance_id is not None:
            raise InvalidAssetWorkflowState("Cannot cancel after workflow started")
        self._engine.cancel_draft(row)
        updated = self._repo.update(ctx, row_id, status=row.status)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_DISPOSAL,
            entity_id=row_id,
            operation="cancel",
            performed_by=ctx.user_id,
        )
        return updated

    def reopen(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._validator.validate_reopen_readiness(ctx, row)
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
            entity_name=ENTITY_AST_DISPOSAL,
            entity_id=row_id,
            operation="reopen",
            performed_by=ctx.user_id,
        )
        return updated

    def resubmit(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        if (
            row.status == AssetDisposalStatus.CANCELLED.value
            and row.workflow_status == WorkflowStatus.REJECTED.value
        ):
            self.reopen(ctx, row_id)
        return self.submit(ctx, row_id)

    def post(
        self,
        ctx: TenantContext,
        row_id: UUID,
        debit_account_id: UUID,
        credit_account_id: UUID,
        fiscal_year_id: UUID | None = None,
    ):
        row = self.get(ctx, row_id)
        self._validator.validate_post_readiness(ctx, row)
        self._assert_no_active_components(ctx, row.asset_id)

        # Optimistic claim before Finance so a concurrent post fails without a second journal.
        claimed = self._repo.update(ctx, row_id, version=int(row.version or 1))
        if claimed is None:
            raise NotFoundException("Asset disposal not found")

        amount = Decimal(
            str(claimed.book_value_at_disposal or claimed.proceeds_amount or 0)
        )
        journal_id = self._finance.post_disposal(
            ctx,
            claimed,
            amount=amount,
            debit_account_id=debit_account_id,
            credit_account_id=credit_account_id,
            fiscal_year_id=fiscal_year_id,
        )
        self._engine.post(claimed)
        updated = self._repo.update(
            ctx,
            row_id,
            status=claimed.status,
            finance_journal_id=journal_id,
            version=int(claimed.version or 1),
        )

        asset = self._assets.get(ctx, claimed.asset_id)
        asset_version: int | None = None
        if asset is not None:
            asset_version = int(asset.version or 1)
            self._asset_engine.dispose(asset, disposal_type=claimed.disposal_type)
            updated_asset = self._assets.update(ctx, asset.id, status=asset.status)
            if updated_asset is not None:
                asset_version = int(updated_asset.version or 1)
            if asset.master_asset_id is not None:
                self._master.mark_master_disposed(ctx, asset.master_asset_id)
            self._operational.apply_action(
                ctx,
                asset.id,
                action="complete_disposal",
                expected_version=asset_version,
                reason="disposal_post",
                source_entity=ENTITY_AST_DISPOSAL,
                source_entity_id=row_id,
            )

        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_DISPOSAL,
            entity_id=row_id,
            operation="post",
            performed_by=ctx.user_id,
            new_value={
                "finance_journal_id": str(journal_id),
                "asset_status": asset.status if asset is not None else None,
            },
        )
        return updated

    def _legacy_approve(self, ctx: TenantContext, row_id: UUID, row: AstAssetDisposal):
        """Non-production path when ASSET_WORKFLOW_GOVERNANCE_ENABLED=false."""
        if row.status == AssetDisposalStatus.DRAFT.value:
            self._validator.validate_submit_readiness(ctx, row)
            self._assert_no_active_components(ctx, row.asset_id)
            self._engine.submit(row)
            self._repo.update(ctx, row_id, status=row.status)
            row = self.get(ctx, row_id)
        self._validator.validate_approve_readiness(ctx, row)
        self._assert_no_active_components(ctx, row.asset_id)
        self._engine.approve(row)
        return self._repo.update(
            ctx,
            row_id,
            status=row.status,
            workflow_status=WorkflowStatus.APPROVED.value,
        )
