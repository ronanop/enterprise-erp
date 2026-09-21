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
        self._db = db
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

    def get_customer_contact(self, ctx: TenantContext, ovf_id: UUID) -> dict[str, Any]:
        """Customer name / registered email behind an OVF, for order correspondence."""
        from modules.crm.repository.company_repository import CompanyRepository
        from modules.crm.repository.ovf_repository import OvfRepository

        ovf = OvfRepository(self._db).get(ctx, ovf_id)
        if ovf is None:
            return {}
        email = None
        if ovf.company_account_id is not None:
            account = CompanyRepository(self._db).get(ctx, ovf.company_account_id)
            email = (getattr(account, "customer_email", None) or "").strip() or None
        return {
            "email": email,
            "customer_name": ovf.customer_name,
            "po_number": ovf.po_number,
            "ovf_no": ovf.ovf_no,
        }

    def find_ovf_by_customer_po(self, *, order_number: str, email: str) -> Any | None:
        """Tenant-less lookup for public order tracking.

        Matched on the customer's own PO number **and** the email registered on
        their sales account, so PO numbers cannot be walked to read another
        customer's order.
        """
        from sqlalchemy import func, select

        from modules.crm.models import CrmCompany, CrmOvf

        reference = (order_number or "").strip()
        address = (email or "").strip().lower()
        if not reference or not address:
            return None

        stmt = (
            select(CrmOvf)
            .join(CrmCompany, CrmCompany.id == CrmOvf.company_account_id)
            .where(
                CrmOvf.is_deleted.is_(False),
                CrmCompany.is_deleted.is_(False),
                func.lower(func.trim(CrmOvf.po_number)) == reference.lower(),
                func.lower(func.trim(CrmCompany.customer_email)) == address,
            )
            .order_by(CrmOvf.created_at.desc())
        )
        return self._db.scalars(stmt).first()

    def record_scm_savings(
        self,
        ctx: TenantContext,
        ovf_id: UUID,
        *,
        savings_amount: float,
        negotiated_vendor_total: float | None = None,
    ) -> Any:
        return self._ovfs.record_scm_savings(
            ctx,
            ovf_id,
            savings_amount=savings_amount,
            negotiated_vendor_total=negotiated_vendor_total,
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
