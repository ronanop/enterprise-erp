"""Sales port - order-of-record via service; UUID refs only."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext


class EcommerceSalesAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db

    def resolve_sales_order_ref(self, ctx: TenantContext, sales_order_id: UUID | None) -> UUID | None:
        _ = (ctx, self._db)
        return sales_order_id
