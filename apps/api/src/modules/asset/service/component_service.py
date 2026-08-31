"""AssetComponentService — lightweight + asset-linked child components (FP-ASSET-019).

Option B: component rows under a parent asset. Optional ``component_asset_id``
links a real ``ast_asset`` (ops ``IN_USE_AS_COMPONENT`` while attached).
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.asset.domain.enums import (
    AssetComponentStatus,
    AssetOperationalStatus,
)
from modules.asset.models import AstAssetComponent
from modules.asset.repository.asset_component_repository import (
    AssetComponentListFilters,
    AssetComponentRepository,
)
from modules.asset.repository.asset_repository import AssetRepository
from modules.asset.repository.asset_type_repository import AssetTypeRepository
from modules.asset.service.asset_operational_status_service import AssetOperationalStatusService
from modules.asset.service.asset_scope_validator import AssetScopeValidator
from modules.asset.service.component_code_service import ComponentCodeService
from modules.asset.service.component_validator import ComponentValidator
from modules.asset.service.engines import AssetComponentEngine
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService

ENTITY_AST_COMPONENT = "ast_asset_component"
_READY = AssetOperationalStatus.READY_TO_MOVE.value


class AssetComponentService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = AssetComponentRepository(db)
        self._assets = AssetRepository(db)
        self._types = AssetTypeRepository(db)
        self._scope = AssetScopeValidator(db)
        self._engine = AssetComponentEngine()
        self._audit = AuditService(db)
        self._validator = ComponentValidator(db)
        self._codes = ComponentCodeService(db)
        self._operational = AssetOperationalStatusService(db)

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
                rows = [r for r in rows if getattr(r, "component_type", None) == component_type]
        if not include_availability:
            return [self._enrich_row(ctx, r) for r in rows], total
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
            payload = self._enrich_row(ctx, r)
            payload["availability"] = availability
            enriched.append(payload)
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

    def get(self, ctx: TenantContext, row_id: UUID) -> dict:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Component not found")
        return self._enrich_row(ctx, row)

    def get_model(self, ctx: TenantContext, row_id: UUID) -> AstAssetComponent:
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
            "components": [self._enrich_row(ctx, c) for c in children],
            "depth": 1,
        }

    def history(self, ctx: TenantContext, row_id: UUID) -> dict:
        row = self.get_model(ctx, row_id)
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
                    "component_asset_id": (
                        str(c.component_asset_id) if c.component_asset_id else None
                    ),
                }
                for c in lineage
            ],
        }

    def list_attachable_assets(
        self,
        ctx: TenantContext,
        *,
        parent_asset_id: UUID,
        company_id: UUID | None = None,
        search: str | None = None,
        limit: int = 50,
    ) -> list[dict]:
        """READY_TO_MOVE assets whose type has eligible_as_component=true."""
        cid = self._scope.resolve_company_id(ctx, company_id)
        parent = self._assets.get(ctx, parent_asset_id)
        if parent is None or parent.company_id != cid:
            raise NotFoundException("Parent asset not found")

        eligible_type_ids = {
            t.id
            for t in self._types.list_rows(ctx, cid, active=True)
            if bool(getattr(t, "eligible_as_component", True))
        }
        if not eligible_type_ids:
            return []

        from sqlalchemy import or_, select
        from modules.asset.models import AstAsset

        stmt = select(AstAsset).where(
            AstAsset.company_id == cid,
            AstAsset.is_deleted.is_(False),
            AstAsset.id != parent_asset_id,
            AstAsset.operational_status == _READY,
            AstAsset.asset_type_id.in_(eligible_type_ids),
        )
        if search and search.strip():
            term = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    AstAsset.asset_code.ilike(term),
                    AstAsset.asset_name.ilike(term),
                    AstAsset.serial_number.ilike(term),
                )
            )
        stmt = self._assets.apply_ast_filter(stmt, AstAsset, ctx, branch_scoped=False)
        rows = list(self._db.scalars(stmt.order_by(AstAsset.asset_code.asc()).limit(limit)).all())

        out: list[dict] = []
        for row in rows:
            if self._repo.find_active_by_component_asset(ctx, component_asset_id=row.id):
                continue
            if self._repo.list_active_linked_for_parent(ctx, asset_id=row.id):
                continue
            out.append(
                {
                    "id": str(row.id),
                    "asset_code": row.asset_code,
                    "asset_name": row.asset_name,
                    "serial_number": row.serial_number,
                    "operational_status": row.operational_status,
                    "asset_type_id": str(row.asset_type_id) if row.asset_type_id else None,
                }
            )
        return out

    def install(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        branch_id = fields.get("branch_id")
        if branch_id is not None:
            self._scope.validate_branch_access(ctx, branch_id)

        fields.pop("status", None)
        self._validator.validate_install_fields(ctx, company_id=cid, fields=fields)

        component_type = fields.get("component_type", "OTHER")
        if not fields.get("component_code"):
            fields["component_code"] = self._codes.next_code(
                ctx, asset_id=fields["asset_id"], component_type=component_type
            )

        child_id = fields.get("component_asset_id")
        if not fields.get("component_name"):
            if child_id is not None:
                child = self._assets.get(ctx, child_id)
                fields["component_name"] = (
                    (child.asset_name if child else None)
                    or (child.asset_code if child else None)
                    or self._validator.type_label(component_type)
                )
            else:
                fields["component_name"] = self._validator.type_label(component_type)

        row = self._repo.create(
            ctx,
            company_id=cid,
            branch_id=fields.get("branch_id"),
            asset_id=fields["asset_id"],
            component_asset_id=child_id,
            component_code=fields["component_code"],
            component_name=fields["component_name"],
            component_type=component_type,
            product_id=fields.get("product_id"),
            serial_number=fields.get("serial_number"),
            quantity=fields.get("quantity"),
            status=AssetComponentStatus.ACTIVE.value,
        )
        self._engine.install_defaults(row)

        if child_id is not None:
            child = self._assets.lock_for_update(ctx, child_id)
            if child is None:
                raise NotFoundException("Component asset not found")
            self._operational.apply_action(
                ctx,
                child_id,
                action="attach_as_component",
                expected_version=int(child.version or 1),
                reason="component_attach",
                source_entity=ENTITY_AST_COMPONENT,
                source_entity_id=row.id,
            )

        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_COMPONENT,
            entity_id=row.id,
            operation="install",
            performed_by=ctx.user_id,
            new_value={
                "asset_id": str(row.asset_id),
                "component_code": row.component_code,
                "component_asset_id": str(child_id) if child_id else None,
                "status": row.status,
            },
        )
        return self._enrich_row(ctx, row)

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        return self.install(ctx, company_id=company_id, **fields)

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        row = self.get_model(ctx, row_id)
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
        return self._enrich_row(ctx, updated)

    def replace(self, ctx: TenantContext, row_id: UUID, **successor_fields):
        row = self.get_model(ctx, row_id)
        self._validator.validate_replace_readiness(ctx, row)
        fields = dict(successor_fields)
        fields.pop("status", None)
        fields.pop("asset_id", None)
        fields.pop("component_asset_id", None)
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
            component_asset_id=None,
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
        return {
            "replaced": self._enrich_row(ctx, replaced),
            "successor": self._enrich_row(ctx, successor),
        }

    def dispose(self, ctx: TenantContext, row_id: UUID):
        row = self.get_model(ctx, row_id)
        self._validator.validate_dispose_readiness(ctx, row)
        child_id = getattr(row, "component_asset_id", None)

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

        # Cascade: ops-only DISPOSED for linked child — no finance/disposal workflow.
        if child_id is not None:
            child = self._assets.lock_for_update(ctx, child_id)
            if child is not None:
                self._operational.apply_action(
                    ctx,
                    child_id,
                    action="complete_disposal",
                    expected_version=int(child.version or 1),
                    reason="component_cascade_dispose",
                    source_entity=ENTITY_AST_COMPONENT,
                    source_entity_id=row_id,
                )

        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_COMPONENT,
            entity_id=row_id,
            operation="dispose",
            performed_by=ctx.user_id,
            new_value={
                "cascaded_child_asset_id": str(child_id) if child_id else None,
            },
        )
        return self._enrich_row(ctx, updated)

    def detach_linked_for_parent(
        self,
        ctx: TenantContext,
        parent_asset_id: UUID,
        *,
        reason: str = "parent_assignment_return",
        source_entity: str | None = None,
        source_entity_id: UUID | None = None,
    ) -> list[dict]:
        """On parent return: mark linked rows replaced and child ops → READY_TO_MOVE.

        Detach decision: component row status → ``replaced`` (preserves code-history
        lineage; clears active partial-unique slot; not soft-deleted).
        """
        linked = self._repo.list_active_linked_for_parent(ctx, asset_id=parent_asset_id)
        detached: list[dict] = []
        for row in linked:
            child_id = row.component_asset_id
            updated = self._repo.update(
                ctx,
                row.id,
                status=AssetComponentStatus.REPLACED.value,
                version=int(row.version or 1),
            )
            if updated is None:
                continue
            if child_id is not None:
                child = self._assets.lock_for_update(ctx, child_id)
                if child is not None:
                    self._operational.apply_action(
                        ctx,
                        child_id,
                        action="detach_as_component",
                        expected_version=int(child.version or 1),
                        reason=reason,
                        source_entity=source_entity,
                        source_entity_id=source_entity_id,
                    )
            self._audit.log_entity_change(
                tenant_id=ctx.tenant_id,
                entity_name=ENTITY_AST_COMPONENT,
                entity_id=row.id,
                operation="detach",
                performed_by=ctx.user_id,
                new_value={
                    "component_asset_id": str(child_id) if child_id else None,
                    "status": AssetComponentStatus.REPLACED.value,
                },
            )
            detached.append(self._enrich_row(ctx, updated))
        return detached

    def _enrich_row(self, ctx: TenantContext, row: AstAssetComponent | None) -> dict:
        if row is None:
            raise NotFoundException("Component not found")
        payload = {
            "id": row.id,
            "branch_id": row.branch_id,
            "asset_id": row.asset_id,
            "component_asset_id": getattr(row, "component_asset_id", None),
            "component_code": row.component_code,
            "component_name": row.component_name,
            "component_type": getattr(row, "component_type", "OTHER"),
            "product_id": row.product_id,
            "serial_number": row.serial_number,
            "quantity": row.quantity,
            "status": row.status,
            "company_id": row.company_id,
            "version": int(row.version or 1),
            "linked_asset_code": None,
            "linked_asset_name": None,
            "linked_asset_operational_status": None,
        }
        child_id = getattr(row, "component_asset_id", None)
        if child_id is not None:
            child = self._assets.get(ctx, child_id)
            if child is not None:
                payload["linked_asset_code"] = child.asset_code
                payload["linked_asset_name"] = child.asset_name
                payload["linked_asset_operational_status"] = child.operational_status
        return payload


# Backward-compatible alias
ComponentService = AssetComponentService
