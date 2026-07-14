"""Customer satisfaction engine."""

from modules.crm.domain.enums import PublishStatus
from modules.crm.domain.exceptions import InvalidSatisfactionState
from modules.crm.models import CrmCustomerSatisfaction


class CustomerSatisfactionEngine:
    def validate_publishable(self, row: CrmCustomerSatisfaction) -> None:
        if row.status != PublishStatus.DRAFT.value:
            raise InvalidSatisfactionState("Only draft satisfaction scores can be published")

    def publish(self, row: CrmCustomerSatisfaction) -> None:
        self.validate_publishable(row)
        row.status = PublishStatus.PUBLISHED.value
