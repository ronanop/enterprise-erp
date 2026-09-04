"""CRM read port for SCM queue / OVF → vendor PO handoff."""

from datetime import date
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from modules.crm.service.ovf_service import OvfService
from modules.foundation.domain.value_objects import TenantContext


class ProcurementCrmAdapter:
    """CRM OVF port for SCM queue / handoff / hold."""

    def __init__(self, db: Session) -> None:
        self._ovfs = OvfService(db)

    def list_shared_ovfs(self, ctx: TenantContext, company_id: UUID | None = None) -> list[Any]:
        return self._ovfs.list_shared_for_scm(ctx, company_id)

    def get_ovf_display_meta(
        self, ctx: TenantContext, ovf_ids: list[UUID]
    ) -> dict[UUID, dict[str, str | date | int | None]]:
        return self._ovfs.list_display_meta_by_ids(ctx, ovf_ids)

    def get_handoff(self, ctx: TenantContext, ovf_id: UUID) -> dict[str, Any]:
        return self._ovfs.get_scm_handoff(ctx, ovf_id)

    def get_commercial_totals(self, ctx: TenantContext, ovf_id: UUID) -> dict[str, float]:
        return self._ovfs.get_scm_commercial_totals(ctx, ovf_id)

    def get_commercial_export(self, ctx: TenantContext, ovf_id: UUID) -> dict[str, Any]:
        return self._ovfs.get_scm_commercial_export(ctx, ovf_id)

    def set_scm_on_hold(
        self,
        ctx: TenantContext,
        ovf_id: UUID,
        *,
        on_hold: bool,
        remark: str | None = None,
    ) -> Any:
        return self._ovfs.set_scm_on_hold(ctx, ovf_id, on_hold=on_hold, remark=remark)

    def update_scm_charges(
        self,
        ctx: TenantContext,
        ovf_id: UUID,
        *,
        freight: float | None = None,
        additional_charges: float | None = None,
        finance_cost_pct: float | None = None,
    ) -> Any:
        return self._ovfs.update_scm_charges(
            ctx,
            ovf_id,
            freight=freight,
            additional_charges=additional_charges,
            finance_cost_pct=finance_cost_pct,
        )

    def update_scm_item_plan_vendor(
        self,
        ctx: TenantContext,
        ovf_id: UUID,
        *,
        product_name: str,
        line_index: int,
        distributor_name: str,
    ) -> Any:
        return self._ovfs.update_scm_item_plan_vendor(
            ctx,
            ovf_id,
            product_name=product_name,
            line_index=line_index,
            distributor_name=distributor_name,
        )
