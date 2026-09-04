"""Non-IT location service."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import AppException, ConflictException, NotFoundException
from modules.asset.domain.enums import NONIT_LOCATION_KIND_VALUES
from modules.asset.nonit.access import (
    ensure_nonit_member_or_permission,
    ensure_nonit_type_admin_or_permission,
)
from modules.asset.nonit.repository_location import NonItLocationRepository
from modules.asset.service.asset_scope_validator import AssetScopeValidator
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService


def _clean_optional(value: object | None, *, max_len: int | None = None) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    if max_len is not None:
        return text[:max_len]
    return text


class NonItLocationService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = NonItLocationRepository(db)
        self._scope = AssetScopeValidator(db)
        self._audit = AuditService(db)

    def _resolve_branch(self, ctx: TenantContext, company_id: UUID, branch_id: UUID | None) -> UUID:
        bid = branch_id or ctx.branch_id
        if bid is None:
            from sqlalchemy import select

            from modules.organization.models.branch import OrgBranch

            bid = self._db.scalar(
                select(OrgBranch.id)
                .where(
                    OrgBranch.company_id == company_id,
                    OrgBranch.tenant_id == ctx.tenant_id,
                    OrgBranch.is_deleted.is_(False),
                )
                .order_by(OrgBranch.created_at.asc())
                .limit(1)
            )
        if bid is None:
            raise AppException("branch_id is required")
        self._scope.validate_branch_access(ctx, bid)
        return bid

    @staticmethod
    def _normalize_kind(raw: object | None, *, default: str = "OTHER") -> str:
        kind = str(raw or default).strip().upper() or default
        if kind not in NONIT_LOCATION_KIND_VALUES:
            raise AppException(f"Invalid location_kind: {kind}")
        return kind

    def list(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        active: bool | None = None,
        search: str | None = None,
        location_kind: str | None = None,
    ) -> list[dict]:
        ensure_nonit_member_or_permission(ctx, self._db, "asset.nonit_asset:read")
        cid = self._scope.resolve_company_id(ctx, company_id)
        kind = None
        if location_kind:
            kind = self._normalize_kind(location_kind)
        rows = self._repo.list_rows(
            ctx, cid, active=active, search=search, location_kind=kind
        )
        return [self._to_dict(r) for r in rows]

    def create(self, ctx: TenantContext, **fields) -> dict:
        ensure_nonit_type_admin_or_permission(ctx, self._db, "asset.nonit_type:create")
        cid = self._scope.resolve_company_id(ctx, fields.pop("company_id", None))
        bid = self._resolve_branch(ctx, cid, fields.pop("branch_id", None))
        name = str(fields.get("name") or "").strip()
        if not name:
            raise AppException("name is required")
        row = self._repo.create(
            ctx,
            company_id=cid,
            branch_id=bid,
            name=name,
            location_kind=self._normalize_kind(fields.get("location_kind")),
            code=_clean_optional(fields.get("code"), max_len=40),
            building=_clean_optional(fields.get("building"), max_len=120),
            floor=_clean_optional(fields.get("floor"), max_len=40),
            remarks=_clean_optional(fields.get("remarks")),
            active=bool(fields.get("active", True)),
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="ast_nonit_location",
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return self._to_dict(row)

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> dict:
        ensure_nonit_type_admin_or_permission(ctx, self._db, "asset.nonit_type:update")
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Non-IT location not found")
        payload = dict(fields)
        if "name" in payload and payload["name"] is not None:
            name = str(payload["name"]).strip()
            if not name:
                raise AppException("name cannot be empty")
            payload["name"] = name
        if "location_kind" in payload and payload["location_kind"] is not None:
            payload["location_kind"] = self._normalize_kind(payload["location_kind"])
        for key, max_len in (("code", 40), ("building", 120), ("floor", 40)):
            if key in payload:
                payload[key] = _clean_optional(payload[key], max_len=max_len)
        if "remarks" in payload:
            payload["remarks"] = _clean_optional(payload["remarks"])
        updated = self._repo.update(ctx, row_id, **payload)
        if updated is None:
            raise ConflictException("Version conflict or location not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="ast_nonit_location",
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
            "location_kind": getattr(row, "location_kind", None) or "OTHER",
            "code": getattr(row, "code", None),
            "building": getattr(row, "building", None),
            "floor": getattr(row, "floor", None),
            "remarks": getattr(row, "remarks", None),
            "active": bool(row.active),
            "company_id": row.company_id,
            "branch_id": row.branch_id,
            "version": int(row.version or 1),
        }
