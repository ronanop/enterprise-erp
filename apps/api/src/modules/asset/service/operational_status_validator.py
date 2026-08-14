"""Operational status validation (CR-004 Phase 2B-1). No persistence."""

from __future__ import annotations

from modules.asset.domain.enums import ASSET_OPERATIONAL_STATUS_VALUES
from modules.asset.domain.operational_status_exceptions import (
    InvalidOperationalAction,
    UnknownOperationalStatus,
)
from modules.asset.domain.operational_status_rules import (
    Assigned,
    Disposed,
    Pending,
    Ready,
    Retired,
)
from modules.asset.service.engines.asset_operational_status_engine import AssetOperationalStatusEngine

# Named business actions → expected target from allowed source states (Phase 2B-1).
_ACTION_TARGETS: dict[str, str] = {
    "assign": Assigned,
    "return_to_ready": Ready,
    "retire": Retired,
    "mark_pending_disposal": Pending,
    "start_disposal": Pending,
    "reinstate": Ready,
    "complete_disposal": Disposed,
}


class OperationalStatusValidator:
    def __init__(self, engine: AssetOperationalStatusEngine | None = None) -> None:
        self._engine = engine or AssetOperationalStatusEngine()

    @property
    def engine(self) -> AssetOperationalStatusEngine:
        return self._engine

    def validate_known_status(self, status: str | None) -> str:
        return self._engine.assert_known_status(status)

    def validate_target_status(self, target: str) -> str:
        if target not in ASSET_OPERATIONAL_STATUS_VALUES:
            raise UnknownOperationalStatus(f"Unknown target operational_status: {target!r}")
        return target

    def validate_transition(self, current: str | None, target: str) -> None:
        self.validate_target_status(target)
        self._engine.assert_transition(current, target)

    def resolve_action_target(self, action: str) -> str:
        key = (action or "").strip().lower()
        target = _ACTION_TARGETS.get(key)
        if target is None:
            raise InvalidOperationalAction(f"Unknown operational action: {action!r}")
        return target

    def validate_action(self, current: str | None, action: str) -> str:
        """Validate action name and that current → action target is allowed."""
        target = self.resolve_action_target(action)
        self.validate_transition(current, target)
        return target
