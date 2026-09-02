"""OneDrive / SharePoint file metadata ORM."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.marketing.models.mixins import MktTransactionMixin


class MktM365File(Base, *MktTransactionMixin):
    __tablename__ = "mkt_m365_file"
    __table_args__ = (
        CheckConstraint(
            "storage_tier IN ('onedrive','sharepoint')",
            name="ck_mkt_m365_file_tier",
        ),
        {"schema": "marketing"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    workspace_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("marketing.mkt_m365_workspace.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    campaign_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("marketing.mkt_campaign.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    owner_user_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True, index=True)
    file_name: Mapped[str] = mapped_column(String(500), nullable=False)
    folder_path: Mapped[str] = mapped_column(String(500), nullable=False, default="/Content")
    storage_tier: Mapped[str] = mapped_column(String(20), nullable=False, default="onedrive")
    graph_item_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    web_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    version_label: Mapped[str] = mapped_column(String(20), nullable=False, default="0.1")
    approval_stage: Mapped[str | None] = mapped_column(String(40), nullable=True)
    department: Mapped[str | None] = mapped_column(String(100), nullable=True)
    extra_metadata: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft")
