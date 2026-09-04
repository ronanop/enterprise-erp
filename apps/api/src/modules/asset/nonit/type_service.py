"""Non-IT asset type service."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import AppException, ConflictException, NotFoundException
from modules.asset.domain.enums import (
    NONIT_ASSIGNMENT_MODE_VALUES,
    NONIT_ASSET_TYPE_CATEGORY_VALUES,
)
from modules.asset.nonit.access import (
    ensure_nonit_member_or_permission,
    ensure_nonit_type_admin_or_permission,
)
from modules.asset.nonit.code_service import NonItCodeService
from modules.asset.nonit.repository_type import NonItAssetTypeRepository
from modules.asset.service.asset_scope_validator import AssetScopeValidator
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService

DEFAULT_TYPES: list[tuple[str, str, str, str]] = [
    ("Chair", "CH", "EMPLOYEE", "FURNITURE"),
    ("Table-Desk", "TBD", "EMPLOYEE", "FURNITURE"),
    ("AC", "AC", "LOCATION", "APPLIANCE"),
    ("LED TV", "TV", "LOCATION", "ELECTRONICS"),
]


def _clean_optional(value: object | None) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


class NonItAssetTypeService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = NonItAssetTypeRepository(db)
        self._codes = NonItCodeService(db)
        self._scope = AssetScopeValidator(db)
        self._audit = AuditService(db)

    def _ensure_read(self, ctx: TenantContext) -> None:
        ensure_nonit_member_or_permission(ctx, self._db, "asset.nonit_type:read")

    def _ensure_write(self, ctx: TenantContext, permission: str) -> None:
        ensure_nonit_type_admin_or_permission(ctx, self._db, permission)

    @staticmethod
    def _normalize_category(raw: object | None, *, default: str = "OTHER") -> str:
        category = str(raw or default).strip().upper() or default
        if category not in NONIT_ASSET_TYPE_CATEGORY_VALUES:
            raise AppException(f"Invalid category: {category}")
        return category

    def ensure_defaults(self, ctx: TenantContext, company_id: UUID) -> None:
        existing = self._repo.list_rows(ctx, company_id)
        if existing:
            return
        for name, prefix, mode, category in DEFAULT_TYPES:
            self._repo.create(
                ctx,
                company_id=company_id,
                name=name,
                prefix=prefix,
                assignment_mode=mode,
                category=category,
                active=True,
            )

    def list(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        active: bool | None = None,
        search: str | None = None,
        category: str | None = None,
    ) -> list[dict]:
        self._ensure_read(ctx)
        cid = self._scope.resolve_company_id(ctx, company_id)
        self.ensure_defaults(ctx, cid)
        cat = self._normalize_category(category) if category else None
        rows = self._repo.list_rows(ctx, cid, active=active, search=search, category=cat)
        return [self._to_dict(r) for r in rows]

    def peek_next_code(
        self,
        ctx: TenantContext,
        row_id: UUID,
        *,
        company_id: UUID | None = None,
    ) -> dict:
        """Provisional next asset code for UI preview (unlocked read)."""
        ensure_nonit_member_or_permission(ctx, self._db, "asset.nonit_asset:create")
        cid = self._scope.resolve_company_id(ctx, company_id)
        code = self._codes.peek_next_code(ctx, cid, row_id)
        return {"asset_type_id": row_id, "provisional_code": code}

    def create(self, ctx: TenantContext, **fields) -> dict:
        self._ensure_write(ctx, "asset.nonit_type:create")
        cid = self._scope.resolve_company_id(ctx, fields.pop("company_id", None))
        name = str(fields.get("name") or "").strip()
        prefix = str(fields.get("prefix") or "").strip().upper()
        mode = str(fields.get("assignment_mode") or "").strip().upper()
        if not name:
            raise AppException("name is required")
        if not prefix:
            raise AppException("prefix is required")
        if mode not in NONIT_ASSIGNMENT_MODE_VALUES:
            raise AppException(
                f"assignment_mode must be one of: {', '.join(sorted(NONIT_ASSIGNMENT_MODE_VALUES))}"
            )
        if self._repo.get_by_name(ctx, cid, name):
            raise ConflictException(f"Asset type '{name}' already exists")
        if self._repo.get_by_prefix(ctx, cid, prefix):
            raise ConflictException(f"Prefix '{prefix}' already in use")
        row = self._repo.create(
            ctx,
            company_id=cid,
            name=name,
            prefix=prefix,
            assignment_mode=mode,
            category=self._normalize_category(fields.get("category")),
            description=_clean_optional(fields.get("description")),
            active=bool(fields.get("active", True)),
            metadata=fields.get("metadata"),
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="ast_nonit_asset_type",
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return self._to_dict(row)

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> dict:
        self._ensure_write(ctx, "asset.nonit_type:update")
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Non-IT asset type not found")
        payload = dict(fields)
        if "name" in payload and payload["name"] is not None:
            name = str(payload["name"]).strip()
            if not name:
                raise AppException("name cannot be empty")
            other = self._repo.get_by_name(ctx, row.company_id, name)
            if other and other.id != row.id:
                raise ConflictException(f"Asset type '{name}' already exists")
            payload["name"] = name
        if "prefix" in payload and payload["prefix"] is not None:
            prefix = str(payload["prefix"]).strip().upper()
            if not prefix:
                raise AppException("prefix cannot be empty")
            other = self._repo.get_by_prefix(ctx, row.company_id, prefix)
            if other and other.id != row.id:
                raise ConflictException(f"Prefix '{prefix}' already in use")
            payload["prefix"] = prefix
        if "assignment_mode" in payload and payload["assignment_mode"] is not None:
            mode = str(payload["assignment_mode"]).strip().upper()
            if mode not in NONIT_ASSIGNMENT_MODE_VALUES:
                raise AppException(
                    f"assignment_mode must be one of: {', '.join(sorted(NONIT_ASSIGNMENT_MODE_VALUES))}"
                )
            payload["assignment_mode"] = mode
        if "category" in payload and payload["category"] is not None:
            payload["category"] = self._normalize_category(payload["category"])
        if "description" in payload:
            payload["description"] = _clean_optional(payload["description"])
        updated = self._repo.update(ctx, row_id, **payload)
        if updated is None:
            raise ConflictException("Version conflict or type not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="ast_nonit_asset_type",
            entity_id=row_id,
            operation="update",
            performed_by=ctx.user_id,
        )
        return self._to_dict(updated)

    @staticmethod
    def _to_dict(row) -> dict:
        return {
            "id": row.id,
            "name": row.name,
            "prefix": row.prefix,
            "active": bool(row.active),
            "assignment_mode": row.assignment_mode,
            "category": getattr(row, "category", None) or "OTHER",
            "description": getattr(row, "description", None),
            "metadata": row.metadata_json,
            "company_id": row.company_id,
            "version": int(row.version or 1),
        }
