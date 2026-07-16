"""Saved search ORM per ERD_23 section 5.16."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.portal.models.mixins import PtRowMixin


class PtSavedSearch(Base, *PtRowMixin):
    __tablename__ = "pt_saved_search"
    __table_args__ = (
        UniqueConstraint("company_id", "saved_search_number", name="uk_pt_saved_search_number"),
        CheckConstraint(
            "entity_type IN ('order','invoice','document','ticket','service_request')",
            name="ck_pt_saved_search_entity_type",
        ),
        CheckConstraint(
            "status IN ('active','archived')",
            name="ck_pt_saved_search_status",
        ),
        Index("ix_pt_saved_search_tenant_co_status", "tenant_id", "company_id", "status"),
        {"schema": "portal"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    saved_search_number: Mapped[str] = mapped_column(String(50), nullable=False)

    portal_account_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "portal.pt_portal_account.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )
    search_name: Mapped[str] = mapped_column(String(255), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(40), nullable=False)
    query_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
