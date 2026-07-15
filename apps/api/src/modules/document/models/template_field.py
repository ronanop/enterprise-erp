"""Template field ORM per ERD_18 section 6.16."""

from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.document.models.mixins import DocDetailMixin


class DocTemplateField(Base, *DocDetailMixin):
    __tablename__ = "doc_template_field"
    __table_args__ = (
        UniqueConstraint("template_id", "field_code", name="uk_doc_template_field_code"),
        CheckConstraint(
            "field_type IN ('text','number','date','boolean','list')",
            name="ck_doc_template_field_type",
        ),
        CheckConstraint("status IN ('active','inactive')", name="ck_doc_template_field_status"),
        {"schema": "document"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    template_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("document.doc_template.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    field_code: Mapped[str] = mapped_column(String(80), nullable=False)
    field_label: Mapped[str] = mapped_column(String(255), nullable=False)
    field_type: Mapped[str] = mapped_column(String(30), nullable=False, default="text")
    is_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    default_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    sequence_no: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
