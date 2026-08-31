"""IT Location → Building master service."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from core.exceptions import AppException, ConflictException, NotFoundException
from modules.asset.models.site_location import AstLocation
from modules.asset.repository.site_location_repository import (
    SiteBuildingRepository,
    SiteLocationRepository,
)
from modules.asset.service.asset_scope_validator import AssetScopeValidator
from modules.asset.service.site_access import ensure_site_admin, ensure_site_read
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.organization.models.hierarchy import OrgLocation


def compose_site_label(location_name: str, building_name: str) -> str:
    return f"{location_name.strip()} · {building_name.strip()}"


class SiteLocationService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._locs = SiteLocationRepository(db)
        self._bldgs = SiteBuildingRepository(db)
        self._scope = AssetScopeValidator(db)
        self._audit = AuditService(db)

    def list_locations(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        search: str | None = None,
    ) -> list[dict]:
        ensure_site_read(ctx, self._db)
        cid = self._scope.resolve_company_id(ctx, company_id)
        return [self._loc_dict(r) for r in self._locs.list_rows(ctx, cid, search=search)]

    def create_location(self, ctx: TenantContext, **fields) -> dict:
        ensure_site_admin(ctx, self._db, "asset.site:create")
        cid = self._scope.resolve_company_id(ctx, fields.pop("company_id", None))
        name = str(fields.get("name") or "").strip()
        if not name:
            raise AppException("name is required")
        if self._locs.get_by_name(ctx, cid, name):
            raise ConflictException(f"Location '{name}' already exists")
        org_location_id = fields.get("org_location_id")
        if org_location_id is not None:
            self._validate_org_location(ctx, cid, org_location_id)
        is_ho = bool(fields.get("is_head_office", False))
        if is_ho:
            self._assert_no_other_head_office(ctx, cid)
        try:
            row = self._locs.create(
                ctx,
                company_id=cid,
                name=name,
                is_head_office=is_ho,
                org_location_id=org_location_id,
            )
        except IntegrityError as exc:
            raise ConflictException(
                "Only one Head Office Location is allowed per company"
                if "head_office" in str(exc.orig).lower()
                else f"Location '{name}' already exists"
            ) from exc
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="ast_location",
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
            new_value={"name": name, "is_head_office": is_ho},
        )
        return self._loc_dict(row)

    def update_location(self, ctx: TenantContext, row_id: UUID, **fields) -> dict:
        ensure_site_admin(ctx, self._db, "asset.site:update")
        row = self._locs.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Location not found")
        updates: dict = {}
        if "name" in fields and fields["name"] is not None:
            name = str(fields["name"]).strip()
            if not name:
                raise AppException("name is required")
            other = self._locs.get_by_name(ctx, row.company_id, name)
            if other is not None and other.id != row.id:
                raise ConflictException(f"Location '{name}' already exists")
            updates["name"] = name
        if "is_head_office" in fields and fields["is_head_office"] is not None:
            is_ho = bool(fields["is_head_office"])
            if is_ho and not row.is_head_office:
                self._assert_no_other_head_office(ctx, row.company_id, exclude_id=row.id)
            updates["is_head_office"] = is_ho
        if "org_location_id" in fields:
            oid = fields["org_location_id"]
            if oid is not None:
                self._validate_org_location(ctx, row.company_id, oid)
            updates["org_location_id"] = oid
        if not updates:
            return self._loc_dict(row)
        try:
            self._locs.update(ctx, row, **updates)
        except IntegrityError as exc:
            raise ConflictException(
                "Only one Head Office Location is allowed per company"
            ) from exc
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="ast_location",
            entity_id=row.id,
            operation="update",
            performed_by=ctx.user_id,
            new_value={k: (str(v) if hasattr(v, "hex") else v) for k, v in updates.items()},
        )
        return self._loc_dict(row)

    def deactivate_location(self, ctx: TenantContext, row_id: UUID) -> None:
        ensure_site_admin(ctx, self._db, "asset.site:update")
        row = self._locs.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Location not found")
        if self._locs.count_buildings(ctx, row.id) > 0:
            raise AppException("Deactivate or remove buildings before deleting this Location")
        self._locs.soft_delete(ctx, row)

    def list_buildings(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        location_id: UUID | None = None,
        search: str | None = None,
    ) -> list[dict]:
        ensure_site_read(ctx, self._db)
        cid = self._scope.resolve_company_id(ctx, company_id)
        return [
            self._bldg_dict(r)
            for r in self._bldgs.list_rows(
                ctx, cid, location_id=location_id, search=search
            )
        ]

    def create_building(self, ctx: TenantContext, **fields) -> dict:
        ensure_site_admin(ctx, self._db, "asset.site:create")
        cid = self._scope.resolve_company_id(ctx, fields.pop("company_id", None))
        location_id = fields.get("location_id")
        if location_id is None:
            raise AppException("location_id is required")
        loc = self._locs.get(ctx, location_id)
        if loc is None or loc.company_id != cid:
            raise NotFoundException("Location not found")
        name = str(fields.get("name") or "").strip()
        if not name:
            raise AppException("name is required")
        if self._bldgs.get_by_name(ctx, location_id, name):
            raise ConflictException(f"Building '{name}' already exists for this Location")
        try:
            row = self._bldgs.create(
                ctx,
                company_id=cid,
                location_id=location_id,
                name=name,
            )
        except IntegrityError as exc:
            raise ConflictException(
                f"Building '{name}' already exists for this Location"
            ) from exc
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="ast_building",
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
            new_value={"name": name, "location_id": str(location_id)},
        )
        return self._bldg_dict(row)

    def update_building(self, ctx: TenantContext, row_id: UUID, **fields) -> dict:
        ensure_site_admin(ctx, self._db, "asset.site:update")
        row = self._bldgs.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Building not found")
        updates: dict = {}
        if "name" in fields and fields["name"] is not None:
            name = str(fields["name"]).strip()
            if not name:
                raise AppException("name is required")
            other = self._bldgs.get_by_name(ctx, row.location_id, name)
            if other is not None and other.id != row.id:
                raise ConflictException(f"Building '{name}' already exists for this Location")
            updates["name"] = name
        if not updates:
            return self._bldg_dict(row)
        try:
            self._bldgs.update(ctx, row, **updates)
        except IntegrityError as exc:
            raise ConflictException("Building name conflict") from exc
        return self._bldg_dict(row)

    def deactivate_building(self, ctx: TenantContext, row_id: UUID) -> None:
        ensure_site_admin(ctx, self._db, "asset.site:update")
        row = self._bldgs.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Building not found")
        self._bldgs.soft_delete(ctx, row)

    def resolve_pair(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        location_id: UUID,
        building_id: UUID,
    ) -> tuple:
        """Return (location, building, composed_label, org_location_id)."""
        loc = self._locs.get(ctx, location_id)
        if loc is None or loc.company_id != company_id:
            raise NotFoundException("Location not found")
        bldg = self._bldgs.get(ctx, building_id)
        if bldg is None or bldg.location_id != location_id or bldg.company_id != company_id:
            raise AppException("Building does not belong to the selected Location")
        return loc, bldg, compose_site_label(loc.name, bldg.name), loc.org_location_id

    def _assert_no_other_head_office(
        self,
        ctx: TenantContext,
        company_id: UUID,
        *,
        exclude_id: UUID | None = None,
    ) -> None:
        stmt = select(AstLocation).where(
            AstLocation.company_id == company_id,
            AstLocation.is_deleted.is_(False),
            AstLocation.is_head_office.is_(True),
        )
        if exclude_id is not None:
            stmt = stmt.where(AstLocation.id != exclude_id)
        if self._db.scalar(stmt) is not None:
            raise ConflictException("Only one Head Office Location is allowed per company")

    def _validate_org_location(
        self, ctx: TenantContext, company_id: UUID, org_location_id: UUID
    ) -> None:
        stmt = select(OrgLocation).where(
            OrgLocation.id == org_location_id,
            OrgLocation.company_id == company_id,
            OrgLocation.is_deleted.is_(False),
        )
        if self._db.scalar(stmt) is None:
            raise AppException("org_location_id is invalid for this company")

    @staticmethod
    def _loc_dict(row) -> dict:
        return {
            "id": row.id,
            "name": row.name,
            "is_head_office": bool(row.is_head_office),
            "org_location_id": row.org_location_id,
            "company_id": row.company_id,
            "version": row.version,
        }

    @staticmethod
    def _bldg_dict(row) -> dict:
        return {
            "id": row.id,
            "location_id": row.location_id,
            "name": row.name,
            "company_id": row.company_id,
            "version": row.version,
        }
