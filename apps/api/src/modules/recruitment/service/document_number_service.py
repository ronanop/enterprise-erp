"""Recruitment document numbering — platform SSOT with legacy fallback."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from modules.recruitment.domain.enums import CODE_PREFIXES, RecEntityType
from modules.recruitment.repository.code_sequence_repository import CodeSequenceRepository
from modules.platform.helpers.ssot_numbering import generate_with_ssot


class DocumentNumberService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._seq = CodeSequenceRepository(db)

    def generate(
        self,
        entity: RecEntityType,
        company_id: UUID,
        model,
        code_column: str,
        *,
        tenant_id: UUID | None = None,
        year: int | None = None,
    ) -> str:
        key = getattr(entity, "value", str(entity))
        configured = CODE_PREFIXES.get(entity)
        if configured is not None:
            prefix, pad_width, year_scoped = configured
            if year_scoped:
                use_year = year if year is not None else datetime.now(timezone.utc).year
            else:
                use_year = None
        else:
            prefix, pad_width, use_year = f"{key.upper()[:4]}-", 6, year
        return generate_with_ssot(
            self._db,
            tenant_id=tenant_id,
            company_id=company_id,
            module="recruitment",
            entity_key=key,
            prefix=prefix,
            pad_width=pad_width,
            year=use_year,
            legacy=lambda: self._seq.next_code(entity, company_id, model, code_column),
        )
