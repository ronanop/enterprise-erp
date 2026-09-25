"""CRM → Marketing soft-read adapter for Event source lookups."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext


class MarketingEventPort:
    """List marketing campaigns with campaign_type=event (read-only SQL)."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def list_event_options(self, ctx: TenantContext) -> list[dict[str, str]]:
        try:
            rows = self.db.execute(
                text(
                    """
                    SELECT id::text AS id,
                           campaign_name AS label,
                           campaign_code AS code
                    FROM marketing.mkt_campaign
                    WHERE tenant_id = :tid
                      AND coalesce(is_deleted, false) = false
                      AND lower(campaign_type) = 'event'
                      AND lower(status) <> 'cancelled'
                    ORDER BY campaign_name ASC
                    """
                ),
                {"tid": str(ctx.tenant_id)},
            ).mappings().all()
            return [
                {
                    "id": str(row["id"]),
                    "label": str(row["label"] or row["code"] or "Event"),
                    "code": str(row["code"] or ""),
                }
                for row in rows
            ]
        except Exception:
            # Marketing schema may be unavailable in partial envs.
            return []

    def exists(self, ctx: TenantContext, event_id: UUID) -> bool:
        try:
            row = self.db.execute(
                text(
                    """
                    SELECT 1
                    FROM marketing.mkt_campaign
                    WHERE id = :id
                      AND tenant_id = :tid
                      AND coalesce(is_deleted, false) = false
                      AND lower(campaign_type) = 'event'
                    LIMIT 1
                    """
                ),
                {"id": str(event_id), "tid": str(ctx.tenant_id)},
            ).first()
            return row is not None
        except Exception:
            return False
