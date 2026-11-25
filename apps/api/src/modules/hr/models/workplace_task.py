"""HR workplace task allocation ORM (ESS company/tenant tasking)."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.hr.models.mixins import HrTransactionMixin


class HrWorkplaceTask(Base, *HrTransactionMixin):
    __tablename__ = "hr_workplace_task"
    __table_args__ = (
        CheckConstraint(
            "status IN ('open','in_progress','completed','cancelled')",
            name="ck_hr_workplace_task_status",
        ),
        CheckConstraint(
            "assignment_mode IN ('users','department')",
            name="ck_hr_workplace_task_assignment_mode",
        ),
        {"schema": "hr"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    creator_employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    deadline: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="open", index=True)
    assignee_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    assignment_mode: Mapped[str] = mapped_column(
        String(20), nullable=False, default="users", index=True
    )
    department_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_department.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )


class HrWorkplaceTaskAssignee(Base, *HrTransactionMixin):
    __tablename__ = "hr_workplace_task_assignee"
    __table_args__ = (
        UniqueConstraint(
            "task_id",
            "employee_id",
            name="uk_hr_workplace_task_assignee",
        ),
        CheckConstraint(
            "status IN ("
            "'assigned','accepted','declined','transferred','started','in_progress',"
            "'pending_verification','redo_requested','completed'"
            ")",
            name="ck_hr_workplace_task_assignee_status",
        ),
        {"schema": "hr"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    task_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("hr.hr_workplace_task.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="assigned", index=True
    )
    responded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    review_note: Mapped[str] = mapped_column(Text, nullable=False, default="")
    submitted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    verified_by_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )


class HrWorkplaceTaskEvent(Base, *HrTransactionMixin):
    """Milestone / audit trail for a task (and optional per-assignee)."""

    __tablename__ = "hr_workplace_task_event"
    __table_args__ = ({"schema": "hr"},)

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    task_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("hr.hr_workplace_task.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    assignee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("hr.hr_workplace_task_assignee.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    actor_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="SET NULL"),
        nullable=True,
    )
    event_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(200), nullable=False)
    detail: Mapped[str] = mapped_column(Text, nullable=False, default="")


class HrWorkplaceTaskProof(Base, *HrTransactionMixin):
    """Proof files submitted by an assignee for verification."""

    __tablename__ = "hr_workplace_task_proof"
    __table_args__ = ({"schema": "hr"},)

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    task_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("hr.hr_workplace_task.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    assignee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("hr.hr_workplace_task_assignee.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    storage_uri: Mapped[str] = mapped_column(String(1000), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    byte_size: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    uploaded_by_employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    note: Mapped[str] = mapped_column(Text, nullable=False, default="")
