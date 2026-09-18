"""Asset transfer service (FP-ASSET-002)."""

from __future__ import annotations

from datetime import date, datetime, time, timezone
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from core.redis import get_redis
from modules.asset.adapters.master_data_port import AssetMasterDataAdapter
from modules.asset.adapters.organization_port import AssetOrganizationAdapter
from modules.asset.domain.enums import (
    AssetTransferStatus,
    AssignmentComponentIssueStatus,
    AstEntityType,
)
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
from modules.asset.schemas import (
    UserTransferAssignRequest,
    UserTransferCompleteResponse,
    UserTransferComponentItem,
    UserTransferContextResponse,
    UserTransferReturnToStockRequest,
    UserTransferVerificationResponse,
)
from modules.asset.service.asset_scope_validator import AssetScopeValidator
from modules.asset.service.assignment_component_service import AssignmentComponentService
from modules.asset.service.document_number_service import DocumentNumberService
from modules.asset.service.engines import AssetLocationEngine, AssetTransferEngine
from modules.asset.service.governance_service import AssetGovernanceService
from modules.asset.service.transfer_validator import TransferValidator
from modules.asset.service.user_transfer_completion_service import (
    UserTransferCompletionService,
)
from modules.asset.service.workflow_governance_settings import asset_workflow_governance_enabled
from modules.foundation.domain.enums import WorkflowStatus
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService

