"""E-Commerce port — optional channel order UUID refs only."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext


class PortalEcommerceAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db

    def resolve_order_ref(self, ctx: TenantContext, ec_order_id: UUID | None) -> UUID | None:
        _ = (ctx, self._db)
        return ec_order_id
