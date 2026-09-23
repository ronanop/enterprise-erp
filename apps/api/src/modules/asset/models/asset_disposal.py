"""Asset disposal ORM per ERD_15 section 6.13."""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.asset.models.mixins import AstTransactionMixin


class AstAssetDisposal(Base, *AstTransactionMixin):
    __tablename__ = "ast_asset_disposal"
    __table_args__ = (
        UniqueConstraint("company_id", "document_number", name="uk_ast_asset_disposal_doc"),
        CheckConstraint(
            "disposal_type IN ('sale','scrap','donation','write_off')",
            name="ck_ast_asset_disposal_type",
        ),
        CheckConstraint(
            "status IN ('draft','submitted','approved','posted','cancelled')",
            name="ck_ast_asset_disposal_status",
        ),
        {"schema": "asset"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    document_number: Mapped[str] = mapped_column(String(50), nullable=False)
    asset_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("asset.ast_asset.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    disposal_type: Mapped[str] = mapped_column(String(40), nullable=False)
    disposal_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    proceeds_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    book_value_at_disposal: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    management_approved: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    ceo_instruction: Mapped[str | None] = mapped_column(Text, nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    previous_operational_status: Mapped[str | None] = mapped_column(String(40), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    approved_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    finance_journal_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)

    workflow_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    workflow_instance_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.wf_instance.id", ondelete="SET NULL"),
        nullable=True,
    )
