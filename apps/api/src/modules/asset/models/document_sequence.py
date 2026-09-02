"""Atomic document number sequences per ADR-REG-04."""

from uuid import UUID, uuid4

from sqlalchemy import BigInteger, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base


class AstDocumentSequence(Base):
    __tablename__ = "ast_document_sequence"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            "company_id",
            "sequence_key",
            name="uk_ast_document_sequence_key",
        ),
        {"schema": "asset"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False, index=True)
    company_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False, index=True)
    sequence_key: Mapped[str] = mapped_column(String(32), nullable=False)
    next_value: Mapped[int] = mapped_column(BigInteger, nullable=False, default=1)
