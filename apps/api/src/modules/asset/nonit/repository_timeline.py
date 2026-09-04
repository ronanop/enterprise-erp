"""Append-only Non-IT asset timeline repository."""

from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from modules.asset.models import AstNonitAssetTimeline
from modules.asset.repository.base import utcnow
from modules.foundation.domain.value_objects import TenantContext


class NonItTimelineRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def append(
        self,
        ctx: TenantContext,
        *,
        asset_id: UUID,
        event_type: str,
        event_data: dict | None = None,
        remarks: str | None = None,
    ) -> AstNonitAssetTimeline:
        row = AstNonitAssetTimeline(
            id=uuid4(),
            asset_id=asset_id,
            event_type=event_type,
            event_data=event_data,
            occurred_at=utcnow(),
            actor_user_id=ctx.user_id,
            remarks=remarks,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def list_for_asset(
        self, asset_id: UUID
    ) -> list[AstNonitAssetTimeline]:
        from sqlalchemy import select

        stmt = (
            select(AstNonitAssetTimeline)
            .where(AstNonitAssetTimeline.asset_id == asset_id)
            .order_by(AstNonitAssetTimeline.occurred_at.desc())
        )
        return list(self.db.scalars(stmt).all())

    def latest_of_type(
        self, asset_id: UUID, event_type: str
    ) -> AstNonitAssetTimeline | None:
        from sqlalchemy import select

        stmt = (
            select(AstNonitAssetTimeline)
            .where(
                AstNonitAssetTimeline.asset_id == asset_id,
                AstNonitAssetTimeline.event_type == event_type,
            )
            .order_by(AstNonitAssetTimeline.occurred_at.desc())
            .limit(1)
        )
        return self.db.scalar(stmt)
