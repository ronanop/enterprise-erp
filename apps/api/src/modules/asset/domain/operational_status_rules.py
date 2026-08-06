"""CR-004 Phase 2B-1: locked operational status transition rules (pure data)."""

from __future__ import annotations

from modules.asset.domain.enums import AssetOperationalStatus

Ready = AssetOperationalStatus.READY_TO_MOVE.value
Assigned = AssetOperationalStatus.ASSIGNED.value
Retired = AssetOperationalStatus.RETIRED.value
Pending = AssetOperationalStatus.PENDING_DISPOSAL.value
Disposed = AssetOperationalStatus.DISPOSED.value

# --- Allowed transitions (Phase 2B-1 scope) ---
# READY_TO_MOVE → ASSIGNED
# ASSIGNED → READY_TO_MOVE
# ASSIGNED → RETIRED
# ASSIGNED → PENDING_DISPOSAL
# PENDING_DISPOSAL → DISPOSED

ALLOWED_OPERATIONAL_TRANSITIONS: frozenset[tuple[str, str]] = frozenset(
    {
        (Ready, Assigned),
        (Assigned, Ready),
        (Assigned, Retired),
        (Assigned, Pending),
        (Pending, Disposed),
    }
)

# --- Explicitly blocked (documented; also blocked if not in ALLOWED) ---
# READY_TO_MOVE → DISPOSED
# READY_TO_MOVE → RETIRED
# DISPOSED → *
# RETIRED → ASSIGNED
# RETIRED → READY_TO_MOVE

BLOCKED_OPERATIONAL_TRANSITIONS: frozenset[tuple[str, str]] = frozenset(
    {
        (Ready, Disposed),
        (Ready, Retired),
        (Retired, Assigned),
        (Retired, Ready),
    }
)

TERMINAL_OPERATIONAL_STATUSES: frozenset[str] = frozenset({Disposed})

# Semi-terminal: no outbound transitions in Phase 2B-1 allowed set except future phases.
EFFECTIVE_TERMINAL_FOR_ASSIGNMENT: frozenset[str] = frozenset({Retired, Pending, Disposed})
