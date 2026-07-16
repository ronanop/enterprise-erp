"""Device lifecycle engine."""

from modules.portal.domain.enums import (
    DeviceStatus,
)


class DeviceEngine:
    def revoke(self, row) -> None:
        row.status = DeviceStatus.REVOKED.value
