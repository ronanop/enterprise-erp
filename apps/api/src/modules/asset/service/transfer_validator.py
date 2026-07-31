"""Asset transfer validation rules for FP-ASSET-002."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.asset.adapters.master_data_port import AssetMasterDataAdapter
from modules.asset.adapters.organization_port import AssetOrganizationAdapter
from modules.asset.domain.enums import AssetStatus, AssetTransferStatus
from modules.asset.domain.exceptions import TransferValidationError
from modules.asset.models import AstAssetTransfer
from modules.asset.repository.asset_repository import AssetRepository
from modules.asset.repository.asset_transfer_repository import AssetTransferRepository
from modules.foundation.domain.value_objects import TenantContext


class TransferValidator:
    def __init__(self, db: Session) -> None:
        self._assets = AssetRepository(db)
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
            raise TransferValidationError("asset_id is required")
        asset = self._assets.get(ctx, asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        self._validate_asset_is_transferable(asset.status)
        if asset.company_id != company_id:
            raise TransferValidationError("Asset does not belong to this company")
        self._validate_target_fields(ctx, company_id=company_id, fields=fields)
        self._validate_pending_transfer(ctx, asset_id, exclude_id=None)

    def validate_update_fields(
        self,
        ctx: TenantContext,
        row: AstAssetTransfer,
        fields: dict,
    ) -> None:
        if row.status != AssetTransferStatus.DRAFT.value:
            raise TransferValidationError("Only draft transfers can be updated")
        if "asset_id" in fields and fields["asset_id"] != row.asset_id:
            raise TransferValidationError("asset_id cannot be changed")
        if "document_number" in fields:
            raise TransferValidationError("document_number cannot be changed")
        merged = {
            "asset_id": row.asset_id,
            "to_branch_id": fields.get("to_branch_id", row.to_branch_id),
            "to_department_id": fields.get("to_department_id", row.to_department_id),
            "to_employee_id": fields.get("to_employee_id", row.to_employee_id),
            "to_location_label": fields.get("to_location_label", row.to_location_label),
            "to_org_location_id": fields.get("to_org_location_id", row.to_org_location_id),
        }
        self._validate_target_fields(ctx, company_id=row.company_id, fields=merged)
        self._validate_pending_transfer(ctx, row.asset_id, exclude_id=row.id)

    def validate_submit_readiness(self, ctx: TenantContext, row: AstAssetTransfer) -> None:
        if row.status != AssetTransferStatus.DRAFT.value:
            raise TransferValidationError("Only draft transfers can be submitted")
        asset = self._assets.get(ctx, row.asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        self._validate_asset_is_transferable(asset.status)
        self._validate_pending_transfer(ctx, row.asset_id, exclude_id=row.id)
        if not any(
            (
                self._different(row.from_branch_id, row.to_branch_id),
                self._different(row.from_department_id, row.to_department_id),
                self._different(row.from_employee_id, row.to_employee_id),
                self._different(row.from_location_label, row.to_location_label),
                self._different(row.from_org_location_id, row.to_org_location_id),
            )
        ):
            raise TransferValidationError("At least one transfer target must differ from the current value")

    def validate_execute_readiness(self, ctx: TenantContext, row: AstAssetTransfer) -> None:
        if row.status != AssetTransferStatus.SUBMITTED.value:
            raise TransferValidationError("Only submitted transfers can be executed")
        asset = self._assets.get(ctx, row.asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        self._validate_asset_is_transferable(asset.status)
        self._validate_pending_transfer(ctx, row.asset_id, exclude_id=row.id)
        if not any(
            (
                self._different(row.from_branch_id, row.to_branch_id),
                self._different(row.from_department_id, row.to_department_id),
                self._different(row.from_employee_id, row.to_employee_id),
                self._different(row.from_location_label, row.to_location_label),
                self._different(row.from_org_location_id, row.to_org_location_id),
            )
        ):
            raise TransferValidationError("At least one transfer target must differ from the current value")

    def _validate_target_fields(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        fields: dict,
    ) -> None:
        has_target = any(
            fields.get(name) not in (None, "")
            for name in (
                "to_branch_id",
                "to_department_id",
                "to_employee_id",
                "to_location_label",
                "to_org_location_id",
            )
        )
        if not has_target:
            raise TransferValidationError("At least one transfer target is required")

        to_branch_id = fields.get("to_branch_id")
        if to_branch_id is not None:
            branch = self._org.get_branch(ctx, to_branch_id)
            if getattr(branch, "company_id", None) != company_id:
                raise TransferValidationError("Destination branch does not belong to this company")

        to_department_id = fields.get("to_department_id")
        if to_department_id is not None:
            department = self._org.get_department(ctx, to_department_id)
            if getattr(department, "company_id", None) not in (None, company_id):
                raise TransferValidationError("Destination department does not belong to this company")

        to_employee_id = fields.get("to_employee_id")
        if to_employee_id is not None:
            self._master.get_employee(ctx, to_employee_id)

        to_org_location_id = fields.get("to_org_location_id")
        if to_org_location_id is not None:
            location = self._org.get_location(ctx, to_org_location_id)
            if getattr(location, "company_id", None) != company_id:
                raise TransferValidationError("Destination location does not belong to this company")
            to_branch_id = fields.get("to_branch_id")
            if to_branch_id is not None and getattr(location, "branch_id", None) != to_branch_id:
                raise TransferValidationError(
                    "Destination organization location does not belong to the destination branch"
                )

    def _validate_pending_transfer(
        self,
        ctx: TenantContext,
        asset_id: UUID,
        *,
        exclude_id: UUID | None,
    ) -> None:
        pending = self._transfers.find_pending_for_asset(ctx, asset_id, exclude_id=exclude_id)
        if pending is not None:
            raise TransferValidationError(
                f"Asset already has a pending transfer ({pending.document_number})"
            )

    @staticmethod
    def _validate_asset_is_transferable(status: str) -> None:
        if status not in {AssetStatus.ACTIVE.value, AssetStatus.IN_MAINTENANCE.value}:
            raise TransferValidationError("Only active or in_maintenance assets can be transferred")

    @staticmethod
    def _different(left, right) -> bool:
        if right in (None, ""):
            return False
        return left != right
