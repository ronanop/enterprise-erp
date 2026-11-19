"""Asset read port for ESS workplace (hr schema).

QR and barcode inventory lookup from the ERP asset module is not available.
Codes are matched against the issued asset code only.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.hr.models.hr_employee_asset import HrEmployeeAsset
from modules.hr.repository.employee_asset_repository import EmployeeAssetRepository


class EssAssetAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = EmployeeAssetRepository(db)

    def get(self, asset_id: UUID) -> HrEmployeeAsset | None:
        return self._repo.get(asset_id)

    def lookup_by_code(
        self, ctx: TenantContext, *, company_id: UUID, code: str
    ) -> HrEmployeeAsset | None:
        return self._repo.lookup_by_code(ctx.tenant_id, company_id, code)

    def list_assigned_assets(
        self, *, employee_id: UUID
    ) -> list[tuple[HrEmployeeAsset, HrEmployeeAsset]]:
        assets = self._repo.list_active_for_employee(employee_id)
        return [(asset, asset) for asset in assets]
