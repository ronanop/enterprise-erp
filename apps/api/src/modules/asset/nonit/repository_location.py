"""Non-IT location repository."""

from uuid import UUID, uuid4

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from modules.asset.models import AstNonitLocation
from modules.asset.repository.base import AstScopedRepository, utcnow
from modules.foundation.domain.value_objects import TenantContext


class NonItLocationRepository(AstScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstNonitLocation | None:
        stmt = select(AstNonitLocation).where(
            AstNonitLocation.id == row_id,
            AstNonitLocation.is_deleted.is_(False),
        )
        stmt = self.apply_ast_filter(stmt, AstNonitLocation, ctx, branch_scoped=False)
        return self.db.scalar(stmt)

    def list_rows(
        self,
        ctx: TenantContext,
        company_id: UUID,
        *,
        active: bool | None = None,
        search: str | None = None,
        location_kind: str | None = None,
    ) -> list[AstNonitLocation]:
        stmt = select(AstNonitLocation).where(
            AstNonitLocation.company_id == company_id,
            AstNonitLocation.is_deleted.is_(False),
        )
        if active is not None:
            stmt = stmt.where(AstNonitLocation.active.is_(active))
        if location_kind:
            stmt = stmt.where(AstNonitLocation.location_kind == location_kind)
        if search and search.strip():
            term = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    AstNonitLocation.name.ilike(term),
                    AstNonitLocation.code.ilike(term),
                    AstNonitLocation.building.ilike(term),
                    AstNonitLocation.floor.ilike(term),
                )
            )
        stmt = self.apply_ast_filter(stmt, AstNonitLocation, ctx, branch_scoped=False)
        return list(
            self.db.scalars(
                stmt.order_by(AstNonitLocation.location_kind.asc(), AstNonitLocation.name.asc())
            ).all()
        )

    def create(self, ctx: TenantContext, **fields) -> AstNonitLocation:
        row = AstNonitLocation(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> AstNonitLocation | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        expected = fields.pop("version", None)
        if expected is not None and int(row.version or 1) != int(expected):
            return None
        for key, value in fields.items():
            setattr(row, key, value)
        row.updated_by = ctx.user_id
        row.updated_at = utcnow()
        row.version = int(row.version or 1) + 1
        self.db.flush()
        return row
