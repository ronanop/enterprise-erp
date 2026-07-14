"""CRM pipeline ORM."""

from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.crm.models.mixins import CrmMasterMixin


class CrmPipeline(Base, *CrmMasterMixin):
    __tablename__ = "crm_pipeline"
    __table_args__ = (
        UniqueConstraint("company_id", "pipeline_code", name="uk_crm_pipe_company_code"),
        CheckConstraint("status IN ('active','inactive')", name="ck_crm_pipe_status"),
        {"schema": "crm"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    pipeline_code: Mapped[str] = mapped_column(String(50), nullable=False)
    pipeline_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
    stages_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
