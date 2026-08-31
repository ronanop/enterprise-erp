"""Asset document numbering."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.asset.domain.enums import AstEntityType
from modules.asset.repository.code_sequence_repository import CodeSequenceRepository
from modules.foundation.domain.value_objects import TenantContext


class DocumentNumberService:
    def __init__(self, db: Session) -> None:
        self._seq = CodeSequenceRepository(db)

    def generate(
        self,
        entity: AstEntityType,
        company_id: UUID,
        model,
        code_column: str,
        *,
        ctx: TenantContext,
    ) -> str:
        return self._seq.next_code(
            entity,
            company_id,
            model=model,
            code_column=code_column,
            ctx=ctx,
        )
