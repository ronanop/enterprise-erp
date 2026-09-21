"""Step 3 — finalize assigned → user transfer (assign or return to stock)."""

from __future__ import annotations

from datetime import date, datetime, time, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from core.redis import get_redis
from modules.asset.domain.assignment_return_condition import (
    RETURN_CONDITION_GOOD,
    operational_action_for_return_condition,
)
from modules.asset.domain.enums import (
    AssetTransferStatus,
    AssignmentComponentIssueStatus,
    AssignmentDeliveryReferenceStatus,
    AstEntityType,
)
from modules.asset.domain.exceptions import TransferValidationError
from modules.asset.domain.workflow_codes import ENTITY_AST_TRANSFER
from modules.asset.models import AstAssetTransfer
from modules.asset.repository.asset_assignment_repository import AssetAssignmentRepository
from modules.asset.repository.asset_location_repository import AssetLocationRepository
from modules.asset.repository.asset_repository import AssetRepository
from modules.asset.repository.asset_transfer_repository import AssetTransferRepository
from modules.asset.repository.base import utcnow
from modules.asset.schemas import (
    UserTransferAssignRequest,
    UserTransferCompleteResponse,
    UserTransferReturnToStockRequest,
    UserTransferVerificationResponse,
)
from modules.asset.service.asset_operational_status_service import AssetOperationalStatusService
from modules.asset.service.assignment_component_service import AssignmentComponentService
from modules.asset.service.assignment_service import AssignmentService
from modules.asset.service.document_number_service import DocumentNumberService
from modules.asset.service.engines import AssetAssignmentEngine, AssetLocationEngine
from modules.asset.service.transfer_validator import TransferValidator
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService

_USER_TRANSFER_VERIFICATION_KEY = "asset:user_transfer_verification:{tenant_id}:{asset_id}:{verification_id}"


