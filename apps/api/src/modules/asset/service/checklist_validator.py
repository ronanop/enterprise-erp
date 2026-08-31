"""Asset checklist validation rules for FP-ASSET-014."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.asset.domain.enums import AssetChecklistStatus, AssetStatus
from modules.asset.domain.exceptions import ChecklistValidationError
from modules.asset.models import AstAssetAudit, AstAssetChecklist, AstAssetMaintenance
from modules.asset.repository.asset_audit_repository import AssetAuditRepository
from modules.asset.repository.asset_checklist_repository import AssetChecklistRepository
from modules.asset.repository.asset_maintenance_repository import AssetMaintenanceRepository
from modules.asset.repository.asset_repository import AssetRepository
from modules.foundation.domain.value_objects import TenantContext

CHECKLIST_RESULTS = frozenset({"pass", "fail", "na"})
BLOCKED_ASSET_STATUSES = frozenset(
    {
        AssetStatus.DISPOSED.value,
        AssetStatus.WRITTEN_OFF.value,
    }
)


class ChecklistValidator:
    def __init__(self, db: Session) -> None:
        self._assets = AssetRepository(db)
        self._maintenances = AssetMaintenanceRepository(db)
        self._audits = AssetAuditRepository(db)
        self._checklists = AssetChecklistRepository(db)

    def validate_create_fields(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        fields: dict,
        exclude_id: UUID | None = None,
    ) -> None:
        if fields.get("status") and fields["status"] != AssetChecklistStatus.DRAFT.value:
            raise ChecklistValidationError("Checklist must be created in draft status")

        checklist_code = fields.get("checklist_code")
        if not checklist_code or not str(checklist_code).strip():
            raise ChecklistValidationError("checklist_code is required")
        checklist_name = fields.get("checklist_name")
        if not checklist_name or not str(checklist_name).strip():
            raise ChecklistValidationError("checklist_name is required")

        code = str(checklist_code).strip()
        existing = self._checklists.find_by_code(ctx, company_id, code, exclude_id=exclude_id)
        if existing is not None:
            raise ChecklistValidationError("checklist_code must be unique within the company")

        asset_id, maintenance, audit = self._validate_parent_links(
            ctx,
            company_id=company_id,
            asset_id=fields.get("asset_id"),
            maintenance_id=fields.get("maintenance_id"),
            audit_id=fields.get("audit_id"),
        )
        if asset_id is not None:
            asset = self._assets.get(ctx, asset_id)
            if asset is None:
                raise NotFoundException("Asset not found")
            self._validate_asset_belongs_to_company(asset, company_id)
            self._validate_asset_operational(asset.status)

        self._validate_items_json(fields.get("items_json"), completion=False)

        # Persist resolved asset on row when only maintenance/audit parent supplied.
        if fields.get("asset_id") is None and asset_id is not None:
            fields["asset_id"] = asset_id
        if maintenance is not None and fields.get("maintenance_id") is None:
            fields["maintenance_id"] = maintenance.id
        if audit is not None and fields.get("audit_id") is None:
            fields["audit_id"] = audit.id

    def validate_update_fields(
        self,
        ctx: TenantContext,
        row: AstAssetChecklist,
        fields: dict,
    ) -> None:
        if row.status != AssetChecklistStatus.DRAFT.value:
            raise ChecklistValidationError("Only draft checklists can be updated")
        if "status" in fields and fields["status"] is not None and fields["status"] != row.status:
            raise ChecklistValidationError("status cannot be changed via update")
        if "completed_at" in fields:
            raise ChecklistValidationError("completed_at cannot be changed via update")
        for key in ("asset_id", "maintenance_id", "audit_id", "checklist_code"):
            if key in fields and fields[key] is not None and fields[key] != getattr(row, key):
                raise ChecklistValidationError(f"{key} cannot be changed")

        self._validate_parent_links(
            ctx,
            company_id=row.company_id,
            asset_id=row.asset_id,
            maintenance_id=row.maintenance_id,
            audit_id=row.audit_id,
        )
        if row.asset_id is not None:
            asset = self._assets.get(ctx, row.asset_id)
            if asset is None:
                raise NotFoundException("Asset not found")
            self._validate_asset_belongs_to_company(asset, row.company_id)
            self._validate_asset_operational(asset.status)

        merged_items = fields.get("items_json", row.items_json)
        self._validate_items_json(merged_items, completion=False)

    def validate_complete_readiness(self, ctx: TenantContext, row: AstAssetChecklist) -> None:
        if row.status != AssetChecklistStatus.DRAFT.value:
            raise ChecklistValidationError("Only draft checklists can be completed")
        self._validate_parent_links(
            ctx,
            company_id=row.company_id,
            asset_id=row.asset_id,
            maintenance_id=row.maintenance_id,
            audit_id=row.audit_id,
        )
        if row.asset_id is not None:
            asset = self._assets.get(ctx, row.asset_id)
            if asset is None:
                raise NotFoundException("Asset not found")
            self._validate_asset_operational(asset.status)
        self._validate_items_json(row.items_json, completion=True)

    def validate_cancel_readiness(self, ctx: TenantContext, row: AstAssetChecklist) -> None:
        if row.status != AssetChecklistStatus.DRAFT.value:
            raise ChecklistValidationError("Only draft checklists can be cancelled")
        self._validate_parent_links(
            ctx,
            company_id=row.company_id,
            asset_id=row.asset_id,
            maintenance_id=row.maintenance_id,
            audit_id=row.audit_id,
        )

    def _validate_parent_links(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        asset_id: UUID | None,
        maintenance_id: UUID | None,
        audit_id: UUID | None,
    ) -> tuple[UUID | None, AstAssetMaintenance | None, AstAssetAudit | None]:
        if asset_id is None and maintenance_id is None and audit_id is None:
            raise ChecklistValidationError(
                "At least one of asset_id, maintenance_id, or audit_id is required"
            )

        maintenance = None
        audit = None
        resolved_asset_id = asset_id

        if maintenance_id is not None:
            maintenance = self._maintenances.get(ctx, maintenance_id)
            if maintenance is None:
                raise ChecklistValidationError("maintenance_id is invalid")
            if maintenance.company_id != company_id:
                raise ChecklistValidationError("Maintenance does not belong to this company")
            if resolved_asset_id is None:
                resolved_asset_id = maintenance.asset_id
            elif maintenance.asset_id != resolved_asset_id:
                raise ChecklistValidationError(
                    "asset_id must match the selected maintenance work order"
                )

        if audit_id is not None:
            audit = self._audits.get(ctx, audit_id)
            if audit is None:
                raise ChecklistValidationError("audit_id is invalid")
            if audit.company_id != company_id:
                raise ChecklistValidationError("Audit does not belong to this company")
            if resolved_asset_id is None:
                resolved_asset_id = audit.asset_id
            elif audit.asset_id is not None and audit.asset_id != resolved_asset_id:
                raise ChecklistValidationError("asset_id must match the selected audit")

        return resolved_asset_id, maintenance, audit

    @staticmethod
    def _validate_asset_belongs_to_company(asset, company_id: UUID) -> None:
        if asset.company_id != company_id:
            raise ChecklistValidationError("Asset does not belong to this company")

    @staticmethod
    def _validate_asset_operational(status: str) -> None:
        if status in BLOCKED_ASSET_STATUSES:
            raise ChecklistValidationError(
                "Checklists cannot be created or updated for disposed or written-off assets"
            )

    @staticmethod
    def _validate_items_json(items_json: dict | list | None, *, completion: bool) -> None:
        if items_json is None:
            if completion:
                raise ChecklistValidationError("items_json is required before complete")
            return
        if isinstance(items_json, list):
            raise ChecklistValidationError("items_json must be an object with an items array")
        if not isinstance(items_json, dict):
            raise ChecklistValidationError("items_json must be an object")
        items = items_json.get("items")
        if items is None:
            raise ChecklistValidationError("items_json must contain an items array")
        if not isinstance(items, list):
            raise ChecklistValidationError("items_json.items must be an array")
        if completion and not items:
            raise ChecklistValidationError("At least one checklist item is required before complete")

        for idx, item in enumerate(items):
            if not isinstance(item, dict):
                raise ChecklistValidationError(f"items_json.items[{idx}] must be an object")
            label = item.get("label")
            if not label or not str(label).strip():
                raise ChecklistValidationError(f"items_json.items[{idx}].label is required")
            result = item.get("result")
            if result is not None and result not in CHECKLIST_RESULTS:
                raise ChecklistValidationError(
                    f"items_json.items[{idx}].result must be pass, fail, or na"
                )
            if completion and item.get("required") and not result:
                raise ChecklistValidationError(
                    f"items_json.items[{idx}] requires a result before complete"
                )
