"""Finance read port — analytical consumption ONLY.

NEVER uses PostingService. NEVER writes fin_* tables.
UUID / context resolution stubs only.
"""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext


class AnalyticsFinanceReadAdapter:
    def __init__(self, db: Session) -> None:
        self._db = db

    def resolve_ledger_ref(self, ctx: TenantContext, ledger_ref_id: UUID | None) -> UUID | None:
        """Read-only UUID passthrough for analytical ledger context."""
        _ = (ctx, self._db)
        return ledger_ref_id
