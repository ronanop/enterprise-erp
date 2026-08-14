"""Asset register service — C-01 master_asset link on approve (FP-ASSET-REG-001)."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.asset.adapters.master_data_port import AssetMasterDataAdapter
from modules.asset.adapters.procurement_read_port import ProcurementReadPort
from modules.asset.domain.enums import AssetStatus, AstEntityType
from modules.asset.domain.exceptions import (
    InvalidAssetWorkflowState,
    RegistrationValidationError,
    SegregationOfDutiesError,
)
from modules.asset.domain.workflow_codes import ENTITY_AST_ASSET
from modules.asset.models import AstAsset
from modules.asset.repository.asset_category_repository import AssetCategoryRepository
from modules.asset.repository.asset_repository import AssetListFilters, AssetRepository
from modules.asset.service.asset_dashboard_summary_service import AssetDashboardSummaryService
from modules.asset.service.asset_operational_status_service import AssetOperationalStatusService
from modules.asset.service.asset_scope_validator import AssetScopeValidator
from modules.asset.service.document_number_service import DocumentNumberService
from modules.asset.service.engines import AssetEngine
from modules.asset.service.governance_service import AssetGovernanceService
from modules.asset.service.operational_status_read import coerce_operational_status_filter
from modules.asset.service.registration_validator import RegistrationValidator
from modules.asset.service.workflow_governance_settings import asset_workflow_governance_enabled
from modules.foundation.domain.enums import WorkflowStatus
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService


class AssetService:
    def __init__(self, db: Session) -> None:
        self._repo = AssetRepository(db)
        self._categories = AssetCategoryRepository(db)
        self._scope = AssetScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = AssetEngine()
        self._audit = AuditService(db)
        self._master = AssetMasterDataAdapter(db)
        self._governance = AssetGovernanceService(db)
        self._validator = RegistrationValidator(db)
        self._procurement = ProcurementReadPort(db)
        self._db = db
        self._operational = AssetOperationalStatusService(db)

    def search(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        branch_id: UUID | None = None,
        status: str | None = None,
        operational_status: str | None = None,
        asset_category_id: UUID | None = None,
        search: str | None = None,
        asset_type: str | None = None,
        department_id: UUID | None = None,
        location_id: UUID | None = None,
        employee_id: UUID | None = None,
        assignment_state: str | None = None,
        make: str | None = None,
        model: str | None = None,
        offset: int = 0,
        limit: int = 25,
    ) -> tuple[list[AstAsset], int]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        ops_filter = coerce_operational_status_filter(operational_status)
        state = (assignment_state or "").strip().lower() or None
        if state is not None and state not in {"assigned", "unassigned"}:
            raise RegistrationValidationError(
                "assignment_state must be 'assigned' or 'unassigned'"
            )
        filters = AssetListFilters(
            company_id=cid,
            branch_id=branch_id,
            status=status,
            operational_status=ops_filter,
            asset_category_id=asset_category_id,
            search=search,
            asset_type=asset_type,
            department_id=department_id,
            location_id=location_id,
            employee_id=employee_id,
            assignment_state=state,
            make=make,
            model=model,
        )
        return self._repo.search(ctx, filters, offset=offset, limit=limit)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstAsset:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Asset not found")
        return row

    def prefill_from_grn(self, ctx: TenantContext, grn_id: UUID):
        return self._procurement.prefill_from_grn(ctx, grn_id)

    def find_by_asset_code(
        self, ctx: TenantContext, asset_code: str, *, company_id: UUID | None = None
    ) -> AstAsset | None:
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.find_by_code(ctx, cid, asset_code)

    def find_by_serial_number(
        self, ctx: TenantContext, serial_number: str, *, company_id: UUID | None = None
    ) -> AstAsset | None:
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.find_by_serial(ctx, cid, serial_number)

    @staticmethod
    def _normalize_optional_text_fields(fields: dict) -> None:
        """Normalize optional registration text fields; empty string → None."""
        for key in (
            "make",
            "model",
            "configuration",
            "serial_number",
            "barcode",
            "qr_code",
            "rfid_tag",
            "location_label",
        ):
            if key not in fields:
                continue
            value = fields[key]
            if value is None:
                continue
            text = str(value).strip()
            fields[key] = text or None

    def _persist_registration_location(
        self,
        ctx: TenantContext,
        *,
        asset_id: UUID,
        branch_id: UUID,
        company_id: UUID,
        location_label: str | None,
    ) -> str | None:
        """Create current ast_asset_location via LocationService. No-op when blank."""
        if not location_label:
            return None
        from modules.asset.service.location_service import LocationService

        loc = LocationService(self._db).create(
            ctx,
            company_id=company_id,
            asset_id=asset_id,
            branch_id=branch_id,
            location_label=location_label,
        )
        return loc.location_label

    def create(self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        fields.pop("asset_code", None)
        fields.pop("document_number", None)
        incoming_unit_id = fields.pop("incoming_unit_id", None)
        incoming_line_id = fields.pop("incoming_line_id", None)
        self._normalize_optional_text_fields(fields)
        location_label = fields.pop("location_label", None)
        self._validator.validate_create_fields(
            ctx, company_id=cid, branch_id=branch_id, fields={**fields, "branch_id": branch_id}
        )
        if incoming_unit_id is not None:
            from modules.asset.service.incoming_registration_service import IncomingRegistrationService

            reg = IncomingRegistrationService(self._db)
            unit = reg._repo.get_unit(ctx, incoming_unit_id)
            if unit is None:
                raise NotFoundException("Incoming unit not found")
            line = reg.assert_unit_registrable(ctx, unit, expected_line_id=incoming_line_id)
            # System-owned refs always come from incoming record
            fields["grn_id"] = line.grn_id
            fields["purchase_order_id"] = line.purchase_order_id
            fields["product_id"] = fields.get("product_id") or line.product_id
            fields["supplier_vendor_id"] = fields.get("supplier_vendor_id") or line.vendor_id
            if not fields.get("quality_inspection_id"):
                fields["quality_inspection_id"] = (
                    unit.quality_inspection_id or line.quality_inspection_id
                )
            if unit.serial_number and fields.get("serial_number"):
                if fields["serial_number"] != unit.serial_number:
                    from core.exceptions import ConflictException

                    raise ConflictException("Serial mismatch")
            if unit.serial_number and not fields.get("serial_number"):
                fields["serial_number"] = unit.serial_number

        doc = self._numbers.generate(AstEntityType.ASSET, cid, AstAsset, "document_number", ctx=ctx)
        row = self._repo.create(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            document_number=doc,
            asset_code=doc,
            status=AssetStatus.DRAFT.value,
            **fields,
        )
        persisted_location = self._persist_registration_location(
            ctx,
            asset_id=row.id,
            branch_id=branch_id,
            company_id=cid,
            location_label=location_label,
        )
        if persisted_location:
            object.__setattr__(row, "current_location_label", persisted_location)
        if incoming_unit_id is not None:
            from modules.asset.service.incoming_registration_service import IncomingRegistrationService

            IncomingRegistrationService(self._db).link_unit_after_create(
                ctx, incoming_unit_id=incoming_unit_id, asset_id=row.id
            )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_ASSET,
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
            new_value=(
                {"incoming_unit_id": str(incoming_unit_id)} if incoming_unit_id is not None else None
            ),
        )
        return row

    def create_for_import(
        self,
        ctx: TenantContext,
        *,
        branch_id: UUID,
        asset_code: str,
        company_id: UUID | None = None,
        **fields,
    ):
        """Create draft asset for Excel import with external Asset Tag as asset_code.

        document_number remains system-assigned. Operational status is not set here —
        activate via submit → approve (initialize_ready_to_move).
        """
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        fields.pop("document_number", None)
        fields.pop("status", None)
        self._normalize_optional_text_fields(fields)
        location_label = fields.pop("location_label", None)
        code = (asset_code or "").strip()
        self._validator.validate_create_for_import_fields(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            fields={**fields, "branch_id": branch_id, "asset_code": code},
        )
        doc = self._numbers.generate(AstEntityType.ASSET, cid, AstAsset, "document_number", ctx=ctx)
        row = self._repo.create(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            document_number=doc,
            asset_code=code,
            status=AssetStatus.DRAFT.value,
            **fields,
        )
        persisted_location = self._persist_registration_location(
            ctx,
            asset_id=row.id,
            branch_id=branch_id,
            company_id=cid,
            location_label=location_label,
        )
        if persisted_location:
            object.__setattr__(row, "current_location_label", persisted_location)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_ASSET,
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
            new_value={"source": "excel_import", "asset_code": code},
        )
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        row = self.get(ctx, row_id)
        self._normalize_optional_text_fields(fields)
        location_label = fields.pop("location_label", None)
        self._validator.validate_update_fields(ctx, row, fields)
        updated = self._repo.update(ctx, row_id, **fields)
        if updated is None:
            raise NotFoundException("Asset not found")
        if location_label:
            persisted = self._persist_registration_location(
                ctx,
                asset_id=updated.id,
                branch_id=updated.branch_id,
                company_id=updated.company_id,
                location_label=location_label,
            )
            if persisted:
                object.__setattr__(updated, "current_location_label", persisted)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_ASSET,
            entity_id=row_id,
            operation="update",
            performed_by=ctx.user_id,
        )
        return updated

    def apply_discovery_profile(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        profile: dict,
        serial_number: str | None,
        version: int,
    ):
        """Persist allowlisted discovery fields only (CR-003).

        Does not use general registration update validation (draft-only).
        Forbidden fields (cost, category, workflow, finance, status) are rejected.
        """
        from modules.asset.service.discovery_validator import DiscoveryValidator

        row = self.get(ctx, row_id)
        validator = DiscoveryValidator(self._db)
        validator.validate_apply_readiness(row)
        fields: dict = {
            "discovery_profile_json": profile,
            "version": int(version),
        }
        if serial_number is not None:
            fields["serial_number"] = serial_number
        validator.validate_apply_fields(fields)
        validator.validate_serial_unique(
            ctx,
            company_id=row.company_id,
            serial_number=serial_number,
            exclude_id=row.id,
        )
        updated = self._repo.update(ctx, row_id, **fields)
        if updated is None:
            raise NotFoundException("Asset not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_ASSET,
            entity_id=row_id,
            operation="discovery_apply",
            performed_by=ctx.user_id,
        )
        return updated

    def cancel_draft(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.cancel_draft(row)
        if row.workflow_instance_id is not None:
            raise InvalidAssetWorkflowState("Cannot cancel after workflow started")
        updated = self._repo.update(ctx, row_id, status=row.status)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_ASSET,
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
            entity_name=ENTITY_AST_ASSET,
            entity_id=row_id,
            operation="reopen",
            performed_by=ctx.user_id,
        )
        return updated

    def resubmit(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        if row.status == AssetStatus.CANCELLED.value and row.workflow_status == WorkflowStatus.REJECTED.value:
            self.reopen(ctx, row_id)
        return self.submit(ctx, row_id)

    def submit(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._validator.validate_submit_readiness(ctx, row)
        self._engine.submit(row)
        if not asset_workflow_governance_enabled():
            return self._repo.update(ctx, row_id, status=row.status)
        instance = self._governance.submit_for_approval(
            ctx,
            entity_name=ENTITY_AST_ASSET,
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
            raise SegregationOfDutiesError("Creator cannot approve own asset")
        if row.workflow_instance_id is None:
            raise InvalidAssetWorkflowState("Asset has no workflow instance")

        def on_approved() -> None:
            fresh = self.get(ctx, row_id)
            self._engine.approve(fresh)
            master_asset_id = fresh.master_asset_id
            if master_asset_id is None:
                master = self._master.create_or_link_master_asset(ctx, fresh)
                master_asset_id = master.id
            self._engine.activate(fresh)
            self._repo.update(
                ctx,
                row_id,
                status=fresh.status,
                master_asset_id=master_asset_id,
                workflow_status=WorkflowStatus.APPROVED.value,
            )
            self._operational.initialize_ready_to_move(
                ctx,
                row_id,
                expected_version=int(fresh.version or 1),
                reason="asset_registration",
            )
            self._audit.log_entity_change(
                tenant_id=ctx.tenant_id,
                entity_name=ENTITY_AST_ASSET,
                entity_id=row_id,
                operation="activate",
                performed_by=ctx.user_id,
                new_value={"master_asset_id": str(master_asset_id), "status": fresh.status},
            )

        instance = self._governance.approve(
            ctx,
            instance_id=row.workflow_instance_id,
            entity_name=ENTITY_AST_ASSET,
            entity_id=row_id,
            on_approved=on_approved,
            comments=comments,
            recipient_user_id=row.created_by,
        )
        if instance.status == WorkflowStatus.APPROVED:
            return self.get(ctx, row_id)
        return self._repo.update(
            ctx,
            row_id,
            workflow_status=instance.status.value,
        )

    def reject(self, ctx: TenantContext, row_id: UUID, comments: str | None = None):
        row = self.get(ctx, row_id)
        if not asset_workflow_governance_enabled():
            raise InvalidAssetWorkflowState("Workflow governance is disabled")
        if row.workflow_instance_id is None:
            raise InvalidAssetWorkflowState("Asset has no workflow instance")

        def on_rejected() -> None:
            self._repo.update(
                ctx,
                row_id,
                status="cancelled",
                workflow_status=WorkflowStatus.REJECTED.value,
            )

        self._governance.reject(
            ctx,
            instance_id=row.workflow_instance_id,
            entity_name=ENTITY_AST_ASSET,
            entity_id=row_id,
            on_rejected=on_rejected,
            comments=comments,
            recipient_user_id=row.created_by,
        )
        return self.get(ctx, row_id)

    def _legacy_approve(self, ctx: TenantContext, row_id: UUID, row: AstAsset):
        self._engine.approve(row)
        if row.master_asset_id is None:
            master = self._master.create_or_link_master_asset(ctx, row)
            row.master_asset_id = master.id
        self._engine.activate(row)
        updated = self._repo.update(
            ctx,
            row_id,
            status=row.status,
            master_asset_id=row.master_asset_id,
        )
        self._operational.initialize_ready_to_move(
            ctx,
            row_id,
            expected_version=int(updated.version or 1) if updated else None,
            reason="asset_registration",
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_ASSET,
            entity_id=row_id,
            operation="approve",
            performed_by=ctx.user_id,
            new_value={"master_asset_id": str(row.master_asset_id), "status": row.status},
        )
        return updated
