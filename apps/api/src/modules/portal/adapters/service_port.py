"""Service port — UUID-only stubs; no svc_* FK / ORM writes."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext


class PortalServiceAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db

    def resolve_request_ref(self, ctx: TenantContext, service_request_id: UUID | None) -> UUID | None:
        _ = (ctx, self._db)
        return service_request_id
