"""Asset category validation (CR-001)."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.asset.domain.enums import AssetCategoryStatus
from modules.asset.domain.exceptions import CategoryValidationError
from modules.asset.models import AstAssetCategory
from modules.asset.repository.asset_category_repository import AssetCategoryRepository
from modules.asset.repository.asset_repository import AssetRepository
from modules.foundation.domain.value_objects import TenantContext

_DEPR_METHODS = frozenset({"straight_line", "wdv", "units_of_production"})
_OPERATIONAL_STATUSES = frozenset(
    {
        "draft",
        "submitted",
        "approved",
        "active",
        "in_maintenance",
        "transferred",
    }
)


class CategoryValidator:
    def __init__(self, db: Session) -> None:
        self._categories = AssetCategoryRepository(db)
        self._assets = AssetRepository(db)

    def validate_create_fields(self, ctx: TenantContext, company_id: UUID, fields: dict) -> None:
        code = str(fields.get("category_code") or "").strip()
        name = str(fields.get("category_name") or "").strip()
        if not code:
            raise CategoryValidationError("category_code is required")
        if len(code) > 50:
            raise CategoryValidationError("category_code exceeds maximum length")
        if not name:
            raise CategoryValidationError("category_name is required")
        if len(name) > 255:
            raise CategoryValidationError("category_name exceeds maximum length")
        fields["category_code"] = code
        fields["category_name"] = name
        self._validate_depreciation_fields(fields)
        status = fields.get("status")
        if status is not None and status not in {
            AssetCategoryStatus.ACTIVE.value,
            AssetCategoryStatus.INACTIVE.value,
        }:
            raise CategoryValidationError("Invalid category status")
        existing = self._categories.get_by_code(ctx, company_id, code)
        if existing is not None:
            raise CategoryValidationError(f"Category code '{code}' already exists")

    def validate_update_fields(self, row: AstAssetCategory, fields: dict) -> None:
        if "category_code" in fields and fields["category_code"] is not None:
            raise CategoryValidationError("category_code is immutable")
        if "status" in fields and fields["status"] is not None:
            raise CategoryValidationError(
                "Use deactivate/reactivate endpoints to change category status"
            )
        if "category_name" in fields and fields["category_name"] is not None:
            name = str(fields["category_name"]).strip()
            if not name:
                raise CategoryValidationError("category_name cannot be empty")
            if len(name) > 255:
                raise CategoryValidationError("category_name exceeds maximum length")
            fields["category_name"] = name
        self._validate_depreciation_fields(fields)

    def validate_deactivate(self, ctx: TenantContext, row: AstAssetCategory) -> None:
        count = self._assets.count_operational_by_category(
            ctx,
            company_id=row.company_id,
            asset_category_id=row.id,
            statuses=_OPERATIONAL_STATUSES,
        )
        if count > 0:
            raise CategoryValidationError(
                f"Cannot deactivate category while {count} operational asset(s) reference it"
            )

    @staticmethod
    def _validate_depreciation_fields(fields: dict) -> None:
        method = fields.get("default_depreciation_method")
        if method is not None and method != "":
            if method not in _DEPR_METHODS:
                raise CategoryValidationError(
                    "default_depreciation_method must be straight_line, wdv, or units_of_production"
                )
        life = fields.get("default_useful_life_months")
        if life is not None:
            try:
                life_int = int(life)
            except (TypeError, ValueError) as exc:
                raise CategoryValidationError(
                    "default_useful_life_months must be an integer"
                ) from exc
            if life_int < 0:
                raise CategoryValidationError(
                    "default_useful_life_months must be zero or greater"
                )
            fields["default_useful_life_months"] = life_int
