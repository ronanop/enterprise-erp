"""Inventory port - stock authority via services/events; UUID refs only."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext


class EcommerceInventoryAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db

    def resolve_inventory_item_ref(
        self, ctx: TenantContext, inventory_item_ref_id: UUID | None
    ) -> UUID | None:
        _ = (ctx, self._db)
        return inventory_item_ref_id
