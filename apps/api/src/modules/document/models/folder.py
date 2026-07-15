"""Folder ORM per ERD_18 section 6.1."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.document.models.mixins import DocMasterMixin


class DocFolder(Base, *DocMasterMixin):
    __tablename__ = "doc_folder"
    __table_args__ = (
        UniqueConstraint("company_id", "folder_code", name="uk_doc_folder_code"),
        CheckConstraint(
            "folder_type IN ('system','business','user')",
            name="ck_doc_folder_type",
        ),
        CheckConstraint(
            "status IN ('active','inactive','archived')",
            name="ck_doc_folder_status",
        ),
        {"schema": "document"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    folder_code: Mapped[str] = mapped_column(String(50), nullable=False)
    folder_name: Mapped[str] = mapped_column(String(255), nullable=False)
    parent_folder_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("document.doc_folder.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    folder_type: Mapped[str] = mapped_column(String(30), nullable=False, default="business")

    department_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_department.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    owner_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    path_label: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