_USER_TRANSFER_VERIFICATION_TTL_SECONDS = 60 * 60 * 8


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
        self._org = AssetOrganizationAdapter(db)
        self._validator = TransferValidator(db)
        self._assignment_components = AssignmentComponentService(db)
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

    def get_user_transfer_context(
        self, ctx: TenantContext, asset_id: UUID
    ) -> UserTransferContextResponse:
        """Load Assigned-asset context for the user-transfer entry page (Step 1/2)."""
        asset, assignment = self._validator.validate_user_transfer_eligibility(ctx, asset_id)

        current_user = None
        current_employee_id = assignment.employee_id
        if current_employee_id is not None:
            try:
                emp = self._master.get_employee(ctx, current_employee_id)
                first = str(getattr(emp, "first_name", "") or "").strip()
                last = str(getattr(emp, "last_name", "") or "").strip()
                name = f"{first} {last}".strip()
                code = str(getattr(emp, "employee_code", "") or "").strip()
                current_user = f"{code} — {name}".strip(" —") if code else (name or code or None)
            except NotFoundException:
                current_user = None
        elif (
            str(getattr(assignment, "employee_source", None) or "").strip().upper()
            == "MANUAL_ENTRY"
        ):
            manual_name = str(
                getattr(assignment, "manual_employee_name", None) or ""
            ).strip()
            current_user = manual_name or None

        department_name = None
        department_id = assignment.department_id or asset.department_id
        if department_id is not None:
            try:
                dept = self._org.get_department(ctx, department_id)
                department_name = getattr(dept, "department_name", None)
            except NotFoundException:
                department_name = None

        location_label = None
        current_loc = self._locations.find_current_for_asset(
            ctx, company_id=asset.company_id, asset_id=asset.id
        )
        if current_loc is not None:
            location_label = current_loc.location_label
        else:
            currents = self._locations.find_current(ctx, asset.id)
            if currents:
                location_label = currents[0].location_label

        component_rows = self._assignment_components.list_for_assignment(ctx, assignment)
        components: list[UserTransferComponentItem] = []
        for row in component_rows:
            status = str(row.get("issue_status") or "").upper()
            if status != AssignmentComponentIssueStatus.ISSUED.value:
                continue
            components.append(
                UserTransferComponentItem(
                    component_id=row["component_id"],
                    assignment_component_id=row["id"],
                    component_code=row.get("component_code"),
                    component_name=row.get("component_name") or row.get("linked_asset_name"),
                    component_type=row.get("component_type"),
                    serial_number=row.get("serial_number"),
                    issue_status=status,
                    linked_asset_code=row.get("linked_asset_code"),
                    linked_asset_name=row.get("linked_asset_name"),
                )
            )

        return UserTransferContextResponse(
            asset_id=asset.id,
            asset_code=asset.asset_code,
            asset_name=asset.asset_name,
            operational_status=str(asset.operational_status or ""),
            lifecycle_status=asset.status,
            current_user=current_user,
            current_employee_id=current_employee_id,
            department_id=department_id,
            department_name=department_name,
            location_label=location_label,
            assignment_id=assignment.id,
            assignment_document_number=assignment.document_number,
            assignment_allocated_at=assignment.allocated_at,
            assignment_status=assignment.status,
            components=components,
            company_id=asset.company_id,
            branch_id=asset.branch_id,
            version=int(asset.version or 1),
        )

    def submit_user_transfer_verification(
        self,
        ctx: TenantContext,
        asset_id: UUID,
        *,
        data_backup_verified: bool,
        qc_completed: bool,
        qc_remarks: str | None,
        physical_condition: str,
        verified_component_ids: list[UUID],
        asset_version: int | None = None,
    ) -> UserTransferVerificationResponse:
        """Persist Step 2 verification (audit + Redis staging). Does not release assignment."""
        asset, assignment = self._validator.validate_user_transfer_eligibility(ctx, asset_id)
        component_rows = self._assignment_components.list_for_assignment(ctx, assignment)
        issued_ids = self._validator.filter_issued_component_ids(component_rows)
        condition = self._validator.validate_user_transfer_verification(
            data_backup_verified=data_backup_verified,
            qc_completed=qc_completed,
            physical_condition=physical_condition,
            verified_component_ids=verified_component_ids,
            issued_component_ids=issued_ids,
            asset_version=asset_version,
            current_asset_version=int(asset.version or 1),
        )

        previous_user_label = None
        if assignment.employee_id is not None:
            try:
                emp = self._master.get_employee(ctx, assignment.employee_id)
                first = str(getattr(emp, "first_name", "") or "").strip()
                last = str(getattr(emp, "last_name", "") or "").strip()
                name = f"{first} {last}".strip()
                code = str(getattr(emp, "employee_code", "") or "").strip()
                previous_user_label = (
                    f"{code} — {name}".strip(" —") if code else (name or code or None)
                )
            except NotFoundException:
                previous_user_label = None

        verification_id = uuid4()
        verified_at = utcnow()
        remarks = (qc_remarks or "").strip() or None
        verified_ids = list(dict.fromkeys(verified_component_ids)) if issued_ids else []

        response = UserTransferVerificationResponse(
            verification_id=verification_id,
            asset_id=asset.id,
            assignment_id=assignment.id,
            previous_employee_id=assignment.employee_id,
            previous_user_label=previous_user_label,
            data_backup_verified=True,
            qc_completed=True,
            qc_remarks=remarks,
            physical_condition=condition,
            verified_component_ids=verified_ids,
            verified_at=verified_at,
            verified_by=ctx.user_id,
            status="verified",
        )

        audit_payload = {
            "verification_id": str(verification_id),
            "asset_id": str(asset.id),
            "assignment_id": str(assignment.id),
            "previous_employee_id": str(assignment.employee_id)
            if assignment.employee_id
            else None,
            "previous_user": previous_user_label,
            "data_backup_verified": True,
            "qc_completed": True,
            "qc_remarks": remarks,
            "physical_condition": condition,
            "verified_component_ids": [str(cid) for cid in verified_ids],
            "verified_at": verified_at.isoformat(),
            "verification_type": "user_transfer_pre_check",
            "verification_result": "passed",
        }
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_TRANSFER,
            entity_id=verification_id,
            operation="user_transfer_verification",
            performed_by=ctx.user_id,
            new_value=audit_payload,
        )

        self._stage_user_transfer_verification(ctx, response)
        return response

    def complete_user_transfer_assign(
        self,
        ctx: TenantContext,
        asset_id: UUID,
        body: UserTransferAssignRequest,
    ) -> UserTransferCompleteResponse:
        return UserTransferCompletionService(self._db).assign_to_new_user(ctx, asset_id, body)

    def complete_user_transfer_return_to_stock(
        self,
        ctx: TenantContext,
        asset_id: UUID,
        body: UserTransferReturnToStockRequest,
    ) -> UserTransferCompleteResponse:
        return UserTransferCompletionService(self._db).return_to_stock(ctx, asset_id, body)

    def _stage_user_transfer_verification(
        self,
        ctx: TenantContext,
        payload: UserTransferVerificationResponse,
    ) -> None:
        """Best-effort Redis staging so Step 3 can load verified data server-side."""
        try:
            client = get_redis()
            key = (
                f"asset:user_transfer_verification:{ctx.tenant_id}:"
                f"{payload.asset_id}:{payload.verification_id}"
            )
            client.setex(
                key,
                _USER_TRANSFER_VERIFICATION_TTL_SECONDS,
                payload.model_dump_json(),
            )
        except Exception:
            # Audit already recorded; Step 3 can still use the API response body.
            return

    def create(self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        to_location_id = fields.pop("to_location_id", None)
        to_building_id = fields.pop("to_building_id", None)
        if to_location_id is not None and to_building_id is not None:
            from modules.asset.service.site_location_service import SiteLocationService

            _loc, _bldg, label, org_id = SiteLocationService(self._db).resolve_pair(
                ctx,
                company_id=cid,
                location_id=to_location_id,
                building_id=to_building_id,
            )
            fields["to_location_label"] = label
            if fields.get("to_org_location_id") is None:
                fields["to_org_location_id"] = org_id
            # Stash for execute — not persisted on transfer row
            fields["_site_location_id"] = to_location_id
            fields["_site_building_id"] = to_building_id

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
        # Drop keys passed explicitly below so **payload cannot double-bind
        # (BUG-TRF-CREATE-01: body asset_id collided with asset_id=asset.id).
        payload = {
            k: v
            for k, v in fields.items()
            if k
            not in {
                "asset_id",
                "company_id",
                "branch_id",
                "document_number",
                "status",
                "_site_location_id",
                "_site_building_id",
            }
        }
        # Persist site master ids in transfer_notes marker only if unused — instead
        # re-resolve from to_location_label at execute via SiteLocationService.
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
            **payload,
        )
        # Attach resolved site FKs for execute path (same request / in-memory only).
        object.__setattr__(row, "_site_location_id", to_location_id)
        object.__setattr__(row, "_site_building_id", to_building_id)
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
        to_location_id = fields.pop("to_location_id", None)
        to_building_id = fields.pop("to_building_id", None)
        if to_location_id is not None and to_building_id is not None:
            from modules.asset.service.site_location_service import SiteLocationService

            _loc, _bldg, label, org_id = SiteLocationService(self._db).resolve_pair(
                ctx,
                company_id=row.company_id,
                location_id=to_location_id,
                building_id=to_building_id,
            )
            fields["to_location_label"] = label
            if fields.get("to_org_location_id") is None:
                fields["to_org_location_id"] = org_id
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
            site_loc_id, site_bld_id = self._resolve_site_ids_from_label(
                ctx,
                company_id=transfer.company_id,
                label=transfer.to_location_label,
            )
            self._locations.create(
                ctx,
                company_id=transfer.company_id,
                asset_id=transfer.asset_id,
                branch_id=transfer.to_branch_id or asset_updates.get("branch_id") or asset.branch_id,
                location_label=transfer.to_location_label
                or transfer.from_location_label
                or "Transferred location",
                org_location_id=transfer.to_org_location_id,
                location_id=site_loc_id,
                building_id=site_bld_id,
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

    def _resolve_site_ids_from_label(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        label: str | None,
    ) -> tuple[UUID | None, UUID | None]:
        if not label or " · " not in label:
            return None, None
        loc_name, bld_name = label.split(" · ", 1)
        from modules.asset.repository.site_location_repository import (
            SiteBuildingRepository,
            SiteLocationRepository,
        )

        loc = SiteLocationRepository(self._db).get_by_name(ctx, company_id, loc_name.strip())
        if loc is None:
            return None, None
        bldg = SiteBuildingRepository(self._db).get_by_name(ctx, loc.id, bld_name.strip())
        if bldg is None:
            return loc.id, None
        return loc.id, bldg.id

