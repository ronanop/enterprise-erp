"""Marketing numbering."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.marketing.domain.enums import MktEntityType
from modules.marketing.repository.code_sequence_repository import CodeSequenceRepository


class MarketingNumberService:
    def __init__(self, db: Session) -> None:
        self._seq = CodeSequenceRepository(db)

    def generate(self, entity: MktEntityType, company_id: UUID, model, code_column: str) -> str:
        return self._seq.next_code(entity, company_id, model, code_column)
