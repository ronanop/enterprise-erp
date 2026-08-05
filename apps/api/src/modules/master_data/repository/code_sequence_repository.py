"""Master code sequence repository."""

from uuid import UUID

from sqlalchemy import select
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
        # Include soft-deleted rows: company+code is unique regardless of is_deleted.
        # Use numeric max — lexicographic MAX() breaks zero-padded sequences (e.g. 09 > 10).
        stmt = select(col).where(
            model.company_id == company_id,
            col.like(f"{prefix}%"),
        )
        codes = self.db.scalars(stmt).all()
        prefix_len = len(prefix)
        next_num = 1
        for code in codes:
            if not code or len(code) <= prefix_len:
                continue
            try:
                next_num = max(next_num, int(code[prefix_len:]) + 1)
            except ValueError:
                continue
        return f"{prefix}{str(next_num).zfill(pad_width)}"
