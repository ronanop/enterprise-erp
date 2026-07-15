"""Document permission ORM per ERD_18 section 6.7."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.document.models.mixins import DocDetailMixin


class DocDocumentPermission(Base, *DocDetailMixin):
    __tablename__ = "doc_document_permission"
    __table_args__ = (
        CheckConstraint(
            "grantee_type IN ('employee','role','department')",
            name="ck_doc_document_permission_grantee",
        ),
        CheckConstraint(
            "permission_level IN ('view','comment','edit','approve','admin')",
            name="ck_doc_document_permission_level",
        ),
        CheckConstraint("status IN ('active','revoked')", name="ck_doc_document_permission_status"),
        {"schema": "document"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)

    document_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("document.doc_document.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    folder_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("document.doc_folder.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    grantee_type: Mapped[str] = mapped_column(String(30), nullable=False)

    grantee_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    grantee_role_code: Mapped[str | None] = mapped_column(String(80), nullable=True)

    grantee_department_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_department.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    permission_level: Mapped[str] = mapped_column(String(30), nullable=False, default="view")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
