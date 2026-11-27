"""Project document code sequences."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.project.domain.enums import CODE_PREFIXES, PrjEntityType


class CodeSequenceRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def next_code(self, entity: PrjEntityType, company_id: UUID, model, code_column: str) -> str:
        """Allocate the next document code for a company.

        Include soft-deleted rows — ``uk_*_company_code`` is not partial, so
        deleted codes still block inserts (PO-queue create-cloud-project 409).
        """
        prefix, width, include_year = CODE_PREFIXES[entity]
        year = datetime.now(timezone.utc).year
        full_prefix = f"{prefix}{year}-" if include_year else prefix
        col = getattr(model, code_column)
        stmt = select(col).where(
            model.company_id == company_id,
            col.like(f"{full_prefix}%"),
        )
        existing = list(self.db.scalars(stmt).all())
        seq = 1
        if existing:
            nums = []
            for code in existing:
                # Soft-deleted seed rows may be renamed to ``CODE~hex`` — use the
                # numeric segment before any tombstone suffix.
                raw = str(code).split("~", 1)[0]
                try:
                    nums.append(int(raw.rsplit("-", 1)[-1]))
                except ValueError:
                    continue
            if nums:
                seq = max(nums) + 1
        return f"{full_prefix}{seq:0{width}d}"
