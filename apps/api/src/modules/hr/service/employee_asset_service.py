"""HR employee asset custody — list, assign, and return via asset assignments."""

from datetime import date, datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.exceptions import AppException, NotFoundException
from modules.asset.models.asset import AstAsset
from modules.asset.models.asset_assignment import AstAssetAssignment
from modules.asset.service.assignment_service import AssignmentService
from modules.foundation.domain.value_objects import TenantContext
from modules.hr.adapters.master_data_port import HrMasterDataAdapter

_ACTIVE_ASSIGNMENT_STATUSES = ("draft", "submitted", "approved", "active")
_RETURNABLE_STATUSES = ("approved", "active")


class EmployeeAssetService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._master = HrMasterDataAdapter(db)
        self._assignments = AssignmentService(db)

    def _active_assignment_for_other(self, asset_id: UUID, employee_id: UUID) -> bool:
        row = self._db.scalar(
            select(AstAssetAssignment).where(
                AstAssetAssignment.asset_id == asset_id,
                AstAssetAssignment.employee_id != employee_id,
                AstAssetAssignment.is_deleted.is_(False),
                AstAssetAssignment.status.in_(_ACTIVE_ASSIGNMENT_STATUSES),
            )
        )
        return row is not None

    def _active_assignment_for_employee(self, asset_id: UUID, employee_id: UUID):
        return self._db.scalar(
            select(AstAssetAssignment).where(
                AstAssetAssignment.asset_id == asset_id,
                AstAssetAssignment.employee_id == employee_id,
                AstAssetAssignment.is_deleted.is_(False),
                AstAssetAssignment.status.in_(("approved", "active")),
            )
        )

    @staticmethod
    def _to_item(asset: AstAsset, assignment: AstAssetAssignment | None) -> dict:
        return {
            "id": asset.id,
            "assignment_id": assignment.id if assignment else None,
            "asset_code": asset.asset_code,
            "asset_name": asset.asset_name,
            "asset_type": asset.asset_type,
            "serial_number": asset.serial_number,
            "asset_status": asset.status,
            "assignment_status": assignment.status if assignment else "custodian",
            "document_number": assignment.document_number if assignment else None,
            "allocated_at": assignment.allocated_at if assignment else None,
            "expected_return_at": assignment.expected_return_at if assignment else None,
            "returned_at": assignment.returned_at if assignment else None,
        }

    def list_for_employee(self, ctx: TenantContext, employee_id: UUID) -> list[dict]:
        self._master.get_employee(ctx, employee_id)
        assignments = list(
            self._db.scalars(
                select(AstAssetAssignment)
                .where(
                    AstAssetAssignment.tenant_id == ctx.tenant_id,
                    AstAssetAssignment.employee_id == employee_id,
                    AstAssetAssignment.is_deleted.is_(False),
                )
                .order_by(AstAssetAssignment.allocated_at.desc().nullslast())
            ).all()
        )
        items: list[dict] = []
        seen_assets: set[UUID] = set()
        for assignment in assignments:
            asset = self._db.get(AstAsset, assignment.asset_id)
            if asset is None or getattr(asset, "is_deleted", False):
                continue
            seen_assets.add(asset.id)
            items.append(self._to_item(asset, assignment))

        custodians = list(
            self._db.scalars(
                select(AstAsset).where(
                    AstAsset.tenant_id == ctx.tenant_id,
                    AstAsset.custodian_employee_id == employee_id,
                    AstAsset.is_deleted.is_(False),
                )
            ).all()
        )
        for asset in custodians:
            if asset.id in seen_assets:
                continue
            items.append(self._to_item(asset, None))
        return items

    def list_available_assets(
        self,
        ctx: TenantContext,
        employee_id: UUID,
        *,
        branch_id: UUID | None = None,
    ) -> list[dict]:
        self._master.get_employee(ctx, employee_id)
        stmt = select(AstAsset).where(
            AstAsset.tenant_id == ctx.tenant_id,
            AstAsset.is_deleted.is_(False),
            AstAsset.status == "active",
        )
        if branch_id is not None:
            stmt = stmt.where(AstAsset.branch_id == branch_id)
        assets = list(self._db.scalars(stmt.order_by(AstAsset.asset_code)).all())
        available: list[dict] = []
        for asset in assets:
            if self._active_assignment_for_other(asset.id, employee_id):
                continue
            if self._active_assignment_for_employee(asset.id, employee_id):
                continue
            available.append(
                {
                    "id": asset.id,
                    "asset_code": asset.asset_code,
                    "asset_name": asset.asset_name,
                    "asset_type": asset.asset_type,
                    "serial_number": asset.serial_number,
                }
            )
        return available

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
        asset = self._db.get(AstAsset, asset_id)
        if asset is None or getattr(asset, "is_deleted", False):
            raise NotFoundException("Asset not found")
        if self._active_assignment_for_other(asset_id, employee_id):
            raise AppException("Asset is already assigned to another employee")
        if self._active_assignment_for_employee(asset_id, employee_id):
            raise AppException("Asset is already assigned to this employee")

        allocated_at = datetime.now(timezone.utc)
        row = self._assignments.create(
            ctx,
            branch_id=branch_id,
            asset_id=asset_id,
            allocation_type="employee",
            employee_id=employee_id,
            department_id=asset.department_id,
            allocated_at=allocated_at,
            expected_return_at=expected_return_at,
            status="draft",
        )
        row = self._assignments.submit(ctx, row.id)
        row = self._assignments.approve(ctx, row.id)
        return self._to_item(asset, row)

    def return_asset(self, ctx: TenantContext, assignment_id: UUID) -> dict:
        row = self._assignments.get(ctx, assignment_id)
        if row.status not in _RETURNABLE_STATUSES:
            raise AppException("Only active assignments can be returned")
        updated = self._assignments.return_assignment(ctx, assignment_id)
        if updated.returned_at is None:
            updated.returned_at = datetime.now(timezone.utc)
            self._db.flush()
        asset = self._db.get(AstAsset, updated.asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        return self._to_item(asset, updated)
