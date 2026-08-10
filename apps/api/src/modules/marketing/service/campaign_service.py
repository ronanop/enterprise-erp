"""Marketing campaign service."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.marketing.domain.enums import MktEntityType
from modules.marketing.models.campaign import MktCampaign
from modules.marketing.repository.marketing_repository import CampaignRepository, CampaignAudienceRepository
from modules.marketing.schemas import CampaignAudienceResponse, CampaignResponse
from modules.marketing.service.activity_log_service import ActivityLogService
from modules.marketing.service.engines.campaign_engine import CampaignEngine
from modules.marketing.service.marketing_number_service import MarketingNumberService
from modules.marketing.service.marketing_scope_validator import MarketingScopeValidator


class CampaignService:
    def __init__(self, db: Session) -> None:
        self._repo = CampaignRepository(db)
        self._audience = CampaignAudienceRepository(db)
        self._scope = MarketingScopeValidator(db)
        self._numbers = MarketingNumberService(db)
        self._engine = CampaignEngine()
        self._activity = ActivityLogService(db)

    def list_campaigns(self, ctx: TenantContext, *, company_id: UUID | None = None, status: str | None = None, q: str | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        rows = self._repo.list_rows(ctx, cid, status=status, q=q)
        return [CampaignResponse.model_validate(r) for r in rows]

    def get_campaign(self, ctx: TenantContext, row_id: UUID) -> CampaignResponse:
        row = self._get(ctx, row_id)
        return CampaignResponse.model_validate(row)

    def create_campaign(self, ctx: TenantContext, company_id: UUID | None = None, **fields) -> CampaignResponse:
        cid = self._scope.resolve_company_id(ctx, company_id)
        doc = self._numbers.generate(MktEntityType.CAMPAIGN, cid, MktCampaign, "campaign_number")
        row = self._repo.create(ctx, company_id=cid, campaign_number=doc, **fields)
        self._activity.log(ctx, entity_type="campaign", entity_id=row.id, action="created", details=f"Campaign {doc} created", company_id=cid)
        return CampaignResponse.model_validate(row)

    def update_campaign(self, ctx: TenantContext, row_id: UUID, **fields) -> CampaignResponse:
        self._get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Campaign not found")
        return CampaignResponse.model_validate(row)

    def submit_campaign(self, ctx: TenantContext, row_id: UUID) -> CampaignResponse:
        row = self._get(ctx, row_id)
        self._engine.submit(row)
        row = self._repo.update(
            ctx,
            row_id,
            status=row.status,
            submitted_at=row.submitted_at,
            rejection_reason=row.rejection_reason,
        )
        self._activity.log(
            ctx,
            entity_type="campaign",
            entity_id=row.id,
            action="submitted",
            details="Submitted for marketing head approval",
            company_id=row.company_id,
        )
        return CampaignResponse.model_validate(row)

    def approve_campaign(self, ctx: TenantContext, row_id: UUID) -> CampaignResponse:
        row = self._get(ctx, row_id)
        self._engine.approve(row, ctx.user_id)
        row = self._repo.update(
            ctx,
            row_id,
            status=row.status,
            approved_at=row.approved_at,
            approved_by_id=row.approved_by_id,
            rejection_reason=row.rejection_reason,
        )
        self._activity.log(
            ctx,
            entity_type="campaign",
            entity_id=row.id,
            action="approved",
            details="Approved by marketing head",
            company_id=row.company_id,
        )
        return CampaignResponse.model_validate(row)

    def request_campaign_changes(self, ctx: TenantContext, row_id: UUID, reason: str | None = None) -> CampaignResponse:
        row = self._get(ctx, row_id)
        self._engine.request_changes(row, reason)
        row = self._repo.update(
            ctx,
            row_id,
            status=row.status,
            rejection_reason=row.rejection_reason,
        )
        self._activity.log(
            ctx,
            entity_type="campaign",
            entity_id=row.id,
            action="changes_required",
            details=reason or "Changes requested by marketing head",
            company_id=row.company_id,
        )
        return CampaignResponse.model_validate(row)

    def activate_campaign(self, ctx: TenantContext, row_id: UUID) -> CampaignResponse:
        row = self._get(ctx, row_id)
        self._engine.activate(row)
        row = self._repo.update(ctx, row_id, status=row.status, activated_at=row.activated_at)
        self._activity.log(ctx, entity_type="campaign", entity_id=row.id, action="activated", company_id=row.company_id)
        return CampaignResponse.model_validate(row)

    def complete_campaign(self, ctx: TenantContext, row_id: UUID) -> CampaignResponse:
        row = self._get(ctx, row_id)
        self._engine.complete(row)
        row = self._repo.update(ctx, row_id, status=row.status, completed_at=row.completed_at)
        self._activity.log(ctx, entity_type="campaign", entity_id=row.id, action="completed", company_id=row.company_id)
        return CampaignResponse.model_validate(row)

    def cancel_campaign(self, ctx: TenantContext, row_id: UUID) -> CampaignResponse:
        row = self._get(ctx, row_id)
        self._engine.cancel(row)
        row = self._repo.update(ctx, row_id, status=row.status)
        self._activity.log(ctx, entity_type="campaign", entity_id=row.id, action="cancelled", company_id=row.company_id)
        return CampaignResponse.model_validate(row)

    def list_audience(self, ctx: TenantContext, campaign_id: UUID):
        self._get(ctx, campaign_id)
        rows = self._audience.list_for_campaign(ctx, campaign_id)
        return [CampaignAudienceResponse.model_validate(r) for r in rows]

    def add_audience(self, ctx: TenantContext, campaign_id: UUID, **fields):
        row = self._get(ctx, campaign_id)
        aud = self._audience.create(
            ctx,
            company_id=row.company_id,
            campaign_id=campaign_id,
            **fields,
        )
        return CampaignAudienceResponse.model_validate(aud)

    def _get(self, ctx: TenantContext, row_id: UUID) -> MktCampaign:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Campaign not found")
        return row
