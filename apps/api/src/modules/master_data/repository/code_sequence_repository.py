"""Master code sequence repository."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from modules.master_data.domain.enums import CODE_PREFIXES, MasterEntityType


class CodeSequenceRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def next_code(
        self,
        entity_type: MasterEntityType,
        company_id: UUID,
        *,
        model,
        code_column: str,
    ) -> str:
        prefix, pad_width = CODE_PREFIXES[entity_type]
        col = getattr(model, code_column)
        stmt = select(func.max(col)).where(
            model.company_id == company_id,
            model.is_deleted.is_(False),
            col.like(f"{prefix}%"),
        )
        last_code = self.db.scalar(stmt)
        if last_code is None:
            next_num = 1
        else:
            numeric = last_code.replace(prefix, "", 1)
            try:
                next_num = int(numeric) + 1
            except ValueError:
                next_num = 1
        return f"{prefix}{str(next_num).zfill(pad_width)}"
