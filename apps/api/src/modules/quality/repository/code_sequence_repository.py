"""Quality document number sequence repository."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from modules.quality.domain.enums import CODE_PREFIXES, QmEntityType


class CodeSequenceRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def next_code(
        self,
        entity_type: QmEntityType,
        company_id: UUID,
        *,
        model,
        code_column: str,
        year: int | None = None,
    ) -> str:
        code_prefix, pad_width = CODE_PREFIXES[entity_type]
        if year is None:
            year = datetime.now(timezone.utc).year
        prefix = f"{code_prefix.rstrip('-')}-{year}-"
        col = getattr(model, code_column)
        stmt = select(func.max(col)).where(model.company_id == company_id, col.like(f"{prefix}%"))
        if hasattr(model, "is_deleted"):
            stmt = stmt.where(model.is_deleted.is_(False))
        last_code = self.db.scalar(stmt)
        if last_code is None:
            next_num = 1
        else:
            numeric = str(last_code).removeprefix(prefix)
            try:
                next_num = int(numeric) + 1
            except ValueError:
                next_num = 1
        return f"{prefix}{str(next_num).zfill(pad_width)}"
