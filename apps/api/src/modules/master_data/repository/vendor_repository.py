"""Vendor repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.master_data.domain.entities import VendorEntity
from modules.master_data.models.party import MasterVendor
from modules.master_data.repository.base import MasterScopedRepository, utcnow


class VendorRepository(MasterScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def list_vendors(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        branch_id: UUID | None = None,
        branch_scoped: bool = True,
    ) -> list[VendorEntity]:
        stmt = select(MasterVendor)
        stmt = self.apply_master_filter(stmt, MasterVendor, ctx, branch_scoped=branch_scoped)
        if company_id:
            stmt = stmt.where(MasterVendor.company_id == company_id)
        if branch_id:
            stmt = stmt.where(MasterVendor.branch_id == branch_id)
        return [self._to_entity(r) for r in self.db.scalars(stmt).all()]

    def get_by_id(self, ctx: TenantContext, vendor_id: UUID) -> VendorEntity | None:
        stmt = select(MasterVendor).where(
            MasterVendor.id == vendor_id,
            MasterVendor.tenant_id == ctx.tenant_id,
            MasterVendor.is_deleted.is_(False),
        )
        row = self.db.scalar(stmt)
        return self._to_entity(row) if row else None

    def get_by_code(
        self, ctx: TenantContext, company_id: UUID, vendor_code: str
    ) -> MasterVendor | None:
        stmt = select(MasterVendor).where(
            MasterVendor.tenant_id == ctx.tenant_id,
            MasterVendor.company_id == company_id,
            MasterVendor.vendor_code == vendor_code,
            MasterVendor.is_deleted.is_(False),
        )
        return self.db.scalar(stmt)

    def create(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        branch_id: UUID,
        vendor_code: str,
        vendor_name: str,
        vendor_type: str,
        tax_number: str | None = None,
        email: str | None = None,
        mobile: str | None = None,
        payment_terms: str | None = None,
        address_json: dict | None = None,
    ) -> VendorEntity:
        row = MasterVendor(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=company_id,
            branch_id=branch_id,
            vendor_code=vendor_code,
            vendor_name=vendor_name,
            vendor_type=vendor_type,
            tax_number=tax_number,
            email=email,
            mobile=mobile,
            payment_terms=payment_terms,
            address_json=address_json,
            status="draft",
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
        )
        self.db.add(row)
        self.db.flush()
        return self._to_entity(row)

    def update(self, ctx: TenantContext, vendor_id: UUID, **fields: object) -> VendorEntity | None:
        stmt = select(MasterVendor).where(
            MasterVendor.id == vendor_id,
            MasterVendor.tenant_id == ctx.tenant_id,
            MasterVendor.is_deleted.is_(False),
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

    def soft_delete(self, ctx: TenantContext, vendor_id: UUID) -> bool:
        stmt = select(MasterVendor).where(
            MasterVendor.id == vendor_id,
            MasterVendor.tenant_id == ctx.tenant_id,
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
    def _to_entity(row: MasterVendor) -> VendorEntity:
        return VendorEntity(
            id=row.id,
            tenant_id=row.tenant_id,
            company_id=row.company_id,
            branch_id=row.branch_id,
            vendor_code=row.vendor_code,
            vendor_name=row.vendor_name,
            vendor_type=row.vendor_type,
            tax_number=row.tax_number,
            email=row.email,
            mobile=row.mobile,
            payment_terms=row.payment_terms,
            address_json=row.address_json,
            status=row.status,
            version=row.version,
            is_deleted=row.is_deleted,
        )
