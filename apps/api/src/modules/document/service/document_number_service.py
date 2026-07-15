"""Document numbering."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.document.domain.enums import DocEntityType
from modules.document.repository.code_sequence_repository import CodeSequenceRepository


class DocumentNumberService:
    def __init__(self, db: Session) -> None:
        self._seq = CodeSequenceRepository(db)

    def generate(self, entity: DocEntityType, company_id: UUID, model, code_column: str) -> str:
        return self._seq.next_code(entity, company_id, model, code_column)
