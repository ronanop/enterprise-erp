"""Asset port for HR employee custody (hr schema).

ERP asset-inventory and custodian QR flows are not used. Custody is the
issued-asset row in the hr schema.
"""

from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.hr.models.hr_employee_asset import HrEmployeeAsset
from modules.hr.repository.employee_asset_repository import EmployeeAssetRepository


class HrAssetAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = EmployeeAssetRepository(db)

    def get_asset(self, asset_id: UUID) -> HrEmployeeAsset | None:
        return self._repo.get(asset_id)

    def has_active_assignment_for_other(self, asset_id: UUID, employee_id: UUID) -> bool:
        asset = self.get_asset(asset_id)
        if asset is None or asset.status != "active":
            return False
        return asset.employee_id is not None and asset.employee_id != employee_id

    def active_assignment_for_employee(self, asset_id: UUID, employee_id: UUID):
        asset = self.get_asset(asset_id)
        if asset is None:
            return None
        if asset.employee_id == employee_id and asset.status == "active":
            return asset
        return None

    def list_employee_assignments(self, tenant_id: UUID, employee_id: UUID) -> list[HrEmployeeAsset]:
        return self._repo.list_for_employee(tenant_id, employee_id)

    def list_custodian_assets(self, tenant_id: UUID, employee_id: UUID) -> list[HrEmployeeAsset]:
        _ = (tenant_id, employee_id)
        return []

    def list_active_assets(self, tenant_id: UUID, branch_id: UUID | None) -> list[HrEmployeeAsset]:
        return self._repo.list_reassignable(tenant_id, branch_id)

    def issue(
        self,
        ctx: TenantContext,
        row: HrEmployeeAsset,
        *,
        employee_id: UUID,
        branch_id: UUID,
        assigned_at: datetime,
        expected_return_at: date | None,
    ) -> HrEmployeeAsset:
        return self._repo.issue(
            ctx,
            row,
            employee_id=employee_id,
            branch_id=branch_id,
            assigned_at=assigned_at,
            expected_return_at=expected_return_at,
        )

    def mark_returned(
        self, ctx: TenantContext, row: HrEmployeeAsset, *, returned_at: datetime
    ) -> HrEmployeeAsset:
        return self._repo.mark_returned(ctx, row, returned_at=returned_at)

    def create(self, ctx: TenantContext, **fields) -> HrEmployeeAsset:
        return self._repo.create(ctx, **fields)
