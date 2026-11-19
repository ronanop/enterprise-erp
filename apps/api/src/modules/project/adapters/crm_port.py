"""CRM port — OVF / opportunity / company account context for PO → project intake."""

from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from modules.crm.models.company import CrmCompany
from modules.crm.repository.company_repository import CompanyRepository
from modules.crm.repository.opportunity_repository import OpportunityRepository
from modules.crm.repository.ovf_repository import OvfRepository
from modules.foundation.domain.value_objects import TenantContext
from modules.procurement.adapters.crm_adapter import ProcurementCrmAdapter


def _format_address(
    street: str | None,
    city: str | None,
    state: str | None,
    code: str | None,
    country: str | None,
) -> str | None:
    line1 = (street or "").strip()
    locality = ", ".join(
        part
        for part in [(city or "").strip(), (state or "").strip(), (code or "").strip()]
        if part
    )
    country_s = (country or "").strip()
    parts = [part for part in [line1, locality, country_s] if part]
    return ", ".join(parts) if parts else None


def _site_address_from_company(company: CrmCompany) -> str | None:
    shipping = _format_address(
        company.shipping_street,
        company.shipping_city,
        company.shipping_state,
        company.shipping_code,
        company.shipping_country,
    )
    if shipping:
        return shipping[:255]
    billing = _format_address(
        company.billing_street,
        company.billing_city,
        company.billing_state,
        company.billing_code,
        company.billing_country,
    )
    return billing[:255] if billing else None


def _site_address_from_handoff(handoff: dict[str, Any]) -> str | None:
    shipping = (handoff.get("shipping_address") or "").strip()
    if shipping:
        return shipping[:255]
    billing = (handoff.get("billing_address") or "").strip()
    if billing:
        return billing[:255]
    return None


class ProjectCrmAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._ovfs = ProcurementCrmAdapter(db)
        self._ovf_repo = OvfRepository(db)
        self._opportunities = OpportunityRepository(db)
        self._companies = CompanyRepository(db)

    def _load_company_account(
        self, ctx: TenantContext, company_account_id: UUID | None
    ) -> CrmCompany | None:
        if company_account_id is None:
            return None
        account = self._companies.get(ctx, company_account_id, branch_scoped=False)
        if account is not None:
            return account
        return self._companies.get(ctx, company_account_id, branch_scoped=True)

    def resolve_ovf_project_context(
        self, ctx: TenantContext, ovf_id: UUID
    ) -> dict[str, Any]:
        """Company name + address from CRM sales account linked to the OVF / opportunity."""
        handoff = self._ovfs.get_handoff(ctx, ovf_id)
        ovf = self._ovf_repo.get(ctx, ovf_id, branch_scoped=False) or self._ovf_repo.get(
            ctx, ovf_id, branch_scoped=True
        )

        opportunity_id = handoff.get("opportunity_id")
        opp = (
            self._opportunities.get(ctx, opportunity_id, branch_scoped=False)
            if opportunity_id is not None
            else None
        )
        if opp is None and opportunity_id is not None:
            opp = self._opportunities.get(ctx, opportunity_id, branch_scoped=True)

        company_account_id = None
        if ovf is not None and ovf.company_account_id is not None:
            company_account_id = ovf.company_account_id
        elif opp is not None and opp.company_account_id is not None:
            company_account_id = opp.company_account_id

        account = self._load_company_account(ctx, company_account_id)

        customer_name: str | None = None
        customer_id: UUID | None = None
        site_name: str | None = None

        if account is not None:
            customer_name = (account.customer_name or "").strip() or None
            site_name = _site_address_from_company(account)
            customer_id = account.master_customer_id

        if not customer_name:
            customer_name = (
                (handoff.get("account_name") or handoff.get("customer_name") or "").strip()
                or None
            )
        if not site_name:
            site_name = _site_address_from_handoff(handoff)

        if customer_id is None and opp is not None:
            customer_id = opp.customer_id

        return {
            "customer_name": customer_name,
            "customer_id": customer_id,
            "site_name": site_name,
            "opportunity_id": opportunity_id,
            "customer_po_number": handoff.get("po_number"),
            "company_account_id": company_account_id,
        }
