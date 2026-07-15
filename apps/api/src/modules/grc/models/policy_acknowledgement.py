"""Policy acknowledgement ORM per ERD_19 section 6.3."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.grc.models.mixins import GrcDetailMixin


class GrcPolicyAcknowledgement(Base, *GrcDetailMixin):
    __tablename__ = "grc_policy_acknowledgement"
    __table_args__ = (
        UniqueConstraint(
            "policy_id", "employee_id", "policy_version_id",
            name="uk_grc_policy_acknowledgement",
        ),
        CheckConstraint(
            "acknowledgement_method IN ('portal','email','training','paper')",
            name="ck_grc_policy_ack_method",
        ),
        CheckConstraint(
            "status IN ('pending','acknowledged','overdue','waived')",
            name="ck_grc_policy_ack_status",
        ),
        {"schema": "grc"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    policy_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("grc.grc_policy.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    policy_version_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("grc.grc_policy_version.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    acknowledgement_method: Mapped[str | None] = mapped_column(String(30), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending", index=True)
