"""My Jobs — team-routed approval tasks raised by the sales blueprint."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, DateTime, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.crm.models.mixins import CrmDetailMixin


class CrmApprovalTask(Base, *CrmDetailMixin):
    __tablename__ = "crm_approval_task"
    __table_args__ = (
        UniqueConstraint("company_id", "task_code", name="uk_crm_approval_task_company_code"),
        CheckConstraint(
            "team_role IN ('presales','project','management','accounts','scm')",
            name="ck_crm_approval_task_team_role",
        ),
        CheckConstraint(
            "status IN ('pending','approved','rejected','cancelled')",
            name="ck_crm_approval_task_status",
        ),
        {"schema": "crm"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    task_code: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    entity_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False, index=True)
    team_role: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    assigned_role: Mapped[str | None] = mapped_column(String(50), nullable=True)
    assigned_user_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", index=True)
    requested_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    decision_remark: Mapped[str | None] = mapped_column(Text, nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    decided_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    priority: Mapped[str] = mapped_column(String(20), nullable=False, default="normal")
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notification_sent: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    action: Mapped[str | None] = mapped_column(String(50), nullable=True)
