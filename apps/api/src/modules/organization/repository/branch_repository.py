"""Branch repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.org_data_scope import (
    effective_company_ids,
    has_module_wide_data_access,
)
from modules.foundation.domain.value_objects import TenantContext
from modules.organization.domain.entities import BranchEntity
from modules.organization.models.branch import OrgBranch
from modules.organization.repository.base import OrgScopedRepository, utcnow

ORGANIZATION_MODULE_KEY = "organization"


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
        elif has_module_wide_data_access(ctx, ORGANIZATION_MODULE_KEY):
            pass
        else:
            allowed = effective_company_ids(ctx, module_key=ORGANIZATION_MODULE_KEY)
            if allowed is not None:
                if not allowed:
                    stmt = stmt.where(OrgBranch.id.is_(None))
                elif len(allowed) == 1:
                    stmt = stmt.where(OrgBranch.company_id == allowed[0])
                else:
                    stmt = stmt.where(OrgBranch.company_id.in_(allowed))
        # Branch-scoped users only see their own branch; org/platform admins see all in scope
        if (
            ctx.branch_id
            and ctx.user_type not in {"super_admin", "tenant_admin", "company_admin"}
            and not has_module_wide_data_access(ctx, ORGANIZATION_MODULE_KEY)
        ):
            stmt = stmt.where(OrgBranch.id == ctx.branch_id)
        stmt = stmt.order_by(OrgBranch.branch_name.asc())
        return [self._to_entity(r) for r in self.db.scalars(stmt).all()]

    def get_by_id(self, ctx: TenantContext, branch_id: UUID) -> BranchEntity | None:
        stmt = select(OrgBranch).where(
            OrgBranch.id == branch_id,
            OrgBranch.tenant_id == ctx.tenant_id,
            OrgBranch.is_deleted.is_(False),
        )
        row = self.db.scalar(stmt)
        return self._to_entity(row) if row else None

    def list_branch_codes(
        self, ctx: TenantContext, *, company_id: UUID, include_deleted: bool = True
    ) -> list[str]:
        """Return branch codes for a company (includes soft-deleted so unique keys stay unique)."""
        stmt = select(OrgBranch.branch_code).where(
            OrgBranch.tenant_id == ctx.tenant_id,
            OrgBranch.company_id == company_id,
        )
        if not include_deleted:
            stmt = stmt.where(OrgBranch.is_deleted.is_(False))
        return [str(c) for c in self.db.scalars(stmt).all() if c]

    def code_exists(
        self, ctx: TenantContext, *, company_id: UUID, branch_code: str
    ) -> bool:
        stmt = select(OrgBranch.id).where(
            OrgBranch.tenant_id == ctx.tenant_id,
            OrgBranch.company_id == company_id,
            OrgBranch.branch_code == branch_code,
        )
        return self.db.scalar(stmt) is not None

    def liberate_deleted_branch_codes(self, ctx: TenantContext, *, company_id: UUID) -> int:
        """Rename soft-deleted branch codes so (company_id, branch_code) can be reused."""
        stmt = select(OrgBranch).where(
            OrgBranch.tenant_id == ctx.tenant_id,
            OrgBranch.company_id == company_id,
            OrgBranch.is_deleted.is_(True),
            ~OrgBranch.branch_code.contains("-DEL-"),
        )
        rows = list(self.db.scalars(stmt).all())
        if not rows:
            return 0
        stamp = utcnow().strftime("%Y%m%d%H%M%S")
        for i, row in enumerate(rows):
            freed = f"{row.branch_code}-DEL-{stamp}-{i}"
            row.branch_code = freed[:80]
        self.db.flush()
        return len(rows)

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
        now = utcnow()
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
            created_at=now,
            updated_at=now,
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
            if hasattr(row, key):
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
        # Free unique (company_id, branch_code) so the code can be reused
        stamp = utcnow().strftime("%Y%m%d%H%M%S")
        freed = f"{row.branch_code}-DEL-{stamp}"
        row.branch_code = freed[:80]
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
            address_line1=row.address_line1,
            city=row.city,
            state_code=row.state_code,
            country_code=row.country_code,
            head_employee_id=row.head_employee_id,
            version=row.version,
            is_deleted=row.is_deleted,
            created_at=row.created_at,
            created_by=row.created_by,
            updated_at=row.updated_at,
            updated_by=row.updated_by,
        )
