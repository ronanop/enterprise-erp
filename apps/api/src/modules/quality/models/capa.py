"""Quality CAPA ORM models."""

from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.base import Base
from modules.quality.models.mixins import QmTransactionMixin, QmTxnLineMixin


class QmCapa(Base, *QmTransactionMixin):
    __tablename__ = "qm_capa"
    __table_args__ = (
        UniqueConstraint("company_id", "document_number", name="uk_qm_capa_company_number"),
        CheckConstraint(
            "capa_type IN ('corrective','preventive','both')",
            name="ck_qm_capa_type",
        ),
        CheckConstraint(
            "status IN ("
            "'draft','submitted','approved','in_progress','verified','closed','cancelled')",
            name="ck_qm_capa_status",
        ),
        {"schema": "quality"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    document_number: Mapped[str] = mapped_column(String(50), nullable=False)
    document_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    ncr_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("quality.qm_ncr.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    capa_type: Mapped[str] = mapped_column(String(30), nullable=False, default="corrective")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
    workflow_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    workflow_instance_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.wf_instance.id", ondelete="RESTRICT"),
        nullable=True,
    )
    owner_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=True,
    )
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    root_causes: Mapped[list["QmRootCause"]] = relationship(
        back_populates="capa", cascade="all, delete-orphan"
    )
    corrective_actions: Mapped[list["QmCorrectiveAction"]] = relationship(
        back_populates="capa", cascade="all, delete-orphan"
    )
    preventive_actions: Mapped[list["QmPreventiveAction"]] = relationship(
        back_populates="capa", cascade="all, delete-orphan"
    )


class QmRootCause(Base, *QmTxnLineMixin):
    __tablename__ = "qm_root_cause"
    __table_args__ = (
        UniqueConstraint("capa_id", "sequence_no", name="uk_qm_rc_capa_seq"),
        CheckConstraint(
            "method IN ('5_why','fishbone','other')",
            name="ck_qm_rc_method",
        ),
        {"schema": "quality"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    capa_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("quality.qm_capa.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    sequence_no: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    method: Mapped[str] = mapped_column(String(30), nullable=False, default="5_why")
    cause_text: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="open")

    capa: Mapped[QmCapa] = relationship(back_populates="root_causes")


class QmCorrectiveAction(Base, *QmTxnLineMixin):
    __tablename__ = "qm_corrective_action"
    __table_args__ = (
        UniqueConstraint("capa_id", "sequence_no", name="uk_qm_ca_capa_seq"),
        CheckConstraint(
            "status IN ('open','done','verified')",
            name="ck_qm_ca_status",
        ),
        {"schema": "quality"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    capa_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("quality.qm_capa.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    sequence_no: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    action_text: Mapped[str] = mapped_column(Text, nullable=False)
    owner_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=True,
    )
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    verification_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="open")

    capa: Mapped[QmCapa] = relationship(back_populates="corrective_actions")


class QmPreventiveAction(Base, *QmTxnLineMixin):
    __tablename__ = "qm_preventive_action"
    __table_args__ = (
        UniqueConstraint("capa_id", "sequence_no", name="uk_qm_pa_capa_seq"),
        CheckConstraint(
            "status IN ('open','done','verified')",
            name="ck_qm_pa_status",
        ),
        {"schema": "quality"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    capa_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("quality.qm_capa.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    sequence_no: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    action_text: Mapped[str] = mapped_column(Text, nullable=False)
    owner_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=True,
    )
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    verification_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="open")

    capa: Mapped[QmCapa] = relationship(back_populates="preventive_actions")