class UserTransferCompletionService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._assets = AssetRepository(db)
        self._assignments = AssetAssignmentRepository(db)
        self._transfers = AssetTransferRepository(db)
        self._locations = AssetLocationRepository(db)
        self._numbers = DocumentNumberService(db)
        self._validator = TransferValidator(db)
        self._assignment_svc = AssignmentService(db)
        self._assignment_components = AssignmentComponentService(db)
        self._assignment_engine = AssetAssignmentEngine()
        self._location_engine = AssetLocationEngine()
        self._operational = AssetOperationalStatusService(db)
        self._audit = AuditService(db)

    def assign_to_new_user(
        self,
        ctx: TenantContext,
        asset_id: UUID,
        body: UserTransferAssignRequest,
    ) -> UserTransferCompleteResponse:
        verification = self._load_verification(ctx, asset_id, body.verification_id)
        asset, assignment = self._validator.validate_user_transfer_eligibility(ctx, asset_id)
        self._validator.validate_user_transfer_finalize_context(
            verification=verification,
            asset=asset,
            assignment=assignment,
            asset_version=body.asset_version,
        )
        department_id = self._validator.validate_user_transfer_assign_request(
            ctx,
            company_id=asset.company_id,
            employee_source=body.employee_source,
            employee_id=body.employee_id,
            manual_employee_name=body.manual_employee_name,
            manual_employee_phone=body.manual_employee_phone,
            manual_employee_email=body.manual_employee_email,
            manual_employee_deployed_to=body.manual_employee_deployed_to,
            department_id=body.department_id,
            to_location_id=body.to_location_id,
            to_building_id=body.to_building_id,
            physical_condition=verification.physical_condition,
            previous_employee_id=assignment.employee_id,
        )

        component_rows = self._assignment_components.list_for_assignment(ctx, assignment)
        issued_ids = self._validator.filter_issued_component_ids(component_rows)
        self._validator.validate_user_transfer_verification(
            data_backup_verified=True,
            qc_completed=True,
            physical_condition=verification.physical_condition,
            verified_component_ids=list(verification.verified_component_ids),
            issued_component_ids=issued_ids,
            asset_version=body.asset_version,
            current_asset_version=int(asset.version or 1),
        )

        from_location_label = self._current_location_label(ctx, asset)
        to_label, org_location_id, site_loc_id, site_bld_id = self._resolve_site_location(
            ctx,
            company_id=asset.company_id,
            location_id=body.to_location_id,
            building_id=body.to_building_id,
        )

        previous_assignment_id = assignment.id
        component_returns = [
            {"component_id": cid, "issue_status": AssignmentComponentIssueStatus.RETURNED.value}
            for cid in verification.verified_component_ids
        ]
        if issued_ids and not component_returns:
            raise TransferValidationError("Issued components must be reconciled")

        asset_locked = self._assets.lock_for_update(ctx, asset.id)
        if asset_locked is None:
            raise NotFoundException("Asset not found")

        if issued_ids:
            self._assignment_components.reconcile_return(ctx, assignment, component_returns)

        return_action = operational_action_for_return_condition(RETURN_CONDITION_GOOD)
        self._operational.apply_action(
            ctx,
            asset.id,
            action=return_action,
            expected_version=int(asset_locked.version or 1),
            reason="user_transfer_reassign",
            remarks=body.assignment_remarks,
            source_entity=ENTITY_AST_TRANSFER,
            source_entity_id=verification.verification_id,
        )
        self._assignment_engine.return_assignment(assignment)
        now = utcnow()
        if (
            assignment.allocation_type == "employee"
            and assignment.employee_id is not None
            and asset_locked.custodian_employee_id == assignment.employee_id
        ):
            self._assets.update(ctx, asset.id, custodian_employee_id=None)

        self._assignments.complete_return(
            ctx,
            assignment.id,
            status=assignment.status,
            returned_at=now,
            return_remarks=verification.qc_remarks,
        )
        from modules.asset.service.dc_challan_service import DcChallanService

        DcChallanService(self._db).auto_cancel_for_assignment(
            ctx,
            assignment.id,
            remark=(
                f"Auto-cancelled because assignment "
                f"{getattr(assignment, 'document_number', assignment.id)} was user_transferred."
            ),
        )

        # Employee allocation forbids department_id/project_id on ast_asset_assignment
        # (AssignmentValidator). Department remains request-validated above for
        # master-data integrity; it is not written on the assignment identity row.
        source = (body.employee_source or "MASTER_DATA").strip().upper()
        if source == "MANUAL_ENTRY":
            new_assignment = self._assignment_svc.create(
                ctx,
                branch_id=asset.branch_id,
                company_id=asset.company_id,
                asset_id=asset.id,
                allocation_type="employee",
                employee_id=None,
                employee_source="MANUAL_ENTRY",
                manual_employee_name=(body.manual_employee_name or "").strip() or None,
                manual_employee_phone=(body.manual_employee_phone or "").strip() or None,
                manual_employee_email=(body.manual_employee_email or "").strip() or None,
                manual_employee_deployed_to=(body.manual_employee_deployed_to or "").strip()
                or None,
                delivery_reference_status=AssignmentDeliveryReferenceStatus.PENDING.value,
                delivery_challan_signature_status="not_signed",
                assignment_remarks=body.assignment_remarks,
            )
            to_employee_id = None
        else:
            new_assignment = self._assignment_svc.create(
                ctx,
                branch_id=asset.branch_id,
                company_id=asset.company_id,
                asset_id=asset.id,
                allocation_type="employee",
                employee_id=body.employee_id,
                employee_source="MASTER_DATA",
                delivery_reference_status=AssignmentDeliveryReferenceStatus.PENDING.value,
                delivery_challan_signature_status="not_signed",
                assignment_remarks=body.assignment_remarks,
            )
            to_employee_id = body.employee_id
        if verification.verified_component_ids:
            self._assignment_svc.set_components(
                ctx, new_assignment.id, list(verification.verified_component_ids)
            )
        self._assignment_svc.submit(ctx, new_assignment.id)
        activated = self._assignment_svc.activate_submitted_immediately(ctx, new_assignment.id)

        effective_from = self._effective_from(body.allocated_at)
        if to_label:
            self._apply_location_change(
                ctx,
                asset=asset,
                from_label=from_location_label,
                to_label=to_label,
                org_location_id=org_location_id,
                site_loc_id=site_loc_id,
                site_bld_id=site_bld_id,
                effective_from=effective_from,
            )

        transfer_row = self._create_completed_transfer(
            ctx,
            asset=asset,
            verification=verification,
            from_employee_id=assignment.employee_id,
            to_employee_id=to_employee_id,
            from_location_label=from_location_label,
            to_location_label=to_label,
            to_org_location_id=org_location_id,
            effective_date=body.allocated_at,
            reason="user_transfer_assign",
            transfer_notes=f"user_transfer:verification={verification.verification_id}",
        )

        asset_refreshed = self._assets.get(ctx, asset.id)
        ops = str(getattr(asset_refreshed, "operational_status", "") or "")

        audit_payload = {
            "outcome": "assign",
            "verification_id": str(verification.verification_id),
            "transfer_id": str(transfer_row.id),
            "document_number": transfer_row.document_number,
            "previous_assignment_id": str(previous_assignment_id),
            "new_assignment_id": str(activated.id),
            "previous_employee_id": str(assignment.employee_id)
            if assignment.employee_id
            else None,
            "new_employee_id": str(to_employee_id) if to_employee_id else None,
            "employee_source": source,
            "manual_employee_name": (body.manual_employee_name or "").strip() or None
            if source == "MANUAL_ENTRY"
            else None,
            "department_id": str(department_id) if department_id else None,
            "verified_component_ids": [str(c) for c in verification.verified_component_ids],
        }
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_TRANSFER,
            entity_id=transfer_row.id,
            operation="user_transfer_complete",
            performed_by=ctx.user_id,
            new_value=audit_payload,
        )

        self._consume_verification(ctx, asset_id, body.verification_id)

        return UserTransferCompleteResponse(
            outcome="assign",
            transfer_id=transfer_row.id,
            document_number=transfer_row.document_number,
            asset_id=asset.id,
            operational_status=ops,
            previous_assignment_id=previous_assignment_id,
            new_assignment_id=activated.id,
            new_assignment_document_number=activated.document_number,
            verification_id=verification.verification_id,
        )

    def return_to_stock(
        self,
        ctx: TenantContext,
        asset_id: UUID,
        body: UserTransferReturnToStockRequest,
    ) -> UserTransferCompleteResponse:
        reason = self._validator.validate_user_transfer_return_request(reason=body.reason)
        verification = self._load_verification(ctx, asset_id, body.verification_id)
        asset, assignment = self._validator.validate_user_transfer_eligibility(ctx, asset_id)
        self._validator.validate_user_transfer_finalize_context(
            verification=verification,
            asset=asset,
            assignment=assignment,
            asset_version=body.asset_version,
        )

        component_rows = self._assignment_components.list_for_assignment(ctx, assignment)
        issued_ids = self._validator.filter_issued_component_ids(component_rows)
        self._validator.validate_user_transfer_verification(
            data_backup_verified=True,
            qc_completed=True,
            physical_condition=verification.physical_condition,
            verified_component_ids=list(verification.verified_component_ids),
            issued_component_ids=issued_ids,
            asset_version=body.asset_version,
            current_asset_version=int(asset.version or 1),
        )

        component_returns = [
            {"component_id": cid, "issue_status": AssignmentComponentIssueStatus.RETURNED.value}
            for cid in verification.verified_component_ids
        ]
        if issued_ids and not component_returns:
            raise TransferValidationError("Issued components must be reconciled")

        from_location_label = self._current_location_label(ctx, asset)
        previous_assignment_id = assignment.id

        self._assignment_svc.return_assignment(
            ctx,
            assignment.id,
            return_condition=verification.physical_condition,
            reason=reason,
            remarks=body.remarks,
            component_returns=component_returns if issued_ids else None,
        )

        transfer_row = self._create_completed_transfer(
            ctx,
            asset=asset,
            verification=verification,
            from_employee_id=assignment.employee_id,
            to_employee_id=None,
            from_location_label=from_location_label,
            to_location_label=from_location_label,
            to_org_location_id=None,
            effective_date=utcnow().date(),
            reason=reason,
            transfer_notes=f"user_transfer_return:verification={verification.verification_id}",
        )

        asset_refreshed = self._assets.get(ctx, asset.id)
        ops = str(getattr(asset_refreshed, "operational_status", "") or "")

        audit_payload = {
            "outcome": "return_to_stock",
            "verification_id": str(verification.verification_id),
            "transfer_id": str(transfer_row.id),
            "document_number": transfer_row.document_number,
            "previous_assignment_id": str(previous_assignment_id),
            "return_reason": reason,
            "verified_component_ids": [str(c) for c in verification.verified_component_ids],
        }
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_TRANSFER,
            entity_id=transfer_row.id,
            operation="user_transfer_complete",
            performed_by=ctx.user_id,
            new_value=audit_payload,
        )

        self._consume_verification(ctx, asset_id, body.verification_id)

        return UserTransferCompleteResponse(
            outcome="return_to_stock",
            transfer_id=transfer_row.id,
            document_number=transfer_row.document_number,
            asset_id=asset.id,
            operational_status=ops,
            previous_assignment_id=previous_assignment_id,
            new_assignment_id=None,
            new_assignment_document_number=None,
            verification_id=verification.verification_id,
        )

    def _load_verification(
        self, ctx: TenantContext, asset_id: UUID, verification_id: UUID
    ) -> UserTransferVerificationResponse:
        try:
            client = get_redis()
            key = _USER_TRANSFER_VERIFICATION_KEY.format(
                tenant_id=ctx.tenant_id,
                asset_id=asset_id,
                verification_id=verification_id,
            )
            raw = client.get(key)
        except Exception as exc:
            raise TransferValidationError(
                "Verification is missing, expired, or already used"
            ) from exc
        if not raw:
            raise TransferValidationError(
                "Verification is missing, expired, or already used"
            )
        if isinstance(raw, bytes):
            raw = raw.decode("utf-8")
        return UserTransferVerificationResponse.model_validate_json(raw)

    def _consume_verification(
        self, ctx: TenantContext, asset_id: UUID, verification_id: UUID
    ) -> None:
        try:
            client = get_redis()
            key = _USER_TRANSFER_VERIFICATION_KEY.format(
                tenant_id=ctx.tenant_id,
                asset_id=asset_id,
                verification_id=verification_id,
            )
            client.delete(key)
        except Exception:
            return

    def _create_completed_transfer(
        self,
        ctx: TenantContext,
        *,
        asset,
        verification: UserTransferVerificationResponse,
        from_employee_id: UUID | None,
        to_employee_id: UUID | None,
        from_location_label: str | None,
        to_location_label: str | None,
        to_org_location_id: UUID | None,
        effective_date: date,
        reason: str,
        transfer_notes: str,
    ) -> AstAssetTransfer:
        doc = self._numbers.generate(
            AstEntityType.TRANSFER,
            asset.company_id,
            AstAssetTransfer,
            "document_number",
            ctx=ctx,
        )
        now = utcnow()
        row = self._transfers.create(
            ctx,
            company_id=asset.company_id,
            branch_id=asset.branch_id,
            document_number=doc,
            asset_id=asset.id,
            from_branch_id=asset.branch_id,
            to_branch_id=asset.branch_id,
            from_department_id=asset.department_id,
            to_department_id=asset.department_id,
            from_employee_id=from_employee_id,
            to_employee_id=to_employee_id,
            from_location_label=from_location_label,
            to_location_label=to_location_label,
            from_org_location_id=None,
            to_org_location_id=to_org_location_id,
            effective_date=effective_date,
            reason=reason,
            transfer_notes=transfer_notes,
            status=AssetTransferStatus.COMPLETED.value,
            transferred_at=now,
            executed_at=now,
            executed_by=ctx.user_id,
        )
        return row

    def _current_location_label(self, ctx: TenantContext, asset) -> str | None:
        current_loc = self._locations.find_current_for_asset(
            ctx, company_id=asset.company_id, asset_id=asset.id
        )
        if current_loc is not None:
            return current_loc.location_label
        currents = self._locations.find_current(ctx, asset.id)
        if currents:
            return currents[0].location_label
        return None

    def _resolve_site_location(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        location_id: UUID,
        building_id: UUID,
    ) -> tuple[str, UUID | None, UUID, UUID]:
        from modules.asset.service.site_location_service import SiteLocationService

        _loc, _bldg, label, org_id = SiteLocationService(self._db).resolve_pair(
            ctx,
            company_id=company_id,
            location_id=location_id,
            building_id=building_id,
        )
        return label, org_id, location_id, building_id

    def _apply_location_change(
        self,
        ctx: TenantContext,
        *,
        asset,
        from_label: str | None,
        to_label: str,
        org_location_id: UUID | None,
        site_loc_id: UUID,
        site_bld_id: UUID,
        effective_from: datetime,
    ) -> None:
        if to_label == from_label:
            return
        for current in self._locations.find_current(ctx, asset.id):
            self._location_engine.mark_historical(current)
            current.effective_to = effective_from
        self._locations.create(
            ctx,
            company_id=asset.company_id,
            asset_id=asset.id,
            branch_id=asset.branch_id,
            location_label=to_label,
            org_location_id=org_location_id,
            location_id=site_loc_id,
            building_id=site_bld_id,
            effective_from=effective_from,
            is_current=True,
            status="active",
        )

    @staticmethod
    def _effective_from(value: date) -> datetime:
        return datetime.combine(value, time.min, tzinfo=timezone.utc)
