"""Feature flag for asset workflow governance (FP-ASSET-WF-GOV-001)."""

from core.config import settings


def asset_workflow_governance_enabled() -> bool:
    return settings.asset_workflow_governance_enabled
