"""Asset assignment validation rules for FP-ASSET-003."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.asset.adapters.master_data_port import AssetMasterDataAdapter
from modules.asset.adapters.organization_port import AssetOrganizationAdapter
from modules.asset.domain.enums import AssetAssignmentStatus, AssetStatus
from modules.asset.domain.exceptions import AssignmentValidationError
from modules.asset.models import AstAssetAssignment
from modules.asset.repository.asset_assignment_repository import AssetAssignmentRepository
from modules.asset.repository.asset_repository import AssetRepository
from modules.asset.repository.asset_transfer_repository import AssetTransferRepository
from modules.foundation.domain.value_objects import TenantContext

ALLOCATION_TYPES = frozenset({"employee", "department", "project", "branch", "warehouse"})


class AssignmentValidator:
    def __init__(self, db: Session) -> None:
        self._assets = AssetRepository(db)
        self._assignments = AssetAssignmentRepository(db)
        self._transfers = AssetTransferRepository(db)
        self._org = AssetOrganizationAdapter(db)
        self._master = AssetMasterDataAdapter(db)

    def validate_create_fields(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        fields: dict,
    ) -> None:
        asset_id = fields.get("asset_id")
        if asset_id is None:
            raise AssignmentValidationError("asset_id is required")
        asset = self._assets.get(ctx, asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        self._validate_asset_is_assignable(asset.status)
        if asset.company_id != company_id:
            raise AssignmentValidationError("Asset does not belong to this company")
        self._validate_allocation_fields(ctx, company_id=company_id, fields=fields)
        self._validate_exclusive_assignment(ctx, asset, exclude_id=None)
        self._validate_pending_transfer(ctx, asset_id)

    def validate_update_fields(
        self,
        ctx: TenantContext,
        row: AstAssetAssignment,
        fields: dict,
    ) -> None:
        if row.status != AssetAssignmentStatus.DRAFT.value:
            raise AssignmentValidationError("Only draft assignments can be updated")
        if "asset_id" in fields and fields["asset_id"] != row.asset_id:
            raise AssignmentValidationError("asset_id cannot be changed")
        if "document_number" in fields:
            raise AssignmentValidationError("document_number cannot be changed")
        merged = {
            "asset_id": row.asset_id,
            "allocation_type": fields.get("allocation_type", row.allocation_type),
            "employee_id": fields.get("employee_id", row.employee_id),
            "department_id": fields.get("department_id", row.department_id),
            "project_id": fields.get("project_id", row.project_id),
        }
        asset = self._assets.get(ctx, row.asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        self._validate_allocation_fields(ctx, company_id=row.company_id, fields=merged)
        self._validate_exclusive_assignment(ctx, asset, exclude_id=row.id)
        self._validate_pending_transfer(ctx, row.asset_id)

    def validate_submit_readiness(self, ctx: TenantContext, row: AstAssetAssignment) -> None:
        if row.status != AssetAssignmentStatus.DRAFT.value:
            raise AssignmentValidationError("Only draft assignments can be submitted")
        asset = self._assets.get(ctx, row.asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        self._validate_asset_is_assignable(asset.status)
        fields = {
            "allocation_type": row.allocation_type,
            "employee_id": row.employee_id,
            "department_id": row.department_id,
            "project_id": row.project_id,
        }
        self._validate_allocation_fields(ctx, company_id=row.company_id, fields=fields)
        self._validate_exclusive_assignment(ctx, asset, exclude_id=row.id)
        self._validate_pending_transfer(ctx, row.asset_id)

    def validate_activate_readiness(self, ctx: TenantContext, row: AstAssetAssignment) -> None:
        if row.status != AssetAssignmentStatus.SUBMITTED.value:
            raise AssignmentValidationError("Only submitted assignments can be activated")
        asset = self._assets.get(ctx, row.asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        self._validate_asset_is_assignable(asset.status)
        fields = {
            "allocation_type": row.allocation_type,
            "employee_id": row.employee_id,
            "department_id": row.department_id,
            "project_id": row.project_id,
        }
        self._validate_allocation_fields(ctx, company_id=row.company_id, fields=fields)
        self._validate_exclusive_assignment(ctx, asset, exclude_id=row.id)
        self._validate_pending_transfer(ctx, row.asset_id)

    def _validate_allocation_fields(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        fields: dict,
    ) -> None:
        allocation_type = fields.get("allocation_type")
        if allocation_type not in ALLOCATION_TYPES:
            raise AssignmentValidationError("allocation_type is required and must be valid")

        employee_id = fields.get("employee_id")
        department_id = fields.get("department_id")
        project_id = fields.get("project_id")

        if allocation_type == "employee":
            if employee_id is None:
                raise AssignmentValidationError("employee_id is required for employee allocation")
            if department_id is not None or project_id is not None:
                raise AssignmentValidationError(
                    "department_id and project_id must be empty for employee allocation"
                )
            self._master.get_employee(ctx, employee_id)
        elif allocation_type == "department":
            if department_id is None:
                raise AssignmentValidationError("department_id is required for department allocation")
            if employee_id is not None or project_id is not None:
                raise AssignmentValidationError(
                    "employee_id and project_id must be empty for department allocation"
                )
            department = self._org.get_department(ctx, department_id)
            if getattr(department, "company_id", None) not in (None, company_id):
                raise AssignmentValidationError("Department does not belong to this company")
        elif allocation_type == "project":
            if project_id is None:
                raise AssignmentValidationError("project_id is required for project allocation")
            if employee_id is not None or department_id is not None:
                raise AssignmentValidationError(
                    "employee_id and department_id must be empty for project allocation"
                )
        elif allocation_type in {"branch", "warehouse"}:
            if employee_id is not None or department_id is not None or project_id is not None:
                raise AssignmentValidationError(
                    "employee_id, department_id, and project_id must be empty for "
                    f"{allocation_type} allocation"
                )

    def _validate_exclusive_assignment(self, ctx: TenantContext, asset, *, exclude_id: UUID | None) -> None:
        if bool(getattr(asset, "is_shared", False)):
            return
        pending = self._assignments.find_pending_or_active_for_asset(
            ctx, asset.id, exclude_id=exclude_id
        )
        if pending is not None:
            raise AssignmentValidationError(
                f"Asset already has a pending or active assignment ({pending.document_number})"
            )

    def _validate_pending_transfer(self, ctx: TenantContext, asset_id: UUID) -> None:
        pending = self._transfers.find_pending_for_asset(ctx, asset_id, exclude_id=None)
        if pending is not None:
            raise AssignmentValidationError(
                f"Asset has a pending transfer ({pending.document_number})"
            )

    @staticmethod
    def _validate_asset_is_assignable(status: str) -> None:
        if status not in {AssetStatus.ACTIVE.value, AssetStatus.IN_MAINTENANCE.value}:
            raise AssignmentValidationError("Only active or in_maintenance assets can be assigned")
