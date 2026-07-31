"""Asset repository."""

from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.master_data.domain.entities import AssetEntity
from modules.master_data.models.asset import MasterAsset
from modules.master_data.repository.base import MasterScopedRepository, utcnow


class AssetRepository(MasterScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def list_assets(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        branch_id: UUID | None = None,
    ) -> list[AssetEntity]:
        stmt = select(MasterAsset)
        stmt = self.apply_master_filter(stmt, MasterAsset, ctx, branch_scoped=True)
        if company_id:
            stmt = stmt.where(MasterAsset.company_id == company_id)
        if branch_id:
            stmt = stmt.where(MasterAsset.branch_id == branch_id)
        return [self._to_entity(r) for r in self.db.scalars(stmt).all()]

    def get_by_id(self, ctx: TenantContext, asset_id: UUID) -> AssetEntity | None:
        stmt = select(MasterAsset).where(
            MasterAsset.id == asset_id,
            MasterAsset.tenant_id == ctx.tenant_id,
            MasterAsset.is_deleted.is_(False),
        )
        row = self.db.scalar(stmt)
        return self._to_entity(row) if row else None

    def get_by_code(
        self, ctx: TenantContext, company_id: UUID, asset_code: str
    ) -> MasterAsset | None:
        stmt = select(MasterAsset).where(
            MasterAsset.tenant_id == ctx.tenant_id,
            MasterAsset.company_id == company_id,
            MasterAsset.asset_code == asset_code,
            MasterAsset.is_deleted.is_(False),
        )
        return self.db.scalar(stmt)

    def create(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        branch_id: UUID,
        asset_code: str,
        asset_name: str,
        asset_category: str,
        serial_number: str | None = None,
        purchase_date: date | None = None,
        purchase_value: float | None = None,
        location_id: UUID | None = None,
        custodian_employee_id: UUID | None = None,
    ) -> AssetEntity:
        row = MasterAsset(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=company_id,
            branch_id=branch_id,
            asset_code=asset_code,
            asset_name=asset_name,
            asset_category=asset_category,
            serial_number=serial_number,
            purchase_date=purchase_date,
            purchase_value=purchase_value,
            location_id=location_id,
            custodian_employee_id=custodian_employee_id,
            status="draft",
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
        )
        self.db.add(row)
        self.db.flush()
        return self._to_entity(row)

    def update(self, ctx: TenantContext, asset_id: UUID, **fields: object) -> AssetEntity | None:
        stmt = select(MasterAsset).where(
            MasterAsset.id == asset_id,
            MasterAsset.tenant_id == ctx.tenant_id,
            MasterAsset.is_deleted.is_(False),
        )
        row = self.db.scalar(stmt)
        if row is None:
            return None
        for key, value in fields.items():
            if hasattr(row, key) and (value is not None or key == "custodian_employee_id"):
                setattr(row, key, value)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        row.version += 1
        self.db.flush()
        return self._to_entity(row)

    def soft_delete(self, ctx: TenantContext, asset_id: UUID) -> bool:
        stmt = select(MasterAsset).where(
            MasterAsset.id == asset_id,
            MasterAsset.tenant_id == ctx.tenant_id,
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
    def _to_entity(row: MasterAsset) -> AssetEntity:
        return AssetEntity(
            id=row.id,
            tenant_id=row.tenant_id,
            company_id=row.company_id,
            branch_id=row.branch_id,
            asset_code=row.asset_code,
            asset_name=row.asset_name,
            asset_category=row.asset_category,
            serial_number=row.serial_number,
            purchase_date=row.purchase_date,
            purchase_value=float(row.purchase_value) if row.purchase_value is not None else None,
            location_id=row.location_id,
            custodian_employee_id=row.custodian_employee_id,
            status=row.status,
            version=row.version,
            is_deleted=row.is_deleted,
        )
