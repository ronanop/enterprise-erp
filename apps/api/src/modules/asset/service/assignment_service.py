"""Asset assignment service (FP-ASSET-003)."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.asset.adapters.master_data_port import AssetMasterDataAdapter
from modules.asset.domain.assignment_enrichment import (
    validate_draft_enrichment_fields,
    validate_return_remarks,
)
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
from modules.asset.schemas import AssetAssignmentResponse, AssignmentComponentResponse
from modules.asset.service.asset_operational_status_service import AssetOperationalStatusService
from modules.asset.service.asset_scope_validator import AssetScopeValidator
from modules.asset.service.assignment_component_service import AssignmentComponentService
from modules.asset.service.assignment_validator import ALLOCATION_IDENTITY_KEYS, AssignmentValidator
from modules.asset.service.document_number_service import DocumentNumberService
from modules.asset.service.engines import AssetAssignmentEngine
from modules.asset.service.governance_service import AssetGovernanceService
from modules.asset.service.workflow_governance_settings import asset_workflow_governance_enabled
from modules.foundation.domain.enums import WorkflowStatus
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService


def _json_safe_component_returns_for_audit(
    component_returns: list[dict] | None,
) -> list[dict] | None:
    """Copy return lines for JSONB audit; stringify nested UUID component_id only.

    Custody reconciliation must keep receiving the original UUID-typed list.
    """
    if component_returns is None:
        return None
    safe: list[dict] = []
    for line in component_returns:
        copy = dict(line)
        cid = copy.get("component_id")
        if cid is not None:
            copy["component_id"] = str(cid)
        safe.append(copy)
    return safe


class AssignmentService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = AssetAssignmentRepository(db)
        self._assets = AssetRepository(db)
        self._scope = AssetScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = AssetAssignmentEngine()
        self._governance = AssetGovernanceService(db)
        self._master = AssetMasterDataAdapter(db)
        self._validator = AssignmentValidator(db)
        self._audit = AuditService(db)
        self._operational = AssetOperationalStatusService(db)
        self._assignment_components = AssignmentComponentService(db)

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

    def get_with_components(self, ctx: TenantContext, row_id: UUID) -> AssetAssignmentResponse:
        row = self.get(ctx, row_id)
        return self._to_response(ctx, row, include_components=True)

    def list_components(self, ctx: TenantContext, row_id: UUID) -> list[dict]:
        row = self.get(ctx, row_id)
        return self._assignment_components.list_for_assignment(ctx, row)

    def set_components(
        self, ctx: TenantContext, row_id: UUID, component_ids: list[UUID]
    ) -> list[dict]:
        row = self.get(ctx, row_id)
        self._assignment_components.set_components(ctx, row, component_ids)
        return self._assignment_components.list_for_assignment(ctx, row)

    def create(self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        component_ids = fields.pop("component_ids", None)
        fields.pop("expected_return_at", None)
        enrichment = self._validator.validate_create_fields(ctx, company_id=cid, fields=fields)
        identity = self._validator.allocation_identity_payload(fields)

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
            status=AssetAssignmentStatus.DRAFT.value,
            **identity,
            **{k: v for k, v in enrichment.items() if k != "return_remarks"},
        )
        if component_ids is not None:
            self._assignment_components.set_components(ctx, row, component_ids)
        audit_payload = {
            "document_number": row.document_number,
            "asset_id": str(asset.id),
            **{k: v for k, v in enrichment.items() if v is not None},
        }
        if component_ids is not None:
            audit_payload["component_ids"] = [str(x) for x in component_ids]
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_ASSIGNMENT,
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
            new_value=audit_payload,
        )
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        row = self.get(ctx, row_id)
        component_ids = fields.pop("component_ids", None)
        fields.pop("expected_return_at", None)
        self._validator.validate_update_fields(ctx, row, fields)
        if ALLOCATION_IDENTITY_KEYS.intersection(fields):
            merged = {
                "allocation_type": fields.get("allocation_type", row.allocation_type),
                "employee_id": fields.get("employee_id", row.employee_id),
                "employee_source": fields.get(
                    "employee_source", getattr(row, "employee_source", None)
                ),
                "manual_employee_name": fields.get(
                    "manual_employee_name", getattr(row, "manual_employee_name", None)
                ),
                "manual_employee_phone": fields.get(
                    "manual_employee_phone", getattr(row, "manual_employee_phone", None)
                ),
                "manual_employee_email": fields.get(
                    "manual_employee_email", getattr(row, "manual_employee_email", None)
                ),
                "manual_employee_deployed_to": fields.get(
                    "manual_employee_deployed_to",
                    getattr(row, "manual_employee_deployed_to", None),
                ),
                "department_id": fields.get("department_id", row.department_id),
                "project_id": fields.get("project_id", row.project_id),
            }
            fields = {**fields, **self._validator.allocation_identity_payload(merged)}
        enrichment_keys = {
            "delivery_reference_number",
            "delivery_reference_status",
            "delivery_challan_signature_status",
            "assignment_remarks",
        }
        enrichment_patch = {k: fields[k] for k in enrichment_keys if k in fields}
        if enrichment_patch:
            merged = {
                "delivery_reference_number": enrichment_patch.get(
                    "delivery_reference_number", row.delivery_reference_number
                ),
                "delivery_reference_status": enrichment_patch.get(
                    "delivery_reference_status", row.delivery_reference_status
                ),
                "delivery_challan_signature_status": enrichment_patch.get(
                    "delivery_challan_signature_status",
                    getattr(row, "delivery_challan_signature_status", None),
                ),
                "assignment_remarks": enrichment_patch.get(
                    "assignment_remarks", row.assignment_remarks
                ),
            }
            enrichment = validate_draft_enrichment_fields(**merged)
            fields = {**fields, **enrichment}
        updated = self._repo.update(ctx, row_id, **fields)
        if updated is None:
            raise NotFoundException("Asset assignment not found")
        if component_ids is not None:
            self._assignment_components.set_components(ctx, updated, component_ids)
        audit_new = {k: fields[k] for k in enrichment_keys if k in fields}
        if component_ids is not None:
            audit_new["component_ids"] = [str(x) for x in component_ids]
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_ASSIGNMENT,
            entity_id=row_id,
            operation="update",
            performed_by=ctx.user_id,
            new_value=audit_new or None,
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
            self._assignment_components.release_issued(ctx, row_id)
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
        self._auto_cancel_assignment_dcs(
            ctx,
            row,
            remark=self._dc_auto_cancel_remark(row, "cancelled"),
        )
        return self.get(ctx, row_id)

    def cancel_draft(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        if row.workflow_instance_id is not None:
            raise InvalidAssetWorkflowState("Cannot cancel after workflow started")
        self._engine.cancel_draft(row)
        self._assignment_components.release_issued(ctx, row_id)
        updated = self._repo.update(ctx, row_id, status=row.status)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_ASSIGNMENT,
            entity_id=row_id,
            operation="cancel",
            performed_by=ctx.user_id,
        )
        self._auto_cancel_assignment_dcs(
            ctx,
            row,
            remark=self._dc_auto_cancel_remark(row, "cancelled"),
        )
        return updated

    def reopen(self, ctx: TenantContext, row_id: UUID):
        # Reopening an assignment must not revive a cancelled DC challan.
        # IT creates/links a new row once the old DC is CANCELLED (unique index).
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

    def return_assignment(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        return_condition: str = "good",
        reason: str | None = None,
        remarks: str | None = None,
        component_returns: list[dict] | None = None,
    ):
        row = self.get(ctx, row_id)
        self._validator.validate_return_readiness(ctx, row)
        action = self._validator.validate_return_request(
            return_condition=return_condition,
            return_remarks=remarks,
            reason=reason,
        )
        # Reconcile components first so a failure rolls back with the request UoW.
        self._assignment_components.reconcile_return(ctx, row, component_returns)
        # Detach asset-linked components → READY_TO_MOVE regardless of parent return_condition.
        from modules.asset.service.component_service import AssetComponentService

        AssetComponentService(self._db).detach_linked_for_parent(
            ctx,
            row.asset_id,
            reason=f"parent_assignment_return:{return_condition}",
            source_entity=ENTITY_AST_ASSIGNMENT,
            source_entity_id=row_id,
        )
        asset = self._assets.lock_for_update(ctx, row.asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        self._operational.apply_action(
            ctx,
            row.asset_id,
            action=action,
            expected_version=int(asset.version or 1),
            reason=reason or return_condition,
            remarks=remarks,
            source_entity=ENTITY_AST_ASSIGNMENT,
            source_entity_id=row_id,
        )
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

        normalized_remarks = validate_return_remarks(remarks)
        updated = self._repo.complete_return(
            ctx,
            row_id,
            status=row.status,
            returned_at=now,
            return_remarks=normalized_remarks,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_ASSIGNMENT,
            entity_id=row_id,
            operation="return",
            performed_by=ctx.user_id,
            new_value={
                **{k: str(v) if v is not None else None for k, v in master_payload.items()},
                "return_condition": return_condition,
                "return_remarks": normalized_remarks,
                "component_returns": _json_safe_component_returns_for_audit(
                    component_returns
                ),
            },
        )
        self._auto_cancel_assignment_dcs(
            ctx,
            row,
            remark=self._dc_auto_cancel_remark(row, "returned"),
        )
        return updated

    def _dc_auto_cancel_remark(self, assignment: AstAssetAssignment, action: str) -> str:
        doc = getattr(assignment, "document_number", None) or assignment.id
        return f"Auto-cancelled because assignment {doc} was {action}."

    def _auto_cancel_assignment_dcs(
        self, ctx: TenantContext, assignment: AstAssetAssignment, *, remark: str
    ) -> None:
        from modules.asset.service.dc_challan_service import DcChallanService

        DcChallanService(self._db).auto_cancel_for_assignment(
            ctx, assignment.id, remark=remark
        )

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

        asset_version = int(asset.version or 1)
        if asset_updates:
            updated_asset = self._assets.update(ctx, asset.id, **asset_updates)
            if updated_asset is not None:
                asset_version = int(updated_asset.version or 1)
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
        # Issue components atomically with activation (same request UoW).
        self._assignment_components.activate_issued(ctx, assignment)
        self._operational.apply_action(
            ctx,
            asset.id,
            action="assign",
            expected_version=asset_version,
            reason="assignment_activate",
            source_entity=ENTITY_AST_ASSIGNMENT,
            source_entity_id=row_id,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_ASSIGNMENT,
            entity_id=row_id,
            operation="assignment_activate",
            performed_by=ctx.user_id,
            new_value={
                **{k: str(v) for k, v in asset_updates.items()},
                "delivery_reference_number": getattr(
                    assignment, "delivery_reference_number", None
                ),
                "delivery_reference_status": getattr(
                    assignment, "delivery_reference_status", None
                ),
                "delivery_challan_signature_status": getattr(
                    assignment, "delivery_challan_signature_status", None
                ),
            },
        )

    def _to_response(
        self,
        ctx: TenantContext,
        row: AstAssetAssignment,
        *,
        include_components: bool = False,
    ) -> AssetAssignmentResponse:
        payload = AssetAssignmentResponse.model_validate(row)
        comps = self._assignment_components.list_for_assignment(ctx, row)
        payload.component_ids = [c["component_id"] for c in comps]
        if include_components:
            payload.components = [
                AssignmentComponentResponse.model_validate(c) for c in comps
            ]
        return payload
