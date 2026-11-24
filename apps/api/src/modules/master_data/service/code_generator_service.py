"""Master code generator service."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.master_data.domain.enums import MasterEntityType
from modules.master_data.repository.code_sequence_repository import CodeSequenceRepository


class CodeGeneratorService:
    def __init__(self, db: Session) -> None:
        self._repo = CodeSequenceRepository(db)

    def generate(
        self,
        entity_type: MasterEntityType,
        company_id: UUID,
        *,
        model,
        code_column: str,
        prefix: str | None = None,
        pad_width: int | None = None,
    ) -> str:
        return self._repo.next_code(
            entity_type,
            company_id,
            model=model,
            code_column=code_column,
            prefix=prefix,
            pad_width=pad_width,
        )
