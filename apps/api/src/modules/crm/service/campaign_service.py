"""Campaign services."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.crm.domain.enums import CampaignStatus, CrmEntityType
from modules.crm.models import CrmCampaign
from modules.crm.repository.campaign_member_repository import CampaignMemberRepository
from modules.crm.repository.campaign_repository import CampaignRepository
from modules.crm.service.crm_scope_validator import CrmScopeValidator
from modules.crm.service.document_number_service import DocumentNumberService
from modules.crm.service.engines import CampaignEngine, CampaignMemberEngine
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService


class CampaignService:
    def __init__(self, db: Session) -> None:
        self._repo = CampaignRepository(db)
        self._members = CampaignMemberRepository(db)
        self._scope = CrmScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = CampaignEngine()
        self._member_engine = CampaignMemberEngine()
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_campaigns(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Campaign not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        code = self._numbers.generate(CrmEntityType.CAMPAIGN, cid, CrmCampaign, "campaign_code")
        fields.setdefault("status", CampaignStatus.DRAFT.value)
        return self._repo.create(ctx, company_id=cid, campaign_code=code, **fields)

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Campaign not found")
        return row

    def activate(self, ctx: TenantContext, row_id: UUID):
        campaign = self.get(ctx, row_id)
        self._engine.activate(campaign)
        return self._repo.update(ctx, row_id, status=CampaignStatus.ACTIVE.value)

    def add_member(self, ctx: TenantContext, campaign_id: UUID, **fields):
        campaign = self.get(ctx, campaign_id)
        member = self._members.create(
            ctx,
            company_id=campaign.company_id,
            branch_id=campaign.branch_id,
            campaign_id=campaign_id,
            added_at=datetime.now(timezone.utc),
            **fields,
        )
        self._member_engine.validate_member(member)
        return member

    def list_members(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._members.list_members(ctx, cid)
