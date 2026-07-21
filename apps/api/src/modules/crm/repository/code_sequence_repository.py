"""CRM document code sequences via foundation patterns."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.crm.domain.enums import CODE_PREFIXES, CrmEntityType


class CodeSequenceRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def next_code(self, entity: CrmEntityType, company_id: UUID, model, code_column: str) -> str:
        prefix, width = CODE_PREFIXES[entity]
        year = datetime.now(timezone.utc).year
        full_prefix = f"{prefix}{year}-"
        # Include soft-deleted rows: the unique constraint on the code column
        # covers every row regardless of is_deleted, so a reused sequence value
        # would collide with a soft-deleted record's number.
        stmt = select(getattr(model, code_column)).where(
            model.company_id == company_id,
            getattr(model, code_column).like(f"{full_prefix}%"),
        )
        existing = list(self.db.scalars(stmt).all())
        seq = 1
        if existing:
            nums = []
            for code in existing:
                try:
                    nums.append(int(str(code).rsplit("-", 1)[-1]))
                except ValueError:
                    continue
            if nums:
                seq = max(nums) + 1
        return f"{full_prefix}{seq:0{width}d}"
