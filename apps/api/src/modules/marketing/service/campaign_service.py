"""Marketing campaign service."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.marketing.adapters.crm_port import CrmCampaignPort
from modules.marketing.domain.enums import CampaignStatus
from modules.marketing.domain.exceptions import NotFoundException, ValidationException
from modules.marketing.models import MktCampaign
from modules.marketing.repository.base import MktScopedRepository
from modules.marketing.service.number_service import MarketingNumberService
from modules.marketing.service.ops_service import M365Service


class CampaignService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self._repo = MktScopedRepository(db)
        self._numbers = MarketingNumberService(db)
        self._crm = CrmCampaignPort(db)
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._repo.resolve_company_id(ctx, company_id)
        return self._repo.list_by_company(MktCampaign, ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> MktCampaign:
        row = self._repo.get_by_id(MktCampaign, ctx, row_id)
        if row is None:
            raise NotFoundException("Campaign not found")
        return row

    def create(self, ctx: TenantContext, **fields) -> MktCampaign:
        company_id = self._repo.resolve_company_id(ctx, fields.pop("company_id", None))
        crm_id = fields.get("crm_campaign_id")
        if crm_id and not self._crm.exists(ctx.tenant_id, crm_id):
            raise ValidationException("Linked CRM campaign not found for tenant")
        code = self._numbers.next_code(MktCampaign, company_id, "campaign_code", "MKT")
        fields.setdefault("status", CampaignStatus.DRAFT.value)
        fields.setdefault("owner_user_id", ctx.user_id)
        row = self._repo.create_row(
            MktCampaign,
            ctx,
            company_id=company_id,
            campaign_code=code,
            **fields,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="mkt_campaign",
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
            new_value={"campaign_code": row.campaign_code, "campaign_name": row.campaign_name},
        )
        M365Service(self.db).provision_for_campaign(ctx, row)
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> MktCampaign:
        crm_id = fields.get("crm_campaign_id")
        if crm_id and not self._crm.exists(ctx.tenant_id, crm_id):
            raise ValidationException("Linked CRM campaign not found for tenant")
        row = self._repo.update_row(MktCampaign, ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Campaign not found")
        return row

    def activate(self, ctx: TenantContext, row_id: UUID) -> MktCampaign:
        return self.update(ctx, row_id, status=CampaignStatus.ACTIVE.value)
