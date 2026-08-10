"""Marketing channel service."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.marketing.models.channel import MktChannel
from modules.marketing.repository.marketing_repository import ChannelRepository
from modules.marketing.schemas import ChannelResponse
from modules.marketing.service.marketing_scope_validator import MarketingScopeValidator


class ChannelService:
    def __init__(self, db: Session) -> None:
        self._repo = ChannelRepository(db)
        self._scope = MarketingScopeValidator(db)

    def list_channels(self, ctx: TenantContext, *, company_id: UUID | None = None, platform: str | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        rows = self._repo.list_rows(ctx, cid, platform=platform)
        return [ChannelResponse.model_validate(r) for r in rows]

    def get_channel(self, ctx: TenantContext, row_id: UUID) -> ChannelResponse:
        row = self._get(ctx, row_id)
        return ChannelResponse.model_validate(row)

    def create_channel(self, ctx: TenantContext, company_id: UUID | None = None, **fields) -> ChannelResponse:
        cid = self._scope.resolve_company_id(ctx, company_id)
        row = self._repo.create(ctx, company_id=cid, **fields)
        return ChannelResponse.model_validate(row)

    def update_channel(self, ctx: TenantContext, row_id: UUID, **fields) -> ChannelResponse:
        self._get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("Channel not found")
        return ChannelResponse.model_validate(row)

    def _get(self, ctx: TenantContext, row_id: UUID) -> MktChannel:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Channel not found")
        return row
