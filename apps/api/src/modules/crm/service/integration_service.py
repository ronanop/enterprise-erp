"""CRM cross-module integration facade."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.crm.adapters.master_data_port import CrmMasterDataAdapter
from modules.crm.adapters.sales_port import CrmSalesAdapter
from modules.crm.domain.enums import OpportunityStatus
from modules.crm.domain.exceptions import CrmConversionError
from modules.crm.repository.lead_repository import LeadRepository
from modules.crm.repository.opportunity_repository import OpportunityRepository
from modules.crm.service.engines import LeadEngine, OpportunityEngine
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService


class CRMIntegrationService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._leads = LeadRepository(db)
        self._opps = OpportunityRepository(db)
        self._master = CrmMasterDataAdapter(db)
        self._sales = CrmSalesAdapter(db)
        self._lead_engine = LeadEngine()
        self._opp_engine = OpportunityEngine()
        self._audit = AuditService(db)

    def convert_lead_to_customer(
        self,
        ctx: TenantContext,
        lead_id: UUID,
        *,
        customer_name: str | None = None,
        existing_customer_id: UUID | None = None,
    ):
        lead = self._leads.get(ctx, lead_id)
        if lead is None:
            raise NotFoundException("Lead not found")
        self._lead_engine.validate_convertible(lead)
        if existing_customer_id:
            customer = self._master.get_customer(ctx, existing_customer_id)
        else:
            name = customer_name or lead.company_name or f"{lead.first_name} {lead.last_name or ''}".strip()
            customer = self._master.create_customer_from_lead(
                ctx,
                company_id=lead.company_id,
                branch_id=lead.branch_id,
                customer_name=name,
                email=lead.email,
                mobile=lead.mobile,
            )
        lead.customer_id = customer.id
        self._leads.update(ctx, lead_id, customer_id=customer.id)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="crm_lead",
            entity_id=lead_id,
            operation="link_customer",
            performed_by=ctx.user_id,
        )
        return customer

    def create_quotation_on_win(self, ctx: TenantContext, opportunity_id: UUID, *, currency_code: str = "USD"):
        opp = self._opps.get(ctx, opportunity_id)
        if opp is None:
            raise NotFoundException("Opportunity not found")
        if opp.status != OpportunityStatus.WON.value and opp.customer_id is None:
            raise CrmConversionError("Won opportunity with customer required for quotation")
        if opp.customer_id is None:
            raise CrmConversionError("customer_id required")
        quotation = self._sales.create_quotation_for_opportunity(
            ctx,
            company_id=opp.company_id,
            branch_id=opp.branch_id,
            customer_id=opp.customer_id,
            opportunity_id=opp.id,
            currency_code=currency_code,
        )
        self._opps.update(ctx, opportunity_id, sales_quotation_id=quotation.id)
        return quotation

    def read_customer_credit(self, ctx: TenantContext, company_id: UUID, customer_id: UUID):
        return self._sales.read_customer_credit(ctx, company_id, customer_id)
