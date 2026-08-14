"""MaintenanceService — work-order governance (FP-ASSET-004)."""

from datetime import date
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.asset.domain.enums import (
    AssetMaintenanceStatus,
    AssetStatus,
    AstEntityType,
)
from modules.asset.domain.exceptions import (
    InvalidAssetWorkflowState,
    MaintenanceValidationError,
    SegregationOfDutiesError,
)
from modules.asset.domain.workflow_codes import ENTITY_AST_MAINTENANCE
from modules.asset.models import AstAssetMaintenance
from modules.asset.repository.asset_maintenance_repository import (
    AssetMaintenanceListFilters,
    AssetMaintenanceRepository,
)
from modules.asset.repository.asset_repository import AssetRepository
from modules.asset.repository.base import utcnow
from modules.asset.service.asset_scope_validator import AssetScopeValidator
from modules.asset.service.document_number_service import DocumentNumberService
from modules.asset.service.engines import AssetMaintenanceEngine
from modules.asset.service.governance_service import AssetGovernanceService
from modules.asset.service.maintenance_validator import MaintenanceValidator
from modules.asset.service.service_history_service import ServiceHistoryService
from modules.asset.service.workflow_governance_settings import asset_workflow_governance_enabled
from modules.foundation.domain.enums import WorkflowStatus
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService


