"""Atomic asset code sequences (SELECT FOR UPDATE) per ADR-REG-04."""

from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from modules.asset.domain.enums import CODE_PREFIXES, AstEntityType
from modules.asset.models.document_sequence import AstDocumentSequence
from modules.foundation.domain.value_objects import TenantContext


class DocumentSequenceRepository:
    _MAX_CREATE_ATTEMPTS = 8

    def __init__(self, db: Session) -> None:
        self.db = db

    def _segment_key(self, entity: AstEntityType, year: int | None = None) -> tuple[str, int, str]:
        prefix, width, include_year = CODE_PREFIXES[entity]
        if year is None:
            year = datetime.now(timezone.utc).year
        if include_year:
            sequence_key = f"{prefix.rstrip('-')}-{year}"
            full_prefix = f"{sequence_key}-"
        else:
            sequence_key = prefix.rstrip("-")
            full_prefix = prefix
        return full_prefix, width, sequence_key

    def _select_for_update(
        self, tenant_id: UUID, company_id: UUID, sequence_key: str
    ) -> AstDocumentSequence | None:
        stmt = (
            select(AstDocumentSequence)
            .where(
                AstDocumentSequence.tenant_id == tenant_id,
                AstDocumentSequence.company_id == company_id,
                AstDocumentSequence.sequence_key == sequence_key,
            )
            .with_for_update()
        )
        return self.db.scalar(stmt)

    def next_code(
        self,
        ctx: TenantContext,
        entity: AstEntityType,
        company_id: UUID,
    ) -> str:
        full_prefix, width, sequence_key = self._segment_key(entity)
        row = self._lock_or_create(ctx.tenant_id, company_id, sequence_key)
        allocated = int(row.next_value)
        row.next_value = allocated + 1
        self.db.flush()
        return f"{full_prefix}{allocated:0{width}d}"

    def reserve_block(
        self,
        ctx: TenantContext,
        entity: AstEntityType,
        company_id: UUID,
        count: int,
    ) -> list[str]:
        if count < 1:
            return []
        full_prefix, width, sequence_key = self._segment_key(entity)
        row = self._lock_or_create(ctx.tenant_id, company_id, sequence_key)
        start = int(row.next_value)
        row.next_value = start + count
        self.db.flush()
        return [f"{full_prefix}{n:0{width}d}" for n in range(start, start + count)]

    def _lock_or_create(
        self, tenant_id: UUID, company_id: UUID, sequence_key: str
    ) -> AstDocumentSequence:
        for _ in range(self._MAX_CREATE_ATTEMPTS):
            row = self._select_for_update(tenant_id, company_id, sequence_key)
            if row is not None:
                return row
            try:
                with self.db.begin_nested():
                    self.db.add(
                        AstDocumentSequence(
                            id=uuid4(),
                            tenant_id=tenant_id,
                            company_id=company_id,
                            sequence_key=sequence_key,
                            next_value=1,
                        )
                    )
                    self.db.flush()
            except IntegrityError:
                continue
            row = self._select_for_update(tenant_id, company_id, sequence_key)
            if row is not None:
                return row
        raise RuntimeError("Failed to lock document sequence after concurrent create attempts")
