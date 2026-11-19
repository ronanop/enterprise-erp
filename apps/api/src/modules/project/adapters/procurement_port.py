"""Procurement port — read purchase orders for PO → project pipeline."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.procurement.schemas import OrderResponse
from modules.procurement.service.order_service import OrderService


class ProjectProcurementAdapter:
    def __init__(self, db: Session) -> None:
        self._orders = OrderService(db)

    def list_order_responses(
        self,
        ctx: TenantContext,
        company_id: UUID | None = None,
        *,
        enrich_commercial: bool = False,
    ) -> list[OrderResponse]:
        return self._orders.list_order_responses(
            ctx, company_id, enrich_commercial=enrich_commercial
        )

    def get_order_response(
        self,
        ctx: TenantContext,
        order_id: UUID,
        *,
        enrich_commercial: bool = False,
    ) -> OrderResponse:
        return self._orders.get_order_response(
            ctx, order_id, enrich_commercial=enrich_commercial
        )
