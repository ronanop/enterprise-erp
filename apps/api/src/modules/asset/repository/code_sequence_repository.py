"""Asset document number sequence repository."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from modules.asset.domain.enums import CODE_PREFIXES, AstEntityType
from modules.asset.repository.document_sequence_repository import DocumentSequenceRepository
from modules.foundation.domain.value_objects import TenantContext


class CodeSequenceRepository:
    """Legacy scan-max for most entities; atomic sequence for governed asset documents."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self._atomic = DocumentSequenceRepository(db)

    def next_code(
        self,
        entity: AstEntityType,
        company_id: UUID,
        *,
        model,
        code_column: str,
        tenant_id: UUID | None = None,
        ctx: TenantContext | None = None,
    ) -> str:
        if entity in {AstEntityType.ASSET, AstEntityType.TRANSFER}:
            if ctx is None and tenant_id is None:
                raise ValueError("Tenant context required for governed asset numbering")
            resolved_ctx = ctx or TenantContext(
                tenant_id=tenant_id,  # type: ignore[arg-type]
                user_id=UUID(int=0),
                user_type="system",
                company_id=company_id,
                branch_id=None,
            )
            return self._atomic.next_code(resolved_ctx, entity, company_id)

        from datetime import datetime, timezone

        prefix, width, include_year = CODE_PREFIXES[entity]
        year = datetime.now(timezone.utc).year
        full_prefix = f"{prefix}{year}-" if include_year else prefix
        col = getattr(model, code_column)
        stmt = select(func.max(col)).where(
            model.company_id == company_id,
            col.like(f"{full_prefix}%"),
        )
        if hasattr(model, "is_deleted"):
            stmt = stmt.where(model.is_deleted.is_(False))
        last_code = self.db.scalar(stmt)
        seq = 1
        if last_code is not None:
            try:
                seq = int(str(last_code).rsplit("-", 1)[-1]) + 1
            except ValueError:
                seq = 1
        return f"{full_prefix}{seq:0{width}d}"
