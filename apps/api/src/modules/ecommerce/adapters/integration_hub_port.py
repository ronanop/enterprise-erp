"""Integration Hub port - connector/system UUID refs only."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext


class EcommerceIntegrationHubAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db

    def resolve_connector_ref(self, ctx: TenantContext, int_connector_id: UUID | None) -> UUID | None:
        _ = (ctx, self._db)
        return int_connector_id

    def resolve_external_system_ref(
        self, ctx: TenantContext, int_external_system_id: UUID | None
    ) -> UUID | None:
        _ = (ctx, self._db)
        return int_external_system_id
