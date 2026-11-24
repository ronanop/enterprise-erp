"""IT Asset Type master service."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import AppException, ConflictException, NotFoundException
from modules.asset.repository.asset_type_repository import AssetTypeRepository
from modules.asset.service.asset_scope_validator import AssetScopeValidator
from modules.asset.service.site_access import ensure_site_admin, ensure_site_read
from modules.foundation.domain.value_objects import TenantContext
from modules.platform.compat.audit_facade import PlatformAuditFacade

# Seeded when a company has no types yet (mirrors migration 0506/0507).
# (name, requires_hardware_config, eligible_as_component)
DEFAULT_TYPES: list[tuple[str, bool, bool]] = [
    ("Laptop", True, False),
    ("Desktop", True, True),
    ("Monitor", False, True),
    ("Keyboard", False, True),
    ("Mouse", False, True),
    ("Mobile Device", True, True),
    ("Other", False, True),
]


def _clean_optional(value: object | None) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


class AssetTypeService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = AssetTypeRepository(db)
        self._scope = AssetScopeValidator(db)
        self._audit = PlatformAuditFacade(db)

    def _ensure_read(self, ctx: TenantContext) -> None:
        # IT members / asset readers can list types for forms & filters.
        ensure_site_read(ctx, self._db, "asset.type:read")

    def _ensure_write(self, ctx: TenantContext, permission: str) -> None:
        ensure_site_admin(ctx, self._db, permission)

    def ensure_defaults(self, ctx: TenantContext, company_id: UUID) -> None:
        """Seed the standard IT type catalog for a company.

        Companies that only have a partial catalog (e.g. a single ``laptop`` row
        from Excel import) still receive every missing default name so Add/Edit
        Asset Name dropdowns stay complete.
        """
        existing = self._repo.list_rows(ctx, company_id)
        have = {(row.name or "").strip().lower() for row in existing}
        for name, requires_hw, eligible in DEFAULT_TYPES:
            if name.strip().lower() in have:
                continue
            self._repo.create(
                ctx,
                company_id=company_id,
                name=name,
                requires_hardware_config=requires_hw,
                eligible_as_component=eligible,
                active=True,
            )
            have.add(name.strip().lower())

    def list(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        active: bool | None = None,
        search: str | None = None,
    ) -> list[dict]:
        self._ensure_read(ctx)
        cid = self._scope.resolve_list_company_id(ctx, company_id)
        # Seed defaults against the write/session company; list may be tenant-wide (cid=None).
        seed_cid = cid if cid is not None else self._scope.resolve_company_id(ctx, None)
        self.ensure_defaults(ctx, seed_cid)
        rows = self._repo.list_rows(ctx, cid, active=active, search=search)
        return [self._to_dict(r) for r in rows]

    def get(self, ctx: TenantContext, row_id: UUID) -> dict:
        self._ensure_read(ctx)
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Asset type not found")
        return self._to_dict(row)

    def create(self, ctx: TenantContext, **fields) -> dict:
        self._ensure_write(ctx, "asset.type:create")
        cid = self._scope.resolve_company_id(ctx, fields.pop("company_id", None))
        name = str(fields.get("name") or "").strip()
        if not name:
            raise AppException("name is required")
        if len(name) > 100:
            raise AppException("name exceeds maximum length")
        if self._repo.get_by_name(ctx, cid, name):
            raise ConflictException(f"Asset type '{name}' already exists")
        row = self._repo.create(
            ctx,
            company_id=cid,
            name=name,
            requires_hardware_config=bool(fields.get("requires_hardware_config", False)),
            eligible_as_component=bool(fields.get("eligible_as_component", True)),
            description=_clean_optional(fields.get("description")),
            active=bool(fields.get("active", True)),
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="ast_asset_type",
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return self._to_dict(row)

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> dict:
        self._ensure_write(ctx, "asset.type:update")
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Asset type not found")
        payload = dict(fields)
        if "name" in payload and payload["name"] is not None:
            name = str(payload["name"]).strip()
            if not name:
                raise AppException("name cannot be empty")
            if len(name) > 100:
                raise AppException("name exceeds maximum length")
            other = self._repo.get_by_name(ctx, row.company_id, name)
            if other and other.id != row.id:
                raise ConflictException(f"Asset type '{name}' already exists")
            payload["name"] = name
        if "description" in payload:
            payload["description"] = _clean_optional(payload["description"])
        if "requires_hardware_config" in payload and payload["requires_hardware_config"] is not None:
            payload["requires_hardware_config"] = bool(payload["requires_hardware_config"])
        if "eligible_as_component" in payload and payload["eligible_as_component"] is not None:
            payload["eligible_as_component"] = bool(payload["eligible_as_component"])
        if "active" in payload and payload["active"] is not None:
            # Prefer deactivate endpoint for clearer errors; still allow explicit true.
            payload["active"] = bool(payload["active"])
            if payload["active"] is False:
                self._assert_can_deactivate(ctx, row)
        updated = self._repo.update(ctx, row_id, **payload)
        if updated is None:
            raise ConflictException("Version conflict or type not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="ast_asset_type",
            entity_id=row_id,
            operation="update",
            performed_by=ctx.user_id,
        )
        return self._to_dict(updated)

    def deactivate(self, ctx: TenantContext, row_id: UUID) -> dict:
        self._ensure_write(ctx, "asset.type:update")
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Asset type not found")
        if not row.active:
            raise AppException("Asset type is already inactive")
        self._assert_can_deactivate(ctx, row)
        updated = self._repo.update(ctx, row_id, active=False)
        if updated is None:
            raise ConflictException("Version conflict or type not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="ast_asset_type",
            entity_id=row_id,
            operation="deactivate",
            performed_by=ctx.user_id,
        )
        return self._to_dict(updated)

    def reactivate(self, ctx: TenantContext, row_id: UUID) -> dict:
        self._ensure_write(ctx, "asset.type:update")
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Asset type not found")
        if row.active:
            raise AppException("Asset type is already active")
        updated = self._repo.update(ctx, row_id, active=True)
        if updated is None:
            raise ConflictException("Version conflict or type not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="ast_asset_type",
            entity_id=row_id,
            operation="reactivate",
            performed_by=ctx.user_id,
        )
        return self._to_dict(updated)

    def delete(self, ctx: TenantContext, row_id: UUID) -> None:
        """Soft-delete an asset type (any active/inactive row with no asset refs)."""
        self._ensure_write(ctx, "asset.type:update")
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Asset type not found")
        self._assert_no_asset_refs(ctx, row, action="delete")
        self._repo.soft_delete(ctx, row)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="ast_asset_type",
            entity_id=row_id,
            operation="delete",
            performed_by=ctx.user_id,
        )

    def _assert_can_deactivate(self, ctx: TenantContext, row) -> None:
        self._assert_no_asset_refs(ctx, row, action="deactivate")

    def _assert_no_asset_refs(
        self, ctx: TenantContext, row, *, action: str
    ) -> None:
        count = self._repo.count_assets_by_type(
            ctx, company_id=row.company_id, asset_type_id=row.id
        )
        if count > 0:
            raise AppException(
                f"Cannot {action} type while {count} asset(s) reference it"
            )

    @staticmethod
    def _to_dict(row) -> dict:
        return {
            "id": row.id,
            "name": row.name,
            "active": bool(row.active),
            "requires_hardware_config": bool(row.requires_hardware_config),
            "eligible_as_component": bool(getattr(row, "eligible_as_component", True)),
            "description": row.description,
            "company_id": row.company_id,
            "version": int(row.version or 1),
        }
