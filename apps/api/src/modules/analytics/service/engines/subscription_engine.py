"""Subscription lifecycle engine."""

from modules.analytics.domain.enums import (
    SubscriptionStatus,
)


class SubscriptionEngine:
    def pause(self, row) -> None:
        row.status = SubscriptionStatus.PAUSED.value

    def activate(self, row) -> None:
        row.status = SubscriptionStatus.ACTIVE.value

    def cancel(self, row) -> None:
        row.status = SubscriptionStatus.CANCELLED.value
