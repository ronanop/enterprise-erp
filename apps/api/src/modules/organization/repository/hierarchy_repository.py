"""Department, BU, location, cost/profit center repositories."""

from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.organization.domain.entities import (
    BusinessUnitEntity,
    CostCenterEntity,
    DepartmentEntity,
    LocationEntity,
    ProfitCenterEntity,
)
from modules.organization.models.branch import OrgBranch
from modules.organization.models.hierarchy import (
    OrgBusinessUnit,
    OrgCostCenter,
    OrgDepartment,
    OrgLocation,
    OrgProfitCenter,
)
from modules.organization.repository.base import OrgScopedRepository, utcnow


class DepartmentRepository(OrgScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def list_departments(
        self, ctx: TenantContext, *, company_id: UUID | None = None, branch_id: UUID | None = None
    ) -> list[DepartmentEntity]:
        stmt = select(OrgDepartment).where(
            OrgDepartment.tenant_id == ctx.tenant_id,
            OrgDepartment.is_deleted.is_(False),
        )
        if company_id:
            stmt = stmt.where(OrgDepartment.company_id == company_id)
        if branch_id:
            stmt = stmt.where(OrgDepartment.branch_id == branch_id)
        return [self._to_entity(r) for r in self.db.scalars(stmt).all()]

    def get_by_id(self, ctx: TenantContext, department_id: UUID) -> DepartmentEntity | None:
        stmt = select(OrgDepartment).where(
            OrgDepartment.id == department_id,
            OrgDepartment.tenant_id == ctx.tenant_id,
            OrgDepartment.is_deleted.is_(False),
        )
        row = self.db.scalar(stmt)
        return self._to_entity(row) if row else None

    def create(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        branch_id: UUID,
        department_code: str,
        department_name: str,
        parent_department_id: UUID | None = None,
        head_employee_id: UUID | None = None,
    ) -> DepartmentEntity:
        now = utcnow()
        row = OrgDepartment(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=company_id,
            branch_id=branch_id,
            department_code=department_code,
            department_name=department_name,
            parent_department_id=parent_department_id,
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

    def update(
        self, ctx: TenantContext, department_id: UUID, **fields: object
    ) -> DepartmentEntity | None:
        stmt = select(OrgDepartment).where(
            OrgDepartment.id == department_id,
            OrgDepartment.tenant_id == ctx.tenant_id,
            OrgDepartment.is_deleted.is_(False),
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

    def soft_delete(self, ctx: TenantContext, department_id: UUID) -> bool:
        stmt = select(OrgDepartment).where(
            OrgDepartment.id == department_id, OrgDepartment.tenant_id == ctx.tenant_id
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
    def _to_entity(row: OrgDepartment) -> DepartmentEntity:
        return DepartmentEntity(
            id=row.id,
            tenant_id=row.tenant_id,
            company_id=row.company_id,
            branch_id=row.branch_id,
            department_code=row.department_code,
            department_name=row.department_name,
            status=row.status,
            parent_department_id=row.parent_department_id,
            head_employee_id=row.head_employee_id,
            version=row.version,
            created_at=row.created_at,
            created_by=row.created_by,
            updated_at=row.updated_at,
            updated_by=row.updated_by,
        )


class BusinessUnitRepository(OrgScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def list_units(self, ctx: TenantContext, *, branch_id: UUID | None = None):
        stmt = select(OrgBusinessUnit).where(
            OrgBusinessUnit.tenant_id == ctx.tenant_id,
            OrgBusinessUnit.is_deleted.is_(False),
        )
        if branch_id:
            stmt = stmt.where(OrgBusinessUnit.branch_id == branch_id)
        return [
            BusinessUnitEntity(
                id=r.id,
                tenant_id=r.tenant_id,
                company_id=r.company_id,
                branch_id=r.branch_id,
                business_unit_code=r.business_unit_code,
                business_unit_name=r.business_unit_name,
                status=r.status,
                description=r.description,
                version=r.version,
            )
            for r in self.db.scalars(stmt).all()
        ]

    def create(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        branch_id: UUID,
        business_unit_code: str,
        business_unit_name: str,
        description: str | None = None,
    ) -> BusinessUnitEntity:
        row = OrgBusinessUnit(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=company_id,
            branch_id=branch_id,
            business_unit_code=business_unit_code,
            business_unit_name=business_unit_name,
            description=description,
            status="draft",
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
        )
        self.db.add(row)
        self.db.flush()
        return BusinessUnitEntity(
            id=row.id,
            tenant_id=row.tenant_id,
            company_id=row.company_id,
            branch_id=row.branch_id,
            business_unit_code=row.business_unit_code,
            business_unit_name=row.business_unit_name,
            status=row.status,
            description=row.description,
            version=row.version,
        )


class LocationRepository(OrgScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def list_locations(
        self, ctx: TenantContext, *, branch_id: UUID | None = None, company_id: UUID | None = None
    ):
        stmt = (
            select(OrgLocation, OrgBranch.branch_name)
            .outerjoin(OrgBranch, OrgBranch.id == OrgLocation.branch_id)
            .where(
                OrgLocation.tenant_id == ctx.tenant_id,
                OrgLocation.is_deleted.is_(False),
            )
        )
        if branch_id:
            stmt = stmt.where(OrgLocation.branch_id == branch_id)
        elif company_id:
            stmt = stmt.where(OrgLocation.company_id == company_id)
        elif ctx.company_id:
            stmt = stmt.where(OrgLocation.company_id == ctx.company_id)
        return [
            LocationEntity(
                id=r.id,
                tenant_id=r.tenant_id,
                company_id=r.company_id,
                branch_id=r.branch_id,
                location_code=r.location_code,
                location_name=r.location_name,
                location_type=r.location_type,
                status=r.status,
                version=r.version,
                branch_name=branch_name,
                latitude=float(r.latitude) if r.latitude is not None else None,
                longitude=float(r.longitude) if r.longitude is not None else None,
                geofence_radius_meters=r.geofence_radius_meters,
            )
            for r, branch_name in self.db.execute(stmt).all()
        ]

    def create(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        branch_id: UUID,
        location_code: str,
        location_name: str,
        location_type: str = "office",
        latitude: float | None = None,
        longitude: float | None = None,
        geofence_radius_meters: int | None = None,
    ) -> LocationEntity:
        row = OrgLocation(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=company_id,
            branch_id=branch_id,
            location_code=location_code,
            location_name=location_name,
            location_type=location_type,
            latitude=latitude,
            longitude=longitude,
            geofence_radius_meters=geofence_radius_meters,
            status="draft",
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
        )
        self.db.add(row)
        self.db.flush()
        return LocationEntity(
            id=row.id,
            tenant_id=row.tenant_id,
            company_id=row.company_id,
            branch_id=row.branch_id,
            location_code=row.location_code,
            location_name=row.location_name,
            location_type=row.location_type,
            status=row.status,
            version=row.version,
            latitude=float(row.latitude) if row.latitude is not None else None,
            longitude=float(row.longitude) if row.longitude is not None else None,
            geofence_radius_meters=row.geofence_radius_meters,
        )

    def update(self, ctx: TenantContext, location_id: UUID, **fields) -> LocationEntity | None:
        row = self.db.scalar(
            select(OrgLocation).where(
                OrgLocation.id == location_id,
                OrgLocation.tenant_id == ctx.tenant_id,
                OrgLocation.is_deleted.is_(False),
            )
        )
        if row is None:
            return None
        for k, v in fields.items():
            if v is not None:
                setattr(row, k, v)
        row.updated_by = ctx.user_id
        row.version = int(row.version or 1) + 1
        self.db.flush()
        return LocationEntity(
            id=row.id,
            tenant_id=row.tenant_id,
            company_id=row.company_id,
            branch_id=row.branch_id,
            location_code=row.location_code,
            location_name=row.location_name,
            location_type=row.location_type,
            status=row.status,
            version=row.version,
            latitude=float(row.latitude) if row.latitude is not None else None,
            longitude=float(row.longitude) if row.longitude is not None else None,
            geofence_radius_meters=row.geofence_radius_meters,
        )


class CostCenterRepository(OrgScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def list_cost_centers(self, ctx: TenantContext, *, company_id: UUID | None = None):
        stmt = select(OrgCostCenter).where(
            OrgCostCenter.tenant_id == ctx.tenant_id,
            OrgCostCenter.is_deleted.is_(False),
        )
        if company_id:
            stmt = stmt.where(OrgCostCenter.company_id == company_id)
        return [self._to_entity(r) for r in self.db.scalars(stmt).all()]

    def create(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        cost_center_code: str,
        cost_center_name: str,
        valid_from: date,
        branch_id: UUID | None = None,
        department_id: UUID | None = None,
    ) -> CostCenterEntity:
        row = OrgCostCenter(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=company_id,
            branch_id=branch_id,
            department_id=department_id,
            cost_center_code=cost_center_code,
            cost_center_name=cost_center_name,
            valid_from=valid_from,
            status="draft",
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
        )
        self.db.add(row)
        self.db.flush()
        return self._to_entity(row)

    @staticmethod
    def _to_entity(row: OrgCostCenter) -> CostCenterEntity:
        return CostCenterEntity(
            id=row.id,
            tenant_id=row.tenant_id,
            company_id=row.company_id,
            cost_center_code=row.cost_center_code,
            cost_center_name=row.cost_center_name,
            valid_from=row.valid_from,
            status=row.status,
            branch_id=row.branch_id,
            department_id=row.department_id,
            valid_to=row.valid_to,
            version=row.version,
        )


class ProfitCenterRepository(OrgScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def list_profit_centers(self, ctx: TenantContext, *, company_id: UUID | None = None):
        stmt = select(OrgProfitCenter).where(
            OrgProfitCenter.tenant_id == ctx.tenant_id,
            OrgProfitCenter.is_deleted.is_(False),
        )
        if company_id:
            stmt = stmt.where(OrgProfitCenter.company_id == company_id)
        return [self._to_entity(r) for r in self.db.scalars(stmt).all()]

    def create(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        profit_center_code: str,
        profit_center_name: str,
        valid_from: date,
        branch_id: UUID | None = None,
        department_id: UUID | None = None,
    ) -> ProfitCenterEntity:
        row = OrgProfitCenter(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=company_id,
            branch_id=branch_id,
            department_id=department_id,
            profit_center_code=profit_center_code,
            profit_center_name=profit_center_name,
            valid_from=valid_from,
            status="draft",
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
        )
        self.db.add(row)
        self.db.flush()
        return self._to_entity(row)

    @staticmethod
    def _to_entity(row: OrgProfitCenter) -> ProfitCenterEntity:
        return ProfitCenterEntity(
            id=row.id,
            tenant_id=row.tenant_id,
            company_id=row.company_id,
            profit_center_code=row.profit_center_code,
            profit_center_name=row.profit_center_name,
            valid_from=row.valid_from,
            status=row.status,
            branch_id=row.branch_id,
            department_id=row.department_id,
            valid_to=row.valid_to,
            version=row.version,
        )
