"""DisposalService — retirement governance (FP-ASSET-005)."""

from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.asset.adapters.finance_port import AssetFinanceAdapter
from modules.asset.adapters.master_data_port import AssetMasterDataAdapter
from modules.asset.domain.enums import AssetDisposalStatus, AstEntityType
from modules.asset.domain.exceptions import (
    DisposalValidationError,
    InvalidAssetWorkflowState,
    SegregationOfDutiesError,
)
from modules.asset.domain.workflow_codes import ENTITY_AST_DISPOSAL
from modules.asset.models import AstAssetDisposal
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
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        self._validator.validate_create_fields(ctx, company_id=cid, fields=fields)

        asset = self._assets.get(ctx, fields["asset_id"])
        if asset is None:
            raise NotFoundException("Asset not found")
        if asset.branch_id != branch_id:
            raise DisposalValidationError(
                "Disposal branch must match the asset's current branch"
            )

        doc = self._numbers.generate(
            AstEntityType.DISPOSAL,
            cid,
            AstAssetDisposal,
            "document_number",
            ctx=ctx,
        )
        row = self._repo.create(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            document_number=doc,
            asset_id=asset.id,
            disposal_type=fields["disposal_type"],
            disposal_date=fields.get("disposal_date"),
            proceeds_amount=fields.get("proceeds_amount"),
            book_value_at_disposal=fields.get("book_value_at_disposal"),
            status=AssetDisposalStatus.DRAFT.value,
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
            },
        )
        return row

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

    def approve(self, ctx: TenantContext, row_id: UUID, comments: str | None = None):
        row = self.get(ctx, row_id)
        if not asset_workflow_governance_enabled():
            return self._legacy_approve(ctx, row_id, row)
        if row.created_by == ctx.user_id:
            raise SegregationOfDutiesError("Creator cannot approve own disposal")
        if row.workflow_instance_id is None:
            raise InvalidAssetWorkflowState("Disposal has no workflow instance")

        def on_approved() -> None:
            fresh = self.get(ctx, row_id)
            self._engine.approve(fresh)
            self._repo.update(
                ctx,
                row_id,
                status=fresh.status,
                workflow_status=WorkflowStatus.APPROVED.value,
            )
            self._audit.log_entity_change(
                tenant_id=ctx.tenant_id,
                entity_name=ENTITY_AST_DISPOSAL,
                entity_id=row_id,
                operation="approve",
                performed_by=ctx.user_id,
            )

        instance = self._governance.approve(
            ctx,
            instance_id=row.workflow_instance_id,
            entity_name=ENTITY_AST_DISPOSAL,
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
            raise InvalidAssetWorkflowState("Disposal has no workflow instance")

        def on_rejected() -> None:
            self._repo.update(
                ctx,
                row_id,
                status=AssetDisposalStatus.CANCELLED.value,
                workflow_status=WorkflowStatus.REJECTED.value,
            )

        self._governance.reject(
            ctx,
            instance_id=row.workflow_instance_id,
            entity_name=ENTITY_AST_DISPOSAL,
            entity_id=row_id,
            on_rejected=on_rejected,
            comments=comments,
            recipient_user_id=row.created_by,
        )
        return self.get(ctx, row_id)

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
            self._engine.submit(row)
            self._repo.update(ctx, row_id, status=row.status)
            row = self.get(ctx, row_id)
        self._engine.approve(row)
        return self._repo.update(
            ctx,
            row_id,
            status=row.status,
            workflow_status=WorkflowStatus.APPROVED.value,
        )
