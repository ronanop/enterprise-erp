"""HR employee asset custody — list, assign, and return (hr schema)."""

from datetime import date, datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import AppException, NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.hr.adapters.asset_port import HrAssetAdapter
from modules.hr.adapters.master_data_port import HrMasterDataAdapter

_RETURNABLE_STATUSES = ("active", "approved")


class EmployeeAssetService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._master = HrMasterDataAdapter(db)
        self._assets = HrAssetAdapter(db)

    @staticmethod
    def _to_item(asset: Any) -> dict:
        assigned = asset.employee_id is not None and asset.status == "active"
        return {
            "id": asset.id,
            "assignment_id": asset.id if asset.employee_id else None,
            "asset_code": asset.asset_code,
            "asset_name": asset.asset_name,
            "asset_type": asset.asset_type or asset.category,
            "serial_number": asset.serial_number,
            "asset_status": asset.status,
            "assignment_status": "active" if assigned else asset.status,
            "document_number": None,
            "allocated_at": asset.assigned_at,
            "expected_return_at": asset.expected_return_at,
            "returned_at": asset.returned_at,
        }

    def list_for_employee(self, ctx: TenantContext, employee_id: UUID) -> list[dict]:
        self._master.get_employee(ctx, employee_id)
        return [
            self._to_item(row)
            for row in self._assets.list_employee_assignments(ctx.tenant_id, employee_id)
        ]

    def list_available_assets(
        self,
        ctx: TenantContext,
        employee_id: UUID,
        *,
        branch_id: UUID | None = None,
    ) -> list[dict]:
        self._master.get_employee(ctx, employee_id)
        return [
            {
                "id": asset.id,
                "asset_code": asset.asset_code,
                "asset_name": asset.asset_name,
                "asset_type": asset.asset_type or asset.category,
                "serial_number": asset.serial_number,
            }
            for asset in self._assets.list_active_assets(ctx.tenant_id, branch_id)
            if asset.employee_id is None
        ]

    def assign(
        self,
        ctx: TenantContext,
        *,
        employee_id: UUID,
        asset_id: UUID,
        branch_id: UUID,
        expected_return_at: date | None = None,
    ) -> dict:
        self._master.get_employee(ctx, employee_id)
        asset = self._assets.get_asset(asset_id)
        if asset is None or asset.tenant_id != ctx.tenant_id:
            raise NotFoundException("Asset not found")
        if self._assets.has_active_assignment_for_other(asset_id, employee_id):
            raise AppException("Asset is already assigned to another employee")
        if self._assets.active_assignment_for_employee(asset_id, employee_id):
            raise AppException("Asset is already assigned to this employee")

        updated = self._assets.issue(
            ctx,
            asset,
            employee_id=employee_id,
            branch_id=branch_id,
            assigned_at=datetime.now(timezone.utc),
            expected_return_at=expected_return_at,
        )
        return self._to_item(updated)

    def create_asset(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        branch_id: UUID | None,
        asset_code: str,
        asset_name: str,
        asset_type: str | None = None,
        serial_number: str | None = None,
    ) -> dict:
        if branch_id is None:
            raise AppException("Branch is required to register an employee asset")
        row = self._assets.create(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            asset_code=asset_code.strip().upper(),
            name=asset_name.strip(),
            category=(asset_type or "other").strip() or "other",
            serial_number=serial_number,
            status="active",
            employee_id=None,
            assigned_at=None,
        )
        return self._to_item(row)

    def return_asset(self, ctx: TenantContext, assignment_id: UUID) -> dict:
        asset = self._assets.get_asset(assignment_id)
        if asset is None or asset.tenant_id != ctx.tenant_id or asset.employee_id is None:
            raise NotFoundException("Assignment not found")
        if asset.status not in _RETURNABLE_STATUSES:
            raise AppException("Only active assignments can be returned")
        updated = self._assets.mark_returned(
            ctx, asset, returned_at=datetime.now(timezone.utc)
        )
        return self._to_item(updated)
