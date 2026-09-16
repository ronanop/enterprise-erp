"""Finance event-ref port - Integration Hub NEVER posts.

NEVER uses PostingService. NEVER writes fin_* tables.
UUID / event-ref passthrough stubs only (Finance may publish events into Hub).
"""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext


class IntegrationFinanceEventAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db

    def resolve_event_ref(self, ctx: TenantContext, finance_event_ref_id: UUID | None) -> UUID | None:
        """Read-only UUID passthrough for finance event references."""
        _ = (ctx, self._db)
        return finance_event_ref_id
