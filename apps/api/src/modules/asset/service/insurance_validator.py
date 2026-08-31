"""Asset insurance validation rules for FP-ASSET-010."""

from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.asset.adapters.master_data_port import AssetMasterDataAdapter
from modules.asset.domain.enums import AssetInsuranceStatus, AssetStatus
from modules.asset.domain.exceptions import InsuranceValidationError
from modules.asset.models import AstAssetInsurance
from modules.asset.repository.asset_insurance_repository import AssetInsuranceRepository
from modules.asset.repository.asset_repository import AssetRepository
from modules.foundation.domain.value_objects import TenantContext

ELIGIBLE_ASSET_STATUSES = frozenset(
    {
        AssetStatus.ACTIVE.value,
        AssetStatus.IN_MAINTENANCE.value,
        AssetStatus.TRANSFERRED.value,
    }
)
OPEN_INSURANCE_STATUSES = frozenset(
    {
        AssetInsuranceStatus.ACTIVE.value,
        AssetInsuranceStatus.RENEWED.value,
    }
)
EDITABLE_STATUSES = frozenset(
    {
        AssetInsuranceStatus.DRAFT.value,
        AssetInsuranceStatus.ACTIVE.value,
    }
)


class InsuranceValidator:
    def __init__(self, db: Session) -> None:
        self._assets = AssetRepository(db)
        self._insurances = AssetInsuranceRepository(db)
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
            raise InsuranceValidationError("asset_id is required")

        policy_number = fields.get("policy_number")
        if not policy_number or not str(policy_number).strip():
            raise InsuranceValidationError("policy_number is required")

        insurer_name = fields.get("insurer_name")
        if not insurer_name or not str(insurer_name).strip():
            raise InsuranceValidationError("insurer_name is required")

        start_date = fields.get("start_date")
        end_date = fields.get("end_date")
        if start_date is None:
            raise InsuranceValidationError("start_date is required")
        if end_date is None:
            raise InsuranceValidationError("end_date is required")
        self._validate_dates(start_date, end_date)

        coverage_amount = fields.get("coverage_amount")
        if coverage_amount is not None:
            self._validate_coverage_amount(coverage_amount)

        vendor_id = fields.get("vendor_id")
        if vendor_id is not None:
            self._validate_vendor(ctx, vendor_id)

        asset = self._assets.get(ctx, asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        if asset.company_id != company_id:
            raise InsuranceValidationError("Asset does not belong to this company")
        self._validate_asset_eligible(asset.status)

    def validate_update_fields(
        self,
        ctx: TenantContext,
        row: AstAssetInsurance,
        fields: dict,
    ) -> None:
        if row.status not in EDITABLE_STATUSES:
            raise InsuranceValidationError("Only draft or active insurance policies can be updated")
        if "asset_id" in fields and fields["asset_id"] != row.asset_id:
            raise InsuranceValidationError("asset_id cannot be changed")
        if "status" in fields and fields["status"] is not None and fields["status"] != row.status:
            raise InsuranceValidationError("status cannot be changed via update")

        if (
            row.status == AssetInsuranceStatus.ACTIVE.value
            and "end_date" in fields
            and fields["end_date"] is not None
            and fields["end_date"] != row.end_date
        ):
            raise InsuranceValidationError(
                "end_date cannot be changed on an active insurance policy; use POST /renew"
            )

        start_date = fields.get("start_date", row.start_date)
        end_date = fields.get("end_date", row.end_date)
        if row.status == AssetInsuranceStatus.ACTIVE.value:
            end_date = row.end_date
        self._validate_dates(start_date, end_date)

        policy_number = fields.get("policy_number", row.policy_number)
        if not policy_number or not str(policy_number).strip():
            raise InsuranceValidationError("policy_number is required")

        insurer_name = fields.get("insurer_name", row.insurer_name)
        if not insurer_name or not str(insurer_name).strip():
            raise InsuranceValidationError("insurer_name is required")

        coverage_amount = fields.get("coverage_amount", row.coverage_amount)
        if coverage_amount is not None:
            self._validate_coverage_amount(coverage_amount)

        vendor_id = fields.get("vendor_id", row.vendor_id)
        if vendor_id is not None:
            self._validate_vendor(ctx, vendor_id)

        self._validate_row_asset(ctx, row)

    def validate_activate_readiness(self, ctx: TenantContext, row: AstAssetInsurance) -> None:
        if row.status != AssetInsuranceStatus.DRAFT.value:
            raise InsuranceValidationError("Only draft insurance policies can be activated")
        self._validate_dates(row.start_date, row.end_date)
        if not row.policy_number or not row.insurer_name:
            raise InsuranceValidationError("policy_number and insurer_name are required before activate")
        self._validate_row_asset(ctx, row)
        self._validate_no_open_policy(ctx, row)

    def validate_renew_readiness(
        self,
        ctx: TenantContext,
        row: AstAssetInsurance,
        *,
        new_end_date: date,
    ) -> None:
        if row.status != AssetInsuranceStatus.ACTIVE.value:
            raise InsuranceValidationError("Only active insurance policies can be renewed")
        if new_end_date is None:
            raise InsuranceValidationError("new_end_date is required")
        if new_end_date <= row.end_date:
            raise InsuranceValidationError("new_end_date must be greater than current end_date")
        if new_end_date < row.start_date:
            raise InsuranceValidationError("new_end_date must be on or after start_date")
        self._validate_row_asset(ctx, row)

    def validate_expire_readiness(self, ctx: TenantContext, row: AstAssetInsurance) -> None:
        if row.status not in OPEN_INSURANCE_STATUSES:
            raise InsuranceValidationError(
                "Only active or renewed insurance policies can be expired"
            )

    def validate_close_readiness(self, ctx: TenantContext, row: AstAssetInsurance) -> None:
        if row.status != AssetInsuranceStatus.EXPIRED.value:
            raise InsuranceValidationError("Only expired insurance policies can be closed")

    def _validate_no_open_policy(self, ctx: TenantContext, row: AstAssetInsurance) -> None:
        existing = self._insurances.find_open_for_asset(
            ctx,
            company_id=row.company_id,
            asset_id=row.asset_id,
            exclude_id=row.id,
        )
        if existing is not None:
            raise InsuranceValidationError(
                "Asset already has an active or renewed insurance policy"
            )

    def _validate_row_asset(self, ctx: TenantContext, row: AstAssetInsurance) -> None:
        if row.asset_id is None:
            raise InsuranceValidationError("asset_id is required")
        asset = self._assets.get(ctx, row.asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        self._validate_asset_eligible(asset.status)

    def _validate_vendor(self, ctx: TenantContext, vendor_id: UUID) -> None:
        try:
            vendor = self._master.get_vendor(ctx, vendor_id)
        except Exception as exc:  # noqa: BLE001
            raise InsuranceValidationError("vendor_id is invalid") from exc
        if vendor is None:
            raise InsuranceValidationError("vendor_id is invalid")

    @staticmethod
    def _validate_dates(start_date: date, end_date: date) -> None:
        if start_date is None or end_date is None:
            raise InsuranceValidationError("start_date and end_date are required")
        if start_date > end_date:
            raise InsuranceValidationError("start_date must be on or before end_date")

    @staticmethod
    def _validate_coverage_amount(coverage_amount: Decimal | float | int) -> None:
        if Decimal(str(coverage_amount)) <= 0:
            raise InsuranceValidationError("coverage_amount must be greater than zero")

    @staticmethod
    def _validate_asset_eligible(status: str) -> None:
        if status in {AssetStatus.DISPOSED.value, AssetStatus.WRITTEN_OFF.value}:
            raise InsuranceValidationError(
                "Disposed or written-off assets cannot have insurance policies"
            )
        if status not in ELIGIBLE_ASSET_STATUSES:
            raise InsuranceValidationError(
                "Only active, in_maintenance, or transferred assets can have insurance policies"
            )
