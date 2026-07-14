"""Quality document number service."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.quality.domain.enums import QmEntityType
from modules.quality.repository.code_sequence_repository import CodeSequenceRepository


class DocumentNumberService:
    def __init__(self, db: Session) -> None:
        self._repo = CodeSequenceRepository(db)

    def generate(
        self,
        entity_type: QmEntityType,
        company_id: UUID,
        *,
        model,
        code_column: str,
        year: int | None = None,
    ) -> str:
        return self._repo.next_code(
            entity_type,
            company_id,
            model=model,
            code_column=code_column,
            year=year,
        )
