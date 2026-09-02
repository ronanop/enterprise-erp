"""CRM port — OVF / opportunity / company account context for PO → project intake."""

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.crm.models.company import CrmCompany
from modules.crm.models.lead import CrmLead
from modules.crm.repository.company_repository import CompanyRepository
from modules.crm.repository.opportunity_repository import OpportunityRepository
from modules.crm.repository.ovf_repository import OvfRepository
from modules.foundation.domain.value_objects import TenantContext
from modules.procurement.adapters.crm_adapter import ProcurementCrmAdapter

# First two digits of GSTIN → Indian state (entity billing state on CRM lead).
_GSTIN_STATE_BY_PREFIX: dict[str, str] = {
    "01": "Jammu and Kashmir",
    "02": "Himachal Pradesh",
    "03": "Punjab",
    "04": "Chandigarh",
    "05": "Uttarakhand",
    "06": "Haryana",
    "07": "Delhi",
    "08": "Rajasthan",
    "09": "Uttar Pradesh",
    "10": "Bihar",
    "11": "Sikkim",
    "12": "Arunachal Pradesh",
    "13": "Nagaland",
    "14": "Manipur",
    "15": "Mizoram",
    "16": "Tripura",
    "17": "Meghalaya",
    "18": "Assam",
    "19": "West Bengal",
    "20": "Jharkhand",
    "21": "Odisha",
    "22": "Chhattisgarh",
    "23": "Madhya Pradesh",
    "24": "Gujarat",
    "27": "Maharashtra",
    "29": "Karnataka",
    "32": "Kerala",
    "33": "Tamil Nadu",
    "34": "Puducherry",
    "36": "Telangana",
    "37": "Andhra Pradesh",
}


def _state_from_entity_gst(gstin: str | None) -> str | None:
    prefix = (gstin or "").strip()[:2]
    return _GSTIN_STATE_BY_PREFIX.get(prefix)


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

    def _load_lead(self, lead_id: UUID | None) -> CrmLead | None:
        if lead_id is None:
            return None
        return self._db.scalar(
            select(CrmLead).where(
                CrmLead.id == lead_id,
                CrmLead.is_deleted.is_(False),
            )
        )

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

        circle_name: str | None = None
        entity_state: str | None = None
        lead = self._load_lead(opp.lead_id if opp is not None else None)
        if lead is not None:
            circle_name = (lead.entity_name or "").strip() or None
            entity_state = _state_from_entity_gst(lead.entity_gst) or (
                (lead.state or "").strip() or None
            )

        project_title: str | None = None
        if lead is not None:
            project_title = (getattr(lead, "project_title", None) or "").strip() or None
        if not project_title and opp is not None:
            project_title = (getattr(opp, "project_title", None) or "").strip() or None

        return {
            "customer_name": customer_name,
            "customer_id": customer_id,
            "site_name": site_name,
            "opportunity_id": opportunity_id,
            "customer_po_number": handoff.get("po_number"),
            "company_account_id": company_account_id,
            "circle_name": circle_name,
            "entity_state": entity_state,
            "lead_id": lead.id if lead is not None else None,
            "project_title": project_title,
        }
