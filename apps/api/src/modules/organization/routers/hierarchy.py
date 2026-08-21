"""Branch and hierarchy routers."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database.session import get_db
from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from modules.organization.schemas import (
    BranchCreateRequest,
    BranchResponse,
    BranchUpdateRequest,
    BusinessUnitCreateRequest,
    CostCenterCreateRequest,
    DepartmentCreateRequest,
    DepartmentUpdateRequest,
    LocationCreateRequest,
    LocationUpdateRequest,
    ProfitCenterCreateRequest,
)
from modules.organization.service.branch_service import BranchService
from modules.organization.service.hierarchy_service import (
    BusinessUnitService,
    CostCenterService,
    DepartmentService,
    LocationService,
    ProfitCenterService,
)
from shared.schemas import APIResponse

branches_router = APIRouter(prefix="/branches", tags=["Branches"])
departments_router = APIRouter(prefix="/departments", tags=["Departments"])
business_units_router = APIRouter(prefix="/business-units", tags=["Business Units"])
locations_router = APIRouter(prefix="/locations", tags=["Locations"])
cost_centers_router = APIRouter(prefix="/cost-centers", tags=["Cost Centers"])
profit_centers_router = APIRouter(prefix="/profit-centers", tags=["Profit Centers"])


@branches_router.get("", response_model=APIResponse[list[BranchResponse]])
def list_branches(
    ctx: Annotated[TenantContext, Depends(require_permission("organization.branch:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
) -> APIResponse[list[BranchResponse]]:
    branches = BranchService(db).list_branches(ctx, company_id=company_id)
    return APIResponse(
        message="Branches retrieved",
        data=[BranchResponse(**b.__dict__) for b in branches],
    )


@branches_router.post("", response_model=APIResponse[BranchResponse])
def create_branch(
    body: BranchCreateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("organization.branch:create"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[BranchResponse]:
    branch = BranchService(db).create_branch(ctx, **body.model_dump())
    db.commit()
    return APIResponse(message="Branch created", data=BranchResponse(**branch.__dict__))


@branches_router.get("/{branch_id}", response_model=APIResponse[BranchResponse])
def get_branch(
    branch_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("organization.branch:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[BranchResponse]:
    branch = BranchService(db).get_branch(ctx, branch_id)
    return APIResponse(message="Branch retrieved", data=BranchResponse(**branch.__dict__))


@branches_router.put("/{branch_id}", response_model=APIResponse[BranchResponse])
@branches_router.patch("/{branch_id}", response_model=APIResponse[BranchResponse])
def update_branch(
    branch_id: UUID,
    body: BranchUpdateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("organization.branch:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[BranchResponse]:
    branch = BranchService(db).update_branch(
        ctx, branch_id, **body.model_dump(exclude_unset=True)
    )
    db.commit()
    return APIResponse(message="Branch updated", data=BranchResponse(**branch.__dict__))


@branches_router.delete("/{branch_id}", response_model=APIResponse[None])
def delete_branch(
    branch_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("organization.branch:delete"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[None]:
    BranchService(db).delete_branch(ctx, branch_id)
    db.commit()
    return APIResponse(message="Branch deleted", data=None)


@departments_router.get("", response_model=APIResponse[list])
def list_departments(
    ctx: Annotated[TenantContext, Depends(require_permission("organization.department:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
    branch_id: UUID | None = None,
) -> APIResponse[list]:
    depts = DepartmentService(db).list_departments(
        ctx, company_id=company_id, branch_id=branch_id
    )
    return APIResponse(message="Departments retrieved", data=[d.__dict__ for d in depts])


@departments_router.post("", response_model=APIResponse[dict])
def create_department(
    body: DepartmentCreateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("organization.department:create"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[dict]:
    dept = DepartmentService(db).create_department(ctx, **body.model_dump())
    db.commit()
    return APIResponse(message="Department created", data=dept.__dict__)


@departments_router.put("/{department_id}", response_model=APIResponse[dict])
@departments_router.patch("/{department_id}", response_model=APIResponse[dict])
def update_department(
    department_id: UUID,
    body: DepartmentUpdateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("organization.department:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[dict]:
    dept = DepartmentService(db).update_department(
        ctx, department_id, **body.model_dump(exclude_unset=True)
    )
    db.commit()
    return APIResponse(message="Department updated", data=dept.__dict__)


@departments_router.delete("/{department_id}", response_model=APIResponse[None])
def delete_department(
    department_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("organization.department:delete"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[None]:
    DepartmentService(db).delete_department(ctx, department_id)
    db.commit()
    return APIResponse(message="Department deleted", data=None)


@business_units_router.get("", response_model=APIResponse[list])
def list_business_units(
    ctx: Annotated[TenantContext, Depends(require_permission("organization.business_unit:read"))],
    db: Annotated[Session, Depends(get_db)],
    branch_id: UUID | None = None,
) -> APIResponse[list]:
    units = BusinessUnitService(db).list_units(ctx, branch_id=branch_id)
    return APIResponse(message="Business units retrieved", data=[u.__dict__ for u in units])


@business_units_router.post("", response_model=APIResponse[dict])
def create_business_unit(
    body: BusinessUnitCreateRequest,
    ctx: Annotated[
        TenantContext, Depends(require_permission("organization.business_unit:create"))
    ],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[dict]:
    unit = BusinessUnitService(db).create_unit(ctx, **body.model_dump())
    db.commit()
    return APIResponse(message="Business unit created", data=unit.__dict__)


@locations_router.get("", response_model=APIResponse[list])
def list_locations(
    ctx: Annotated[TenantContext, Depends(require_permission("organization.location:read"))],
    db: Annotated[Session, Depends(get_db)],
    branch_id: UUID | None = None,
    company_id: UUID | None = None,
) -> APIResponse[list]:
    locs = LocationService(db).list_locations(ctx, branch_id=branch_id, company_id=company_id)
    return APIResponse(message="Locations retrieved", data=[loc.__dict__ for loc in locs])


@locations_router.post("", response_model=APIResponse[dict])
def create_location(
    body: LocationCreateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("organization.location:create"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[dict]:
    loc = LocationService(db).create_location(ctx, **body.model_dump())
    db.commit()
    return APIResponse(message="Location created", data=loc.__dict__)


@locations_router.patch("/{location_id}", response_model=APIResponse[dict])
def update_location(
    location_id: UUID,
    body: LocationUpdateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("organization.location:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[dict]:
    payload = {k: v for k, v in body.model_dump().items() if v is not None}
    loc = LocationService(db).update_location(ctx, location_id, **payload)
    db.commit()
    return APIResponse(message="Location updated", data=loc.__dict__)


@locations_router.delete("/{location_id}", response_model=APIResponse[None])
def delete_location(
    location_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("organization.location:delete"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[None]:
    LocationService(db).delete_location(ctx, location_id)
    db.commit()
    return APIResponse(message="Location deleted", data=None)


@cost_centers_router.get("", response_model=APIResponse[list])
def list_cost_centers(
    ctx: Annotated[TenantContext, Depends(require_permission("organization.cost_center:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
) -> APIResponse[list]:
    items = CostCenterService(db).list_cost_centers(ctx, company_id=company_id)
    return APIResponse(message="Cost centers retrieved", data=[i.__dict__ for i in items])


@cost_centers_router.post("", response_model=APIResponse[dict])
def create_cost_center(
    body: CostCenterCreateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("organization.cost_center:create"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[dict]:
    cc = CostCenterService(db).create_cost_center(ctx, **body.model_dump())
    db.commit()
    return APIResponse(message="Cost center created", data=cc.__dict__)


@profit_centers_router.get("", response_model=APIResponse[list])
def list_profit_centers(
    ctx: Annotated[TenantContext, Depends(require_permission("organization.profit_center:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
) -> APIResponse[list]:
    items = ProfitCenterService(db).list_profit_centers(ctx, company_id=company_id)
    return APIResponse(message="Profit centers retrieved", data=[i.__dict__ for i in items])


@profit_centers_router.post("", response_model=APIResponse[dict])
def create_profit_center(
    body: ProfitCenterCreateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("organization.profit_center:create"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[dict]:
    pc = ProfitCenterService(db).create_profit_center(ctx, **body.model_dump())
    db.commit()
    return APIResponse(message="Profit center created", data=pc.__dict__)
