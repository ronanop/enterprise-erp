"""CRM read port for SCM queue / OVF → vendor PO handoff."""

from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from modules.crm.service.ovf_service import OvfService
from modules.foundation.domain.value_objects import TenantContext


class ProcurementCrmAdapter:
    """Reads CRM OVF handoff DTOs — does not write crm_* tables."""

    def __init__(self, db: Session) -> None:
        self._ovfs = OvfService(db)

    def list_shared_ovfs(self, ctx: TenantContext, company_id: UUID | None = None) -> list[Any]:
        return self._ovfs.list_shared_for_scm(ctx, company_id)

    def get_handoff(self, ctx: TenantContext, ovf_id: UUID) -> dict[str, Any]:
        return self._ovfs.get_scm_handoff(ctx, ovf_id)
