"""Analytics port — read-only UUID refs."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext


class PortalAnalyticsAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db

    def resolve_report_ref(self, ctx: TenantContext, bi_report_ref_id: UUID | None) -> UUID | None:
        _ = (ctx, self._db)
        return bi_report_ref_id
