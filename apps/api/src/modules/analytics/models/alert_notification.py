"""Alert notification ORM per ERD_20 section 6.15."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.analytics.models.mixins import BiRowMixin


class BiAlertNotification(Base, *BiRowMixin):
    __tablename__ = "bi_alert_notification"
    __table_args__ = (
        CheckConstraint(
            "delivery_status IN ('pending','sent','failed','acknowledged')",
            name="ck_bi_alert_delivery_status",
        ),
        CheckConstraint(
            "status IN ('open','acknowledged','closed')",
            name="ck_bi_alert_notification_status",
        ),
        {"schema": "analytics"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)

    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    alert_rule_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("analytics.bi_alert_rule.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    triggered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    observed_value: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)

    recipient_user_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)

    recipient_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    delivery_status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending")
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="open", index=True)
