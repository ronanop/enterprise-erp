"""IT Asset Location Master (city / site) — not Organization org_location."""

from uuid import UUID, uuid4

from sqlalchemy import Boolean, ForeignKey, Index, String, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.asset.models.mixins import AstMasterMixin


class AstLocation(Base, *AstMasterMixin):
    __tablename__ = "ast_location"
    __table_args__ = (
        Index(
            "uq_ast_location_one_head_office_per_company",
            "company_id",
            unique=True,
            postgresql_where=text("is_head_office = true AND is_deleted = false"),
        ),
        {"schema": "asset"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_head_office: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    org_location_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_location.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
