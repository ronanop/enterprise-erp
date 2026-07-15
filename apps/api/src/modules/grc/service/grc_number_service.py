"""GRC numbering."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.grc.domain.enums import GrcEntityType
from modules.grc.repository.code_sequence_repository import CodeSequenceRepository


class GrcNumberService:
    def __init__(self, db: Session) -> None:
        self._seq = CodeSequenceRepository(db)

    def generate(self, entity: GrcEntityType, company_id: UUID, model, code_column: str) -> str:
        return self._seq.next_code(entity, company_id, model, code_column)
