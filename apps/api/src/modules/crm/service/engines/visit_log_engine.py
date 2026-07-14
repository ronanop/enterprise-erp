"""Visit log engine."""

from modules.crm.domain.exceptions import InvalidLeadState
from modules.crm.models import CrmVisitLog


class VisitLogEngine:
    def validate(self, row: CrmVisitLog) -> None:
        if not row.visited_at:
            raise InvalidLeadState("visited_at is required")
