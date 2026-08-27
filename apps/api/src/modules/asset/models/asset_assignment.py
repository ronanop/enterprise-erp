"""Asset assignment ORM per ERD_15 section 6.4."""

from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.asset.models.mixins import AstTransactionMixin

# Portable CHECK (PostgreSQL + SQLite): employee allocation is directory XOR manual.
CK_AST_ASSET_ASSIGNMENT_EMPLOYEE_IDENTITY = (
    "("
    "("
    "allocation_type = 'employee' "
    "AND employee_source = 'MASTER_DATA' "
    "AND employee_id IS NOT NULL "
    "AND manual_employee_name IS NULL "
    "AND manual_employee_phone IS NULL "
    "AND manual_employee_email IS NULL "
    "AND manual_employee_deployed_to IS NULL"
    ") OR ("
    "allocation_type = 'employee' "
    "AND employee_source = 'MANUAL_ENTRY' "
    "AND employee_id IS NULL "
    "AND manual_employee_name IS NOT NULL AND trim(manual_employee_name) <> '' "
    "AND manual_employee_phone IS NOT NULL AND trim(manual_employee_phone) <> '' "
    "AND manual_employee_deployed_to IS NOT NULL AND trim(manual_employee_deployed_to) <> ''"
    ") OR ("
    "allocation_type <> 'employee' "
    "AND employee_id IS NULL "
    "AND employee_source IS NULL "
    "AND manual_employee_name IS NULL "
    "AND manual_employee_phone IS NULL "
    "AND manual_employee_email IS NULL "
    "AND manual_employee_deployed_to IS NULL"
    ")"
    ")"
)


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
        CheckConstraint(
            "employee_source IS NULL OR employee_source IN ('MASTER_DATA','MANUAL_ENTRY')",
            name="ck_ast_asset_assignment_employee_source",
        ),
        CheckConstraint(
            CK_AST_ASSET_ASSIGNMENT_EMPLOYEE_IDENTITY,
            name="ck_ast_asset_assignment_employee_identity",
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
    employee_source: Mapped[str | None] = mapped_column(String(20), nullable=True)
    manual_employee_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    manual_employee_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    manual_employee_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    manual_employee_deployed_to: Mapped[str | None] = mapped_column(String(255), nullable=True)
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
