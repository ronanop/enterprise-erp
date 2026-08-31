"""SCM adapter for DC challan outbound requests and status pushes.

This phase is log-only — no HTTP to Procurement/SCM. Branch/company on the
challan row is pinned at create and is not rewritten if the asset later transfers.
"""

from __future__ import annotations

import logging
from datetime import datetime
from uuid import UUID

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class AssetScmAdapter:
    """Outbound DC request port. Injection style matches ProcurementReadPort."""

    def __init__(self, db: Session) -> None:
        self._db = db

    def send_dc_request(
        self,
        *,
        dc_challan_id: UUID,
        dc_number: str,
        asset_snapshot: dict,
        employee_snapshot: dict,
        requested_by: UUID | None,
        callback_url: str,
    ) -> None:
        logger.info(
            "SCM DC request (no-op): dc_number=%s dc_challan_id=%s callback_url=%s "
            "asset=%s employee=%s requested_by=%s",
            dc_number,
            dc_challan_id,
            callback_url,
            asset_snapshot,
            employee_snapshot,
            requested_by,
        )

    def push_status_update(
        self,
        *,
        dc_challan_id: UUID,
        dc_number: str,
        status: str,
        timestamp: datetime,
        signed_document: dict | None = None,
    ) -> None:
        payload = {
            "dc_number": dc_number,
            "dc_challan_id": str(dc_challan_id),
            "status": status,
            "timestamp": timestamp.isoformat(),
            "signed_document": signed_document,
        }
        logger.info("SCM DC status update (no-op): %s", payload)
