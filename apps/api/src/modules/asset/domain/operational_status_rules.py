"""CR-004 Phase 2B-1: locked operational status transition rules (pure data)."""

from __future__ import annotations

from modules.asset.domain.enums import AssetOperationalStatus

Ready = AssetOperationalStatus.READY_TO_MOVE.value
Assigned = AssetOperationalStatus.ASSIGNED.value
InMaintenance = AssetOperationalStatus.IN_MAINTENANCE.value
Retired = AssetOperationalStatus.RETIRED.value
Pending = AssetOperationalStatus.PENDING_DISPOSAL.value
Disposed = AssetOperationalStatus.DISPOSED.value
InUseAsComponent = AssetOperationalStatus.IN_USE_AS_COMPONENT.value

# --- Allowed transitions ---
# READY_TO_MOVE → ASSIGNED
# ASSIGNED → READY_TO_MOVE | RETIRED | PENDING_DISPOSAL
# RETIRED → PENDING_DISPOSAL
# PENDING_DISPOSAL → DISPOSED | READY_TO_MOVE
# READY_TO_MOVE → IN_USE_AS_COMPONENT (attach as component)
# IN_USE_AS_COMPONENT → READY_TO_MOVE (detach / parent return)
# IN_USE_AS_COMPONENT → DISPOSED (cascade dispose from component row)
# READY_TO_MOVE → IN_MAINTENANCE (maintenance start)
# IN_MAINTENANCE → READY_TO_MOVE (maintenance complete)

ALLOWED_OPERATIONAL_TRANSITIONS: frozenset[tuple[str, str]] = frozenset(
    {
        (Ready, Assigned),
        (Assigned, Ready),
        (Assigned, Retired),
        (Assigned, Pending),
        (Retired, Pending),
        (Pending, Disposed),
        (Pending, Ready),
        (Ready, InUseAsComponent),
        (InUseAsComponent, Ready),
        (InUseAsComponent, Disposed),
        (Ready, InMaintenance),
        (InMaintenance, Ready),
    }
)

# --- Explicitly blocked (documented; also blocked if not in ALLOWED) ---
BLOCKED_OPERATIONAL_TRANSITIONS: frozenset[tuple[str, str]] = frozenset(
    {
        (Ready, Disposed),
        (Ready, Retired),
        (Retired, Assigned),
        (Retired, Ready),
        (InUseAsComponent, Assigned),
        (InUseAsComponent, Retired),
        (InUseAsComponent, Pending),
    }
)

TERMINAL_OPERATIONAL_STATUSES: frozenset[str] = frozenset({Disposed})

# Semi-terminal: no outbound transitions except Start Disposal (RETIRED → PENDING).
EFFECTIVE_TERMINAL_FOR_ASSIGNMENT: frozenset[str] = frozenset(
    {InMaintenance, Retired, Pending, Disposed, InUseAsComponent}
)

# Ops statuses that block normal maintenance / transfer workflows.
OPS_BLOCKED_FOR_MAINTENANCE_OR_TRANSFER: frozenset[str] = frozenset(
    {InMaintenance, Retired, Pending, Disposed, InUseAsComponent}
)
