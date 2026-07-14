"""Quality defect type ORM."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.quality.models.mixins import QmMasterMixin


class QmDefectType(Base, *QmMasterMixin):
    __tablename__ = "qm_defect_type"
    __table_args__ = (
        UniqueConstraint("company_id", "defect_type_code", name="uk_qm_dft_company_code"),
        CheckConstraint(
            "severity_default IN ('minor','major','critical')",
            name="ck_qm_dft_severity",
        ),
        CheckConstraint(
            "category IN ('material','process','packaging','labeling','other')",
            name="ck_qm_dft_category",
        ),
        CheckConstraint("status IN ('active','inactive')", name="ck_qm_dft_status"),
        {"schema": "quality"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    defect_type_code: Mapped[str] = mapped_column(String(50), nullable=False)
    defect_type_name: Mapped[str] = mapped_column(String(255), nullable=False)
    severity_default: Mapped[str] = mapped_column(String(30), nullable=False, default="minor")
    category: Mapped[str] = mapped_column(String(30), nullable=False, default="other")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
