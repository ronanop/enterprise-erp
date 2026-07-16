"""Customer profile ORM per ERD_23 section 5.2."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.portal.models.mixins import PtRowMixin


class PtCustomerProfile(Base, *PtRowMixin):
    __tablename__ = "pt_customer_profile"
    __table_args__ = (
        UniqueConstraint("company_id", "profile_number", name="uk_pt_customer_profile_number"),
        CheckConstraint(
            "status IN ('draft','submitted','approved','active','inactive')",
            name="ck_pt_customer_profile_status",
        ),
        Index("ix_pt_customer_profile_tenant_co_status", "tenant_id", "company_id", "status"),
        {"schema": "portal"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    profile_number: Mapped[str] = mapped_column(String(50), nullable=False)

    customer_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_customer.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    preferred_language: Mapped[str | None] = mapped_column(String(16), nullable=True)
    timezone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    billing_contact_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    shipping_contact_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    crm_party_ref_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)

    workflow_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    workflow_instance_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.wf_instance.id", ondelete="SET NULL"),
        nullable=True,
    )
