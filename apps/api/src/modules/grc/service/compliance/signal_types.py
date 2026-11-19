"""Compliance signal result types."""

from dataclasses import dataclass
from typing import Any, Literal

ComplianceSignalStatus = Literal["compliant", "partially_compliant", "non_compliant", "unknown"]


@dataclass(frozen=True)
class ComplianceSignalResult:
    requirement_code: str
    status: ComplianceSignalStatus
    summary: str
    details: dict[str, Any] | None = None
