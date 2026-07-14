"""Call log engine."""

from modules.crm.domain.exceptions import InvalidLeadState
from modules.crm.models import CrmCallLog


class CallLogEngine:
    def validate(self, row: CrmCallLog) -> None:
        if not row.called_at:
            raise InvalidLeadState("called_at is required")
