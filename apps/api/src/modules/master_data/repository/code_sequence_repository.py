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
        # Include soft-deleted rows: company+code uniqueness is not scoped to is_deleted.
        stmt = select(col).where(
            model.company_id == company_id,
            col.like(f"{prefix}%"),
        )
        codes = self.db.scalars(stmt).all()
        max_num = 0
        for code in codes:
            numeric = str(code).removeprefix(prefix)
            try:
                max_num = max(max_num, int(numeric))
            except ValueError:
                continue
        next_num = max_num + 1 if max_num > 0 else 1
        return f"{prefix}{str(next_num).zfill(pad_width)}"
