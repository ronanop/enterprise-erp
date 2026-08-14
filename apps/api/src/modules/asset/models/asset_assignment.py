"""Asset assignment ORM per ERD_15 section 6.4."""

from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.asset.models.mixins import AstTransactionMixin


class AstAssetAssignment(Base, *AstTransactionMixin):
    __tablename__ = "ast_asset_assignment"
    __table_args__ = (
        UniqueConstraint("company_id", "document_number", name="uk_ast_asset_assignment_doc"),
        CheckConstraint(
            "allocation_type IN ('employee','department','project','branch','warehouse')",
            name="ck_ast_asset_assignment_alloc",
        ),
        CheckConstraint(
            "status IN ('draft','submitted','approved','active','returned','cancelled')",
            name="ck_ast_asset_assignment_status",
        ),
        CheckConstraint(
            "delivery_reference_status IN ('not_applicable','pending','issued','received')",
            name="ck_ast_asset_assignment_delivery_reference_status",
        ),
        CheckConstraint(
            "delivery_challan_signature_status IN ('not_signed','signed')",
            name="ck_ast_asset_assignment_dc_signature_status",
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
    allocation_type: Mapped[str] = mapped_column(String(40), nullable=False)
    employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    department_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_department.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    project_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    allocated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expected_return_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    returned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)

    workflow_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    workflow_instance_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.wf_instance.id", ondelete="SET NULL"),
        nullable=True,
    )

    delivery_reference_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    delivery_reference_status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="not_applicable",
    )
    delivery_challan_signature_status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="not_signed",
    )
    assignment_remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    return_remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
