"""Integration Hub port — connector UUID refs only."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext


class PortalIntegrationAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db

    def resolve_connector_ref(self, ctx: TenantContext, int_connector_id: UUID | None) -> UUID | None:
        _ = (ctx, self._db)
        return int_connector_id
