"""Dashboard widget ORM per ERD_23 section 5.5."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.portal.models.mixins import PtRowMixin


class PtDashboardWidget(Base, *PtRowMixin):
    __tablename__ = "pt_dashboard_widget"
    __table_args__ = (
        CheckConstraint(
            "widget_type IN ('order_summary','invoice_summary','ticket_status','service_status',"
            "'document_list','notification_feed','custom')",
            name="ck_pt_dashboard_widget_type",
        ),
        CheckConstraint(
            "status IN ('active','hidden')",
            name="ck_pt_dashboard_widget_status",
        ),
        {"schema": "portal"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)

    dashboard_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "portal.pt_dashboard.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )
    widget_type: Mapped[str] = mapped_column(String(40), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    config_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    sequence_no: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