class MaintenanceService:
    def __init__(self, db: Session) -> None:
        self._repo = AssetMaintenanceRepository(db)
        self._assets = AssetRepository(db)
        self._history = ServiceHistoryService(db)
        self._scope = AssetScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = AssetMaintenanceEngine()
        self._audit = AuditService(db)
        self._governance = AssetGovernanceService(db)
        self._validator = MaintenanceValidator(db)

    def search(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        asset_id: UUID | None = None,
        branch_id: UUID | None = None,
        status: str | None = None,
        maintenance_type: str | None = None,
        search: str | None = None,
        offset: int = 0,
        limit: int = 25,
    ) -> tuple[list[AstAssetMaintenance], int]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        filters = AssetMaintenanceListFilters(
            company_id=cid,
            asset_id=asset_id,
            branch_id=branch_id,
            status=status,
            maintenance_type=maintenance_type,
            search=search,
        )
        return self._repo.search(ctx, filters, offset=offset, limit=limit)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstAssetMaintenance:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Asset maintenance not found")
        return row

    def create(self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        self._validator.validate_create_fields(ctx, company_id=cid, fields=fields)

        asset = self._assets.get(ctx, fields["asset_id"])
        if asset is None:
            raise NotFoundException("Asset not found")
        if asset.branch_id != branch_id:
            raise MaintenanceValidationError(
                "Maintenance branch must match the asset's current branch"
            )

        doc = self._numbers.generate(
            AstEntityType.MAINTENANCE,
            cid,
            AstAssetMaintenance,
            "document_number",
            ctx=ctx,
        )
        row = self._repo.create(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            document_number=doc,
            asset_id=asset.id,
            maintenance_type=fields["maintenance_type"],
            maintenance_plan_id=fields.get("maintenance_plan_id"),
            scheduled_date=fields.get("scheduled_date"),
            vendor_id=fields.get("vendor_id"),
            cost_amount=fields.get("cost_amount"),
            technician_employee_id=fields.get("technician_employee_id"),
            quality_inspection_id=fields.get("quality_inspection_id"),
            status=AssetMaintenanceStatus.DRAFT.value,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_MAINTENANCE,
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
            raise NotFoundException("Asset maintenance not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_MAINTENANCE,
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
            entity_name=ENTITY_AST_MAINTENANCE,
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
        self._validator.validate_approve_readiness(ctx, row)
        if not asset_workflow_governance_enabled():
            return self._legacy_approve(ctx, row_id, row)
        if row.created_by == ctx.user_id:
            raise SegregationOfDutiesError("Creator cannot approve own maintenance")
        if row.workflow_instance_id is None:
            raise InvalidAssetWorkflowState("Maintenance has no workflow instance")

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
                entity_name=ENTITY_AST_MAINTENANCE,
                entity_id=row_id,
                operation="approve",
                performed_by=ctx.user_id,
            )

        instance = self._governance.approve(
            ctx,
            instance_id=row.workflow_instance_id,
            entity_name=ENTITY_AST_MAINTENANCE,
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
            raise InvalidAssetWorkflowState("Maintenance has no workflow instance")

        def on_rejected() -> None:
            self._repo.update(
                ctx,
                row_id,
                status=AssetMaintenanceStatus.CANCELLED.value,
                workflow_status=WorkflowStatus.REJECTED.value,
            )

        self._governance.reject(
            ctx,
            instance_id=row.workflow_instance_id,
            entity_name=ENTITY_AST_MAINTENANCE,
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
            entity_name=ENTITY_AST_MAINTENANCE,
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
            entity_name=ENTITY_AST_MAINTENANCE,
            entity_id=row_id,
            operation="reopen",
            performed_by=ctx.user_id,
        )
        return updated

    def resubmit(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        if (
            row.status == AssetMaintenanceStatus.CANCELLED.value
            and row.workflow_status == WorkflowStatus.REJECTED.value
        ):
            self.reopen(ctx, row_id)
        return self.submit(ctx, row_id)

    def schedule(self, ctx: TenantContext, row_id: UUID, *, scheduled_date: date | None = None):
        row = self.get(ctx, row_id)
        self._engine.schedule(row)
        fields: dict = {"status": row.status}
        if scheduled_date is not None:
            fields["scheduled_date"] = scheduled_date
        elif row.scheduled_date is None:
            fields["scheduled_date"] = date.today()
        updated = self._repo.update(ctx, row_id, **fields)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_MAINTENANCE,
            entity_id=row_id,
            operation="schedule",
            performed_by=ctx.user_id,
        )
        return updated

    def start(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._validator.validate_start_readiness(ctx, row)
        self._engine.start(row)
        asset = self._assets.get(ctx, row.asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        if asset.status != AssetStatus.IN_MAINTENANCE.value:
            self._assets.update(ctx, asset.id, status=AssetStatus.IN_MAINTENANCE.value)
        updated = self._repo.update(ctx, row_id, status=row.status)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_MAINTENANCE,
            entity_id=row_id,
            operation="start",
            performed_by=ctx.user_id,
            new_value={"asset_status": AssetStatus.IN_MAINTENANCE.value},
        )
        return updated

    def complete(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._validator.validate_complete_readiness(ctx, row)
        self._engine.complete(row)
        now = utcnow()
        updated = self._repo.update(
            ctx,
            row_id,
            status=row.status,
            completed_date=date.today(),
        )

        summary = f"{row.maintenance_type.replace('_', ' ').title()} maintenance completed"
        if row.cost_amount is not None:
            summary = f"{summary} (cost={row.cost_amount})"
        self._history.record_from_maintenance(
            ctx,
            company_id=row.company_id,
            branch_id=row.branch_id,
            asset_id=row.asset_id,
            maintenance_id=row.id,
            service_summary=summary,
            cost_amount=row.cost_amount,
            serviced_at=now,
        )

        other_open = self._repo.find_open_for_asset(ctx, row.asset_id, exclude_id=row.id)
        asset = self._assets.get(ctx, row.asset_id)
        if asset is not None and other_open is None and asset.status == AssetStatus.IN_MAINTENANCE.value:
            self._assets.update(ctx, asset.id, status=AssetStatus.ACTIVE.value)

        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_MAINTENANCE,
            entity_id=row_id,
            operation="complete",
            performed_by=ctx.user_id,
            new_value={
                "asset_status": AssetStatus.ACTIVE.value if other_open is None else None,
            },
        )
        return updated

    def _legacy_approve(self, ctx: TenantContext, row_id: UUID, row: AstAssetMaintenance):
        """Non-production path when ASSET_WORKFLOW_GOVERNANCE_ENABLED=false."""
        if row.status == AssetMaintenanceStatus.DRAFT.value:
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
