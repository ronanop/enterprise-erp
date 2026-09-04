"""Child document rows for a delivery challan (stored file or legacy URL)."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    text,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.asset.models.mixins import AstDetailMixin

_ACTIVE_DOC_SQL = "is_deleted = false"


class AstDcChallanDocument(Base, *AstDetailMixin):
    """One active row per (dc_challan_id, doc_kind). Re-upload soft-deletes the previous row."""

    __tablename__ = "ast_dc_challan_document"
    __table_args__ = (
        CheckConstraint(
            "doc_kind IN ('SCM_ISSUED','SIGNED')",
            name="ck_ast_dc_challan_document_kind",
        ),
        CheckConstraint(
            "source IN ('SCM_CALLBACK','MANUAL_UPLOAD')",
            name="ck_ast_dc_challan_document_source",
        ),
        CheckConstraint(
            "storage_key IS NOT NULL OR external_url IS NOT NULL",
            name="ck_ast_dc_challan_document_locator",
        ),
        Index("ix_ast_dc_challan_document_challan", "dc_challan_id"),
        Index(
            "uq_ast_dc_challan_document_one_active_kind",
            "dc_challan_id",
            "doc_kind",
            unique=True,
            postgresql_where=text(_ACTIVE_DOC_SQL),
        ),
        {"schema": "asset"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    dc_challan_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("asset.ast_dc_challan.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    doc_kind: Mapped[str] = mapped_column(String(30), nullable=False)
    storage_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    external_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    original_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    content_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    file_size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    checksum_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    source: Mapped[str] = mapped_column(String(30), nullable=False)
    uploaded_by_user_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.sec_user.id", ondelete="SET NULL"),
        nullable=True,
    )
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
