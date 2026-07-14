"""Email log engine."""

from modules.crm.domain.exceptions import InvalidLeadState
from modules.crm.models import CrmEmailLog


class EmailLogEngine:
    def validate(self, row: CrmEmailLog) -> None:
        if not row.sent_at:
            raise InvalidLeadState("sent_at is required")
