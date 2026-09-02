"""Asset domain membership — IT / Non-IT team assignment (per-user, per-domain)."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.asset.models.mixins import AstMasterMixin


class AstDomainMembership(Base, *AstMasterMixin):
    """Who belongs to the IT or Non-IT asset team (admin | member).

    Shape deliberately close to a future sec_user_module-style assignment
    (user + scope + role) so a later foundation merge can migrate cleanly.
    Unique active row per (user_id, domain) via partial index.
    """

    __tablename__ = "ast_domain_membership"
    __table_args__ = (
        CheckConstraint(
            "domain IN ('IT','NON_IT')",
            name="ck_ast_domain_membership_domain",
        ),
        CheckConstraint(
            "role IN ('admin','member')",
            name="ck_ast_domain_membership_role",
        ),
        Index(
            "uq_ast_domain_membership_user_domain_active",
            "user_id",
            "domain",
            unique=True,
            postgresql_where=text("is_deleted = false"),
        ),
        Index("ix_ast_domain_membership_domain", "domain"),
        Index("ix_ast_domain_membership_user_id", "user_id"),
        {"schema": "asset"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.sec_user.id", ondelete="CASCADE"),
        nullable=False,
    )
    domain: Mapped[str] = mapped_column(String(20), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="member")
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    assigned_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
