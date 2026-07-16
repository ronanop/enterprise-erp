"""CRM port — UUID-only stubs; no crm_* FK / ORM writes."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext


class PortalCrmAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db

    def resolve_party_ref(self, ctx: TenantContext, crm_party_ref_id: UUID | None) -> UUID | None:
        _ = (ctx, self._db)
        return crm_party_ref_id
