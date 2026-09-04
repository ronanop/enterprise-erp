"""AssetOperationalStatus transition engine (CR-004 Phase 2B-1).

Pure business rules — no database, HTTP, or repository access.
"""

from __future__ import annotations

from modules.asset.domain.enums import ASSET_OPERATIONAL_STATUS_VALUES, AssetOperationalStatus
from modules.asset.domain.operational_status_exceptions import (
    InvalidTransition,
    TerminalState,
    UnknownOperationalStatus,
)
from modules.asset.domain.operational_status_rules import (
    ALLOWED_OPERATIONAL_TRANSITIONS,
    BLOCKED_OPERATIONAL_TRANSITIONS,
    TERMINAL_OPERATIONAL_STATUSES,
)


class AssetOperationalStatusEngine:
    """Validates and resolves operational status transitions."""

    def assert_known_status(self, status: str | None, *, field: str = "operational_status") -> str:
        if status is None:
            raise UnknownOperationalStatus(f"{field} is not set")
        if status not in ASSET_OPERATIONAL_STATUS_VALUES:
            raise UnknownOperationalStatus(f"Unknown {field}: {status!r}")
        return status

    def is_allowed(self, current: str, target: str) -> bool:
        return (current, target) in ALLOWED_OPERATIONAL_TRANSITIONS

    def assert_transition(self, current: str | None, target: str) -> None:
        """Reject invalid transitions and terminal-state mutations."""
        current_norm = self.assert_known_status(current, field="current operational_status")
        target_norm = self.assert_known_status(target, field="target operational_status")

        if current_norm == target_norm:
            raise InvalidTransition(
                f"Operational status is already {current_norm!r}; transition is not required"
            )

        if current_norm in TERMINAL_OPERATIONAL_STATUSES:
            raise TerminalState(
                f"Cannot change operational status from terminal state {current_norm!r}"
            )

        edge = (current_norm, target_norm)
        if edge in BLOCKED_OPERATIONAL_TRANSITIONS:
            raise InvalidTransition(
                f"Transition {current_norm!r} → {target_norm!r} is not permitted"
            )

        if edge not in ALLOWED_OPERATIONAL_TRANSITIONS:
            raise InvalidTransition(
                f"Transition {current_norm!r} → {target_norm!r} is not allowed"
            )

    def resolve_transition(self, current: str | None, target: str) -> str:
        """Validate and return the target status value."""
        self.assert_transition(current, target)
        return AssetOperationalStatus(target).value
