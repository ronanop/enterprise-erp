"""PortalSession lifecycle engine."""

from modules.portal.domain.enums import (
    PortalSessionStatus,
)


class PortalSessionEngine:
    def expire(self, row) -> None:
        row.status = PortalSessionStatus.EXPIRED.value

    def revoke(self, row) -> None:
        row.status = PortalSessionStatus.REVOKED.value
