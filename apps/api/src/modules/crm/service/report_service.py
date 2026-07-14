"""CRM report service."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.crm.repository.lead_repository import LeadRepository
from modules.crm.repository.opportunity_repository import OpportunityRepository
from modules.crm.service.crm_scope_validator import CrmScopeValidator
from modules.foundation.domain.value_objects import TenantContext


class CRMReportService:
    def __init__(self, db: Session) -> None:
        self._leads = LeadRepository(db)
        self._opps = OpportunityRepository(db)
        self._scope = CrmScopeValidator(db)

    def summary(self, ctx: TenantContext, company_id: UUID | None = None) -> dict:
        cid = self._scope.resolve_company_id(ctx, company_id)
        leads = self._leads.list_leads(ctx, cid)
        opps = self._opps.list_opportunities(ctx, cid)
        return {
            "lead_count": len(leads),
            "converted_leads": sum(1 for lead in leads if lead.status == "converted"),
            "open_opportunities": sum(1 for opp in opps if opp.status == "open"),
            "won_opportunities": sum(1 for opp in opps if opp.status == "won"),
            "pipeline_value": float(sum((opp.forecast_amount or 0) for opp in opps if opp.status == "open")),
        }
