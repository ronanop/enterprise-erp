"""Marketing CRM adapter — read-only UUID validation (no cross-module DB writes)."""

from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session


class CrmCampaignPort:
    """Optional soft-link helper for mkt_campaign.crm_campaign_id."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def exists(self, tenant_id: UUID, campaign_id: UUID) -> bool:
        try:
            row = self.db.execute(
                text(
                    """
                    SELECT 1
                    FROM crm.crm_campaign
                    WHERE id = :id
                      AND tenant_id = :tid
                      AND is_deleted = false
                    LIMIT 1
                    """
                ),
                {"id": str(campaign_id), "tid": str(tenant_id)},
            ).first()
            return row is not None
        except Exception:
            # CRM schema may be unavailable in partial envs
            return False
