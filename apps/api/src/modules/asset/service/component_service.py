"""AssetComponentService — lightweight child components (FP-ASSET-019).

Option B: components are not assets/inventory. Depth-1 under parent asset.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.asset.domain.enums import AssetComponentStatus
from modules.asset.models import AstAssetComponent
from modules.asset.repository.asset_component_repository import (
    AssetComponentListFilters,
    AssetComponentRepository,
)
from modules.asset.service.asset_scope_validator import AssetScopeValidator
from modules.asset.service.component_validator import ComponentValidator
from modules.asset.service.engines import AssetComponentEngine
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService

ENTITY_AST_COMPONENT = "ast_asset_component"


class AssetComponentService:
    def __init__(self, db: Session) -> None:
        self._repo = AssetComponentRepository(db)
        self._scope = AssetScopeValidator(db)
        self._engine = AssetComponentEngine()
        self._audit = AuditService(db)
        self._validator = ComponentValidator(db)

    def search(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        asset_id: UUID | None = None,
        asset_ids: list[UUID] | None = None,
        status: str | None = None,
        product_id: UUID | None = None,
        branch_id: UUID | None = None,
        component_type: str | None = None,
        search: str | None = None,
        sort: str = "created_at",
        offset: int = 0,
        limit: int = 25,
        include_availability: bool = False,
    ) -> tuple[list[AstAssetComponent] | list[dict], int]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        if sort not in {"created_at", "component_code", "component_name"}:
            sort = "created_at"
        if asset_ids:
            rows = self._repo.list_by_asset_ids(
                ctx, company_id=cid, asset_ids=asset_ids, status=status
            )
            if component_type:
                rows = [r for r in rows if getattr(r, "component_type", None) == component_type]
            total = len(rows)
            rows = rows[offset : offset + limit]
        else:
            rows, total = self._repo.search(
                ctx,
                AssetComponentListFilters(
                    company_id=cid,
                    asset_id=asset_id,
                    status=status,
                    product_id=product_id,
                    branch_id=branch_id,
                    search=search,
                    sort=sort,
                ),
                offset=offset,
                limit=limit,
            )
            if component_type:
                # Prefer DB filter when single asset_id path — apply post-filter for now
                rows = [r for r in rows if getattr(r, "component_type", None) == component_type]
                # total may be approximate when type filter applied without recount
        if not include_availability:
            return rows, total
        from modules.asset.repository.assignment_component_repository import (
            AssignmentComponentRepository,
        )

        ac_repo = AssignmentComponentRepository(self._repo.db)
        blocked = ac_repo.list_blocking_component_ids(
            ctx, component_ids=[r.id for r in rows]
        )
        enriched = []
        for r in rows:
            availability = "unavailable" if r.id in blocked else "available"
            if r.status != AssetComponentStatus.ACTIVE.value:
                availability = "unavailable"
            enriched.append(
                {
                    "id": r.id,
                    "branch_id": r.branch_id,
                    "asset_id": r.asset_id,
                    "component_code": r.component_code,
                    "component_name": r.component_name,
                    "component_type": getattr(r, "component_type", "OTHER"),
                    "product_id": r.product_id,
                    "serial_number": r.serial_number,
                    "quantity": r.quantity,
                    "status": r.status,
                    "company_id": r.company_id,
                    "version": int(r.version or 1),
                    "availability": availability,
                }
            )
        return enriched, total

    def list_for_assets(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        asset_ids: list[UUID],
        status: str | None = "active",
    ) -> list[AstAssetComponent]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_by_asset_ids(
            ctx, company_id=cid, asset_ids=asset_ids, status=status
        )

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstAssetComponent:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Component not found")
        return row

    def tree(self, ctx: TenantContext, asset_id: UUID, company_id: UUID | None = None) -> dict:
        cid = self._scope.resolve_company_id(ctx, company_id)
        asset = self._repo.get_parent_asset(ctx, asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        if asset.company_id != cid:
            raise NotFoundException("Asset not found")
        children = self._repo.list_by_asset(ctx, asset_id, include_inactive=True)
        return {
            "asset": {
                "id": str(asset.id),
                "asset_code": asset.asset_code,
                "asset_name": asset.asset_name,
                "status": asset.status,
                "company_id": str(asset.company_id),
            },
            "components": [
                {
                    "id": str(c.id),
                    "component_code": c.component_code,
                    "component_name": c.component_name,
                    "component_type": getattr(c, "component_type", "OTHER"),
                    "serial_number": c.serial_number,
                    "quantity": str(c.quantity) if c.quantity is not None else None,
                    "status": c.status,
                    "product_id": str(c.product_id) if c.product_id else None,
                    "version": int(c.version or 1),
                }
                for c in children
            ],
            "depth": 1,
        }

    def history(self, ctx: TenantContext, row_id: UUID) -> dict:
        row = self.get(ctx, row_id)
        lineage = self._repo.list_code_history(
            ctx, asset_id=row.asset_id, component_code=row.component_code
        )
        return {
            "component_id": str(row.id),
            "asset_id": str(row.asset_id),
            "component_code": row.component_code,
            "current_status": row.status,
            "lineage": [
                {
                    "id": str(c.id),
                    "status": c.status,
                    "component_name": c.component_name,
                    "serial_number": c.serial_number,
                    "created_at": c.created_at.isoformat() if c.created_at else None,
                    "updated_at": c.updated_at.isoformat() if c.updated_at else None,
                    "version": int(c.version or 1),
                }
                for c in lineage
            ],
        }

    def install(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        branch_id = fields.get("branch_id")
        if branch_id is not None:
            self._scope.validate_branch_access(ctx, branch_id)

        fields.pop("status", None)
        self._validator.validate_install_fields(ctx, company_id=cid, fields=fields)

        row = self._repo.create(
            ctx,
            company_id=cid,
            branch_id=fields.get("branch_id"),
            asset_id=fields["asset_id"],
            component_code=fields["component_code"],
            component_name=fields["component_name"],
            component_type=fields.get("component_type", "OTHER"),
            product_id=fields.get("product_id"),
            serial_number=fields.get("serial_number"),
            quantity=fields.get("quantity"),
            status=AssetComponentStatus.ACTIVE.value,
        )
        self._engine.install_defaults(row)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_COMPONENT,
            entity_id=row.id,
            operation="install",
            performed_by=ctx.user_id,
            new_value={
                "asset_id": str(row.asset_id),
                "component_code": row.component_code,
                "status": row.status,
            },
        )
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        return self.install(ctx, company_id=company_id, **fields)

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        row = self.get(ctx, row_id)
        branch_id = fields.get("branch_id")
        if branch_id is not None:
            self._scope.validate_branch_access(ctx, branch_id)
        self._validator.validate_update_fields(ctx, row, fields)
        allowed = {
            k: v
            for k, v in fields.items()
            if k
            in {
                "branch_id",
                "component_name",
                "component_type",
                "product_id",
                "serial_number",
                "quantity",
                "version",
            }
        }
        updated = self._repo.update(ctx, row_id, **allowed)
        if updated is None:
            raise NotFoundException("Component not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_COMPONENT,
            entity_id=row_id,
            operation="update",
            performed_by=ctx.user_id,
        )
        return updated

    def replace(self, ctx: TenantContext, row_id: UUID, **successor_fields):
        row = self.get(ctx, row_id)
        self._validator.validate_replace_readiness(ctx, row)
        fields = dict(successor_fields)
        fields.pop("status", None)
        fields.pop("asset_id", None)
        self._validator.validate_successor_fields(
            ctx, company_id=row.company_id, source=row, fields=fields
        )

        claimed = self._repo.update(ctx, row_id, version=int(row.version or 1))
        if claimed is None:
            raise NotFoundException("Component not found")
        self._engine.replace(claimed)
        replaced = self._repo.update(
            ctx,
            row_id,
            status=claimed.status,
            version=int(claimed.version or 1),
        )
        successor = self._repo.create(
            ctx,
            company_id=row.company_id,
            branch_id=fields.get("branch_id", row.branch_id),
            asset_id=row.asset_id,
            component_code=fields["component_code"],
            component_name=fields["component_name"],
            component_type=fields.get(
                "component_type", getattr(row, "component_type", "OTHER")
            ),
            product_id=fields.get("product_id"),
            serial_number=fields.get("serial_number"),
            quantity=fields.get("quantity"),
            status=AssetComponentStatus.ACTIVE.value,
        )
        self._engine.install_defaults(successor)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_COMPONENT,
            entity_id=row_id,
            operation="replace",
            performed_by=ctx.user_id,
            new_value={
                "replaced_component_id": str(row_id),
                "successor_id": str(successor.id),
                "component_code": successor.component_code,
            },
        )
        return {"replaced": replaced, "successor": successor}

    def dispose(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._validator.validate_dispose_readiness(ctx, row)
        claimed = self._repo.update(ctx, row_id, version=int(row.version or 1))
        if claimed is None:
            raise NotFoundException("Component not found")
        self._engine.dispose(claimed)
        updated = self._repo.update(
            ctx,
            row_id,
            status=claimed.status,
            version=int(claimed.version or 1),
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_COMPONENT,
            entity_id=row_id,
            operation="dispose",
            performed_by=ctx.user_id,
        )
        return updated


# Backward-compatible alias
ComponentService = AssetComponentService
