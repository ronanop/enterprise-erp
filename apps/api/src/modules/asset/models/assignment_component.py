"""Assignment ↔ component custody lines (Sub-phase 4C).

ast_asset_component holds component master state.
ast_assignment_component holds per-assignment custody/history.
A component may have many historical rows but at most one active ISSUED row.
"""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.asset.models.mixins import AstDetailMixin


class AstAssignmentComponent(Base, *AstDetailMixin):
    __tablename__ = "ast_assignment_component"
    __table_args__ = (
        CheckConstraint(
            "issue_status IN ('ISSUED','RETURNED','MISSING','DAMAGED','RETAINED')",
            name="ck_ast_assignment_component_issue_status",
        ),
        Index(
            "uq_ast_assignment_component_active_issue",
            "component_id",
            unique=True,
            postgresql_where=text("issue_status = 'ISSUED' AND is_deleted = false"),
        ),
        Index(
            "ix_ast_assignment_component_assignment_id",
            "assignment_id",
        ),
        Index(
            "ix_ast_assignment_component_component_id",
            "component_id",
        ),
        {"schema": "asset"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)

    assignment_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("asset.ast_asset_assignment.id", ondelete="RESTRICT"),
        nullable=False,
    )
    component_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("asset.ast_asset_component.id", ondelete="RESTRICT"),
        nullable=False,
    )
    issue_status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="ISSUED", index=True
    )
    issued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    returned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    return_condition: Mapped[str | None] = mapped_column(String(30), nullable=True)
    return_remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
