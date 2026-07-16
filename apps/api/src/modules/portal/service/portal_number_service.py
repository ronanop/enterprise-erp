"""Customer Portal numbering."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.portal.domain.enums import PortalEntityType
from modules.portal.repository.code_sequence_repository import CodeSequenceRepository


class PortalNumberService:
    def __init__(self, db: Session) -> None:
        self._seq = CodeSequenceRepository(db)

    def generate(self, entity: PortalEntityType, company_id: UUID, model, code_column: str) -> str:
        return self._seq.next_code(entity, company_id, model, code_column)
