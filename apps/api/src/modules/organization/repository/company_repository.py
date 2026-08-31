"""Company repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.organization.domain.entities import CompanyEntity
from modules.organization.models.company import OrgCompany
from modules.organization.repository.base import OrgScopedRepository, utcnow


class CompanyRepository(OrgScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def list_companies(self, ctx: TenantContext) -> list[CompanyEntity]:
        stmt = select(OrgCompany)
        stmt = self.apply_tenant_filter(stmt, OrgCompany, ctx)
        if ctx.company_id and ctx.user_type not in {"super_admin", "tenant_admin"}:
            stmt = stmt.where(OrgCompany.id == ctx.company_id)
        return [self._to_entity(r) for r in self.db.scalars(stmt).all()]

    def get_by_id(self, ctx: TenantContext, company_id: UUID) -> CompanyEntity | None:
        stmt = select(OrgCompany).where(
            OrgCompany.id == company_id,
            OrgCompany.tenant_id == ctx.tenant_id,
            OrgCompany.is_deleted.is_(False),
        )
        row = self.db.scalar(stmt)
        return self._to_entity(row) if row else None

    def get_by_code(self, ctx: TenantContext, company_code: str) -> OrgCompany | None:
        stmt = select(OrgCompany).where(
            OrgCompany.tenant_id == ctx.tenant_id,
            OrgCompany.company_code == company_code,
            OrgCompany.is_deleted.is_(False),
        )
        return self.db.scalar(stmt)

    def create(
        self,
        ctx: TenantContext,
        *,
        company_code: str,
        company_name: str,
        legal_name: str,
        country_code: str,
        currency_code: str,
        registration_number: str | None = None,
        tax_number: str | None = None,
        fiscal_year_start_month: int = 4,
        timezone: str = "UTC",
        status: str = "active",
    ) -> CompanyEntity:
        row = OrgCompany(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_code=company_code,
            company_name=company_name,
            legal_name=legal_name,
            country_code=country_code,
            currency_code=currency_code,
            registration_number=registration_number,
            tax_number=tax_number,
            fiscal_year_start_month=fiscal_year_start_month,
            timezone=timezone,
            status=status or "active",
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
        )
        self.db.add(row)
        self.db.flush()
        return self._to_entity(row)

    def update(
        self, ctx: TenantContext, company_id: UUID, **fields: object
    ) -> CompanyEntity | None:
        stmt = select(OrgCompany).where(
            OrgCompany.id == company_id,
            OrgCompany.tenant_id == ctx.tenant_id,
            OrgCompany.is_deleted.is_(False),
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

    def soft_delete(self, ctx: TenantContext, company_id: UUID) -> bool:
        stmt = select(OrgCompany).where(
            OrgCompany.id == company_id,
            OrgCompany.tenant_id == ctx.tenant_id,
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
    def _to_entity(row: OrgCompany) -> CompanyEntity:
        return CompanyEntity(
            id=row.id,
            tenant_id=row.tenant_id,
            company_code=row.company_code,
            company_name=row.company_name,
            legal_name=row.legal_name,
            country_code=row.country_code,
            currency_code=row.currency_code,
            status=row.status,
            fiscal_year_start_month=row.fiscal_year_start_month,
            timezone=row.timezone,
            version=row.version,
            is_deleted=row.is_deleted,
        )
