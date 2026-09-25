"""CRM lookup endpoints (shared option lists)."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from modules.crm.adapters.marketing_event_port import MarketingEventPort
from modules.crm.dependencies import get_db
from modules.foundation.dependencies import require_any_permission
from modules.foundation.domain.value_objects import TenantContext
from shared.schemas import APIResponse

lookups_router = APIRouter(prefix="/lookups", tags=["CRM - Lookups"])


@lookups_router.get("/marketing-events", response_model=APIResponse[list[dict[str, str]]])
def list_marketing_events(
    ctx: Annotated[
        TenantContext,
        Depends(
            require_any_permission(
                "crm.company:read",
                "crm.company:create",
                "crm.lead:read",
                "crm.lead:create",
            )
        ),
    ],
    db: Annotated[Session, Depends(get_db)],
):
    """Marketing campaigns with type Event — used when Source / Lead Source is Event."""
    return APIResponse(message="OK", data=MarketingEventPort(db).list_event_options(ctx))
