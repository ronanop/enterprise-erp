"""Asset service."""

from datetime import date
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.master_data.domain.enums import MasterEntityType
from modules.master_data.models.asset import MasterAsset
from modules.master_data.repository.asset_repository import AssetRepository
from modules.master_data.service.code_generator_service import CodeGeneratorService
from modules.master_data.service.duplicate_checker_service import DuplicateCheckerService
from modules.master_data.service.master_scope_validator import MasterScopeValidator


def _json_safe_audit_value(value: Any) -> Any:
    """Convert UUID values to strings for JSONB audit payloads; preserve None/scalars."""
    if isinstance(value, UUID):
        return str(value)
    return value


def _json_safe_audit_payload(fields: dict[str, Any]) -> dict[str, Any]:
    return {key: _json_safe_audit_value(value) for key, value in fields.items()}


class AssetService:
    def __init__(self, db: Session) -> None:
        self._repo = AssetRepository(db)
        self._audit = AuditService(db)
        self._codes = CodeGeneratorService(db)
        self._duplicates = DuplicateCheckerService(db)
        self._scope = MasterScopeValidator(db)

    def list_assets(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        branch_id: UUID | None = None,
    ):
        if company_id:
            self._scope.validate_company_access(ctx, company_id)
        if branch_id:
            self._scope.validate_branch_access(ctx, branch_id)
        return self._repo.list_assets(ctx, company_id=company_id, branch_id=branch_id)

    def get_asset(self, ctx: TenantContext, asset_id: UUID):
        asset = self._repo.get_by_id(ctx, asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        self._scope.validate_company_access(ctx, asset.company_id)
        self._scope.validate_branch_access(ctx, asset.branch_id)
        return asset

    def create_asset(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        branch_id: UUID,
        asset_code: str | None = None,
        asset_name: str,
        asset_category: str,
        serial_number: str | None = None,
        purchase_date: date | None = None,
        purchase_value: float | None = None,
        location_id: UUID | None = None,
        custodian_employee_id: UUID | None = None,
    ):
        resolved_company_id = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)

        if asset_code is None:
            asset_code = self._codes.generate(
                MasterEntityType.ASSET,
                resolved_company_id,
                model=MasterAsset,
                code_column="asset_code",
            )
        else:
            self._duplicates.ensure_unique_code(
                model=MasterAsset,
                company_id=resolved_company_id,
                code=asset_code,
                code_field="asset_code",
                label="Asset",
            )

        asset = self._repo.create(
            ctx,
            company_id=resolved_company_id,
            branch_id=branch_id,
            asset_code=asset_code,
            asset_name=asset_name,
            asset_category=asset_category,
            serial_number=serial_number,
            purchase_date=purchase_date,
            purchase_value=purchase_value,
            location_id=location_id,
            custodian_employee_id=custodian_employee_id,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="master_asset",
            entity_id=asset.id,
            operation="create",
            performed_by=ctx.user_id,
            new_value={"asset_code": asset_code, "branch_id": str(branch_id)},
        )
        return asset

    def update_asset(self, ctx: TenantContext, asset_id: UUID, **fields):
        self.get_asset(ctx, asset_id)
        if "branch_id" in fields and fields["branch_id"] is not None:
            self._scope.validate_branch_access(ctx, fields["branch_id"])

        # Keep original UUID-typed fields for ORM update; audit gets a JSON-safe copy.
        updated = self._repo.update(ctx, asset_id, **fields)
        if updated is None:
            raise NotFoundException("Asset not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="master_asset",
            entity_id=asset_id,
            operation="update",
            performed_by=ctx.user_id,
            new_value=_json_safe_audit_payload(fields),
        )
        return updated

    def delete_asset(self, ctx: TenantContext, asset_id: UUID) -> None:
        self.get_asset(ctx, asset_id)
        if not self._repo.soft_delete(ctx, asset_id):
            raise NotFoundException("Asset not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="master_asset",
            entity_id=asset_id,
            operation="delete",
            performed_by=ctx.user_id,
        )
