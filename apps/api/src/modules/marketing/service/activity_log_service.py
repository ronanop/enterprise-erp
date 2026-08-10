"""Marketing activity log service."""

from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.marketing.models.activity_log import MktActivityLog
from modules.marketing.repository.base import utcnow


class ActivityLogService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def log(
        self,
        ctx: TenantContext,
        *,
        entity_type: str,
        entity_id: UUID,
        action: str,
        details: str | None = None,
        metadata: dict | None = None,
        company_id: UUID | None = None,
    ) -> MktActivityLog:
        row = MktActivityLog(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=company_id or ctx.company_id,
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            actor_id=ctx.user_id,
            details=details,
            metadata_json=metadata,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            created_at=utcnow(),
            updated_at=utcnow(),
        )
        self.db.add(row)
        self.db.flush()
        return row
