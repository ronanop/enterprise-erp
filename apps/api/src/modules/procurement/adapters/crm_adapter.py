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
        account = None
        if ovf.company_account_id is not None:
            account = CompanyRepository(self._db).get(ctx, ovf.company_account_id)
            email = (getattr(account, "customer_email", None) or "").strip() or None
        return {
            "email": email,
            "customer_name": ovf.customer_name,
            "po_number": ovf.po_number,
            "ovf_no": ovf.ovf_no,
            "company_account_id": (
                str(ovf.company_account_id) if ovf.company_account_id else None
            ),
            "account_name": (
                getattr(account, "customer_name", None) if account is not None else ovf.customer_name
            ),
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

    def get_ovf_owner_employee_id(self, ctx: TenantContext, ovf_id: UUID) -> UUID | None:
        """Salesperson who owns the opportunity behind an OVF (stock accountability)."""
        from modules.crm.models import CrmOpportunity
        from modules.crm.repository.ovf_repository import OvfRepository

        ovf = OvfRepository(self._db).get(ctx, ovf_id, branch_scoped=False)
        if ovf is None:
            return None
        opp = self._db.get(CrmOpportunity, ovf.opportunity_id)
        return opp.owner_employee_id if opp is not None else None

    def get_ovf_release_states(self, ctx: TenantContext, ovf_ids: list[UUID]) -> dict[UUID, bool]:
        """True when leftover stock of the OVF should open for sale (closed or deal lost)."""
        from sqlalchemy import select

        from modules.crm.models import CrmOpportunity, CrmOvf

        ids = [oid for oid in set(ovf_ids) if oid is not None]
        if not ids:
            return {}
        stmt = (
            select(CrmOvf.id, CrmOvf.closed_at, CrmOpportunity.status)
            .join(CrmOpportunity, CrmOpportunity.id == CrmOvf.opportunity_id)
            .where(CrmOvf.tenant_id == ctx.tenant_id, CrmOvf.id.in_(ids))
        )
        return {
            ovf_id: bool(closed_at is not None or status in ("lost", "cancelled"))
            for ovf_id, closed_at, status in self._db.execute(stmt).all()
        }

    def get_ovf_brief(self, ctx: TenantContext, ovf_id: UUID) -> dict[str, Any] | None:
        from modules.crm.repository.ovf_repository import OvfRepository

        ovf = OvfRepository(self._db).get(ctx, ovf_id, branch_scoped=False)
        if ovf is None:
            return None
        return {
            "id": ovf.id,
            "ovf_no": ovf.ovf_no,
            "opportunity_id": ovf.opportunity_id,
            "company_account_id": ovf.company_account_id,
            "customer_name": ovf.customer_name,
            "po_number": ovf.po_number,
            "blueprint_state": ovf.blueprint_state,
            "locked": bool(ovf.locked),
            "shared_to_scm": bool(ovf.shared_to_scm),
            "editable": ovf.blueprint_state == "draft" and not ovf.locked and not ovf.shared_to_scm,
            "shipping_address": ovf.shipping_address,
            "shipping_state": ovf.shipping_state,
            "expected_delivery_date": ovf.expected_delivery_date,
        }

    def list_ovf_briefs_for_opportunity(self, ctx: TenantContext, opportunity_id: UUID) -> list[dict[str, Any]]:
        from sqlalchemy import select

        from modules.crm.models import CrmOvf, CrmOvfLine

        ovfs = list(
            self._db.scalars(
                select(CrmOvf).where(
                    CrmOvf.tenant_id == ctx.tenant_id,
                    CrmOvf.opportunity_id == opportunity_id,
                    CrmOvf.is_deleted.is_(False),
                )
            ).all()
        )
        out = []
        for ovf in ovfs:
            brief = self.get_ovf_brief(ctx, ovf.id)
            if brief is None:
                continue
            lines = self._db.scalars(
                select(CrmOvfLine).where(
                    CrmOvfLine.ovf_id == ovf.id,
                    CrmOvfLine.side == "customer_po",
                    CrmOvfLine.is_deleted.is_(False),
                )
            ).all()
            brief["item_summary"] = "; ".join(f"{ln.product_name} x {float(ln.qty):g}" for ln in lines) or None
            brief["quantity"] = sum((float(ln.qty) for ln in lines), 0.0) or None
            out.append(brief)
        return out

    def get_opportunity_brief(self, ctx: TenantContext, opportunity_id: UUID) -> dict[str, Any] | None:
        from modules.crm.models import CrmCompany, CrmOpportunity

        opp = self._db.get(CrmOpportunity, opportunity_id)
        if opp is None or opp.tenant_id != ctx.tenant_id or opp.is_deleted:
            return None
        account = self._db.get(CrmCompany, opp.company_account_id) if opp.company_account_id else None
        return {
            "id": opp.id,
            "name": opp.opportunity_name,
            "deal_number": opp.deal_reg_number or opp.opportunity_code,
            "company_account_id": opp.company_account_id,
            "customer_name": getattr(account, "customer_name", None),
            "has_services": bool(getattr(opp, "has_services", False)),
            "has_hardware": bool(getattr(opp, "has_hardware", False)),
            "service_sourcing_channel": getattr(opp, "service_sourcing_channel", None),
        }

    def add_ovf_vendor_line(self, ctx: TenantContext, ovf_id: UUID, **fields: Any) -> Any:
        return self._ovfs.add_line(ctx, ovf_id, side="vendor", **fields)

    def raise_ovf_expense(self, ctx: TenantContext, ovf_id: UUID, **fields: Any) -> Any:
        from modules.crm.service.ovf_finance_service import OvfFinanceService

        return OvfFinanceService(self._db).raise_expense(ctx, ovf_id, **fields)

    def set_ovf_holding_cost(self, ctx: TenantContext, ovf_id: UUID, amount: Any) -> None:
        from modules.crm.service.ovf_finance_service import OvfFinanceService

        OvfFinanceService(self._db).set_holding_cost(ctx, ovf_id, amount)

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

    def list_attachments(
        self,
        ctx: TenantContext,
        *,
        entity_filters: list[tuple[str, UUID]],
        company_id: UUID | None = None,
    ) -> list[Any]:
        """Load CRM attachments for one or more (entity_type, entity_id) pairs."""
        from sqlalchemy import or_, select

        from modules.crm.models import CrmAttachment

        if not entity_filters:
            return []
        clauses = [
            (CrmAttachment.entity_type == et) & (CrmAttachment.entity_id == eid)
            for et, eid in entity_filters
        ]
        stmt = select(CrmAttachment).where(
            CrmAttachment.tenant_id == ctx.tenant_id,
            CrmAttachment.is_deleted.is_(False),
            or_(*clauses),
        )
        if company_id is not None:
            stmt = stmt.where(CrmAttachment.company_id == company_id)
        return list(self._db.scalars(stmt).all())

    def get_attachment(self, ctx: TenantContext, attachment_id: UUID) -> Any | None:
        from sqlalchemy import select

        from modules.crm.models import CrmAttachment

        return self._db.scalar(
            select(CrmAttachment).where(
                CrmAttachment.id == attachment_id,
                CrmAttachment.tenant_id == ctx.tenant_id,
                CrmAttachment.is_deleted.is_(False),
            )
        )

    def find_ovf_id_for_sales_pack(
        self, ctx: TenantContext, *, entity_type: str, entity_id: UUID
    ) -> UUID | None:
        from sqlalchemy import select

        from modules.crm.models.ovf import CrmOvf

        ovf_stmt = select(CrmOvf.id).where(
            CrmOvf.tenant_id == ctx.tenant_id,
            CrmOvf.is_deleted.is_(False),
        )
        if entity_type == "quote":
            ovf_stmt = ovf_stmt.where(CrmOvf.quote_id == entity_id)
        elif entity_type == "opportunity":
            ovf_stmt = ovf_stmt.where(CrmOvf.opportunity_id == entity_id)
        else:
            return None
        return self._db.scalar(ovf_stmt.limit(1))

    def list_attachments_by_entity_ids(
        self,
        ctx: TenantContext,
        *,
        entity_type: str,
        entity_ids: list[UUID],
        branch_scoped: bool = True,
    ) -> list[Any]:
        if not entity_ids:
            return []
        from sqlalchemy import select

        from modules.crm.models import CrmAttachment
        from modules.crm.repository.attachment_repository import AttachmentRepository

        repo = AttachmentRepository(self._db)
        stmt = select(CrmAttachment).where(
            CrmAttachment.entity_type == entity_type,
            CrmAttachment.entity_id.in_(entity_ids),
            CrmAttachment.is_deleted.is_(False),
        )
        stmt = repo.apply_crm_filter(stmt, CrmAttachment, ctx, branch_scoped=branch_scoped)
        return list(self._db.scalars(stmt).all())
