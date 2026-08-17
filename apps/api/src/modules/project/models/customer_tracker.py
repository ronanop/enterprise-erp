"""Versioned customer tracker files for a project."""

from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.project.models.mixins import PrjTransactionMixin


class PrjCustomerTracker(Base, *PrjTransactionMixin):
    __tablename__ = "prj_customer_tracker"
    __table_args__ = (
        UniqueConstraint("project_id", "version_no", name="uq_prj_customer_tracker_version"),
        {"schema": "project"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    project_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("project.prj_project.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    version_no: Mapped[int] = mapped_column(Integer, nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_uri: Mapped[str] = mapped_column(String(500), nullable=False)
    content_type: Mapped[str | None] = mapped_column(String(255), nullable=True)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    content_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
