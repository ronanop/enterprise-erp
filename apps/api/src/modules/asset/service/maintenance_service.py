"""MaintenanceService — work-order governance (FP-ASSET-004)."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.asset.domain.enums import (
    AssetMaintenanceStatus,
    AssetOperationalStatus,
    AssetStatus,
    AstEntityType,
)
from modules.asset.domain.exceptions import (
    InvalidAssetWorkflowState,
    MaintenanceApprovalPendingError,
    MaintenanceValidationError,
    SegregationOfDutiesError,
)
from modules.asset.domain.workflow_codes import ENTITY_AST_MAINTENANCE
from modules.asset.models import AstAsset, AstAssetMaintenance
from modules.asset.schemas import AssetMaintenanceResponse
from modules.asset.repository.asset_maintenance_repository import (
    AssetMaintenanceListFilters,
    AssetMaintenanceRepository,
)
from modules.asset.repository.asset_repository import AssetRepository
from modules.asset.repository.base import utcnow
from modules.asset.service.asset_scope_validator import AssetScopeValidator
from modules.asset.service.asset_operational_status_service import AssetOperationalStatusService
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
        self._operational = AssetOperationalStatusService(db)

    @staticmethod
    def _asset_snapshot(asset: AstAsset | None) -> dict[str, str | None]:
        if asset is None:
            return {
                "asset_code": None,
                "asset_name": None,
                "serial_number": None,
                "make": None,
                "model": None,
            }
        return {
            "asset_code": asset.asset_code,
            "asset_name": asset.asset_name,
            "serial_number": asset.serial_number,
            "make": asset.make,
            "model": asset.model,
        }

    def to_response(
        self,
        ctx: TenantContext,
        row: AstAssetMaintenance,
        *,
        asset: AstAsset | None = None,
    ) -> AssetMaintenanceResponse:
        if asset is None:
            assets = self._assets.get_by_ids(ctx, [row.asset_id])
            asset = assets[0] if assets else None
        return AssetMaintenanceResponse.model_validate(row).model_copy(
            update=self._asset_snapshot(asset)
        )

    def to_response_list(
        self,
        ctx: TenantContext,
        rows: list[AstAssetMaintenance],
    ) -> list[AssetMaintenanceResponse]:
        if not rows:
            return []
        asset_ids = list({row.asset_id for row in rows})
        asset_map = {asset.id: asset for asset in self._assets.get_by_ids(ctx, asset_ids)}
        return [
            self.to_response(ctx, row, asset=asset_map.get(row.asset_id)) for row in rows
        ]

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
        open_only: bool = False,
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
            open_only=open_only,
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
        scheduled_date = fields.get("scheduled_date") or date.today()
        row = self._repo.create(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            document_number=doc,
            asset_id=asset.id,
            maintenance_type=fields["maintenance_type"],
            maintenance_plan_id=fields.get("maintenance_plan_id"),
            scheduled_date=scheduled_date,
            reason=fields.get("reason"),
            expected_duration_days=fields.get("expected_duration_days"),
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
        if asset.operational_status != AssetOperationalStatus.IN_MAINTENANCE.value:
            self._operational.apply_action(
                ctx,
                asset.id,
                action="start_maintenance",
                source_entity=ENTITY_AST_MAINTENANCE,
                source_entity_id=row_id,
                reason="maintenance_start",
            )
        updated = self._repo.update(ctx, row_id, status=row.status)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_MAINTENANCE,
            entity_id=row_id,
            operation="start",
            performed_by=ctx.user_id,
            new_value={
                "asset_status": AssetStatus.IN_MAINTENANCE.value,
                "operational_status": AssetOperationalStatus.IN_MAINTENANCE.value,
            },
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
        if asset is not None and other_open is None:
            if asset.status == AssetStatus.IN_MAINTENANCE.value:
                self._assets.update(ctx, asset.id, status=AssetStatus.ACTIVE.value)
            asset = self._assets.get(ctx, row.asset_id)
            if (
                asset is not None
                and asset.operational_status == AssetOperationalStatus.IN_MAINTENANCE.value
            ):
                self._operational.apply_action(
                    ctx,
                    asset.id,
                    action="complete_maintenance",
                    source_entity=ENTITY_AST_MAINTENANCE,
                    source_entity_id=row_id,
                    reason="maintenance_complete",
                )

        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_MAINTENANCE,
            entity_id=row_id,
            operation="complete",
            performed_by=ctx.user_id,
            new_value={
                "asset_status": AssetStatus.ACTIVE.value if other_open is None else None,
                "operational_status": (
                    AssetOperationalStatus.READY_TO_MOVE.value if other_open is None else None
                ),
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

    def quick_create_draft(self, ctx: TenantContext, *, asset_id: UUID, company_id: UUID | None = None):
        """Create a minimal draft WO for an asset (inventory Maintenance action)."""
        asset = self._assets.get(ctx, asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        return self.create(
            ctx,
            branch_id=asset.branch_id,
            company_id=company_id,
            asset_id=asset_id,
            maintenance_type="preventive",
            scheduled_date=date.today(),
        )

    def start_maintenance(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        reason: str,
        expected_duration_days: int,
        maintenance_type: str | None = None,
        scheduled_date: date | None = None,
        vendor_id: UUID | None = None,
        cost_amount=None,
        technician_employee_id: UUID | None = None,
        version: int | None = None,
    ) -> tuple[AstAssetMaintenance, str, str | None]:
        """Drive create→submit→approve→start using existing service methods.

        Returns (row, outcome_status, message) where outcome_status is
        ``started`` or ``approval_pending``.
        """
        self._validator.validate_start_maintenance_fields(
            reason=reason,
            expected_duration_days=expected_duration_days,
        )
        row = self.get(ctx, row_id)
        if row.status not in {
            AssetMaintenanceStatus.DRAFT.value,
            AssetMaintenanceStatus.SUBMITTED.value,
            AssetMaintenanceStatus.APPROVED.value,
            AssetMaintenanceStatus.SCHEDULED.value,
        }:
            raise MaintenanceValidationError(
                "Only draft or pre-start maintenance work orders can be started from this action"
            )

        update_fields: dict = {
            "reason": reason.strip(),
            "expected_duration_days": expected_duration_days,
            "scheduled_date": scheduled_date or row.scheduled_date or date.today(),
        }
        if maintenance_type is not None:
            update_fields["maintenance_type"] = maintenance_type
        if vendor_id is not None:
            update_fields["vendor_id"] = vendor_id
        if cost_amount is not None:
            update_fields["cost_amount"] = cost_amount
        if technician_employee_id is not None:
            update_fields["technician_employee_id"] = technician_employee_id
        if version is not None:
            update_fields["version"] = version

        if row.status == AssetMaintenanceStatus.DRAFT.value:
            row = self.update(ctx, row_id, **update_fields)
        else:
            row = self.get(ctx, row_id)

        if row.status == AssetMaintenanceStatus.DRAFT.value:
            row = self.submit(ctx, row_id)

        row = self.get(ctx, row_id)
        if row.status == AssetMaintenanceStatus.SUBMITTED.value:
            try:
                row = self.approve(ctx, row_id)
            except SegregationOfDutiesError as exc:
                raise MaintenanceApprovalPendingError(
                    "Maintenance submitted. Approval from another user is required before start."
                ) from exc
            row = self.get(ctx, row_id)
            if row.status == AssetMaintenanceStatus.SUBMITTED.value:
                raise MaintenanceApprovalPendingError(
                    "Maintenance submitted. Workflow approval is pending before start."
                )

        row = self.get(ctx, row_id)
        if row.status in {
            AssetMaintenanceStatus.APPROVED.value,
            AssetMaintenanceStatus.SCHEDULED.value,
        }:
            row = self.start(ctx, row_id)
            return row, "started", None

        if row.status == AssetMaintenanceStatus.IN_PROGRESS.value:
            return row, "started", None

        raise MaintenanceValidationError(
            f"Maintenance cannot be started from status {row.status}"
        )

    def get_timeline(self, ctx: TenantContext, row_id: UUID) -> list[dict]:
        row = self.get(ctx, row_id)
        events: list[dict] = []
        audit_rows = self._audit.list_logs_for_entity(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_MAINTENANCE,
            entity_id=row_id,
        )
        op_labels = {
            "create": "Work order created",
            "update": "Work order updated",
            "submit": "Submitted for approval",
            "approve": "Approved",
            "cancel": "Cancelled",
            "reopen": "Reopened",
            "schedule": "Scheduled",
            "start": "Maintenance started",
            "complete": "Maintenance completed",
        }
        for entry in audit_rows:
            detail = None
            if entry.new_value:
                detail = ", ".join(f"{k}={v}" for k, v in entry.new_value.items() if v is not None)
            events.append(
                {
                    "id": f"audit-{entry.id}",
                    "kind": "audit",
                    "label": op_labels.get(entry.operation, entry.operation.title()),
                    "occurred_at": entry.performed_at,
                    "performed_by": entry.performed_by,
                    "detail": detail,
                }
            )

        histories, _ = self._history.search(
            ctx,
            company_id=row.company_id,
            maintenance_id=row_id,
            offset=0,
            limit=5,
        )
        for hist in histories:
            events.append(
                {
                    "id": f"service-{hist.id}",
                    "kind": "service_history",
                    "label": "Service recorded",
                    "occurred_at": hist.serviced_at or getattr(hist, "created_at", None),
                    "performed_by": hist.created_by,
                    "detail": hist.service_summary,
                }
            )

        events.sort(key=lambda e: e["occurred_at"] or utcnow())
        return events
