"""Asset assignment service (FP-ASSET-003)."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.asset.adapters.master_data_port import AssetMasterDataAdapter
from modules.asset.domain.enums import AssetAssignmentStatus, AstEntityType
from modules.asset.domain.exceptions import (
    AssignmentValidationError,
    InvalidAssetWorkflowState,
    SegregationOfDutiesError,
)
from modules.asset.domain.workflow_codes import ENTITY_AST_ASSIGNMENT
from modules.asset.models import AstAssetAssignment
from modules.asset.repository.asset_assignment_repository import (
    AssetAssignmentListFilters,
    AssetAssignmentRepository,
)
from modules.asset.repository.asset_repository import AssetRepository
from modules.asset.repository.base import utcnow
from modules.asset.service.asset_scope_validator import AssetScopeValidator
from modules.asset.service.assignment_validator import AssignmentValidator
from modules.asset.service.document_number_service import DocumentNumberService
from modules.asset.service.engines import AssetAssignmentEngine
from modules.asset.service.governance_service import AssetGovernanceService
from modules.asset.service.workflow_governance_settings import asset_workflow_governance_enabled
from modules.foundation.domain.enums import WorkflowStatus
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService


class AssignmentService:
    def __init__(self, db: Session) -> None:
        self._repo = AssetAssignmentRepository(db)
        self._assets = AssetRepository(db)
        self._scope = AssetScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = AssetAssignmentEngine()
        self._governance = AssetGovernanceService(db)
        self._master = AssetMasterDataAdapter(db)
        self._validator = AssignmentValidator(db)
        self._audit = AuditService(db)

    def search(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        asset_id: UUID | None = None,
        branch_id: UUID | None = None,
        status: str | None = None,
        allocation_type: str | None = None,
        search: str | None = None,
        offset: int = 0,
        limit: int = 25,
    ) -> tuple[list[AstAssetAssignment], int]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        filters = AssetAssignmentListFilters(
            company_id=cid,
            asset_id=asset_id,
            branch_id=branch_id,
            status=status,
            allocation_type=allocation_type,
            search=search,
        )
        return self._repo.search(ctx, filters, offset=offset, limit=limit)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstAssetAssignment:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Asset assignment not found")
        return row

    def create(self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        self._validator.validate_create_fields(ctx, company_id=cid, fields=fields)

        asset = self._assets.get(ctx, fields["asset_id"])
        if asset is None:
            raise NotFoundException("Asset not found")
        if fields.get("allocation_type") in {"employee", "department", "project"}:
            if asset.branch_id != branch_id:
                raise AssignmentValidationError(
                    "Assignment branch must match the asset's current branch"
                )

        doc = self._numbers.generate(
            AstEntityType.ASSIGNMENT,
            cid,
            AstAssetAssignment,
            "document_number",
            ctx=ctx,
        )
        row = self._repo.create(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            document_number=doc,
            asset_id=asset.id,
            allocation_type=fields["allocation_type"],
            employee_id=fields.get("employee_id"),
            department_id=fields.get("department_id"),
            project_id=fields.get("project_id"),
            expected_return_at=fields.get("expected_return_at"),
            status=AssetAssignmentStatus.DRAFT.value,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_ASSIGNMENT,
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
            raise NotFoundException("Asset assignment not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_ASSIGNMENT,
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
            entity_name=ENTITY_AST_ASSIGNMENT,
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
            raise SegregationOfDutiesError("Creator cannot approve own assignment")
        if row.workflow_instance_id is None:
            raise InvalidAssetWorkflowState("Assignment has no workflow instance")

        def on_approved() -> None:
            self._activate_assignment(ctx, row_id)

        instance = self._governance.approve(
            ctx,
            instance_id=row.workflow_instance_id,
            entity_name=ENTITY_AST_ASSIGNMENT,
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
            raise InvalidAssetWorkflowState("Assignment has no workflow instance")

        def on_rejected() -> None:
            self._repo.update(
                ctx,
                row_id,
                status=AssetAssignmentStatus.CANCELLED.value,
                workflow_status=WorkflowStatus.REJECTED.value,
            )

        self._governance.reject(
            ctx,
            instance_id=row.workflow_instance_id,
            entity_name=ENTITY_AST_ASSIGNMENT,
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
            entity_name=ENTITY_AST_ASSIGNMENT,
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
            entity_name=ENTITY_AST_ASSIGNMENT,
            entity_id=row_id,
            operation="reopen",
            performed_by=ctx.user_id,
        )
        return updated

    def resubmit(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        if (
            row.status == AssetAssignmentStatus.CANCELLED.value
            and row.workflow_status == WorkflowStatus.REJECTED.value
        ):
            self.reopen(ctx, row_id)
        return self.submit(ctx, row_id)

    def return_assignment(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.return_assignment(row)
        now = utcnow()
        asset = self._assets.get(ctx, row.asset_id)
        master_payload: dict = {}
        if (
            asset is not None
            and row.allocation_type == "employee"
            and row.employee_id is not None
            and asset.custodian_employee_id == row.employee_id
        ):
            self._assets.update(ctx, asset.id, custodian_employee_id=None)
            master_payload["custodian_employee_id"] = None
            if asset.master_asset_id is not None:
                self._master.update_master_asset_transfer(
                    ctx, asset.master_asset_id, custodian_employee_id=None
                )

        updated = self._repo.update(
            ctx,
            row_id,
            status=row.status,
            returned_at=now,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_ASSIGNMENT,
            entity_id=row_id,
            operation="return",
            performed_by=ctx.user_id,
            new_value={k: str(v) if v is not None else None for k, v in master_payload.items()},
        )
        return updated

    def _legacy_approve(self, ctx: TenantContext, row_id: UUID, row: AstAssetAssignment):
        """Non-production path when ASSET_WORKFLOW_GOVERNANCE_ENABLED=false."""
        if row.status == AssetAssignmentStatus.DRAFT.value:
            self._engine.submit(row)
        self._repo.update(ctx, row_id, status=row.status)
        self._activate_assignment(ctx, row_id)
        return self.get(ctx, row_id)

    def _activate_assignment(self, ctx: TenantContext, row_id: UUID) -> None:
        assignment = self.get(ctx, row_id)
        asset = self._assets.get(ctx, assignment.asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        self._validator.validate_activate_readiness(ctx, assignment)

        self._engine.approve(assignment)
        self._engine.activate(assignment)

        asset_updates: dict = {}
        if assignment.allocation_type == "employee" and assignment.employee_id is not None:
            asset_updates["custodian_employee_id"] = assignment.employee_id
        elif assignment.allocation_type == "department" and assignment.department_id is not None:
            asset_updates["department_id"] = assignment.department_id
        elif assignment.allocation_type in {"branch", "warehouse"}:
            if assignment.branch_id is not None and assignment.branch_id != asset.branch_id:
                if asset.company_id == assignment.company_id:
                    asset_updates["branch_id"] = assignment.branch_id

        if asset_updates:
            self._assets.update(ctx, asset.id, **asset_updates)
            if asset.master_asset_id is not None:
                master_fields = {
                    k: v
                    for k, v in asset_updates.items()
                    if k in {"branch_id", "custodian_employee_id"}
                }
                if master_fields:
                    self._master.update_master_asset_transfer(
                        ctx, asset.master_asset_id, **master_fields
                    )

        now = utcnow()
        self._repo.update(
            ctx,
            row_id,
            status=assignment.status,
            workflow_status=WorkflowStatus.APPROVED.value,
            allocated_at=now,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_ASSIGNMENT,
            entity_id=row_id,
            operation="assignment_activate",
            performed_by=ctx.user_id,
            new_value={k: str(v) for k, v in asset_updates.items()},
        )
