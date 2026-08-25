"""Microsoft 365 campaign workspace ORM."""

from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.marketing.models.mixins import MktTransactionMixin


class MktM365Workspace(Base, *MktTransactionMixin):
    __tablename__ = "mkt_m365_workspace"
    __table_args__ = ({"schema": "marketing"},)

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    campaign_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("marketing.mkt_campaign.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    teams_group_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    teams_channel_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    teams_web_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    sharepoint_site_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    sharepoint_library_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    sharepoint_web_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    folder_structure: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    graph_payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    provision_status: Mapped[str] = mapped_column(String(30), nullable=False, default="queued")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active")
