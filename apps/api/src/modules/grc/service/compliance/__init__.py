"""GRC compliance automation — signal registry and monitors."""

from modules.grc.service.compliance.signal_registry import ComplianceSignalRegistry
from modules.grc.service.compliance.signal_types import ComplianceSignalResult

__all__ = ["ComplianceSignalRegistry", "ComplianceSignalResult"]
