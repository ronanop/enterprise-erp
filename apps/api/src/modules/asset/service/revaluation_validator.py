"""Asset revaluation validation rules for FP-ASSET-007."""

from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.asset.domain.enums import AssetRevaluationStatus, AssetStatus
from modules.asset.domain.exceptions import RevaluationValidationError
from modules.asset.models import AstAssetRevaluation
from modules.asset.repository.asset_disposal_repository import AssetDisposalRepository
from modules.asset.repository.asset_repository import AssetRepository
from modules.asset.repository.asset_revaluation_repository import AssetRevaluationRepository
from modules.foundation.domain.value_objects import TenantContext

ELIGIBLE_ASSET_STATUSES = frozenset(
    {
        AssetStatus.ACTIVE.value,
        AssetStatus.IN_MAINTENANCE.value,
    }
)


class RevaluationValidator:
    def __init__(self, db: Session) -> None:
        self._assets = AssetRepository(db)
        self._revals = AssetRevaluationRepository(db)
        self._disposals = AssetDisposalRepository(db)

    def validate_create_fields(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        fields: dict,
    ) -> None:
        asset_id = fields.get("asset_id")
        if asset_id is None:
            raise RevaluationValidationError("asset_id is required")
        asset = self._assets.get(ctx, asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        if asset.company_id != company_id:
            raise RevaluationValidationError("Asset does not belong to this company")
        self._validate_asset_eligible(asset.status)
        self._validate_values(fields)
        self._validate_open_disposal(ctx, asset_id)
        self._validate_open_revaluation(ctx, asset_id, exclude_id=None)

    def validate_update_fields(
        self,
        ctx: TenantContext,
        row: AstAssetRevaluation,
        fields: dict,
    ) -> None:
        if row.status != AssetRevaluationStatus.DRAFT.value:
            raise RevaluationValidationError("Only draft revaluations can be updated")
        if "asset_id" in fields and fields["asset_id"] != row.asset_id:
            raise RevaluationValidationError("asset_id cannot be changed")
        if "document_number" in fields:
            raise RevaluationValidationError("document_number cannot be changed")
        merged = {
            "new_book_value": fields.get("new_book_value", row.new_book_value),
            "old_book_value": fields.get("old_book_value", row.old_book_value),
            "reason": fields.get("reason", row.reason),
            "revaluation_date": fields.get("revaluation_date", row.revaluation_date),
        }
        asset = self._assets.get(ctx, row.asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        self._validate_asset_eligible(asset.status)
        self._validate_values(merged)
        self._validate_open_disposal(ctx, row.asset_id)
        self._validate_open_revaluation(ctx, row.asset_id, exclude_id=row.id)

    def validate_submit_readiness(self, ctx: TenantContext, row: AstAssetRevaluation) -> None:
        if row.status != AssetRevaluationStatus.DRAFT.value:
            raise RevaluationValidationError("Only draft revaluations can be submitted")
        if row.revaluation_date is None:
            raise RevaluationValidationError("revaluation_date is required before submit")
        self._validate_operational_gates(ctx, row)

    def validate_post_readiness(self, ctx: TenantContext, row: AstAssetRevaluation) -> None:
        if (
            row.status == AssetRevaluationStatus.POSTED.value
            or row.finance_journal_id is not None
        ):
            raise RevaluationValidationError("Revaluation already posted")
        if row.status != AssetRevaluationStatus.APPROVED.value:
            raise RevaluationValidationError("Only approved revaluations can be posted")
        if row.revaluation_date is None:
            raise RevaluationValidationError("revaluation_date is required before posting")
        self._validate_operational_gates(ctx, row)

    def validate_reopen_readiness(self, ctx: TenantContext, row: AstAssetRevaluation) -> None:
        self._validate_open_revaluation(ctx, row.asset_id, exclude_id=row.id)
        self._validate_open_disposal(ctx, row.asset_id)

    def _validate_operational_gates(self, ctx: TenantContext, row: AstAssetRevaluation) -> None:
        asset = self._assets.get(ctx, row.asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        self._validate_asset_eligible(asset.status)
        self._validate_values(
            {
                "new_book_value": row.new_book_value,
                "old_book_value": row.old_book_value,
                "reason": row.reason,
            }
        )
        self._validate_open_disposal(ctx, row.asset_id)
        self._validate_open_revaluation(ctx, row.asset_id, exclude_id=row.id)

    def _validate_values(self, fields: dict) -> None:
        new_bv = fields.get("new_book_value")
        if new_bv is None:
            raise RevaluationValidationError("new_book_value is required")
        try:
            new_dec = Decimal(str(new_bv))
        except Exception as exc:  # noqa: BLE001
            raise RevaluationValidationError("new_book_value must be numeric") from exc
        if new_dec < 0:
            raise RevaluationValidationError("new_book_value cannot be negative")
        reason = fields.get("reason")
        if reason is None or not str(reason).strip():
            raise RevaluationValidationError("reason is required")
        old_bv = fields.get("old_book_value")
        if old_bv is not None:
            try:
                old_dec = Decimal(str(old_bv))
            except Exception as exc:  # noqa: BLE001
                raise RevaluationValidationError("old_book_value must be numeric") from exc
            if old_dec == new_dec:
                raise RevaluationValidationError(
                    "new_book_value must differ from old_book_value"
                )

    def _validate_open_disposal(self, ctx: TenantContext, asset_id: UUID) -> None:
        pending = self._disposals.find_pending_for_asset(ctx, asset_id, exclude_id=None)
        if pending is not None:
            raise RevaluationValidationError(
                f"Asset has an open disposal ({pending.document_number})"
            )

    def _validate_open_revaluation(
        self,
        ctx: TenantContext,
        asset_id: UUID,
        *,
        exclude_id: UUID | None,
    ) -> None:
        open_row = self._revals.find_pending_for_asset(ctx, asset_id, exclude_id=exclude_id)
        if open_row is not None:
            raise RevaluationValidationError(
                f"Asset already has an open revaluation ({open_row.document_number})"
            )

    @staticmethod
    def _validate_asset_eligible(status: str) -> None:
        if status in {AssetStatus.DISPOSED.value, AssetStatus.WRITTEN_OFF.value}:
            raise RevaluationValidationError(
                "Disposed or written-off assets cannot be revalued"
            )
        if status not in ELIGIBLE_ASSET_STATUSES:
            raise RevaluationValidationError(
                "Only active or in_maintenance assets can be revalued"
            )
