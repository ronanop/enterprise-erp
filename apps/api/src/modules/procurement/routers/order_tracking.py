"""Unauthenticated customer order tracking.

Mounted under ``/api/v1/public`` so a customer can check their own order with
the PO number they raised plus the email registered against their account. The
response carries milestones only - never prices, vendors, or internal numbers.
"""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database.session import get_db
from modules.procurement.schemas import OrderTrackingRequest, OrderTrackingResponse
from modules.procurement.service.order_tracking_service import OrderTrackingService
from security.public_routes import optional_authentication
from shared.schemas import APIResponse

public_order_tracking_router = APIRouter(
    prefix="/public/order-tracking",
    tags=["Public - Order Tracking"],
)


@public_order_tracking_router.post("", response_model=APIResponse[OrderTrackingResponse])
def track_order(
    body: OrderTrackingRequest,
    db: Annotated[Session, Depends(get_db)],
    _public: Annotated[None, Depends(optional_authentication)],
) -> APIResponse[OrderTrackingResponse]:
    row = OrderTrackingService(db).track(
        order_number=body.order_number,
        email=body.email,
    )
    return APIResponse(
        message="Order status retrieved",
        data=OrderTrackingResponse.model_validate(row),
    )
