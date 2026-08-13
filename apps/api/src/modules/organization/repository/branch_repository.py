"""Branch repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.organization.domain.entities import BranchEntity
from modules.organization.models.branch import OrgBranch
from modules.organization.repository.base import OrgScopedRepository, utcnow


class BranchRepository(OrgScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def list_branches(
        self, ctx: TenantContext, *, company_id: UUID | None = None
    ) -> list[BranchEntity]:
        stmt = select(OrgBranch).where(
            OrgBranch.tenant_id == ctx.tenant_id,
            OrgBranch.is_deleted.is_(False),
        )
        if company_id:
            stmt = stmt.where(OrgBranch.company_id == company_id)
        elif ctx.company_id:
            stmt = stmt.where(OrgBranch.company_id == ctx.company_id)
        if ctx.branch_id and ctx.user_type not in {"super_admin", "tenant_admin", "company_admin"}:
            stmt = stmt.where(OrgBranch.id == ctx.branch_id)
        return [self._to_entity(r) for r in self.db.scalars(stmt).all()]

    def get_by_id(self, ctx: TenantContext, branch_id: UUID) -> BranchEntity | None:
        stmt = select(OrgBranch).where(
            OrgBranch.id == branch_id,
            OrgBranch.tenant_id == ctx.tenant_id,
            OrgBranch.is_deleted.is_(False),
        )
        row = self.db.scalar(stmt)
        return self._to_entity(row) if row else None

    def create(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        branch_code: str,
        branch_name: str,
        branch_type: str = "regional",
        address_line1: str | None = None,
        city: str | None = None,
        state_code: str | None = None,
        country_code: str | None = None,
        head_employee_id: UUID | None = None,
    ) -> BranchEntity:
        row = OrgBranch(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=company_id,
            branch_code=branch_code,
            branch_name=branch_name,
            branch_type=branch_type,
            address_line1=address_line1,
            city=city,
            state_code=state_code,
            country_code=country_code,
            head_employee_id=head_employee_id,
            status="active",
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
        )
        self.db.add(row)
        self.db.flush()
        return self._to_entity(row)

    def update(self, ctx: TenantContext, branch_id: UUID, **fields: object) -> BranchEntity | None:
        stmt = select(OrgBranch).where(
            OrgBranch.id == branch_id,
            OrgBranch.tenant_id == ctx.tenant_id,
            OrgBranch.is_deleted.is_(False),
        )
        row = self.db.scalar(stmt)
        if row is None:
            return None
        for key, value in fields.items():
            if hasattr(row, key) and value is not None:
                setattr(row, key, value)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        row.version += 1
        self.db.flush()
        return self._to_entity(row)

    def soft_delete(self, ctx: TenantContext, branch_id: UUID) -> bool:
        stmt = select(OrgBranch).where(
            OrgBranch.id == branch_id, OrgBranch.tenant_id == ctx.tenant_id
        )
        row = self.db.scalar(stmt)
        if row is None or row.is_deleted:
            return False
        row.is_deleted = True
        row.deleted_at = utcnow()
        row.deleted_by = ctx.user_id
        self.db.flush()
        return True

    @staticmethod
    def _to_entity(row: OrgBranch) -> BranchEntity:
        return BranchEntity(
            id=row.id,
            tenant_id=row.tenant_id,
            company_id=row.company_id,
            branch_code=row.branch_code,
            branch_name=row.branch_name,
            branch_type=row.branch_type,
            status=row.status,
            version=row.version,
            is_deleted=row.is_deleted,
        )
